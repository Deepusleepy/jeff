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
      row.innerHTML = `<div class="thinking"><i></i><i></i><i></i></div>`;
      chat.append(row); scroll();
      return row;
    },
    // Runner-up easter egg: tap a Jeff reply to see what he almost said.
    attachAlts(row, alts) {
      if (!alts?.length) return;
      const box = document.createElement("div");
      box.className = "alts";
      box.innerHTML = alts.map(({ text: t, p }) => `<div><b>${p.toFixed(2)}</b>${t}</div>`).join("");
      row.append(box);
      row.addEventListener("click", () => row.classList.toggle("open"));
      row.style.cursor = "pointer";
    },
    setMood,
    express({ expr }, face, mood, dot, ms) {
      moodTimers.forEach(clearTimeout); moodTimers = [];
      face.set(expr); setMood(mood, dot, true);
      if (ms) {
        moodTimers.push(setTimeout(() => { face.set("blink"); setMood("Online", "cyan", false); }, ms));
      }
    },
    scroll,
  };
}
