// ---------- 결과 이미지 시안 ----------
// 한 장 이미지(1080×1920, 인스타 스토리 · 휴대폰 화면 비율)를 그리는 방법들.
// 시안을 빼거나 더하려면 NOTE_DESIGNS 목록만 고치면 끝 화면의 고르기에 그대로 반영됨.
//   images(data): 미리 불러 둘 그림 파일
//   usesArt: 끝 화면에서 그림을 고를 수 있는 시안
//   paint(ctx, data, img): data.items = [{ label, a, sub }] (a: 답, sub: 자막에 함께 쓸 표준어)
// 옛한글(ᄒᆞ, ᄆᆞ)이 들어가는 글은 반드시 HAND로. 다른 글꼴에는 아래아가 없음.
// shakyLine · graphemes는 app.js에 있음.

(function () {
  const W = 1080;
  const H = 1920;
  const PAD = 84;
  const HAND = '"Hayeong Hand", "NanumMyeongjo YetHangul", serif';
  const SERIF = '"Bookk Myungjo", "Apple SD Gothic Neo", serif';
  const SANS = '"Gowun Dodum", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const INK = '#2f2b26';
  const SOFT = '#7b7368';
  const TANGERINE = '#d9823f';
  const TANGERINE_INK = '#a9581f';
  const SEA = '#5b8aa3';
  const LOGO = 'images/logo-goraboge.png';
  const MARK = 'images/stamp-goraboge.png';

  // 끝 화면에서 고르는 그림. fx, fy = 잘릴 때 남길 자리(0~1)
  const ARTS = [
    { src: 'images/card-03.webp', fx: 0.62, fy: 0.55 },
    { src: 'images/card-13.webp', fx: 0.5, fy: 0.8 },
    { src: 'images/card-12.webp', fx: 0.5, fy: 0.85 },
    { src: 'images/card-01.webp', fx: 0.5, fy: 0.85 },
    { src: 'images/card-04.webp', fx: 0.6, fy: 0.6 },
  ];

  // 자막 시안의 다섯 장면 (순서대로 질문 1~5)
  const STILLS = [
    { src: 'images/card-12.webp', fy: 0.74 },   // 사용자가 쓴 글이 자막으로 얹히므로 사람 얼굴이 보이는 그림은 쓰지 않음
    { src: 'images/card-04.webp', fy: 0.58 },
    { src: 'images/card-14.webp', fy: 0.5 },
    { src: 'images/card-01.webp', fy: 0.84 },
    { src: 'images/card-03.webp', fy: 0.62 },
  ];

  // ---------- 도구 ----------

  const pick = (d, jeju, std) => (d.std ? std : jeju);
  const twoDigits = (n) => String(n).padStart(2, '0');
  const dotDate = (date) => `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;

  function put(ctx, text, x, y, font, color, align = 'left') {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }

  // 낱말 단위로 줄을 나눔. 한 낱말이 칸보다 길면 글자 단위로
  function wrap(ctx, text, width) {
    const lines = [];
    String(text).split('\n').forEach((paragraph) => {
      let line = '';
      paragraph.split(' ').forEach((word) => {
        const tryLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(tryLine).width <= width) {
          line = tryLine;
          return;
        }
        if (line) lines.push(line);
        line = '';
        if (ctx.measureText(word).width <= width) {
          line = word;
          return;
        }
        graphemes(word).forEach((g) => {
          if (ctx.measureText(line + g).width > width && line) {
            lines.push(line);
            line = g;
          } else {
            line += g;
          }
        });
      });
      lines.push(line);
    });
    return lines;
  }

  // 크기 후보를 차례로 시험해 maxLines 안에 들어가는 첫 크기
  function fitLines(ctx, text, width, sizes, family, maxLines) {
    let result = null;
    for (const size of sizes) {
      ctx.font = `${size}px ${family}`;
      result = { size, lines: wrap(ctx, text, width) };
      if (result.lines.length <= maxLines) break;
    }
    return result;
  }

  // 종이결 (SVG 필터는 사파리에서 캔버스를 막을 수 있어 점을 직접 찍음)
  function grain(ctx, strength) {
    const size = 200;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    const data = g.createImageData(size, size);
    let s = 7;
    for (let i = 0; i < data.data.length; i += 4) {
      s = (s * 1664525 + 1013904223) % 4294967296;
      data.data[i] = 70;
      data.data[i + 1] = 55;
      data.data[i + 2] = 35;
      data.data[i + 3] = (s / 4294967296) * strength;
    }
    g.putImageData(data, 0, 0);
    ctx.fillStyle = ctx.createPattern(c, 'repeat');
    ctx.fillRect(0, 0, W, H);
  }

  function paper(ctx, color, strength = 12) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    grain(ctx, strength);
  }

  // 엽서 그림의 왼쪽 반(960×1280)을 칸에 꽉 차게 잘라 그림
  function drawArt(ctx, image, x, y, w, h, fx = 0.5, fy = 0.5) {
    const srcW = image.naturalWidth / 2;
    const srcH = image.naturalHeight;
    const scale = Math.max(w / srcW, h / srcH);
    const sw = w / scale;
    const sh = h / scale;
    ctx.drawImage(image, (srcW - sw) * fx, (srcH - sh) * fy, sw, sh, x, y, w, h);
  }

  function pencilLine(ctx, x0, y0, x1, y1, seed, color, width = 2, amp = 0.8) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    shakyLine(x0, y0, x1, y1, seed, amp, 30).forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }

  function dashedLine(ctx, x0, y, x1, color, width = 3, dash = [14, 12]) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.restore();
  }

  function logoAt(ctx, image, x, y, h, align = 'left') {
    if (!image) return;
    const w = (h * image.naturalWidth) / image.naturalHeight;
    ctx.drawImage(image, align === 'right' ? x - w : align === 'center' ? x - w / 2 : x, y, w, h);
  }

  // 답 글자로 정해지는 바코드 (같은 답이면 같은 무늬)
  function barcode(ctx, x, y, w, h, seedText, color) {
    let s = 17;
    for (const ch of String(seedText)) s = (s * 31 + ch.codePointAt(0)) % 4294967296;
    const next = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    ctx.fillStyle = color;
    let at = x;
    while (at < x + w) {
      const bar = 3 + Math.floor(next() * 3) * 3;
      const gap = 3 + Math.floor(next() * 3) * 3;
      ctx.fillRect(at, y, Math.min(bar, x + w - at), h);
      at += bar + gap;
    }
  }

  // ---------- 1. 그림일기 ----------
  // 어릴 때 쓰던 그림일기장. 위에 그림, 아래에 원고지 칸. 글자가 칸마다 하나씩 들어감

  function paintDiary(ctx, d, img) {
    paper(ctx, '#fdfcf9', 10);
    const line = '#7ba3b6';
    const x = 60;
    const y = 74;
    const w = W - x * 2;
    const h = H - y - 92;
    const rowH = 92;
    const lines = d.items.map((it) => graphemes(it.a.replace(/\n/g, ' ')));

    // 칸 수: 답이 줄을 넘지 않는 가장 큰 칸. 한 글자만 다음 줄로 넘어가면 어색함.
    // 글이 길면 그림이 너무 작아지지 않는 선에서 가장 큰 칸
    const gridMax = h - rowH * 2 - 560;
    const rowsAt = (c) => lines.reduce((sum, g) => sum + Math.max(1, Math.ceil(g.length / c)), 0);
    const longest = Math.max(...lines.map((g) => g.length));
    let cols = Math.min(18, Math.max(12, longest));
    if (rowsAt(cols) !== lines.length) {
      for (const c of [12, 13, 14, 15, 16, 18, 20, 22, 24, 26]) {
        cols = c;
        if (rowsAt(c) * (w / c) <= gridMax) break;
      }
    }
    const cell = w / cols;
    const rows = rowsAt(cols);
    // 글이 짧으면 빈 칸을 남겨 공책처럼 보이게
    const wantedGrid = h - rowH * 2 - 800;
    const shown = Math.max(rows, Math.floor(wantedGrid / cell));
    const gridH = shown * cell;
    const picH = h - rowH * 2 - gridH;
    const picY = y + rowH * 2;
    const gridY = picY + picH;

    // 날짜 · 날씨 · 제목 줄
    const days = '일월화수목금토';
    const date = `${d.date.getFullYear()}년 ${d.date.getMonth() + 1}월 ${d.date.getDate()}일 ${days[d.date.getDay()]}요일`;
    put(ctx, date, x + 28, y + 60, `42px ${HAND}`, INK);
    put(ctx, pick(d, '날씨: ᄇᆞ름 하영', '날씨: 바람 많음'), x + w - 28, y + 60, `42px ${HAND}`, INK, 'right');
    put(ctx, '제목: 제주 여행', x + 28, y + rowH + 60, `42px ${HAND}`, INK);
    if (d.name) put(ctx, `이름: ${d.name}`, x + w - 28, y + rowH + 60, `42px ${HAND}`, INK, 'right');

    drawArt(ctx, img[d.art.src], x, picY, w, picH, d.art.fx, d.art.fy);

    // 원고지
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let r = 0; r <= shown; r++) {
      ctx.moveTo(x, gridY + r * cell);
      ctx.lineTo(x + w, gridY + r * cell);
    }
    for (let c = 1; c < cols; c++) {
      ctx.moveTo(x + c * cell, gridY);
      ctx.lineTo(x + c * cell, gridY + gridH);
    }
    ctx.stroke();

    const size = Math.round(cell * 0.68);
    let r = 0;
    lines.forEach((g) => {
      let c = 0;
      g.forEach((ch) => {
        if (c >= cols) {
          c = 0;
          r++;
        }
        if (ch === ' ' && c === 0) return;
        if (ch !== ' ') put(ctx, ch, x + c * cell + cell / 2, gridY + r * cell + cell * 0.74, `${size}px ${HAND}`, INK, 'center');
        c++;
      });
      r++;
    });

    // 바깥 틀
    ctx.strokeStyle = line;
    ctx.lineWidth = 5;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 3;
    ctx.beginPath();
    [y + rowH, y + rowH * 2, picY + picH].forEach((ly) => {
      ctx.moveTo(x, ly);
      ctx.lineTo(x + w, ly);
    });
    ctx.stroke();

    put(ctx, 'ᄆᆞ음 고라보게 · 하영 고라보게', W / 2, H - 34, `30px ${HAND}`, SOFT, 'center');
  }

  // ---------- 2. 편지 ----------
  // 흰 편지지에 손글씨. 그림은 오른쪽 위 우표로만

  function drawStamp(ctx, image, art, x, y, w, h, angle) {
    const m = 20;
    const off = document.createElement('canvas');
    off.width = w + m * 2;
    off.height = h + m * 2;
    const c = off.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(m, m, w, h);
    c.globalCompositeOperation = 'destination-out';
    const r = 8;
    const step = 25;
    c.beginPath();
    for (let i = 0; i <= Math.round(w / step); i++) {
      const px = m + (i * w) / Math.round(w / step);
      c.moveTo(px + r, m);
      c.arc(px, m, r, 0, Math.PI * 2);
      c.moveTo(px + r, m + h);
      c.arc(px, m + h, r, 0, Math.PI * 2);
    }
    for (let i = 0; i <= Math.round(h / step); i++) {
      const py = m + (i * h) / Math.round(h / step);
      c.moveTo(m + r, py);
      c.arc(m, py, r, 0, Math.PI * 2);
      c.moveTo(m + w + r, py);
      c.arc(m + w, py, r, 0, Math.PI * 2);
    }
    c.fill();
    c.globalCompositeOperation = 'source-over';
    drawArt(c, image, m + 16, m + 16, w - 32, h - 32, art.fx, art.fy);
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(angle);
    ctx.shadowColor = 'rgba(40,30,20,0.22)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(off, -w / 2 - m, -h / 2 - m);
    ctx.restore();
  }

  function paintLetter(ctx, d, img) {
    paper(ctx, '#fcfbf8', 11);
    const sx = W - PAD - 250;
    drawStamp(ctx, img[d.art.src], d.art, sx, 92, 250, 316, 0.03);
    if (img[MARK]) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.globalCompositeOperation = 'multiply';
      ctx.translate(sx - 18, 322);
      ctx.rotate(-0.22);
      ctx.drawImage(img[MARK], -105, -105, 210, 210);
      ctx.restore();
    }
    put(ctx, '제주에서,', PAD, 214, `104px ${HAND}`, INK);
    put(ctx, dotDate(d.date), PAD + 6, 282, `36px ${HAND}`, SOFT);

    const top = 450;
    const bottom = H - 210;
    const width = W - PAD * 2;
    let row = 92;
    let blocks = [];
    for (const r of [92, 86, 80, 74, 68, 62, 56, 50]) {
      row = r;
      ctx.font = `${Math.round(r * 0.72)}px ${HAND}`;
      blocks = d.items.map((it) => wrap(ctx, it.a, width));
      if (blocks.reduce((sum, b) => sum + 1 + b.length, 0) * r <= bottom - top) break;
    }
    const count = Math.floor((bottom - top) / row);
    for (let i = 1; i <= count; i++) pencilLine(ctx, PAD, top + i * row, W - PAD, top + i * row, 30 + i, 'rgba(62,56,50,0.14)', 2);

    let y = top;
    d.items.forEach((it, i) => {
      y += row;
      put(ctx, it.label, PAD + 2, y - row * 0.2, `${Math.round(row * 0.42)}px ${HAND}`, TANGERINE_INK);
      blocks[i].forEach((line) => {
        y += row;
        put(ctx, line, PAD + 2, y - row * 0.2, `${Math.round(row * 0.72)}px ${HAND}`, INK);
      });
    });

    if (d.name) put(ctx, `From. ${d.name}`, W - PAD, H - 118, `52px ${HAND}`, INK, 'right');
    logoAt(ctx, img[LOGO], PAD, H - 150, 66);
  }

  // ---------- 3. 영화 자막 ----------
  // 영화 장면에 자막을 얹은 듯이. 제주어 아래 표준어 자막이 함께 들어가 읽는 사람도 뜻을 앎

  function subtitle(ctx, text, x, y, font, fill, outline) {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(15,12,10,0.82)';
    ctx.lineWidth = outline;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }

  function paintStills(ctx, d, img) {
    ctx.fillStyle = '#121110';
    ctx.fillRect(0, 0, W, H);
    const head = 112;
    const foot = 92;
    const gap = 10;
    const frame = (H - head - foot - gap * 4) / 5;

    d.items.forEach((it, i) => {
      const y = head + i * (frame + gap);
      const still = STILLS[i % STILLS.length];
      drawArt(ctx, img[still.src], 0, y, W, frame, 0.5, still.fy);
      const shade = ctx.createLinearGradient(0, y + frame * 0.3, 0, y + frame);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.62)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, y, W, frame);

      // 장면이 보이도록 글을 줄이고, 그래도 넘치면 표준어 자막을 뺌
      const hasSub = !!it.sub && it.sub !== it.a;
      const room = frame - 110;
      let size = 60;
      let mainLines = [];
      let mainLH = 0;
      let subFont = '';
      let subLH = 0;
      let subLines = [];
      for (const s of [60, 56, 52, 48, 44, 40, 36, 32]) {
        size = s;
        ctx.font = `${s}px ${HAND}`;
        mainLines = wrap(ctx, it.a, W - 110);
        mainLH = Math.round(s * 1.26);
        subFont = `${s > 44 ? 32 : 28}px ${SANS}`;
        subLH = s > 44 ? 48 : 42;
        ctx.font = subFont;
        subLines = hasSub ? wrap(ctx, it.sub, W - 110) : [];
        if (mainLines.length * mainLH + subLines.length * subLH <= room) break;
      }
      if (mainLines.length * mainLH + subLines.length * subLH > room) subLines = [];
      let by = y + frame - 24 - subLines.length * subLH - (mainLines.length - 1) * mainLH;
      mainLines.forEach((line) => {
        subtitle(ctx, line, W / 2, by, `${size}px ${HAND}`, '#ffffff', 8);
        by += mainLH;
      });
      by -= mainLH;
      subLines.forEach((line) => {
        by += subLH;
        subtitle(ctx, line, W / 2, by, subFont, '#f4e9c9', 6);
      });
    });

    put(ctx, 'ᄆᆞ음 고라보게', W / 2, 76, `50px ${HAND}`, '#f4e9c9', 'center');
    put(ctx, d.name ? `${d.name} · ${dotDate(d.date)}` : dotDate(d.date), PAD - 30, H - 34, `30px ${HAND}`, '#b8b0a2');
    put(ctx, '하영 고라보게', W - PAD + 30, H - 34, `30px ${HAND}`, '#b8b0a2', 'right');
  }

  // ---------- 4. 탑승권 ----------

  function ticketShape(w, h, cuts) {
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const c = off.getContext('2d');
    c.fillStyle = '#fffefb';
    c.beginPath();
    c.roundRect(0, 0, w, h, 34);
    c.fill();
    c.globalCompositeOperation = 'destination-out';
    cuts.forEach((y) => {
      c.beginPath();
      c.arc(0, y, 26, 0, Math.PI * 2);
      c.arc(w, y, 26, 0, Math.PI * 2);
      c.fill();
    });
    c.globalCompositeOperation = 'source-over';
    return off;
  }

  function paintTicket(ctx, d, img) {
    drawArt(ctx, img[d.art.src], 0, 0, W, H, d.art.fx, d.art.fy);
    const tx = 72;
    const ty = 118;
    const tw = W - tx * 2;
    const th = H - ty * 2;
    const headH = 106;
    const infoEnd = 492;
    const stubH = 268;
    const shape = ticketShape(tw, th, [infoEnd, th - stubH]);
    ctx.save();
    ctx.shadowColor = 'rgba(30,25,20,0.32)';
    ctx.shadowBlur = 44;
    ctx.shadowOffsetY = 18;
    ctx.drawImage(shape, tx, ty);
    ctx.restore();

    // 머리띠
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, headH, [34, 34, 0, 0]);
    ctx.fillStyle = TANGERINE;
    ctx.fill();
    ctx.restore();
    put(ctx, 'BOARDING PASS', tx + 48, ty + 68, `700 36px ${SERIF}`, '#ffffff');
    put(ctx, '하영 고라보게', tx + tw - 48, ty + 68, `36px ${HAND}`, '#ffffff', 'right');

    // 구간
    const ry = ty + headH + 118;
    put(ctx, 'HOME', tx + 48, ry, `700 92px ${SERIF}`, INK);
    put(ctx, 'CJU', tx + tw - 48, ry, `700 92px ${SERIF}`, INK, 'right');
    put(ctx, '내가 사는 곳', tx + 50, ry + 54, `30px ${SANS}`, SOFT);
    put(ctx, '제주', tx + tw - 50, ry + 54, `30px ${SANS}`, SOFT, 'right');
    ctx.font = `700 92px ${SERIF}`;
    const fromEnd = tx + 48 + ctx.measureText('HOME').width;
    const toStart = tx + tw - 48 - ctx.measureText('CJU').width;
    dashedLine(ctx, fromEnd + 24, ry - 30, toStart - 24, TANGERINE, 3, [8, 9]);
    ctx.fillStyle = TANGERINE;
    ctx.beginPath();
    ctx.arc((fromEnd + toStart) / 2, ry - 30, 15, 0, Math.PI * 2);
    ctx.fill();

    // 탑승 정보
    const iy = ry + 118;
    const cols = [
      ['탑승객', d.name || '여행자'],
      ['날짜', `${twoDigits(d.date.getMonth() + 1)}.${twoDigits(d.date.getDate())}`],
      ['좌석', pick(d, '바당 쪽', '바다 쪽')],
    ];
    const colW = [(tw - 96) * 0.5, (tw - 96) * 0.25, (tw - 96) * 0.25];
    let cx = tx + 48;
    cols.forEach(([k, v], i) => {
      const fit = fitLines(ctx, v, colW[i] - 16, [46, 40, 34, 30, 26, 22], HAND, 1);
      put(ctx, k, cx, iy, `28px ${SANS}`, SOFT);
      put(ctx, fit.lines[0], cx, iy + 54, `${fit.size}px ${HAND}`, INK);
      cx += colW[i];
    });

    dashedLine(ctx, tx + 40, ty + infoEnd, tx + tw - 40, 'rgba(62,56,50,0.3)');
    dashedLine(ctx, tx + 40, ty + th - stubH, tx + tw - 40, 'rgba(62,56,50,0.3)');

    // 다섯 답
    const top = ty + infoEnd + 30;
    const bottom = ty + th - stubH - 24;
    const width = tw - 96;
    let size = 58;
    let blocks = [];
    for (const s of [58, 54, 50, 46, 42, 38, 34, 30]) {
      size = s;
      ctx.font = `${s}px ${HAND}`;
      blocks = d.items.map((it) => wrap(ctx, it.a, width));
      const total = blocks.reduce((sum, b) => sum + 42 + b.length * Math.round(s * 1.26), 0) + 26 * (blocks.length - 1);
      if (total <= bottom - top) break;
    }
    const lineH = Math.round(size * 1.26);
    const total = blocks.reduce((sum, b) => sum + 42 + b.length * lineH, 0);
    const spare = Math.min(52, (bottom - top - total) / Math.max(1, d.items.length - 1));
    let y = top;
    d.items.forEach((it, i) => {
      y += 34;
      put(ctx, it.label, tx + 48, y, `30px ${HAND}`, TANGERINE_INK);
      y += 8;
      blocks[i].forEach((line) => {
        y += lineH;
        put(ctx, line, tx + 48, y - lineH * 0.2, `${size}px ${HAND}`, INK);
      });
      y += spare;
    });

    // 떼는 쪽
    const sy = ty + th - stubH;
    barcode(ctx, tx + 48, sy + 42, tw - 96, 110, d.items.map((it) => it.a).join(''), INK);
    put(ctx, pick(d, '또 옵서', '또 오세요'), tx + 48, sy + 222, `56px ${HAND}`, INK);
    put(ctx, 'ᄆᆞ음 고라보게', tx + tw - 48, sy + 218, `36px ${HAND}`, SOFT, 'right');
  }

  // ---------- 5. 영수증 ----------

  function zigzagPath(ctx, x, y, w, h, tooth) {
    const n = Math.round(w / tooth);
    const t = w / n;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < n; i++) {
      ctx.lineTo(x + (i + 0.5) * t, y + tooth * 0.5);
      ctx.lineTo(x + (i + 1) * t, y);
    }
    ctx.lineTo(x + w, y + h);
    for (let i = n; i > 0; i--) {
      ctx.lineTo(x + (i - 0.5) * t, y + h - tooth * 0.5);
      ctx.lineTo(x + (i - 1) * t, y + h);
    }
    ctx.closePath();
  }

  function paintReceipt(ctx, d, img) {
    drawArt(ctx, img[d.art.src], 0, 0, W, H, d.art.fx, d.art.fy);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, W, H);

    const rw = 820;
    const rx = (W - rw) / 2;
    const inner = rw - 112;
    const headH = 268;
    const sumH = 196;
    const tailH = 256;
    const limit = H - 130;

    let size = 54;
    let blocks = [];
    let bodyH = 0;
    for (const s of [54, 50, 46, 42, 38, 34, 30, 28]) {
      size = s;
      ctx.font = `${s}px ${HAND}`;
      blocks = d.items.map((it) => wrap(ctx, it.a, inner));
      bodyH = blocks.reduce((sum, b) => sum + 54 + b.length * Math.round(s * 1.3) + 22, 0);
      if (headH + bodyH + sumH + tailH <= limit) break;
    }
    const rh = headH + bodyH + sumH + tailH;
    const ry = (H - rh) / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(30,25,20,0.3)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 14;
    zigzagPath(ctx, rx, ry, rw, rh, 26);
    ctx.fillStyle = '#fffefb';
    ctx.fill();
    ctx.restore();

    const cx = W / 2;
    const left = rx + 56;
    const right = rx + rw - 56;
    let y = ry + 96;
    put(ctx, '제주 여행 영수증', cx, y, `700 58px ${SERIF}`, INK, 'center');
    y += 56;
    put(ctx, pick(d, 'ᄆᆞ음 고라보게 제주점', '마음 말해 보게 제주점'), cx, y, `38px ${HAND}`, SOFT, 'center');
    y += 46;
    const stamp = `${d.date.getFullYear()}-${twoDigits(d.date.getMonth() + 1)}-${twoDigits(d.date.getDate())}`;
    put(ctx, d.name ? `${stamp}  ·  ${d.name}` : stamp, cx, y, `30px ${SANS}`, SOFT, 'center');
    y = ry + headH - 26;
    dashedLine(ctx, left, y, right, 'rgba(62,56,50,0.45)', 3, [10, 9]);

    const lineH = Math.round(size * 1.3);
    y = ry + headH;
    d.items.forEach((it, i) => {
      y += 44;
      put(ctx, `${i + 1}. ${it.label}`, left, y, `32px ${HAND}`, SOFT);
      put(ctx, '1', right, y, `32px ${HAND}`, SOFT, 'right');
      y += 10;
      blocks[i].forEach((line) => {
        y += lineH;
        put(ctx, line, left, y - lineH * 0.18, `${size}px ${HAND}`, INK);
      });
      y += 22;
    });

    y = ry + headH + bodyH + 8;
    dashedLine(ctx, left, y, right, 'rgba(62,56,50,0.45)', 3, [10, 9]);
    [
      ['합계', pick(d, 'ᄆᆞ음 다섯 개', '마음 다섯 개')],
      ['결제', pick(d, '제주 ᄇᆞ름으로', '제주 바람으로')],
      ['거스름', pick(d, '하영', '많이')],
    ].forEach(([k, v], i) => {
      const ly = y + 56 + i * 52;
      put(ctx, k, left, ly, `38px ${HAND}`, INK);
      put(ctx, v, right, ly, `38px ${HAND}`, INK, 'right');
    });

    y = ry + headH + bodyH + sumH;
    barcode(ctx, left, y, inner, 88, d.items.map((it) => it.a).join(''), INK);
    put(ctx, pick(d, '하영 고맙수다. 또 옵서.', '정말 고맙습니다. 또 오세요.'), cx, y + 158, `46px ${HAND}`, TANGERINE_INK, 'center');
  }

  // ---------- 6. 포스터 ----------
  // 그림을 크게, 마지막 답을 하늘에 크게. 나머지 넷은 아래 종이에 작게

  function paintPoster(ctx, d, img) {
    paper(ctx, '#fcfbf8', 10);
    const artH = 1440;
    drawArt(ctx, img[d.art.src], 0, 0, W, artH, 0.5, 0.5);

    const hero = d.items[d.items.length - 1];
    const rest = d.items.slice(0, -1);

    // 하늘에 쓰는 큰 글. 하늘이 밝아 어두운 글씨가 잘 보임
    const top = fitLines(ctx, hero.a, W - PAD * 2, [124, 112, 100, 88, 76, 66, 58], HAND, 4);
    const lh = Math.round(top.size * 1.22);
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.85)';
    ctx.shadowBlur = 24;
    put(ctx, hero.label, PAD + 4, 150, `42px ${HAND}`, INK);
    top.lines.forEach((line, i) => put(ctx, line, PAD, 150 + 34 + lh * (i + 1) - lh * 0.16, `${top.size}px ${HAND}`, INK));
    ctx.restore();

    // 아래 종이
    let size = 44;
    let blocks = [];
    const width = W - PAD * 2;
    const labelH = 36;
    for (const s of [44, 40, 36, 32, 28, 26, 24]) {
      size = s;
      ctx.font = `${s}px ${HAND}`;
      blocks = rest.map((it) => wrap(ctx, it.a, width));
      const total = blocks.reduce((sum, b) => sum + labelH + b.length * Math.round(s * 1.3) + 14, 0);
      if (total <= 420) break;
    }
    const lineH = Math.round(size * 1.3);
    const total = blocks.reduce((sum, b) => sum + labelH + b.length * lineH + 14, 0);
    const panelH = total + 150;
    const panelY = H - panelH;
    const edge = shakyLine(-10, panelY, W + 10, panelY, 5, 8, 24);
    ctx.save();
    ctx.shadowColor = 'rgba(40,30,20,0.26)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = -6;
    ctx.fillStyle = '#fcfbf8';
    ctx.beginPath();
    ctx.moveTo(edge[0][0], edge[0][1]);
    edge.forEach((p) => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(W + 10, H + 10);
    ctx.lineTo(-10, H + 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    let y = panelY + 34;
    rest.forEach((it, i) => {
      y += labelH;
      put(ctx, it.label, PAD, y - 6, `28px ${HAND}`, TANGERINE_INK);
      blocks[i].forEach((line) => {
        y += lineH;
        put(ctx, line, PAD, y - lineH * 0.2, `${size}px ${HAND}`, INK);
      });
      y += 14;
    });
    const by = H - 44;
    put(ctx, d.name ? `${d.name} · ${dotDate(d.date)}` : dotDate(d.date), PAD, by, `28px ${HAND}`, SOFT);
    put(ctx, 'ᄆᆞ음 고라보게 · 하영 고라보게', W - PAD, by, `28px ${HAND}`, SOFT, 'right');
  }

  // ---------- 목록 ----------

  const withArt = (d) => [d.art.src, LOGO, MARK];

  window.NOTE_ARTS = ARTS;
  window.NOTE_DESIGNS = [
    { id: 'diary', name: '그림일기', usesArt: true, images: withArt, paint: paintDiary },
    { id: 'letter', name: '편지', usesArt: true, images: withArt, paint: paintLetter },
    { id: 'stills', name: '영화 자막', usesArt: false, images: () => STILLS.map((s) => s.src), paint: paintStills },
    { id: 'ticket', name: '탑승권', usesArt: true, images: withArt, paint: paintTicket },
    { id: 'receipt', name: '영수증', usesArt: true, images: withArt, paint: paintReceipt },
    { id: 'poster', name: '포스터', usesArt: true, images: withArt, paint: paintPoster },
  ];
})();
