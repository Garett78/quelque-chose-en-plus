/* Quelque Chose en Plus : socle commun (stockage, jeunes, voix, sons, écrans, suivi du regard, calibrage).
   Tout fonctionne sur le téléphone, sans internet. */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const NATIVE = !!(window.Android && typeof window.Android.speak === 'function');
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------------- Stockage (IndexedDB, avec repli en mémoire) ---------------- */
const Store = (() => {
  const mem = new Map();
  let dbp = null;
  function db(){
    if (!dbp) dbp = new Promise((ok, ko) => {
      try{
        const r = indexedDB.open('qcep', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ko(r.error);
      }catch(e){ ko(e); }
    });
    return dbp;
  }
  async function get(k, d){
    try{
      const d0 = await db();
      const v = await new Promise((ok, ko) => { const r = d0.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
      return v === undefined ? d : v;
    }catch(e){ return mem.has(k) ? mem.get(k) : d; }
  }
  async function set(k, v){
    mem.set(k, v);
    try{
      const d0 = await db();
      await new Promise((ok, ko) => { const t = d0.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = ok; t.onerror = () => ko(t.error); });
    }catch(e){}
  }
  async function del(k){
    mem.delete(k);
    try{
      const d0 = await db();
      await new Promise((ok, ko) => { const t = d0.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = ok; t.onerror = () => ko(t.error); });
    }catch(e){}
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  return {get, set, del};
})();

/* ---------------- Photos ajoutées (gardées dans le téléphone) ---------------- */
const Photos = (() => {
  const urls = new Map();
  return {
    url: id => urls.get(id) || null,
    async load(id){
      if (urls.has(id)) return urls.get(id);
      const b = await Store.get('photo:' + id, null);
      if (b){ urls.set(id, URL.createObjectURL(b)); return urls.get(id); }
      return null;
    },
    async save(id, blob){
      await Store.set('photo:' + id, blob);
      if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
      urls.set(id, URL.createObjectURL(blob));
    },
    async remove(id){
      await Store.del('photo:' + id);
      if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
      urls.delete(id);
    }
  };
})();

/* Choisir ou prendre une photo, réduite à 600 px pour garder l'application légère. */
function pickFile(inputId){
  return new Promise(ok => {
    const inp = $(inputId);
    const done = () => { inp.removeEventListener('change', onChange); window.removeEventListener('focus', onFocus); };
    const onChange = () => { done(); const f = inp.files[0]; inp.value = ''; ok(f || null); };
    const onFocus = () => setTimeout(() => { if (!inp.files.length){ done(); ok(null); } }, 1500);
    inp.addEventListener('change', onChange);
    window.addEventListener('focus', onFocus);
    inp.click();
  });
}
function shrinkImage(file){
  return new Promise((ok, ko) => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 600 / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      c.toBlob(b => b ? ok(b) : ko(new Error('image')), 'image/jpeg', 0.85);
    };
    im.onerror = () => { URL.revokeObjectURL(u); ko(new Error('image')); };
    im.src = u;
  });
}
async function pickPhoto(fromCamera){
  const f = await pickFile(fromCamera ? '#fileCam' : '#filePick');
  if (!f) return null;
  try{ return await shrinkImage(f); }catch(e){ return null; }
}

/* ---------------- Jeunes (profils) et préférences ---------------- */
const App = {
  profiles: [], curId: null,
  prefs: {voice:true, sayQ:true, sayWord:true},
  prof(){ return this.profiles.find(p => p.id === this.curId) || this.profiles[0]; },
  saveProfiles(){ Store.set('profiles', this.profiles); Store.set('curId', this.curId); },
  savePrefs(){ Store.set('prefs', this.prefs); }
};
const newProfile = name => ({id: uid('p'), name, mode:'regard', dwell:2, sens:3, side:'left', nch:2, vol:2, calib:null, vcal:null});
function fixProfile(p){
  const d = newProfile(p.name || 'Jeune');
  for (const k of Object.keys(d)) if (p[k] === undefined) p[k] = d[k];
  /* Ancien calibrage OUI / NON : on le convertit en gauche / droite. */
  if (p.calib && p.calib.oui !== undefined){
    p.calib = p.side === 'right' ? {left: p.calib.non, right: p.calib.oui} : {left: p.calib.oui, right: p.calib.non};
  }
  return p;
}
async function loadCore(){
  App.profiles = (await Store.get('profiles', null) || [newProfile('Jeune 1')]).map(fixProfile);
  App.curId = await Store.get('curId', App.profiles[0].id);
  if (!App.profiles.some(p => p.id === App.curId)) App.curId = App.profiles[0].id;
  App.prefs = Object.assign(App.prefs, await Store.get('prefs', {}));
  App.saveProfiles();
}

/* ---------------- Voix ---------------- */
const Voice = (() => {
  let voices = [];
  const loadVoices = () => { try{ voices = speechSynthesis.getVoices(); }catch(e){} };
  if (!NATIVE && 'speechSynthesis' in window){ loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  function say(text){
    if (!App.prefs.voice || !text) return;
    if (NATIVE){ try{ window.Android.speak(text); }catch(e){} return; }
    if (!('speechSynthesis' in window)) return;
    try{
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.rate = 0.9;
      const v = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('fr')); if (v) u.voice = v;
      speechSynthesis.speak(u);
    }catch(e){}
  }
  function stop(){
    if (NATIVE){ try{ window.Android.stop(); }catch(e){} return; }
    try{ speechSynthesis.cancel(); }catch(e){}
  }
  return {say, stop};
})();

/* ---------------- Sons (fabriqués par l'application) ---------------- */
const Sound = (() => {
  let ctx = null, master = null;
  const GAINS = [0.35, 0.65, 1];
  function c(){
    if (!ctx){
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    master.gain.value = level();
    return ctx;
  }
  const level = () => GAINS[(App.prof().vol || 2) - 1];
  function out(){ c(); return master; }
  function tone(freq, t, dur, opts = {}){
    const a = c(), o = a.createOscillator(), g = a.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const peak = opts.gain || 0.25;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, gain, filterFreq){
    const a = c(), len = Math.max(1, Math.floor(a.sampleRate * dur));
    const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    const s = a.createBufferSource(); s.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = filterFreq || 2500;
    const g = a.createGain(); g.gain.value = gain;
    s.connect(f).connect(g).connect(master); s.start(t);
  }
  const now = () => c().currentTime;
  return {
    ctx: c, out, tone, noise, level,
    yes(){ const t = now(); tone(523.25, t, 0.3); tone(783.99, t + 0.16, 0.32); },
    no(){ const t = now(); tone(392, t, 0.3); tone(311.13, t + 0.16, 0.32); },
    bravo(){ const t = now(); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.11, 0.35, {type:'triangle', gain:0.22})); },
    soft(){ const t = now(); tone(440, t, 0.4, {gain:0.12}); },
    sparkle(){ const t = now(); for (let i = 0; i < 6; i++) tone(1800 + Math.random() * 1600, t + i * 0.06, 0.18, {gain:0.08}); },
    glass(){
      const t = now();
      noise(t, 0.5, 0.5, 2000);
      noise(t + 0.03, 0.25, 0.35, 5000);
      for (let i = 0; i < 9; i++) tone(2500 + Math.random() * 4500, t + 0.02 + Math.random() * 0.35, 0.12 + Math.random() * 0.2, {gain:0.06 + Math.random() * 0.06, type:'triangle'});
    },
    playBlob(url){ const a = new Audio(url); a.volume = Math.min(1, level()); return a; }
  };
})();

/* ---------------- Écrans ---------------- */
const Screens = {};
let curScreen = 'home';
function show(id){
  if (id === curScreen) return;
  const prev = Screens[curScreen];
  if (prev && prev.leave) prev.leave();
  $$('.screen').forEach(s => { s.hidden = s.id !== id; });
  curScreen = id;
  const n = Screens[id];
  if (n && n.enter) n.enter();
  window.scrollTo(0, 0);
}
function goBack(){
  const p = $('#' + curScreen).dataset.parent;
  if (p) show(p);
}
document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  if (go){ show(go.dataset.go); return; }
  if (e.target.closest('[data-back]')){ goBack(); return; }
  const cl = e.target.closest('[data-close]');
  if (cl){ const o = cl.closest('.overlay'); if (o) closeOverlay(o); }
});
function openOverlay(id){ $(id).hidden = false; }
function closeOverlay(o){
  if (typeof o === 'string') o = $(o);
  o.hidden = true;
  if (o.onclose) o.onclose();
}
/* Bouton retour d'Android : ferme une fenêtre, sinon revient à l'écran précédent. */
window.qcepBack = function(){
  const o = $$('.overlay').find(x => !x.hidden);
  if (o){ closeOverlay(o); return 'stay'; }
  if (!$('#calib').hidden){ Calib.cancel(); return 'stay'; }
  if (curScreen !== 'home'){ goBack(); return 'stay'; }
  return 'exit';
};

