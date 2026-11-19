/* Jeux : les oiseaux chanteurs et les bouteilles. Aucun score, aucun échec : chaque regard produit un effet. */
'use strict';

/* ================= LES OISEAUX CHANTEURS ================= */
const BIRDS = [
  {name:'La mésange', body:'#f4c430', head:'#2b6cd4', wing:'#5b7fa8', breast:'#f9d95b', beak:'#2a2a2a', cheek:'#ffffff'},
  {name:'Le merle', body:'#26262b', head:'#26262b', wing:'#3a3a42', breast:'#303036', beak:'#f39c12', ring:'#f39c12'},
  {name:'Le rouge-gorge', body:'#8a6a4a', head:'#8a6a4a', wing:'#6e5238', breast:'#ea6a2e', beak:'#3a2a1a'}
];
function birdSVG(b){
  return `<svg viewBox="0 0 140 110" aria-hidden="true">
    <polygon points="18,58 2,48 4,74 22,70" fill="${b.wing}"/>
    <ellipse cx="62" cy="64" rx="42" ry="30" fill="${b.body}"/>
    <ellipse cx="78" cy="72" rx="26" ry="20" fill="${b.breast}"/>
    <ellipse cx="54" cy="60" rx="26" ry="15" fill="${b.wing}" transform="rotate(-12 54 60)"/>
    <circle cx="100" cy="42" r="22" fill="${b.head}"/>
    ${b.cheek ? `<ellipse cx="104" cy="48" rx="10" ry="7" fill="${b.cheek}"/>` : ''}
    <g class="beak"><polygon class="up" points="118,38 136,44 118,46" fill="${b.beak}"/><polygon class="down" points="118,46 134,47 118,52" fill="${b.beak}"/></g>
    <circle cx="106" cy="38" r="5.5" fill="#fff"/>
    <circle cx="107" cy="38" r="3.2" fill="#111"/>
    ${b.ring ? `<circle cx="106" cy="38" r="6.5" fill="none" stroke="${b.ring}" stroke-width="2"/>` : ''}
    <line x1="56" y1="92" x2="52" y2="106" stroke="#8b5a2b" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="72" y1="92" x2="72" y2="106" stroke="#8b5a2b" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`;
}

/* Chants fabriqués avec des sons simples, différents pour chaque oiseau. */
function birdPhrase(i){
  const T = Sound.tone, t = Sound.ctx().currentTime + 0.02;
  if (i === 0){ // mésange : « ti-tu ti-tu ti-tu »
    for (let r = 0; r < 3; r++){ T(4300, t + r * 0.36, 0.12, {gain:0.16, to:4100}); T(3100, t + r * 0.36 + 0.16, 0.14, {gain:0.16, to:2950}); }
    return 1.15;
  }
  if (i === 1){ // merle : phrase mélodieuse et flûtée
    const notes = shuffle([1750, 1950, 2200, 2450, 2650, 2050]).slice(0, 5);
    let d = 0;
    notes.forEach(f => { const len = 0.16 + Math.random() * 0.16; T(f, t + d, len, {gain:0.2, to: f * (Math.random() < 0.5 ? 1.12 : 0.9)}); d += len + 0.05; });
    return d;
  }
  // rouge-gorge : trille qui descend puis petits cris aigus
  let d = 0;
  for (let k = 0; k < 9; k++){ const f = 5400 - k * 200; T(f, t + d, 0.07, {gain:0.13, to: f * 0.85}); d += 0.075; }
  for (let k = 0; k < 3; k++){ T(6200, t + d + 0.08, 0.05, {gain:0.11}); d += 0.11; }
  return d + 0.08;
}

