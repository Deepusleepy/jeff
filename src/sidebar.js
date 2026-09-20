// Sidebar: responsive disclosure and a pipeline driven by real request events.

const isWide = () => window.innerWidth >= 1120;

export function createSidebar() {
  const sidebar = document.getElementById("sidebar");
  const closeButton = document.getElementById("sbClose");
  const scrim = document.getElementById("scrim");
  const main = document.getElementById("main");
  const openChip = document.getElementById("openChip");
  const steps = [1, 2, 3, 4].map((n) => document.getElementById(`st${n}`));
  const subs = {
    received: document.getElementById("st1sub"),
    safety: document.getElementById("st3sub"),
    winner: document.getElementById("st4sub"),
  };

  let open = false;
  let restoreFocus = null;
  let hideTimer = null;

  function focusableElements() {
    return [...sidebar.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])")]
      .filter((element) => !element.hidden);
  }

  function applyLayout() {
    if (!open) return;
    const modal = !isWide();
    main.classList.toggle("docked", !modal);
    main.inert = modal;
    if (modal) main.setAttribute("aria-hidden", "true");
    else main.removeAttribute("aria-hidden");
    sidebar.setAttribute("role", modal ? "dialog" : "complementary");
    if (modal) sidebar.setAttribute("aria-modal", "true");
    else sidebar.removeAttribute("aria-modal");
    scrim.hidden = !modal;
    scrim.classList.toggle("on", modal);
  }

  function show() {
    if (open) return;
    open = true;
    clearTimeout(hideTimer);
    restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : openChip;
    sidebar.hidden = false;
    sidebar.inert = false;
    sidebar.setAttribute("aria-hidden", "false");
    openChip.hidden = true;
    openChip.setAttribute("aria-expanded", "true");
    applyLayout();
    requestAnimationFrame(() => sidebar.classList.add("open"));
    closeButton.focus();
  }

  function hide({ restore = true } = {}) {
    if (!open) return;
    open = false;
    sidebar.classList.remove("open");
    sidebar.inert = true;
    sidebar.setAttribute("aria-hidden", "true");
    sidebar.removeAttribute("aria-modal");
    sidebar.removeAttribute("role");
    main.classList.remove("docked");
    main.inert = false;
    main.removeAttribute("aria-hidden");
    scrim.classList.remove("on");
    scrim.hidden = true;
    openChip.setAttribute("aria-expanded", "false");
    if (!openChip.classList.contains("pre-hide")) openChip.hidden = false;
    const finish = () => { if (!open) sidebar.hidden = true; };
    hideTimer = setTimeout(finish, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 300);
    if (restore && restoreFocus?.isConnected) restoreFocus.focus();
    restoreFocus = null;
  }

  function handleKeydown(event) {
    if (!open || isWide()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements();
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  openChip.addEventListener("click", show);
  closeButton.addEventListener("click", () => hide());
  scrim.addEventListener("click", () => hide());
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("resize", applyLayout);

  function reset() {
    steps.forEach((step) => {
      step.classList.remove("on", "done");
      const bar = step.querySelector(".pbar i");
      if (bar) bar.style.width = "0%";
    });
    subs.received.textContent = "Idle. Say something to Jeff and watch.";
    subs.safety.textContent = "Nonsense · personal · threat · distress";
    subs.winner.textContent = "-";
  }

  function run(message) {
    reset();
    const trunc = message.length > 34 ? `${message.slice(0, 34)}…` : message;
    steps[0].classList.add("on", "done");
    steps[1].classList.add("on");
    subs.received.textContent = `“${trunc}”`;
  }

  function safety(values, netMode) {
    steps[1].classList.add("done");
    steps[2].classList.add("on", "done");
    steps[3].classList.add("on");
    if (!values) {
      subs.safety.textContent = netMode ? `Safety net: ${netMode}` : "All clear";
      return;
    }
    const f = (value) => Number(value ?? 0).toFixed(2);
    subs.safety.textContent = `Nonsense ${f(values.nonsense)} · personal ${f(values.aboutUser)} · threat ${f(values.threat)} · distress ${f(values.upset)}`;
  }

  function winner(score, beat) {
    steps[3].classList.add("on", "done");
    subs.winner.replaceChildren();
    if (score == null) {
      subs.winner.textContent = "Safety net, no model call";
      return;
    }
    const emphasis = document.createElement("em");
    emphasis.textContent = String(score);
    subs.winner.append(emphasis, document.createTextNode(` · beat ${beat} other lines`));
  }

  function fail() {
    steps[1].classList.remove("on");
    steps[3].classList.add("on");
    subs.winner.textContent = "Request failed";
  }

  reset();
  return { run, safety, winner, fail, reset, open: show, close: hide };
}