/* ---------------- Suivi du regard (MediaPipe, sur le téléphone) ---------------- */
const THRESH = [0.88, 0.8, 0.72, 0.65, 0.58];
const BAND = [0.08, 0.06, 0.04, 0.02, 0];
const Gaze = (() => {
  const video = $('#video');
  let stream = null, mesh = null, meshReady = null, running = false, starting = false, busy = false, stopTimer = null;
  let emaH = null, emaV = null, rawH = 0, rawV = 0, face = false, lastFrame = 0;
  let consumer = null, cur = null, acc = 0, lockUntil = 0, spent = null, lastEl = null, lastZone = undefined;
  let wakeLock = null;
  const samples = {h: [], v: []};
  let capturing = false;
  const setStatus = t => { const s = $('#status'); if (s.textContent !== t) s.textContent = t; };

  function initMesh(){
    if (!meshReady){
      mesh = new FaceMesh({locateFile: f => 'mediapipe/' + f});
      mesh.setOptions({maxNumFaces:1, refineLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5});
      mesh.onResults(onResults);
      meshReady = mesh.initialize();
    }
    return meshReady;
  }
  /* Horizontal : position de chaque iris entre les deux coins de l'œil. Vertical : hauteur de l'iris par rapport aux coins. */
  function measure(lm){
    const eye = (iris, a, b) => {
      const lo = Math.min(lm[a].x, lm[b].x), hi = Math.max(lm[a].x, lm[b].x), w = (hi - lo) || 1e-6;
      return {h: (lm[iris].x - lo) / w, v: (lm[iris].y - (lm[a].y + lm[b].y) / 2) / w};
    };
    const l = eye(468, 33, 133), r = eye(473, 362, 263);
    return {h: (l.h + r.h) / 2, v: (l.v + r.v) / 2};
  }
  function onResults(res){
    const lm = res.multiFaceLandmarks && res.multiFaceLandmarks[0];
    if (lm && lm.length >= 478){
      const m = measure(lm);
      rawH = m.h; rawV = m.v;
      emaH = emaH == null ? m.h : emaH * 0.7 + m.h * 0.3;
      emaV = emaV == null ? m.v : emaV * 0.75 + m.v * 0.25;
      face = true;
      if (capturing){ samples.h.push(m.h); samples.v.push(m.v); }
    } else face = false;
  }
  async function start(){
    clearTimeout(stopTimer);
    if (running || starting) return;
    starting = true; setStatus('Démarrage de la caméra…');
    try{
      stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user', width:{ideal:640}, height:{ideal:480}}, audio:false});
    }catch(e){
      starting = false;
      setStatus('Caméra non accessible. Autorise la caméra pour l’application, ou passe en mode toucher dans les réglages.');
      return;
    }
    video.srcObject = stream;
    try{ await video.play(); }catch(e){}
    setStatus('Préparation du suivi des yeux…');
    try{ await initMesh(); }
    catch(e){ starting = false; stopNow(); setStatus('Le suivi des yeux n’a pas pu démarrer sur ce téléphone.'); return; }
    starting = false;
    if (!consumer || App.prof().mode !== 'regard' || document.hidden){ stopNow(); return; }
    running = true; emaH = emaV = null; lastFrame = performance.now();
    requestAnimationFrame(tick);
    needCalib();
  }
  function stopNow(){
    running = false;
    if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
    video.srcObject = null; setStatus('Caméra arrêtée');
  }
  async function tick(){
    if (!running) return;
    if (!busy && video.readyState >= 2){
      busy = true;
      try{ await mesh.send({image: video}); }catch(e){ face = false; }
      busy = false;
    }
    const now = performance.now(), dt = Math.min(0.2, (now - lastFrame) / 1000); lastFrame = now;
    update(dt, now);
    if (running) requestAnimationFrame(tick);
  }
  function clearVisual(){
    if (lastEl){ lastEl.classList.remove('looking'); lastEl.style.setProperty('--p', 0); lastEl = null; }
  }
  function zoneChanged(z){
    if (z !== lastZone){ lastZone = z; if (consumer && consumer.onZone) consumer.onZone(z); }
  }
  function update(dt, now){
    if (!consumer) return;
    const p = App.prof();
    if (!face){
      setStatus('Je ne vois pas le visage. Place le téléphone face au jeune.');
      acc = 0; cur = null; spent = null; clearVisual(); zoneChanged(null);
      return;
    }
    if (Calib.active()){ setStatus('Visage trouvé.'); return; }
    if (!p.calib){ setStatus('Calibrage nécessaire : appuie sur « Calibrer ».'); return; }
    if (consumer.needV && !p.vcal){ setStatus('Calibrage haut / bas nécessaire : appuie sur « Calibrer ».'); return; }
    const h = (emaH - p.calib.left) / (p.calib.right - p.calib.left);
    const v = p.vcal ? (emaV - p.vcal.top) / (p.vcal.bottom - p.vcal.top) : 0.5;
    $('#gdot').style.setProperty('--g', Math.max(0, Math.min(1, h)));
    const z = consumer.zoneAt(h, v);
    zoneChanged(z);
    if (z !== spent) spent = null;
    if (now < lockUntil || (z && z === spent) || (consumer.paused && consumer.paused())){
      acc = 0; cur = null; clearVisual();
      setStatus(now < lockUntil ? 'Bravo !' : z ? 'Regarde ailleurs puis reviens' : 'Je suis tes yeux');
      return;
    }
    setStatus(z ? 'Tu regardes…' : 'Je suis tes yeux');
    if (z && z === cur) acc += dt; else { cur = z; acc = 0; }
    const el = cur && consumer.el ? consumer.el(cur) : null;
    if (el !== lastEl) clearVisual();
    if (el){ lastEl = el; el.classList.add('looking'); el.style.setProperty('--p', Math.min(1, acc / p.dwell)); }
    if (cur && acc >= p.dwell){
      const k = cur;
      clearVisual(); acc = 0; cur = null; spent = k;
      lockUntil = now + (consumer.lockMs != null ? consumer.lockMs : 1200);
      consumer.onSelect(k);
    }
  }
  function needCalib(){
    if (!consumer || !running) return;
    const p = App.prof();
    if (!p.calib) Calib.start('h');
    else if (consumer.needV && !p.vcal) Calib.start('v');
  }
  async function keepAwake(){ try{ if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); }catch(e){} }
  function releaseAwake(){ try{ wakeLock && wakeLock.release(); }catch(e){} wakeLock = null; }

  function attach(c){
    consumer = c; cur = null; acc = 0; spent = null; lockUntil = 0; lastZone = undefined; clearVisual();
    keepAwake();
    if (App.prof().mode === 'regard'){
      $('#cam').hidden = false;
      if (running) needCalib(); else start();
    } else { $('#cam').hidden = true; stopNow(); }
  }
  function detach(){
    clearVisual(); consumer = null; Calib.cancel();
    $('#cam').hidden = true; releaseAwake();
    clearTimeout(stopTimer); stopTimer = setTimeout(() => { if (!consumer) stopNow(); }, 600);
  }
  function refresh(){ if (consumer) attach(consumer); }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopNow();
    else if (consumer){ keepAwake(); if (App.prof().mode === 'regard') start(); }
  });
  /* Zones selon la sensibilité du jeune. h : 0 = cible de gauche, 1 = cible de droite. v : 0 = haut, 1 = bas. */
  const sens = () => App.prof().sens || 3;
  const z2 = h => { const t = THRESH[sens() - 1]; return h >= t ? 'R' : h <= 1 - t ? 'L' : null; };
  const z3 = h => { const b = BAND[sens() - 1]; return h < 0.25 - b ? 'L' : h > 0.75 + b ? 'R' : Math.abs(h - 0.5) < 0.25 - b ? 'C' : null; };
  const zv = v => { const b = BAND[sens() - 1] + 0.04; return v < 0.5 - b ? 'T' : v > 0.5 + b ? 'B' : null; };
  return {
    attach, detach, refresh, z2, z3, zv,
    running: () => running, hasFace: () => face,
    capture(on){ capturing = on; if (on){ samples.h = []; samples.v = []; } },
    samples: () => samples,
    endLock(){ lockUntil = 0; },
    consumer: () => consumer,
    needCalib
  };
})();

