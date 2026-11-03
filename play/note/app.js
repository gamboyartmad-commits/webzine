// ---------- ᄆᆞ음 고라보게: 질문 다섯 개 → 제주어 한 장 ----------
// 쓰는 도구: translate.js · jeju-dict.js(엽서 사이트와 같은 파일) + jeju-extra.js(테스트용 보정)
// 측정: track.js의 hyTrack. 이벤트 이름은 pc_note_ 로 시작하고, 사람이 쓴 글은 담지 않음

const CFG = window.POSTCARD_CONFIG || {};
const POOL = window.NOTE_QUESTIONS || {};
const MAXLEN = 70;
const MAXLINES = 4;
const DRAFT_KEY = 'hy-note-draft-v2';
const POSTS_KEY = 'hy-note-posts-v2';
const BAD_WORD_MESSAGE = '고운 말로 써 주세요. 욕설이나 야한 말, 남을 깎아내리는 말은 남길 수 없어요.';

const QUESTIONS = (() => {
  const fromUrl = (new URLSearchParams(location.search).get('q') || '').split(',').map((s) => s.trim());
  const ids = fromUrl.filter((id) => POOL[id]).length ? fromUrl.filter((id) => POOL[id]) : window.NOTE_PICK;
  return ids.filter((id) => POOL[id]).slice(0, 5).map((id) => ({ id, ...POOL[id] }));
})();
const LAST = QUESTIONS.length - 1;

const $ = (id) => document.getElementById(id);
const root = $('write');
const ta = $('ta');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileQuery = window.matchMedia('(max-width: 979px)');
const track = (name, params) => { try { if (window.hyTrack) window.hyTrack(name, params || {}); } catch (e) { /* 측정 실패는 무시 */ } };

const ICON_RIGHT = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5"/></svg>';
const ICON_LEFT = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg>';

const S = {
  q: 0,
  answers: {},        // 질문 번호 → { text: 쓰는 중인 글, saved: 남긴 표준어, jeju: 바꾼 제주어 }
  showStd: false,     // 질문 화면에서 표준어로 보는 중
  tab: 'm',
  sheet: false,
  mobile: false,
  startedAt: Date.now(),
  name: '',
  art: 0,
  design: 0,
  finStd: false,      // 끝 화면에서 표준어로 보는 중
  screen: 'write',
  postedKey: '',      // 같은 한 장을 두 번 붙이지 않게
};

const answerOf = (i) => {
  const { id } = QUESTIONS[i];
  if (!S.answers[id]) S.answers[id] = { text: '', saved: '', jeju: '' };
  return S.answers[id];
};
const cur = () => answerOf(S.q);
const isSaved = (i = S.q) => {
  const a = answerOf(i);
  return !!a.saved && a.saved === a.text.trim();
};
const allSaved = () => QUESTIONS.every((_, i) => isSaved(i));

// ---------- 쓰던 글 보관 ----------

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers: S.answers, q: S.q, name: S.name, art: S.art, design: S.design }));
  } catch (e) { /* 사생활 보호 모드 등에서는 보관하지 않음 */ }
}

function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!d) return;
    S.answers = d.answers || {};
    S.q = Math.max(0, Math.min(LAST, d.q || 0));
    S.name = String(d.name || '').slice(0, 12);
    S.art = ARTS[d.art] ? d.art : 0;
    S.design = DESIGNS[d.design] ? d.design : 0;
  } catch (e) { /* 보관한 글 없음 */ }
}

// ---------- 손으로 그은 선 ----------
// 씨앗값이 같으면 같은 모양. 질문마다 선이 조금씩 달라짐

function randomFrom(seed) {
  let s = (seed * 2654435761) % 4294967296;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function smooth(points, closed) {
  const f = (v) => v.toFixed(1);
  const n = points.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = closed ? mid(points[n - 1], points[0]) : points[0];
  let d = `M${f(start[0])} ${f(start[1])}`;
  const end = closed ? n : n - 1;
  for (let i = closed ? 0 : 1; i < end; i++) {
    const m = mid(points[i], points[(i + 1) % n]);
    d += `Q${f(points[i][0])} ${f(points[i][1])} ${f(m[0])} ${f(m[1])}`;
  }
  if (!closed) d += `L${f(points[n - 1][0])} ${f(points[n - 1][1])}`;
  return d + (closed ? 'Z' : '');
}

function shakyLine(x0, y0, x1, y1, seed, amp = 0.45, step = 18) {
  const rand = randomFrom(seed);
  const len = Math.hypot(x1 - x0, y1 - y0);
  const count = Math.max(2, Math.round(len / step));
  const nx = -(y1 - y0) / (len || 1);
  const ny = (x1 - x0) / (len || 1);
  const points = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const o = (rand() - 0.5) * 2 * amp;
    points.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]);
  }
  return points;
}

function shakyBox(w, h, seed) {
  const m = 1.5;
  const sides = [[m, m, w - m, m], [w - m, m, w - m, h - m], [w - m, h - m, m, h - m], [m, h - m, m, m]];
  const points = [];
  sides.forEach((s, i) => points.push(...shakyLine(s[0], s[1], s[2], s[3], seed + i * 7, 0.55, 20).slice(0, -1)));
  return smooth(points, true);
}

