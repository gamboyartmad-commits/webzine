// 연필로 쓰는 엽서 — 책상 위 엽서에 연필을 쥐고 손글씨를 쓰는 화면
// 메모지에 표준어로 적으면 제주어로 바꿔(jeju-extra.js의 noteToJeju) 엽서 줄 위에 연하게 깔아 주고, 그 위를 따라 쓴다.
// 손글씨는 엽서 너비를 1로 둔 좌표로 모아 둔다. 그래서 화면 크기가 바뀌어도, 이미지로 저장할 때도, 다시 보기에서도 같은 글씨로 다시 그린다.
// 측정: track.js의 hyTrack. 이벤트 이름은 pc_desk_ 로 시작하고, 사람이 쓴 글은 담지 않음

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const cfg = window.POSTCARD_CONFIG || {};
  const track = (name, params) => { try { if (window.hyTrack) window.hyTrack(name, params || {}); } catch (e) { /* 측정 실패는 무시 */ } };

  const PHOTOS = ['card-01', 'card-03', 'card-04', 'card-12', 'card-13', 'card-14'];
  const STORE_KEY = 'hy-pencil-desk-v1';
  const OWN_KEY = 'hy-pencil-desk-photo';   // 내 사진은 손글씨와 따로 둠. 사진이 커서 못 남겨도 손글씨는 남게
  const SOUND_KEY = 'hy-pencil-sound';
  // 내 사진이 들어갈 자리: 엽서 그림의 왼쪽 절반(960×1280). 이 비율로 가운데를 잘라 줄여 둠
  const OWN_W = 900;
  const OWN_H = 1200;
  const BAD_WORD_MESSAGE = '고운 말로 써 주세요. 욕설이나 야한 말, 남을 깎아내리는 말은 남길 수 없어요.';
  const HAND = '"Hayeong Hand", "NanumMyeongjo YetHangul", serif';

  // 엽서 그림(1920×1280, 엽서 사이트와 같은 파일) 안 점선 자리. x는 엽서 너비, y는 엽서 높이에 대한 비율
  // 점선 11줄: y 206px부터 92px 간격, x 1063~1792px
  const L = {
    x0: 0.5536, x1: 0.9333,
    line0: 0.1609, gap: 0.0719, lines: 11,
    dateY: 0.9516,   // From 점선 높이
  };

  // 연필 굵기 (엽서 너비에 대한 비율). 고른 굵기(SIZES의 k)를 곱해서 씀
  const LEAD_W = 0.0031;
  const ERASER_W = 0.026;

  // 필통. rgb는 심 색, body는 연필 몸통 세 면(밝은 면 · 가운데 · 어두운 면)
  // 흑연 연필만 엽서 사이트의 귤색 몸통이고, 색연필은 심 색으로 몸통을 칠함
  const LEADS = [
    { id: 'graphite', name: '연필', mark: 'HB', rgb: [44, 44, 52], body: ['#f5a766', '#e2813c', '#bc6227'] },
    { id: 'blue', name: '파랑', rgb: [34, 86, 160] },
    { id: 'red', name: '빨강', rgb: [192, 40, 52] },
    { id: 'green', name: '초록', rgb: [40, 116, 66] },
    { id: 'brown', name: '갈색', rgb: [116, 70, 38] },
  ];
  const SIZES = [
    { id: 'thin', name: '가늘게', k: 0.7 },
    { id: 'mid', name: '보통', k: 1 },
    { id: 'thick', name: '굵게', k: 1.7 },
  ];
  const leadOf = (id) => LEADS.find((l) => l.id === id) || LEADS[0];
  const sizeOf = (id) => SIZES.find((s) => s.id === id) || SIZES[1];
  const rgb = (c, a) => `rgb(${c[0]} ${c[1]} ${c[2]}${a == null ? '' : ` / ${a}`})`;
  const mix = (c, to, f) => c.map((v, i) => Math.round(v + (to[i] - v) * f));
  const bodyOf = (lead) => lead.body || [rgb(mix(lead.rgb, [255, 255, 255], 0.2)), rgb(lead.rgb), rgb(mix(lead.rgb, [0, 0, 0], 0.24))];

  // 연필 그림: 끝이 (0, 11), 지우개 끝이 (299, 11)
  const PENCIL_LEN = 299;
  const PENCIL_HALF = 11;
  const WRITE_ANGLE = 58;     // 쓸 때 몸통이 오른쪽 아래로 누운 각도 (오른손으로 쥔 모습)

  const els = {
    memoAsk: $('memoAsk'), memoDone: $('memoDone'), memoForm: $('memoForm'), memoInput: $('memoInput'),
    memoCount: $('memoCount'), memoWarn: $('memoWarn'), memoJeju: $('memoJeju'), memoStd: $('memoStd'),
    memoPairs: $('memoPairs'), memoEdit: $('memoEdit'),
    desk: $('desk'), cardWindow: $('cardWindow'), viewSwitch: $('viewSwitch'),
    card: $('card'), face: $('face'), guide: $('guide'), ink: $('ink'),
    spot: $('spot'), hint: $('hint'), layer: $('pencilLayer'), pencil: $('pencil'), shadow: $('pencilShadow'),
    pencilText: $('pencilText'), leadSet: $('leadSet'), sizeSet: $('sizeSet'),
    holdBtn: $('holdBtn'), eraserBtn: $('eraserBtn'), undoBtn: $('undoBtn'), clearBtn: $('clearBtn'),
    guideBtn: $('guideBtn'), photoBtn: $('photoBtn'), ownBtn: $('ownBtn'), ownInput: $('ownInput'), blankBtn: $('blankBtn'),
    doneBtn: $('doneBtn'), toast: $('toast'),
    finish: $('finish'), stats: $('stats'), score: $('score'), scoreLine: $('scoreLine'), scoreNum: $('scoreNum'), scoreRank: $('scoreRank'), scoreWhy: $('scoreWhy'), saveBtn: $('saveBtn'), shareBtn: $('shareBtn'), replayBtn: $('replayBtn'),
    rewriteBtn: $('rewriteBtn'), restartBtn: $('restartBtn'), toPostcard: $('toPostcard'),
    soundBtn: $('soundBtn'), logoLink: $('logoLink'),
  };
  const faceCtx = els.face.getContext('2d');
  const inkCtx = els.ink.getContext('2d');

  // 저장해 두는 것: 적은 말, 바꾼 말, 그림, 고른 연필, 손글씨 (+ 내 사진은 OWN_KEY에 따로)
  // photo는 PHOTOS의 차례. PHOTOS.length이면 내 사진. blank이면 사진 칸을 비움
  const S = { std: '', jeju: '', photo: 0, own: '', blank: false, guide: true, lead: 'graphite', size: 'mid', strokes: [], done: false };
  const photoCount = () => PHOTOS.length + (S.own ? 1 : 0);
  const isOwn = () => !!S.own && S.photo === PHOTOS.length;

  /* ── 저장 ─────────────────────────────── */

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ std: S.std, jeju: S.jeju, photo: S.photo, blank: S.blank, guide: S.guide, lead: S.lead, size: S.size, strokes: S.strokes }));
    } catch (e) { /* 저장이 막혀도 화면은 그대로 씀 */ }
  }

  // 사진을 못 남기면(기기 저장 칸이 꽉 참) false
  function saveOwn() {
    try {
      if (S.own) localStorage.setItem(OWN_KEY, S.own);
      else localStorage.removeItem(OWN_KEY);
      return true;
    } catch (e) {
      try { localStorage.removeItem(OWN_KEY); } catch (err) { /* 예전 사진이 대신 살아나지 않게 */ }
      return false;
    }
  }

  function load() {
    try {
      const own = localStorage.getItem(OWN_KEY) || '';
      S.own = own.startsWith('data:image/') ? own : '';
    } catch (e) { /* 사진 없이 시작 */ }
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!d) return;
      S.std = String(d.std || '');
      S.jeju = String(d.jeju || '');
      S.photo = Number(d.photo) % photoCount() || 0;
      S.blank = d.blank === true;
      S.guide = d.guide !== false;
      S.lead = leadOf(d.lead).id;
      S.size = sizeOf(d.size).id;
      S.strokes = Array.isArray(d.strokes) ? d.strokes : [];
    } catch (e) { /* 깨진 기록은 버림 */ }
  }

  /* ── 그림 불러오기 ─────────────────────── */

  const images = {};
  function image(src) {
    if (!images[src]) {
      const im = new Image();
      im.onload = () => drawFace(faceCtx, els.face.width, els.face.height);
      im.src = src;
      images[src] = im;
    }
    return images[src];
  }
  const ready = (im) => im.complete && im.naturalWidth > 0;
  // 내 사진일 때도 오른쪽(To · 점선 · From)은 첫 엽서 그림에서 가져옴
  const photoSrc = () => `../images/${PHOTOS[isOwn() ? 0 : S.photo]}.webp`;

  let ownImage = null;
  function ownImg() {
    if (!ownImage || ownImage.src !== S.own) {
      ownImage = new Image();
      ownImage.onload = () => drawFace(faceCtx, els.face.width, els.face.height);
      ownImage.src = S.own;
    }
    return ownImage;
  }

  // 고른 사진을 엽서 사진 칸 비율로 가운데를 잘라 줄임. 이 기기 안에서만 다루고 어디에도 보내지 않음
  function fitOwn(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        URL.revokeObjectURL(url);
        const c = document.createElement('canvas');
        c.width = OWN_W;
        c.height = OWN_H;
        const k = Math.max(OWN_W / im.naturalWidth, OWN_H / im.naturalHeight);
        const w = im.naturalWidth * k;
        const h = im.naturalHeight * k;
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, OWN_W, OWN_H);
        g.drawImage(im, (OWN_W - w) / 2, (OWN_H - h) / 2, w, h);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진')); };
      im.src = url;
    });
  }

  /* ── 엽서 바탕 (화면과 저장 이미지가 같은 함수로 그림) ── */

  function today() {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  function drawFace(ctx, w, h) {
    if (!w || !h) return;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    // 엽서 그림에 사진 · To · 점선 · From이 다 들어 있음
    const photo = image(photoSrc());
    if (ready(photo)) ctx.drawImage(photo, 0, 0, w, h);
    else { ctx.fillStyle = '#ece6da'; ctx.fillRect(0, 0, w * 0.5, h); }
    if (S.blank) {
      // 사진을 뺀 엽서: 왼쪽도 흰 종이. 가운데에 옅은 선 하나만 남겨 엽서 칸을 나눔
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w * 0.5, h);
      ctx.fillStyle = 'rgb(62 56 50 / 0.1)';
      ctx.fillRect(w * 0.5 - Math.max(1, w * 0.0006) / 2, h * 0.06, Math.max(1, w * 0.0006), h * 0.88);
    } else if (isOwn()) {
      // 내 사진은 왼쪽 사진 칸에 덮음
      const own = ownImg();
      ctx.fillStyle = '#ece6da';
      if (ready(own)) ctx.drawImage(own, 0, 0, w * 0.5, h);
      else ctx.fillRect(0, 0, w * 0.5, h);
    }
    // 날짜는 엽서 사이트처럼 From 줄 왼쪽에
    ctx.fillStyle = '#75695b';
    ctx.font = `${w * 0.0135}px ${HAND}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(today(), w * L.x0, h * L.dateY);
    ctx.restore();
    // 다 쓴 엽서에는 빨간 펜 점수. 화면과 저장 · 공유 이미지가 같음
    if (S.done && grade) drawGrade(ctx, w, h, grade);
  }

  // 빨간 펜 점수 자리: 엽서 그림 오른쪽 위 빈자리 (To 줄 오른쪽 끝 x 0.73, 첫 점선 y 0.16보다 위)
  // 동그라미 가운데 · 반지름, 한마디 오른쪽 끝 · 밑줄 높이. x는 엽서 너비, y는 엽서 높이에 대한 비율
  const GRADE = { cx: 0.893, cy: 0.088, rx: 0.058, ry: 0.066, noteX: 0.825, noteY: 0.05 };
  const RED_PEN = '#c8372d';
  let grade = null;   // 끝 화면에서 매긴 점수 { score, rank, ... }

  function drawGrade(ctx, w, h, res) {
    ctx.save();
    ctx.strokeStyle = RED_PEN;
    ctx.fillStyle = RED_PEN;
    ctx.lineCap = 'round';
    ctx.textBaseline = 'alphabetic';
    ctx.translate(GRADE.cx * w, GRADE.cy * h);
    ctx.rotate(-0.1);
    // 동그라미: 한 바퀴를 조금 넘겨 그은 펜 자국에, 옅게 한 번 더
    const rx = GRADE.rx * w;
    const ry = GRADE.ry * h;
    ctx.lineWidth = w * 0.0024;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, -1.9, Math.PI * 2 - 1.55);
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = w * 0.0016;
    ctx.beginPath();
    ctx.ellipse(w * 0.002, -h * 0.003, rx * 1.04, ry * 0.95, 0.06, -2.2, 0.4);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // 숫자와 '점'을 동그라미 가운데에
    const num = String(res.score);
    ctx.font = `${w * 0.043}px ${HAND}`;
    const nw = ctx.measureText(num).width;
    ctx.font = `${w * 0.017}px ${HAND}`;
    const jw = ctx.measureText('점').width;
    const x0 = -(nw + jw + w * 0.002) / 2;
    ctx.font = `${w * 0.043}px ${HAND}`;
    ctx.fillText(num, x0, ry * 0.42);
    ctx.font = `${w * 0.017}px ${HAND}`;
    ctx.fillText('점', x0 + nw + w * 0.002, ry * 0.42);
    ctx.restore();
    // 한마디: 동그라미 왼쪽 위에 선생님 글씨처럼
    ctx.save();
    ctx.fillStyle = RED_PEN;
    ctx.translate(GRADE.noteX * w, GRADE.noteY * h);
    ctx.rotate(-0.035);
    ctx.font = `${w * 0.017}px ${HAND}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(res.rank, 0, 0);
    ctx.restore();
  }

  /* ── 연필 자국 ──────────────────────────
     획 = { tool: 'p'(연필) | 'e'(지우개) | 'clear'(다 지우기), c: 연필 색 id, s: 굵기 배수, at: 시작 시각, pts: [[x, y, 굵기, 시작부터 ms], ...] }
     x · y · 굵기는 엽서 너비를 1로 둔 값. 그래서 어떤 크기의 캔버스에도 같은 글씨로 그린다.
     c · s가 없는 예전 획은 흑연 연필 · 보통 굵기로 그림 */

  // 종이결: 심이 종이의 오톨도톨한 결에만 묻는 느낌을 내는 무늬. 캔버스에 고정돼서 겹쳐 쓰면 점점 진해짐
  // 결(알파)은 한 번만 만들고 색마다 칠만 달리 해서, 어느 색으로 써도 같은 종이결을 탐
  const GRAIN = 192;
  let grainAlpha = null;
  const grainTiles = {};
  const patterns = new WeakMap();
  function grain(ctx, lead) {
    if (!grainAlpha) {
      grainAlpha = new Uint8ClampedArray(GRAIN * GRAIN);
      for (let i = 0; i < grainAlpha.length; i++) {
        const n = Math.random();
        grainAlpha[i] = n < 0.28 ? 0 : 50 + n * 200;
      }
    }
    if (!grainTiles[lead.id]) {
      const tile = document.createElement('canvas');
      tile.width = tile.height = GRAIN;
      const g = tile.getContext('2d');
      const im = g.createImageData(GRAIN, GRAIN);
      for (let i = 0; i < grainAlpha.length; i++) {
        im.data[i * 4] = lead.rgb[0];
        im.data[i * 4 + 1] = lead.rgb[1];
        im.data[i * 4 + 2] = lead.rgb[2];
        im.data[i * 4 + 3] = grainAlpha[i];
      }
      g.putImageData(im, 0, 0);
      grainTiles[lead.id] = tile;
    }
    let byLead = patterns.get(ctx);
    if (!byLead) { byLead = {}; patterns.set(ctx, byLead); }
    if (!byLead[lead.id]) byLead[lead.id] = ctx.createPattern(grainTiles[lead.id], 'repeat');
    return byLead[lead.id];
  }

  function paint(ctx, st, width, path) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (st.tool === 'e') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#000';
      ctx.lineWidth = width;
      path();
      ctx.stroke();
    } else {
      // 빨리 그은 줄은 가늘고 옅게, 천천히 그은 줄은 굵고 진하게 (고른 굵기 안에서)
      const lead = leadOf(st.c);
      const press = Math.min(1, Math.max(0.55, width / (LEAD_W * (st.s || 1) * ctx.canvas.width)));
      ctx.lineWidth = width * 0.6;
      ctx.strokeStyle = rgb(lead.rgb);
      ctx.globalAlpha = 0.24 * press;
      path();
      ctx.stroke();
      ctx.lineWidth = width;
      ctx.strokeStyle = grain(ctx, lead);
      ctx.globalAlpha = 0.86 * press;
      path();
      ctx.stroke();
    }
    ctx.restore();
  }

  // i번째 점까지 들어왔을 때 새로 그릴 조각. 점 사이를 가운데점끼리 곡선으로 이어서 매끄럽게
  function drawPiece(ctx, Wd, st, i) {
    const p = st.pts;
    const a = p[i];
    if (i === 0) {
      // 처음 대는 자리: 꾹 누른 점
      paint(ctx, st, a[2] * Wd, () => {
        ctx.beginPath();
        ctx.moveTo(a[0] * Wd, a[1] * Wd);
        ctx.lineTo(a[0] * Wd + 0.01, a[1] * Wd);
      });
      return;
    }
    const b = p[i - 1];
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const c = i > 1 ? p[i - 2] : null;
    paint(ctx, st, ((a[2] + b[2]) / 2) * Wd, () => {
      ctx.beginPath();
      if (c) {
        ctx.moveTo(((c[0] + b[0]) / 2) * Wd, ((c[1] + b[1]) / 2) * Wd);
        ctx.quadraticCurveTo(b[0] * Wd, b[1] * Wd, mx * Wd, my * Wd);
      } else {
        ctx.moveTo(b[0] * Wd, b[1] * Wd);
        ctx.lineTo(mx * Wd, my * Wd);
      }
    });
  }

  // 획 끝: 마지막 가운데점에서 마지막 점까지
  function drawEnd(ctx, Wd, st) {
    const p = st.pts;
    if (p.length < 2) return;
    const a = p[p.length - 1];
    const b = p[p.length - 2];
    paint(ctx, st, a[2] * Wd, () => {
      ctx.beginPath();
      ctx.moveTo(((a[0] + b[0]) / 2) * Wd, ((a[1] + b[1]) / 2) * Wd);
      ctx.lineTo(a[0] * Wd, a[1] * Wd);
    });
  }

  function drawStroke(ctx, Wd, st) {
    if (st.tool === 'clear') { ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); return; }
    for (let i = 0; i < st.pts.length; i++) drawPiece(ctx, Wd, st, i);
    drawEnd(ctx, Wd, st);
  }

  function redrawInk(ctx, Wd, list) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    (list || S.strokes).forEach((st) => drawStroke(ctx, Wd, st));
  }

  // '다 지우기' 뒤로 남은 획
  function visibleStrokes() {
    let from = 0;
    S.strokes.forEach((st, i) => { if (st.tool === 'clear') from = i + 1; });
    return S.strokes.slice(from);
  }

  /* ── 크기 맞추기 ───────────────────────── */

  let W = 0;   // 엽서 너비 (CSS px)
  let H = 0;
  function layout() {
    W = els.card.offsetWidth;
    H = els.card.offsetHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    [els.face, els.ink].forEach((c) => {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    });
    drawFace(faceCtx, els.face.width, els.face.height);
    redrawInk(inkCtx, els.ink.width);
    layoutGuide();
    if (!held && !replaying) restPencil(false);
  }

  // 바꾼 제주어를 점선 위에 연하게. 마우스로도 쓸 만하게 두 줄에 한 줄씩 크게 깔고,
  // 글이 길어 다 안 들어가면 한 줄에 한 줄씩 작게 깔아 줌
  function layoutGuide() {
    const g = els.guide;
    g.textContent = S.jeju;
    g.classList.toggle('is-off', !S.guide || S.done);
    if (!S.jeju || !W) return;
    const gap = L.gap * H;
    g.style.left = `${L.x0 * W + gap * 0.1}px`;
    g.style.width = `${(L.x1 - L.x0) * W - gap * 0.1}px`;

    const fit = (step, rows, from, to) => {
      g.style.lineHeight = `${gap * step}px`;
      for (let size = from; size >= to; size -= 1) {
        g.style.fontSize = `${size}px`;
        if (g.scrollHeight <= gap * step * rows + 1) return size;
      }
      return 0;
    };
    let step = 2;   // 2번째 · 4번째 … 10번째 점선에 맞춰 다섯 줄
    let first = 1;
    let size = fit(2, 5, Math.round(gap * 1.25), Math.round(gap * 0.9));
    if (!size) {
      step = 1;     // 열한 줄 모두
      first = 0;
      size = fit(1, L.lines, Math.round(gap * 0.68), Math.round(gap * 0.45)) || Math.round(gap * 0.45);
    }
    // 글자 밑동이 점선 바로 위에 오게
    const lineY = (L.line0 + first * L.gap) * H;
    g.style.top = `${lineY - gap * 0.1 - (gap * step) / 2 - size * 0.42}px`;
  }

  /* ── 연필 소리 (종이를 긁는 소리를 잡음으로 만듦) ── */

  const Sound = (() => {
    let on = true;
    try { on = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) { /* 기본은 켬 */ }
    let ac = null;
    let gain = null;
    let band = null;
    let quiet = 0;

    function init() {
      if (ac) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      const len = ac.sampleRate * 2;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      // 사각사각: 고른 잡음에 가끔 튀는 알갱이를 섞음
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.06 ? 1 : 0.32);
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 900;
      band = ac.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 3000;
      band.Q.value = 0.7;
      gain = ac.createGain();
      gain.gain.value = 0;
      src.connect(hp).connect(band).connect(gain).connect(ac.destination);
      src.start();
      return true;
    }

    function scratch(level, rub) {
      if (!on || !init()) return;
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime;
      gain.gain.setTargetAtTime(level, t, 0.02);
      band.frequency.setTargetAtTime(rub ? 1000 : 2400 + Math.random() * 1600, t, 0.03);
      clearTimeout(quiet);
      quiet = setTimeout(stop, 80);   // 손이 멈추면 소리도 멈춤
    }

    function stop() {
      if (gain) gain.gain.setTargetAtTime(0, ac.currentTime, 0.04);
    }

    function toggle() {
      on = !on;
      try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch (e) { /* 저장 못 해도 지금은 바뀜 */ }
      if (!on) stop();
      return on;
    }

    return { scratch, stop, toggle, isOn: () => on };
  })();

  /* ── 연필 그리기 (몸통 · 그림자) ─────────── */

  let held = false;
  let eraser = false;
  let replaying = null;
  const pen = { x: 0, y: 0, ang: WRITE_ANGLE, wig: 0, vx: 0, down: false, lastX: 0, lastT: 0 };
  let raf = 0;

  const pencilScale = () => (window.innerWidth < 860 ? 0.66 : 1);

  function pose(x, y, ang, anchor, lift) {
    const s = pencilScale();
    const tf = (dx, dy, da) => `translate(${x + dx}px, ${y + dy}px) rotate(${ang + da}deg) scale(${s}) translate(${-anchor}px, ${-PENCIL_HALF}px)`;
    els.pencil.style.transform = tf(0, 0, 0);
    // 빛이 왼쪽 위에서 와서 그림자는 오른쪽 아래로. 연필을 들수록 그림자가 멀어짐
    els.shadow.style.transform = tf(2 + lift * 6, 3 + lift * 8, -lift * 2.5);
  }

  // 고른 연필로 몸통 · 심 색과 몸통 글씨를 바꿈
  let dressed = '';
  function dressPencil(id) {
    if (dressed === id) return;
    dressed = id;
    const lead = leadOf(id);
    const [hi, mid, lo] = bodyOf(lead);
    const st = els.pencil.style;
    st.setProperty('--pb-hi', hi);
    st.setProperty('--pb-mid', mid);
    st.setProperty('--pb-lo', lo);
    st.setProperty('--tip', rgb(lead.rgb));
    // 어두운 몸통에는 밝은 글씨
    const dark = lead.body ? false : (lead.rgb[0] * 0.3 + lead.rgb[1] * 0.59 + lead.rgb[2] * 0.11) < 140;
    st.setProperty('--pb-text', dark ? '#fff' : '#5b2f0d');
    els.pencilText.textContent = `하영 고라보게 · ${lead.mark || lead.name}`;
  }

  function renderPencil() {
    raf = 0;
    if (!held || replaying) return;
    // 손을 옆으로 움직이면 연필이 살짝 기울었다 돌아옴
    pen.wig += (Math.max(-7, Math.min(7, pen.vx * 5)) - pen.wig) * 0.25;
    pen.vx *= 0.8;
    const ang = WRITE_ANGLE + pen.wig + (eraser ? 180 : 0);
    pose(pen.x, pen.y, ang, eraser ? PENCIL_LEN : 0, pen.down ? 0.15 : 1);
    if (Math.abs(pen.wig) > 0.05 || Math.abs(pen.vx) > 0.01) schedule();
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(renderPencil); };

  // 연필이 놓이는 자리: 넓은 화면은 엽서 오른쪽에 세로로, 좁은 화면은 엽서 아래에 가로로
  function restPencil(animate) {
    const r = els.spot.getBoundingClientRect();
    const sx = window.scrollX;
    const sy = window.scrollY;
    const s = pencilScale();
    let x;
    let y;
    let ang;
    if (r.height > r.width) {
      x = r.left + sx + r.width * 0.42;
      y = r.top + sy + 18;
      ang = 83;
    } else {
      x = r.left + sx + 10;
      y = r.top + sy + r.height * 0.55;
      ang = -3;
    }
    if (r.height > r.width && PENCIL_LEN * s > r.height - 30) y = r.top + sy + Math.max(0, (r.height - PENCIL_LEN * s) / 2);
    moving(animate);
    pose(x, y, ang, 0, 0.1);
  }

  let movingTimer = 0;
  function moving(on) {
    clearTimeout(movingTimer);
    els.layer.classList.toggle('is-moving', !!on);
    if (on) movingTimer = setTimeout(() => els.layer.classList.remove('is-moving'), 340);
  }

  function hold(e) {
    if (held || S.done || replaying) return;
    held = true;
    document.body.classList.add('is-held');
    if (e && 'pageX' in e && e.pointerType !== 'touch') { pen.x = e.pageX; pen.y = e.pageY; }
    else {
      // 키보드로 집으면 첫 줄 앞에 둠
      const r = els.card.getBoundingClientRect();
      pen.x = r.left + window.scrollX + W * (L.x0 + 0.02);
      pen.y = r.top + window.scrollY + H * L.line0;
    }
    moving(true);
    pose(pen.x, pen.y, WRITE_ANGLE + (eraser ? 180 : 0), eraser ? PENCIL_LEN : 0, 1);
    renderTools();
    if (!S.picked) { S.picked = true; track('pc_desk_pickup', {}); }
  }

  function putDown() {
    if (!held) return;
    held = false;
    eraser = false;
    pen.down = false;
    document.body.classList.remove('is-held');
    els.layer.classList.remove('is-faded', 'is-away');
    restPencil(true);
    renderTools();
  }

  function setEraser(on) {
    eraser = on;
    if (!held) hold(null);
    moving(true);
    renderPencil();
    renderTools();
  }

  /* ── 쓰기 ─────────────────────────────── */

  let cur = null;   // 지금 긋는 획

  function addPoint(e) {
    const r = cur.rect;
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.width;
    const t = e.timeStamp;
    const last = cur.last;
    let w = cur.tool === 'e' ? ERASER_W : LEAD_W * cur.s * 1.08;
    if (last) {
      const dist = Math.hypot(x - last.x, y - last.y) * r.width;
      if (dist < 0.6) return;
      const v = dist / Math.max(1, t - last.t);   // px/ms
      if (cur.tool !== 'e') {
        const target = LEAD_W * cur.s * Math.min(1.2, Math.max(0.6, 1.24 - v * 0.3));
        w = last.w * 0.72 + target * 0.28;
      }
      Sound.scratch(Math.min(0.2, 0.035 + v * 0.09), cur.tool === 'e');
    }
    cur.pts.push([+x.toFixed(5), +y.toFixed(5), +w.toFixed(6), Math.round(t - cur.t0)]);
    drawPiece(inkCtx, els.ink.width, cur, cur.pts.length - 1);
    cur.last = { x, y, t, w };
  }

  function startStroke(e) {
    cur = { tool: eraser ? 'e' : 'p', c: S.lead, s: sizeOf(S.size).k, at: Date.now(), pts: [], rect: els.ink.getBoundingClientRect(), t0: e.timeStamp, last: null };
    pen.down = true;
    addPoint(e);
    schedule();
  }

  function endStroke() {
    if (!cur) return;
    drawEnd(inkCtx, els.ink.width, cur);
    if (cur.pts.length) {
      S.strokes.push(cur.tool === 'e'
        ? { tool: 'e', at: cur.at, pts: cur.pts }
        : { tool: 'p', c: cur.c, s: cur.s, at: cur.at, pts: cur.pts });
    }
    cur = null;
    pen.down = false;
    Sound.stop();
    schedule();
    save();
    renderTools();
  }

  els.ink.addEventListener('pointerdown', (e) => {
    if (S.done || replaying) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    if (!held) hold(e);
    pen.x = e.pageX;
    pen.y = e.pageY;
    try { els.ink.setPointerCapture(e.pointerId); } catch (err) { /* 엽서 밖으로 나가면 획이 끝남 */ }
    startStroke(e);
  });
  els.ink.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    (list.length ? list : [e]).forEach(addPoint);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => els.ink.addEventListener(t, endStroke));

  // 연필은 손(마우스)을 따라다님
  window.addEventListener('pointermove', (e) => {
    if (!held) return;
    if (e.pointerType === 'touch' && !cur) return;
    const dt = e.timeStamp - pen.lastT;
    pen.vx = dt > 0 && dt < 100 ? (e.pageX - pen.lastX) / dt : 0;
    pen.lastX = e.pageX;
    pen.lastT = e.timeStamp;
    pen.x = e.pageX;
    pen.y = e.pageY;
    const overUi = !cur && e.target.closest && e.target.closest('button, a, textarea, input');
    els.layer.classList.toggle('is-faded', !!overUi);
    els.layer.classList.remove('is-away');
    schedule();
  });
  document.documentElement.addEventListener('mouseleave', () => { if (held) els.layer.classList.add('is-away'); });

  /* ── 메모지 ───────────────────────────── */

  function warn(text) {
    els.memoWarn.textContent = text;
    els.memoWarn.hidden = !text;
  }

  function renderMemo() {
    const has = !!S.jeju;
    els.memoAsk.hidden = has;
    els.memoDone.hidden = !has;
    document.body.classList.toggle('has-guide', has);
    els.hint.textContent = has ? '연필을 집어 따라 써 보세요' : '연필을 집어 보세요';
    if (!has) return;
    els.memoJeju.textContent = S.jeju;
    els.memoStd.textContent = S.std;
    els.memoPairs.textContent = '';
    const pairs = window.noteChanges ? window.noteChanges(S.std.replace(/\n/g, ' '), S.jeju.replace(/\n/g, ' ')).slice(0, 4) : [];
    pairs.forEach((p) => {
      const li = document.createElement('li');
      li.append(`${p.std} → `);
      const b = document.createElement('b');
      b.textContent = p.jeju;
      li.append(b);
      els.memoPairs.append(li);
    });
    els.memoPairs.hidden = !pairs.length;
  }

  function countMemo() {
    els.memoCount.textContent = `${els.memoInput.value.length} / ${els.memoInput.maxLength}`;
  }

  els.memoInput.addEventListener('input', () => { countMemo(); warn(''); });
  els.memoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); els.memoForm.requestSubmit(); }
  });

  els.memoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = els.memoInput.value.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
    if (!text) { warn('먼저 하고 싶은 말을 적어 주세요.'); els.memoInput.focus(); return; }
    if (window.findBadWord && window.findBadWord(text)) { warn(BAD_WORD_MESSAGE); return; }
    warn('');
    S.std = text;
    S.jeju = text.split('\n').map((line) => (window.noteToJeju ? window.noteToJeju(line) : line)).join('\n');
    S.guide = true;
    save();
    renderMemo();
    layoutGuide();
    renderTools();
    track('pc_desk_convert', {});
    if (window.innerWidth < 860) els.cardWindow.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  els.memoEdit.addEventListener('click', () => {
    els.memoInput.value = S.std;
    S.std = '';
    S.jeju = '';
    save();
    renderMemo();
    layoutGuide();
    renderTools();
    countMemo();
    els.memoInput.focus();
  });

  /* ── 도구 ─────────────────────────────── */

  let toastTimer = 0;
  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-on'), 2200);
  }

  function renderTools() {
    const vis = visibleStrokes();
    els.holdBtn.textContent = held ? '연필 내려놓기' : '연필 집기';
    els.eraserBtn.setAttribute('aria-pressed', String(held && eraser));
    els.eraserBtn.textContent = held && eraser ? '연필로 돌리기' : '지우개';
    els.undoBtn.disabled = !S.strokes.length;
    els.clearBtn.disabled = !vis.length;
    els.guideBtn.hidden = !S.jeju;
    els.guideBtn.setAttribute('aria-pressed', String(S.guide));
    els.guideBtn.textContent = S.guide ? '본 글씨 숨기기' : '본 글씨 보기';
    els.photoBtn.textContent = S.blank ? '그림 넣기' : '그림 바꾸기';
    els.blankBtn.disabled = S.blank;
  }

  // 필통: 색은 작은 연필이 꽂힌 모양, 굵기는 그 색으로 그은 줄 모양
  function buildTray() {
    LEADS.forEach((lead) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lead';
      b.dataset.lead = lead.id;
      b.dataset.track = `lead_${lead.id}`;   // track.js의 pc_click 단추 이름
      b.title = lead.id === 'graphite' ? '연필 (흑연)' : `${lead.name} 색연필`;
      b.setAttribute('aria-label', b.title);
      const [hi, mid, lo] = bodyOf(lead);
      b.innerHTML = `<svg viewBox="0 0 16 44" aria-hidden="true">
        <path d="M8 1 L5.5 8 H10.5 Z" fill="${rgb(lead.rgb)}"/>
        <path d="M5.5 8 L2 17 H14 L10.5 8 Z" fill="#ecca9c"/>
        <rect x="2" y="17" width="4" height="27" fill="${hi}"/><rect x="6" y="17" width="4" height="27" fill="${mid}"/><rect x="10" y="17" width="4" height="27" fill="${lo}"/>
      </svg>`;
      b.addEventListener('click', (e) => choose(e, lead.id, S.size));
      els.leadSet.append(b);
    });
    SIZES.forEach((size) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'size';
      b.dataset.size = size.id;
      b.dataset.track = `size_${size.id}`;
      b.title = `${size.name} 쓰기`;
      b.setAttribute('aria-label', b.title);
      b.innerHTML = `<svg viewBox="0 0 30 16" aria-hidden="true"><path d="M3 10 C8 3 12 13 17 7 S24 5 27 7" fill="none" stroke-linecap="round" stroke-width="${(size.k * 2.4).toFixed(1)}"/></svg>`;
      b.addEventListener('click', (e) => choose(e, S.lead, size.id));
      els.sizeSet.append(b);
    });
  }

  function renderTray() {
    els.leadSet.querySelectorAll('.lead').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lead === S.lead)));
    els.sizeSet.querySelectorAll('.size').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === S.size)));
    els.sizeSet.style.setProperty('--c', rgb(leadOf(S.lead).rgb));
    dressPencil(S.lead);
  }

  // 색이나 굵기를 고르면 지우개를 내려놓고 그 연필을 쥠
  function choose(e, leadId, sizeId) {
    if (S.done || replaying) return;
    const changed = leadId !== S.lead || sizeId !== S.size;
    S.lead = leadId;
    S.size = sizeId;
    renderTray();
    if (held && eraser) setEraser(false);
    else if (!held) hold(e.detail ? e : null);
    if (!changed) return;
    save();
    track('pc_desk_pencil', { color: leadId, size: sizeId });
  }

  function undo() {
    if (!S.strokes.length || cur) return;
    S.strokes.pop();
    redrawInk(inkCtx, els.ink.width);
    save();
    renderTools();
  }

  els.holdBtn.addEventListener('click', (e) => (held ? putDown() : hold(e.detail ? e : null)));
  els.spot.addEventListener('click', (e) => (held ? putDown() : hold(e.detail ? e : null)));
  els.pencil.addEventListener('pointerdown', (e) => { if (!held) { e.preventDefault(); hold(e); } });
  els.eraserBtn.addEventListener('click', () => setEraser(!(held && eraser)));
  els.undoBtn.addEventListener('click', undo);
  els.clearBtn.addEventListener('click', () => {
    if (!visibleStrokes().length) return;
    S.strokes.push({ tool: 'clear', at: Date.now(), pts: [] });
    redrawInk(inkCtx, els.ink.width);
    save();
    renderTools();
    toast('다 지웠어요. 되돌리기를 누르면 다시 살아나요');
  });
  els.guideBtn.addEventListener('click', () => {
    S.guide = !S.guide;
    save();
    layoutGuide();
    renderTools();
  });
  function redrawPhoto() {
    save();
    drawFace(faceCtx, els.face.width, els.face.height);
    renderTools();
  }

  // 그림 바꾸기: 엽서 그림 여섯 장과 내 사진을 차례로. 사진을 뺀 뒤에는 '그림 넣기'가 되어 빼기 전 그림을 다시 보여 줌
  els.photoBtn.addEventListener('click', () => {
    if (S.blank) S.blank = false;
    else S.photo = (S.photo + 1) % photoCount();
    redrawPhoto();
  });

  // 사진 빼기: 엽서 그림이든 내 사진이든 사진 칸을 비움. 내 사진이었으면 이 기기에서도 지움
  let beforeOwn = 0;   // 내 사진을 넣기 전에 보던 엽서 그림
  function removePhoto() {
    if (S.blank) return;
    const wasOwn = isOwn();
    if (wasOwn) {
      S.own = '';
      saveOwn();
      S.photo = beforeOwn;
    }
    S.blank = true;
    redrawPhoto();
    toast('사진을 뺐어요. 빈 자리에도 마음껏 써 보세요');
    track('pc_desk_photo_remove', { what: wasOwn ? 'own' : 'card' });
  }
  els.blankBtn.addEventListener('click', removePhoto);
  els.ownBtn.addEventListener('click', () => els.ownInput.click());
  els.ownInput.addEventListener('change', async () => {
    const file = els.ownInput.files && els.ownInput.files[0];
    els.ownInput.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('사진 파일을 골라 주세요'); return; }
    try {
      S.own = await fitOwn(file);
    } catch (e) {
      toast('이 사진은 열지 못했어요. 다른 사진으로 해 주세요');
      return;
    }
    if (S.photo < PHOTOS.length) beforeOwn = S.photo;
    S.photo = PHOTOS.length;
    S.blank = false;
    const kept = saveOwn();
    redrawPhoto();
    toast(kept ? '내 사진을 넣었어요. 그림 바꾸기로 엽서 그림과 번갈아 볼 수 있어요' : '사진을 넣었어요. 사진이 커서 새로고침하면 빠져요');
    track('pc_desk_photo', {});
  });
  els.doneBtn.addEventListener('click', finish);

  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('textarea, input')) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (S.done || replaying || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') putDown();
    else if (e.key.toLowerCase() === 'e' || e.key === 'ㄷ') setEraser(!(held && eraser));
  });

  els.soundBtn.addEventListener('click', () => renderSound(Sound.toggle()));
  function renderSound(on) {
    els.soundBtn.setAttribute('aria-pressed', String(on));
    els.soundBtn.textContent = on ? '연필 소리 켬' : '연필 소리 끔';
  }

  /* ── 다 썼어요 ─────────────────────────── */

  function strokeEnd(st) { return st.at + (st.pts.length ? st.pts[st.pts.length - 1][3] : 0); }

  function duration(ms) {
    const s = Math.max(1, Math.round(ms / 1000));
    return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분${s % 60 ? ` ${s % 60}초` : ''}`;
  }

  /* ── 따라 쓰기 점수 ─────────────────────
     본 글씨를 엽서 위 자리 그대로 작은 그림에 옮겨 그리고, 손글씨를 겹쳐 봄
     - 따라 쓴 몫: 본 글씨 획 가운데 손글씨가 지나간 몫
     - 글씨 위에 쓴 몫: 본 글씨 둘레에 그은 줄 가운데 본 글씨 근처에 있는 몫 (엽서 다른 곳의 낙서 · 서명은 셈하지 않음)
     둘을 곱해 100점으로 바꿈. 마우스 · 손가락으로 쓴 걸 감안해 글자 크기의 7%만큼은 비켜 가도 맞은 걸로 침
     맞춰 보려면 주소 끝에 ?score-debug를 붙이고 콘솔에서 __scoreHand()를 부름 */
  const SCORE_W = 1000;
  const SCORE_TOL = 0.07;
  const SCORE_RANKS = [
    [90, '펜글씨 교본이 울고 가겠어요'],
    [75, '또박또박 모범생 글씨'],
    [60, '정성이 꾹꾹 묻어나요'],
    [40, '삐뚤빼뚤 매력 만점'],
    [0, '추상화가의 손글씨'],
  ];

  // 옛한글처럼 여러 낱자가 모여 한 글자가 되는 걸 한 덩어리로
  function clusters(text) {
    if (window.Intl && Intl.Segmenter) {
      return [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text)].map((s) => [s.index, s.index + s.segment.length]);
    }
    const out = [];
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      const joins = (c >= 0x1160 && c <= 0x11ff) || (c >= 0xd7b0 && c <= 0xd7ff) || c === 0x302e || c === 0x302f;
      if (joins && out.length) out[out.length - 1][1] = i + 1;
      else out.push([i, i + 1]);
    }
    return out;
  }

  function scoreHand(list) {
    const node = els.guide.firstChild;
    const size = parseFloat(els.guide.style.fontSize);
    if (!S.jeju || !node || !size) return null;
    const card = els.card.getBoundingClientRect();
    const k = SCORE_W / card.width;
    const MW = SCORE_W;
    const MH = Math.round(card.height * k);
    const fs = size * k;
    const tol = fs * SCORE_TOL;
    const font = `${fs}px ${HAND}`;

    // 본 글씨: 글자마다 화면에 놓인 자리를 재서 같은 자리에 그림
    const range = document.createRange();
    const glyphs = [];
    clusters(node.textContent).forEach(([a, b]) => {
      const ch = node.textContent.slice(a, b);
      if (!ch.trim()) return;
      range.setStart(node, a);
      range.setEnd(node, b);
      const r = range.getClientRects()[0];
      if (r) glyphs.push({ ch, x: (r.left - card.left) * k, top: (r.top - card.top) * k });
    });
    if (!glyphs.length) return null;

    const layer = (fn) => {
      const c = document.createElement('canvas');
      c.width = MW;
      c.height = MH;
      const g = c.getContext('2d');
      g.lineCap = 'round';
      g.lineJoin = 'round';
      fn(g);
      return g.getImageData(0, 0, MW, MH).data;
    };
    const guideLayer = (wide) => layer((g) => {
      g.font = font;
      g.textBaseline = 'alphabetic';
      const m = g.measureText('가');
      const ascent = m.fontBoundingBoxAscent || fs * 0.88;
      g.lineWidth = tol * 2;
      glyphs.forEach((p) => {
        g.fillText(p.ch, p.x, p.top + ascent);
        if (wide) g.strokeText(p.ch, p.x, p.top + ascent);
      });
    });
    const inkLayer = (extra) => layer((g) => {
      list.forEach((st) => {
        if (st.tool === 'clear') { g.clearRect(0, 0, MW, MH); return; }
        g.globalCompositeOperation = st.tool === 'e' ? 'destination-out' : 'source-over';
        const p = st.pts;
        for (let i = 0; i < p.length; i++) {
          const a = p[i];
          const b = p[Math.max(0, i - 1)];
          g.lineWidth = Math.max(1.5, a[2] * MW) + (st.tool === 'e' ? 0 : extra);
          g.beginPath();
          g.moveTo(b[0] * MW, b[1] * MW);
          g.lineTo(a[0] * MW + (i ? 0 : 0.01), a[1] * MW);
          g.stroke();
        }
      });
    });
    const glyph = guideLayer(false);
    const glyphWide = guideLayer(true);
    const ink = inkLayer(0);
    const inkWide = inkLayer(tol * 2);

    // 글씨 위에 쓴 몫은 본 글씨 둘레(한 줄 간격만큼 넉넉히)에 그은 줄만 셈
    const gr = els.guide.getBoundingClientRect();
    const pad = L.gap * card.height * k;
    const x0 = Math.max(0, Math.floor((gr.left - card.left) * k - pad));
    const x1 = Math.min(MW, Math.ceil((gr.right - card.left) * k + pad));
    const y0 = Math.max(0, Math.floor((gr.top - card.top) * k - pad));
    const y1 = Math.min(MH, Math.ceil((gr.bottom - card.top) * k + pad));

    let need = 0;
    let traced = 0;
    let drawn = 0;
    let onText = 0;
    for (let i = 3; i < glyph.length; i += 4) {
      if (glyph[i] > 100) { need += 1; if (inkWide[i] > 100) traced += 1; }
    }
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * MW + x) * 4 + 3;
        if (ink[i] > 100) { drawn += 1; if (glyphWide[i] > 100) onText += 1; }
      }
    }
    if (!need) return null;
    const recall = traced / need;
    const precision = drawn ? onText / drawn : 0;
    // 따라 쓴 몫을 조금 더 무겁게. 컴퓨터 화면에서 획 가운데를 따라 찍은 점에 손떨림을 줘 맞춰 본 값:
    // 떨림 최대 3px 99점 · 7px 80점 · 10px 60점 · 21px 45점 · 앞 절반만 씀 60점 · 글씨 칸을 온통 칠함 24점
    const score = Math.round(100 * recall ** 1.2 * precision ** 0.9);
    return { score, recall, precision, rank: SCORE_RANKS.find(([min]) => score >= min)[1] };
  }

  if (/[?&]score-debug\b/.test(location.search)) window.__scoreHand = (list) => scoreHand(list || visibleStrokes());

  let countRaf = 0;
  function renderScore(res) {
    els.score.hidden = !res;
    cancelAnimationFrame(countRaf);
    if (!res) return;
    els.scoreRank.textContent = res.rank;
    // 화면 읽기 프로그램에는 올라가는 숫자 대신 마지막 점수를 한 번에 읽어 줌
    els.scoreLine.setAttribute('aria-label', `${res.score}점, ${res.rank}`);
    els.scoreWhy.textContent = `본 글씨를 ${Math.round(res.recall * 100)}% 따라 썼고, 그 둘레에 그은 줄의 ${Math.round(res.precision * 100)}%가 글씨 위에 있어요.`;
    // 빨간 펜으로 매기듯 숫자가 올라감
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    const step = (now) => {
      const f = still ? 1 : Math.min(1, (now - t0) / 900);
      els.scoreNum.textContent = String(Math.round(res.score * (1 - (1 - f) ** 3)));
      if (f < 1) countRaf = requestAnimationFrame(step);
    };
    countRaf = requestAnimationFrame(step);
  }

  function finish() {
    const vis = visibleStrokes();
    const lead = vis.filter((st) => st.tool === 'p');
    if (!lead.length) {
      toast('연필로 한 글자라도 써 주세요');
      return;
    }
    // 끝 화면으로 엽서 크기가 바뀌기 전에, 지금 보이는 본 글씨 자리로 채점
    let res = null;
    try { res = scoreHand(vis); } catch (e) { /* 채점이 안 돼도 끝 화면은 보임 */ }
    putDown();
    S.done = true;
    grade = res;
    document.body.classList.add('is-done');
    document.body.dataset.view = 'desk_done';   // track.js가 쓰는 화면 · 끝 화면에 머문 시간을 따로 잼
    layoutGuide();
    drawFace(faceCtx, els.face.width, els.face.height);   // 빨간 펜 점수를 엽서에
    const rubs = vis.filter((st) => st.tool === 'e').length;
    const colors = new Set(lead.map((st) => leadOf(st.c).id)).size;
    const ms = strokeEnd(vis[vis.length - 1]) - vis[0].at;
    els.stats.innerHTML = '';
    els.stats.append(
      ...(colors > 1 ? [bold(`${colors}가지 색`), '으로 '] : []),
      '연필을 ', bold(`${lead.length}번`), ' 대고, ',
      ...(rubs ? ['지우개를 ', bold(`${rubs}번`), ' 썼어요. '] : ['지우개 없이 썼어요. ']),
      bold(duration(ms)), ' 동안 꾹꾹 눌러 쓴 글씨예요.',
    );
    els.finish.hidden = false;
    renderScore(res);
    prepareShare();
    track('pc_desk_finish', { strokes: lead.length, erase: rubs, colors, sec: Math.round(ms / 1000), ...(res ? { score: res.score } : {}) });
    requestAnimationFrame(() => restPencil(true));   // 메모지가 빠지면서 자리가 바뀜
    if (window.innerWidth < 860) els.finish.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function bold(text) { const b = document.createElement('b'); b.textContent = text; return b; }

  function rewrite() {
    stopReplay();
    S.done = false;
    document.body.classList.remove('is-done');
    document.body.dataset.view = 'desk';
    els.finish.hidden = true;
    layoutGuide();
    drawFace(faceCtx, els.face.width, els.face.height);   // 고쳐 쓰는 동안은 점수를 지움
    setTimeout(() => restPencil(true), 520);
  }

  els.rewriteBtn.addEventListener('click', () => { rewrite(); track('pc_desk_rewrite', {}); });
  els.restartBtn.addEventListener('click', () => {
    if (!window.confirm('지금 쓴 엽서를 지우고 새로 쓸까요?')) return;
    S.strokes = [];
    S.std = '';
    S.jeju = '';
    S.guide = true;
    els.memoInput.value = '';
    countMemo();
    save();
    redrawInk(inkCtx, els.ink.width);
    renderMemo();
    rewrite();
    renderTools();
    track('pc_desk_restart', {});
  });

  /* ── 이미지로 저장 · 공유 ───────────────── */

  const CARD_W = 1800;
  const CARD_H = 1200;
  const fileBase = () => `하영고라보게-연필엽서-${today().replace(/\./g, '')}`;
  const toBlob = (canvas, type, q) => new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지'))), type, q);
  });

  async function cardCanvas() {
    try { await document.fonts.ready; } catch (e) { /* 글꼴을 못 기다려도 그림 */ }
    const out = document.createElement('canvas');
    out.width = CARD_W;
    out.height = CARD_H;
    const g = out.getContext('2d');
    drawFace(g, CARD_W, CARD_H);
    const layer = document.createElement('canvas');   // 지우개가 바탕까지 지우지 않게 따로 그려서 얹음
    layer.width = CARD_W;
    layer.height = CARD_H;
    redrawInk(layer.getContext('2d'), CARD_W);
    g.drawImage(layer, 0, 0);
    return out;
  }

  els.saveBtn.addEventListener('click', async () => {
    try {
      const blob = await toBlob(await cardCanvas(), 'image/png');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${fileBase()}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('이미지로 저장했어요');
      track('pc_desk_save', {});
    } catch (e) {
      toast('이미지를 만들지 못했어요. 다시 눌러 주세요');
    }
  });

  // 공유할 그림은 끝 화면이 열릴 때 미리 만들어 둠. 공유 창은 누른 직후에 열어야 막히지 않음
  let shareReady = null;
  function prepareShare() {
    shareReady = cardCanvas()
      .then((canvas) => toBlob(canvas, 'image/jpeg', 0.92))
      .then((blob) => new File([blob], `${fileBase()}.jpg`, { type: 'image/jpeg' }));
    shareReady.catch(() => { shareReady = null; });
  }

  // 점수가 있으면 공유 글에도 넣음: '따라 쓰기 27점(추상화가의 손글씨) 나왔어요. …'
  const shareText = () => `${grade ? `따라 쓰기 ${grade.score}점(${grade.rank}) 나왔어요. ` : ''}연필로 꾹꾹 눌러 쓴 제주어 엽서예요. 나도 써 보기:`;
  const shareLink = (source) => {
    const url = new URL(cfg.PENCIL_SHARE_URL || `${location.origin}${location.pathname}`);
    url.searchParams.set('utm_source', source);
    url.searchParams.set('utm_campaign', 'desk_share');
    return url.href;
  };

  // 카카오톡: 키가 있을 때만. 엽서 사이트 · 다섯 문항 화면(app.js)과 같은 방식(그림을 카카오에 올린 뒤 메시지로)
  const KAKAO_SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
  let kakaoLoading = null;
  function kakao() {
    if (!kakaoLoading) {
      kakaoLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = KAKAO_SDK;
        s.crossOrigin = 'anonymous';
        s.onload = () => {
          if (!window.Kakao.isInitialized()) window.Kakao.init(cfg.KAKAO_JS_KEY);
          resolve(window.Kakao);
        };
        s.onerror = () => { kakaoLoading = null; reject(new Error('카카오 SDK')); };
        document.head.append(s);
      });
    }
    return kakaoLoading;
  }

  async function shareKakao(file) {
    const K = await kakao();
    const res = await K.Share.uploadImage({ file: [file] });
    const url = shareLink('kakao');
    K.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: '손글씨 제주어 엽서가 도착했어요',
        description: `${grade ? `따라 쓰기 ${grade.score}점 · ${grade.rank}\n` : ''}하고 싶은 말을 적으면 제주어로 바꿔 드려요. 연필로 따라 써 보세요 · 하영 고라보게`,
        imageUrl: res.infos.original.url,
        imageWidth: CARD_W,
        imageHeight: CARD_H,
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [{ title: '나도 써 보기', link: { mobileWebUrl: url, webUrl: url } }],
    });
  }

  // 카카오톡 → 휴대폰 · 컴퓨터의 공유 창(그림 + 링크) → 링크만 공유 → 링크 복사
  async function shareCard() {
    if (!shareReady) prepareShare();
    let file;
    try { file = await shareReady; } catch (e) { toast('이미지를 만들지 못했어요. 다시 눌러 주세요'); return; }
    if ((cfg.KAKAO_JS_KEY || '').trim()) {
      try {
        await shareKakao(file);
        track('pc_desk_share', { method: 'kakao' });
        return;
      } catch (e) { console.warn(e); }
    }
    const url = shareLink('share');
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `${shareText()} ${url}` });
        track('pc_desk_share', { method: 'share_sheet' });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: '연필로 쓰는 엽서 · 하영 고라보게', text: shareText(), url });
        track('pc_desk_share', { method: 'share_link' });
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return;   // 공유 창을 닫음
    }
    try {
      await navigator.clipboard.writeText(`${shareText()} ${url}`);
      toast('링크를 복사했어요. 저장한 이미지와 함께 보내 보세요');
      track('pc_desk_share', { method: 'copy' });
    } catch (e) {
      toast('공유 창을 열지 못했어요. 이미지를 저장해서 보내 주세요');
    }
  }
  els.shareBtn.addEventListener('click', shareCard);

  /* ── 쓰는 모습 다시 보기 ───────────────── */

  function stopReplay() {
    if (!replaying) return;
    cancelAnimationFrame(replaying.raf);
    replaying = null;
    Sound.stop();
    document.body.classList.remove('is-replay');
    els.replayBtn.textContent = '쓰는 모습 다시 보기';
    redrawInk(inkCtx, els.ink.width);
    dressPencil(S.lead);
    restPencil(true);
  }

  function replay() {
    if (replaying) { stopReplay(); return; }
    const list = visibleStrokes();
    if (!list.length) return;

    // 획 사이 쉰 시간은 줄이고, 전체가 40초를 넘으면 더 빨리
    const GAP_MIN = 160;
    const GAP_MAX = 520;
    let raw = 0;
    list.forEach((st, i) => {
      if (i) raw += Math.min(GAP_MAX, Math.max(GAP_MIN, st.at - strokeEnd(list[i - 1])));
      raw += strokeEnd(st) - st.at;
    });
    const k = Math.max(1.5, raw / 40000);
    let t = 500;
    const plan = list.map((st, i) => {
      if (i) t += Math.min(GAP_MAX, Math.max(GAP_MIN, st.at - strokeEnd(list[i - 1]))) / k;
      const item = { st, start: t, dur: (strokeEnd(st) - st.at) / k, drawn: -1, ended: false };
      t += item.dur;
      return item;
    });
    const total = t + 300;

    inkCtx.clearRect(0, 0, els.ink.width, els.ink.height);
    document.body.classList.add('is-replay');
    els.replayBtn.textContent = '건너뛰기';
    track('pc_desk_replay', {});

    const rect = els.card.getBoundingClientRect();
    const ox = rect.left + window.scrollX;
    const oy = rect.top + window.scrollY;
    const at = (p) => [ox + p[0] * rect.width, oy + p[1] * rect.width];
    const t0 = performance.now();
    let last = plan[0].st.pts[0] || [L.x0, 0.3];

    replaying = { raf: 0 };
    moving(true);
    const step = (now) => {
      if (!replaying) return;
      const e = now - t0;
      let active = null;
      for (const item of plan) {
        if (e < item.start) break;
        const pts = item.st.pts;
        while (item.drawn + 1 < pts.length && item.start + pts[item.drawn + 1][3] / k <= e) {
          item.drawn += 1;
          drawPiece(inkCtx, els.ink.width, item.st, item.drawn);
        }
        if (item.drawn >= 0) last = pts[item.drawn];
        if (e >= item.start + item.dur && !item.ended && item.drawn === pts.length - 1) {
          drawEnd(inkCtx, els.ink.width, item.st);
          item.ended = true;
        }
        if (!item.ended) active = item;
      }

      const next = plan.find((item) => item.start > e);
      let x;
      let y;
      let lift = 1;
      if (active) {
        [x, y] = at(last);
        lift = 0.15;
        Sound.scratch(active.st.tool === 'e' ? 0.09 : 0.08 + Math.random() * 0.05, active.st.tool === 'e');
      } else if (next && next.st.pts.length) {
        // 다음 획 자리로 연필을 들어 옮김
        const prevEnd = plan.indexOf(next) > 0 ? plan[plan.indexOf(next) - 1].start + plan[plan.indexOf(next) - 1].dur : 0;
        const f = Math.min(1, Math.max(0, (e - prevEnd) / Math.max(1, next.start - prevEnd)));
        const a = at(last);
        const b = at(next.st.pts[0]);
        x = a[0] + (b[0] - a[0]) * f;
        y = a[1] + (b[1] - a[1]) * f;
      } else {
        [x, y] = at(last);
      }
      // 그 획을 쓴 연필로 바꿔 쥠 (다음 획으로 옮기는 동안 바뀜)
      const inHand = (active || next || plan[plan.length - 1]).st;
      if (inHand.tool === 'p') dressPencil(inHand.c);
      pose(x, y, WRITE_ANGLE + (inHand.tool === 'e' ? 180 : 0), inHand.tool === 'e' ? PENCIL_LEN : 0, lift);

      if (e >= total) { stopReplay(); return; }
      replaying.raf = requestAnimationFrame(step);
    };
    replaying.raf = requestAnimationFrame(step);
  }
  els.replayBtn.addEventListener('click', replay);

  /* ── 시작 ─────────────────────────────── */

  const postcardUrl = cfg.POSTCARD_URL || 'https://lxwebzine.hankyung.com/2026-1/team1/play/postcard/';
  els.logoLink.href = postcardUrl;
  els.toPostcard.href = postcardUrl;
  els.toPostcard.addEventListener('click', () => track('pc_desk_to_postcard', {}));

  load();
  els.memoInput.value = '';
  countMemo();
  renderMemo();
  buildTray();
  renderTray();
  renderTools();
  renderSound(Sound.isOn());
  layout();

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  });
  // 휴대폰에서 '전체'로 바꾸거나 다 썼을 때처럼 화면 크기는 그대로인데 엽서 크기만 바뀌어도 다시 그림
  if (window.ResizeObserver) {
    let seenW = els.card.offsetWidth;
    new ResizeObserver(() => {
      if (els.card.offsetWidth === seenW) return;
      seenW = els.card.offsetWidth;
      layout();
    }).observe(els.card);
  }

  // 휴대폰 엽서 보기: 글씨 쪽(크게) · 사진 쪽(크게) · 전체(작게)
  function setView(v) {
    els.desk.dataset.view = v;
    els.viewSwitch.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  }
  els.viewSwitch.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || els.desk.dataset.view === b.dataset.view) return;
    setView(b.dataset.view);
    track('pc_desk_side', { side: b.dataset.view });
  });
  setView('write');
  if (document.fonts) {
    document.fonts.load(`20px ${HAND}`).then(() => { drawFace(faceCtx, els.face.width, els.face.height); layoutGuide(); }).catch(() => {});
  }
  track('pc_desk_view', {});
})();