/* ---------------- Calibrage (commun à tout : questions, jeux, apprentissage) ---------------- */
const Calib = (() => {
  const STEPS = {
    h: [{k:'left', x:22, y:55, txt:'à <strong>gauche</strong>'}, {k:'right', x:78, y:55, txt:'à <strong>droite</strong>'}],
    v: [{k:'top', x:50, y:30, txt:'en <strong>haut</strong>'}, {k:'bottom', x:50, y:80, txt:'en <strong>bas</strong>'}]
  };
  let kind = null, step = 0, vals = {}, busy = false;
  const active = () => kind !== null;
  function msg(){
    const s = STEPS[kind][step];
    const t = $('#calTarget'); t.style.left = s.x + '%'; t.style.top = s.y + '%';
    $('#calibText').innerHTML = `Calibrage ${kind === 'h' ? 'gauche / droite' : 'haut / bas'} pour ${escapeHTML(App.prof().name)}, étape ${step + 1} sur 2 : demande au jeune de regarder l’étoile ${s.txt}. Quand il la regarde, appuie sur Enregistrer sans bouger le téléphone.`;
    $('#calGo').textContent = 'Enregistrer'; $('#calGo').disabled = false;
  }
  function start(k){
    kind = k; step = 0; vals = {}; busy = false;
    $('#calib').hidden = false; msg();
  }
  function cancel(){ kind = null; busy = false; Gaze.capture(false); $('#calib').hidden = true; }
  function later(text, ms){ $('#calibText').textContent = text; setTimeout(() => { if (active()) msg(); }, ms); }
  $('#calCancel').onclick = cancel;
  $('#calGo').onclick = () => {
    if (busy) return;
    if (!Gaze.running() || !Gaze.hasFace()){ later('Je ne vois pas le visage du jeune. Place le téléphone face à lui, puis réessaie.', 2500); return; }
    busy = true; Gaze.capture(true); $('#calGo').textContent = 'Enregistrement…'; $('#calGo').disabled = true;
    setTimeout(() => {
      busy = false; Gaze.capture(false);
      if (!active()) return;
      const arr = Gaze.samples()[kind].slice().sort((a, b) => a - b);
      if (arr.length < 5){ later('Pas assez d’images. Réessaie.', 2000); return; }
      vals[STEPS[kind][step].k] = arr[Math.floor(arr.length / 2)];
      if (step === 0){ step = 1; msg(); return; }
      const p = App.prof();
      if (kind === 'h'){
        if (Math.abs(vals.left - vals.right) < 0.03){ step = 0; vals = {}; later('Les deux regards se ressemblent trop. Rapproche le téléphone du jeune et recommence.', 3500); return; }
        p.calib = {left: vals.left, right: vals.right};
      } else {
        if (Math.abs(vals.top - vals.bottom) < 0.008){ step = 0; vals = {}; later('Le regard haut et le regard bas se ressemblent trop. Rapproche le téléphone et recommence.', 3500); return; }
        p.vcal = {top: vals.top, bottom: vals.bottom};
      }
      App.saveProfiles();
      const wasH = kind === 'h';
      cancel();
      const c = Gaze.consumer();
      if (wasH && c && c.needV && !p.vcal){ Voice.say('Maintenant, en haut et en bas.'); start('v'); return; }
      Voice.say('C’est prêt.');
    }, 1500);
  };
  $('#btnCalib').onclick = () => { if (!Gaze.running()) Gaze.refresh(); start('h'); };
  return {start, cancel, active};
})();

