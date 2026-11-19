/* Communiquer : bibliothèque d'images et questions Oui / Non. */
'use strict';
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
const Comm = {cards: [], editing: false, current: null};

async function loadComm(){
  Comm.cards = await Store.get('cards', null) || DEFAULT_CARDS.map(c => ({...c}));
  for (const c of Comm.cards) if (c.photo) await Photos.load(c.id);
}
const saveCards = () => Store.set('cards', Comm.cards);

function cardVisual(c){
  const src = Photos.url(c.id) || c.img;
  if (src){ const i = document.createElement('img'); i.className = 'pic'; i.alt = ''; i.src = src; return i; }
  const d = document.createElement('div'); d.className = 'ico';
  d.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${ICONS[c.icon] || ICONS.parler}</svg>`;
  return d;
}

/* ---------------- Bibliothèque ---------------- */
function renderComm(){
  const g = $('#grid'); g.innerHTML = '';
  g.classList.toggle('editing', Comm.editing);
  for (const c of Comm.cards){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card';
    b.appendChild(cardVisual(c));
    const s = document.createElement('span'); s.textContent = c.label; b.appendChild(s);
    if (Comm.editing){ const p = document.createElement('span'); p.className = 'pen'; p.textContent = 'Modifier'; b.appendChild(p); }
    b.onclick = () => Comm.editing ? openCard(c) : openAsk(c);
    g.appendChild(b);
  }
  const a = document.createElement('button'); a.type = 'button'; a.className = 'card add';
  a.innerHTML = '<span class="plus">+</span><span>Ajouter une image</span>';
  a.onclick = () => openCard(null);
  g.appendChild(a);
  $('#btnEdit').textContent = Comm.editing ? 'Terminé' : 'Modifier';
  $('#editHint').hidden = !Comm.editing;
}
$('#btnEdit').onclick = () => { Comm.editing = !Comm.editing; renderComm(); };
Screens.comm = {enter: renderComm, leave(){ Comm.editing = false; }};

/* ---------------- Ajouter / modifier une carte ---------------- */
let editCard = null, pendingPhoto = null;
function setCardPreview(){
  const p = $('#cardPreview'); p.innerHTML = '';
  if (pendingPhoto){ const i = document.createElement('img'); i.className = 'pic'; i.alt = ''; i.src = URL.createObjectURL(pendingPhoto); p.appendChild(i); }
  else p.appendChild(cardVisual(editCard || {icon:'parler'}));
}
function openCard(c){
  editCard = c; pendingPhoto = null;
  $('#cardTitle').textContent = c ? 'Modifier « ' + c.label + ' »' : 'Nouvelle image';
  $('#fLabel').value = c ? c.label : ''; $('#fQ').value = c ? c.q : '';
  $('#cardDelete').hidden = !c; $('#cardConfirm').hidden = true;
  setCardPreview(); openOverlay('#cardSheet');
}
$('#cardSheet').addEventListener('click', async e => {
  const b = e.target.closest('[data-photo]'); if (!b) return;
  const blob = await pickPhoto(b.dataset.photo === 'cam');
  if (blob){ pendingPhoto = blob; setCardPreview(); }
});
$('#cardForm').addEventListener('submit', async e => {
  e.preventDefault();
  const label = $('#fLabel').value.trim(); if (!label) return;
  const q = $('#fQ').value.trim() || label + ' ?';
  let c = editCard;
  if (!c){ c = {id: uid('c'), icon:'parler'}; Comm.cards.push(c); }
  c.label = label; c.q = q;
  if (pendingPhoto){ await Photos.save(c.id, pendingPhoto); c.photo = true; }
  await saveCards(); closeOverlay('#cardSheet'); renderComm();
});
$('#cardDelete').onclick = () => { $('#cardConfirm').hidden = false; };
$('#cardDeleteNo').onclick = () => { $('#cardConfirm').hidden = true; };
$('#cardDeleteYes').onclick = async () => {
  Comm.cards = Comm.cards.filter(x => x !== editCard);
  await Photos.remove(editCard.id);
  await saveCards(); closeOverlay('#cardSheet'); renderComm();
};

/* ---------------- Question Oui / Non ---------------- */
const cOui = $('#cOui'), cNon = $('#cNon'), choicesEl = $('#choices');
let answered = null;
const leftEl = () => App.prof().side === 'right' ? cNon : cOui;
const rightEl = () => App.prof().side === 'right' ? cOui : cNon;

function resetAnswer(){
  answered = null;
  choicesEl.classList.remove('done');
  [cOui, cNon].forEach(c => { c.classList.remove('chosen', 'looking'); c.style.setProperty('--p', 0); });
}
function answerSound(which){
  const word = which === 'oui' ? 'Oui' : 'Non';
  const tail = App.prefs.sayWord && Comm.current ? Comm.current.label.toLowerCase() : '';
  if (App.prefs.voice && Rec.url[which]){
    const a = Sound.playBlob(Rec.url[which]);
    a.onended = () => { if (tail) Voice.say(tail); };
    a.play().catch(() => Voice.say(tail ? word + ', ' + tail + '.' : word + ' !'));
  } else {
    which === 'oui' ? Sound.yes() : Sound.no();
    setTimeout(() => Voice.say(tail ? word + ', ' + tail + '.' : word + ' !'), 380);
  }
}
function choose(which){
  resetAnswer();
  answered = which;
  choicesEl.classList.add('done');
  (which === 'oui' ? cOui : cNon).classList.add('chosen');
  if (navigator.vibrate) try{ navigator.vibrate(60); }catch(e){}
  answerSound(which);
}
const keyToAnswer = k => (k === 'L') === (App.prof().side !== 'right') ? 'oui' : 'non';
cOui.onclick = () => { if (!Calib.active()) choose('oui'); };
cNon.onclick = () => { if (!Calib.active()) choose('non'); };
$('#btnRepeat').onclick = () => { if (Comm.current) Voice.say(Comm.current.q); resetAnswer(); };

function openAsk(c){
  Comm.current = c;
  const q = $('#qText'); q.innerHTML = ''; q.appendChild(cardVisual(c));
  const s = document.createElement('span'); s.textContent = c.label + ' ?'; q.appendChild(s);
  show('ask');
}
Screens.ask = {
  enter(){
    choicesEl.classList.toggle('flip', App.prof().side === 'right');
    resetAnswer();
    if (App.prefs.sayQ && Comm.current) Voice.say(Comm.current.q);
    Gaze.attach({
      zoneAt: h => Gaze.z2(h),
      el: k => k === 'L' ? leftEl() : rightEl(),
      onSelect: k => choose(keyToAnswer(k)),
      onZone: z => { if (answered && z && keyToAnswer(z) !== answered) resetAnswer(); },
      lockMs: 3000
    });
  },
  leave(){ Gaze.detach(); }
};
