// ---------- 인스타 캐러셀 만들기 ----------
// 사진을 넣고 글을 고쳐서 1080×1350 장을 만든다.
// 화면과 PNG는 캔버스로 그리고, 피그마용 SVG는 같은 배치(layout)를 글자 레이어로 쓴다.
// 사진과 글은 이 브라우저(IndexedDB)에만 남고 어디에도 올리지 않는다.

(function () {
  'use strict';

  const W = 1080, H = 1350;
  const SANS = 'Noto Sans KR';   // 피그마에 기본으로 있는 구글 글꼴이라 설치 없이 맞춰짐
  const HAND = 'Hayeong Hand';   // 하영 손글씨(아래아 됨). 피그마에서는 fonts-for-figma의 ttf를 설치해야 보임
  const FALLBACK = ', "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const EMPTY = '#d8d2c8';
  const INK = '#3e3832';         // 엽서 사이트 글자색

  // 처음 문구. [대괄호] 안은 강조색(하영 고라보게 로고 주황 #ff9767).
  // 제주어는 엽서 사이트 번역기(translate.js)로 실제 바꾼 결과만 씀
  //   많이 보고 싶어 → 하영 보고정 ᄒᆞ여 · 같이 → ᄒᆞᆫ듸 · 바다 → 바당 · 마음 → ᄆᆞ음
  const DEFAULT = {
    account: '하영 고라보게',
    accent: '#ff9767',
    slides: [
      { type: 'cover', tagR: 'JEJU', title: '[제주 여행 마지막 날]\n이것만은 꼭 하자!☆', sub: '친구랑 제주 왔다면 엽서 한 장은 제주어로' },
      { type: 'check', label: '여행 사진으로 엽서 만들기', caption: '돌하르방 자석의 시대는 갔다. 이제는 [제주어 엽서]\n찍어 둔 사진 넣어서 우리만의 엽서로 만들자!' },
      { type: 'check', label: '표준어로 쓰고 제주어로 바꾸기', caption: '‘많이 보고 싶어’가 [하영 보고정 ᄒᆞ여]로 바뀌어요\n같이는 [ᄒᆞᆫ듸], 바다는 [바당]. 제주어 몰라도 괜찮아요~' },
      { type: 'check', label: '카톡으로 보내고 게시판 구경하기', caption: '집 가는 비행기 타기 전에 카톡으로 툭!\n다른 여행자들은 [누구한테] 썼을까? 게시판에서 구경해요' },
      { type: 'check', label: '지금 바로 엽서 쓰러 가기', caption: '프로필 링크 누르면 [하영 고라보게]로 바로!\n당신의 ᄆᆞ음을 제주어로 전해 보세요' },
    ],
  };

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const n = (v) => Math.round(v * 100) / 100;
  const uid = () => Math.random().toString(36).slice(2, 10);

  let state = fresh();
  let curI = 0;
  const media = new Map();      // 장 id → 불러온 사진(img) 또는 영상(video)
  const overlays = new Map();   // 장 id → 피그마에서 내보낸 글 PNG(영상 장에만)
  const labelBox = new Map();   // 장 id → 체크 라벨 자리(끌기 판정용)

  function fresh() {
    return normalize(JSON.parse(JSON.stringify(DEFAULT)));
  }

  function normalize(st) {
    st.account = typeof st.account === 'string' ? st.account : DEFAULT.account;
    st.accent = /^#[0-9a-f]{6}$/i.test(st.accent || '') ? st.accent : DEFAULT.accent;
    st.slides = (st.slides || []).map(blank);
    if (!st.slides.length) st.slides.push(blank({ type: 'cover' }));
    return st;
  }

  function blank(s) {
    const cover = s.type === 'cover';
    return {
      id: s.id || uid(),
      type: cover ? 'cover' : 'check',
      tagR: s.tagR || '',
      title: s.title || '',
      sub: s.sub || '',
      label: s.label || '',
      caption: s.caption || '',
      labelY: typeof s.labelY === 'number' ? s.labelY : 560,
      shade: typeof s.shade === 'number' ? s.shade : (cover ? 0.6 : 0.35),
      photo: s.photo || null,       // { kind: 'image' | 'video', blob, w, h, zoom, fx, fy, dur }
      sound: s.sound !== false,     // 영상 소리를 MP4에 넣을지
      overlay: s.overlay || null,   // { blob } 피그마 글 PNG
    };
  }

  const cur = () => state.slides[curI];
  const isVideo = (s) => !!(s.photo && s.photo.kind === 'video');
  // 영상 장에 피그마 글 PNG가 있으면 이 도구의 글 대신 그 PNG를 얹음
  const overlayOf = (s) => (isVideo(s) && s.overlay && overlays.get(s.id)) || null;

  // ---------- 색 ----------

  function rgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function mix(a, b, t) {
    const x = rgb(a), y = rgb(b);
    return '#' + x.map((c, k) => Math.round(c + (y[k] - c) * t).toString(16).padStart(2, '0')).join('');
  }
  function rgba(hex, a) {
    const [r, g, b] = rgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  function palette() {
    const a = state.accent;
    return {
      accent: a,
      labelFill: mix(a, '#ffffff', 0.6),
      labelLine: mix(a, '#000000', 0.12),
      glow: mix(a, '#000000', 0.22),   // 강조색 글자가 빛에 묻히지 않게 한 톤 어둡게
    };
  }

  // 그림자. blur는 피그마의 Blur 값과 같음(SVG stdDeviation = blur / 2)
  const SH = {
    soft: [{ dx: 0, dy: 1, blur: 8, color: '#000000', alpha: 0.35 }],
    title: [{ dx: 0, dy: 2, blur: 28, color: '#000000', alpha: 0.4 }],
    sub: [{ dx: 0, dy: 1, blur: 12, color: '#000000', alpha: 0.45 }],
    glow: (c) => [{ dx: 0, dy: 0, blur: 14, color: c, alpha: 1 }, { dx: 0, dy: 0, blur: 4, color: c, alpha: 0.9 }],
  };

  // ---------- 배치 ----------
  // 장 하나를 그릴 거리(사진 · 그늘 · 글 · 라벨)의 목록으로 바꾼다. 캔버스와 SVG가 같은 목록을 씀

  const mctx = document.createElement('canvas').getContext('2d');
  const hasLS = 'letterSpacing' in mctx;

  function cssFont(p) {
    return `${p.weight} ${p.size}px "${p.family}"${FALLBACK}`;
  }
  function useFont(ctx, p) {
    ctx.font = cssFont(p);
    if (hasLS) ctx.letterSpacing = (p.ls || 0) * p.size + 'px';
  }
  function textWidth(p) {
    useFont(mctx, p);
    return p.runs.reduce((w, r) => w + mctx.measureText(r.text).width, 0);
  }

  // '이제는 [제주어 엽서]' → 기본색 조각과 강조색 조각
  function toRuns(line, base, accent) {
    const out = [];
    const re = /\[([^\]]*)\]/g;
    let last = 0, m;
    while ((m = re.exec(line))) {
      if (m.index > last) out.push({ text: line.slice(last, m.index), color: base });
      if (m[1]) out.push({ text: m[1], color: accent });
      last = re.lastIndex;
    }
    if (last < line.length) out.push({ text: line.slice(last), color: base });
    return out.filter((r) => r.text);
  }

  // 여러 줄 글. 가장 긴 줄이 maxW를 넘으면 글자 크기를 줄여 맞춤
  function block(text, o, accent) {
    const lines = String(text || '').split('\n').filter((l) => l.trim()).slice(0, o.max);
    const items = lines.map((l) => ({
      t: 'text', family: o.family, weight: o.weight, size: o.size, ls: o.ls || 0,
      color: o.color, shadows: o.shadows || null, runs: toRuns(l, o.color, accent),
    }));
    const widest = Math.max(0, ...items.map(textWidth));
    const size = widest > o.maxW ? Math.floor(o.size * o.maxW / widest) : o.size;
    items.forEach((p) => { p.size = size; p.w = textWidth(p); });
    return { items, size };
  }

  function layout(i) {
    const s = state.slides[i];
    return s.type === 'cover' ? coverLayout(s) : checkLayout(s);
  }

  function coverLayout(s) {
    const pal = palette();
    const P = [{ t: 'photo' }];
    if (s.shade > 0) P.push({ t: 'shade', id: '아래 그늘', y0: H * 0.36, y1: H, alpha: n(s.shade * 0.85) });

    const tag = { family: SANS, weight: 700, size: 30, color: '#ffffff', shadows: SH.soft, max: 1, maxW: 440 };
    const left = block(state.account, tag, '#ffffff').items[0];
    if (left) P.push(Object.assign(left, { id: '계정', x: 72, y: 215 }));
    const right = block(s.tagR, tag, '#ffffff').items[0];
    if (right) P.push(Object.assign(right, { id: '위 오른쪽 글', x: W - 72 - right.w, y: 215 }));

    const x = 96;
    const title = block(s.title, { family: SANS, weight: 800, size: 88, ls: -0.02, color: '#ffffff', shadows: SH.title, max: 3, maxW: W - x * 2 }, pal.accent);
    const sub = block(s.sub, { family: HAND, weight: 400, size: 38, color: '#ffffff', shadows: SH.sub, max: 2, maxW: W - x * 2 }, pal.accent);

    // 아래에서부터 쌓음: 작은 글 마지막 줄 바닥선이 1130
    const subLH = sub.size * 1.45, titleLH = title.size * 1.36;
    const subTop = 1130 - (sub.items.length - 1) * subLH;
    const titleLast = sub.items.length ? subTop - sub.size - 50 : 1130;
    title.items.forEach((p, k) => {
      P.push(Object.assign(p, { id: '제목 ' + (k + 1), x, y: titleLast - (title.items.length - 1 - k) * titleLH }));
    });
    sub.items.forEach((p, k) => {
      P.push(Object.assign(p, { id: '작은 글' + (k ? ' ' + (k + 1) : ''), x: x + 2, y: subTop + k * subLH }));
    });
    return P;
  }

  function checkLayout(s) {
    const pal = palette();
    const P = [{ t: 'photo' }];
    if (s.shade > 0) P.push({ t: 'shade', id: '아래 그늘', y0: H * 0.6, y1: H, alpha: n(s.shade * 0.8) });

    const acc = block(state.account, { family: SANS, weight: 700, size: 26, color: '#ffffff', shadows: SH.soft, max: 1, maxW: 600 }, '#ffffff').items[0];
    if (acc) P.push(Object.assign(acc, { id: '계정', x: (W - acc.w) / 2, y: 66 }));

    // 체크 라벨: 왼쪽 끝에 붙은 강조색 띠 + 체크 + 손글씨
    labelBox.delete(s.id);
    const lt = block(s.label, { family: HAND, weight: 400, size: 36, color: INK, max: 1, maxW: W - 160 }, INK).items[0];
    if (lt) {
      const h = 70, y = s.labelY, cs = 26, cx = 32;
      useFont(mctx, lt);
      const m = mctx.measureText('가나다');
      const tx = cx + cs + 16;
      const w = tx + lt.w + 34;
      Object.assign(lt, { id: '라벨 글', x: tx, y: y + h / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 });
      const box = { x: -4, y, w: w + 4, h };
      labelBox.set(s.id, box);
      P.push(Object.assign({ t: 'label', fill: pal.labelFill, stroke: pal.labelLine, check: { x: cx, y: y + h / 2 - cs / 2, s: cs }, text: lt }, box));
    }

    // 아래 글: 가운데 정렬, 마지막 줄 바닥선이 1262
    const cap = block(s.caption, { family: HAND, weight: 400, size: 36, color: '#ffffff', shadows: SH.glow(pal.glow), max: 3, maxW: W - 80 }, pal.accent);
    const lh = cap.size * 1.55;
    cap.items.forEach((p, k) => {
      P.push(Object.assign(p, { id: '아래 글 ' + (k + 1), x: (W - p.w) / 2, y: 1262 - (cap.items.length - 1 - k) * lh }));
    });
    return P;
  }

  function crop(ph) {
    const sc = Math.max(W / ph.w, H / ph.h) * ph.zoom;
    const sw = W / sc, sh = H / sc;
    return { sx: (ph.w - sw) * ph.fx, sy: (ph.h - sh) * ph.fy, sw, sh, sc };
  }

  function checkPoints(c) {
    return [[c.x + 1, c.y + c.s * 0.55], [c.x + c.s * 0.38, c.y + c.s * 0.9], [c.x + c.s, c.y + c.s * 0.1]];
  }

  // ---------- 캔버스로 그리기 (화면 · PNG) ----------

  // mediaEl: 녹화할 때 쓰는 영상처럼, 장에 든 것 대신 그릴 사진 · 영상
  function paint(ctx, i, preview, mediaEl) {
    ctx.clearRect(0, 0, W, H);
    paintPhoto(ctx, state.slides[i], preview, mediaEl);
    paintLayer(ctx, i);
  }

  // 사진 위에 얹는 것(그늘 · 글 · 라벨). 피그마 글 PNG가 있으면 그것만
  function paintLayer(ctx, i) {
    const L = layout(i);   // 라벨 끌기 자리도 여기서 정해지므로 PNG가 있어도 부름
    const ov = overlayOf(state.slides[i]);
    if (ov) { ctx.drawImage(ov, 0, 0, W, H); return; }
    for (const p of L) {
      if (p.t === 'photo') continue;
      if (p.t === 'shade') {
        const g = ctx.createLinearGradient(0, p.y0, 0, p.y1);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${p.alpha})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, p.y0, W, p.y1 - p.y0);
      } else if (p.t === 'text') paintText(ctx, p);
      else if (p.t === 'label') {
        ctx.fillStyle = p.fill;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.save();
        ctx.strokeStyle = p.text.color;
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        checkPoints(p.check).forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.restore();
        paintText(ctx, p.text);
      }
    }
  }

  function paintPhoto(ctx, s, preview, mediaEl) {
    const img = s.photo && (mediaEl || media.get(s.id));
    if (img) {
      const c = crop(s.photo);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, 0, 0, W, H);
      return;
    }
    ctx.fillStyle = EMPTY;
    ctx.fillRect(0, 0, W, H);
    if (!preview) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.font = `700 40px "${SANS}"${FALLBACK}`;
    ctx.textAlign = 'center';
    ctx.fillText('여기에 사진이나 영상을', W / 2, 520);
    ctx.fillText('끌어다 놓거나 눌러서 넣어 주세요', W / 2, 580);
    ctx.restore();
  }

  // 그림자는 글자를 화면 밖에 그리고 그림자만 제자리로 보내서 따로 깔고, 글자는 한 번만 칠함
  // (SVG의 '그림자 + 원래 글자'와 같은 결과)
  const OFF = 10000;
  function paintText(ctx, p) {
    ctx.save();
    useFont(ctx, p);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (const sh of p.shadows || []) {
      ctx.save();
      ctx.shadowColor = rgba(sh.color, sh.alpha);
      ctx.shadowBlur = sh.blur;
      ctx.shadowOffsetX = sh.dx + OFF;
      ctx.shadowOffsetY = sh.dy;
      ctx.fillStyle = '#000';
      let x = p.x - OFF;
      for (const r of p.runs) { ctx.fillText(r.text, x, p.y); x += ctx.measureText(r.text).width; }
      ctx.restore();
    }
    let x = p.x;
    for (const r of p.runs) {
      ctx.fillStyle = r.color;
      ctx.fillText(r.text, x, p.y);
      x += ctx.measureText(r.text).width;
    }
    ctx.restore();
  }

  // ---------- SVG로 쓰기 (피그마) ----------
  // 피그마가 SVG를 내보낼 때 쓰는 모양을 따름: 이미지 채우기는 pattern, 그림자는 drop shadow 필터.
  // 그래야 피그마로 가져갔을 때 사진은 이미지 채우기, 글은 고칠 수 있는 글 레이어, 그림자는 효과로 들어감

  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function shadowFilter(id, shadows) {
    let out = `<filter id="${id}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">`
      + '<feFlood flood-opacity="0" result="BackgroundImageFix"/>';
    let prev = 'BackgroundImageFix';
    shadows.forEach((sh, k) => {
      const [r, g, b] = rgb(sh.color).map((c) => n(c / 255));
      const res = `effect${k + 1}_dropShadow`;
      out += '<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>'
        + `<feOffset${sh.dx ? ` dx="${sh.dx}"` : ''}${sh.dy ? ` dy="${sh.dy}"` : ''}/>`
        + `<feGaussianBlur stdDeviation="${sh.blur / 2}"/>`
        + '<feComposite in2="hardAlpha" operator="out"/>'
        + `<feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${sh.alpha} 0"/>`
        + `<feBlend mode="normal" in2="${prev}" result="${res}"/>`;
      prev = res;
    });
    return out + `<feBlend mode="normal" in="SourceGraphic" in2="${prev}" result="shape"/></filter>`;
  }

  // 사진은 보이는 자리만 잘라 넣음(최대 2배 해상도). 영상은 지금 멈춘 화면 한 장
  function photoData(s) {
    const img = media.get(s.id), c = crop(s.photo);
    const k = clamp(c.sw / W, 1, 2);
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * k);
    cv.height = Math.round(H * k);
    const x = cv.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, c.sx, c.sy, c.sw, c.sh, 0, 0, cv.width, cv.height);
    return { url: cv.toDataURL('image/jpeg', 0.92), w: cv.width, h: cv.height };
  }

  function svgOf(i) {
    const s = state.slides[i];
    const defs = [], body = [];
    let fid = 0;

    const text = (p) => {
      const spans = p.runs.map((r, k) =>
        `<tspan${k ? '' : ` x="${n(p.x)}" y="${n(p.y)}"`}${r.color !== p.color ? ` fill="${r.color}"` : ''}>${esc(r.text)}</tspan>`).join('');
      const t = `<text id="${esc(p.id)}" fill="${p.color}" xml:space="preserve" style="white-space: pre" font-family="${p.family}" font-size="${p.size}" font-weight="${p.weight}"${p.ls ? ` letter-spacing="${p.ls}em"` : ''}>${spans}</text>`;
      if (!p.shadows) return t;
      const id = `filter${fid++}_d`;
      defs.push(shadowFilter(id, p.shadows));
      return `<g filter="url(#${id})">${t}</g>`;
    };

    for (const p of layout(i)) {
      if (p.t === 'photo') {
        if (s.photo && media.get(s.id)) {
          const d = photoData(s);
          // 피그마는 영상을 내보내지 못하므로 영상 장은 멈춘 화면으로 자리만 잡음
          body.push(`<rect id="${isVideo(s) ? '영상 자리(멈춘 화면)' : '사진'}" width="${W}" height="${H}" fill="url(#pattern0)"/>`);
          defs.push(`<pattern id="pattern0" patternContentUnits="objectBoundingBox" width="1" height="1"><use xlink:href="#image0" transform="scale(${1 / d.w} ${1 / d.h})"/></pattern>`
            + `<image id="image0" width="${d.w}" height="${d.h}" xlink:href="${d.url}"/>`);
        } else {
          body.push(`<rect id="사진" width="${W}" height="${H}" fill="${EMPTY}"/>`);
        }
      } else if (p.t === 'shade') {
        body.push(`<rect id="${p.id}" y="${n(p.y0)}" width="${W}" height="${n(p.y1 - p.y0)}" fill="url(#shade0)"/>`);
        defs.push(`<linearGradient id="shade0" x1="0" y1="${n(p.y0)}" x2="0" y2="${n(p.y1)}" gradientUnits="userSpaceOnUse"><stop stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="${p.alpha}"/></linearGradient>`);
      } else if (p.t === 'text') {
        body.push(text(p));
      } else if (p.t === 'label') {
        const d = checkPoints(p.check).map(([x, y], k) => (k ? 'L' : 'M') + n(x) + ' ' + n(y)).join('');
        body.push(`<g id="체크 라벨"><rect id="라벨 바탕" x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${p.h}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="2"/>`
          + `<path id="체크" d="${d}" stroke="${p.text.color}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>${text(p.text)}</g>`);
      }
    }
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n`
      + body.join('\n') + '\n<defs>\n' + defs.join('\n') + '\n</defs>\n</svg>\n';
  }

  // ---------- 글꼴 ----------

  function allText() {
    return [state.account, ...state.slides.map((s) => [s.tagR, s.title, s.sub, s.label, s.caption].join(' '))].join(' ');
  }

  // 구글 글꼴은 글자 범위별로 나눠 받으므로 실제 쓰는 글자로 불러야 함
  function loadFonts(text) {
    const t = (text || '') + ' JEJU가나다';
    const all = [`800 88px "${SANS}"`, `700 30px "${SANS}"`, `400 36px "${HAND}"`].map((f) => document.fonts.load(f, t).catch(() => []));
    return Promise.race([Promise.all(all), new Promise((r) => setTimeout(r, 5000))]);
  }

  function fontLoaded(family) {
    for (const f of document.fonts) if (f.family.replace(/["']/g, '') === family && f.status === 'loaded') return true;
    return false;
  }

  function fontNotice() {
    const miss = [];
    if (!fontLoaded(HAND)) miss.push('손글씨(Hayeong Hand)를 못 불러왔어요. fonts-for-figma 폴더의 ttf를 설치하거나 로컬 서버로 열어 주세요.');
    if (!fontLoaded(SANS)) miss.push('제목 글꼴(Noto Sans KR)을 못 불러와 비슷한 글꼴로 보여요. 인터넷 연결을 확인해 주세요. SVG에는 Noto Sans KR로 들어가요.');
    $('fontWarn').hidden = !miss.length;
    $('fontWarn').textContent = miss.join(' ');
  }

  // ---------- 화면 ----------

  const stage = $('stage');
  const sctx = stage.getContext('2d');
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const octx = off.getContext('2d');
  let thumbs = [];

  function buildStrip() {
    const strip = $('strip');
    strip.textContent = '';
    thumbs = state.slides.map((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cr-th' + (i === curI ? ' on' : '');
      b.setAttribute('aria-label', `${i + 1}장`);
      const c = document.createElement('canvas');
      c.width = 192;
      c.height = 240;
      const tag = document.createElement('span');
      tag.textContent = i + 1;
      b.append(c, tag);
      b.addEventListener('click', () => select(i));
      dropTarget(b, i);
      strip.append(b);
      return c;
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'cr-add';
    add.textContent = '+ 장 더하기';
    add.addEventListener('click', addSlide);
    strip.append(add);
  }

  function thumb(i, src) {
    const c = thumbs[i];
    if (c) c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  }

  function renderAll() {
    state.slides.forEach((s, i) => {
      if (i === curI) return;
      paint(octx, i, true);
      thumb(i, off);
    });
    paintNow();
  }

  function paintNow() {
    paint(sctx, curI, true);
    thumb(curI, stage);
  }

  let raf = 0;
  function requestPaint() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; paintNow(); });
  }

  const F = {
    tagR: $('fTagR'), title: $('fTitle'), sub: $('fSub'), label: $('fLabel'), caption: $('fCaption'),
    zoom: $('fZoom'), shade: $('fShade'), account: $('fAccount'), accent: $('fAccent'), sound: $('fSound'),
  };

  function select(i) {
    curI = clamp(i, 0, state.slides.length - 1);
    const s = cur();
    document.querySelectorAll('.cr-th').forEach((b, k) => b.classList.toggle('on', k === curI));
    $('slideTitle').textContent = `${curI + 1}장 · ${s.type === 'cover' ? '표지' : '체크'}`;
    document.querySelectorAll('[data-for]').forEach((el) => { el.hidden = el.dataset.for !== s.type; });
    ['tagR', 'title', 'sub', 'label', 'caption'].forEach((k) => { F[k].value = s[k]; });
    F.shade.value = s.shade;
    F.zoom.value = s.photo ? s.photo.zoom : 1;
    F.zoom.disabled = !s.photo;
    $('clearPhoto').disabled = !s.photo;
    $('moveL').disabled = curI === 0;
    $('moveR').disabled = curI === state.slides.length - 1;
    $('delSlide').disabled = state.slides.length < 2;
    // 영상 장: 소리 · 피그마 글 PNG 칸을 보이고, 내보내기는 PNG 대신 MP4
    const video = isVideo(s);
    $('videoSec').hidden = !video;
    $('onePng').hidden = video;
    $('oneMp4').hidden = !video;
    if (video) {
      F.sound.checked = s.sound;
      $('videoInfo').textContent = `영상 ${s.photo.dur ? s.photo.dur.toFixed(1) + '초' : ''} · MP4는 영상 길이만큼 재생하며 만들어요.`;
      $('clearOverlay').disabled = !s.overlay;
    }
    $('overlayNote').hidden = !overlayOf(s);
    document.querySelectorAll('.cr-th span').forEach((t, k) => { t.textContent = (k + 1) + (isVideo(state.slides[k]) ? ' ▶' : ''); });
    paintNow();
    playCurrent();
  }

  // ---------- 영상 미리보기 ----------
  // 고른 장의 영상만 소리 없이 반복 재생하고, 재생되는 동안 미리보기를 계속 다시 그림

  let looping = false;
  function playCurrent() {
    const el = media.get(cur().id);
    for (const m of media.values()) if (m !== el && m.tagName === 'VIDEO' && !m.paused) m.pause();
    if (!el || el.tagName !== 'VIDEO' || document.hidden) return;
    el.play().catch(() => {});
    if (looping) return;
    looping = true;
    const step = () => {
      const now = media.get(cur().id);
      if (!now || now.tagName !== 'VIDEO' || now.paused || document.hidden) { looping = false; return; }
      paintNow();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  document.addEventListener('visibilitychange', playCurrent);

  ['tagR', 'title', 'sub', 'label', 'caption'].forEach((k) => {
    F[k].addEventListener('input', () => {
      cur()[k] = F[k].value;
      requestPaint();
      loadFonts(F[k].value).then(requestPaint);
      saveSoon();
    });
  });
  F.shade.addEventListener('input', () => { cur().shade = +F.shade.value; requestPaint(); saveSoon(); });
  F.zoom.addEventListener('input', () => {
    if (!cur().photo) return;
    cur().photo.zoom = +F.zoom.value;
    requestPaint();
    saveSoon();
  });
  F.account.addEventListener('input', () => {
    state.account = F.account.value;
    loadFonts(state.account).then(renderAll);
    renderAll();
    saveSoon();
  });
  F.accent.addEventListener('input', () => { state.accent = F.accent.value; renderAll(); saveSoon(); });
  F.sound.addEventListener('change', () => { cur().sound = F.sound.checked; saveSoon(); });

  // ---------- 사진 · 영상 ----------

  function loadImage(blob) {
    return new Promise((ok, no) => {
      const url = URL.createObjectURL(blob);
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => { URL.revokeObjectURL(url); no(new Error('decode')); };
      im.src = url;
    });
  }

  // 소리 없이 반복 재생하는 미리보기용 영상. 첫 화면이 그려질 수 있을 때까지 기다림
  function loadVideo(blob) {
    return new Promise((ok, no) => {
      const url = URL.createObjectURL(blob);
      const v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'auto';
      const fail = () => { clearTimeout(timer); URL.revokeObjectURL(url); v.removeAttribute('src'); no(new Error('decode')); };
      const timer = setTimeout(fail, 15000);
      v.onloadeddata = () => {
        if (!v.videoWidth) return fail();   // 소리만 열리고 화면은 못 푼 경우
        clearTimeout(timer);
        ok(v);
      };
      v.onerror = fail;
      v.src = url;
    });
  }

  function forget(id) {
    const old = media.get(id);
    if (old) {
      if (old.tagName === 'VIDEO') old.pause();
      URL.revokeObjectURL(old.src);
    }
    media.delete(id);
  }

  function forgetOverlay(id) {
    const old = overlays.get(id);
    if (old) URL.revokeObjectURL(old.src);
    overlays.delete(id);
  }

  const MAX_SIDE = 3200;   // 이보다 큰 사진은 줄여서 둠(1080×1350의 2배를 넉넉히 넘는 크기)
  const isVideoFile = (f) => /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name);

  async function setVideo(i, file) {
    const s = state.slides[i];
    let v;
    try { v = await loadVideo(file); } catch (e) {
      toast('이 영상은 브라우저가 열지 못해요. MP4(H.264)로 바꾸거나 Safari로 열어 주세요.');
      return false;
    }
    forget(s.id);
    media.set(s.id, v);
    s.photo = { kind: 'video', blob: file, w: v.videoWidth, h: v.videoHeight, zoom: 1, fx: 0.5, fy: 0.5, dur: v.duration };
    return true;
  }

  async function setPhoto(i, file) {
    if (isVideoFile(file)) return setVideo(i, file);
    const s = state.slides[i];
    let img;
    try { img = await loadImage(file); } catch (e) {
      toast('이 사진은 브라우저가 열지 못해요. JPG나 PNG로 바꿔서 넣어 주세요.');
      return false;
    }
    let blob = file;
    if (Math.max(img.naturalWidth, img.naturalHeight) > MAX_SIDE) {
      const k = MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      img = await loadImage(blob);
    }
    forget(s.id);
    media.set(s.id, img);
    s.photo = { kind: 'image', blob, w: img.naturalWidth, h: img.naturalHeight, zoom: 1, fx: 0.5, fy: 0.5 };
    return true;
  }

  // start번째 장부터 차례로 넣음. 장이 모자라면 체크 장을 더 만듦
  async function putPhotos(files, start) {
    const list = [...files].filter((f) => isVideoFile(f) || /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(f.name));
    if (!list.length) return;
    for (let k = 0; k < list.length; k++) {
      const i = start + k;
      if (i >= state.slides.length) state.slides.push(blank({ type: 'check' }));
      await setPhoto(i, list[k]);
    }
    buildStrip();
    renderAll();
    select(start);
    saveSoon();
    if (list.length > 1) toast(`${start + 1}장부터 ${list.length}개를 차례로 넣었어요.`);
  }

  // 피그마에서 글만 투명 PNG로 내보낸 것. 영상 위에 이 도구의 글 대신 얹음
  async function setOverlay(file) {
    const s = cur();
    let img;
    try { img = await loadImage(file); } catch (e) { toast('PNG를 열지 못했어요.'); return; }
    if (Math.abs(img.naturalWidth / img.naturalHeight - W / H) > 0.01) {
      toast(`PNG 비율이 4:5가 아니에요(${img.naturalWidth}×${img.naturalHeight}). 1080×1350 프레임 그대로 내보내 주세요.`);
    }
    forgetOverlay(s.id);
    overlays.set(s.id, img);
    s.overlay = { blob: file };
    select(curI);
    saveSoon();
  }

  $('pickOverlay').addEventListener('click', () => $('fileOverlay').click());
  $('fileOverlay').addEventListener('change', (e) => { if (e.target.files[0]) setOverlay(e.target.files[0]); e.target.value = ''; });
  $('clearOverlay').addEventListener('click', () => {
    forgetOverlay(cur().id);
    cur().overlay = null;
    select(curI);
    saveSoon();
  });

  $('pickPhoto').addEventListener('click', () => $('fileOne').click());
  $('bulkBtn').addEventListener('click', () => $('fileMany').click());
  $('fileOne').addEventListener('change', (e) => { putPhotos(e.target.files, curI); e.target.value = ''; });
  $('fileMany').addEventListener('change', (e) => { putPhotos(e.target.files, curI); e.target.value = ''; });
  $('clearPhoto').addEventListener('click', () => {
    forget(cur().id);
    cur().photo = null;
    select(curI);
    saveSoon();
  });

  function dropTarget(el, i) {
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop');
      putPhotos(e.dataTransfer.files, typeof i === 'function' ? i() : i);
    });
  }
  dropTarget(stage, () => curI);
  // 빈 곳에 떨어뜨려도 브라우저가 사진을 열어 버리지 않게
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  // ---------- 미리보기에서 끌기 ----------

  function toCanvas(e) {
    const r = stage.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }
  const inBox = (p, b) => b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e), s = cur();
    if (s.type === 'check' && !overlayOf(s) && inBox(p, labelBox.get(s.id))) drag = { mode: 'label', y0: p.y, start: s.labelY };
    else if (s.photo && media.has(s.id)) drag = { mode: 'pan', x0: p.x, y0: p.y, fx: s.photo.fx, fy: s.photo.fy };
    else drag = { mode: 'click' };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    const p = toCanvas(e), s = cur();
    if (!drag) {
      stage.style.cursor = s.type === 'check' && !overlayOf(s) && inBox(p, labelBox.get(s.id)) ? 'ns-resize'
        : (s.photo ? 'grab' : 'pointer');
      return;
    }
    if (drag.mode === 'label') {
      s.labelY = Math.round(clamp(drag.start + p.y - drag.y0, 100, H - 300));
      requestPaint();
    } else if (drag.mode === 'pan') {
      const ph = s.photo, c = crop(ph);
      const roomX = ph.w - c.sw, roomY = ph.h - c.sh;
      if (roomX > 0.5) ph.fx = clamp(drag.fx - (p.x - drag.x0) / c.sc / roomX, 0, 1);
      if (roomY > 0.5) ph.fy = clamp(drag.fy - (p.y - drag.y0) / c.sc / roomY, 0, 1);
      stage.style.cursor = 'grabbing';
      requestPaint();
    }
  });
  stage.addEventListener('pointerup', () => {
    if (drag && drag.mode === 'click') $('fileOne').click();
    else if (drag) saveSoon();
    drag = null;
  });
  stage.addEventListener('pointercancel', () => { drag = null; });
  stage.addEventListener('wheel', (e) => {
    const s = cur();
    if (!s.photo || !media.has(s.id)) return;
    e.preventDefault();
    s.photo.zoom = clamp(s.photo.zoom * Math.exp(-e.deltaY * 0.0015), 1, 4);
    F.zoom.value = s.photo.zoom;
    requestPaint();
    saveSoon();
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') select(curI - 1);
    if (e.key === 'ArrowRight') select(curI + 1);
  });

  // ---------- 장 더하기 · 옮기기 · 지우기 ----------

  function addSlide() {
    state.slides.splice(curI + 1, 0, blank({ type: 'check', label: '할 일 적기', caption: '아래 글 첫 줄\n아래 글 둘째 줄' }));
    curI += 1;
    buildStrip();
    renderAll();
    select(curI);
    saveSoon();
  }

  function move(d) {
    const j = curI + d;
    if (j < 0 || j >= state.slides.length) return;
    const a = state.slides;
    [a[curI], a[j]] = [a[j], a[curI]];
    curI = j;
    buildStrip();
    renderAll();
    select(curI);
    saveSoon();
  }
  $('moveL').addEventListener('click', () => move(-1));
  $('moveR').addEventListener('click', () => move(1));
  $('delSlide').addEventListener('click', () => {
    if (state.slides.length < 2 || !confirm(`${curI + 1}장을 지울까요?`)) return;
    forget(cur().id);
    state.slides.splice(curI, 1);
    curI = Math.min(curI, state.slides.length - 1);
    buildStrip();
    renderAll();
    select(curI);
    saveSoon();
  });
  $('resetAll').addEventListener('click', () => {
    if (!confirm('글과 사진을 모두 처음으로 되돌릴까요? 넣은 사진도 빠져요.')) return;
    state.slides.forEach((s) => forget(s.id));
    state = fresh();
    curI = 0;
    F.account.value = state.account;
    F.accent.value = state.accent;
    buildStrip();
    loadFonts(allText()).then(renderAll);
    renderAll();
    select(0);
    saveSoon();
  });

  // ---------- 내보내기 ----------

  function fileBase(i) {
    const s = state.slides[i];
    const name = s.type === 'cover' ? '표지' : (s.label.replace(/[[\]]/g, '').trim() || '체크');
    return `${String(i + 1).padStart(2, '0')} ${name}`.replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  const svgBlob = (i) => new Blob([svgOf(i)], { type: 'image/svg+xml' });
  function pngBlob(i) {
    paint(octx, i, false);
    return new Promise((r) => off.toBlob(r, 'image/png'));
  }

  // ---------- 영상 장 → MP4 ----------
  // 영상을 처음부터 끝까지 실제로 재생하면서 캔버스에 글과 함께 그리고, 그 캔버스를 녹화함.
  // 그래서 영상 길이만큼 걸리고, 그동안 이 탭이 화면에 떠 있어야 함(가려지면 브라우저가 그리기를 멈춤)

  function mp4Type(withAudio) {
    if (!window.MediaRecorder) return '';
    const a = withAudio ? ',mp4a.40.2' : '';
    return [`video/mp4;codecs=avc1.640028${a}`, `video/mp4;codecs=avc1.4d0028${a}`, `video/mp4;codecs=avc1${a}`, 'video/mp4']
      .find((t) => MediaRecorder.isTypeSupported(t)) || '';
  }

  // AudioContext는 버튼을 누른 그 순간에 만들어야 소리가 막히지 않음
  function makeAudio() {
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      return C ? new C() : null;
    } catch (e) { return null; }
  }

  let cancelRec = false;
  let hiddenWhileRec = false;

  async function mp4Blob(i, audioCtx, onProgress) {
    const s = state.slides[i];
    const v = await loadVideo(s.photo.blob);   // 미리보기와 따로 쓰는 녹화 전용 영상
    v.loop = false;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    // 글 층은 한 번만 그려 두고 매 화면 영상 위에 얹음
    const layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;
    paintLayer(layer.getContext('2d'), i);
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      paintPhoto(ctx, s, false, v);
      ctx.drawImage(layer, 0, 0);
    };
    frame();

    const stream = cv.captureStream(30);
    let withAudio = false;
    if (s.sound && audioCtx) {
      try {
        const dest = audioCtx.createMediaStreamDestination();
        audioCtx.createMediaElementSource(v).connect(dest);   // 스피커로는 안 나가고 녹화에만 들어감
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        v.muted = false;
        withAudio = true;
      } catch (e) { /* 소리 없이 녹화 */ }
    }
    const type = mp4Type(withAudio);
    if (!type) throw new Error('no-mp4');
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 12000000, audioBitsPerSecond: 192000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((r) => { rec.onstop = r; });

    rec.start(1000);
    try {
      await v.play();
      await new Promise((resolve) => {
        v.addEventListener('ended', resolve, { once: true });
        const step = () => {
          if (cancelRec || v.ended) return resolve();
          frame();
          onProgress(v.duration ? v.currentTime / v.duration : 0);
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      frame();
    } finally {
      v.pause();
      rec.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
      URL.revokeObjectURL(v.src);
    }
    return cancelRec ? null : new Blob(chunks, { type: 'video/mp4' });
  }

  function mp4Error(e) {
    if (e && e.message === 'no-mp4') return '이 브라우저는 MP4로 녹화하지 못해요. 최신 크롬이나 Safari로 열어 주세요.';
    if (e && e.message === 'decode') return '영상을 다시 열지 못했어요. 영상을 빼고 다시 넣어 주세요.';
    if (e && e.name === 'NotAllowedError') return '브라우저가 영상 재생을 막았어요. 페이지를 한 번 누른 뒤 다시 해 주세요.';
    return '영상을 만들지 못했어요. ' + (e && e.message ? e.message : '');
  }

  function busy(text, frac) {
    $('busy').hidden = false;
    $('busyText').textContent = text;
    $('busyBar').style.width = Math.round(clamp(frac || 0, 0, 1) * 100) + '%';
  }
  $('busyCancel').addEventListener('click', () => { cancelRec = true; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !$('busy').hidden) hiddenWhileRec = true; });

  // 녹화 앞뒤 정리: 미리보기 영상은 멈춰 두고, 끝나면 다시 재생
  async function recording(job) {
    const audioCtx = makeAudio();
    cancelRec = false;
    hiddenWhileRec = false;
    for (const m of media.values()) if (m.tagName === 'VIDEO') m.pause();
    try {
      await loadFonts(allText());
      return await job(audioCtx);
    } catch (e) {
      toast(mp4Error(e));
      return null;
    } finally {
      $('busy').hidden = true;
      if (audioCtx) audioCtx.close().catch(() => {});
      renderAll();
      playCurrent();
      if (hiddenWhileRec) toast('만드는 동안 탭이 가려져서 영상이 멈춰 녹화됐을 수 있어요. 다시 만들어 주세요.');
    }
  }

  function exportMp4(i) {
    return recording(async (audioCtx) => {
      const label = `${i + 1}장 영상 만드는 중`;
      busy(label, 0);
      const blob = await mp4Blob(i, audioCtx, (f) => busy(label, f));
      if (blob) download(blob, fileBase(i) + '.mp4');
      else toast('영상 만들기를 그만뒀어요.');
    });
  }

  async function zipOrEach(files, zipName) {
    if (window.JSZip) {
      const zip = new window.JSZip();
      files.forEach((f) => zip.file(f.name, f.blob));
      download(await zip.generateAsync({ type: 'blob' }), zipName);
    } else {
      // zip 도구를 못 불러왔으면(인터넷 끊김) 하나씩 받음
      for (const f of files) { download(f.blob, f.name); await new Promise((r) => setTimeout(r, 400)); }
    }
  }

  async function exportSvgAll() {
    await loadFonts(allText());
    await zipOrEach(state.slides.map((s, i) => ({ name: fileBase(i) + '.svg', blob: svgBlob(i) })), '캐러셀_피그마용_SVG.zip');
    toast('SVG를 받았어요. 압축을 풀고 피그마에 끌어다 놓으세요.');
  }

  // 올릴 파일: 사진 장은 PNG, 영상 장은 MP4
  function exportPostAll() {
    const total = state.slides.filter(isVideo).length;
    return recording(async (audioCtx) => {
      const files = [];
      let k = 0;
      for (let i = 0; i < state.slides.length; i++) {
        if (!isVideo(state.slides[i])) {
          files.push({ name: fileBase(i) + '.png', blob: await pngBlob(i) });
          continue;
        }
        k += 1;
        const label = `${i + 1}장 영상 만드는 중 (${k}/${total})`;
        busy(label, 0);
        const blob = await mp4Blob(i, audioCtx, (f) => busy(label, f));
        if (!blob) { toast('영상 만들기를 그만뒀어요.'); return; }
        files.push({ name: fileBase(i) + '.mp4', blob });
      }
      $('busy').hidden = true;
      await zipOrEach(files, '캐러셀_올릴파일.zip');
      toast(total ? 'PNG와 MP4를 받았어요.' : 'PNG를 받았어요.');
    });
  }

  $('zipSvg').addEventListener('click', exportSvgAll);
  $('zipPng').addEventListener('click', exportPostAll);
  $('oneSvg').addEventListener('click', () => download(svgBlob(curI), fileBase(curI) + '.svg'));
  $('onePng').addEventListener('click', async () => { download(await pngBlob(curI), fileBase(curI) + '.png'); renderAll(); });
  $('oneMp4').addEventListener('click', () => exportMp4(curI));
  $('copySvg').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(svgOf(curI));
      toast('복사했어요. 피그마 캔버스를 누르고 ⌘V 하세요.');
    } catch (e) {
      toast('복사가 막혔어요. 「SVG 받기」로 받아서 피그마에 끌어다 놓아 주세요.');
    }
  });

  // ---------- 저장 (이 브라우저의 IndexedDB) ----------

  let dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise((ok, no) => {
        const r = indexedDB.open('hy-carousel', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => no(r.error);
      });
    }
    return dbp;
  }
  async function dbGet() {
    const d = await db();
    return new Promise((ok, no) => {
      const q = d.transaction('kv').objectStore('kv').get('state-v2');
      q.onsuccess = () => ok(q.result);
      q.onerror = () => no(q.error);
    });
  }
  async function dbSet(v) {
    const d = await db();
    return new Promise((ok, no) => {
      const t = d.transaction('kv', 'readwrite');
      t.objectStore('kv').put(v, 'state-v2');
      t.oncomplete = ok;
      t.onerror = () => no(t.error);
    });
  }

  let saveTimer = 0;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { dbSet(state).catch(() => {}); }, 400);
  }

  // ---------- 알림 ----------

  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 3200);
  }

  // ---------- 시작 ----------

  async function start() {
    let saved = null;
    try { saved = await dbGet(); } catch (e) { /* 저장소를 못 쓰면 처음 문구로 */ }
    if (saved && saved.slides && saved.slides.length) {
      state = normalize(saved);
      for (const s of state.slides) {
        if (s.overlay && s.overlay.blob) {
          try { overlays.set(s.id, await loadImage(s.overlay.blob)); } catch (e) { s.overlay = null; }
        }
        if (!s.photo || !s.photo.blob) { s.photo = null; continue; }
        try {
          media.set(s.id, await (s.photo.kind === 'video' ? loadVideo : loadImage)(s.photo.blob));
        } catch (e) { s.photo = null; }
      }
    }
    F.account.value = state.account;
    F.accent.value = state.accent;
    buildStrip();
    select(0);
    await loadFonts(allText());
    renderAll();
    fontNotice();
    // 글꼴 조각이 늦게 도착해도 다시 그림
    document.fonts.addEventListener('loadingdone', () => { renderAll(); fontNotice(); });
  }

  // 확인용: 콘솔에서 SVG · MP4 결과를 볼 수 있게(내려받지 않고 Blob만 돌려줌)
  window.carousel = { svgOf, state: () => state, putPhotos, select, mp4: (i) => recording((a) => mp4Blob(i, a, () => {})) };

  start();
})();
