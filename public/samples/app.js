// Lyric Lite listening app: details -> language -> clips. Hash routes (#details, #languages, #listen-<lang>) so the
// browser's back button works too. Visitor events go to /api/track (sign-in, language, play, finished).
(() => {
  const LANGS = window.LYRIC_CLIPS || [];
  const BUCKETS = [["short", "Short"], ["medium", "Medium"], ["long", "Long"], ["very long", "Very long"]];

  const $ = (s) => document.querySelector(s);
  const view = $("#view");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get() { try { return JSON.parse(localStorage.getItem("lyric_listener") || "null"); } catch { return null; } },
    set(v) { try { localStorage.setItem("lyric_listener", JSON.stringify(v)); } catch {} },
  };
  let me = store.get();
  let filter = "all";
  const heard = new Set();

  function track(event, extra = {}) {
    if (!me) return;
    const body = JSON.stringify({ event, sid: me.sid, name: me.name, org: me.org, role: me.role, purpose: me.purpose, ...extra });
    try { fetch(window.LYRIC_TRACK_URL || "/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {}); } catch {}
  }

  const ICON = {
    back: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>',
    next: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
    play: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.2v11.6c0 .7.8 1.1 1.4.7l9-5.8c.5-.3.5-1.1 0-1.4l-9-5.8C4.8 1.1 4 1.5 4 2.2z"/></svg>',
    download: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/></svg>',
    pause: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.6" height="12" rx="1"/><rect x="9.4" y="2" width="3.6" height="12" rx="1"/></svg>',
  };
  const fmt = (t) => { t = Math.max(0, t || 0); return Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0"); };
  const mins = (clips) => Math.round(clips.reduce((s, c) => s + c.sec, 0) / 6) / 10;

  // ---------- audio: one player for the whole page
  const audio = new Audio(); audio.preload = "none";
  let active = null;
  function ui() {
    document.querySelectorAll(".clip").forEach((el) => {
      const on = el === active && !audio.paused;
      el.classList.toggle("on", on);
      const b = el.querySelector(".play");
      b.innerHTML = on ? ICON.pause : ICON.play;
      b.setAttribute("aria-label", (on ? "Pause " : "Play ") + el.dataset.label);
    });
  }
  function start(el, frac) {
    if (active !== el) {
      if (active) active.querySelector(".wave").style.setProperty("--p", "0%");
      active = el; audio.src = el.dataset.src;
    }
    const go = () => { if (typeof frac === "number") audio.currentTime = frac * (audio.duration || +el.dataset.dur); audio.play().catch(() => {}); };
    if (typeof frac === "number" && audio.readyState < 1) { audio.addEventListener("loadedmetadata", go, { once: true }); audio.load(); } else go();
    if (!el.dataset.tracked) { el.dataset.tracked = "1"; track("play", { lang: el.dataset.lang, clip: el.dataset.id, length: el.dataset.len }); }
  }
  audio.addEventListener("play", ui);
  audio.addEventListener("pause", ui);
  audio.addEventListener("ended", () => {
    if (!active) return;
    active.querySelector(".wave").style.setProperty("--p", "0%");
    if (!heard.has(active.dataset.id)) { heard.add(active.dataset.id); track("complete", { lang: active.dataset.lang, clip: active.dataset.id, length: active.dataset.len }); }
    active.classList.add("heard"); ui();
  });
  audio.addEventListener("timeupdate", () => {
    if (!active) return;
    const d = audio.duration || +active.dataset.dur;
    active.querySelector(".wave").style.setProperty("--p", (100 * audio.currentTime / d).toFixed(2) + "%");
    active.querySelector(".time").textContent = fmt(audio.currentTime) + " / " + fmt(d);
  });
  function stop() { audio.pause(); audio.removeAttribute("src"); active = null; }

  // ---------- chrome
  function chrome(step) {
    const names = ["Your details", "Language", "Listen"];
    $("#steps").innerHTML = names.map((n, i) => `<span class="${i === step ? "on" : i < step ? "done" : ""}">${String(i + 1).padStart(2, "0")} ${n}</span>`).join("");
    const who = $("#who");
    if (me && step > 0) {
      who.hidden = false;
      who.innerHTML = `<span>Listening as <b>${esc(me.name)}</b></span><button class="link" id="edit">Change details</button>`;
      $("#edit").onclick = () => go("details");
    } else who.hidden = true;
  }
  const go = (r) => { if (location.hash !== "#" + r) location.hash = r; else route(); };
  const backBtn = (label, to) => `<button class="back" data-to="${to}">${ICON.back}${label}</button>`;
  function wireBack() { view.querySelectorAll(".back").forEach((b) => (b.onclick = () => go(b.dataset.to))); }

  // ---------- 1. details
  function details() {
    chrome(0);
    const v = me || {};
    view.innerHTML = `<section class="view">
      <div class="eyebrow">Listen to Lyric Lite</div>
      <h1>Indian voices, <em>five languages</em>.</h1>
      <p class="lede">Lyric Lite is a small text-to-speech model that runs on everyday devices. Tell us who you are, choose a language, and listen to clips from short lines to long passages.</p>
      <form class="panel" id="f" novalidate>
        <div class="field"><label for="name">Your name / organisation</label><input id="name" autocomplete="name" maxlength="120" placeholder="e.g. Priya, IIT Madras" value="${esc(v.name)}" required></div>
        <p class="err" id="err" role="alert"></p>
        <button class="cta" type="submit">Continue ${ICON.next}</button>
        <p class="note">We record what you enter here and which clips you play, to understand who is listening to Lyric. Nothing else is collected.</p>
      </form></section>`;
    if (!me) $("#name").focus();
    $("#f").onsubmit = (e) => {
      e.preventDefault();
      const name = $("#name").value.trim();
      if (name.length < 2) { $("#err").textContent = "Please enter your name or organisation."; $("#name").focus(); return; }
      const changed = !me || me.name !== name;
      me = { sid: (me && me.sid) || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()), name, org: "", role: "", purpose: "" };
      store.set(me);
      if (changed) track("signin");
      go("languages");
    };
  }

  // ---------- 2. language
  function languages() {
    if (!me) return go("details");
    chrome(1);
    view.innerHTML = `<section class="view">
      ${backBtn("Back to your details", "details")}
      <div class="eyebrow">Step two</div>
      <h1>Choose a <em>language</em>.</h1>
      <p class="lede">Each language has ${LANGS[0] ? LANGS[0].clips.length : 16} clips, from a few words to long passages, all in the same voice.</p>
      <div class="langs">${LANGS.map((l) => `<button class="lang" data-code="${l.code}"><span class="nat" lang="${l.code}">${l.native}</span>
        <span class="en">${l.name}<i>${l.clips.length} clips · ${mins(l.clips)} min</i></span><span class="ghost" aria-hidden="true">${l.name[0]}</span></button>`).join("")}</div></section>`;
    view.querySelectorAll(".lang").forEach((b) => (b.onclick = () => { track("language", { lang: b.dataset.code }); filter = "all"; go("listen-" + b.dataset.code); }));
    wireBack();
  }

  // ---------- 3. listen
  const bars = (p) => p.map((v) => `<i style="height:${Math.max(8, Math.round(v * 100))}%"></i>`).join("");
  function listen(code) {
    if (!me) return go("details");
    const L = LANGS.find((l) => l.code === code);
    if (!L) return go("languages");
    chrome(2);
    const groups = BUCKETS.filter(([k]) => filter === "all" || filter === k);
    view.innerHTML = `<section class="view">
      ${backBtn("Back to languages", "languages")}
      <div class="eyebrow">${L.name} · ${L.clips.length} clips</div>
      <h1><span lang="${L.code}" style="font-family:inherit">${L.native}</span> <em>${L.name}</em></h1>
      <p class="lede">Press play to listen. Clips are grouped from short lines to long passages.</p>
      <nav class="bar" aria-label="Filters">
        <div class="chips" role="group" aria-label="Length">${[["all", "All"], ...BUCKETS].map(([k, n]) => `<button class="chip" data-f="${k}" aria-pressed="${filter === k}">${n}</button>`).join("")}</div>
        <div class="chips" role="group" aria-label="Language">${LANGS.map((l) => `<button class="chip lng" data-l="${l.code}" aria-pressed="${l.code === code}" title="${l.name}">${l.native}</button>`).join("")}</div>
      </nav>
      ${groups.map(([k, n]) => {
        const cs = L.clips.filter((c) => c.len === k);
        if (!cs.length) return "";
        return `<section class="group"><div class="group-h"><h2>${n.split(" ").length > 1 ? n.replace("long", "<em>long</em>") : `<em>${n}</em>`}</h2><span>${cs.length} clips · ${fmt(cs.reduce((s, c) => s + c.sec, 0))}</span></div>
          <div class="clips">${cs.map((c, i) => `<article class="clip${heard.has(c.id) ? " heard" : ""}" data-src="${c.file}" data-dur="${c.sec}" data-id="${c.id}" data-lang="${L.code}" data-len="${c.len}" data-label="${L.name} ${n.toLowerCase()} clip ${i + 1}">
            <button class="play" aria-label="Play ${L.name} ${n.toLowerCase()} clip ${i + 1}">${ICON.play}</button>
            <div class="wave" aria-hidden="true"><div class="bars">${bars(c.peaks)}</div><div class="bars top">${bars(c.peaks)}</div></div>
            <div class="meta"><span class="time">0:00 / ${fmt(c.sec)}</span><a class="dl" href="${c.file}" download="lyric-lite-${L.code}-${c.id}.mp3" title="Download this clip (MP3)" aria-label="Download ${L.name} ${n.toLowerCase()} clip ${i + 1}">${ICON.download}</a></div>
            <div class="num">${n} · ${String(i + 1).padStart(2, "0")}</div>
            <p class="txt" lang="${L.code}">${esc(c.text)}</p></article>`).join("")}</div></section>`;
      }).join("")}</section>`;
    view.querySelectorAll(".chip[data-f]").forEach((b) => (b.onclick = () => { filter = b.dataset.f; stop(); listen(code); }));
    view.querySelectorAll(".chip[data-l]").forEach((b) => (b.onclick = () => { if (b.dataset.l !== code) { track("language", { lang: b.dataset.l }); go("listen-" + b.dataset.l); } }));
    view.querySelectorAll(".clip").forEach((el) => {
      el.querySelector(".play").onclick = () => (active === el && !audio.paused ? audio.pause() : start(el));
    });
    wireBack();
  }

  // ---------- router
  function route() {
    stop();
    const h = location.hash.slice(1) || (me ? "languages" : "details");
    if (h === "details") details();
    else if (h === "languages") languages();
    else if (h.startsWith("listen-")) listen(h.slice(7));
    else go(me ? "languages" : "details");
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.target.closest("button, input, textarea, select")) return;
    const el = active || document.querySelector(".clip");
    if (!el) return;
    e.preventDefault();
    active === el && !audio.paused ? audio.pause() : start(el);
  });
  route();
})();