/* ---------------- Choix du jeune ---------------- */
function renderWho(){
  $$('.whoName').forEach(e => { e.textContent = App.prof().name; });
  const l = $('#whoList'); l.innerHTML = '';
  for (const p of App.profiles){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (p.id === App.curId ? ' on' : '');
    b.textContent = p.name + (p.calib ? '' : '  (regard pas encore calibré)');
    b.onclick = () => { App.curId = p.id; App.saveProfiles(); closeOverlay('#whoSheet'); renderWho(); renderHomeHint(); };
    l.appendChild(b);
  }
}
$('#btnWho').onclick = () => { renderWho(); openOverlay('#whoSheet'); };
$('#whoAdd').addEventListener('submit', e => {
  e.preventDefault();
  const n = $('#whoNew').value.trim(); if (!n) return;
  const p = newProfile(n); App.profiles.push(p); App.curId = p.id; $('#whoNew').value = '';
  App.saveProfiles(); renderWho(); renderHomeHint();
});
function renderHomeHint(){
  $$('.whoName').forEach(e => { e.textContent = App.prof().name; });
  $('#modeHint').textContent = App.prof().mode === 'regard'
    ? 'Mode regard : la caméra avant suit les yeux du jeune. Le jeune ou l’adulte peut aussi toucher l’écran.'
    : 'Mode toucher : le jeune ou l’adulte touche l’image pour répondre.';
}

