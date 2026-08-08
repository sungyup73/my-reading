const STORAGE = {
  articles: 'myreading_articles_v01',
  words: 'myreading_words_v01',
  quotes: 'myreading_quotes_v01'
};

const sampleText = `DATE: 2026-08-10
CATEGORY: Forest & Ecology
TITLE: How Forests Create Their Own Rain
DEK: The atmosphere above a forest is not just passing weather. Trees actively move water, shape clouds, and help create the conditions for rain.

ARTICLE:
When we think about rain, we usually imagine weather systems arriving from somewhere else. Moist air moves inland, clouds form, and precipitation falls. Forests seem to be passive recipients of this process. Yet research over recent decades has revealed a more dynamic relationship between trees and the atmosphere.

Trees continuously draw water from the soil and release much of it through microscopic pores in their leaves. This process, known as transpiration, transfers enormous quantities of water vapor into the air. Across a large forest, the combined effect can influence humidity, cloud formation, and even regional rainfall patterns.

The Amazon is one of the most dramatic examples. Moisture carried from the Atlantic Ocean falls as rain, is absorbed by vegetation, and then returns to the atmosphere through evapotranspiration. That recycled water can fall again farther inland. In this sense, forests help move water across continents in a series of atmospheric steps.

Scientists are still debating the exact scale and mechanisms of these effects, but the broader lesson is increasingly clear. Forests do not merely respond to climate. They help create it. Removing large areas of forest can therefore alter not only biodiversity and carbon storage, but also the movement of water itself.

VOCABULARY:
1. transpiration | 증산작용 | Trees release water vapor through transpiration.
2. precipitation | 강수 | Forest loss can influence regional precipitation patterns.
3. recycle moisture | 수분을 순환시키다 | Large forests recycle moisture through the atmosphere.
4. passive recipient | 수동적인 수용자 | Forests are not simply passive recipients of rainfall.`;

