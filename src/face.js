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

  return {
    set(expr) { state.expr = expr; paint(); },
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