/* ---------------- Réglages ---------------- */
const Rec = {url: {oui: null, non: null}};
function syncSettings(){
  const p = App.prof();
  $$('.whoName').forEach(e => { e.textContent = p.name; });
  $('#mRegard').checked = p.mode === 'regard'; $('#mToucher').checked = p.mode === 'toucher';
  $('#dwell').value = p.dwell; $('#dwellVal').textContent = String(p.dwell).replace('.', ',') + ' s';
  $('#sens').value = p.sens; $('#sensVal').textContent = p.sens + ' / 5';
  $('#sideOuiLeft').checked = p.side !== 'right'; $('#sideOuiRight').checked = p.side === 'right';
  $('#nch2').checked = p.nch !== 3; $('#nch3').checked = p.nch === 3;
  ['vol1', 'vol2', 'vol3'].forEach((id, i) => { $('#' + id).checked = p.vol === i + 1; });
  $('#calibInfo').textContent = (p.calib ? 'Le regard de ' + p.name + ' est calibré.' : 'Le regard de ' + p.name + ' n’est pas encore calibré : ce sera proposé au premier écran avec la caméra.')
    + ' Le bouton « Calibrer » sous la caméra permet de recommencer.';
  $('#voice').checked = App.prefs.voice; $('#sayQ').checked = App.prefs.sayQ; $('#sayWord').checked = App.prefs.sayWord;
  for (const k of ['oui', 'non']){
    const r = document.querySelector(`.recRow[data-k="${k}"]`);
    r.querySelector('[data-act="play"]').disabled = !Rec.url[k];
    r.querySelector('[data-act="del"]').disabled = !Rec.url[k];
  }
  $('#btnDelWho').disabled = App.profiles.length < 2;
}
function saveSettings(){
  const p = App.prof();
  const oldMode = p.mode;
  p.mode = $('#mRegard').checked ? 'regard' : 'toucher';
  p.dwell = +$('#dwell').value; p.sens = +$('#sens').value;
  p.side = $('#sideOuiRight').checked ? 'right' : 'left';
  p.nch = $('#nch3').checked ? 3 : 2;
  p.vol = $('#vol1').checked ? 1 : $('#vol3').checked ? 3 : 2;
  App.prefs.voice = $('#voice').checked; App.prefs.sayQ = $('#sayQ').checked; App.prefs.sayWord = $('#sayWord').checked;
  App.saveProfiles(); App.savePrefs(); syncSettings(); renderHomeHint();
  if (oldMode !== p.mode) Gaze.refresh();
}
['mRegard','mToucher','dwell','sens','sideOuiLeft','sideOuiRight','nch2','nch3','vol1','vol2','vol3','voice','sayQ','sayWord'].forEach(id => $('#' + id).addEventListener('input', saveSettings));
$('#btnSettings').onclick = () => { syncSettings(); $('#whoConfirm').hidden = true; $('#renameForm').hidden = true; openOverlay('#settingsSheet'); };
$('#settingsSheet').onclose = () => stopRec();
$('#btnRename').onclick = () => { $('#renameInput').value = App.prof().name; $('#renameForm').hidden = false; $('#renameInput').focus(); };
$('#renameForm').addEventListener('submit', e => {
  e.preventDefault(); const n = $('#renameInput').value.trim(); if (!n) return;
  App.prof().name = n; App.saveProfiles(); $('#renameForm').hidden = true; syncSettings(); renderHomeHint();
});
$('#btnDelWho').onclick = () => { $('#whoConfirm').hidden = false; };
$('#whoDelNo').onclick = () => { $('#whoConfirm').hidden = true; };
$('#whoDelYes').onclick = () => {
  App.profiles = App.profiles.filter(p => p.id !== App.curId); App.curId = App.profiles[0].id;
  App.saveProfiles(); $('#whoConfirm').hidden = true; syncSettings(); renderHomeHint();
};