const Birds = {singing: [false, false, false], timers: [null, null, null], audio: [null, null, null], urls: [null, null, null], noteTimers: [null, null, null]};
async function loadBirdSongs(){
  for (let i = 0; i < 3; i++){
    const b = await Store.get('birdsong:' + i, null);
    Birds.urls[i] = b ? URL.createObjectURL(b) : null;
  }
}
function birdEl(i){ return document.querySelectorAll('#birdStage .bird')[i]; }
function startSong(i){
  stopSong(i);
  Birds.singing[i] = true;
  const el = birdEl(i); if (el) el.classList.add('singing');
  if (Birds.urls[i]){
    const a = Sound.playBlob(Birds.urls[i]); a.loop = true; a.play().catch(() => {}); Birds.audio[i] = a;
  } else {
    const loop = () => { if (!Birds.singing[i]) return; const d = birdPhrase(i); Birds.timers[i] = setTimeout(loop, (d + 0.8 + Math.random() * 0.6) * 1000); };
    loop();
  }
  const note = () => {
    if (!Birds.singing[i]) return;
    const e = birdEl(i); if (!e) return;
    const n = document.createElement('span'); n.className = 'note'; n.textContent = Math.random() < 0.5 ? '♪' : '♫';
    n.style.left = (55 + Math.random() * 30) + '%';
    e.appendChild(n); setTimeout(() => n.remove(), 1800);
    Birds.noteTimers[i] = setTimeout(note, 450 + Math.random() * 350);
  };
  note();
}
function stopSong(i){
  Birds.singing[i] = false;
  clearTimeout(Birds.timers[i]); clearTimeout(Birds.noteTimers[i]);
  if (Birds.audio[i]){ Birds.audio[i].pause(); Birds.audio[i] = null; }
  const el = birdEl(i); if (el) el.classList.remove('singing');
}
const stopAllSongs = () => [0, 1, 2].forEach(stopSong);
function toggleBird(i){
  if (Birds.singing[i]) stopSong(i); else startSong(i);
}
function renderBirds(){
  const s = $('#birdStage'); s.innerHTML = '<div class="branch"></div>';
  BIRDS.forEach((b, i) => {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'bird';
    btn.setAttribute('aria-label', b.name);
    btn.innerHTML = `<span class="halo"></span>${birdSVG(b)}`;
    btn.onclick = () => { if (!Calib.active()) toggleBird(i); };
    s.appendChild(btn);
  });
}
$('#btnBirdsQuiet').onclick = stopAllSongs;
Screens.birds = {
  enter(){
    renderBirds();
    Gaze.attach({
      zoneAt: h => Gaze.z3(h),
      el: k => birdEl({L:0, C:1, R:2}[k]),
      onSelect: k => toggleBird({L:0, C:1, R:2}[k]),
      lockMs: 600
    });
  },
  leave(){ stopAllSongs(); Gaze.detach(); }
};

/* Remplacer un chant par un vrai enregistrement */
function renderSongs(){
  const l = $('#songList'); l.innerHTML = '';
  BIRDS.forEach((b, i) => {
    const row = document.createElement('div'); row.className = 'songRow';
    row.innerHTML = `<span class="songBird">${birdSVG(b)}</span><div class="col"><strong>${b.name}</strong><small>${Birds.urls[i] ? 'Chant importé' : 'Chant de l’application'}</small>
      <div class="row"><button class="btn" type="button" data-a="play">Écouter</button><button class="btn" type="button" data-a="imp">Importer un son</button>${Birds.urls[i] ? '<button class="btn ghost" type="button" data-a="reset">Chant d’origine</button>' : ''}</div></div>`;
    row.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'play'){
        if (Birds.urls[i]){ const x = Sound.playBlob(Birds.urls[i]); x.play().catch(() => {}); setTimeout(() => x.pause(), 6000); }
        else birdPhrase(i);
      }
      if (a.dataset.a === 'imp'){
        const f = await pickFile('#fileAudio'); if (!f) return;
        if (f.size > 8 * 1024 * 1024){ $('#songStatus').textContent = 'Ce fichier est trop lourd (8 Mo au maximum).'; return; }
        await Store.set('birdsong:' + i, f);
        if (Birds.urls[i]) URL.revokeObjectURL(Birds.urls[i]);
        Birds.urls[i] = URL.createObjectURL(f);
        $('#songStatus').textContent = 'Chant importé pour ' + b.name.toLowerCase() + '.'; renderSongs();
      }
      if (a.dataset.a === 'reset'){
        await Store.del('birdsong:' + i);
        if (Birds.urls[i]) URL.revokeObjectURL(Birds.urls[i]);
        Birds.urls[i] = null; $('#songStatus').textContent = ''; renderSongs();
      }
    });
    l.appendChild(row);
  });
}
$('#btnSongs').onclick = () => { stopAllSongs(); $('#songStatus').textContent = ''; renderSongs(); openOverlay('#songsSheet'); };