function drawFrames() {
  const card = $('card');
  const w = card.offsetWidth;
  const h = card.offsetHeight;
  if (!w || !h) return;
  const box = card.querySelector('.nt-box');
  box.setAttribute('viewBox', `0 0 ${w} ${h}`);
  box.firstElementChild.setAttribute('d', shakyBox(w, h, 11 + S.q * 3));

  const mine = $('mine');
  const lw = mine.offsetWidth;
  const lh = parseFloat(getComputedStyle(root).getPropertyValue('--lh')) || 44;
  if (!lw) return;
  const rows = Math.max(1, Math.round(mine.offsetHeight / lh));
  const lines = mine.querySelector('.nt-lines');
  lines.setAttribute('viewBox', `0 0 ${lw} ${rows * lh}`);
  lines.style.height = `${rows * lh}px`;
  let d = '';
  for (let i = 1; i <= rows; i++) d += smooth(shakyLine(0, lh * i - 0.5, lw, lh * i - 0.5, 40 + S.q * 5 + i, 0.35, 24), false);
  lines.firstElementChild.setAttribute('d', d);
}

// ---------- 글자 단위 (아래아 ᄒᆞ 같은 조합 글자는 쪼개지 않음) ----------

const segmenter = window.Intl && Intl.Segmenter ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null;
const graphemes = (s) => (segmenter ? Array.from(segmenter.segment(s), (g) => g.segment) : Array.from(s));

// ---------- 표준어가 제주어로 바뀌는 움직임 ----------

const SHIFT_GLYPHS = ['ᄒᆞ', 'ᄆᆞ', 'ᄀᆞ', 'ᄇᆞ', 'ᄉᆞ', 'ᄃᆞ', 'ᄌᆞ', 'ᄂᆞ'];
let shiftFrame = 0;

function showShift(el, from, to, done) {
  cancelAnimationFrame(shiftFrame);
  const target = graphemes(to);
  const source = graphemes(from);
  if (reduceMotion.matches || !target.length) {
    el.textContent = to;
    done();
    return;
  }
  const started = performance.now();
  const perGlyph = Math.max(22, Math.min(46, 1100 / target.length));
  const tick = (now) => {
    const k = Math.floor((now - started) / perGlyph);
    if (k >= target.length) {
      el.textContent = to;
      done();
      return;
    }
    let scramble = '';
    for (let i = k; i < Math.min(k + 3, target.length); i++) {
      scramble += target[i] === ' ' ? ' ' : SHIFT_GLYPHS[(k + i * 3) % SHIFT_GLYPHS.length];
    }
    el.textContent = target.slice(0, k).join('') + scramble + source.slice(k + 3).join('');
    shiftFrame = requestAnimationFrame(tick);
  };
  shiftFrame = requestAnimationFrame(tick);
}

// ---------- 질문 화면 그리기 ----------

function setWarn(text) {
  $('warn').textContent = text || '';
  $('warn').hidden = !text;
}

function chipHTML({ std, jeju }) {
  const span = document.createElement('span');
  span.className = 'nt-chip';
  span.textContent = `${std} →`;
  const b = document.createElement('b');
  b.textContent = jeju;
  span.append(' ', b);
  return span;
}

function renderChips() {
  const a = cur();
  const pairs = window.noteChanges(a.saved, a.jeju).slice(0, 4);
  $('chips').replaceChildren(...pairs.map(chipHTML));
  $('chips').hidden = !pairs.length;
}

function renderNav() {
  const text = cur().text.trim();
  const saved = isSaved();
  const writing = !!text && !saved;
  const last = S.q === LAST;
  const label = !text || writing ? '남기기' : last ? '한 장에 담기' : '다음';

  document.querySelectorAll('.nt-seg').forEach((seg, i) => {
    seg.classList.toggle('is-cur', i === S.q);
    seg.classList.toggle('is-done', i !== S.q && isSaved(i));
    seg.setAttribute('aria-current', i === S.q ? 'step' : 'false');
  });
  $('prevSide').disabled = S.q === 0;
  $('prevBottom').disabled = S.q === 0;

  // 컴퓨터: 동그란 단추가 글자가 있을 때만 늘어남
  const side = $('nextSide');
  const showLabel = writing || (saved && last);
  side.disabled = !text;
  side.classList.toggle('is-txt', showLabel);
  side.classList.toggle('is-dark', !!text);
  side.style.width = !showLabel ? '44px' : writing ? '92px' : '128px';
  side.querySelector('.t').textContent = label;
  side.setAttribute('aria-label', label);

  // 휴대폰
  const bottom = $('nextBottom');
  bottom.disabled = !text;
  bottom.innerHTML = '';
  bottom.append(label);
  if (saved && !last) bottom.insertAdjacentHTML('beforeend', ICON_RIGHT);

  $('sheetNext').innerHTML = '';
  $('sheetNext').append(last ? '한 장에 담기' : '다음 질문');
  $('sheetNext').insertAdjacentHTML('beforeend', ICON_RIGHT);
  $('sheetNext').hidden = !isSaved();

  $('cnt').textContent = `${Array.from(cur().text).length} / ${MAXLEN}`;
  $('mine').classList.toggle('has-v', !!cur().text);
}

