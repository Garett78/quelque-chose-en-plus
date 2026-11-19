/* Apprentissage : couleurs, formes, objets, fruits et légumes, vêtements.
   Mode Découverte (une image, la voix la nomme) et mode Exercice (2 ou 3 images, « Regarde la cuillère »). */
'use strict';
const SHAPE_COLOR = '#1f4fd1';
const CATS = [
  {id:'couleurs', name:'Les couleurs', kind:'color', items:[
    {id:'rouge', label:'rouge', art:'le', color:'#e3262b'},
    {id:'vert', label:'vert', art:'le', color:'#1f9d3a'},
    {id:'jaune', label:'jaune', art:'le', color:'#f7d117'},
    {id:'bleu', label:'bleu', art:'le', color:'#1f5fd1'}]},
  {id:'formes', name:'Les formes', kind:'shape', items:[
    {id:'rond', label:'rond', art:'le', shape:'circle'},
    {id:'carre', label:'carré', art:'le', shape:'square'},
    {id:'triangle', label:'triangle', art:'le', shape:'triangle'}]},
  {id:'objets', name:'Les objets du quotidien', kind:'photo', items:[], hint:'cuillère, fourchette, couteau, table, brosse à dents…'},
  {id:'fruits', name:'Les fruits et légumes', kind:'photo', items:[], hint:'pomme, banane, carotte, tomate…'},
  {id:'vetf', name:'Les vêtements des filles', kind:'photo', items:[], hint:'robe, jupe, collant, chaussures…'},
  {id:'vetg', name:'Les vêtements des garçons', kind:'photo', items:[], hint:'pantalon, pull, casquette, baskets…'}
];
const Learn = {items: {}, cat: null, modes: {}, disc: 0, round: null, busyUntil: 0, nextTimer: null};

async function loadLearn(){
  for (const c of CATS){
    const it = await Store.get('learn:' + c.id, null);
    Learn.items[c.id] = it || c.items.map(x => ({...x}));
    for (const x of Learn.items[c.id]) if (x.photo) await Photos.load(x.id);
  }
}
const saveItems = id => Store.set('learn:' + id, Learn.items[id]);
const catById = id => CATS.find(c => c.id === id);

/* ---------------- Phrases ---------------- */
const named = it => (it.art === "l'" ? "l'" : (it.art || 'le') + ' ') + it.label;
const isPlural = it => it.art === 'les';
const sayPrompt = it => 'Regarde ' + named(it);
const sayBravo = it => 'Bravo ! ' + (isPlural(it) ? 'Ce sont ' : 'C’est ') + named(it);
const sayShow = it => (isPlural(it) ? 'Regarde, ce sont ' : 'Regarde, c’est ') + named(it);
const sayName = it => (isPlural(it) ? 'Ce sont ' : 'C’est ') + named(it);

