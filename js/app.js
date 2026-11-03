/*
 * ESISTE DAVVERO? — logica del prototipo (fase 3)
 * Nessuna dipendenza. Graduatoria e statistiche usano dati di prova.
 *
 * Parametri utili per i test, come query (?mock=error) o come hash (#errore).
 * Più opzioni nell'hash si uniscono con il trattino, es. #anteprima-errore.
 *   ?anteprima=1  | #anteprima    su desktop mostra il gioco in una cornice da telefono (solo revisione)
 *   ?reset=1      | #reset        azzera la partita salvata su questo telefono
 *   ?mock=loading | #caricamento  graduatoria e statistiche restano in caricamento
 *   ?mock=empty   | #vuoto        graduatoria e statistiche vuote
 *   ?mock=error   | #errore       primo tentativo in errore (il secondo riesce)
 */
(function () {
  "use strict";

  var CONFIG = window.APP_CONFIG || {};
  var ROUNDS = window.ROUNDS || [];
  var RESULT_COPY = window.RESULT_COPY || [];
  var TOTAL = ROUNDS.length;
  var STORAGE_KEY = "esiste-davvero:" + (CONFIG.gameId || "default");
  var POLL_MS = 15000;

  var params = new URLSearchParams(location.search);
  var hashTokens = location.hash.replace(/^#/, "").split("-");
  function flag(name) { return hashTokens.indexOf(name) >= 0; }
  var MOCK_STATE = params.get("mock") ||
    (flag("errore") ? "error" : flag("vuoto") ? "empty" : flag("caricamento") ? "loading" : null);
  var PREVIEW = params.get("anteprima") === "1" || flag("anteprima");
  var RESET = params.get("reset") === "1" || flag("reset");
  var mockErrorsLeft = MOCK_STATE === "error" ? 1 : 0;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------------- Stato salvato sul telefono ---------------- */

  function freshState() {
    return { v: 1, screen: "splash", nickname: "", round: 0, phase: "question", answers: [], firstResult: null, submitted: false, replay: false };
  }

  var storageOk = true;
  function loadState() {
    try {
      if (RESET) localStorage.removeItem(STORAGE_KEY);
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshState();
      var s = JSON.parse(raw);
      if (!s || s.v !== 1) return freshState();
      return Object.assign(freshState(), s);
    } catch (e) {
      storageOk = false;
      return freshState();
    }
  }
  function saveState() {
    if (!storageOk) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { storageOk = false; }
  }

  var state = loadState();

  /* ---------------- Guard: desktop e landscape ---------------- */

  var mode = null;
  function computeMode() {
    if (PREVIEW) return "mobile";
    var w = window.innerWidth, h = window.innerHeight;
    var typing = document.activeElement && document.activeElement.tagName === "INPUT";
    if (typing) return mode === "desktop" ? "desktop" : "mobile"; // la tastiera non deve far scattare l'avviso
    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (w > h && h <= 540 && (coarse || w <= 932)) return "landscape";
    if (w > 600) return "desktop";
    return "mobile";
  }
  function applyMode() {
    var next = computeMode();
    if (next === mode) return;
    mode = next;
    document.documentElement.setAttribute("data-mode", mode);
  }

  function fillDesktopUrl() {
    var url = CONFIG.shortUrl || CONFIG.gameUrl || (location.host + location.pathname);
    var el = $("[data-short-url]");
    if (el) el.textContent = url.replace(/^https?:\/\//, "");
  }

  /* ---------------- Navigazione tra schermate ---------------- */

  var actionLock = false;
  function lockActions(ms) {
    actionLock = true;
    setTimeout(function () { actionLock = false; }, ms || 350);
  }

  var appEl = $("#app");
  function scrollTop() { window.scrollTo(0, 0); appEl.scrollTop = 0; }
  function viewportHeight() { return PREVIEW ? appEl.clientHeight : window.innerHeight; }

  function show(screen, focusEl) {
    $$("[data-screen]").forEach(function (el) { el.hidden = el.getAttribute("data-screen") !== screen; });
    state.screen = screen;
    saveState();
    scrollTop();
    stopPolling();
    var target = focusEl || $("[data-screen='" + screen + "'] [data-focus]");
    if (target) requestAnimationFrame(function () { target.focus({ preventScroll: true }); });
  }

  /* ---------------- Nickname ---------------- */

  var nicknameTouched = false;

  function normalizeNickname(v) { return String(v || "").replace(/\s+/g, " ").trim(); }

  var NICK_RE;
  try { NICK_RE = new RegExp("^[\\p{L}\\p{M}\\p{N} '’\\-]+$", "u"); }
  catch (e) { NICK_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 '’\-]+$/; }

  function validateNickname(v) {
    if (!v) return "Scrivi un nickname per continuare.";
    if (v.length < 2) return "Servono almeno 2 caratteri.";
    if (v.length > 20) return "Massimo 20 caratteri.";
    if (!NICK_RE.test(v)) return "Usa solo lettere, numeri, spazi, apostrofo e trattino.";
    return "";
  }

  function setNicknameError(msg) {
    var input = $("#nickname");
    $("[data-error]").textContent = msg;
    $("[data-error-icon]").toggleAttribute("hidden", !msg);
    if (msg) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function isNicknameTaken(v) {
    // Fase 3: controllo sui nomi di prova. In fase 5 diventa una lettura su Supabase.
    var key = v.toLocaleLowerCase("it");
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(MOCK_PLAYERS.some(function (p) { return p.nickname.toLocaleLowerCase("it") === key; }));
      }, 400);
    });
  }

  function onNicknameSubmit(ev) {
    ev.preventDefault();
    if (actionLock) return;
    var input = $("#nickname");
    var btn = $("[data-submit]");
    var value = normalizeNickname(input.value);
    input.value = value;
    nicknameTouched = true;
    var msg = validateNickname(value);
    if (msg) { setNicknameError(msg); input.focus(); return; }

    btn.setAttribute("aria-disabled", "true");
    var label = btn.firstChild.nodeValue;
    btn.firstChild.nodeValue = "Attendi… ";
    lockActions(1000);
    isNicknameTaken(value).then(function (taken) {
      actionLock = false;
      btn.removeAttribute("aria-disabled");
      btn.firstChild.nodeValue = label;
      if (taken) {
        setNicknameError("Questo nickname è già in gioco. Prova con una variante.");
        input.focus();
        return;
      }
      setNicknameError("");
      state.nickname = value;
      saveState();
      input.blur();
      show("istruzioni");
    }).catch(function () {
      // Rete assente: si prosegue, decide il database all'invio finale.
      btn.removeAttribute("aria-disabled");
      btn.firstChild.nodeValue = label;
      state.nickname = value;
      saveState();
      show("istruzioni");
    });
  }

  /* ---------------- Round e reveal ---------------- */

  var img = $("[data-image]");
  var fallback = $("[data-image-fallback]");

  img.addEventListener("load", function () { img.classList.add("is-loaded"); });
  img.addEventListener("error", function () {
    img.hidden = true;
    fallback.hidden = false;
  });

  function preload(i) {
    if (i < 0 || i >= TOTAL) return;
    var p = new Image();
    p.decoding = "async";
    p.src = ROUNDS[i].image;
  }

  function setPhase(phase) {
    var screen = $("[data-screen='round']");
    $$("[data-phase-question]", screen).forEach(function (el) { el.hidden = phase !== "question"; });
    $$("[data-phase-reveal]", screen).forEach(function (el) { el.hidden = phase !== "reveal"; });
    $("[data-pill]").hidden = phase !== "reveal";
  }

  function renderRound(i, phase) {
    var r = ROUNDS[i];
    state.round = i;
    state.phase = phase;

    $("[data-counter]").textContent = "Round " + (i + 1) + " di " + TOTAL;
    var bar = $("[role='progressbar']");
    bar.setAttribute("aria-valuenow", String(i + 1));
    bar.setAttribute("aria-valuetext", "Round " + (i + 1) + " di " + TOTAL);
    $("[data-progress]").style.width = ((i + 1) / TOTAL * 100) + "%";

    // Immagine (stessa per domanda e reveal)
    if (img.getAttribute("data-src") !== r.image) {
      img.classList.remove("is-loaded");
      img.hidden = false;
      fallback.hidden = true;
      fallback.textContent = r.brand;
      img.setAttribute("data-src", r.image);
      img.loading = i === 0 ? "eager" : "lazy";
      img.style.objectPosition = r.objectPosition || "center center";
      img.alt = r.alt || "";
      img.src = r.image;
      preload(i + 1);
    }

    $("[data-brand]").textContent = r.brand;
    $("[data-product]").textContent = r.product;
    $("[data-description]").textContent = r.description;
    $("[data-category]").textContent = r.category;

    var choices = $$("[data-answer]");
    choices.forEach(function (b) {
      b.classList.remove("is-selected");
      b.removeAttribute("aria-disabled");
      b.removeAttribute("aria-pressed");
    });

    if (phase === "reveal") fillReveal(i);
    setPhase(phase);
    if (phase === "question") requestAnimationFrame(fitMedia);
    saveState();
  }

  /* Altezza dell'immagine: 4:5 quando c'è spazio, altrimenti quanto basta
     perché testi e pulsanti restino visibili senza scorrere (minimo 170 px). */
  function fitMedia() {
    if (state.screen !== "round" || state.phase !== "question") return;
    var screen = $("[data-screen='round']");
    var media = $("[data-media]");
    var body = $(".round__body", screen);
    var cs = getComputedStyle(body);
    var used = parseFloat(getComputedStyle(screen).paddingTop) +
      $(".round__header", screen).offsetHeight +
      parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) +
      $(".round__info", screen).offsetHeight +
      $(".actions", screen).offsetHeight;
    var natural = Math.min(media.offsetWidth * 1.25, 537);
    var h = Math.max(170, Math.min(natural, viewportHeight() - used));
    media.style.height = Math.floor(h) + "px";
  }

  function fillReveal(i) {
    var r = ROUNDS[i];
    var chosen = state.answers[i];
    var correct = chosen === r.exists;

    var pill = $("[data-pill]");
    pill.textContent = r.exists ? "Esiste" : "Non esiste";

    var verdict = $("[data-verdict]");
    $("[data-verdict-text]").textContent = correct ? "Esatto." : "Non proprio.";
    $("[data-verdict-icon]").setAttribute("href", correct ? "#i-tick" : "#i-miss");
    verdict.className = "verdict t-meta " + (correct ? "is-correct" : "is-wrong");

    $("[data-reveal-title]").textContent = r.revealTitle;
    $("[data-reveal-text]").textContent = r.revealText;

    var po = $("[data-payoff]");
    po.hidden = !r.payoff;
    po.textContent = r.payoff || "";
    var tr = $("[data-transition]");
    tr.hidden = !r.transition;
    tr.textContent = r.transition || "";

    $("[data-next-label]").textContent = i === TOTAL - 1 ? "Scopri il risultato" : "Prossimo round";
    $("[data-announcer]").textContent = correct ? "Esatto." : "Non proprio.";
  }

  function goToRound(i, phase) {
    show("round", null);
    renderRound(i, phase || "question");
    var focusEl = phase === "reveal" ? $("[data-reveal-title]") : $("[data-brand]");
    requestAnimationFrame(function () { focusEl.focus({ preventScroll: true }); });
  }

  function onAnswer(btn) {
    if (state.phase !== "question" || btn.getAttribute("aria-disabled") === "true") return;
    var i = state.round;
    var value = btn.getAttribute("data-answer") === "true";
    $$("[data-answer]").forEach(function (b) { b.setAttribute("aria-disabled", "true"); });
    btn.classList.add("is-selected");
    btn.setAttribute("aria-pressed", "true");
    state.answers[i] = value;
    state.phase = "reveal";
    saveState();
    setTimeout(function () {
      fillReveal(i);
      setPhase("reveal");
      $("[data-reveal-title]").focus({ preventScroll: true });
    }, 180);
  }

  function onNext() {
    if (actionLock) return;
    lockActions();
    var i = state.round;
    if (i < TOTAL - 1) {
      scrollTop();
      renderRound(i + 1, "question");
      $("[data-announcer]").textContent = "";
      requestAnimationFrame(function () { $("[data-brand]").focus({ preventScroll: true }); });
    } else {
      finishGame();
    }
  }

  /* ---------------- Risultato ---------------- */

  function scoreOf(answers) {
    var s = 0;
    for (var i = 0; i < TOTAL; i++) if (answers[i] === ROUNDS[i].exists) s++;
    return s;
  }

  function copyFor(score) {
    for (var i = 0; i < RESULT_COPY.length; i++) {
      if (score >= RESULT_COPY[i].min && score <= RESULT_COPY[i].max) return RESULT_COPY[i];
    }
    return { title: "", text: "" };
  }

  function finishGame() {
    var score = scoreOf(state.answers);
    if (!state.firstResult) {
      state.firstResult = { score: score, answers: state.answers.slice(0, TOTAL) };
    }
    state.lastScore = score;
    saveState();
    showResult();
  }

  function showResult() {
    var score = typeof state.lastScore === "number" ? state.lastScore
      : (state.firstResult ? state.firstResult.score : scoreOf(state.answers));
    var c = copyFor(score);
    $("[data-score]").textContent = score + " / " + TOTAL;
    $("[data-score]").setAttribute("aria-label", score + " su " + TOTAL);
    $("[data-result-title]").textContent = c.title;
    $("[data-result-text]").textContent = c.text;
    $("[data-replay-note]").hidden = !state.replay;
    show("risultato");
    if (!state.replay) submitResult();
    else setStatus("", "");
  }

  /* ---------------- Invio risultato (simulato in fase 3) ---------------- */

  var statusEl = $("[data-submit-status]");

  function setStatus(text, kind, withRetry) {
    statusEl.textContent = "";
    statusEl.className = "status" + (kind === "ok" ? " is-ok" : "");
    if (!text) return;
    if (kind === "ok" || withRetry) {
      var ns = "http://www.w3.org/2000/svg";
      var ic = document.createElementNS(ns, "svg");
      ic.setAttribute("class", "icon");
      ic.setAttribute("aria-hidden", "true");
      var use = document.createElementNS(ns, "use");
      use.setAttribute("href", kind === "ok" ? "#i-tick" : "#i-alert");
      ic.appendChild(use);
      statusEl.appendChild(ic);
    }
    var span = document.createElement("span");
    span.textContent = text;
    statusEl.appendChild(span);
    if (withRetry) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn--text";
      b.textContent = "Riprova";
      b.addEventListener("click", submitResult);
      statusEl.appendChild(b);
    }
  }

  function submitResult() {
    if (state.submitted) { setStatus("Il tuo risultato è già in graduatoria.", "ok"); return; }
    if (!navigator.onLine) { setStatus("Sei offline. Invieremo il risultato appena torna la rete.", "", true); return; }
    setStatus("Invio del risultato…");
    mockRequest().then(function () {
      state.submitted = true;
      saveState();
      setStatus("Risultato inviato.", "ok");
    }).catch(function () {
      setStatus("Non siamo riusciti a inviare il risultato.", "", true);
    });
  }

  /* ---------------- Dati di prova ---------------- */

  // Risposte in ordine di round: E = esiste, N = non esiste
  var MOCK_PLAYERS = [
    ["Bianca", "NENEENEE"], ["Mattia", "NENNENEE"], ["Nadia", "NEEEENEE"],
    ["Eleonora", "EENENNEE"], ["Gianfilippo", "NNNEEEEE"], ["Chiara", "EENNENEE"],
    ["Davide", "NEENEEEN"], ["Sara", "ENNEENNE"], ["Luca", "EEENENEE"],
    ["Giulia", "NNEENEEE"], ["Marco", "ENENEEEE"]
  ].map(function (p) {
    var answers = p[1].split("").map(function (c) { return c === "E"; });
    return { nickname: p[0], answers: answers, score: scoreOf(answers) };
  });

  function mockRequest() {
    return new Promise(function (resolve, reject) {
      if (MOCK_STATE === "loading") return; // resta in caricamento
      setTimeout(function () {
        if (mockErrorsLeft > 0) { mockErrorsLeft--; reject(new Error("mock")); return; }
        resolve();
      }, 700);
    });
  }

  function fetchRows() {
    // In fase 5 diventa la lettura della sessione corrente da Supabase.
    return mockRequest().then(function () {
      if (MOCK_STATE === "empty") return [];
      var rows = MOCK_PLAYERS.slice();
      if (state.firstResult && state.nickname) {
        rows.push({ nickname: state.nickname, answers: state.firstResult.answers, score: state.firstResult.score, isMe: true });
      }
      return rows;
    });
  }

  /* ---------------- Graduatoria ---------------- */

  var pollTimer = null;
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderPlaceholders(container, n) {
    container.textContent = "";
    for (var i = 0; i < n; i++) container.appendChild(el("div", "placeholder-row"));
    var p = el("p", "t-body muted", container.hasAttribute("data-board") ? "Carico la graduatoria…" : "Carico le statistiche…");
    p.style.paddingTop = "16px";
    container.appendChild(p);
  }

  function renderMessage(container, text, retry) {
    container.textContent = "";
    var box = el("div", "message");
    box.appendChild(el("p", "t-body muted", text));
    if (retry) {
      var b = el("button", "btn btn--text", "Riprova");
      b.type = "button";
      b.addEventListener("click", retry);
      box.appendChild(b);
    }
    container.appendChild(box);
  }

  function renderBoard(rows) {
    var board = $("[data-board]");
    board.textContent = "";
    if (!rows.length) {
      renderMessage(board, "Sei tra i primi a finire. La graduatoria si riempie man mano.");
      return;
    }
    var byScore = {};
    rows.forEach(function (r) { (byScore[r.score] = byScore[r.score] || []).push(r); });
    Object.keys(byScore).map(Number).sort(function (a, b) { return b - a; }).forEach(function (score) {
      var band = el("section", "band");
      var headingId = "band-" + score;
      var h = el("h2", "t-band band__score", score + "/" + TOTAL);
      h.id = headingId;
      band.appendChild(h);
      var ul = el("ul", "band__names t-body");
      ul.setAttribute("aria-labelledby", headingId);
      byScore[score].sort(function (a, b) {
        return a.nickname.localeCompare(b.nickname, "it", { sensitivity: "base" });
      }).forEach(function (r) {
        var li = el("li", r.isMe ? "is-me" : "", r.nickname);
        if (r.isMe) li.appendChild(el("span", "me-tag", " (tu)"));
        ul.appendChild(li);
      });
      band.appendChild(ul);
      board.appendChild(band);
    });
  }

  function loadBoard(silent) {
    var board = $("[data-board]");
    if (!silent) { renderPlaceholders(board, 3); board.setAttribute("aria-busy", "true"); }
    return fetchRows().then(function (rows) {
      board.setAttribute("aria-busy", "false");
      renderBoard(rows);
    }).catch(function () {
      board.setAttribute("aria-busy", "false");
      if (silent) return; // un aggiornamento automatico fallito non cancella la graduatoria visibile
      var mine = state.firstResult ? " Il tuo risultato (" + state.firstResult.score + "/" + TOTAL + ") è salvato su questo telefono." : "";
      renderMessage(board, "La graduatoria non è momentaneamente disponibile." + mine, function () { loadBoard(false); });
    });
  }

  function showBoard() {
    show("graduatoria");
    loadBoard(false);
    pollTimer = setInterval(function () { if (state.screen === "graduatoria") loadBoard(true); }, POLL_MS);
  }

  /* ---------------- Statistiche ---------------- */

  function pct(n, d) { return d ? Math.round(n / d * 100) : 0; }

  function bar(label, value, valueText, max) {
    var wrap = el("div", "bar");
    var lab = el("div", "bar__label");
    lab.appendChild(el("span", "", label));
    lab.appendChild(el("span", "", valueText));
    wrap.appendChild(lab);
    var track = el("div", "bar__track");
    track.setAttribute("aria-hidden", "true");
    var fill = el("span", "bar__fill");
    fill.style.width = (max ? value / max * 100 : 0) + "%";
    track.appendChild(fill);
    wrap.appendChild(track);
    return wrap;
  }

  function listNames(items) {
    var names = items.map(function (x) { return x.r.brand; });
    if (names.length <= 1) return names[0] || "";
    return names.slice(0, -1).join(", ") + " e " + names[names.length - 1];
  }

  function renderStats(rows) {
    var box = $("[data-stats]");
    box.textContent = "";
    var n = rows.length;
    if (!n) { renderMessage(box, "Le statistiche arrivano appena qualcuno finisce."); return; }

    // Totale
    var total = el("div", "stats__total");
    total.appendChild(el("span", "t-band", String(n)));
    total.appendChild(el("span", "t-body muted", n === 1 ? "partecipante" : "partecipanti"));
    box.appendChild(total);
    if (n < 3) box.appendChild(el("p", "t-small muted", "Per ora siete in pochi: i numeri cambieranno."));

    // Per prodotto
    var perRound = ROUNDS.map(function (r, i) {
      var correct = 0, saidExists = 0;
      rows.forEach(function (row) {
        if (row.answers[i] === r.exists) correct++;
        if (row.answers[i] === true) saidExists++;
      });
      return { r: r, correct: pct(correct, n), saidExists: pct(saidExists, n) };
    });

    // Fake più convincente
    var fakes = perRound.filter(function (x) { return !x.r.exists; });
    var topFake = Math.max.apply(null, fakes.map(function (x) { return x.saidExists; }));
    if (topFake > 0) {
      var who = fakes.filter(function (x) { return x.saidExists === topFake; });
      var verb = who.length > 1 ? "hanno convinto" : "ha convinto";
      box.appendChild(el("p", "t-quote", listNames(who) + " " + verb + " il " + topFake + "% del gruppo."));
    }

    // Più facile e più difficile
    var hi = Math.max.apply(null, perRound.map(function (x) { return x.correct; }));
    var lo = Math.min.apply(null, perRound.map(function (x) { return x.correct; }));
    var pair = el("div", "stats__pair");
    var easy = el("p");
    easy.appendChild(el("span", "t-meta accent", "Il più facile"));
    easy.appendChild(el("span", "t-body", listNames(perRound.filter(function (x) { return x.correct === hi; })) + " · " + hi + "%"));
    var hard = el("p");
    hard.appendChild(el("span", "t-meta accent", "Il più difficile"));
    hard.appendChild(el("span", "t-body", listNames(perRound.filter(function (x) { return x.correct === lo; })) + " · " + lo + "%"));
    pair.appendChild(easy);
    pair.appendChild(hard);
    box.appendChild(pair);

    // Distribuzione punteggi
    var dist = el("div", "stats__group");
    dist.appendChild(el("h2", "t-meta accent", "Punteggi"));
    var counts = [];
    for (var s = TOTAL; s >= 0; s--) counts.push({ s: s, c: rows.filter(function (r) { return r.score === s; }).length });
    var maxC = Math.max.apply(null, counts.map(function (x) { return x.c; }));
    counts.forEach(function (x) {
      dist.appendChild(bar(x.s + "/" + TOTAL, x.c, x.c === 1 ? "1 persona" : x.c + " persone", maxC));
    });
    box.appendChild(dist);

    // Prodotto per prodotto
    var per = el("div", "stats__group");
    per.appendChild(el("h2", "t-meta accent", "Risposte corrette, prodotto per prodotto"));
    perRound.forEach(function (x) { per.appendChild(bar(x.r.brand, x.correct, x.correct + "%", 100)); });
    box.appendChild(per);
  }

  function loadStats() {
    var box = $("[data-stats]");
    renderPlaceholders(box, 4);
    box.setAttribute("aria-busy", "true");
    fetchRows().then(function (rows) {
      box.setAttribute("aria-busy", "false");
      renderStats(rows);
    }).catch(function () {
      box.setAttribute("aria-busy", "false");
      renderMessage(box, "Le statistiche non sono momentaneamente disponibili.", loadStats);
    });
  }

  /* ---------------- Splash: inizia, riprendi o ricomincia ---------------- */

  function inProgress() {
    var n = state.answers.filter(function (a) { return a !== undefined && a !== null; }).length;
    return n > 0 && n < TOTAL;
  }

  function renderSplash() {
    var label = $("[data-start-label]");
    var second = $("[data-action='splash-secondary']");
    if (inProgress()) {
      label.textContent = "Riprendi dal round " + (state.round + 1);
      second.textContent = "Ricomincia da capo";
      second.setAttribute("data-mode", "restart");
      second.hidden = false;
    } else if (state.firstResult) {
      label.textContent = "Inizia";
      second.textContent = "Vedi la graduatoria";
      second.setAttribute("data-mode", "board");
      second.hidden = false;
    } else {
      label.textContent = "Inizia";
      second.hidden = true;
    }
  }

  function showSplash() {
    renderSplash();
    show("splash");
  }

  // Android: schermo intero al tocco di Inizia (iPhone non lo consente ai siti)
  function goFullscreen() {
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req || document.fullscreenElement || document.webkitFullscreenElement) return;
    if (!window.matchMedia("(pointer: coarse)").matches || PREVIEW) return;
    try {
      var r = req.call(el, { navigationUI: "hide" });
      if (r && r.catch) r.catch(function () {});
    } catch (e) {}
  }

  function onStart() {
    if (inProgress()) {
      var i = state.round;
      goToRound(i, state.answers[i] === undefined ? "question" : "reveal");
      return;
    }
    if (state.firstResult) {
      // Ha già giocato: nuova partita senza nuovo invio in graduatoria.
      state.answers = [];
      state.round = 0;
      state.replay = true;
      state.lastScore = undefined;
      saveState();
      show("istruzioni");
      return;
    }
    if (state.nickname) $("#nickname").value = state.nickname;
    show("nickname");
  }

  function onSplashSecondary(mode) {
    if (mode === "board") { showBoard(); return; }
    // Ricomincia da capo: stesso nickname, risposte azzerate.
    state.answers = [];
    state.round = 0;
    state.lastScore = undefined;
    if (state.firstResult) state.replay = true;
    saveState();
    show("istruzioni");
  }

  /* ---------------- Rigioca ---------------- */

  function replay() {
    state.answers = [];
    state.replay = true;
    state.lastScore = undefined;
    saveState();
    goToRound(0, "question");
  }

  /* ---------------- Offline ---------------- */

  function updateOnline() {
    var banner = $("[data-offline]");
    banner.hidden = navigator.onLine;
    if (navigator.onLine && state.screen === "risultato" && state.firstResult && !state.submitted && !state.replay) submitResult();
  }

  /* ---------------- Eventi ---------------- */

  document.addEventListener("click", function (ev) {
    var answer = ev.target.closest("[data-answer]");
    if (answer) { onAnswer(answer); return; }
    var btn = ev.target.closest("[data-action]");
    if (!btn) return;
    if (btn.getAttribute("aria-disabled") === "true") return;
    var action = btn.getAttribute("data-action");
    if (action === "next") { onNext(); return; }
    if (actionLock) return;
    lockActions();
    switch (action) {
      case "start": goFullscreen(); onStart(); break;
      case "splash-secondary": goFullscreen(); onSplashSecondary(btn.getAttribute("data-mode")); break;
      case "home": showSplash(); break;
      case "play": goToRound(0, "question"); break;
      case "leaderboard": showBoard(); break;
      case "stats": show("statistiche"); loadStats(); break;
      case "back-to-board": showBoard(); break;
      case "replay": replay(); break;
    }
  });

  $("[data-form='nickname']").addEventListener("submit", onNicknameSubmit);
  $("#nickname").addEventListener("input", function () {
    if (!nicknameTouched) return;
    setNicknameError(validateNickname(normalizeNickname(this.value)));
  });
  $("#nickname").addEventListener("blur", function () { setTimeout(applyMode, 300); });

  window.addEventListener("resize", function () { applyMode(); fitMedia(); });
  window.addEventListener("orientationchange", function () { setTimeout(applyMode, 200); });
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);

  /* ---------------- Avvio ---------------- */

  function start() {
    if (PREVIEW) document.documentElement.setAttribute("data-preview", "");
    applyMode();
    fillDesktopUrl();
    $$("[data-mock-badge]").forEach(function (b) { b.hidden = !CONFIG.useMockData; });
    updateOnline();

    var nav = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0]) || {};
    var isReload = nav.type === "reload" || (performance.navigation && performance.navigation.type === 1);
    if (!isReload) { showSplash(); return; } // aprire il link o il QR riparte sempre dalla splash

    var s = state.screen;
    if (state.firstResult && !state.replay && (s === "splash" || s === "nickname" || s === "istruzioni" || s === "round")) s = "risultato";

    switch (s) {
      case "nickname":
        $("#nickname").value = state.nickname || "";
        show("nickname");
        break;
      case "istruzioni": show("istruzioni"); break;
      case "round":
        var phase = state.answers[state.round] === undefined ? "question" : "reveal";
        goToRound(Math.min(state.round, TOTAL - 1), phase);
        break;
      case "risultato": showResult(); break;
      case "graduatoria": showBoard(); break;
      case "statistiche": show("statistiche"); loadStats(); break;
      default: showSplash();
    }
  }

  start();
})();
