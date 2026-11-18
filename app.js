/* Quelque Chose en Plus : communication Oui / Non par le regard.
   Tout fonctionne sur le téléphone, sans internet une fois installé. */
'use strict';
const $ = s => document.querySelector(s);

/* ---------------- Stockage (IndexedDB, avec repli en mémoire) ---------------- */
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

/* ---------------- Données par défaut ---------------- */
const ICONS = {
  musique:'<path d="M24 46V14l26-6v32"/><circle cx="18" cy="46" r="7"/><circle cx="44" cy="40" r="7"/>',
  parler:'<path d="M10 12h44v30H30l-12 10V42h-8z"/>'
};
const DEFAULT_CARDS = [
  {id:'toilettes', label:'Toilettes', q:'Tu veux aller aux toilettes ?', img:'images/toilettes.jpg'},
  {id:'boire', label:'Boire', q:'Tu veux boire ?', img:'images/boire.jpg'},
  {id:'manger', label:'Manger', q:'Tu veux manger ?', img:'images/manger.jpg'},
  {id:'repos', label:'Se reposer', q:'Tu veux te reposer ?', img:'images/repos.jpg'},
  {id:'change', label:'Change', q:'Tu veux qu’on te change ?', img:'images/change.jpg'},
  {id:'cour', label:'La cour', q:'Tu veux aller dans la cour ?', img:'images/cour.jpg'},
  {id:'musique', label:'Musique', q:'Tu veux écouter de la musique ?', icon:'musique'}
];
const newProfile = name => ({id:'p' + Date.now(), name, mode:'regard', dwell:2, sens:3, side:'left', calib:null});

let cards = [], profiles = [], curId = null;
let prefs = {voice:true, sayQ:true, sayWord:true};
const photoURL = new Map();
let soundURL = {oui:null, non:null};
const prof = () => profiles.find(p => p.id === curId) || profiles[0];
const saveCards = () => set('cards', cards);
const saveProfiles = () => { set('profiles', profiles); set('curId', curId); };

async function load(){
  cards = await get('cards', null) || DEFAULT_CARDS.map(c => ({...c}));
  profiles = await get('profiles', null) || [newProfile('Jeune 1')];
  curId = await get('curId', profiles[0].id);
  if (!profiles.some(p => p.id === curId)) curId = profiles[0].id;
  prefs = Object.assign(prefs, await get('prefs', {}));
  for (const c of cards) if (c.photo){
    const b = await get('photo:' + c.id, null);
    if (b) photoURL.set(c.id, URL.createObjectURL(b));
  }
  for (const k of ['oui', 'non']){
    const b = await get('sound:' + k, null);
    soundURL[k] = b ? URL.createObjectURL(b) : null;
  }
}