function renderAnswer(animate) {
  const a = cur();
  const saved = isSaved();
  $('mine').classList.toggle('is-saved', saved);
  ta.hidden = saved;
  $('result').hidden = !saved;
  $('after').hidden = !saved;
  if (saved) {
    $('toggleStd').textContent = S.showStd ? '제주어로 보기' : '표준어로 보기';
    if (animate) {
      $('after').style.visibility = 'hidden';
      showShift($('result'), a.saved, a.jeju, () => {
        $('after').style.visibility = '';
        drawFrames();
      });
    } else {
      cancelAnimationFrame(shiftFrame);
      $('after').style.visibility = '';
      $('result').textContent = S.showStd ? a.saved : a.jeju;
    }
    renderChips();
  } else if (ta.value !== a.text) {
    ta.value = a.text;
  }
}

function renderQuestion() {
  const q = QUESTIONS[S.q];
  $('qn').textContent = `Q${S.q + 1} / ${QUESTIONS.length}`;
  const title = $('q');
  title.textContent = q.q;
  title.style.animation = 'none';
  void title.offsetWidth;
  title.style.animation = '';
  ta.placeholder = q.hint || '';
  ta.maxLength = 400;   // 실제 제한은 input에서 글자 수로 (한글 조합 중에 잘리지 않게)
  $('sheetQ').textContent = q.q;
  ta.value = cur().text;
  S.showStd = false;
  setWarn('');
  renderAnswer(false);
  renderNav();
  renderOthers();
  requestAnimationFrame(drawFrames);
}

