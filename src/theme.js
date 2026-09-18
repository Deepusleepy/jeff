// Light/dark theme with persistence. No layout thrash: one attribute swap.

const btn = document.getElementById("themeBtn");
const iconSun = document.getElementById("iconSun");
const iconMoon = document.getElementById("iconMoon");

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
  iconSun.style.display = theme === "light" ? "none" : "block";
  iconMoon.style.display = theme === "light" ? "block" : "none";
}

export function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("jeff-theme"); } catch { /* private mode */ }
  apply(saved || "dark");
  btn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    apply(next);
    try { localStorage.setItem("jeff-theme", next); } catch { /* ignore */ }
  });
}