/* ---------------- Enregistrer sa voix pour OUI / NON ---------------- */
let rec = null, recKey = null, recTimer = null;
const recStatus = t => { $('#recStatus').textContent = t; };
async function loadRec(){
  for (const k of ['oui', 'non']){
    const b = await Store.get('sound:' + k, null);
    Rec.url[k] = b ? URL.createObjectURL(b) : null;
  }
}
async function startRec(k, btn){
  stopRec();
  let s;
  try{ s = await navigator.mediaDevices.getUserMedia({audio:true}); }
  catch(e){ recStatus('Micro non accessible. Autorise le micro pour l’application.'); return; }
  const chunks = [];
  rec = new MediaRecorder(s); recKey = k;
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = async () => {
    s.getTracks().forEach(t => t.stop());
    btn.classList.remove('recording'); btn.textContent = 'Enregistrer';
    if (!chunks.length) return;
    const b = new Blob(chunks, {type: rec.mimeType || 'audio/webm'});
    await Store.set('sound:' + k, b);
    if (Rec.url[k]) URL.revokeObjectURL(Rec.url[k]);
    Rec.url[k] = URL.createObjectURL(b);
    recStatus('Voix ' + k.toUpperCase() + ' enregistrée.'); syncSettings();
  };
  rec.start(); btn.classList.add('recording'); btn.textContent = 'Arrêter';
  recStatus('Parle maintenant… (4 secondes maximum)');
  recTimer = setTimeout(stopRec, 4000);
}
function stopRec(){ clearTimeout(recTimer); if (rec && rec.state === 'recording') rec.stop(); }
$$('.recRow').forEach(r => r.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  const k = r.dataset.k, act = b.dataset.act;
  if (act === 'rec'){ if (rec && rec.state === 'recording' && recKey === k) stopRec(); else startRec(k, b); }
  if (act === 'play' && Rec.url[k]) Sound.playBlob(Rec.url[k]).play().catch(() => {});
  if (act === 'del'){ await Store.del('sound:' + k); Rec.url[k] = null; recStatus('Voix ' + k.toUpperCase() + ' effacée : la voix du téléphone sera utilisée.'); syncSettings(); }
}));

/* ---------------- Installation (version web) ---------------- */
let installEvt = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (!standalone()) $('#installBanner').hidden = false; });
window.addEventListener('appinstalled', () => { $('#installBanner').hidden = true; });
$('#btnInstall').onclick = async () => {
  if (!installEvt) return;
  installEvt.prompt();
  try{ await installEvt.userChoice; }catch(e){}
  installEvt = null; $('#installBanner').hidden = true;
};
if (!NATIVE && 'serviceWorker' in navigator && location.protocol !== 'file:'){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
