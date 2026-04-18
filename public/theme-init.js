(() => {
  try {
    const key = "acecrm.theme";
    const stored = localStorage.getItem(key);
    const theme =
      stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    const systemDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme =
      theme === "system" ? (systemDark ? "dark" : "light") : theme;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
