  function boot() {
    mountDocumentStyles();
    mountPanel();
    registerMenuCommands();
    observePage();
    handleRouteChange();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(globalThis);
