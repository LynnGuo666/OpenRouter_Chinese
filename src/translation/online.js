  function hashText(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function translationCancelledError() {
    const error = new Error("翻译任务已取消");
    error.name = "AbortError";
    return error;
  }

  async function translateMaskedChunk(maskedText) {
    const key = `${TRANSLATION_SCHEMA_VERSION}:${maskedText.length}:${hashText(maskedText)}`;
    const cached = translationCache[key];
    if (typeof cached?.translatedMasked === "string") {
      cached.lastUsed = Date.now();
      return cached.translatedMasked;
    }
    if (translationInFlight.has(key)) return translationInFlight.get(key);

    const promise = (async () => {
      const url =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=" +
        encodeURIComponent(maskedText);
      const payload = await requestJson(url, 12000);
      const translatedMasked = payload?.[0]?.map((part) => part?.[0] || "").join("").trim();
      if (!translatedMasked) throw new Error("翻译响应为空");
      const sourceMarkers = maskedText.match(/__ORL_P\d+__/g) || [];
      const translatedMarkers = translatedMasked.match(/__ORL_P\d+__/g) || [];
      if (
        sourceMarkers.length !== translatedMarkers.length ||
        sourceMarkers.some((marker) => translatedMarkers.filter((item) => item === marker).length !== 1)
      ) {
        throw new Error("翻译响应中的保护标记无效");
      }

      translationCache[key] = { translatedMasked, lastUsed: Date.now() };
      const entries = Object.entries(translationCache);
      if (entries.length > TRANSLATION_CACHE_LIMIT) {
        entries
          .sort(([, left], [, right]) => Number(left?.lastUsed || 0) - Number(right?.lastUsed || 0))
          .slice(0, entries.length - TRANSLATION_CACHE_LIMIT)
          .forEach(([oldKey]) => delete translationCache[oldKey]);
      }
      scheduleTranslationCachePersist();
      return translatedMasked;
    })();
    translationInFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      if (translationInFlight.get(key) === promise) translationInFlight.delete(key);
    }
  }

  async function translateContentText(text, isStillCurrent = () => true, additionalEntities = []) {
    const protectedText = maskProtectedTranslationText(text, additionalEntities);
    const translatedChunks = [];
    for (const chunk of splitTranslationText(protectedText.masked)) {
      if (!isStillCurrent()) throw translationCancelledError();
      const leading = chunk.match(/^\s*/)?.[0] || "";
      const trailing = chunk.match(/\s*$/)?.[0] || "";
      const content = chunk.slice(leading.length, chunk.length - trailing.length);
      if (!content) {
        translatedChunks.push(chunk);
        continue;
      }
      const translatedMasked = await translateMaskedChunk(content);
      if (!isStillCurrent()) throw translationCancelledError();
      translatedChunks.push(`${leading}${translatedMasked}${trailing}`);
    }
    const translated = restoreProtectedTranslationText(
      translatedChunks.join(""),
      protectedText.entities,
    );
    if (!translated) throw new Error("翻译响应为空或保护标记丢失");
    return translated;
  }

  function scheduleTranslationCachePersist() {
    global.clearTimeout(translationPersistTimer);
    translationPersistTimer = global.setTimeout(() => {
      writeValue(TRANSLATION_CACHE_KEY, translationCache);
    }, 1000);
  }

  function runDescriptionWorkers() {
    while (descriptionWorkers < CONTENT_WORKER_LIMIT && descriptionQueue.length > 0) {
      const task = descriptionQueue.shift();
      const {
        kind,
        node,
        element,
        attribute,
        original,
        source,
        route,
        protectedEntities,
        generation,
        taskId,
        attempt,
      } = task;
      descriptionWorkers += 1;
      (async () => {
        const isCurrent = () =>
          settings.enabled &&
          settings.translateContent &&
          generation === descriptionGeneration &&
          route === location.pathname &&
          (kind === "attribute"
            ? element?.isConnected && element.getAttribute(attribute) === original
            : node?.isConnected && node.nodeValue === original);
        let retryScheduled = false;
        try {
          if (!isCurrent()) return;
          const translated = await translateContentText(source, isCurrent, protectedEntities);
          if (!isCurrent()) return;
          if (kind === "attribute") {
            const records = attributeRecords.get(element) || {};
            records[attribute] = { original, rendered: translated, owner: "remote" };
            attributeRecords.set(element, records);
            element.setAttribute(attribute, translated);
          } else {
            const rendered = preserveWhitespace(original, translated);
            textRecords.set(node, {
              original,
              rendered,
              owner: "remote",
            });
            node.nodeValue = rendered;
          }
        } catch (error) {
          if (
            error?.name !== "AbortError" &&
            isCurrent() &&
            attempt < CONTENT_TRANSLATION_RETRY_LIMIT
          ) {
            retryScheduled = true;
            global.setTimeout(
              () => {
                if (isCurrent()) {
                  descriptionQueue.push({ ...task, attempt: attempt + 1 });
                  runDescriptionWorkers();
                  return;
                }
                if (kind === "attribute") deleteAttributePending(element, attribute, taskId);
                else if (descriptionPending.get(node) === taskId) descriptionPending.delete(node);
              },
              400 * 2 ** attempt,
            );
          } else if (error?.name !== "AbortError") {
            setDescriptionStatus("部分页面内容暂时无法翻译");
          }
        } finally {
          if (!retryScheduled) {
            if (kind === "attribute") deleteAttributePending(element, attribute, taskId);
            else if (descriptionPending.get(node) === taskId) descriptionPending.delete(node);
          }
          descriptionWorkers -= 1;
          runDescriptionWorkers();
        }
      })();
    }
  }