function renderTabs() {
  root.classList.toggle('is-o', S.tab === 'o' && !S.mobile);
  document.querySelectorAll('.nt-tab').forEach((b) => {
    const on = b.dataset.tab === S.tab;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  requestAnimationFrame(drawFrames);
}

// ---------- 다른 사람들의 답 ----------
// 실제 답(게시판에 붙인 글)이 3개 미만인 동안은 '예시 답변'을 함께 보여 줌

const others = document.createElement('div');
others.className = 'nt-others';
others.innerHTML = '<div class="nt-me" hidden><b></b><small>나의 답</small></div><div class="nt-list"></div>';
const feeds = {};   // 질문 번호 → 실제 답 목록

function examplesOf(q) {
  return (q.examples || []).map((std) => ({ std, jeju: window.noteToJeju(std), label: '예시 답변' }));
}

function itemsOf(i) {
  const q = QUESTIONS[i];
  const real = (feeds[q.id] || []).concat(localAnswersOf(q.id));
  return real.length >= 3 ? real : real.concat(examplesOf(q));
}

function itemEl(item) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nt-it';
  btn.setAttribute('aria-pressed', 'false');
  const p = document.createElement('p');
  p.textContent = item.jeju;
  const small = document.createElement('small');
  if (item.label) {
    const tag = document.createElement('i');
    tag.textContent = item.label;
    small.append(tag);
  }
  small.append('누르면 표준어로');
  btn.append(p, small);
  btn.addEventListener('click', () => {
    const toStd = !btn.classList.contains('is-std');
    btn.classList.toggle('is-std', toStd);
    btn.setAttribute('aria-pressed', String(toStd));
    p.textContent = toStd ? item.std : item.jeju;
    small.lastChild.textContent = toStd ? '누르면 제주어로' : '누르면 표준어로';
  });
  return btn;
}

function renderOthers() {
  const me = others.querySelector('.nt-me');
  const a = cur();
  me.hidden = !isSaved();
  me.querySelector('b').textContent = a.jeju;
  const list = others.querySelector('.nt-list');
  const items = itemsOf(S.q);
  list.replaceChildren(...items.map(itemEl));
  peek.items = items;
  peek.at = 0;
  fillPeek();
  requestAnimationFrame(drawFrames);
}

function placeOthers() {
  const want = S.mobile ? $('sheetBody') : $('slot');
  if (others.parentNode !== want) want.append(others);
}

// 휴대폰 아래 띠: 다른 사람들의 답이 3.4초마다 바뀜
const peek = { items: [], at: 0, timer: 0 };

function fillPeek() {
  const item = peek.items[peek.at];
  const box = $('peekText');
  box.querySelector('b').textContent = item ? `“${item.jeju}”` : '다른 사람들의 답';
  box.querySelector('small').textContent = item ? (item.label || '다른 사람의 답') : '';
}

function nextPeek() {
  if (!S.mobile || S.sheet || S.screen !== 'write' || document.hidden || root.classList.contains('is-fz') || peek.items.length < 2) return;
  const box = $('peekText');
  if (reduceMotion.matches) {
    peek.at = (peek.at + 1) % peek.items.length;
    fillPeek();
    return;
  }
  box.classList.add('is-out');
  setTimeout(() => {
    peek.at = (peek.at + 1) % peek.items.length;
    fillPeek();
    box.classList.remove('is-out');
    box.classList.add('is-in');
    void box.offsetWidth;
    box.classList.remove('is-in');
  }, 280);
}
peek.timer = setInterval(nextPeek, 3400);

function openSheet(on) {
  S.sheet = on;
  root.classList.toggle('is-sheet', on);
  if (on) {
    ta.blur();
    placeOthers();
    loadFeed(S.q);
  }
}

function setTab(tab) {
  S.tab = tab;
  if (tab === 'o') {
    ta.blur();
    loadFeed(S.q);
  }
  renderTabs();
}

// ---------- 게시판 (이 기기 또는 Supabase) ----------

const DB_ON = CFG.NOTE_POST_MODE === 'supabase' && CFG.SUPABASE_URL && CFG.SUPABASE_KEY;
const dbHeaders = (extra) => ({ apikey: CFG.SUPABASE_KEY, ...extra });

function localPosts() {
  try { return JSON.parse(localStorage.getItem(POSTS_KEY) || '[]'); } catch (e) { return []; }
}

function localAnswersOf(id) {
  if (DB_ON) return [];
  const out = [];
  localPosts().reverse().forEach((post) => {
    const a = post.answers.find((x) => x.id === id);
    if (a) out.push({ std: a.std, jeju: a.jeju, label: `No.${String(post.no).padStart(4, '0')}` });
  });
  return out;
}

async function loadFeed(i) {
  if (!DB_ON) return;
  const { id } = QUESTIONS[i];
  if (feeds[id]) return;
  try {
    const res = await fetch(`${CFG.SUPABASE_URL}/rest/v1/note_answers?question_id=eq.${encodeURIComponent(id)}&select=jeju,standard,post_no&order=created_at.desc&limit=30`, { headers: dbHeaders() });
    if (!res.ok) throw new Error(String(res.status));
    feeds[id] = (await res.json()).map((r) => ({ std: r.standard, jeju: r.jeju, label: `No.${String(r.post_no).padStart(4, '0')}` }));
    if (i === S.q) renderOthers();
  } catch (e) { console.warn('다른 사람들의 답을 불러오지 못했어요', e); }
}

const answersForPost = () => QUESTIONS.map((q, i) => ({ id: q.id, q: q.jeju, std: answerOf(i).saved, jeju: answerOf(i).jeju }));

async function sendPost() {
  const answers = answersForPost();
  if (!DB_ON) {
    const posts = localPosts();
    const no = (posts.length ? posts[posts.length - 1].no : 0) + 1;
    posts.push({ no, name: S.name, art: S.art, answers, at: Date.now() });
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
    return no;
  }
  const res = await fetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/post_note`, {
    method: 'POST',
    headers: dbHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ p_name: S.name, p_art: S.art, p_answers: answers }),
  });
  if (!res.ok) {
    let reason = '';
    try { reason = (await res.json()).message || ''; } catch (e) { /* 내용 없음 */ }
    if (reason.includes('고운 말')) throw new Error(BAD_WORD_MESSAGE);
    throw new Error(reason.includes('잠시 뒤') ? '지금 붙이는 사람이 많아요. 잠시 뒤에 다시 붙여 주세요.' : '게시판에 붙이지 못했어요. 잠시 뒤에 다시 해 주세요.');
  }
  return res.json();
}

async function fetchPosts() {
  if (!DB_ON) return localPosts().reverse();
  const res = await fetch(`${CFG.SUPABASE_URL}/rest/v1/note_posts?select=no,name,art,answers&order=created_at.desc&limit=50`, { headers: dbHeaders() });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

// ---------- 질문 화면 동작 ----------

function goQ(i) {
  S.q = Math.max(0, Math.min(LAST, i));
  saveDraft();
  if (!S.mobile && S.tab === 'o') {
    S.tab = 'm';
    renderTabs();
  }
  $('main').scrollTop = 0;
  renderQuestion();
  if (S.mobile) openSheet(false);
  track('pc_note_view', { q: S.q + 1, q_id: QUESTIONS[S.q].id });
}

function save() {
  const a = cur();
  const text = a.text.trim();
  if (!text) return;
  if (window.findBadWord && window.findBadWord(text)) {
    setWarn(BAD_WORD_MESSAGE);
    return;
  }
  setWarn('');
  a.text = text;
  a.saved = text;
  a.jeju = window.noteToJeju(text);
  S.showStd = false;
  saveDraft();
  ta.blur();
  renderAnswer(true);
  renderNav();
  renderOthers();
  requestAnimationFrame(drawFrames);
  track('pc_note_answer', { q: S.q + 1, q_id: QUESTIONS[S.q].id, length: Array.from(text).length, changed: a.jeju !== text ? 'yes' : 'no' });
}

function finish() {
  const missing = QUESTIONS.findIndex((_, i) => !isSaved(i));
  if (missing >= 0) {
    goQ(missing);
    setWarn('아직 남기지 않은 질문이 있어요. 다섯 개를 모두 남기면 한 장에 담아 드려요.');
    return;
  }
  openSheet(false);
  showFinale(true);
}

function next() {
  const text = cur().text.trim();
  if (!text) {
    $('card').classList.remove('nt-shake');
    void $('card').offsetWidth;
    $('card').classList.add('nt-shake');
    ta.focus({ preventScroll: true });
    return;
  }
  if (!isSaved()) {
    save();
    return;
  }
  if (S.q === LAST) finish();
  else goQ(S.q + 1);
}

// ---------- 키보드 ----------
// 휴대폰에서 키보드가 올라오면 보이는 영역에 맞춰 화면 높이를 줄이고, 질문 · 입력칸 · 이동 줄을 키보드 위에 모음

function setupKeyboard() {
  const V = window.visualViewport;
  if (!V) return;
  const main = $('main');
  let baseH = Math.max(window.innerHeight, V.height);
  const overflows = () => main.scrollHeight > main.clientHeight + 1;

  const sync = () => {
    const active = document.activeElement === ta;
    baseH = active ? Math.max(baseH, window.innerHeight) : Math.max(window.innerHeight, V.height);
    const on = S.mobile && active && baseH - V.height > 120;
    root.classList.toggle('is-kb', on);
    if (on) {
      root.style.top = `${Math.max(0, V.offsetTop)}px`;
      root.style.bottom = 'auto';
      root.style.height = `${V.height}px`;
      root.style.setProperty('--kbl', MAXLINES);
      for (let n = MAXLINES - 1; n >= 1 && overflows(); n--) root.style.setProperty('--kbl', n);
    } else {
      root.style.removeProperty('top');
      root.style.removeProperty('bottom');
      root.style.removeProperty('height');
      root.style.removeProperty('--kbl');
    }
    requestAnimationFrame(drawFrames);
  };
  V.addEventListener('resize', sync);
  V.addEventListener('scroll', sync);
  ta.addEventListener('focus', () => { setTimeout(sync, 60); setTimeout(sync, 800); });
  ta.addEventListener('blur', () => setTimeout(sync, 60));
}

// ---------- 결과 이미지 ----------
// 시안은 card-designs.js에 있음. 여기서는 글꼴 · 그림을 불러와서 고른 시안으로 그림

const CARD_W = 1080;
const CARD_H = 1920;   // 9:16 (인스타 스토리 · 휴대폰 화면)
const DESIGNS = window.NOTE_DESIGNS || [];
const ARTS = window.NOTE_ARTS || [];

const images = {};
function loadImage(src) {
  if (!images[src]) {
    images[src] = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { delete images[src]; reject(new Error(src)); };
      img.src = src;
    });
  }
  return images[src];
}

async function paintCard() {
  const design = DESIGNS[S.design] || DESIGNS[0];
  const items = QUESTIONS.map((q, i) => {
    const a = answerOf(i);
    return S.finStd ? { label: q.label, a: a.saved, sub: '' } : { label: q.labelJeju, a: a.jeju, sub: a.saved };
  });
  const data = { items, name: S.name, date: new Date(), std: S.finStd, art: ARTS[S.art] || ARTS[0] };
  const text = items.map((x) => x.label + x.a + x.sub).join('') + S.name + 'ᄆᆞ음 고라보게 ᄇᆞ름 하영 바당 쪽 또 옵서 고맙수다';
  try {
    await Promise.all([
      document.fonts.load('40px "Hayeong Hand"', text),
      document.fonts.load('700 40px "Bookk Myungjo"', '제주 여행 영수증 BOARDING PASS HOME CJU'),
      document.fonts.load('30px "Gowun Dodum"', `탑승객날짜좌석내가 사는 곳제주${text}`),
    ]);
  } catch (e) { /* 기본 글꼴로 그림 */ }
  const loaded = {};
  await Promise.all(design.images(data).map(async (src) => {
    try { loaded[src] = await loadImage(src); } catch (e) { console.warn(e); }
  }));
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  design.paint(canvas.getContext('2d'), data, loaded);
  return canvas;
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
const FILE_NAME = '제주어-한장.jpg';
let finalCanvas = null;
let paintTicket = 0;

async function refreshImage() {
  const ticket = ++paintTicket;
  const canvas = await paintCard();
  if (ticket !== paintTicket) return;   // 그리는 동안 또 눌렀으면 마지막 것만
  finalCanvas = canvas;
  const img = $('finImg');
  img.src = canvas.toDataURL('image/jpeg', 0.92);
  img.alt = QUESTIONS.map((q, i) => `${q.q} ${S.finStd ? answerOf(i).saved : answerOf(i).jeju}`).join(' / ');
}

// ---------- 끝 화면 ----------

function setStatus(text, warning) {
  $('finStatus').textContent = text || '';
  $('finStatus').classList.toggle('is-warning', !!warning);
}

function setScreen(name, push) {
  S.screen = name;
  document.body.dataset.view = `note_${name}`;   // track.js가 화면마다 머문 시간(pc_view_time)을 따로 잼
  root.hidden = name !== 'write';
  $('finale').hidden = name !== 'finale';
  $('wall').hidden = name !== 'wall';
  document.body.classList.toggle('is-writing', name === 'write');
  window.scrollTo(0, 0);
  if (push) history.pushState({ screen: name }, '');
  if (name === 'write') requestAnimationFrame(drawFrames);
}

function renderDesignPick() {
  $('designPick').replaceChildren(...DESIGNS.map((design, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = design.name;
    b.setAttribute('aria-pressed', String(i === S.design));
    b.classList.toggle('is-on', i === S.design);
    b.addEventListener('click', () => {
      S.design = i;
      saveDraft();
      renderDesignPick();
      renderArtPick();
      refreshImage();
      track('pc_note_design', { design: design.id });
    });
    return b;
  }));
}

function renderArtPick() {
  $('artPick').hidden = !(DESIGNS[S.design] || {}).usesArt;
  $('artPick').replaceChildren(...ARTS.map(({ src }, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.backgroundImage = `url(${src})`;
    b.setAttribute('aria-label', `그림 ${i + 1}`);
    b.setAttribute('aria-pressed', String(i === S.art));
    b.classList.toggle('is-on', i === S.art);
    b.addEventListener('click', () => {
      S.art = i;
      saveDraft();
      renderArtPick();
      refreshImage();
    });
    return b;
  }));
}

function renderWords() {
  const seen = new Set();
  const all = [];
  QUESTIONS.forEach((_, i) => {
    const a = answerOf(i);
    window.noteChanges(a.saved, a.jeju).forEach((pair) => {
      const key = `${pair.std}>${pair.jeju}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(pair);
      }
    });
  });
  $('words').replaceChildren(...all.slice(0, 12).map(chipHTML));
  $('wordsBox').hidden = !all.length;
}

