  const TRANSLATABLE_ATTRIBUTES = Object.freeze([
    "alt",
    "placeholder",
    "aria-label",
    "aria-description",
    "aria-valuetext",
    "title",
    "data-tooltip",
  ]);

  const CATEGORY_LABELS = Object.freeze({
    Academia: "学术",
    Finance: "金融",
    Health: "健康",
    Legal: "法律",
    Marketing: "营销",
    Programming: "编程",
    Science: "科学",
    Technology: "技术",
  });

  const UI_DICTIONARY = new Map(
    Object.values(UI_TRANSLATION_MODULES).flatMap((module) => Object.entries(module)),
  );
  const UI_TRANSLATION_MODULE_LOOKUPS = Object.freeze(
    Object.fromEntries(
      Object.entries(UI_TRANSLATION_MODULES).map(([name, module]) => [
        name,
        new Map(Object.entries(module).map(([key, value]) => [key.toLocaleLowerCase(), value])),
      ]),
    ),
  );

