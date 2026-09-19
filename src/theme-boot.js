// Runs before first paint: applies saved theme so light users see no dark flash.
try {
  var t = localStorage.getItem("jeff-theme");
  if (t) document.documentElement.dataset.theme = t;
} catch (e) {}
