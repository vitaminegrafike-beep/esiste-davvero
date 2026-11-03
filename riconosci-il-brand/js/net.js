/*
 * Zoom Race: stato condiviso tra regia (desktop) e telefoni.
 *
 * Due modalità con la stessa interfaccia (window.ZRNet):
 *  - "supabase": il database è la fonte di verità (vedi supabase/schema.sql).
 *  - "local" (modalità prova): la scheda della regia fa da server e parla con le schede
 *    dei telefoni aperte nello stesso browser (BroadcastChannel). Stesse regole del database.
 *
 * Fasi della partita: lobby → countdown → round → reveal → … → final → podium (→ closed).
 * Tutti gli orari sono in millisecondi del server; ZRNet.now() è l'ora del server vista dal client.
 */
(function () {
  "use strict";

  var CFG = window.ZR_CONFIG || {};
  var params = new URLSearchParams(location.search);
  var MODE = CFG.supabaseUrl && CFG.supabaseKey && !params.has("prova") ? "supabase" : "local";
  var ROUND_MS = window.ZR_ROUND_MS || 9000;
  var MAX_PLAYERS = 16;
  var KNOWN = ["taken", "full", "not_open", "name", "avatar", "auth", "closed", "state", "correct", "choice", "offline"];

  function fail(code) { var e = new Error(code); e.code = code; return e; }
  function codeOf(e) {
    if (!e) return "error";
    if (e.code && KNOWN.indexOf(e.code) >= 0) return e.code;
    var m = String(e.message || e);
    for (var i = 0; i < KNOWN.length; i++) if (m.indexOf(KNOWN[i]) >= 0) return KNOWN[i];
    return "error";
  }
  function num(v) { return v === null || v === undefined ? null : Number(v); }
  function normGame(g) {
    if (!g) return null;
    return { id: g.id, state: g.state, round: num(g.round), phase_ms: num(g.phase_ms), ends_ms: num(g.ends_ms),
             round_ms: num(g.round_ms) || ROUND_MS, created_ms: num(g.created_ms) };
  }
  function normPlayer(p) {
    return { id: p.id, nickname: p.nickname, avatar: num(p.avatar), total_score: num(p.total_score) || 0,
             last_score: num(p.last_score) || 0, total_ms: num(p.total_ms) || 0, correct_count: num(p.correct_count) || 0,
             answered_round: num(p.answered_round) || 0, joined_ms: num(p.joined_ms) || 0 };
  }
  /* Classifica: punti, poi tempo totale delle risposte esatte (minore è meglio), poi ordine di ingresso */
  function rank(players) {
    return players.slice().sort(function (a, b) {
      return b.total_score - a.total_score || a.total_ms - b.total_ms || a.joined_ms - b.joined_ms;
    });
  }
  function score(ms, correct, roundMs) {
    if (!correct) return 0;
    var t = Math.max(0, Math.min(roundMs, ms));
    return Math.round(100 - (t / roundMs) * 70);
  }

  /* Dati salvati sul dispositivo (per rientrare dopo una ricarica) */
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem("zr-" + MODE + "-" + key) || "null");
      if (val === null) localStorage.removeItem("zr-" + MODE + "-" + key);
      else localStorage.setItem("zr-" + MODE + "-" + key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  var api = {
    mode: MODE, rank: rank, codeOf: codeOf, score: score, store: store,
    offset: 0,
    now: function () { return Date.now() + api.offset; }
  };

  /* ===================================================================
     Supabase
     =================================================================== */
  if (MODE === "supabase") {
    var sb = null, hostToken = null;

    function rpc(name, args) {
      return sb.rpc(name, args).then(function (r) { if (r.error) throw fail(codeOf(r.error)); return r.data; });
    }
    function loadLib() {
      if (window.supabase) return Promise.resolve();
      return new Promise(function (res, rej) {
        var s = document.createElement("script");
        s.src = "js/vendor/supabase-2.45.4.js";
        s.onload = res; s.onerror = function () { rej(fail("offline")); };
        document.head.appendChild(s);
      });
    }
    /* Allinea l'orologio: tre misure, tiene quella con il viaggio più breve */
    function syncClock() {
      var best = null, n = 0;
      function once() {
        var t0 = Date.now();
        return rpc("zr_now", {}).then(function (srv) {
          var t1 = Date.now(), rtt = t1 - t0;
          if (!best || rtt < best.rtt) best = { rtt: rtt, off: Number(srv) - (t0 + t1) / 2 };
          if (++n < 3) return once();
          api.offset = Math.round(best.off);
        });
      }
      return once().catch(function () {});
    }

    api.ready = function () {
      return loadLib().then(function () {
        sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: false } });
        document.addEventListener("visibilitychange", function () { if (!document.hidden) syncClock(); });
        return syncClock();
      });
    };

    /* --- regia --- */
    api.createGame = function () {
      return rpc("zr_create_game", {}).then(function (d) {
        hostToken = d.host_token;
        store("host", { gameId: d.game_id, token: d.host_token });
        return d.game_id;
      });
    };
    api.resumeHost = function () {
      var h = store("host");
      if (!h) return Promise.resolve(null);
      return api.getGame(h.gameId).then(function (g) {
        if (!g || g.state === "closed") return null;
        hostToken = h.token; return g;
      });
    };
    api.host = function (gameId, state, round, correct) {
      return rpc("zr_host", { p_game: gameId, p_token: hostToken, p_state: state, p_round: round,
                              p_correct: correct === undefined ? null : correct }).then(normGame);
    };

    /* --- telefoni --- */
    api.openGame = function () {
      return sb.from("zr_games").select("*").neq("state", "closed").order("created_ms", { ascending: false }).limit(1)
        .then(function (r) { if (r.error) throw fail("offline"); return normGame(r.data[0]); });
    };
    api.getGame = function (id) {
      return sb.from("zr_games").select("*").eq("id", id).maybeSingle()
        .then(function (r) { if (r.error) throw fail("offline"); return normGame(r.data); });
    };
    api.join = function (gameId, nickname, avatar) {
      return rpc("zr_join", { p_game: gameId, p_nickname: nickname, p_avatar: avatar })
        .then(function (d) { return { playerId: d.player_id, secret: d.secret }; });
    };
    api.answer = function (playerId, secret, round, choice) {
      return rpc("zr_answer", { p_player: playerId, p_secret: secret, p_round: round, p_choice: choice });
    };

    /* --- stato in tempo reale, con controllo di riserva ogni 3 s --- */
    api.watch = function (gameId, cb) {
      var snap = { game: null, players: {} }, dead = false;
      function emit() {
        if (dead) return;
        cb({ game: snap.game, players: Object.keys(snap.players).map(function (k) { return snap.players[k]; }) });
      }
      function setGame(g) {
        g = normGame(g);
        if (!g) return;
        if (snap.game && g.phase_ms < snap.game.phase_ms) return;   // risposta vecchia: la ignoro
        snap.game = g;
      }
      function setPlayer(p) {
        p = normPlayer(p);
        var cur = snap.players[p.id];
        if (cur && (cur.total_score > p.total_score || cur.answered_round > p.answered_round)) return;
        snap.players[p.id] = p;
      }
      function refresh() {
        return Promise.all([
          sb.from("zr_games").select("*").eq("id", gameId).maybeSingle(),
          sb.from("zr_players").select("*").eq("game_id", gameId)
        ]).then(function (r) {
          if (r[0].data) setGame(r[0].data);
          if (r[1].data) {
            var seen = {};
            r[1].data.forEach(function (p) { seen[p.id] = 1; setPlayer(p); });
            Object.keys(snap.players).forEach(function (k) { if (!seen[k]) delete snap.players[k]; });
          }
          emit();
        }).catch(function () {});
      }
      var ch = sb.channel("zr-" + gameId + "-" + Math.random().toString(36).slice(2))
        .on("postgres_changes", { event: "*", schema: "public", table: "zr_games", filter: "id=eq." + gameId },
            function (m) { if (m.new && m.new.id) { setGame(m.new); emit(); } })
        .on("postgres_changes", { event: "*", schema: "public", table: "zr_players", filter: "game_id=eq." + gameId },
            function (m) {
              if (m.eventType === "DELETE") { if (m.old && m.old.id) delete snap.players[m.old.id]; }
              else if (m.new && m.new.id) setPlayer(m.new);
              emit();
            })
        .subscribe(function (status) { if (status === "SUBSCRIBED") refresh(); });
      refresh();
      var iv = setInterval(refresh, 3000);
      return function () { dead = true; clearInterval(iv); sb.removeChannel(ch); };
    };

    window.ZRNet = api;
    return;
  }

  /* ===================================================================
     Modalità prova: la regia fa da server per le schede dello stesso browser
     =================================================================== */
  var bc = "BroadcastChannel" in window ? new BroadcastChannel("zoom-race-prova") : null;
  var server = null, localWatchers = [];

  function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

  function Server() {
    this.game = null; this.players = []; this.secrets = {}; this.answers = {};
  }
  Server.prototype = {
    snapshot: function () {
      return { game: this.game && JSON.parse(JSON.stringify(this.game)),
               players: this.players.map(function (p) { return JSON.parse(JSON.stringify(p)); }) };
    },
    createGame: function () {
      var t = Date.now();
      this.game = { id: uid(), state: "lobby", round: 0, phase_ms: t, ends_ms: null, round_ms: ROUND_MS, created_ms: t };
      this.players = []; this.secrets = {}; this.answers = {};
      return this.game.id;
    },
    join: function (gameId, nickname, avatar) {
      var nick = String(nickname || "").trim().slice(0, 16), g = this.game;
      if (!nick) throw fail("name");
      if (!(avatar >= 0 && avatar <= 15)) throw fail("avatar");
      if (!g || g.id !== gameId || g.state !== "lobby") throw fail("not_open");
      if (this.players.length >= MAX_PLAYERS) throw fail("full");
      if (this.players.some(function (p) { return p.avatar === avatar; })) throw fail("taken");
      var p = normPlayer({ id: uid(), nickname: nick, avatar: avatar, joined_ms: Date.now() });
      this.players.push(p);
      this.secrets[p.id] = uid();
      return { playerId: p.id, secret: this.secrets[p.id] };
    },
    answer: function (playerId, secret, round, choice) {
      var g = this.game, t = Date.now();
      var p = this.players.filter(function (x) { return x.id === playerId; })[0];
      if (!p || this.secrets[playerId] !== secret) throw fail("auth");
      if (!(choice >= 0 && choice <= 2)) throw fail("choice");
      if (g.state !== "round" || g.round !== round) return { ok: false, reason: "closed" };
      if (t > g.ends_ms + 500) return { ok: false, reason: "late" };
      var key = playerId + ":" + round;
      if (this.answers[key]) return { ok: false, reason: "dup" };
      this.answers[key] = { choice: choice, ms: Math.max(0, Math.min(g.round_ms, t - g.phase_ms - 200)) };
      p.answered_round = round;
      return { ok: true };
    },
    host: function (gameId, state, round, correct) {
      var g = this.game, t = Date.now(), self = this;
      if (!g || g.id !== gameId) throw fail("auth");
      if (g.state === "closed") throw fail("closed");
      if (state === "countdown") {
        this.players.forEach(function (p) { delete self.answers[p.id + ":" + round]; p.answered_round = Math.min(p.answered_round, round - 1); });
        g.state = "countdown"; g.round = round; g.phase_ms = t; g.ends_ms = null;
      } else if (state === "round") {
        g.state = "round"; g.round = round; g.phase_ms = t; g.ends_ms = t + g.round_ms;
      } else if (state === "reveal") {
        if (g.state === "round" && g.round === round) {
          if (!(correct >= 0 && correct <= 2)) throw fail("correct");
          this.players.forEach(function (p) {
            var a = self.answers[p.id + ":" + round], ok = !!a && a.choice === correct;
            var s = ok ? score(a.ms, true, g.round_ms) : 0;
            p.last_score = s; p.total_score += s; p.total_ms += ok ? a.ms : 0; p.correct_count += ok ? 1 : 0;
          });
        }
        g.state = "reveal"; g.phase_ms = t; g.ends_ms = null;
      } else if (["lobby", "final", "podium", "closed"].indexOf(state) >= 0) {
        g.state = state; g.phase_ms = t; g.ends_ms = null;
      } else throw fail("state");
      return JSON.parse(JSON.stringify(g));
    }
  };

  function publish() {
    if (!server) return;
    var snap = server.snapshot();
    localWatchers.forEach(function (w) { w(snap); });
    if (bc) bc.postMessage({ kind: "snap", snap: snap });
  }
  /* La regia risponde alle richieste dei telefoni */
  function serve(method, args) {
    if (method === "snapshot") return server.snapshot();
    var out = server[method].apply(server, args);
    publish();
    return out;
  }
  var pending = {};
  if (bc) bc.onmessage = function (ev) {
    var m = ev.data || {};
    if (m.kind === "req" && server) {
      var res;
      try { res = { kind: "res", id: m.id, result: serve(m.method, m.args) }; }
      catch (e) { res = { kind: "res", id: m.id, error: codeOf(e) }; }
      bc.postMessage(res);
    } else if (m.kind === "res" && pending[m.id]) {
      var p = pending[m.id]; delete pending[m.id];
      if (m.error) p.rej(fail(m.error)); else p.res(m.result);
    } else if (m.kind === "snap" && !server) {
      clientWatchers.forEach(function (w) { w(m.snap); });
    }
  };
  function call(method, args) {
    if (server) {
      try { return Promise.resolve(serve(method, args)); } catch (e) { return Promise.reject(e); }
    }
    if (!bc) return Promise.reject(fail("offline"));
    return new Promise(function (res, rej) {
      var id = uid();
      pending[id] = { res: res, rej: rej };
      bc.postMessage({ kind: "req", id: id, method: method, args: args || [] });
      setTimeout(function () { if (pending[id]) { delete pending[id]; rej(fail("offline")); } }, 1500);
    });
  }
  var clientWatchers = [];

  api.ready = function () { return Promise.resolve(); };
  api.createGame = function () {
    if (server && server.game && server.game.state !== "closed") server.host(server.game.id, "closed");
    server = server || new Server();
    var id = server.createGame();
    publish();
    return Promise.resolve(id);
  };
  api.resumeHost = function () { return Promise.resolve(null); };   // in prova si riparte sempre da zero
  api.host = function (gameId, state, round, correct) { return call("host", [gameId, state, round, correct]).then(normGame); };
  api.openGame = function () {
    return call("snapshot").then(function (s) { return s.game && s.game.state !== "closed" ? normGame(s.game) : null; });
  };
  api.getGame = function (id) {
    return call("snapshot").then(function (s) { return s.game && s.game.id === id ? normGame(s.game) : null; });
  };
  api.join = function (gameId, nickname, avatar) { return call("join", [gameId, nickname, avatar]); };
  api.answer = function (playerId, secret, round, choice) { return call("answer", [playerId, secret, round, choice]); };
  api.watch = function (gameId, cb) {
    var dead = false;
    function onSnap(s) {
      if (dead || !s.game || s.game.id !== gameId) return;
      cb({ game: normGame(s.game), players: s.players.map(normPlayer) });
    }
    var list = server ? localWatchers : clientWatchers;
    list.push(onSnap);
    function refresh() { call("snapshot").then(onSnap).catch(function () {}); }
    refresh();
    var iv = setInterval(refresh, 3000);
    return function () { dead = true; clearInterval(iv); var i = list.indexOf(onSnap); if (i >= 0) list.splice(i, 1); };
  };

  window.ZRNet = api;
})();
