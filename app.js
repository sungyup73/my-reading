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
const esc = s => (s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[c]));

let state = {
  view: 'home',
  currentArticleId: null,
  filter: 'All'
};

function makeId(){
  return Date.now().toString(36)+Math.random().toString(36).slice(2,7);
}

function formatDate(date){
  if(!date) return 'Date not set';

  const d = new Date(date + 'T12:00:00');

  if(Number.isNaN(d.getTime())) return date;

  return d.toLocaleDateString('en-US',{
    month:'short',
    day:'numeric',
    year:'numeric'
  });
}

function todayLabel(){
  return new Date().toLocaleDateString('en-US',{
    weekday:'short',
    month:'short',
    day:'numeric'
  }).toUpperCase();
}

function readTime(text){
  return Math.max(1, Math.ceil((text||'').split(/\s+/).length/220));
}

function parseVocabSection(section=''){
  const lines = section
    .split(/\r?\n/)
    .map(x=>x.trim())
    .filter(Boolean);

  const items = [];

  // Original compact format:
  // 1. word | meaning | example
  const pipeLines = lines.filter(line => line.includes('|'));

  if(pipeLines.length){
    pipeLines.forEach(line => {
      const clean = line.replace(/^\s*\d+[.)]\s*/, '').trim();
      const [word='', meaning='', example=''] =
        clean.split('|').map(x=>x.trim());

      if(word) items.push({word, meaning, example});
    });

    return items;
  }

  // New My Reading format:
  // 1. word
  // meaning
  // example
  for(let i=0;i<lines.length;){
    const m = lines[i].match(/^\d+[.)]\s*(.+)$/);

    if(!m){
      i++;
      continue;
    }

    const word = m[1].trim();
    const meaning = lines[i+1] || '';
    const example = lines[i+2] || '';

    items.push({word, meaning, example});
    i += 3;
  }

  return items;
}

function parseWordData(section=''){
  return section
    .split(/\r?\n/)
    .map(line=>line.trim())
    .filter(Boolean)
    .map(line=>{
      const clean = line.replace(/^\s*\d+[.)]\s*/, '').trim();
      const [word='', meaning=''] =
        clean.split('|').map(x=>x.trim());

      return {word, meaning};
    })
    .filter(v=>v.word && v.meaning);
}

function parseArticle(raw){
  const getLine = key =>
    (raw.match(new RegExp(`^${key}:\\s*(.+)$`,'mi'))||[])[1]?.trim() || '';

  const date = getLine('DATE');
  const category = getLine('CATEGORY');
  const title = getLine('TITLE');
  const dek = getLine('DEK');

  const articleMatch =
    raw.match(/ARTICLE:\s*([\s\S]*?)(?:\n\s*VOCABULARY:|\n\s*WORD DATA:|$)/i);

  const vocabMatch =
    raw.match(/VOCABULARY:\s*([\s\S]*?)(?:\n\s*WORD DATA:|$)/i);

  const wordDataMatch =
    raw.match(/WORD DATA:\s*([\s\S]*)$/i);

  const body = articleMatch?.[1]?.trim() || '';
  const vocabulary = parseVocabSection(vocabMatch?.[1] || '');
  const wordData = parseWordData(wordDataMatch?.[1] || '');

  if(!date || !category || !title || !body){
    throw new Error('DATE, CATEGORY, TITLE and ARTICLE are required.');
  }

  return {
    id:makeId(),
    date,
    category,
    title,
    dek,
    body,
    vocabulary,
    wordData,
    read:false,
    createdAt:Date.now()
  };
}

// Library stays arranged by article date.
function articles(){
  return load(STORAGE.articles).sort((a,b)=>{
    const ad = a.date || '';
    const bd = b.date || '';
    return bd.localeCompare(ad);
  });
}

// Today is based on import order, not the article date.
function articlesByImport(){
  return load(STORAGE.articles)
    .map((a,index)=>({...a,__storageIndex:index}))
    .sort((a,b)=>{
      const ac = Number(a.createdAt) || 0;
      const bc = Number(b.createdAt) || 0;

      if(bc !== ac) return bc - ac;

      return b.__storageIndex - a.__storageIndex;
    });
}

function words(){
  return load(STORAGE.words);
}

function quotes(){
  return load(STORAGE.quotes);
}