/* ---------------- Image d'un élément ---------------- */
function shapeSVG(shape){
  const f = SHAPE_COLOR;
  const inner = shape === 'circle' ? `<circle cx="50" cy="50" r="40" fill="${f}"/>`
    : shape === 'square' ? `<rect x="12" y="12" width="76" height="76" fill="${f}"/>`
    : `<polygon points="50,8 93,88 7,88" fill="${f}"/>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${inner}</svg>`;
}
function itemVisual(it){
  const src = it.photo ? Photos.url(it.id) : null;
  if (src){ const i = document.createElement('img'); i.className = 'pic'; i.alt = ''; i.src = src; return i; }
  const d = document.createElement('div');
  if (it.color){ d.className = 'swatch'; d.style.background = it.color; return d; }
  if (it.shape){ d.className = 'shapeBox'; d.innerHTML = shapeSVG(it.shape); return d; }
  d.className = 'ico'; d.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${ICONS.parler}</svg>`; return d;
}

/* ---------------- Menu Apprentissage ---------------- */
function renderLearnTiles(){
  const t = $('#learnTiles'); t.innerHTML = '';
  for (const c of CATS){
    const items = Learn.items[c.id];
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tile';
    const art = document.createElement('span'); art.className = 'tileArt learnArt';
    const shown = items.slice(0, c.kind === 'color' ? 4 : 3);
    if (shown.length) shown.forEach(it => art.appendChild(itemVisual(it)));
    else art.innerHTML = '<span class="emptyArt">+</span>';
    b.appendChild(art);
    const s = document.createElement('strong'); s.textContent = c.name; b.appendChild(s);
    const sm = document.createElement('small');
    sm.textContent = items.length ? items.length + (items.length > 1 ? ' images' : ' image') : 'Aucune image pour l’instant : ajoute tes photos';
    b.appendChild(sm);
    b.onclick = () => { Learn.cat = c; show('exo'); };
    t.appendChild(b);
  }
}
Screens.learn = {enter: renderLearnTiles};

/* ---------------- Écran d'exercice ---------------- */
const curItems = () => Learn.items[Learn.cat.id];
function modeOf(){
  const m = Learn.modes[Learn.cat.id];
  if (m) return m;
  return curItems().length >= 2 ? 'quiz' : 'disc';
}
function setMode(m){ Learn.modes[Learn.cat.id] = m; startExo(); }
$('#exoDisc').addEventListener('input', () => setMode('disc'));
$('#exoQuiz').addEventListener('input', () => setMode('quiz'));
$('#btnExoImages').onclick = () => show('exoLib');
$('#btnExoRepeat').onclick = () => {
  if (modeOf() === 'quiz' && Learn.round) Voice.say(sayPrompt(Learn.round.target));
  else if (modeOf() === 'disc' && curItems().length) Voice.say(sayName(curItems()[Learn.disc % curItems().length]));
};
$('#discPrev').onclick = () => { Learn.disc = (Learn.disc - 1 + curItems().length) % curItems().length; renderDisc(); };
$('#discNext').onclick = () => { Learn.disc = (Learn.disc + 1) % curItems().length; renderDisc(); };

function emptyState(need){
  const c = Learn.cat;
  const a = $('#exoArea'); a.innerHTML = '';
  const box = document.createElement('div'); box.className = 'emptyState';
  const p = document.createElement('p');
  p.textContent = need === 1
    ? 'Il n’y a pas encore d’image dans cet exercice. Ajoute tes photos avec le bouton +.'
    : 'Il faut au moins 2 images pour faire l’exercice. Ajoute des photos avec le bouton +, ou utilise le mode Découverte.';
  box.appendChild(p);
  if (c.hint){ const s = document.createElement('small'); s.textContent = 'Par exemple : ' + c.hint; box.appendChild(s); }
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn primary big'; b.textContent = '+ Ajouter une image';
  b.onclick = () => openItem(null);
  box.appendChild(b);
  a.appendChild(box);
  $('#discNav').hidden = true;
}

function exoCard(it, i){
  const b = document.createElement('button'); b.type = 'button'; b.className = 'exoCard';
  b.dataset.i = i;
  b.innerHTML = '<span class="halo"></span>';
  const v = document.createElement('span'); v.className = 'vis'; v.appendChild(itemVisual(it)); b.appendChild(v);
  const l = document.createElement('span'); l.className = 'lbl'; l.textContent = it.label; b.appendChild(l);
  return b;
}

function startExo(){
  clearTimeout(Learn.nextTimer);
  Learn.round = null;
  const m = modeOf();
  $('#exoDisc').checked = m === 'disc'; $('#exoQuiz').checked = m === 'quiz';
  $('#exoTitle').textContent = Learn.cat.name;
  if (m === 'disc') renderDisc(); else newRound();
}

/* Mode Découverte : une grande image, la voix la nomme quand le jeune la regarde. */
function renderDisc(){
  const items = curItems();
  if (!items.length){ emptyState(1); Gaze.attach(idleConsumer()); return; }
  Learn.disc = Learn.disc % items.length;
  const it = items[Learn.disc];
  const a = $('#exoArea'); a.innerHTML = '';
  const row = document.createElement('div'); row.className = 'exoChoices one';
  const card = exoCard(it, 0); card.onclick = () => { if (!Calib.active()) nameIt(); };
  row.appendChild(card); a.appendChild(row);
  $('#discNav').hidden = items.length < 2;
  setTimeout(() => Voice.say(sayName(it)), 250);
  Gaze.attach({
    zoneAt: h => Math.abs(h - 0.5) < 0.35 ? 'C' : null,
    el: () => card,
    onSelect: nameIt,
    lockMs: 2500
  });
  function nameIt(){
    card.classList.remove('correct'); void card.offsetWidth; card.classList.add('correct');
    Sound.sparkle(); setTimeout(() => Voice.say(sayName(it)), 250);
  }
}

/* Mode Exercice : « Regarde la cuillère » avec 2 ou 3 images. */
function newRound(){
  clearTimeout(Learn.nextTimer);
  const items = curItems();
  if (items.length < 2){ emptyState(2); Gaze.attach(idleConsumer()); return; }
  const n = Math.min(App.prof().nch === 3 ? 3 : 2, items.length);
  const prev = Learn.round && Learn.round.target;
  const pool = items.length > 2 && prev ? items.filter(x => x !== prev) : items;
  const target = pool[Math.floor(Math.random() * pool.length)];
  const others = shuffle(items.filter(x => x !== target)).slice(0, n - 1);
  const opts = shuffle([target, ...others]);
  Learn.round = {target, opts, done: false};
  $('#discNav').hidden = true;
  const a = $('#exoArea'); a.innerHTML = '';
  const row = document.createElement('div'); row.className = 'exoChoices' + (n === 3 ? ' three' : '');
  opts.forEach((it, i) => { const c = exoCard(it, i); c.onclick = () => { if (!Calib.active()) answer(i); }; row.appendChild(c); });
  a.appendChild(row);
  setTimeout(() => Voice.say(sayPrompt(target)), 300);
  const keys = n === 3 ? {L:0, C:1, R:2} : {L:0, R:1};
  Gaze.attach({
    zoneAt: h => { const z = n === 3 ? Gaze.z3(h) : Gaze.z2(h); return z && keys[z] !== undefined ? z : null; },
    el: k => row.children[keys[k]],
    onSelect: k => answer(keys[k]),
    paused: () => !Learn.round || Learn.round.done,
    lockMs: 800
  });
}
function answer(i){
  const r = Learn.round; if (!r || r.done) return;
  r.done = true;
  const row = $('#exoArea .exoChoices'); const cards = Array.from(row.children);
  const ok = r.opts[i] === r.target;
  if (ok){
    cards[i].classList.add('correct'); row.classList.add('solved');
    Sound.bravo(); setTimeout(() => Voice.say(sayBravo(r.target)), 450);
    if (navigator.vibrate) try{ navigator.vibrate(60); }catch(e){}
    Learn.nextTimer = setTimeout(newRound, 3200);
  } else {
    cards[i].classList.add('wrong');
    const ti = r.opts.indexOf(r.target); cards[ti].classList.add('reveal');
    Sound.soft(); setTimeout(() => Voice.say(sayShow(r.target)), 300);
    Learn.nextTimer = setTimeout(newRound, 3800);
  }
}
const idleConsumer = () => ({zoneAt: () => null, onSelect(){}});
Screens.exo = {
  enter(){ startExo(); },
  leave(){ clearTimeout(Learn.nextTimer); Gaze.detach(); }
};

/* ---------------- Images d'un exercice ---------------- */
function renderExoLib(){
  $('#exoLibTitle').textContent = Learn.cat.name;
  const g = $('#exoGrid'); g.innerHTML = '';
  for (const it of curItems()){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card';
    b.appendChild(itemVisual(it));
    const s = document.createElement('span'); s.textContent = it.label; b.appendChild(s);
    b.onclick = () => openItem(it);
    g.appendChild(b);
  }
  const a = document.createElement('button'); a.type = 'button'; a.className = 'card add';
  a.innerHTML = `<span class="plus">+</span><span>${Learn.cat.kind === 'color' ? 'Ajouter une couleur' : 'Ajouter une photo'}</span>`;
  a.onclick = () => openItem(null);
  g.appendChild(a);
}
Screens.exoLib = {enter: renderExoLib};

/* ---------------- Ajouter / modifier une image d'exercice ---------------- */
let editItem = null, pendingItemPhoto = null;
const isColorCat = () => Learn.cat.kind === 'color';
const artValue = () => (document.querySelector('input[name="art"]:checked') || {}).value || 'le';
function itemPreview(){
  const p = $('#itemPreview'); p.innerHTML = '';
  if (pendingItemPhoto){ const i = document.createElement('img'); i.className = 'pic'; i.alt = ''; i.src = URL.createObjectURL(pendingItemPhoto); p.appendChild(i); }
  else if (isColorCat()){ const d = document.createElement('div'); d.className = 'swatch'; d.style.background = $('#iColor').value; p.appendChild(d); }
  else p.appendChild(itemVisual(editItem || {}));
  const lbl = $('#iLabel').value.trim();
  $('#artPreview').classList.remove('err');
  $('#artPreview').textContent = lbl ? 'La voix dira : « ' + sayPrompt({label: lbl, art: artValue()}) + ' »' : '';
}
function openItem(it){
  editItem = it; pendingItemPhoto = null;
  $('#itemTitle').textContent = it ? 'Modifier « ' + it.label + ' »' : (isColorCat() ? 'Nouvelle couleur' : 'Nouvelle photo');
  $('#iLabel').value = it ? it.label : '';
  $('#iLabel').placeholder = isColorCat() ? 'Ex. : orange' : Learn.cat.id === 'fruits' ? 'Ex. : pomme' : Learn.cat.id.startsWith('vet') ? 'Ex. : pantalon' : 'Ex. : cuillère';
  const art = it ? it.art : (isColorCat() || Learn.cat.kind === 'shape' ? 'le' : 'la');
  document.querySelectorAll('input[name="art"]').forEach(r => { r.checked = r.value === art; });
  $('#itemColorBox').hidden = !isColorCat(); $('#itemPhotoBtns').hidden = isColorCat();
  if (isColorCat()) $('#iColor').value = it && it.color ? it.color : '#ff7f00';
  $('#itemDelete').hidden = !it; $('#itemConfirm').hidden = true;
  itemPreview(); openOverlay('#itemSheet');
}
['#iLabel', '#iColor'].forEach(s => $(s).addEventListener('input', itemPreview));
document.querySelectorAll('input[name="art"]').forEach(r => r.addEventListener('input', itemPreview));
$('#itemSheet').addEventListener('click', async e => {
  const b = e.target.closest('[data-photo]'); if (!b) return;
  const blob = await pickPhoto(b.dataset.photo === 'cam');
  if (blob){ pendingItemPhoto = blob; itemPreview(); }
});
$('#itemForm').addEventListener('submit', async e => {
  e.preventDefault();
  const label = $('#iLabel').value.trim(); if (!label) return;
  if (!editItem && !isColorCat() && !pendingItemPhoto){
    $('#artPreview').textContent = 'Ajoute d’abord une photo avec les boutons ci-dessus.'; $('#artPreview').classList.add('err'); return;
  }
  let it = editItem;
  if (!it){ it = {id: uid('i')}; curItems().push(it); }
  it.label = label; it.art = artValue();
  if (isColorCat()) it.color = $('#iColor').value;
  if (pendingItemPhoto){ await Photos.save(it.id, pendingItemPhoto); it.photo = true; }
  await saveItems(Learn.cat.id); closeOverlay('#itemSheet');
  if (curScreen === 'exoLib') renderExoLib(); else startExo();
});
$('#itemDelete').onclick = () => { $('#itemConfirm').hidden = false; };
$('#itemDeleteNo').onclick = () => { $('#itemConfirm').hidden = true; };
$('#itemDeleteYes').onclick = async () => {
  Learn.items[Learn.cat.id] = curItems().filter(x => x !== editItem);
  if (editItem.photo) await Photos.remove(editItem.id);
  await saveItems(Learn.cat.id); closeOverlay('#itemSheet'); renderExoLib();
};