function postKey() {
  return JSON.stringify(answersForPost());
}

function renderPostButton() {
  const done = S.postedKey === postKey();
  $('postBtn').disabled = done;
  $('postBtn').textContent = done ? '게시판에 붙였어요' : '게시판에 붙이기';
}

async function showFinale(firstTime) {
  setScreen('finale', true);
  S.finStd = false;
  $('finToggle').textContent = '표준어로 보기';
  $('nameInput').value = S.name;
  $('finLede').textContent = '마음에 드는 디자인을 골라 저장하거나 나눠 보세요.';
  setStatus('');
  renderDesignPick();
  renderArtPick();
  renderWords();
  renderPostButton();
  $('finImg').removeAttribute('src');
  try {
    await refreshImage();
  } catch (e) {
    console.warn(e);
    setStatus('이미지를 그리지 못했어요. 새로고침한 뒤 다시 해 주세요.', true);
  }
  if (firstTime) track('pc_note_finish', { seconds: Math.round((Date.now() - S.startedAt) / 1000) });
}

function download(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = FILE_NAME;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const siteLink = (source) => {
  const url = new URL(CFG.SHARE_URL || location.href);
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_campaign', 'note_share');
  return url.href;
};
const SHARE_TEXT = '다섯 가지 질문에 답했더니 제주어 한 장이 됐어요. 나도 해 보기:';

// 저장: 휴대폰은 공유 창('이미지 저장'을 누르면 사진첩에 들어감), 컴퓨터는 내려받기
async function saveImage() {
  if (!finalCanvas) return;
  const blob = await toBlob(finalCanvas, 'image/jpeg', 0.92);
  const file = new File([blob], FILE_NAME, { type: 'image/jpeg' });
  if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      setStatus('이미지를 저장하거나 보냈어요.');
      track('pc_note_save', { method: 'share_sheet' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  download(blob);
  setStatus('이미지를 내려받았어요. 안 받아졌다면 이미지를 길게 눌러 저장해 주세요.');
  track('pc_note_save', { method: 'download' });
}

// 카카오톡: 키가 있을 때만. 엽서 사이트와 같은 방식(그림을 카카오에 올린 뒤 메시지로)
const KAKAO_SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
let kakaoLoading = null;
function kakao() {
  if (!kakaoLoading) {
    kakaoLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = KAKAO_SDK;
      s.crossOrigin = 'anonymous';
      s.onload = () => {
        if (!window.Kakao.isInitialized()) window.Kakao.init(CFG.KAKAO_JS_KEY);
        resolve(window.Kakao);
      };
      s.onerror = () => { kakaoLoading = null; reject(new Error('카카오 SDK')); };
      document.head.append(s);
    });
  }
  return kakaoLoading;
}

async function shareKakao() {
  const K = await kakao();
  const blob = await toBlob(finalCanvas, 'image/jpeg', 0.9);
  const res = await K.Share.uploadImage({ file: [new File([blob], 'jeju-note.jpg', { type: 'image/jpeg' })] });
  const url = siteLink('kakao');
  K.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: '제주어 한 장이 도착했어요',
      description: '다섯 가지 질문에 답하면 제주어로 바꿔 드려요 · 하영 고라보게',
      imageUrl: res.infos.original.url,
      imageWidth: finalCanvas.width,
      imageHeight: finalCanvas.height,
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: '나도 해 보기', link: { mobileWebUrl: url, webUrl: url } }],
  });
}

