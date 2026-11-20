/* Wspólny kod teleturnieju Milion (ekran TV / solo i telefon gracza): drabinka, losowanie pytań, symulowana publiczność,
   połączenie z serwerem PL3Y (albo lokalnym SharedWorkerem w trybie ?local=1), ranking i dźwięk (WebAudio, bez plików). */
(function () {
  const LADDER = [500, 1000, 2000, 5000, 10000, 20000, 40000, 75000, 125000, 250000, 500000, 1000000];
  const SAFE = [1, 6];                       // indeksy progów gwarantowanych: 1 000 i 40 000 zł
  const TIMES = [15, 30, 45, 60, 0];         // 0 = bez limitu (tylko solo)
  const API = 'https://pl3y-server.pl3y.workers.dev';
  const BASE_URL = 'https://pl3y.pl/milion/';
  const LOCAL = new URLSearchParams(location.search).has('local');
  const APP = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const zl = n => fmt(n) + ' zł';
  const LET = ['A', 'B', 'C', 'D'];
  const rand = n => Math.floor(Math.random() * n);
  function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // Gwarantowana kwota po `passed` poprawnych odpowiedziach.
  function guaranteed(passed) { let g = 0; for (const i of SAFE) if (passed > i) g = LADDER[i]; return g; }

  // Pytanie z przetasowanymi odpowiedziami.
  function mix(q) {
    const order = shuffle([0, 1, 2, 3]);
    return { id: q.id, q: q.q, a: order.map(i => q.a[i]), ok: order.indexOf(q.ok) };
  }

  // Losuje `n` różnych pytań poziomu, unikając już użytych (pamięć w localStorage), a gdy brakuje — powtarza.
  function used() { try { return new Set(JSON.parse(localStorage.getItem('milion_used') || '[]')); } catch (e) { return new Set(); } }
  function markUsed(ids) {
    try { const u = [...used(), ...ids]; localStorage.setItem('milion_used', JSON.stringify(u.slice(-2000))); } catch (e) {}
  }
  function pickLevel(lvl, n, avoid) {
    const all = (window.ML_QUESTIONS || []).filter(q => q.lvl === lvl + 1);
    if (!all.length) throw new Error('Brak pytań na poziom ' + (lvl + 1));
    const u = used();
    const fresh = shuffle(all.filter(q => !u.has(q.id) && !avoid.has(q.id)));
    const unseen = shuffle(all.filter(q => !avoid.has(q.id) && u.has(q.id)));
    const rest = shuffle(all);
    const out = [];
    for (const q of [...fresh, ...unseen, ...rest]) { if (out.length >= n) break; if (!out.includes(q) || all.length < n) out.push(q); }
    while (out.length < n) out.push(all[rand(all.length)]);
    out.forEach(q => avoid.add(q.id));
    return out;
  }
  // Zestaw na jedną grę/rundę: 12 × { m: główne, s: zapasowe do zamiany }.
  function pickSet(avoid = new Set()) {
    const set = LADDER.map((_, l) => { const [m, s] = pickLevel(l, 2, avoid); return { m: mix(m), s: mix(s) }; });
    markUsed(set.map(x => x.m.id));
    return set;
  }
  const pickPool = () => { const avoid = new Set(); return [0, 1, 2].map(() => pickSet(avoid)); };

  // Symulowana publiczność (ta sama zasada co na serwerze): poprawna dostaje wagę zależną od poziomu, czasem tłum się myli.
  function audienceSim(ok, qi, removed = []) {
    const r = Math.random;
    const opts = [0, 1, 2, 3].filter(i => !removed.includes(i));
    const band = qi < 4 ? [60, 85] : qi < 8 ? [40, 65] : [25, 50];
    let lead = ok;
    if (r() < 0.1) { const wrong = opts.filter(i => i !== ok); lead = wrong[rand(wrong.length)]; }
    const pct = [0, 0, 0, 0];
    pct[lead] = Math.round(band[0] + r() * (band[1] - band[0]));
    const rest = opts.filter(i => i !== lead);
    const w = rest.map(() => 0.2 + r());
    if (lead !== ok) w[rest.indexOf(ok)] += 0.8;
    const sum = w.reduce((a, b) => a + b, 0);
    let left = 100 - pct[lead];
    rest.forEach((i, k) => { const v = k === rest.length - 1 ? left : Math.round((100 - pct[lead]) * w[k] / sum); pct[i] = Math.max(0, Math.min(v, left)); left -= pct[i]; });
    return pct;
  }

  // ---------- połączenie ----------
  // Tryb lokalny: dev/local.js (SharedWorker) uruchamia tę samą klasę MlRoom co serwer. Gniazdo udaje WebSocket.
  let port = null, cidSeq = 0, ridSeq = 0;
  const socks = new Map(), waits = new Map();
  function localPort() {
    if (port) return port;
    const w = new SharedWorker(new URL('dev/local.js', location.href.replace(/[^/]*$/, '')), { type: 'module', name: 'milion-dev' });
    port = w.port;
    port.onmessage = ({ data: m }) => {
      if (m.rid && waits.has(m.rid)) { const f = waits.get(m.rid); waits.delete(m.rid); return f(m); }
      const s = socks.get(m.cid); if (!s) return;
      if (m.t === 'open') { s.readyState = 1; s.onopen && s.onopen(); }
      else if (m.t === 'msg') s.onmessage && s.onmessage({ data: m.data });
      else if (m.t === 'close') { s.readyState = 3; socks.delete(m.cid); s.onclose && s.onclose({ code: m.code }); }
    };
    port.start();
    setInterval(() => { for (const [cid, s] of socks) if (s.readyState === 1) port.postMessage({ t: 'send', cid, data: '{"t":"ping"}' }); }, 4000);
    return port;
  }
  class LocalSocket {
    constructor(code) { this.cid = ++cidSeq; this.readyState = 0; socks.set(this.cid, this); localPort().postMessage({ t: 'connect', cid: this.cid, code }); }
    send(d) { port.postMessage({ t: 'send', cid: this.cid, data: d }); }
    close() { if (this.readyState > 1) return; this.readyState = 3; socks.delete(this.cid); port.postMessage({ t: 'close', cid: this.cid }); }
  }
  function localCall(t, body) { return new Promise(res => { const rid = ++ridSeq; waits.set(rid, res); localPort().postMessage({ t, rid, body }); }); }

  class Conn {
    // opts: { code, hello: () => object, onMessage(msg), onStatus(status) }
    constructor(opts) {
      this.o = opts; this.ws = null; this.status = ''; this.retry = 0; this.lastMsg = 0; this.stopped = false;
      this.connect();
      this.beat = setInterval(() => this.heartbeat(), 15000);
      addEventListener('online', () => this.kick());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.kick(); });
    }
    setStatus(s) { if (this.status !== s) { this.status = s; this.o.onStatus && this.o.onStatus(s); } }
    connect() {
      if (this.stopped) return;
      this.setStatus(this.retry ? 'reconnecting' : 'connecting');
      let ws;
      try { ws = LOCAL ? new LocalSocket(this.o.code) : new WebSocket(API.replace(/^http/, 'ws') + '/api/ml/rooms/' + encodeURIComponent(this.o.code) + '/ws'); }
      catch (e) { return this.later(); }
      this.ws = ws;
      ws.onopen = () => { this.retry = 0; this.lastMsg = Date.now(); this.raw(this.o.hello()); };
      ws.onmessage = e => {
        this.lastMsg = Date.now();
        let m; try { m = JSON.parse(e.data); } catch (_) { return; }
        if (m.t === 'pong') return;
        if (m.t === 'welcome' || m.t === 'state') this.setStatus('online');
        if (m.t === 'error' && m.code === 'noroom') this.stop('noroom');
        this.o.onMessage(m);
      };
      ws.onclose = e => {
        if (this.ws !== ws) return;
        this.ws = null;
        if (e && e.code === 4404) return this.stop('noroom');
        if (e && e.code === 4401) return this.stop('revoked');
        this.later();
      };
      ws.onerror = () => {};
    }
    later() {
      if (this.stopped) return;
      this.setStatus('reconnecting');
      const delay = Math.min(8000, 400 * 2 ** this.retry++) * (0.75 + Math.random() * 0.5);
      clearTimeout(this.rt); this.rt = setTimeout(() => this.connect(), delay);
    }
    kick() {
      if (this.stopped) return;
      if (!this.ws || this.ws.readyState > 1) { clearTimeout(this.rt); this.retry = 0; this.connect(); }
      else this.heartbeat();
    }
    heartbeat() {
      if (!this.ws || this.ws.readyState !== 1) return;
      if (Date.now() - this.lastMsg > 40000) { const w = this.ws; try { w.close(); } catch (e) {} if (w.onclose) w.onclose({ code: 1006 }); return; }
      this.raw({ t: 'ping' });
    }
    raw(obj) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(obj)); return true; } return false; }
    send(obj) { return this.raw(obj); }
    stop(reason) {
      this.stopped = true; clearTimeout(this.rt); clearInterval(this.beat);
      this.setStatus(reason || 'closed');
      if (this.ws) { const w = this.ws; this.ws = null; try { w.close(); } catch (e) {} }
    }
  }

  async function api(method, path, body) {
    if (LOCAL) {
      const m = await localCall('api', { method, path, body });
      if (m.status >= 300) throw new Error('HTTP ' + m.status);
      return m.json;
    }
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(API + path, { method, signal: ctl.signal, headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  // Link dla telefonu gracza. Lokalnie: bieżący adres + ?local=1 (inaczej telefon łączyłby się z prawdziwym serwerem).
  function joinUrl(code) {
    const base = LOCAL || /^(localhost|127\.)/.test(location.hostname) ? location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '') : BASE_URL;
    return base + 'play.html' + (LOCAL ? '?local=1' : '') + '#' + code;
  }
  function qrSvg(text) {
    try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (e) { return ''; }
  }

  const nick = {
    get() { try { return localStorage.getItem('milion_nick') || ''; } catch (e) { return ''; } },
    set(v) { try { localStorage.setItem('milion_nick', String(v || '').trim().slice(0, 16)); } catch (e) {} },
  };

  // ---------- dźwięk ----------
  const Snd = (() => {
    let ctx = null, master = null, mus = null, fx = null, delay = null, nbuf = null, timer = null;
    const st = { m: true, s: true, mv: .45, sv: .85 };
    try { Object.assign(st, JSON.parse(localStorage.getItem('milion_snd') || '{}')); } catch (e) {}
    let heat = 0, hushed = false, step = 0, nextT = 0, wantMusic = false;
    const save = () => { try { localStorage.setItem('milion_snd', JSON.stringify(st)); } catch (e) {} };
    const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

    function init() {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      try { ctx = new AC(); } catch (e) { return false; }
      const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
      master = ctx.createGain(); master.gain.value = .9; master.connect(comp);
      mus = ctx.createGain(); mus.gain.value = 0; mus.connect(master);
      fx = ctx.createGain(); fx.gain.value = st.sv * .9; fx.connect(master);
      delay = ctx.createDelay(1); delay.delayTime.value = .3;
      const fb = ctx.createGain(); fb.gain.value = .3;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const wet = ctx.createGain(); wet.gain.value = .35;
      delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(master);
      nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    }
    function tone(f, t0, dur, type, vol, f2, dst, send) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + .015); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(g); g.connect(dst || fx); if (send) g.connect(delay);
      o.start(t0); o.stop(t0 + dur + .05);
    }
    function noise(t0, dur, type, f0, f1, vol, dst, q, att) {
      const s = ctx.createBufferSource(); s.buffer = nbuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t0); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur); f.Q.value = q || 1;
      const g = ctx.createGain(); const a = att || Math.min(.02, dur / 3);
      g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + a); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(dst || fx); s.start(t0, Math.random()); s.stop(t0 + dur + .05);
    }
    function pad(notes, t, dur, cut, vol) {
      for (const n of notes) for (const det of [-7, 7]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = cut; f.Q.value = 2;
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * .3); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(mus); o.start(t); o.stop(t + dur + .05);
      }
    }
    // Muzyka studia: c-moll, pulsujący bas, tykanie i plama akordów. `heat` (0..1) rośnie z poziomem pytania.
    const CH = [[48, 55, 60, 63], [44, 51, 56, 60], [46, 53, 58, 62], [43, 50, 55, 59]];   // Cm, Ab, Bb, G
    const BASS = [36, 32, 34, 31];
    function playStep(n, t, six) {
      const bar = n >> 4, s = n & 15, ch = CH[bar & 3];
      if (s === 0) pad(ch, t, six * 16, 700 + heat * 1500, .022 + heat * .01);
      if ((s & 1) === 0) {                                  // bas ósemkami
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(BASS[bar & 3] + ((s & 4) ? 12 : 0)); f.type = 'lowpass'; f.frequency.value = 260 + heat * 500;
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + six * 1.7);
        o.connect(f); f.connect(g); g.connect(mus); o.start(t); o.stop(t + six * 2);
      }
      if (s === 0 || s === 8 || (heat > .5 && (s === 4 || s === 12))) tone(110, t, .2, 'sine', .3, 40, mus);   // stopa
      if (s % 2 === 1 || heat > .3) noise(t, .04, 'highpass', 8000, null, s % 4 === 2 ? .04 : .018, mus);     // tykanie
      if (heat > .65 && s === 15) noise(t, .2, 'highpass', 2000, 9000, .06, mus);
      if (s === 6 && Math.random() < .5) tone(mtof(ch[3] + 12), t, six * 5, 'triangle', .03, null, mus, true);  // dzwoneczek
    }
    function tick() {
      if (!ctx) return;
      const six = 60 / (92 + heat * 40) / 4;
      if (nextT < ctx.currentTime) nextT = ctx.currentTime + .05;
      while (nextT < ctx.currentTime + .3) { playStep(step, nextT, six); nextT += six; step = (step + 1) & 63; }
    }
    function level() { if (!ctx) return; mus.gain.setTargetAtTime((hushed || !st.m || !wantMusic) ? 0 : st.mv * .8, ctx.currentTime, .25); }
    function startMusic() {
      if (!st.m || !wantMusic || !init()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (!timer) { nextT = ctx.currentTime + .1; step = 0; timer = setInterval(tick, 60); }
      level();
    }
    function stopMusic() { level(); if (timer) { const t = timer; timer = null; setTimeout(() => clearInterval(t), 600); } }

    const SFX = {
      tap(t) { tone(880, t, .08, 'triangle', .15); },
      lock(t) { tone(196, t, .5, 'sawtooth', .08, 392); noise(t, .6, 'bandpass', 400, 2400, .1, fx, 2, .5); },
      good(t) { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { tone(f, t + i * .06, .5, 'triangle', .2, null, fx, true); tone(f * 2, t + i * .06, .2, 'sine', .05); }); },
      bad(t) { tone(233, t, .6, 'sawtooth', .16, 110); tone(220, t, .6, 'square', .07, 104); noise(t, .4, 'lowpass', 900, 200, .2); },
      life(t) { [0, .08, .16].forEach((d, i) => tone(1046.5 * (1 + i * .25), t + d, .3, 'sine', .14, null, fx, true)); noise(t, .5, 'highpass', 3000, 9000, .08); },
      tick(t) { tone(1400, t, .05, 'square', .06); },
      join(t) { tone(660, t, .12, 'triangle', .16); tone(990, t + .09, .2, 'triangle', .16); },
      start(t) { noise(t, 1, 'highpass', 600, 8000, .25, fx, .7, .9); tone(65, t + .95, 1.6, 'sine', .7, 30); [48, 55, 60, 63, 67].forEach(n => tone(mtof(n + 12), t + .95, 1.8, 'sawtooth', .04, null, fx, true)); },
      win(t) {
        const L = [[523.25, 0], [659.25, .14], [783.99, .28], [1046.5, .42]];
        L.forEach(([f, d]) => { tone(f, t + d, .5, 'sawtooth', .09); tone(f * 2, t + d, .3, 'triangle', .05); });
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(f => tone(f, t + .6, 2.4, 'triangle', .09, null, fx, true));
        for (let i = 0; i < 12; i++) noise(t + .6 + i * .12, .08, 'highpass', 6000, null, .05);
      },
    };

    return {
      st,
      unlock() { if (!init()) return; if (ctx.state === 'suspended') ctx.resume(); if (wantMusic) startMusic(); },
      play(n) { if (!st.s || !init()) return; if (ctx.state === 'suspended') ctx.resume(); SFX[n] && SFX[n](ctx.currentTime + .01); },
      music(on) { wantMusic = !!on; if (on) startMusic(); else stopMusic(); },
      setMusic(on) { st.m = !!on; save(); if (on) startMusic(); else stopMusic(); },
      setSfx(on) { st.s = !!on; save(); },
      setVol(k, v) { st[k === 'm' ? 'mv' : 'sv'] = v; save(); if (ctx) { if (k === 'm') level(); else fx.gain.setTargetAtTime(v * .9, ctx.currentTime, .05); } },
      heat(qi) { heat = Math.max(0, Math.min(1, qi / 11)); },
      hush(on) { hushed = !!on; level(); },
    };
  })();

  window.ML = { LADDER, SAFE, TIMES, API, BASE_URL, LOCAL, APP, LET, esc, fmt, zl, shuffle, guaranteed, mix, pickSet, pickPool, audienceSim,
    Conn, api, createRoom: () => api('POST', '/api/ml/rooms'), scores: () => api('GET', '/api/ml/scores'),
    postSolo: e => api('POST', '/api/ml/scores', e), joinUrl, qrSvg, nick, Snd };
})();