function normalizeWord(s=''){
  return s
    .toLowerCase()
    .replace(/[’]/g,"'")
    .replace(/^[^a-z]+|[^a-z'-]+$/g,'')
    .trim();
}

function lookupWord(a, word){
  const target = normalizeWord(word);

  const wordData = a.wordData || [];
  const vocabulary = a.vocabulary || [];

  // 1. WORD DATA에서 먼저 찾기
  let found = wordData.find(v =>
    normalizeWord(v.word) === target
  );

  if(found && found.meaning){
    return found;
  }

  // 2. 현재 정상 형식의 VOCABULARY에서 찾기
  let index = vocabulary.findIndex(v =>
    normalizeWord(v.word) === target
  );

  // 복수형 -s 간단 처리
  if(index === -1 && target.endsWith('s')){
    const singular = target.slice(0, -1);

    index = vocabulary.findIndex(v =>
      normalizeWord(v.word) === singular
    );
  }

  if(index !== -1){
    const item = vocabulary[index];

    // 정상적으로 저장된 새 형식
    if(item.meaning){
      return item;
    }

    // 예전 버전에서
    // word / meaning / example이 각각 별도 항목으로
    // 저장된 경우 자동 복구
    const nextMeaning = vocabulary[index + 1]?.word || '';
    const nextExample = vocabulary[index + 2]?.word || '';

    return {
      word: item.word,
      meaning: nextMeaning,
      example: nextExample
    };
  }

  // 3. WORD DATA에서도 복수형 검색
  if(target.endsWith('s')){
    const singular = target.slice(0, -1);

    found = wordData.find(v =>
      normalizeWord(v.word) === singular
    );

    if(found){
      return found;
    }
  }

  return null;
}

function sentenceForWord(body, word){
  const clean = normalizeWord(word);

  const sentences =
    (body || '')
      .replace(/\s+/g,' ')
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];

  const hit = sentences.find(s =>
    normalizeWord(s)
      .split(/\s+/)
      .some(t=>t===clean)
  );

  return (hit || '').trim();
}

function renderInteractiveParagraph(text){
  return esc(text).replace(
    /\b([A-Za-z][A-Za-z'’-]*)\b/g,
    '<span class="tap-word" data-word="$1">$1</span>'
  );
}

function render(){
  $('#issueDate').textContent = todayLabel();

  $$('.nav-item').forEach(b=>
    b.classList.toggle('active', b.dataset.view===state.view)
  );

  if(state.view==='article') return renderArticle();
  if(state.view==='library') return renderLibrary();
  if(state.view==='words') return renderWords();
  if(state.view==='saved') return renderSaved();

  renderHome();
}

function renderHome(){
  const list = articlesByImport();
  const lead = list[0];
  const recent = list.slice(1,4);

  $('#app').innerHTML = lead ? `
    <section class="hero">
      <div class="eyebrow">${esc(lead.category)}</div>

      <h1>${esc(lead.title)}</h1>

      ${lead.dek
        ? `<p class="dek">${esc(lead.dek)}</p>`
        : ''
      }

      <div class="meta">
        ${formatDate(lead.date)} ·
        ${readTime(lead.body)} min read
        ${lead.read ? '· Read ✓' : ''}
      </div>

      <button class="read-btn" data-open="${lead.id}">
        Read article
      </button>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Recent stories</h2>
        <span>${list.length} in library</span>
      </div>

      ${recent.map(storyRow).join('') ||
        `<div class="empty">
          Your next article will appear here after you import it.
        </div>`
      }
    </section>
  ` : `
    <section class="hero">
      <div class="eyebrow">A PRIVATE READING JOURNAL</div>

      <h1>
        Read slowly.<br>
        Keep what matters.
      </h1>

      <p class="dek">
        A quiet place for your Monday forests,
        Wednesday world affairs,
        and Friday journeys through place and history.
      </p>

      <button class="read-btn" id="emptyImport">
        Add first article
      </button>
    </section>

    <div class="empty">
      No articles yet. Tap the plus sign,
      paste a ChatGPT article,
      and your library begins.
    </div>
  `;

  bindOpeners();

  $('#emptyImport')?.addEventListener('click', openImport);
}

function storyRow(a){
  return `
    <button class="story-row" data-open="${a.id}">
      <div class="story-date">
        ${formatDate(a.date)}
      </div>

      <div>
        <div class="story-cat">
          ${esc(a.category)}
        </div>

        <div class="story-title">
          ${esc(a.title)}
        </div>

        <div class="story-status">
          ${readTime(a.body)} min
          ${a.read ? '· Read ✓' : ''}
        </div>
      </div>
    </button>
  `;
}

function renderLibrary(){
  const list = articles();
  const cats = ['All', ...new Set(list.map(a=>a.category))];

  const filtered =
    state.filter==='All'
      ? list
      : list.filter(a=>a.category===state.filter);

  $('#app').innerHTML = `
    <div class="section-head">
      <h2>Library</h2>
      <span>${list.length} stories</span>
    </div>

    <div class="filters">
      ${cats.map(c=>`
        <button
          class="filter ${state.filter===c?'active':''}"
          data-filter="${esc(c)}">
          ${esc(c)}
        </button>
      `).join('')}
    </div>

    ${filtered.map(storyRow).join('') ||
      `<div class="empty">
        Nothing in this section yet.
      </div>`
    }
  `;

  $$('.filter').forEach(b=>{
    b.onclick=()=>{
      state.filter=b.dataset.filter;
      renderLibrary();
    };
  });

  bindOpeners();
}

function renderArticle(){
  const list = articles();
  const a = list.find(x=>x.id===state.currentArticleId);

  if(!a){
    state.view='home';
    return render();
  }

  $('#app').innerHTML = `
    <button class="back-btn" id="backBtn">
      ← Back
    </button>

    <article>
      <header class="article-header">

        <div class="eyebrow">
          ${esc(a.category)}
        </div>

        <h1 class="article-title">
          ${esc(a.title)}
        </h1>

        ${a.dek
          ? `<p class="dek">${esc(a.dek)}</p>`
          : ''
        }

        <div class="meta">
          ${formatDate(a.date)} ·
          ${readTime(a.body)} min read
        </div>

        <div class="article-tools">

          <button class="tool-btn" id="toggleRead">
            ${a.read ? 'Mark unread' : 'Mark as read'}
          </button>

          <button class="tool-btn" id="saveSelection">
            Save selected sentence
          </button>

        </div>

        <div class="selection-tip">
          Tip: tap a word to check its meaning and example.
          Save it only when you want to keep it.
          Select a sentence and use “Save selected sentence”.
        </div>

      </header>

      <div class="article-body" id="articleText">
        ${a.body
          .split(/\n\s*\n/)
          .map(p=>`<p>${renderInteractiveParagraph(p)}</p>`)
          .join('')
        }
      </div>

      ${a.vocabulary?.length
        ? `
          <section class="vocab-block">

            <div class="eyebrow">
              VOCABULARY & EXPRESSIONS
            </div>

            ${a.vocabulary.map(v=>`
              <div class="vocab-item">

                <div class="vocab-word">
                  ${esc(v.word)}
                </div>

                <div class="vocab-meaning">
                  ${esc(v.meaning)}
                </div>

                <div class="vocab-example">
                  ${esc(v.example)}
                </div>

              </div>
            `).join('')}

          </section>
        `
        : ''
      }

    </article>
  `;

  $('#backBtn').onclick=()=>{
    state.view='library';
    render();
  };

  $('#toggleRead').onclick=()=>{
    const all=load(STORAGE.articles);
    const item=all.find(x=>x.id===a.id);

    item.read=!item.read;

    save(STORAGE.articles,all);
    renderArticle();
  };

  $('#saveSelection').onclick=()=>saveSelectedSentence(a);

  // Desktop mouse click and mobile tap both work
  // through event delegation.
  $('#articleText').addEventListener('click',(e)=>{
    const wordEl = e.target.closest('.tap-word');

    if(!wordEl) return;

    openWordCard(a, wordEl.dataset.word);
  });
}

function openWordCard(a, text){
  if(!text) return;

  const hit = lookupWord(a, text);
  const contextSentence = sentenceForWord(a.body, text);

  const meaning = hit?.meaning || '';
  const example =
    contextSentence ||
    hit?.example ||
    '';

  $('#selectedWordTitle').textContent = text;

  $('#wordMeaning').value = meaning;

  $('#wordMeaning').placeholder =
    meaning
      ? ''
      : 'Meaning not included in this article';

  $('#wordNote').value = example;

  $('#wordNote').placeholder =
    'Example from the article';

  $('#saveWordBtn').onclick=()=>{
    const all = words();
    const normalized = normalizeWord(text);

    // Avoid accidental duplicates from repeated taps.
    const existing = all.find(w=>
      normalizeWord(w.word)===normalized &&
      w.articleId===a.id
    );

    if(existing){
      existing.meaning =
        $('#wordMeaning').value.trim();

      existing.note =
        $('#wordNote').value.trim();

      existing.createdAt =
        Date.now();

    } else {

      all.unshift({
        id:makeId(),
        word:text,
        meaning:$('#wordMeaning').value.trim(),
        note:$('#wordNote').value.trim(),
        sourceTitle:a.title,
        articleId:a.id,
        createdAt:Date.now()
      });

    }

    save(STORAGE.words,all);

    $('#wordDialog').close();

    window.getSelection()?.removeAllRanges();
  };

  $('#wordDialog').showModal();
}

function saveSelectedSentence(a){
  const text =
    window.getSelection().toString().trim();

  if(!text){
    return alert('Select a sentence first.');
  }

  const all=quotes();

  all.unshift({
    id:makeId(),
    text,
    sourceTitle:a.title,
    articleId:a.id,
    createdAt:Date.now()
  });

  save(STORAGE.quotes,all);

  window.getSelection().removeAllRanges();

  alert('Saved.');
}

function renderWords(){
  const list=words();

  $('#app').innerHTML=`
    <div class="section-head">
      <h2>Words</h2>
      <span>${list.length} saved</span>
    </div>

    ${list.map(w=>`
      <article class="word-card">

        <h3>${esc(w.word)}</h3>

        ${w.meaning
          ? `<div class="meaning">${esc(w.meaning)}</div>`
          : ''
        }

        ${w.note
          ? `<p>${esc(w.note)}</p>`
          : ''
        }

        <div class="source">
          From: ${esc(w.sourceTitle)}
        </div>

        <button
          class="delete-btn"
          data-del-word="${w.id}">
          Delete
        </button>

      </article>
    `).join('') ||
      `<div class="empty">
        Select words while reading and save them here.
      </div>`
    }
  `;

  $$('[data-del-word]').forEach(b=>{
    b.onclick=()=>{
      save(
        STORAGE.words,
        words().filter(x=>x.id!==b.dataset.delWord)
      );

      renderWords();
    };
  });
}

function renderSaved(){
  const list=quotes();

  $('#app').innerHTML=`
    <div class="section-head">
      <h2>Saved sentences</h2>
      <span>${list.length} saved</span>
    </div>

    ${list.map(q=>`
      <article class="quote-card">

        <blockquote>
          “${esc(q.text)}”
        </blockquote>

        <div class="source">
          From: ${esc(q.sourceTitle)}
        </div>

        <button
          class="delete-btn"
          data-del-quote="${q.id}">
          Delete
        </button>

      </article>
    `).join('') ||
      `<div class="empty">
        Save sentences that deserve a second reading.
      </div>`
    }
  `;

  $$('[data-del-quote]').forEach(b=>{
    b.onclick=()=>{
      save(
        STORAGE.quotes,
        quotes().filter(x=>x.id!==b.dataset.delQuote)
      );

      renderSaved();
    };
  });
}

function bindOpeners(){
  $$('[data-open]').forEach(b=>{
    b.onclick=()=>{
      state.currentArticleId=b.dataset.open;
      state.view='article';
      render();
    };
  });
}

function openImport(){
  $('#articlePaste').value='';
  $('#importError').textContent='';
  $('#importDialog').showModal();
}

$('#openImport').onclick=openImport;

$('#loadExample').onclick=()=>{
  $('#articlePaste').value=sampleText;
};

$('#importForm').addEventListener('submit',e=>{
  e.preventDefault();

  try{
    const a=parseArticle(
      $('#articlePaste').value
    );

    const all=load(STORAGE.articles);

    all.push(a);

    save(STORAGE.articles,all);

    $('#importDialog').close();

    state.currentArticleId=a.id;
    state.view='article';

    render();

  }catch(err){
    $('#importError').textContent=err.message;
  }
});

$$('[data-view]').forEach(b=>
  b.addEventListener('click',()=>{
    state.view=b.dataset.view;
    render();
  })
);

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>
    navigator.serviceWorker
      .register('./sw.js')
      .catch(()=>{})
  );
}

render();