async function shareImage() {
  if (!finalCanvas) return;
  if ((CFG.KAKAO_JS_KEY || '').trim()) {
    try {
      await shareKakao();
      track('pc_note_share', { method: 'kakao' });
      return;
    } catch (e) { console.warn(e); }
  }
  const blob = await toBlob(finalCanvas, 'image/jpeg', 0.92);
  const file = new File([blob], FILE_NAME, { type: 'image/jpeg' });
  const url = siteLink('share');
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: `${SHARE_TEXT} ${url}` });
      track('pc_note_share', { method: 'share_sheet' });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: '제주어 한 장', text: SHARE_TEXT, url });
      track('pc_note_share', { method: 'share_link' });
      return;
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(`${SHARE_TEXT} ${url}`);
    setStatus('링크를 복사했어요. 저장한 이미지와 함께 붙여 넣어 보내 보세요.');
    track('pc_note_share', { method: 'copy' });
  } catch (e) {
    setStatus('공유 창을 열지 못했어요. 이미지를 저장해서 보내 주세요.', true);
  }
}

async function confirmPost() {
  $('postDialog').close();
  $('postBtn').disabled = true;
  setStatus('붙이는 중이에요...');
  try {
    const no = await sendPost();
    S.postedKey = postKey();
    renderPostButton();
    setStatus(DB_ON ? `게시판에 붙였어요. No.${String(no).padStart(4, '0')}` : '미리보기라 이 기기에만 저장했어요. 실제 게시판 연결 전이에요.');
    track('pc_note_post', {});
  } catch (e) {
    $('postBtn').disabled = false;
    setStatus(e.message || '게시판에 붙이지 못했어요.', true);
  }
}

