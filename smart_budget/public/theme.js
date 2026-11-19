(() => {
  const storageKey = 'smart-budget-theme';
  let dark = false;
  try {
    dark = localStorage.getItem(storageKey) === 'dark';
  } catch {
    // The switch also works when browser storage is unavailable.
  }
  const apply = () => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('#theme-toggle')?.setAttribute('aria-checked', String(dark));
  };
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelector('#theme-toggle').addEventListener('click', () => {
      dark = !dark;
      apply();
      try {
        localStorage.setItem(storageKey, dark ? 'dark' : 'light');
      } catch {
        // Persistence is optional; changing the visible theme must still succeed.
      }
    });
  });
})();