const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const load = (key, fallback=[]) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const esc = s => (s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let state = {
  view: 'home',
  currentArticleId: null,
  filter: 'All'
};

function makeId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function formatDate(date){ return new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function todayLabel(){ return new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase(); }
function readTime(text){ return Math.max(1, Math.ceil((text||'').split(/\s+/).length/220)); }

function parseArticle(raw){
  const getLine = key => (raw.match(new RegExp(`^${key}:\\s*(.+)$`,'mi'))||[])[1]?.trim() || '';
  const date = getLine('DATE');
  const category = getLine('CATEGORY');
  const title = getLine('TITLE');
  const dek = getLine('DEK');
  const articleMatch = raw.match(/ARTICLE:\s*([\s\S]*?)(?:\n\s*VOCABULARY:|$)/i);
  const vocabMatch = raw.match(/VOCABULARY:\s*([\s\S]*)$/i);
  const body = articleMatch?.[1]?.trim() || '';
  const vocabulary = (vocabMatch?.[1] || '').split(/\n+/).map(line => line.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean).map(line => {
    const [word='', meaning='', example=''] = line.split('|').map(x=>x.trim());
    return {word, meaning, example};
  }).filter(v=>v.word);
  if(!date || !category || !title || !body) throw new Error('DATE, CATEGORY, TITLE and ARTICLE are required.');
  return {id:makeId(), date, category, title, dek, body, vocabulary, read:false, createdAt:Date.now()};
}

function articles(){ return load(STORAGE.articles).sort((a,b)=> b.date.localeCompare(a.date)); }
function words(){ return load(STORAGE.words); }
function quotes(){ return load(STORAGE.quotes); }

function render(){
  $('#issueDate').textContent = todayLabel();
  $$('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.view===state.view));
  if(state.view==='article') return renderArticle();
  if(state.view==='library') return renderLibrary();
  if(state.view==='words') return renderWords();
  if(state.view==='saved') return renderSaved();
  renderHome();
}

function renderHome(){
  const list = articles();
  const lead = list[0];
  const recent = list.slice(1,4);
  $('#app').innerHTML = lead ? `
    <section class="hero">
      <div class="eyebrow">${esc(lead.category)}</div>
      <h1>${esc(lead.title)}</h1>
      ${lead.dek ? `<p class="dek">${esc(lead.dek)}</p>`:''}
      <div class="meta">${formatDate(lead.date)} · ${readTime(lead.body)} min read ${lead.read?'· Read ✓':''}</div>
      <button class="read-btn" data-open="${lead.id}">Read article</button>
    </section>
    <section class="section">
      <div class="section-head"><h2>Recent stories</h2><span>${list.length} in library</span></div>
      ${recent.map(storyRow).join('') || `<div class="empty">Your next article will appear here after you import it.</div>`}
    </section>` : `
    <section class="hero">
      <div class="eyebrow">A PRIVATE READING JOURNAL</div>
      <h1>Read slowly.<br>Keep what matters.</h1>
      <p class="dek">A quiet place for your Monday forests, Wednesday world affairs, and Friday journeys through place and history.</p>
      <button class="read-btn" id="emptyImport">Add first article</button>
    </section>
    <div class="empty">No articles yet. Tap the plus sign, paste a ChatGPT article, and your library begins.</div>`;
  bindOpeners();
  $('#emptyImport')?.addEventListener('click', openImport);
}

function storyRow(a){ return `<button class="story-row" data-open="${a.id}"><div class="story-date">${formatDate(a.date)}</div><div><div class="story-cat">${esc(a.category)}</div><div class="story-title">${esc(a.title)}</div><div class="story-status">${readTime(a.body)} min ${a.read?'· Read ✓':''}</div></div></button>`; }

function renderLibrary(){
  const list = articles();
  const cats = ['All', ...new Set(list.map(a=>a.category))];
  const filtered = state.filter==='All' ? list : list.filter(a=>a.category===state.filter);
  $('#app').innerHTML = `<div class="section-head"><h2>Library</h2><span>${list.length} stories</span></div>
    <div class="filters">${cats.map(c=>`<button class="filter ${state.filter===c?'active':''}" data-filter="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    ${filtered.map(storyRow).join('') || `<div class="empty">Nothing in this section yet.</div>`}`;
  $$('.filter').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;renderLibrary()}); bindOpeners();
}

function renderArticle(){
  const list = articles(); const a = list.find(x=>x.id===state.currentArticleId);
  if(!a){state.view='home';return render()}
  $('#app').innerHTML = `<button class="back-btn" id="backBtn">← Back</button>
    <article>
      <header class="article-header"><div class="eyebrow">${esc(a.category)}</div><h1 class="article-title">${esc(a.title)}</h1>${a.dek?`<p class="dek">${esc(a.dek)}</p>`:''}<div class="meta">${formatDate(a.date)} · ${readTime(a.body)} min read</div>
      <div class="article-tools"><button class="tool-btn" id="toggleRead">${a.read?'Mark unread':'Mark as read'}</button><button class="tool-btn" id="saveSelection">Save selected sentence</button></div>
      <div class="selection-tip">Tip: select a word in the article, then tap it again to save it. Select a sentence and use “Save selected sentence”.</div></header>
      <div class="article-body" id="articleText">${a.body.split(/\n\s*\n/).map(p=>`<p>${esc(p)}</p>`).join('')}</div>
      ${a.vocabulary?.length?`<section class="vocab-block"><div class="eyebrow">VOCABULARY & EXPRESSIONS</div>${a.vocabulary.map(v=>`<div class="vocab-item"><div class="vocab-word">${esc(v.word)}</div><div class="vocab-meaning">${esc(v.meaning)}</div><div class="vocab-example">${esc(v.example)}</div></div>`).join('')}</section>`:''}
    </article>`;
  $('#backBtn').onclick=()=>{state.view='library';render()};
  $('#toggleRead').onclick=()=>{ const all=load(STORAGE.articles); const item=all.find(x=>x.id===a.id); item.read=!item.read; save(STORAGE.articles,all); renderArticle(); };
  $('#saveSelection').onclick=()=>saveSelectedSentence(a);
  $('#articleText').addEventListener('click',()=>maybeSaveWord(a));
}

function maybeSaveWord(a){
  const text = window.getSelection().toString().trim();
  if(!text || text.split(/\s+/).length>4) return;
  $('#selectedWordTitle').textContent=text;
  $('#wordMeaning').value=''; $('#wordNote').value='';
  $('#saveWordBtn').onclick=()=>{ const all=words(); all.unshift({id:makeId(),word:text,meaning:$('#wordMeaning').value.trim(),note:$('#wordNote').value.trim(),sourceTitle:a.title,articleId:a.id,createdAt:Date.now()}); save(STORAGE.words,all); $('#wordDialog').close(); window.getSelection().removeAllRanges(); };
  $('#wordDialog').showModal();
}
function saveSelectedSentence(a){
  const text=window.getSelection().toString().trim();
  if(!text) return alert('Select a sentence first.');
  const all=quotes(); all.unshift({id:makeId(),text,sourceTitle:a.title,articleId:a.id,createdAt:Date.now()}); save(STORAGE.quotes,all); window.getSelection().removeAllRanges(); alert('Saved.');
}

function renderWords(){ const list=words(); $('#app').innerHTML=`<div class="section-head"><h2>Words</h2><span>${list.length} saved</span></div>${list.map(w=>`<article class="word-card"><h3>${esc(w.word)}</h3>${w.meaning?`<div class="meaning">${esc(w.meaning)}</div>`:''}${w.note?`<p>${esc(w.note)}</p>`:''}<div class="source">From: ${esc(w.sourceTitle)}</div><button class="delete-btn" data-del-word="${w.id}">Delete</button></article>`).join('')||`<div class="empty">Select words while reading and save them here.</div>`}`; $$('[data-del-word]').forEach(b=>b.onclick=()=>{save(STORAGE.words,words().filter(x=>x.id!==b.dataset.delWord));renderWords()}); }
function renderSaved(){ const list=quotes(); $('#app').innerHTML=`<div class="section-head"><h2>Saved sentences</h2><span>${list.length} saved</span></div>${list.map(q=>`<article class="quote-card"><blockquote>“${esc(q.text)}”</blockquote><div class="source">From: ${esc(q.sourceTitle)}</div><button class="delete-btn" data-del-quote="${q.id}">Delete</button></article>`).join('')||`<div class="empty">Save sentences that deserve a second reading.</div>`}`; $$('[data-del-quote]').forEach(b=>b.onclick=()=>{save(STORAGE.quotes,quotes().filter(x=>x.id!==b.dataset.delQuote));renderSaved()}); }

function bindOpeners(){ $$('[data-open]').forEach(b=>b.onclick=()=>{state.currentArticleId=b.dataset.open;state.view='article';render()}); }
function openImport(){ $('#articlePaste').value=''; $('#importError').textContent=''; $('#importDialog').showModal(); }
$('#openImport').onclick=openImport;
$('#loadExample').onclick=()=>$('#articlePaste').value=sampleText;
$('#importForm').addEventListener('submit',e=>{e.preventDefault();try{const a=parseArticle($('#articlePaste').value);const all=load(STORAGE.articles);all.push(a);save(STORAGE.articles,all);$('#importDialog').close();state.currentArticleId=a.id;state.view='article';render();}catch(err){$('#importError').textContent=err.message;}});
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;render()}));

if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();
