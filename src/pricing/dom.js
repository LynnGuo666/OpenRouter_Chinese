  function parseDisplayedPriceOccurrence(text, match) {
    const index = match.index || 0;
    if (index > 0 && /[-A-Za-z_]/.test(text[index - 1])) return null;

    const amount = Number(match[1].replaceAll(",", ""));
    if (!Number.isFinite(amount) || amount < 0) return null;

    const followingText = text.slice(index + match[0].length);
    const slash = followingText.match(/^\s*\/\s*/);
    if (slash) {
      const unitText = followingText.slice(slash[0].length);
      if (!unitText.startsWith("$")) {
        const parsed = parseDisplayedPrice(text.slice(index));
        if (!parsed || !parsed.rawUnit) return null;
        return {
          ...parsed,
          matchedText: match[0],
          index,
          isFrom: false,
        };
      }
    }

    return {
      amount,
      rawUnit: "",
      unitZh: "",
      matchedText: match[0],
      index,
      isFrom: false,
    };
  }

  function parseDisplayedPrices(text) {
    if (typeof text !== "string" || text.length > 160) return [];
    return [...text.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)].flatMap((match) => {
      const parsed = parseDisplayedPriceOccurrence(text, match);
      return parsed ? [parsed] : [];
    });
  }

  function parseSplitDisplayedPrice(parts) {
    if (!Array.isArray(parts) || parts.length < 2) return null;
    const source = parts.map((part) => String(part)).join("");
    const parsedPrices = parseDisplayedPrices(source);
    return parsedPrices.length === 1 && source.trim() === parsedPrices[0].matchedText
      ? parsedPrices[0]
      : null;
  }

  function parsePriceContainerText(text) {
    const source = String(text || "");
    const trimmed = source.trim();
    if (!trimmed) return null;

    const fullPrice = parseDisplayedPrice(source);
    const contentStart = source.search(/\S/);
    const contentEnd = source.length - (source.match(/\s*$/)?.[0].length || 0);
    if (
      !fullPrice ||
      fullPrice.index !== contentStart ||
      fullPrice.index + fullPrice.matchedText.length !== contentEnd
    ) {
      return null;
    }

    const parsedPrices = parseDisplayedPrices(source);
    return parsedPrices.length === 1 ? parsedPrices[0] : null;
  }

  function isAllowedPriceNode(node) {
    const parent = node.parentElement;
    if (!parent) return false;
    if (parent.closest('[data-marketplace-wrapper="true"], #providers, main table')) return true;
    if (isComparePath(location.pathname)) return Boolean(parent.closest("main"));

    const modelTitle = document.querySelector("#model-title-row");
    if (!modelTitle || !parent.closest("main")) return false;
    const context = parent.closest("div, section, td")?.textContent || parent.textContent || "";
    return (
      context.length <= 500 &&
      /(?:\b(?:price|input\s*\/m|output\s*\/m|in\s*\/\s*out)\b|价格|输入\s*\/\s*输出)/i.test(
        context,
      )
    );
  }

  function createPriceCnyElement(quote) {
    const cny = document.createElement("span");
    cny.dataset.orlOwned = "true";
    cny.dataset.orlPriceCny = "true";
    cny.className = "orl-price-cny";
    cny.textContent = Number.isFinite(quote?.cny) ? `(¥${formatCnyPrice(quote.cny)})` : "";
    return cny;
  }

  function collectPriceElementText(element) {
    const entries = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement?.closest("[data-orl-owned]")) entries.push(node);
    }
    return {
      entries,
      source: entries.map((node) => node.nodeValue || "").join(""),
    };
  }

  function findSplitPriceElement(node) {
    let element = node.parentElement;
    for (let depth = 0; element && depth < 5; depth += 1) {
      if (element.closest("[data-orl-owned]")) return null;
      const collected = collectPriceElementText(element);
      if (collected.entries.length >= 2 && parsePriceContainerText(collected.source)) {
        return element;
      }
      if (element.matches("td, th, li, section")) return null;
      element = element.parentElement;
    }
    return null;
  }

  function insertPriceCnyElement(element, entries, insertionOffset, cny) {
    let consumed = 0;
    for (const node of entries) {
      const text = node.nodeValue || "";
      const end = consumed + text.length;
      if (insertionOffset > end) {
        consumed = end;
        continue;
      }

      const localOffset = Math.max(0, insertionOffset - consumed);
      if (localOffset === 0) {
        node.before(cny);
      } else if (localOffset === text.length) {
        const parent = node.parentElement;
        if (parent && parent !== element && parent.childNodes.length === 1) parent.after(cny);
        else node.after(cny);
      } else {
        const tail = node.splitText(localOffset);
        tail.before(cny);
      }
      return true;
    }
    return false;
  }

  function renderPriceInline(wrapper, original, parsedPrices, quotes) {
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    parsedPrices.forEach((parsed, index) => {
      const start = parsed.index;
      const end = start + parsed.matchedText.length;
      if (start < cursor || end > original.length) return;
      fragment.append(document.createTextNode(original.slice(cursor, end)));
      fragment.append(createPriceCnyElement(quotes[index]));
      cursor = end;
    });

    fragment.append(document.createTextNode(original.slice(cursor)));
    wrapper.replaceChildren(fragment);
  }

  function updatePriceRecord(record, quotes) {
    const cnyElements = record.wrapper.matches?.("[data-orl-price-cny]")
      ? [record.wrapper]
      : record.wrapper.querySelectorAll("[data-orl-price-cny]");
    quotes.forEach((quote, index) => {
      const cny = cnyElements[index];
      if (cny) cny.textContent = Number.isFinite(quote?.cny) ? `(¥${formatCnyPrice(quote.cny)})` : "";
    });
  }

  function removePriceRecord(node) {
    const record = priceRecords.get(node);
    if (!record) return;
    if (record.mode === "append") {
      record.wrapper.remove();
    } else if (record.wrapper.isConnected) {
      record.wrapper.replaceWith(document.createTextNode(record.original));
    }
    priceRecords.delete(node);
  }

  function enhanceSplitPriceElement(element) {
    if (!element || element.closest("[data-orl-owned]")) return false;
    const { entries, source } = collectPriceElementText(element);
    const existing = priceRecords.get(element);
    if (existing?.mode === "append" && existing.wrapper.isConnected && existing.original === source) {
      const parsedPrice = parsePriceContainerText(source);
      const quote = parsedPrice && calculatePriceQuote(parsedPrice.amount, rates);
      if (quote && Number.isFinite(quote.cny)) updatePriceRecord(existing, [quote]);
      return true;
    }
    if (existing) removePriceRecord(element);
    if (entries.length < 2) return false;

    const parsedPrice = parsePriceContainerText(source);
    if (!parsedPrice) return false;
    const quote = calculatePriceQuote(parsedPrice.amount, rates);
    if (!quote || !Number.isFinite(quote.cny)) return false;

    const cny = createPriceCnyElement(quote);
    if (!insertPriceCnyElement(element, entries, parsedPrice.index + parsedPrice.matchedText.length, cny)) {
      return false;
    }
    priceRecords.set(element, { wrapper: cny, original: source, mode: "append" });
    return true;
  }

  function enhancePriceNode(node) {
    if (node.parentElement?.closest("[data-orl-owned]")) return;
    if (!settings.enabled || !settings.showCny || !rates || shouldSkipNode(node)) {
      removePriceRecord(node);
      return;
    }
    if (!isAllowedPriceNode(node)) {
      removePriceRecord(node);
      return;
    }
    const parsedPrices = parseDisplayedPrices(node.nodeValue || "");
    if (parsedPrices.length === 0) {
      const splitPriceElement = node.nodeValue?.includes("$") ? findSplitPriceElement(node) : null;
      if (splitPriceElement && enhanceSplitPriceElement(splitPriceElement)) return;
      removePriceRecord(node);
      return;
    }
    const quotes = parsedPrices.map((parsed) => calculatePriceQuote(parsed.amount, rates));
    if (quotes.some((quote) => !quote || !Number.isFinite(quote.cny))) return;

    const existing = priceRecords.get(node);
    if (existing?.wrapper.isConnected && existing.original === node.nodeValue) {
      updatePriceRecord(existing, quotes);
      return;
    }
    removePriceRecord(node);

    const wrapper = document.createElement("span");
    wrapper.dataset.orlOwned = "true";
    wrapper.dataset.orlPriceInline = "true";
    wrapper.dataset.orlPriceOriginal = node.nodeValue || "";
    wrapper.className = "orl-price-inline";
    renderPriceInline(wrapper, node.nodeValue || "", parsedPrices, quotes);
    priceRecords.set(node, { wrapper, original: node.nodeValue || "" });
    node.replaceWith(wrapper);
  }

  function scanPrices(root) {
    if (!settings.enabled || !settings.showCny || !rates) return;
    const scope = root.nodeType === Node.TEXT_NODE ? root.parentElement : root;
    if (!(scope instanceof Element) || scope.closest("[data-orl-owned]")) return;

    for (const [sourceNode, record] of priceRecords) {
      if (record.mode === "append") {
        const currentSource = collectPriceElementText(sourceNode).source;
        if (currentSource !== record.original) {
          removePriceRecord(sourceNode);
          continue;
        }
      }
      if (record.wrapper.isConnected) {
        const parsedPrices = parseDisplayedPrices(record.original);
        const quotes = parsedPrices.map((parsed) => calculatePriceQuote(parsed.amount, rates));
        if (quotes.every((quote) => quote && Number.isFinite(quote.cny))) {
          updatePriceRecord(record, quotes);
        }
      }
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement?.closest("[data-orl-owned]")) continue;
      if (node.nodeValue?.includes("$")) enhancePriceNode(node);
      else removePriceRecord(node);
    }
  }

  function restorePrices() {
    for (const node of [...priceRecords.keys()]) removePriceRecord(node);
    document.querySelectorAll("[data-orl-price-badge]").forEach((element) => element.remove());
    document.querySelectorAll("[data-orl-price-cny]").forEach((element) => {
      if (!element.closest("[data-orl-price-inline]")) element.remove();
    });
    document.querySelectorAll("[data-orl-price-inline]").forEach((element) => {
      const original = element.dataset.orlPriceOriginal;
      if (original !== undefined) element.replaceWith(document.createTextNode(original));
      else element.remove();
    });
  }

