// Main entry: wires face, sidebar, chat, composer, and the API together.

import { initTheme } from "./theme.js";
import { createFace } from "./face.js";
import { createSidebar } from "./sidebar.js";
import { createChat } from "./chat.js";
import { askJeff } from "./api.js";

initTheme();

const faceEl = document.getElementById("face");
const heroEl = document.getElementById("heroFace");
const headerFace = createFace(faceEl);
const heroFace = createFace(heroEl);

const IDLE = ["blink", "blink", "smug", "blink", "happy", "sus"];
heroFace.startIdle(IDLE);
headerFace.startIdle(IDLE);
headerFace.set("blink"); heroFace.set("blink");

// Power-on interaction: first visit of a session, the user turns Jeff on.
const powerBtn = document.getElementById("powerBtn");
const bootLine = document.getElementById("bootLine");
const rest = document.getElementById("rest");
const header = document.querySelector("header");
const openChip = document.getElementById("openChip");

let powered = true;
try { powered = sessionStorage.getItem("jeff-booted") === "1"; } catch {}

function revealUI() {
  header.classList.remove("pre-hide");
  header.classList.add("pre-in");
  openChip.classList.remove("pre-hide");
  openChip.classList.add("pre-in");
}

function skipPower() {
  powerBtn.classList.add("gone");
  bootLine.classList.add("gone");
  document.getElementById("warnText").classList.add("gone");
  rest.classList.add("in");
  revealUI();
  headerFace.set("blink");
  try { sessionStorage.setItem("jeff-booted", "1"); } catch {}
}

if (!powered) {
  powered = false;
  heroFace.setPaused(true);
  headerFace.setPaused(true);
  heroFace.set("smug");

  function powerOn() {
    if (powered) return;
    powered = true;
    heroFace.clearOff();
    heroFace.setPaused(false);
    headerFace.setPaused(false);
    heroFace.boot();
    revealUI();

    // typed welcome, then reveal the landing
    const line = "Jeff online. Judging has resumed.";
    let i = 0;
    bootLine.innerHTML = '<span class="caret"></span>';
    const typer = setInterval(() => {
      i++;
      bootLine.innerHTML = line.slice(0, i) + '<span class="caret">▍</span>';
      if (i >= line.length) {
        clearInterval(typer);
        setTimeout(skipPower, 700);
      }
    }, 34);
  }

  powerBtn.addEventListener("click", powerOn);
} else {
  skipPower();
}

// Pause idle animations when the tab is hidden: zero background CPU.
document.addEventListener("visibilitychange", () => {
  const paused = document.hidden;
  heroFace.setPaused(paused);
  headerFace.setPaused(paused);
});

const sidebar = createSidebar();
const chat = createChat();

function resetChat() {
  if (busy) return;
  history.length = 0;
  document.getElementById('chat').innerHTML = '';
  document.getElementById('chat').style.display = 'none';
  document.getElementById('landing').style.display = 'flex';
  document.getElementById('resetBtn').hidden = true;
  headerFace.set('blink');
  sidebar.reset();
  setMood('Online', 'cyan', false);
  input.focus();
}
document.getElementById('resetBtn').addEventListener('click', resetChat);

const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const pill = document.getElementById("pill");

const history = []; // [{user, jeff}], capped at 4 in api.js
let busy = false;

function setReady(ready) {
  sendBtn.classList.toggle("ready", ready);
}

async function send() {
  const message = input.value.trim();
  if (!message || busy || !powered) return;
  busy = true;
  input.value = "";
  setReady(false);
  sendBtn.classList.remove("squint");

  chat.activate();
  document.getElementById('resetBtn').hidden = false;
  chat.add("user", message);

  const faceExprBefore = "think";
  headerFace.set(faceExprBefore);
  sidebar.run(message);
  chat.setMood("Judging…", "amber", true);
  const thinkingRow = chat.thinking();

  try {
    const res = await askJeff(message, history);
    thinkingRow.remove();

    if (res.safetyNet) {
      sidebar.safety(null, res.mode);
      sidebar.winner(null, null);
    } else {
      sidebar.safety(res.nouls);
      sidebar.winner(res.score, res.beat);
    }

    const row = chat.add("jeff", res.reply, res.serious);
    chat.attachAlts(row, res.alts);
    chat.express(res, headerFace, res.mood, res.dot, 2600);
    history.push({ user: message, jeff: res.reply });
  } catch (err) {
    console.error("askJeff failed:", err);
    thinkingRow.remove();
    chat.add("jeff", "Something broke on my end. Which is rare, and frankly offensive. Try again.", false);
    chat.setMood("Glitching", "amber", true);
    setTimeout(() => chat.setMood("Online", "cyan", false), 2200);
  } finally {
    busy = false;
    chat.scroll();
    input.focus();
  }
}

input.addEventListener("input", () => setReady(input.value.trim().length > 0));
input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
sendBtn.addEventListener("click", () => {
  if (!input.value.trim()) return;
  sendBtn.classList.add("squint");
  setTimeout(() => sendBtn.classList.remove("squint"), 260);
  send();
});

document.querySelectorAll(".suggestions button").forEach((b) => {
  b.addEventListener("click", () => {
    input.value = b.textContent;
    input.dispatchEvent(new Event("input"));
    send();
  });
});

// Send-face eye tracking: eyes follow the cursor across the whole pill,
// rAF-throttled, paused while a request is in flight.
const sEyes = sendBtn.querySelectorAll(".s-eye");
const sMouth = sendBtn.querySelector(".s-mouth");
let lastEvent = null, raf = 0;

function track() {
  raf = 0;
  if (!lastEvent) return;
  const r = sendBtn.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const dx = lastEvent.clientX - cx, dy = lastEvent.clientY - cy;
  const dist = Math.hypot(dx, dy) || 1;
  const k = Math.min(dist, 260) / 260;
  const close = dist < 90 ? 1.12 : 1;
  const tx = ((dx / dist) * k * 7).toFixed(2);
  const ty = ((dy / dist) * k * 5).toFixed(2);
  sEyes.forEach((eye) => (eye.style.transform = `translate(${tx}px, ${ty}px) scale(${close})`));
  sMouth.style.transform = `translateX(${((dx / dist) * k * 3).toFixed(2)}px)`;
}

pill.addEventListener("mousemove", (e) => {
  if (busy) return;
  lastEvent = e;
  if (!raf) raf = requestAnimationFrame(track);
});
pill.addEventListener("mouseleave", () => {
  lastEvent = null;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  sEyes.forEach((eye) => (eye.style.transform = ""));
  sMouth.style.transform = "";
});