async function showWall(push = true) {
  setScreen('wall', push);
  $('wallLede').textContent = DB_ON ? '다른 사람들이 제주어로 남긴 다섯 마디예요.' : '미리보기라 이 기기에 저장한 글만 보여요. 실제 게시판을 연결하면 모두의 글이 여기 모여요.';
  const list = $('wallList');
  list.textContent = '불러오는 중이에요...';
  let posts = [];
  try {
    posts = await fetchPosts();
  } catch (e) {
    list.textContent = '게시판을 불러오지 못했어요. 잠시 뒤에 다시 열어 주세요.';
    return;
  }
  if (!posts.length) {
    list.textContent = '아직 붙인 글이 없어요. 첫 번째로 붙여 보세요.';
    return;
  }
  list.replaceChildren(...posts.map((post) => {
    const item = document.createElement('article');
    item.className = 'nw-item';
    const who = document.createElement('div');
    who.className = 'nw-who';
    const b = document.createElement('b');
    b.textContent = post.name || '이름 없는 사람';
    const no = document.createElement('span');
    no.textContent = `No.${String(post.no).padStart(4, '0')}`;
    who.append(b, no);
    const dl = document.createElement('dl');
    (post.answers || []).forEach((a) => {
      const dt = document.createElement('dt');
      dt.textContent = a.q;
      const dd = document.createElement('dd');
      dd.textContent = a.jeju;
      dl.append(dt, dd);
    });
    item.append(who, dl);
    return item;
  }));
}

// ---------- 이벤트 연결 ----------

