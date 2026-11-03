// ---------- 번역기 보정 (테스트 전용) ----------
// translate.js는 엽서 사이트와 같은 파일을 그대로 쓰고, 이 파일에서 앞뒤로만 손본다.
//  ① 번역기가 잘못 바꾸는 말을 막음 (말은 → 만, 남는 → 놈은, 여기서 → 내겨네 ...)
//  ② 사전에 있는데 번역기가 못 잡는 말을 바꿈 (고기국수 → 궤기국수, 괜찮아 → 괜찮주게 ...)
//  ③ 이름만 적은 답도 제주어 말끝으로 맺음 (고기국수 → 궤기국수우다)
// 낱말 뒤의 쪽수는 개정증보 제주어사전(2009)의 쪽. 쪽수 없는 짝은 사전 낱말을 이어 붙인 말이라 검수할 때 먼저 볼 것.

(function () {
  const HOLD_OPEN = '';
  const HOLD_CLOSE = '';

  // 낱말째 바꿈. 뒤에 조사가 붙어도 찾고, 조사는 받침에 맞춰 고쳐 줌
  const WORDS = {
    고기국수: '궤기국수',         // 궤기 p.101
    돼지고기: '돗궤기',           // p.259
    흑돼지: '검은돗',             // p.52
    돼지: '돗',                   // p.52 · p.259 (번역기의 '족바리'는 사전에 민속어로 올라 있는 말)
    고등어회: '고등에회',         // 고등에 p.65
    고등어구이: '고등에구이',
    고등어조림: '고등에조림',
    성게미역국: '구살메역국',     // 구살 p.90, 메역 p.359
    미역국: '메역국',             // p.359
    전복죽: '점복죽',             // 점복 p.745
    전복뚝배기: '점복뚝배기',
    김치찌개: '짐치찌개',
    감자: '지슬',                 // p.783
    아빠: '아방',                 // p.574
    노을: '놀',                   // p.184
    바닷바람: '바당ᄇᆞ름',         // 바당 p.414
    돌담길: '돌담질',
  };

  // 어절째 바꿈 (말끝까지 정해진 말)
  const EXACT = {
    // 번역기가 다른 말로 잘못 읽는 말 → 그대로 둠
    말은: '말은',
    날은: '날은',
    물은: '물은',
    돌은: '돌은',
    일은: '일은',
    남는: '남는',
    남은: '남은',
    남을: '남을',
    가: '가',
    가도: '가도',
    본: '본',
    보는: '보는',
    번: '번',
    // 사전에 보기가 있는 말
    여기서: '이듸서',             // p.248
    여기에서: '이듸서',
    내가: '나가',                 // p.809
    네가: '느가',                 // 느 p.192
    괜찮아: '괜찮주게',           // p.684
    조심하고: '조심ᄒᆞ곡',
    제주어요: '제주어우다',       // '-어요'로 잘못 읽히는 말
    혼자요: '혼자우다',
    쉬었다: '쉬엇다',             // -엇다 p.637 (번역기의 '쉬엇저'는 문장을 끝내는 말)
  };

  // ---------- 받침 · 조사 ----------

  const hasTail = (word) => {
    const c = word.charCodeAt(word.length - 1);
    if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 !== 0;
    return c >= 0x11A8 && c <= 0x11C2;   // 옛한글 받침
  };

  // 조사: [받침 있을 때, 없을 때]. 제주어 조사 영 · 광은 translate.js와 같은 꼴
  const PARTICLES = {
    를: ['을', '를'], 을: ['을', '를'],
    는: ['은', '는'], 은: ['은', '는'],
    가: ['이', '가'], 이: ['이', '가'],
    랑: ['이영', '영'], 이랑: ['이영', '영'],
    와: ['광', '영'], 과: ['광', '영'],
    도: ['도', '도'], 만: ['만', '만'], 에: ['에', '에'], 의: ['의', '의'], 요: null,
  };
  const WORD_KEYS = Object.keys(WORDS).sort((a, b) => b.length - a.length);

  // 정해 둔 말은 번호표로 바꿔 번역기를 그냥 지나가게 하고, 번역이 끝나면 되돌림
  let held = [];
  const hold = (s) => {
    held.push(s);
    return `${HOLD_OPEN}${held.length - 1}${HOLD_CLOSE}`;
  };
  const release = (s) => s.replace(new RegExp(`${HOLD_OPEN}(\\d+)${HOLD_CLOSE}`, 'g'), (_, i) => held[Number(i)]);

  function swapWord(word) {
    if (word in EXACT) return hold(EXACT[word]);
    for (const key of WORD_KEYS) {
      if (!word.startsWith(key)) continue;
      const rest = word.slice(key.length);
      if (!rest) return hold(WORDS[key]);
      if (PARTICLES[rest]) {
        const [withTail, noTail] = PARTICLES[rest];
        return hold(WORDS[key] + (hasTail(WORDS[key]) ? withTail : noTail));
      }
    }
    return word;
  }

  // ---------- 이름으로 끝나는 답 ----------
  // '-우다'(받침 없을 때)는 사전 p.690, 받침 있으면 '-이우다'. 말끝으로 보이면 건드리지 않음

  const VERB_BEFORE_YO = /[어아여해예에네까세서게래대군구고나가걸데지니와봐줘워려져셔써타사자내돼혀오보라]$/;
  const ENDS_LIKE_VERB = /(다|요|어|아|야|지|까|네|죠|니|나|자|라|게|래|걸|군|고|해|워|와|봐|줘|돼|내|서|려|져|셔|써|며|면|데|마|여|오|세|듯|까요)$/;
  // 한 글자 말은 이 목록에 있을 때만 이름으로 봄 (사전 표의 '가', '응' 같은 말이 잘못 맺히지 않게)
  const SHORT_NOUNS = new Set('귤 빵 차 꿈 떡 밥 국 술 회 돌 섬 집 길 꽃 별 달 해 물 눈 비 손 밤 낮 잠 봄 말 배 산 숲 담 밭'.split(' '));
  // 사전 표에 있지만 이름이 아닌 말 (뒤에 '-우다'를 붙이면 안 됨)
  const NOT_NOUNS = new Set('같이 함께 많이 정말 진짜 너무 아주 가장 항상 다시 혼자 조금 빨리 천천히 오래 자주 모두 이제 지금 아까 나중 바로 그냥 아니 그래 제주 안녕'.split(' '));

  function isNoun(word) {
    if (NOT_NOUNS.has(word)) return false;
    if (word.length < 2) return SHORT_NOUNS.has(word);
    if (word in WORDS) return true;
    const dict = (window.JEJU_DICT && window.JEJU_DICT.N) || {};
    return word in dict || !ENDS_LIKE_VERB.test(word);
  }

  // 친구요, 바다요 처럼 이름 뒤에 '요'가 붙었는지. 가요 · 해요 같은 말끝과 구별함
  function isNounYo(word) {
    if (word.length < 2 || !word.endsWith('요')) return false;
    const head = word.replace(/이?요$/, '');
    if (head.length < 2) return false;
    const dict = (window.JEJU_DICT && window.JEJU_DICT.N) || {};
    if ((head in dict || head in WORDS) && !NOT_NOUNS.has(head)) return true;
    return !VERB_BEFORE_YO.test(word.slice(0, -1));
  }

  // 앞에 이미 말끝이 있으면 맺지 않음 (고마웠어요 제주 → 제주우다 가 되지 않게)
  function hasEarlierEnding(body) {
    return body.trim().split(/\s+/).slice(0, -1).some((w) => {
      const word = w.replace(/[^가-힣]/g, '');
      return word.length > 1 && !isNoun(word) && /(요|다|어|아|해|워|야|지|자)$/.test(word);
    });
  }

  const copula = (jeju) => jeju + (hasTail(jeju) ? '이우다' : '우다');

  // ---------- 바꾸기 ----------

  function convert(text) {
    const source = String(text || '').trim();
    if (!source) return '';
    const tail = (source.match(/[\s.…!~,]*$/) || [''])[0];
    let body = source.slice(0, source.length - tail.length);
    const asks = /\?\s*$/.test(source);

    // '목소리요'처럼 이름 뒤의 '요'는 번역기가 말끝으로 읽으므로 떼어 놓고, 아래에서 '-우다'로 맺음
    const lastWord = (body.match(/[가-힣]+$/) || [''])[0];
    let close = false;
    if (!(lastWord in EXACT) && isNounYo(lastWord)) {
      body = body.replace(/이?요$/, '');   // 몸국이요 → 몸국, 바다요 → 바다
      close = !hasEarlierEnding(body);
    } else if (lastWord && !asks && isNoun(lastWord)) {
      close = !hasEarlierEnding(body);
    }

    held = [];
    const prepared = body.replace(/[가-힣]+/g, swapWord);
    let jeju = release(window.translateToJeju(prepared));
    if (close) jeju = copula(jeju);
    return jeju + tail;
  }

  // 바뀐 낱말 뽑기 (화면의 '이렇게 바뀌었어요' · '오늘 만난 제주어'). 어절 수가 맞을 때만 짝을 지음
  function changes(standard, jeju) {
    const clean = (s) => s.replace(/[.,!?…~"'“”‘’()]/g, '');
    const a = String(standard || '').trim().split(/\s+/).map(clean);
    const b = String(jeju || '').trim().split(/\s+/).map(clean);
    if (a.length !== b.length) return [];
    const dict = (window.JEJU_DICT && window.JEJU_DICT.N) || {};
    const all = { ...dict, ...WORDS };
    const seen = new Set();
    const out = [];
    a.forEach((std, i) => {
      if (!std || std === b[i] || std.startsWith('싶')) return;
      // '보고 싶어 → 보고정 ᄒᆞ여'는 두 어절을 묶어서 보여 줌
      const wish = (a[i + 1] || '').startsWith('싶');
      let pair = wish ? [`${std} ${a[i + 1]}`, `${b[i]} ${b[i + 1]}`] : [std, b[i]];
      // 조사를 뺀 낱말끼리 보여 줌 (바다를 → 바당을 은 바다 → 바당으로)
      for (let n = std.length; !wish && n > 0; n--) {
        const head = std.slice(0, n);
        if (all[head] && b[i].startsWith(all[head])) { pair = [head, all[head]]; break; }
      }
      const key = pair.join('>');
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ std: pair[0], jeju: pair[1] });
    });
    return out;
  }

  window.noteToJeju = convert;
  window.noteChanges = changes;
})();