/* ================= LES BOUTEILLES ================= */
const BOTTLE_COLORS = ['#2e9e5b', '#2a6fdb', '#d4861f', '#8e44ad', '#d64541', '#16a3a0'];
function bottleSVG(color){
  return `<svg viewBox="0 0 60 170" aria-hidden="true">
    <rect x="22" y="2" width="16" height="10" rx="2" fill="#c9a36b"/>
    <path d="M23 12h14v28c0 8 15 14 15 30v88a10 10 0 0 1-10 10H18a10 10 0 0 1-10-10V70c0-16 15-22 15-30z" fill="${color}" fill-opacity=".88" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
    <rect x="12" y="92" width="36" height="34" rx="4" fill="#f4ecd8" fill-opacity=".92"/>
    <path d="M15 76v70" stroke="rgba(255,255,255,.55)" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
}
const Bottles = {broken: new Set(), resetTimer: null};
const rows = () => App.prof().rows === 2 ? 2 : 1;
const bottleKeys = () => rows() === 2 ? ['T0','T1','T2','B0','B1','B2'] : ['0','1','2'];
function bottleEl(k){ return document.querySelector(`#bottleStage .bottle[data-k="${k}"]`); }
function renderBottles(drop){
  clearTimeout(Bottles.resetTimer);
  Bottles.broken.clear();
  const s = $('#bottleStage'); s.innerHTML = ''; s.classList.toggle('two', rows() === 2);
  const shelves = rows() === 2 ? ['T', 'B'] : [''];
  shelves.forEach((r, ri) => {
    const sh = document.createElement('div'); sh.className = 'shelfRow';
    for (let c = 0; c < 3; c++){
      const k = r + c;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'bottle' + (drop ? ' drop' : '');
      b.dataset.k = k; b.setAttribute('aria-label', 'Bouteille');
      b.style.animationDelay = (c * 0.12 + ri * 0.2) + 's';
      b.innerHTML = `<span class="halo"></span>${bottleSVG(BOTTLE_COLORS[ri * 3 + c])}`;
      b.dataset.color = BOTTLE_COLORS[ri * 3 + c];
      b.onclick = () => { if (!Calib.active()) breakBottle(k); };
      sh.appendChild(b);
    }
    const plank = document.createElement('div'); plank.className = 'plank';
    sh.appendChild(plank);
    s.appendChild(sh);
  });
  $('#rows1').checked = rows() === 1; $('#rows2').checked = rows() === 2;
}
function breakBottle(k){
  if (Bottles.broken.has(k)) return;
  const el = bottleEl(k); if (!el) return;
  Bottles.broken.add(k);
  const r = el.querySelector('svg').getBoundingClientRect();
  el.classList.add('broken');
  Shards.burst(r.left + r.width / 2, r.top + r.height * 0.55, el.dataset.color, r.width);
  Sound.glass();
  if (navigator.vibrate) try{ navigator.vibrate(80); }catch(e){}
  if (Bottles.broken.size === bottleKeys().length){
    setTimeout(() => { Sound.bravo(); Voice.say('Bravo !'); }, 700);
    Bottles.resetTimer = setTimeout(() => renderBottles(true), 3200);
  }
}
function setRows(n){
  App.prof().rows = n; App.saveProfiles();
  renderBottles(true);
  Gaze.attach(bottleConsumer());
}
$('#rows1').addEventListener('input', () => setRows(1));
$('#rows2').addEventListener('input', () => setRows(2));
function bottleConsumer(){
  return {
    needV: rows() === 2,
    zoneAt(h, v){
      const c = {L:'0', C:'1', R:'2'}[Gaze.z3(h)];
      if (c === undefined) return null;
      let k = c;
      if (rows() === 2){ const r = Gaze.zv(v); if (!r) return null; k = r + c; }
      return Bottles.broken.has(k) ? null : k;
    },
    el: k => bottleEl(k),
    onSelect: k => breakBottle(k),
    lockMs: 500
  };
}
Screens.bottles = {
  enter(){ renderBottles(false); Shards.fit(); Gaze.attach(bottleConsumer()); },
  leave(){ clearTimeout(Bottles.resetTimer); Shards.clear(); Gaze.detach(); }
};

/* Éclats de verre */
const Shards = (() => {
  const cv = $('#shards'), cx = cv.getContext('2d');
  let parts = [], raf = null;
  function fit(){ const d = window.devicePixelRatio || 1; cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); }
  window.addEventListener('resize', fit);
  function burst(x, y, color, size){
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const n = reduce ? 10 : 34;
    for (let i = 0; i < n; i++){
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 7;
      parts.push({x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        s: size * (0.06 + Math.random() * 0.12), life: 1, color: Math.random() < 0.25 ? '#ffffff' : color});
    }
    if (!raf) raf = requestAnimationFrame(step);
  }
  function step(){
    cx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts){
      p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.012;
      cx.save(); cx.globalAlpha = Math.max(0, p.life) * 0.9; cx.translate(p.x, p.y); cx.rotate(p.r);
      cx.fillStyle = p.color; cx.beginPath(); cx.moveTo(0, -p.s); cx.lineTo(p.s * 0.8, p.s * 0.6); cx.lineTo(-p.s * 0.7, p.s * 0.4); cx.closePath(); cx.fill();
      cx.restore();
    }
    raf = parts.length ? requestAnimationFrame(step) : null;
    if (!raf) cx.clearRect(0, 0, innerWidth, innerHeight);
  }
  return {fit, burst, clear(){ parts = []; cx.clearRect(0, 0, innerWidth, innerHeight); }};
})();

/* Petites illustrations du menu des jeux */
function renderGameTiles(){
  $('#tileBirds').innerHTML = BIRDS.map(birdSVG).join('');
  $('#tileBottles').innerHTML = BOTTLE_COLORS.slice(0, 3).map(bottleSVG).join('');
}
