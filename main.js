/* SLOWFRAME — one scroll-driven high-speed shot.
   Everything in the film is a pure function of scroll progress p ∈ [0,1],
   smoothed with a frame-rate independent lerp, so it scrubs both ways. */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ramp = (p, a, b) => clamp((p - a) / (b - a));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  const NS = 'vector-effect="non-scaling-stroke"';

  /* ------------------------------------------------------------------ */
  /*  SVG artwork                                                        */
  /* ------------------------------------------------------------------ */
  const CAN_BODY = "M15,56 C15,44 30,34 31,24 L169,24 C170,34 185,44 185,56 L185,336 C185,350 172,358 170,368 L30,368 C28,358 15,350 15,336 Z";
  const BULLET = "M22,19 L172,19 C228,19 276,30 292,40 C276,50 228,61 172,61 L22,61 Q18,61 18,57 L18,23 Q18,19 22,19 Z";

  const defs = `
  <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="sf-alu" x1="0" x2="1">
        <stop offset="0" stop-color="#666b72"/><stop offset=".06" stop-color="#a4a9b0"/>
        <stop offset=".15" stop-color="#e9ecef"/><stop offset=".21" stop-color="#ffffff"/>
        <stop offset=".29" stop-color="#c6cad0"/><stop offset=".45" stop-color="#979da5"/>
        <stop offset=".6" stop-color="#b8bdc4"/><stop offset=".73" stop-color="#e4e7ea"/>
        <stop offset=".79" stop-color="#f6f7f9"/><stop offset=".9" stop-color="#959aa1"/>
        <stop offset="1" stop-color="#565b62"/>
      </linearGradient>
      <linearGradient id="sf-cyl" x1="0" x2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset=".12" stop-color="#000" stop-opacity="0"/>
        <stop offset=".19" stop-color="#fff" stop-opacity=".38"/><stop offset=".25" stop-color="#fff" stop-opacity="0"/>
        <stop offset=".77" stop-color="#fff" stop-opacity="0"/><stop offset=".82" stop-color="#fff" stop-opacity=".22"/>
        <stop offset=".9" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".5"/>
      </linearGradient>
      <linearGradient id="sf-lid" x1="0" x2="1">
        <stop offset="0" stop-color="#7b8088"/><stop offset=".25" stop-color="#eef0f2"/>
        <stop offset=".55" stop-color="#aab0b7"/><stop offset=".8" stop-color="#dfe2e6"/><stop offset="1" stop-color="#696e75"/>
      </linearGradient>
      <linearGradient id="sf-brass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#4a2f0e"/><stop offset=".14" stop-color="#a8732a"/>
        <stop offset=".3" stop-color="#f3cf86"/><stop offset=".37" stop-color="#fff2cc"/>
        <stop offset=".47" stop-color="#d9a24a"/><stop offset=".7" stop-color="#94621f"/>
        <stop offset=".88" stop-color="#5a3a12"/><stop offset="1" stop-color="#2e1d07"/>
      </linearGradient>
      <linearGradient id="sf-nose" x1="0" x2="1">
        <stop offset=".55" stop-color="#ffd27a" stop-opacity="0"/><stop offset="1" stop-color="#ffe9b8" stop-opacity=".55"/>
      </linearGradient>
      <radialGradient id="sf-drop" cx=".35" cy=".3" r=".7">
        <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".35" stop-color="#fff" stop-opacity=".25"/>
        <stop offset="1" stop-color="#7d838b" stop-opacity=".35"/>
      </radialGradient>
      <filter id="sf-brushF" x="0" y="0" width="200" height="380" filterUnits="userSpaceOnUse">
        <feTurbulence type="fractalNoise" baseFrequency="0.9 0.004" numOctaves="2" seed="7"/>
        <feColorMatrix values="0 0 0 0 .2  0 0 0 0 .22  0 0 0 0 .25  0 0 0 .9 -.25"/>
      </filter>
      <filter id="sf-soft" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="2.2"/></filter>
      <clipPath id="sf-canClip"><path d="${CAN_BODY}"/></clipPath>
      <clipPath id="sf-bulClip"><path d="${BULLET}"/></clipPath>
    </defs>
  </svg>`;

  // condensation beads on the can
  const beads = (() => {
    let s = "", seed = 11;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 22; i++) {
      const x = 26 + r() * 148, y = 70 + r() * 255, rad = 1.2 + r() * 2.6;
      if (y > 170 && y < 232) continue; // keep the label clean
      s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(rad * 0.85).toFixed(2)}" ry="${rad.toFixed(2)}" fill="url(#sf-drop)"/>`;
    }
    return s;
  })();

  const canReal = `
  <svg class="real" viewBox="0 0 200 380" aria-hidden="true">
    <path d="${CAN_BODY}" fill="url(#sf-alu)"/>
    <rect width="200" height="380" filter="url(#sf-brushF)" clip-path="url(#sf-canClip)" opacity=".55"/>
    <g clip-path="url(#sf-canClip)">
      <path d="M15,56 C60,64 140,64 185,56" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.2"/>
      <path d="M17,60 C60,69 140,69 183,60" fill="none" stroke="#000" stroke-opacity=".18"/>
      <path d="M15,336 C60,345 140,345 185,336" fill="none" stroke="#000" stroke-opacity=".22"/>
      <path d="M16,340 C60,349 140,349 184,340" fill="none" stroke="#fff" stroke-opacity=".5"/>
      <!-- viewfinder mark -->
      <g transform="translate(100 112)" fill="none" stroke="#1b1815" stroke-width="1.2">
        <path d="M-15,-9 v-6 h6 M9,-15 h6 v6 M15,9 v6 h-6 M-9,15 h-6 v-6"/>
        <circle r="3.4" fill="#e1352a" stroke="none"/>
      </g>
      <text x="100" y="150" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="300" font-size="6.5" letter-spacing="2.6" fill="#1b1815" opacity=".75">STILL · MOTION · 330 ML</text>
      <text x="100" y="201" text-anchor="middle" font-family="Jost, Futura, sans-serif" font-weight="200" font-size="23" textLength="152" lengthAdjust="spacing" fill="#1b1815">SLOWFRAME</text>
      <rect x="15" y="213" width="170" height="4.5" fill="#e1352a"/>
      <rect x="15" y="221" width="170" height=".7" fill="#1b1815" opacity=".55"/>
      <text x="100" y="244" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="300" font-size="6.2" letter-spacing="2.4" fill="#1b1815" opacity=".7">HIGH-SPEED SPARKLING</text>
      <text x="100" y="300" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="300" font-size="5.5" letter-spacing="1.6" fill="#1b1815" opacity=".5">100,000 FPS · BATCH 0120</text>
      ${beads}
      <rect width="200" height="380" fill="url(#sf-cyl)"/>
    </g>
    <ellipse cx="100" cy="368" rx="70" ry="5" fill="#565b62"/>
    <ellipse cx="100" cy="24" rx="69" ry="7.5" fill="url(#sf-lid)"/>
    <ellipse cx="100" cy="24" rx="69" ry="7.5" fill="none" stroke="#4e535a" stroke-width=".8"/>
    <ellipse cx="100" cy="24.6" rx="60" ry="5.4" fill="#a2a7ae"/>
    <ellipse cx="100" cy="25" rx="58" ry="4.8" fill="url(#sf-lid)" opacity=".7"/>
    <rect x="86" y="19.5" width="28" height="8" rx="4" fill="url(#sf-lid)" stroke="#5c6168" stroke-width=".7"/>
    <ellipse cx="93" cy="23.5" rx="3" ry="1.8" fill="#6e737a"/>
  </svg>`;

  const canWire = `
  <svg class="wire" viewBox="0 0 200 380" aria-hidden="true" fill="none" stroke="#e7efff">
    <line ${NS} x1="100" y1="-6" x2="100" y2="392" stroke-dasharray="14 4 2 4" stroke-opacity=".5"/>
    <path ${NS} d="${CAN_BODY}" stroke-width="1.2"/>
    <ellipse ${NS} cx="100" cy="24" rx="69" ry="7.5"/>
    <ellipse ${NS} cx="100" cy="24.6" rx="60" ry="5.4" stroke-opacity=".6"/>
    <path ${NS} d="M15,56 A85,9 0 0 0 185,56" stroke-opacity=".8"/>
    <path ${NS} d="M15,56 A85,9 0 0 1 185,56" stroke-dasharray="3 3" stroke-opacity=".5"/>
    <path ${NS} d="M15,336 A85,9 0 0 0 185,336" stroke-opacity=".8"/>
    <path ${NS} d="M15,336 A85,9 0 0 1 185,336" stroke-dasharray="3 3" stroke-opacity=".5"/>
    <path ${NS} d="M15,200 A85,9 0 0 0 185,200" stroke-opacity=".35"/>
    <text x="100" y="196" text-anchor="middle" font-family="Jost, sans-serif" font-weight="200" font-size="23" textLength="152" lengthAdjust="spacing" stroke-width=".5" fill="none">SLOWFRAME</text>
    <!-- width -->
    <g stroke-opacity=".9">
      <line ${NS} x1="15" y1="-22" x2="185" y2="-22"/><line ${NS} x1="15" y1="-28" x2="15" y2="-10"/><line ${NS} x1="185" y1="-28" x2="185" y2="-10"/>
    </g>
    <text x="100" y="-28" text-anchor="middle" font-size="11" fill="#e7efff" stroke="none" letter-spacing="1">Ø 66.0 mm</text>
    <!-- height -->
    <line ${NS} x1="212" y1="24" x2="212" y2="368"/><line ${NS} x1="204" y1="24" x2="220" y2="24"/><line ${NS} x1="204" y1="368" x2="220" y2="368"/>
    <text x="226" y="200" font-size="11" fill="#e7efff" stroke="none" letter-spacing="1" transform="rotate(90 226 200)" text-anchor="middle">H 122.0 mm</text>
    <!-- impact point -->
    <circle ${NS} cx="18" cy="200" r="7" stroke="#ff7a6e"/>
    <line ${NS} x1="18" y1="186" x2="18" y2="214" stroke="#ff7a6e"/><line ${NS} x1="4" y1="200" x2="32" y2="200" stroke="#ff7a6e"/>
    <!-- material callout -->
    <g class="callout"><polyline ${NS} points="140,300 172,396 250,396" stroke-opacity=".8"/>
    <circle cx="140" cy="300" r="2" fill="#e7efff" stroke="none"/>
    <text x="178" y="390" font-size="9.5" fill="#e7efff" stroke="none" letter-spacing=".8">AL 3004 · t 0.097</text></g>
  </svg>`;

  const bulletReal = `
  <svg class="real" viewBox="0 0 300 80" aria-hidden="true">
    <g fill="none" stroke="#3c2e1e" ${NS}>
      <path ${NS} d="M292,40 Q238,4 140,-46" stroke-opacity=".16"/>
      <path ${NS} d="M292,40 Q238,76 140,126" stroke-opacity=".16"/>
      <path ${NS} d="M262,32 Q214,6 130,-26" stroke-opacity=".08"/>
      <path ${NS} d="M262,48 Q214,74 130,106" stroke-opacity=".08"/>
      <path ${NS} d="M10,30 q-14,-3 -26,1 t-30,0" stroke-opacity=".12"/>
      <path ${NS} d="M10,50 q-16,3 -30,-1 t-34,1" stroke-opacity=".12"/>
      <path ${NS} d="M6,40 q-20,-2 -42,1" stroke-opacity=".08"/>
    </g>
    <path d="${BULLET}" fill="url(#sf-brass)"/>
    <g clip-path="url(#sf-bulClip)">
      <rect x="0" y="0" width="300" height="80" fill="url(#sf-nose)"/>
      <rect x="58" y="15" width="14" height="50" fill="#3b2408" opacity=".38"/>
      <g stroke="#2a1806" stroke-opacity=".5" stroke-width=".6">
        ${Array.from({ length: 7 }, (_, i) => `<line x1="${59.5 + i * 2}" y1="15" x2="${59.5 + i * 2}" y2="65"/>`).join("")}
      </g>
      <rect x="58" y="15" width="1" height="50" fill="#fff2cc" opacity=".55"/>
      <rect x="22" y="28" width="150" height="3.2" fill="#fff" opacity=".55" filter="url(#sf-soft)"/>
      <ellipse cx="222" cy="29.5" rx="42" ry="3.4" fill="#fff" opacity=".7" filter="url(#sf-soft)"/>
      <rect x="18" y="54" width="250" height="4" fill="#ffd9a0" opacity=".22"/>
      <rect x="18" y="15" width="5" height="50" fill="#1d1104" opacity=".35"/>
    </g>
  </svg>`;

  const bulletWire = `
  <svg class="wire" viewBox="0 0 300 80" aria-hidden="true" fill="none" stroke="#e7efff">
    <line ${NS} x1="-24" y1="40" x2="318" y2="40" stroke-dasharray="14 4 2 4" stroke-opacity=".5"/>
    <path ${NS} d="${BULLET}" stroke-width="1.2"/>
    <line ${NS} x1="58" y1="19" x2="58" y2="61" stroke-opacity=".7"/><line ${NS} x1="72" y1="19" x2="72" y2="61" stroke-opacity=".7"/>
    <line ${NS} x1="172" y1="19" x2="172" y2="61" stroke-dasharray="3 3" stroke-opacity=".6"/>
    <line ${NS} x1="18" y1="84" x2="292" y2="84"/><line ${NS} x1="18" y1="78" x2="18" y2="92"/><line ${NS} x1="292" y1="78" x2="292" y2="92"/>
    <text x="155" y="104" text-anchor="middle" font-size="13" fill="#e7efff" stroke="none" letter-spacing="1">L 15.6 mm · m 7.45 g</text>
    <line ${NS} x1="4" y1="19" x2="4" y2="61"/><line ${NS} x1="-2" y1="19" x2="10" y2="19"/><line ${NS} x1="-2" y1="61" x2="10" y2="61"/>
    <text x="-14" y="44" text-anchor="end" font-size="13" fill="#e7efff" stroke="none" letter-spacing="1">Ø 9.0</text>
    <line ${NS} x1="300" y1="22" x2="352" y2="22" stroke="#ff7a6e"/><path ${NS} d="M344,17 L352,22 L344,27" stroke="#ff7a6e"/>
    <text x="300" y="12" font-size="13" fill="#ff7a6e" stroke="none" letter-spacing="1">v 380 m/s</text>
  </svg>`;

  document.body.insertAdjacentHTML("afterbegin", defs);
  const canEl = $("#can"), bulletEl = $("#bullet");
  canEl.innerHTML = `<div class="can-half top">${canReal}${canWire}</div><div class="can-half bot">${canReal}${canWire}</div>`;
  bulletEl.innerHTML = bulletReal + bulletWire;

  const el = {
    clip: $("#clip"), world: $("#world"), blueprint: $("#blueprint"), floor: $("#floor"), trail: $("#trail"),
    dim: $("#dim"), dimLabel: $("#dimLabel"), flash: $("#flash"), feed: $("#feed"), feedProgress: $("#feedProgress"),
    phone: $("#phone"), hud: $("#hud"), counter: $("#counter"), counterLabel: $("#counterLabel"),
    frameNo: $("#frameNo"), mode: $("#mode"), timecode: $("#timecode"), pitch: $("#pitch"), film: $("#film"),
    top: canEl.querySelector(".can-half.top"), bot: canEl.querySelector(".can-half.bot"),
    canReal: canEl.querySelectorAll(".real"), canWire: canEl.querySelectorAll(".wire"),
    bulReal: bulletEl.querySelector(".real"), bulWire: bulletEl.querySelector(".wire"),
    beats: Array.from(document.querySelectorAll(".beat")).map((b) => ({ b, i: +b.dataset.in, o: +b.dataset.out })),
  };
  const canvas = $("#particles");
  const ctx = canvas.getContext("2d");

  /* ------------------------------------------------------------------ */
  /*  Layout                                                             */
  /* ------------------------------------------------------------------ */
  const P_START = 0.04, P_IMPACT = 0.6, T_MAX = 0.95;
  let L = {};

  function layout() {
    const vw = el.clip.clientWidth, vh = el.clip.clientHeight;
    const mobile = vw < 760;
    const Hc = mobile ? Math.min(vw * 0.6, vh * 0.34) : Math.min(vh * 0.56, vw * 0.32);
    const Wc = (Hc * 200) / 380;
    const cx = vw * (mobile ? 0.64 : 0.68), cy = vh * (mobile ? 0.53 : 0.53);
    const I = { x: cx - Wc / 2 + Wc * (18 / 200), y: cy - Hc / 2 + Hc * (200 / 380) };
    const Lb = Hc * (mobile ? 0.46 : 0.42), Hb = (Lb * 80) / 300;
    const x0 = mobile ? Lb * 0.55 : vw * 0.04 + Lb * 0.9;

    // phone screen rect
    let R;
    if (mobile) {
      const w = Math.min(vw * 0.58, 236, (vh - 230) / 2.05);
      const h = w * 2.05;
      R = { w, h, x: (vw - w) / 2, y: vh - h - Math.max(40, vh * 0.06) };
    } else {
      const h = Math.min(vh * 0.76, 700);
      const w = h * 0.47;
      R = { w, h, x: vw * 0.68 - w / 2, y: (vh - h) / 2 + 10 };
    }
    L = { vw, vh, mobile, Hc, Wc, cx, cy, I, Lb, Hb, x0, R, bezel: mobile ? 8 : 11 };

    Object.assign(canEl.style, { width: Wc + "px", height: Hc + "px", transform: `translate(${cx - Wc / 2}px, ${cy - Hc / 2}px)` });
    Object.assign(bulletEl.style, { width: Lb + "px", height: Hb + "px" });
    Object.assign(el.floor.style, { width: Wc * 1.7 + "px", height: Hc * 0.08 + "px", transform: `translate(${cx - Wc * 0.85}px, ${cy + Hc / 2 - Hc * 0.04}px)` });
    Object.assign(el.feed.style, { width: R.w + "px", height: R.h + "px", transform: `translate(${R.x}px, ${R.y}px)` });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    L.dpr = dpr;
    lastDrawn = -1;
  }

  /* ------------------------------------------------------------------ */
  /*  Particles — analytic (scrubbable) ballistic motion with drag       */
  /* ------------------------------------------------------------------ */
  const parts = (() => {
    let seed = 1337;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const randn = () => (rnd() + rnd() + rnd() - 1.5) * 1.15;
    const out = [];
    const W = 200 / 380; // can width in Hc units
    const add = (type, n, fn) => { for (let i = 0; i < n; i++) out.push(Object.assign({ type }, fn())); };
    const polar = (a, s) => ({ vx: Math.cos(a) * s, vy: Math.sin(a) * s });

    add("mist", 170, () => {
      const exit = rnd() < 0.7;
      return { ox: exit ? W * (0.85 + rnd() * 0.2) : rnd() * 0.04, oy: randn() * 0.03, ...polar(exit ? randn() * 0.5 - 0.1 : Math.PI + randn() * 0.5, 1 + rnd() * 2.8), r: 0.0015 + rnd() * 0.003, k: 2.2, a: 0.25 + rnd() * 0.3 };
    });
    add("drop", 250, () => {
      const g = rnd();
      let o;
      if (g < 0.52) o = { ox: W * (0.55 + rnd() * 0.45), oy: randn() * 0.035, ...polar(randn() * 0.38 - 0.18, 0.5 + Math.pow(rnd(), 0.7) * 2.2) };
      else if (g < 0.72) o = { ox: rnd() * 0.06, oy: randn() * 0.03, ...polar(Math.PI + randn() * 0.45 - 0.1, 0.3 + rnd() * 1.1) };
      else o = { ox: W * (0.1 + rnd() * 0.8), oy: randn() * 0.04, ...polar(-Math.PI / 2 + randn() * 0.6 + 0.15, 0.5 + rnd() * 1.4) };
      o.r = 0.004 + Math.pow(rnd(), 2.2) * 0.02;
      o.k = 0.9; o.hue = rnd();
      return o;
    });
    add("shard", 64, () => {
      const n = 3 + Math.floor(rnd() * 3), pts = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd() * 0.6; pts.push([Math.cos(a) * (0.5 + rnd() * 0.6), Math.sin(a) * (0.3 + rnd() * 0.5)]); }
      return { ox: W * rnd(), oy: randn() * 0.04, ...polar(randn() * 1.15 - 0.35, 0.4 + rnd() * 1.9), size: 0.012 + Math.pow(rnd(), 1.5) * 0.035, rot: rnd() * 6.28, rv: (rnd() - 0.5) * 16, pts, k: 1.1, ph: rnd() * 6.28 };
    });
    return out;
  })();

  const G = 1.6; // gravity in can-heights / s²
  let lastDrawn = -1;

  function drawParticles(simT, s, tx, ty, kSplit) {
    const key = simT * 1e4 + s * 7 + tx * 3 + ty;
    if (key === lastDrawn) return;
    lastDrawn = key;
    const { dpr, Hc, I, vw, vh } = L;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (simT <= 0) return;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * tx, dpr * ty);
    const t = simT, k1 = kSplit;

    // impact puff + shock ring
    const puffA = Math.max(0, 1 - t / 0.35);
    if (puffA > 0) {
      const rr = Hc * (0.08 + t * 1.2);
      const g = ctx.createRadialGradient(I.x, I.y, 0, I.x, I.y, rr);
      g.addColorStop(0, `rgba(255,252,240,${0.9 * puffA})`);
      g.addColorStop(0.4, `rgba(255,236,190,${0.35 * puffA})`);
      g.addColorStop(1, "rgba(255,236,190,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(I.x, I.y, rr, 0, 6.283); ctx.fill();
    }
    const ringA = Math.max(0, 0.4 * (1 - t / 0.6));
    if (ringA > 0) {
      ctx.strokeStyle = `rgba(70,55,40,${ringA})`;
      ctx.lineWidth = 1 / s;
      ctx.beginPath(); ctx.ellipse(I.x, I.y, Hc * t * 2.4, Hc * t * 1.9, 0, 0, 6.283); ctx.stroke();
    }

    const cull = (x, y) => {
      const sx = x * s + tx, sy = y * s + ty;
      return sx < -40 || sy < -40 || sx > vw + 40 || sy > vh + 40;
    };

    for (const q of parts) {
      const D = (1 - Math.exp(-q.k * t)) / q.k;
      const x = I.x + Hc * (q.ox + q.vx * D);
      const y = I.y + Hc * (q.oy + q.vy * D + 0.5 * G * t * t);
      if (cull(x, y)) continue;
      const dmp = Math.exp(-q.k * t);
      const cvx = q.vx * dmp, cvy = q.vy * dmp + G * t;

      if (q.type === "mist") {
        ctx.fillStyle = `rgba(214,150,60,${q.a * Math.max(0, 1 - t * 0.6)})`;
        ctx.beginPath(); ctx.arc(x, y, q.r * Hc, 0, 6.283); ctx.fill();
      } else if (q.type === "drop") {
        const r = q.r * Hc * Math.min(1, t * 10 + 0.2);
        const sp = Math.hypot(cvx, cvy);
        const stretch = 1 + Math.min(sp * 0.22, 1.1);
        const ang = Math.atan2(cvy, cvx);
        ctx.save();
        ctx.translate(x, y); ctx.rotate(ang); ctx.scale(stretch, 1 / Math.sqrt(stretch));
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
        const light = 58 + q.hue * 10;
        g.addColorStop(0, `hsla(42, 95%, ${light + 22}%, .95)`);
        g.addColorStop(0.55, `hsla(36, 88%, ${light - 6}%, .9)`);
        g.addColorStop(1, `hsla(28, 80%, ${light - 26}%, .85)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
        if (r > 2.2) {
          ctx.fillStyle = "rgba(255,255,255,.85)";
          ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.38, r * 0.22, 0, 6.283); ctx.fill();
        }
        ctx.restore();
      } else {
        const rot = q.rot + q.rv * D;
        const sz = q.size * Hc;
        const lum = 0.5 + 0.5 * Math.cos(rot * 1.7 + q.ph);
        const c = Math.round(105 + lum * 145);
        ctx.save();
        ctx.translate(x, y); ctx.rotate(rot);
        ctx.fillStyle = `rgb(${c - 6},${c - 2},${c + 4})`;
        ctx.beginPath();
        q.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * sz, py * sz) : ctx.moveTo(px * sz, py * sz)));
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = lum > 0.6 ? "rgba(255,255,255,.9)" : "rgba(60,64,70,.55)";
        ctx.lineWidth = 0.8 / s;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Render — pure function of p                                        */
  /* ------------------------------------------------------------------ */
  let shakeStart = -1e9, flashStart = -1e9;
  const pad = (n, w) => String(Math.max(0, n)).padStart(w, "0");
  let lastP = -1, lastMode = "";

  function render(p, now) {
    const { vw, vh, mobile, Hc, Wc, cx, I, Lb, Hb, x0, R, bezel } = L;
    const f = ramp(p, P_START, P_IMPACT);
    const hit = p >= P_IMPACT;
    const simT = hit ? T_MAX * (1 - Math.exp(-(p - P_IMPACT) * 14)) : 0;
    const kSplit = simT / T_MAX;

    // --- camera: push-in toward the impact point, then pull into the phone
    const push = ease(clamp(p / P_IMPACT));
    const s1 = 1 + (mobile ? 0.2 : 0.3) * push;
    const t1x = I.x * (1 - s1), t1y = I.y * (1 - s1);
    const m = ease(ramp(p, 0.68, 0.8));
    const s2 = R.w / (Wc * 2.35);
    const Cx = cx + Wc * 0.2, Cy = I.y - Hc * 0.12;
    const t2x = R.x + R.w * 0.5 - s2 * Cx, t2y = R.y + R.h * 0.47 - s2 * Cy;
    let s = lerp(s1, s2, m), tx = lerp(t1x, t2x, m), ty = lerp(t1y, t2y, m);

    // shake (real-time impulse)
    const sk = clamp(1 - (now - shakeStart) / 650);
    if (sk > 0) {
      const a = sk * sk * (mobile ? 9 : 16);
      tx += Math.sin(now * 0.11) * a + Math.sin(now * 0.37) * a * 0.4;
      ty += Math.cos(now * 0.13) * a * 0.8;
    }
    el.world.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;

    // --- blueprint mode
    const w = ramp(p, 0.285, 0.305) * (1 - ramp(p, 0.425, 0.445));
    el.blueprint.style.opacity = w;
    el.canReal.forEach((n) => (n.style.opacity = 1 - w));
    el.canWire.forEach((n) => (n.style.opacity = w));
    el.bulReal.style.opacity = 1 - w;
    el.bulWire.style.opacity = w;
    el.floor.style.opacity = (1 - w) * (1 - kSplit * 0.6);

    // --- bullet
    const nose = hit ? I.x + simT * vw * 1.6 : lerp(x0, I.x, f);
    const bl = nose - Lb * (292 / 300);
    bulletEl.style.transform = `translate(${bl}px, ${I.y - Hb / 2}px)`;
    bulletEl.style.opacity = hit ? 1 - ramp(simT, 0.15, 0.4) : 1;

    // motion trail grows with distance travelled
    const tw = Math.max(0, Math.min(nose - x0 + Lb * 0.7, Lb * 3.4));
    const th = Hb * 0.62;
    Object.assign(el.trail.style, {
      width: tw + "px", height: th + "px",
      transform: `translate(${bl + Lb * 0.08 - tw}px, ${I.y - th / 2}px)`,
      opacity: (hit ? 1 - ramp(simT, 0, 0.3) : 1) * (1 - w),
    });

    // --- can: splits along the jagged tear line
    const kk = ease(kSplit);
    canEl.classList.toggle("split", hit);
    el.top.style.transform = `translate(${kk * Wc * 0.55}px, ${-kk * Hc * 0.42}px) rotate(${kk * 28}deg)`;
    el.top.style.transformOrigin = "60% 55%";
    el.bot.style.transform = `translate(${kk * Wc * 0.12}px, ${kk * Hc * 0.06}px) rotate(${-kk * 9}deg)`;
    el.bot.style.transformOrigin = "40% 100%";

    // --- dimension line between bullet and can
    if (w > 0.01) {
      const gap = Math.max(0, I.x - nose - 16);
      Object.assign(el.dim.style, { opacity: w, width: gap + "px", transform: `translate(${nose + 8}px, ${I.y + Hb * 1.9 + 14}px)` });
      el.dimLabel.textContent = `Δx ${(456 * (1 - f)).toFixed(1)} mm · Δt ${(1.2 * (1 - f)).toFixed(3)} ms`;
      el.dimLabel.style.opacity = gap > 190 ? 1 : 0;
    } else el.dim.style.opacity = 0;

    // --- particles
    drawParticles(simT, s, tx, ty, kSplit);

    // --- flash
    const fl = clamp(1 - (now - flashStart) / 380);
    el.flash.style.opacity = fl * fl * 0.92;

    // --- HUD
    el.hud.style.opacity = 1 - ramp(p, 0.68, 0.74);
    el.counter.textContent = hit ? "000" : pad(Math.ceil(120 * (1 - f) - 1e-6), 3);
    el.counterLabel.textContent = hit ? "IMPACT · +" + (simT * 1.26).toFixed(2) + " MS" : "FRAMES TO IMPACT";
    el.frameNo.textContent = hit ? `FRAME 0120 / 0120 · +${pad(Math.round(simT * 140), 3)}` : `FRAME ${pad(Math.round(f * 120), 4)} / 0120`;
    const mode = w > 0.5 ? "MODE · WIREFRAME" : hit ? "MODE · IMPACT" : "MODE · RENDER";
    if (mode !== lastMode) {
      el.mode.textContent = mode; lastMode = mode;
      document.body.classList.toggle("is-wire", w > 0.5);
    }
    document.body.classList.toggle("is-impact", hit && p < 0.7);
    document.body.classList.toggle("is-phone", m > 0.5);

    el.beats.forEach(({ b, i, o }) => {
      const op = (i === 0 ? 1 : ramp(p, i, i + 0.018)) * (1 - ramp(p, o - 0.018, o));
      b.style.opacity = op;
      b.style.transform = `translate3d(0, ${(1 - op) * (p < o - 0.018 ? 24 : -24)}px, 0)`;
      b.style.visibility = op > 0.001 ? "visible" : "hidden";
    });

    // --- clip shrinks into the phone
    const r = m * (mobile ? 30 : 35);
    el.clip.style.clipPath = m > 0
      ? `inset(${m * R.y}px ${m * (vw - R.x - R.w)}px ${m * (vh - R.y - R.h)}px ${m * R.x}px round ${r}px)`
      : "none";
    const ph = ramp(p, 0.74, 0.8);
    Object.assign(el.phone.style, {
      left: R.x - bezel + "px", top: R.y - bezel + "px", width: R.w + bezel * 2 + "px", height: R.h + bezel * 2 + "px",
      opacity: ph, transform: `scale(${1 + (1 - ease(ph)) * 0.06})`,
    });
    el.feed.style.opacity = ramp(p, 0.78, 0.84);
    el.feedProgress.style.transform = `scaleX(${ramp(p, 0.78, 1)})`;
    const pt = ramp(p, 0.79, 0.86);
    el.pitch.style.opacity = pt;
    el.pitch.style.transform = mobile ? `translateY(${(1 - pt) * 20}px)` : `translateY(calc(-50% + ${(1 - pt) * 30}px))`;
  }

  /* ------------------------------------------------------------------ */
  /*  Loop                                                               */
  /* ------------------------------------------------------------------ */
  let target = 0, current = 0, running = false, raf = 0, lastT = performance.now();
  const t0 = performance.now();

  function readScroll() {
    const rect = el.film.getBoundingClientRect();
    const range = el.film.offsetHeight - window.innerHeight;
    target = clamp(-rect.top / Math.max(1, range));
  }

  function tick(now) {
    const dt = Math.min(64, now - lastT); lastT = now;
    readScroll();
    current = reduced ? target : current + (target - current) * (1 - Math.pow(0.86, dt / 16.67));
    if (Math.abs(target - current) < 0.00005) current = target;

    if (lastP >= 0 && lastP < P_IMPACT && current >= P_IMPACT && !reduced) { shakeStart = now; flashStart = now; }
    lastP = current;
    render(current, now);

    const el2 = (now - t0) / 1000;
    el.timecode.textContent = `${pad(Math.floor(el2 / 3600), 2)}:${pad(Math.floor(el2 / 60) % 60, 2)}:${pad(Math.floor(el2) % 60, 2)}:${pad(Math.floor((el2 % 1) * 25), 2)}`;
    if (running) raf = requestAnimationFrame(tick);
  }
  function start() { if (!running) { running = true; lastT = performance.now(); raf = requestAnimationFrame(tick); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  let filmVisible = true;
  new IntersectionObserver((es) => {
    filmVisible = es[0].isIntersecting;
    filmVisible && !document.hidden ? start() : stop();
  }).observe(el.film);
  document.addEventListener("visibilitychange", () => (filmVisible && !document.hidden ? start() : stop()));

  let rz;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(() => { layout(); render(current, performance.now()); });
  });

  layout();
  readScroll(); current = target;
  render(current, performance.now());
  start();

  /* ------------------------------------------------------------------ */
  /*  Buttons                                                            */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll("[data-goto]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.goto;
      const top = id === "top" ? 0 : document.getElementById(id).getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    })
  );

  const status = $("#status"), contactText = $("#contactText");
  const EMAIL = "hello@slowframe.studio";
  $("#contactBtn").addEventListener("click", () => {
    const done = (ok) => {
      status.textContent = ok ? `${EMAIL} copied to clipboard — talk soon.` : `Write to us: ${EMAIL}`;
      contactText.textContent = ok ? "Copied. Roll camera." : EMAIL;
      setTimeout(() => (contactText.textContent = `Start a project — ${EMAIL}`), 2600);
    };
    try {
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(EMAIL).then(() => done(true), () => done(false));
      else done(false);
    } catch (e) { done(false); }
  });

  /* ------------------------------------------------------------------ */
  /*  Finale wordmark reveal (GSAP)                                      */
  /* ------------------------------------------------------------------ */
  if (window.gsap && window.ScrollTrigger && !reduced) {
    gsap.registerPlugin(ScrollTrigger);
    const tl = gsap.timeline({ scrollTrigger: { trigger: ".finale", start: "top 65%", toggleActions: "play none none reverse" } });
    tl.from(".wordmark span", { yPercent: 60, opacity: 0, filter: "blur(16px)", duration: 1.1, ease: "expo.out", stagger: 0.075 })
      .from(".finale .eyebrow", { opacity: 0, y: 10, duration: 0.6 }, 0)
      .from(".tagline", { opacity: 0, letterSpacing: "0.6em", duration: 1, ease: "power3.out" }, 0.45)
      .from(".actions > *", { opacity: 0, y: 18, duration: 0.7, stagger: 0.1, ease: "power3.out" }, 0.7)
      .from(".facts > div", { opacity: 0, y: 14, duration: 0.6, stagger: 0.08 }, 0.9);
  }
})();
