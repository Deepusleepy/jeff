// Sidebar: open/close, dock on wide screens, pipeline animation.
// The pipeline mirrors the real API stages and is fed with real values.

const isWide = () => window.innerWidth >= 1120;

export function createSidebar() {
  const sidebar = document.getElementById("sidebar");
  const scrim = document.getElementById("scrim");
  const main = document.getElementById("main");
  const openChip = document.getElementById("openChip");
  const steps = [1, 2, 3, 4].map((n) => document.getElementById(`st${n}`));
  const subs = {
    received: document.getElementById("st1sub"),
    safety: document.getElementById("st3sub"),
    winner: document.getElementById("st4sub"),
  };
  const timers = [];

  function sync(open) {
    sidebar.classList.toggle("open", open);
    openChip.classList.toggle("hide", open);
    if (open && isWide()) { main.classList.add("docked"); scrim.classList.remove("on"); }
    else if (open) { main.classList.remove("docked"); scrim.classList.add("on"); }
    else { main.classList.remove("docked"); scrim.classList.remove("on"); }
  }

  openChip.addEventListener("click", () => sync(true));
  document.getElementById("sbClose").addEventListener("click", () => sync(false));
  scrim.addEventListener("click", () => sync(false));
  window.addEventListener("resize", () => sync(sidebar.classList.contains("open")));
  sync(true); // default open everywhere; the user can close it

  function reset() {
    timers.forEach(clearTimeout); timers.length = 0;
    steps.forEach((s) => {
      s.classList.remove("on", "done");
      const bar = s.querySelector(".pbar i");
      if (bar) bar.style.width = "0%";
    });
    subs.received.textContent = "Idle. Say something to Jeff and watch.";
    subs.safety.textContent = "Nonsense · personal · threat · distress";
    subs.winner.textContent = "-";
  }

  function run(message) {
    reset();
    const trunc = message.length > 34 ? `${message.slice(0, 34)}…` : message;
    steps[0].classList.add("on");
    subs.received.textContent = `"${trunc}"`;
    timers.push(setTimeout(() => { steps[0].classList.add("done"); steps[1].classList.add("on"); }, 260));
    timers.push(setTimeout(() => { steps[1].classList.add("done"); steps[2].classList.add("on"); }, 1150));
    timers.push(setTimeout(() => { steps[1].classList.add("done"); }, 1250));
    timers.push(setTimeout(() => { steps[2].classList.add("done"); steps[3].classList.add("on"); }, 1450));
    timers.push(setTimeout(() => { steps[3].classList.add("done"); }, 1750));
  }

  // Real values land as they arrive from the API.
  function safety(values, netMode) {
    if (!values) {
      subs.safety.textContent = netMode ? `Safety net: ${netMode}` : "All clear ✓";
      return;
    }
    const f = (v) => (v ?? 0).toFixed(2);
    subs.safety.textContent = `Nonsense ${f(values.nonsense)} · personal ${f(values.aboutUser)} · threat ${f(values.threat)} · distress ${f(values.upset)}`;
  }
  function winner(score, beat) {
    subs.winner.innerHTML = score != null
      ? `<em>${score}</em> · beat ${beat} other lines`
      : `Safety net, no model call`;
  }

  return { run, safety, winner, reset };
}
