// Chat rendering: bubbles, thinking row, runner-ups, expression engine wiring.

export function createChat() {
  const chat = document.getElementById("chat");
  const landing = document.getElementById("landing");
  const moodEl = document.getElementById("mood2");
  const mdotEl = document.getElementById("mdot2");

  let moodTimers = [];

  function scroll() { chat.scrollTop = chat.scrollHeight; }

  function bubbleRow(cls, text, serious) {
    const row = document.createElement("div");
    row.className = `row ${cls}`;
    const b = document.createElement("div");
    b.className = `bubble${serious ? " serious" : ""}`;
    b.textContent = text;
    row.append(b);
    return row;
  }

  function setBusy(busy) {
    chat.setAttribute("aria-busy", String(busy));
  }

  function setMood(text, dot, hot) {
    moodEl.textContent = text;
    moodEl.parentElement.classList.toggle("hot", !!hot);
    mdotEl.className = `mdot${dot && dot !== "cyan" ? ` ${dot}` : ""}`;
  }

  return {
    activate() { landing.style.display = "none"; chat.style.display = "flex"; },
    add(cls, text, serious) {
      const row = bubbleRow(cls, text, serious);
      chat.append(row); scroll();
      return row;
    },
    thinking() {
      const row = document.createElement("div");
      row.className = "row jeff";
      row.setAttribute("role", "status");
      const indicator = document.createElement("div");
      indicator.className = "thinking";
      indicator.setAttribute("aria-hidden", "true");
      indicator.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
      const label = document.createElement("span");
      label.className = "sr-only";
      label.textContent = "Jeff is choosing a reply.";
      row.append(indicator, label);
      chat.append(row); scroll();
      return row;
    },
    // Runner-up easter egg: activate a control to see what Jeff almost said.
    attachAlts(row, alts) {
      if (!alts?.length) return;
      const id = `alts-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
      const toggle = document.createElement("button");
      toggle.className = "alt-toggle";
      toggle.type = "button";
      toggle.textContent = "See other picks";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", id);
      const box = document.createElement("div");
      box.className = "alts";
      box.id = id;
      box.hidden = true;
      alts.forEach(({ text, fit }) => {
        const item = document.createElement("div");
        const score = document.createElement("b");
        score.textContent = `Fit ${Number(fit ?? 0).toFixed(2)}`;
        item.append(score, document.createTextNode(text));
        box.append(item);
      });
      toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(open));
        toggle.textContent = open ? "Hide other picks" : "See other picks";
        box.hidden = !open;
        row.classList.toggle("open", open);
        if (open) scroll();
      });
      row.append(toggle, box);
    },
    setMood,
    express({ expr }, face, mood, dot, ms) {
      moodTimers.forEach(clearTimeout); moodTimers = [];
      face.set(expr); setMood(mood, dot, true);
      if (ms) {
        moodTimers.push(setTimeout(() => { face.set("blink"); setMood("Online", "cyan", false); }, ms));
      }
    },
    setBusy,
    scroll,
  };
}
