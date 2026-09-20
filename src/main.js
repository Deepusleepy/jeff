// Main entry: wires face, sidebar, chat, composer, and the API together.

import { initTheme } from "./theme.js";
import { createFace } from "./face.js";
import { createSidebar } from "./sidebar.js";
import { createChat } from "./chat.js";
import { askJeff, userMessageForError } from "./api.js";

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
const composer = document.getElementById("composer");
const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

let powered = true;
try { powered = sessionStorage.getItem("jeff-booted") === "1"; } catch {}

function revealUI() {
  header.hidden = false;
  header.inert = false;
  header.classList.remove("pre-hide");
  header.classList.add("pre-in");
  openChip.hidden = false;
  openChip.inert = false;
  openChip.classList.remove("pre-hide", "hide");
  openChip.classList.add("pre-in");
}

function skipPower() {
  powerBtn.classList.add("gone");
  bootLine.classList.add("gone");
  document.getElementById("warnText").classList.add("gone");
  rest.hidden = false;
  rest.inert = false;
  rest.classList.add("in");
  composer.hidden = false;
  composer.inert = false;
  composer.classList.remove("pre-hide");
  composer.classList.add("pre-in");
  revealUI();
  headerFace.set("blink");
  try { sessionStorage.setItem("jeff-booted", "1"); } catch {}
  requestAnimationFrame(() => document.getElementById("input").focus());
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

    // Typed welcome, unless the user has asked the OS to reduce motion.
    const line = "Jeff online. Judging has resumed.";
    if (prefersReducedMotion.matches) {
      bootLine.textContent = line;
      skipPower();
      return;
    }
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
  chat.setMood('Online', 'cyan', false);
  input.focus();
}
document.getElementById('resetBtn').addEventListener('click', resetChat);

const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const pill = document.getElementById("pill");

const history = []; // [{user, jeff}], capped at 4 in api.js
let busy = false;
let composing = false;

function setReady(ready = input.value.trim().length > 0) {
  sendBtn.classList.toggle("ready", ready);
  sendBtn.disabled = busy || !ready;
}

function setBusy(nextBusy) {
  busy = nextBusy;
  input.disabled = nextBusy;
  pill.setAttribute("aria-busy", String(nextBusy));
  chat.setBusy(nextBusy);
  setReady();
}

async function send() {
  const message = input.value.trim();
  if (!message || busy || !powered) return;
  setBusy(true);
  input.value = "";
  setReady(false);
  sendBtn.classList.remove("squint");

  chat.activate();
  document.getElementById('resetBtn').hidden = false;
  const userRow = chat.add("user", message);

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
    history.push({ user: message, jeff: res.reply, mode: res.mode, at: Date.now() });
    if (history.length > 4) history.splice(0, history.length - 4);
  } catch (err) {
    console.warn("askJeff failed", { code: err?.code, status: err?.status });
    thinkingRow.remove();
    userRow.remove();
    input.value = message;
    const errorRow = chat.add("jeff", userMessageForError(err), false);
    errorRow.setAttribute("role", "alert");
    sidebar.fail();
    chat.setMood("Glitching", "amber", true);
    setTimeout(() => chat.setMood("Online", "cyan", false), 2200);
  } finally {
    setBusy(false);
    chat.scroll();
    input.focus();
  }
}

input.addEventListener("input", () => setReady());
input.addEventListener("compositionstart", () => { composing = true; });
input.addEventListener("compositionend", () => { composing = false; });
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing && !composing) {
    event.preventDefault();
    send();
  }
});
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

if (!prefersReducedMotion.matches) {
  pill.addEventListener("mousemove", (event) => {
    if (busy) return;
    lastEvent = event;
    if (!raf) raf = requestAnimationFrame(track);
  });
  pill.addEventListener("mouseleave", () => {
    lastEvent = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    sEyes.forEach((eye) => (eye.style.transform = ""));
    sMouth.style.transform = "";
  });
}