/* ---------------- Visuel d'une carte ---------------- */
function visual(c){
  const src = photoURL.get(c.id) || c.img;
  if (src){ const i = document.createElement('img'); i.className = 'pic'; i.alt = ''; i.src = src; return i; }
  const d = document.createElement('div'); d.className = 'ico';
  d.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${ICONS[c.icon] || ICONS.parler}</svg>`;
  return d;
}

/* ---------------- Accueil ---------------- */
let editing = false;
function renderHome(){
  const g = $('#grid'); g.innerHTML = '';
  g.classList.toggle('editing', editing);
  for (const c of cards){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card';
    b.appendChild(visual(c));
    const s = document.createElement('span'); s.textContent = c.label; b.appendChild(s);
    if (editing){ const p = document.createElement('span'); p.className = 'pen'; p.textContent = 'Modifier'; b.appendChild(p); }
    b.onclick = () => editing ? openCard(c) : openAsk(c);
    g.appendChild(b);
  }
  const a = document.createElement('button'); a.type = 'button'; a.className = 'card add';
  a.innerHTML = '<span class="plus">+</span><span>Ajouter une image</span>';
  a.onclick = () => openCard(null);
  g.appendChild(a);
  $('#btnEdit').textContent = editing ? 'Terminé' : 'Modifier la bibliothèque';
  $('#editHint').hidden = !editing;
  $('#whoName').textContent = prof().name;
  $('#modeHint').textContent = prof().mode === 'regard'
    ? 'Mode regard : la caméra avant suit les yeux du jeune. Le jeune ou l’adulte peut aussi toucher le carré.'
    : 'Mode toucher : le jeune ou l’adulte touche le carré pour répondre.';
}
$('#btnEdit').onclick = () => { editing = !editing; renderHome(); };

/* ---------------- Ajouter / modifier une image ---------------- */
let editCard = null, pendingPhoto = null;
function setPreview(){
  const p = $('#cardPreview'); p.innerHTML = '';
  if (pendingPhoto){ const i = document.createElement('img'); i.className = 'pic'; i.alt = ''; i.src = URL.createObjectURL(pendingPhoto); p.appendChild(i); }
  else p.appendChild(visual(editCard || {icon:'parler'}));
}
function openCard(c){
  editCard = c; pendingPhoto = null;
  $('#cardTitle').textContent = c ? 'Modifier « ' + c.label + ' »' : 'Nouvelle image';
  $('#fLabel').value = c ? c.label : ''; $('#fQ').value = c ? c.q : '';
  $('#cardDelete').hidden = !c; $('#cardConfirm').hidden = true;
  setPreview(); $('#cardSheet').hidden = false;
}
$('#btnTakePhoto').onclick = () => $('#fileCam').click();
$('#btnPickPhoto').onclick = () => $('#filePick').click();
for (const id of ['#fileCam', '#filePick']) $(id).addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try{ pendingPhoto = await shrink(f); setPreview(); }catch(err){}
});
function shrink(file){
  return new Promise((ok, ko) => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 600 / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      c.toBlob(b => b ? ok(b) : ko(new Error('image')), 'image/jpeg', 0.85);
    };
    im.onerror = ko; im.src = u;
  });
}
$('#cardCancel').onclick = () => { $('#cardSheet').hidden = true; };
$('#cardForm').addEventListener('submit', async e => {
  e.preventDefault();
  const label = $('#fLabel').value.trim(); if (!label) return;
  const q = $('#fQ').value.trim() || label + ' ?';
  let c = editCard;
  if (!c){ c = {id:'c' + Date.now(), icon:'parler'}; cards.push(c); }
  c.label = label; c.q = q;
  if (pendingPhoto){
    await set('photo:' + c.id, pendingPhoto);
    if (photoURL.has(c.id)) URL.revokeObjectURL(photoURL.get(c.id));
    photoURL.set(c.id, URL.createObjectURL(pendingPhoto)); c.photo = true;
  }
  await saveCards(); $('#cardSheet').hidden = true; renderHome();
});
$('#cardDelete').onclick = () => { $('#cardConfirm').hidden = false; };
$('#cardDeleteNo').onclick = () => { $('#cardConfirm').hidden = true; };
$('#cardDeleteYes').onclick = async () => {
  cards = cards.filter(x => x !== editCard);
  await del('photo:' + editCard.id); photoURL.delete(editCard.id);
  await saveCards(); $('#cardSheet').hidden = true; renderHome();
};

/* ---------------- Choix du jeune ---------------- */
function renderWho(){
  const l = $('#whoList'); l.innerHTML = '';
  for (const p of profiles){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (p.id === curId ? ' on' : '');
    b.textContent = p.name + (p.calib ? '' : '  (regard pas encore calibré)');
    b.onclick = () => { curId = p.id; saveProfiles(); $('#whoSheet').hidden = true; renderHome(); };
    l.appendChild(b);
  }
}
$('#btnWho').onclick = () => { renderWho(); $('#whoSheet').hidden = false; };
$('#whoClose').onclick = () => { $('#whoSheet').hidden = true; };
$('#whoAdd').addEventListener('submit', e => {
  e.preventDefault();
  const n = $('#whoNew').value.trim(); if (!n) return;
  const p = newProfile(n); profiles.push(p); curId = p.id; $('#whoNew').value = '';
  saveProfiles(); renderWho(); renderHome();
});

/* ---------------- Réglages ---------------- */
function syncSettings(){
  const p = prof();
  $('#setWho').textContent = p.name;
  $('#mRegard').checked = p.mode === 'regard'; $('#mToucher').checked = p.mode === 'toucher';
  $('#dwell').value = p.dwell; $('#dwellVal').textContent = String(p.dwell).replace('.', ',') + ' s';
  $('#sens').value = p.sens; $('#sensVal').textContent = p.sens + ' / 5';
  $('#sideOuiLeft').checked = p.side !== 'right'; $('#sideOuiRight').checked = p.side === 'right';
  $('#calibInfo').textContent = p.calib ? 'Le regard de ' + p.name + ' est calibré. Tu peux le recalibrer depuis l’écran d’une question.' : 'Le regard de ' + p.name + ' n’est pas encore calibré : ce sera proposé à la première question.';
  $('#voice').checked = prefs.voice; $('#sayQ').checked = prefs.sayQ; $('#sayWord').checked = prefs.sayWord;
  for (const k of ['oui', 'non']){
    const r = document.querySelector(`.recRow[data-k="${k}"]`);
    r.querySelector('[data-act="play"]').disabled = !soundURL[k];
    r.querySelector('[data-act="del"]').disabled = !soundURL[k];
  }
  $('#btnDelWho').disabled = profiles.length < 2;
}
function saveSettings(){
  const p = prof();
  p.mode = $('#mRegard').checked ? 'regard' : 'toucher';
  p.dwell = +$('#dwell').value; p.sens = +$('#sens').value;
  const side = $('#sideOuiRight').checked ? 'right' : 'left';
  if (side !== p.side){ p.side = side; p.calib = null; }
  prefs.voice = $('#voice').checked; prefs.sayQ = $('#sayQ').checked; prefs.sayWord = $('#sayWord').checked;
  saveProfiles(); set('prefs', prefs); syncSettings(); renderHome();
}
['mRegard','mToucher','dwell','sens','sideOuiLeft','sideOuiRight','voice','sayQ','sayWord'].forEach(id => $('#' + id).addEventListener('input', saveSettings));
$('#btnSettings').onclick = () => { syncSettings(); $('#whoConfirm').hidden = true; $('#renameForm').hidden = true; $('#settingsSheet').hidden = false; };
$('#sClose').onclick = () => { stopRec(); $('#settingsSheet').hidden = true; };
$('#btnRename').onclick = () => { $('#renameInput').value = prof().name; $('#renameForm').hidden = false; $('#renameInput').focus(); };
$('#renameForm').addEventListener('submit', e => {
  e.preventDefault(); const n = $('#renameInput').value.trim(); if (!n) return;
  prof().name = n; saveProfiles(); $('#renameForm').hidden = true; syncSettings(); renderHome();
});
$('#btnDelWho').onclick = () => { $('#whoConfirmName').textContent = prof().name; $('#whoConfirm').hidden = false; };
$('#whoDelNo').onclick = () => { $('#whoConfirm').hidden = true; };
$('#whoDelYes').onclick = () => {
  profiles = profiles.filter(p => p.id !== curId); curId = profiles[0].id;
  saveProfiles(); $('#whoConfirm').hidden = true; syncSettings(); renderHome();
};

/* ---------------- Enregistrer sa voix pour OUI / NON ---------------- */
let rec = null, recKey = null, recTimer = null;
function recStatus(t){ $('#recStatus').textContent = t; }
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
    await set('sound:' + k, b);
    if (soundURL[k]) URL.revokeObjectURL(soundURL[k]);
    soundURL[k] = URL.createObjectURL(b);
    recStatus('Voix ' + k.toUpperCase() + ' enregistrée.'); syncSettings();
  };
  rec.start(); btn.classList.add('recording'); btn.textContent = 'Arrêter';
  recStatus('Parle maintenant… (4 secondes maximum)');
  recTimer = setTimeout(stopRec, 4000);
}
function stopRec(){ clearTimeout(recTimer); if (rec && rec.state === 'recording') rec.stop(); }
document.querySelectorAll('.recRow').forEach(r => r.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  const k = r.dataset.k, act = b.dataset.act;
  if (act === 'rec'){ if (rec && rec.state === 'recording' && recKey === k) stopRec(); else startRec(k, b); }
  if (act === 'play' && soundURL[k]) new Audio(soundURL[k]).play().catch(() => {});
  if (act === 'del'){ await del('sound:' + k); soundURL[k] = null; recStatus('Voix ' + k.toUpperCase() + ' effacée : la voix du téléphone sera utilisée.'); syncSettings(); }
}));

/* ---------------- Voix et sons ---------------- */
let voices = [];
function loadVoices(){ try{ voices = speechSynthesis.getVoices(); }catch(e){} }
if ('speechSynthesis' in window){ loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
const NATIVE = window.Android && typeof window.Android.speak === 'function';
function say(text){
  if (!prefs.voice) return;
  if (NATIVE){ try{ window.Android.speak(text); }catch(e){} return; }
  if (!('speechSynthesis' in window)) return;
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.rate = 0.9;
    const v = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('fr')); if (v) u.voice = v;
    speechSynthesis.speak(u);
  }catch(e){}
}
let actx;
function chime(ok){
  try{
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    (ok ? [523.25, 783.99] : [392, 311.13]).forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.16;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.35);
    });
  }catch(e){}
}
function answerSound(which){
  const word = which === 'oui' ? 'Oui' : 'Non';
  const tail = prefs.sayWord && current ? current.label.toLowerCase() : '';
  if (prefs.voice && soundURL[which]){
    const a = new Audio(soundURL[which]);
    a.onended = () => { if (tail) say(tail); };
    a.play().catch(() => say(tail ? word + ', ' + tail + '.' : word + ' !'));
  } else {
    chime(which === 'oui');
    setTimeout(() => say(tail ? word + ', ' + tail + '.' : word + ' !'), 380);
  }
}

/* ---------------- Écran question ---------------- */
const cOui = $('#cOui'), cNon = $('#cNon'), choicesEl = $('#choices');
let current = null, locked = false, lockUntil = 0, chosen = null, cur = null, acc = 0, wakeLock = null;

function openAsk(c){
  current = c;
  const q = $('#qText'); q.innerHTML = ''; q.appendChild(visual(c));
  const s = document.createElement('span'); s.textContent = c.label + ' ?'; q.appendChild(s);
  const flip = prof().side === 'right';
  choicesEl.classList.toggle('flip', flip); $('.gbar').classList.toggle('flip', flip);
  $('#home').hidden = true; $('#ask').hidden = false;
  resetAnswer();
  if (prefs.sayQ) say(c.q);
  keepAwake(); applyMode();
}
function applyMode(){
  if (prof().mode === 'regard'){ $('#cam').hidden = false; $('#btnCalib').hidden = false; startCamera(); }
  else { stopCamera(); $('#cam').hidden = true; $('#btnCalib').hidden = true; hideCalib(); }
}
function resetAnswer(){
  locked = false; chosen = null; cur = null; acc = 0;
  choicesEl.classList.remove('done');
  [cOui, cNon].forEach(c => { c.classList.remove('chosen', 'looking'); c.style.setProperty('--p', 0); });
}
function choose(which){
  resetAnswer();
  locked = true; lockUntil = performance.now() + 3000; chosen = which;
  choicesEl.classList.add('done');
  (which === 'oui' ? cOui : cNon).classList.add('chosen');
  if (navigator.vibrate) try{ navigator.vibrate(60); }catch(e){}
  answerSound(which);
}
cOui.onclick = () => { if (!calibrating) choose('oui'); };
cNon.onclick = () => { if (!calibrating) choose('non'); };
$('#btnRepeat').onclick = () => { if (current) say(current.q); resetAnswer(); };
$('#btnBack').onclick = () => {
  current = null; stopCamera(); hideCalib(); releaseAwake();
  $('#ask').hidden = true; $('#home').hidden = false;
};
async function keepAwake(){ try{ if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); }catch(e){} }
function releaseAwake(){ try{ wakeLock && wakeLock.release(); }catch(e){} wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCamera();
  else if (current){ keepAwake(); if (prof().mode === 'regard') startCamera(); }
});

/* ---------------- Caméra et suivi des yeux (MediaPipe, sur le téléphone) ---------------- */
const video = $('#video');
let stream = null, mesh = null, meshReady = null, running = false, starting = false, busy = false;
let ema = null, face = false, lastFrame = 0, samples = [], capturing = false;
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
async function startCamera(){
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
  catch(e){ starting = false; stopCamera(); setStatus('Le suivi des yeux n’a pas pu démarrer sur ce téléphone.'); return; }
  starting = false;
  if (!current || prof().mode !== 'regard' || document.hidden){ stopCamera(); return; }
  running = true; ema = null; lastFrame = performance.now();
  if (!prof().calib) startCalib();
  requestAnimationFrame(tick);
}
function stopCamera(){
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

/* Position de chaque iris entre les deux coins de l'œil (0 à 1), moyenne des deux yeux. */
function irisRatio(lm){
  const r = (i, a, b) => { const lo = Math.min(lm[a].x, lm[b].x), hi = Math.max(lm[a].x, lm[b].x); return (lm[i].x - lo) / ((hi - lo) || 1e-6); };
  return (r(468, 33, 133) + r(473, 362, 263)) / 2;
}
function onResults(res){
  const lm = res.multiFaceLandmarks && res.multiFaceLandmarks[0];
  if (lm && lm.length >= 478){
    const v = irisRatio(lm);
    ema = ema == null ? v : ema * 0.7 + v * 0.3;
    face = true;
    if (capturing) samples.push(v);
  } else face = false;
}

const THRESH = [0.88, 0.8, 0.72, 0.65, 0.58];
function update(dt, now){
  const p0 = prof();
  if (!face){
    setStatus('Je ne vois pas le visage. Place le téléphone face au jeune.');
    acc = 0; cur = null; [cOui, cNon].forEach(c => { c.classList.remove('looking'); c.style.setProperty('--p', 0); });
    return;
  }
  if (calibrating){ setStatus('Visage trouvé.'); return; }
  if (!p0.calib){ setStatus('Calibration nécessaire : appuie sur « Calibrer le regard ».'); return; }
  const p = (ema - p0.calib.non) / (p0.calib.oui - p0.calib.non);
  const pc = Math.max(0, Math.min(1, p));
  $('#gdot').style.setProperty('--g', p0.side === 'right' ? pc : 1 - pc);
  const t = THRESH[p0.sens - 1] || 0.72;
  const target = p >= t ? 'oui' : p <= 1 - t ? 'non' : null;

  if (locked){
    setStatus('Réponse donnée.');
    if (now > lockUntil && target !== chosen) resetAnswer();
    return;
  }
  setStatus(target === 'oui' ? 'Regarde OUI' : target === 'non' ? 'Regarde NON' : 'Regarde au centre');
  if (target && target === cur) acc += dt; else { cur = target; acc = 0; }
  const prog = cur ? Math.min(1, acc / p0.dwell) : 0;
  cOui.style.setProperty('--p', cur === 'oui' ? prog : 0);
  cNon.style.setProperty('--p', cur === 'non' ? prog : 0);
  cOui.classList.toggle('looking', cur === 'oui');
  cNon.classList.toggle('looking', cur === 'non');
  if (cur && acc >= p0.dwell) choose(cur);
}

/* ---------------- Calibration ---------------- */
let calibrating = false, calStep = 'oui', calTmp = {};
function calibMsg(){
  const n = calStep === 'oui' ? '1' : '2';
  const col = calStep === 'oui' ? '<strong>carré VERT (OUI)</strong>' : '<strong>carré ROUGE (NON)</strong>';
  $('#calibText').innerHTML = `Calibrage pour ${escapeHTML(prof().name)}, étape ${n} sur 2 : demande au jeune de regarder le ${col}. Quand il le regarde, appuie sur Enregistrer sans bouger le téléphone.`;
  cOui.classList.toggle('target', calStep === 'oui');
  cNon.classList.toggle('target', calStep === 'non');
  $('#calGo').textContent = 'Enregistrer'; $('#calGo').disabled = false;
}
const escapeHTML = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function startCalib(){
  calibrating = true; calStep = 'oui'; calTmp = {}; resetAnswer();
  $('#calibPanel').hidden = false; calibMsg();
}
function hideCalib(){
  calibrating = false; capturing = false;
  $('#calibPanel').hidden = true; cOui.classList.remove('target'); cNon.classList.remove('target');
}
$('#btnCalib').onclick = () => { if (!running) startCamera(); startCalib(); };
$('#calCancel').onclick = hideCalib;
$('#calGo').onclick = () => {
  if (!running || !face){ $('#calibText').textContent = 'Je ne vois pas le visage du jeune. Place le téléphone face à lui, puis réessaie.'; setTimeout(calibMsg, 2500); return; }
  samples = []; capturing = true; $('#calGo').textContent = 'Enregistrement…'; $('#calGo').disabled = true;
  setTimeout(() => {
    capturing = false;
    if (samples.length < 5){ $('#calibText').textContent = 'Pas assez d’images. Réessaie.'; setTimeout(calibMsg, 2000); return; }
    samples.sort((a, b) => a - b);
    calTmp[calStep] = samples[Math.floor(samples.length / 2)];
    if (calStep === 'oui'){ calStep = 'non'; calibMsg(); return; }
    if (Math.abs(calTmp.oui - calTmp.non) < 0.03){
      calStep = 'oui'; calTmp = {};
      $('#calibText').textContent = 'Les deux regards se ressemblent trop. Rapproche le téléphone du jeune et recommence.';
      setTimeout(calibMsg, 3500); return;
    }
    prof().calib = {oui:calTmp.oui, non:calTmp.non}; saveProfiles();
    hideCalib(); say('C’est prêt.');
  }, 1500);
};

/* ---------------- Installation ---------------- */
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

load().then(renderHome);
