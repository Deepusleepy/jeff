// Jeff's face: a tiny SVG character with expressions.
// All intervals created here are returned so the app can pause them
// when the tab is hidden (zero idle CPU when you're not looking).

export function faceSvg(expr) {
  return `<svg class="avatar" data-e="${expr}" width="100%" height="100%" viewBox="0 0 64 64" aria-hidden="true">
    <rect class="eye l" x="15" y="18" width="8" height="17" rx="4" fill="var(--cyan)"/>
    <rect class="eye r" x="41" y="18" width="8" height="17" rx="4" fill="var(--cyan)"/>
    <rect class="mouth" x="24" y="45" width="16" height="3" rx="1.5"/>
  </svg>`;
}

export function createFace(container) {
  // Build the SVG once; switch expressions by attribute. Rebuilding innerHTML
  // would restart CSS keyframes every tick, so the blink would never land.
  const state = { expr: "blink", paused: false, timer: 0 };
  container.innerHTML = faceSvg(state.expr);
  const svg = container.querySelector("svg");
  const paint = () => { svg.dataset.e = state.expr; };

  // "off" state: eyes and mouth dimmed to a dark idle screen
  function setOff() {
    const eyes = svg.querySelectorAll(".eye");
    const mouth = svg.querySelector(".mouth");
    eyes.forEach((e) => (e.style.fill = "#12343b"));
    if (mouth) mouth.style.fill = "transparent";
  }
  function clearOff() {
    svg.querySelectorAll(".eye").forEach((e) => (e.style.fill = ""));
    const mouth = svg.querySelector(".mouth");
    if (mouth) mouth.style.fill = "";
  }

  // Boot sequence: eyes power on, glance around, settle. Runs once per face.
  function boot() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paint();
      return;
    }
    const eyes = svg.querySelectorAll(".eye");
    eyes.forEach((e) => (e.style.transform = "scaleY(0.04)"));
    const seq = [
      [180, () => eyes.forEach((e) => (e.style.transform = "scaleY(0.5)"))],
      [240, () => eyes.forEach((e) => (e.style.transform = "scaleY(0.04)"))],
      [420, () => eyes.forEach((e) => (e.style.transform = "scaleY(1)"))],
      [650, () => eyes.forEach((e) => (e.style.transform = "translateX(-4px)"))],
      [850, () => eyes.forEach((e) => (e.style.transform = "translateX(4px)"))],
      [1050, () => eyes.forEach((e) => (e.style.transform = ""))],
    ];
    let last = 0;
    seq.forEach(([ms, fn]) => {
      setTimeout(fn, ms);
      last = ms;
    });
    // keyframe animations restart after the transform inline styles clear
    setTimeout(() => paint(), last + 60);
  }

  return {
    set(expr) { state.expr = expr; paint(); },
    setOff,
    clearOff,
    boot,
    startIdle(cycle) {
      let i = 0;
      state.timer = setInterval(() => {
        if (document.hidden || state.paused) return;
        i = (i + 1) % cycle.length;
        state.expr = cycle[i];
        paint();
      }, 3400);
      return () => clearInterval(state.timer);
    },
    setPaused(p) { state.paused = p; },
  };
}