function setupEvents() {
  $('prevSide').innerHTML = ICON_LEFT;
  $('prevBottom').innerHTML = ICON_LEFT;
  $('nextSide').querySelector('.ar').innerHTML = ICON_RIGHT;

  $('bar').replaceChildren(...QUESTIONS.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nt-seg';
    b.setAttribute('aria-label', `질문 ${i + 1}`);
    b.append(document.createElement('i'));
    b.addEventListener('click', () => goQ(i));
    return b;
  }));

  ta.addEventListener('input', () => {
    // 줄은 네 줄까지, 글자는 70자까지
    const lines = ta.value.split('\n');
    let value = lines.length > MAXLINES ? `${lines.slice(0, MAXLINES).join('\n')} ${lines.slice(MAXLINES).join(' ')}` : ta.value;
    const chars = Array.from(value);
    if (chars.length > MAXLEN) value = chars.slice(0, MAXLEN).join('');
    if (value !== ta.value) ta.value = value;
    cur().text = value;
    setWarn('');
    saveDraft();
    renderNav();
  });
  ta.addEventListener('focus', () => {
    root.classList.add('is-fz');
    if (S.mobile) window.scrollTo(0, 0);
  });
  ta.addEventListener('blur', () => root.classList.remove('is-fz'));
  ta.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    // 휴대폰의 엔터 · 컴퓨터의 Shift+Enter는 줄바꿈
    if (e.shiftKey || S.mobile) {
      if ((ta.value.match(/\n/g) || []).length >= MAXLINES - 1) e.preventDefault();
      return;
    }
    e.preventDefault();
    next();
  });
  root.tabIndex = -1;
  root.style.outline = 'none';
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (S.sheet) openSheet(false);
      else ta.blur();
      return;
    }
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    if (['TEXTAREA', 'INPUT', 'BUTTON', 'A'].includes(e.target.tagName)) return;
    e.preventDefault();
    next();
  });

  [$('nextSide'), $('nextBottom')].forEach((b) => b.addEventListener('click', next));
  [$('prevSide'), $('prevBottom')].forEach((b) => b.addEventListener('click', () => goQ(S.q - 1)));
  $('toggleStd').addEventListener('click', () => {
    S.showStd = !S.showStd;
    renderAnswer(false);
    requestAnimationFrame(drawFrames);
  });
  $('editBtn').addEventListener('click', () => {
    const a = cur();
    a.saved = '';
    a.jeju = '';
    saveDraft();
    renderAnswer(false);
    renderNav();
    renderOthers();
    ta.value = a.text;
    ta.focus();
    requestAnimationFrame(drawFrames);
  });

  document.querySelectorAll('.nt-tab').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.tab === 'o' && S.tab !== 'o') track('pc_note_others_open', { q: S.q + 1, how: 'tab' });
    setTab(b.dataset.tab);
  }));
  $('peek').addEventListener('click', () => {
    track('pc_note_others_open', { q: S.q + 1, how: 'peek' });
    openSheet(true);
  });
  $('sheetDim').addEventListener('click', () => openSheet(false));
  $('sheetNext').addEventListener('click', next);
  let dragY = null;
  $('sheetHd').addEventListener('touchstart', (e) => { dragY = e.touches[0].clientY; }, { passive: true });
  $('sheetHd').addEventListener('touchend', (e) => {
    if (dragY !== null && e.changedTouches[0].clientY - dragY > 60) openSheet(false);
    dragY = null;
  }, { passive: true });

  const postcardUrl = CFG.POSTCARD_URL || '../';
  $('logoLink').href = postcardUrl;
  document.querySelectorAll('[data-postcard-link]').forEach((a) => { a.href = postcardUrl; });
  $('toPostcard').href = `${postcardUrl}${postcardUrl.includes('?') ? '&' : '?'}start=write`;
  $('toPostcard').addEventListener('click', () => track('pc_note_to_postcard', {}));

  // 끝 화면
  $('finBack').addEventListener('click', () => { goQ(0); setScreen('write', true); });
  $('saveBtn').addEventListener('click', saveImage);
  $('shareBtn').addEventListener('click', shareImage);
  $('postBtn').addEventListener('click', () => $('postDialog').showModal());
  $('postCancel').addEventListener('click', () => $('postDialog').close());
  $('postOk').addEventListener('click', confirmPost);
  $('finToggle').addEventListener('click', () => {
    S.finStd = !S.finStd;
    $('finToggle').textContent = S.finStd ? '제주어로 보기' : '표준어로 보기';
    refreshImage();
  });
  let nameTimer = 0;
  $('nameInput').addEventListener('input', () => {
    S.name = $('nameInput').value.trim().slice(0, 12);
    saveDraft();
    clearTimeout(nameTimer);
    nameTimer = setTimeout(refreshImage, 350);
  });
  $('wallBtn').addEventListener('click', () => showWall());
  $('wallBack').addEventListener('click', () => showFinale(false));
  $('restartBtn').addEventListener('click', () => {
    if (!window.confirm('다섯 개의 답을 모두 지우고 처음부터 다시 할까요?')) return;
    S.answers = {};
    S.startedAt = Date.now();
    S.postedKey = '';
    S.q = 0;
    saveDraft();
    setScreen('write', true);
    renderQuestion();
    track('pc_note_restart', {});
  });

  window.addEventListener('popstate', (e) => {
    const name = (e.state && e.state.screen) || 'write';
    if (name === 'finale' && allSaved()) { showFinale(false); history.replaceState({ screen: 'finale' }, ''); } else if (name === 'wall') showWall(false);
    else setScreen('write');
  });

  const onWidth = () => {
    S.mobile = mobileQuery.matches;
    if (S.mobile && S.tab === 'o') S.tab = 'm';
    if (!S.mobile) openSheet(false);
    placeOthers();
    renderTabs();
  };
  mobileQuery.addEventListener('change', onWidth);
  new ResizeObserver(() => drawFrames()).observe($('card'));
  onWidth();
  setupKeyboard();
}

// ---------- 시작 ----------

function start() {
  loadDraft();
  // 다시 들어왔을 때: 남기지 않고 쓰던 글은 그대로, 남긴 글은 제주어까지 그대로
  setupEvents();
  history.replaceState({ screen: 'write' }, '');
  setScreen('write');
  renderQuestion();
  track('pc_note_view', { q: S.q + 1, q_id: QUESTIONS[S.q].id });
  if (!S.mobile && !cur().text) setTimeout(() => { if (S.screen === 'write' && !cur().text) ta.focus({ preventScroll: true }); }, 700);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawFrames);
}

start();
