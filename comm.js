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
  {id:'musique', label:'Musique', q:'Tu veux écouter de la musique ?', icon:'musique'},
  {id:'b_dents', label:'Se brosser les dents', q:'Tu veux te brosser les dents ?', img:'images/learn/besoins/se-brosser-les-dents.jpg', group:'besoins'},
  {id:'b_laver', label:'Se laver', q:'Tu veux te laver ?', img:'images/learn/besoins/se-laver.jpg', group:'besoins'},
  {id:'b_soins', label:'Soins', q:'Tu as besoin de soins ?', img:'images/learn/besoins/soins.jpg', group:'besoins'},
  {id:'a_dormir', label:'Dormir', q:'Tu veux dormir ?', img:'images/learn/actions/dormir.jpg', group:'actions'},
  {id:'a_jouer', label:'Jouer', q:'Tu veux jouer ?', img:'images/learn/actions/jouer.jpg', group:'actions'},
  {id:'a_mains', label:'Se laver les mains', q:'Tu veux te laver les mains ?', img:'images/learn/actions/se-laver-les-mains.jpg', group:'actions'},
  {id:'a_habiller', label:'S’habiller', q:'Tu veux t’habiller ?', img:'images/learn/actions/s-habiller.jpg', group:'actions'},
  {id:'e_calme', label:'Calme', q:'Tu es calme ?', img:'images/learn/emotions/calme.jpg', group:'emotions'},
  {id:'e_joie', label:'Joie', q:'Tu es de bonne humeur ?', img:'images/learn/emotions/joie.jpg', group:'emotions'},
  {id:'e_tristesse', label:'Tristesse', q:'Tu es triste ?', img:'images/learn/emotions/tristesse.jpg', group:'emotions'},
  {id:'e_colere', label:'Colère', q:'Tu es en colère ?', img:'images/learn/emotions/colere.jpg', group:'emotions'},
  {id:'e_peur', label:'Peur', q:'Tu as peur ?', img:'images/learn/emotions/peur.jpg', group:'emotions'},
  {id:'e_fatigue', label:'Fatigue', q:'Tu es fatigué ?', img:'images/learn/emotions/fatigue.jpg', group:'emotions'},
  {id:'e_surprise', label:'Surprise', q:'Tu es étonné ?', img:'images/learn/emotions/surprise.jpg', group:'emotions'}
];
const BASE_IDS = ['toilettes', 'boire', 'manger', 'repos', 'change', 'cour', 'musique'];
const GROUPS = [
  {id:'besoins', name:'Besoins et envies'},
  {id:'actions', name:'Actions'},
  {id:'emotions', name:'Émotions'},
  {id:'autres', name:'Ajoutées par toi'}
];
const groupOf = c => c.group || (BASE_IDS.includes(c.id) ? 'besoins' : 'autres');
const Comm = {cards: [], editing: false, current: null};

async function loadComm(){
  const stored = await Store.get('cards', null);
  Comm.cards = stored || DEFAULT_CARDS.map(c => ({...c}));
  /* Nouvelles questions (besoins, actions, émotions) ajoutées aux listes déjà enregistrées, sans rien effacer. */
  if (stored && (await Store.get('cardsVersion', 1)) < 2){
    for (const d of DEFAULT_CARDS) if (!Comm.cards.some(c => c.id === d.id)) Comm.cards.push({...d});
  }
  await Store.set('cardsVersion', 2); saveCards();
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
  for (const grp of GROUPS){
    const cards = Comm.cards.filter(c => groupOf(c) === grp.id);
    if (!cards.length && grp.id !== 'autres') continue;
    const h = document.createElement('h3'); h.className = 'grpTitle'; h.textContent = grp.name; g.appendChild(h);
    const box = document.createElement('div'); box.className = 'grpGrid'; g.appendChild(box);
    for (const c of cards){
      const b = document.createElement('button'); b.type = 'button'; b.className = 'card';
      b.appendChild(cardVisual(c));
      const s = document.createElement('span'); s.textContent = c.label; b.appendChild(s);
      if (Comm.editing){ const p = document.createElement('span'); p.className = 'pen'; p.textContent = 'Modifier'; b.appendChild(p); }
      b.onclick = () => Comm.editing ? openCard(c) : openAsk(c);
      box.appendChild(b);
    }
    if (grp.id === 'autres'){
      const a = document.createElement('button'); a.type = 'button'; a.className = 'card add';
      a.innerHTML = '<span class="plus">+</span><span>Ajouter une image</span>';
      a.onclick = () => openCard(null);
      box.appendChild(a);
    }
  }
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
