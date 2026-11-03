# ᄆᆞ음 고라보게

제주 여행 질문 다섯 개에 표준어로 답하면 제주어로 바꿔 한 장에 담아 주는 별도 사이트. 빌드 없는 정적 사이트이고, 엽서 사이트(하영 고라보게)와 같은 번역기 · 글꼴 · 그림을 복사해서 씀.

## 고치는 곳

| 고칠 것 | 파일 |
| --- | --- |
| 질문 5개 | `questions.js` 맨 위 `NOTE_PICK`. 파일을 고치지 않고 보려면 주소 끝에 `?q=1,3,6,8,12` |
| 결과 이미지 시안 | `card-designs.js` 맨 아래 `NOTE_DESIGNS` 목록. 줄을 지우면 끝 화면에서도 빠짐 |
| 번역 보정 | `jeju-extra.js`. 낱말마다 사전 쪽수를 적어 둠 |
| 주소 · 키 | `config.js` |
| 화면 | `index.html` · `style.css` · `app.js` |

`translate.js` · `jeju-dict.js` · `badwords.js` · `track.js`는 엽서 사이트 파일을 그대로 복사한 것이라 직접 고치지 말 것. `design-samples/`는 시안 확인용이라 올리지 않아도 됨.

## 깃허브에 올리기 (다른 컴퓨터에서 이어서)

이 폴더 하나에 다섯 문항 화면(`index.html`)과 연필 엽서(`pencil/`)가 다 들어 있음. 번역기 · 글꼴 · 그림도 복사해 둬서 다른 파일 없이 돌아가고, 모든 경로가 상대 경로라 어느 주소 아래에 올려도 됨.

1. 옮기기: 이 폴더를 통째로 다른 컴퓨터로 옮김(압축 파일로 옮겨도 됨).
2. 넣을 자리: 웹진 저장소(github.com/gamboyartmad-commits/webzine)에서 엽서 사이트(`play/postcard/`) 옆, 예를 들어 `play/note/`. 그러면 주소가 `…/team1/play/note/`(다섯 문항) · `…/team1/play/note/pencil/`(연필 엽서). 다른 깊이에 두면 `config.js`의 `WEBZINE_URL`(웹진 첫 화면으로 가는 상대 경로)만 맞춤.
3. 올리기 (저장소 폴더에서):

   ```bash
   git pull
   git add play/note
   git commit -m "다섯 문항 · 연필 엽서 화면 추가"
   git push
   ```

4. 확인: 올린 주소 끝에 `?track-debug`를 붙여 열면 보내는 이벤트가 화면 왼쪽 아래에 뜸. GA4 실시간 보고서에서 `pc_note_…` · `pc_desk_…`가 들어오는지 봄.

`.gitignore`가 `.claude/` · `.DS_Store`는 빼고 올림. `design-samples/`(결과 이미지 시안 사진)와 `carousel/`(인스타 캐러셀 작업 도구)는 사이트에서 링크하지 않는 작업 파일이라, 공개 주소에 두기 싫으면 올리기 전에 빼도 됨. Claude로 이어서 작업할 때 지킬 것은 `CLAUDE.md`에 있음.

## 측정 (엽서 사이트와 같은 방식)

- 웹진 첫 화면은 GTM 코드(`GTM-K97VS62N`)를 HTML에 직접 심었고, 엽서 사이트는 `config.js`의 `GTM_ID` + `track.js`로 같은 컨테이너를 부름. 이 폴더도 엽서 사이트와 똑같이 `config.js` + `track.js`로 부름. HTML에 GTM 코드를 따로 붙이지 말 것(두 번 셈).
- `config.js`의 `GTM_ID` · `KAKAO_JS_KEY` · `WEBZINE_ORIGINS` · `WEBZINE_DOMAINS`는 엽서 사이트 값과 같게 채워 둠. 엽서 사이트 값이 바뀌면 같이 고칠 것.
- 내 컴퓨터(localhost · 127.0.0.1)에서 볼 때는 측정값을 보내지 않고 카카오톡도 부르지 않음. 그래도 보내 보려면 주소 끝에 `?track-live`.
- 웹진 안(iframe)에 띄우면 `track.js`가 웹진으로 넘기고, 따로 열리면 GTM으로 직접 보냄.
- GTM: 이벤트마다 태그를 하나씩 둔 컨테이너라, 2026-11-03에 폴더 **6. 연필 엽서(play/note/pencil)** · **7. 다섯 문항(play/note)** 에 `pc_desk_…` · `pc_note_…` 태그와 트리거를 만들어 둠(게시는 따로). 공유(`pc_desk_share` · `pc_note_share`)의 방법은 GA4에 이미 등록된 `share_method`로 보냄. 머문 시간(`pc_dwell_milestone`)은 엽서 사이트와 같은 태그로 가고, GA4에서 페이지 경로(`/play/note/pencil/` · `/play/note/` · `/play/postcard/`)로 나눠 봄. 점수(`score`) · 색(`color`) 같은 값을 보고서에서 보려면 GA4 맞춤 측정기준으로 등록.
- 화면마다 머문 시간(`pc_view_time`)의 `view`: 다섯 문항은 `note_write` · `note_finale` · `note_wall`, 연필 엽서는 `desk` · `desk_done`.
- 다섯 문항 이벤트: `pc_note_view` · `pc_note_answer` · `pc_note_others_open` · `pc_note_finish` · `pc_note_design` · `pc_note_save` · `pc_note_share` · `pc_note_post` · `pc_note_to_postcard` · `pc_note_restart`. 연필 엽서 이벤트는 아래 연필 엽서 칸에. 공통으로 `pc_click`(누른 단추 id · data-track) · `pc_view_time` · `pc_dwell_milestone` · `pc_page_time`. 사람이 쓴 글은 담지 않음.
- 카카오톡: 키는 엽서 사이트와 같음. 올린 주소의 도메인이 카카오 개발자 앱 '하영고라보게'의 웹 도메인에 등록돼 있어야 함. 엽서 사이트가 같은 도메인에서 카카오톡으로 보내지면 이미 등록된 것.

## 남은 일

- 다섯 문항 `index.html`에 `og:url`을 더하고 `og:image`를 이 화면용 그림으로 바꿈(연필 엽서도 지금은 엽서 사이트 공유 그림을 씀).
- 게시판: `supabase/note.sql`의 금칙어 자리를 채워 돌리고, `config.js`에 `NOTE_POST_MODE: 'supabase'`와 `SUPABASE_URL` · `SUPABASE_KEY`를 넣음. 지금은 이 기기에만 저장됨.

## 로컬에서 보기

```bash
python3 -m http.server 4180 --bind 127.0.0.1
```

## 연필로 쓰는 엽서 (`pencil/`)

책상 위 엽서에 연필을 쥐고 손글씨로 쓰는 화면. 메모지에 표준어로 적으면 제주어로 바꿔 엽서 점선 위에 연하게 깔아 주고, 그 위를 마우스나 손가락으로 따라 씀. 번역기 · 글꼴 · 엽서 그림은 이 폴더의 파일을 `../`로 불러 씀.

| 고칠 것 | 곳 |
| --- | --- |
| 엽서 그림 목록 | `pencil/desk.js` 맨 위 `PHOTOS` |
| 밑글씨 자리 | `pencil/desk.js`의 `L`. 엽서 그림(1920×1280) 안 점선 자리를 비율로 적어 둠. 그림을 바꾸면 같이 맞출 것 |
| 연필 색 · 굵기 고르기 | `pencil/desk.js` 맨 위 `LEADS`(심 색 · 몸통 색) · `SIZES`(굵기 배수). 필통 단추는 이 목록으로 만들어짐 |
| 기본 굵기 · 진하기 | `pencil/desk.js`의 `LEAD_W` · `paint()` |
| 그림 · 내 사진 · 사진 빼기 | `pencil/desk.js`의 `fitOwn()` · `removePhoto()`. 내 사진은 엽서 왼쪽 사진 칸(3:4) 가운데로 잘라 900×1200 JPEG로 줄인 뒤 이 기기에만 둠(`hy-pencil-desk-photo`). 어디에도 올리지 않음. '사진 빼기'는 엽서 그림이든 내 사진이든 사진 칸을 비우고(내 사진이면 기기에서도 지움), 그 뒤 '그림 넣기'로 엽서 그림을 다시 넣음 |
| 공유하기 | `pencil/desk.js`의 `shareCard()`. `KAKAO_JS_KEY`가 있으면 카카오톡, 없으면 휴대폰 · 컴퓨터 공유 창(그림 + 링크), 그것도 없으면 링크 복사. 링크는 `config.js`의 `PENCIL_SHARE_URL`(비면 지금 주소) |
| 따라 쓰기 점수 | `pencil/desk.js`의 `scoreHand()`. 본 글씨를 엽서 위 자리 그대로 다시 그려 손글씨와 겹쳐 봄: 본 글씨 획 중 손글씨가 지나간 몫 × 본 글씨 둘레에 그은 줄 중 글씨 위에 있는 몫으로 100점. 비켜 가도 봐주는 폭은 `SCORE_TOL`(글자 크기의 7%), 한마디는 `SCORE_RANKS`. 본 글씨가 없으면 점수 대신 점수 받는 법(`#scoreNone`)을 보임. 점수가 나온다는 걸 알리는 곳: 메모지 제목('하고 싶은 말을 쓰면 점수가 나와요'), 엽서 맨 아래 점선의 빨간 펜 안내 '다 쓰면 점수가 보여요'(`#cardTip` · `layoutTip()`, 본 글씨가 있고 아직 한 획도 안 썼을 때만, 저장 그림에는 안 들어감), 세 획째에 한 번 뜨는 안내(`scoreTip()`), 끝내는 단추 '내 점수 보기'(`#doneBtn`). 다 쓴 엽서에는 오른쪽 위 빈자리에 빨간 펜 동그라미 점수와 한마디를 그려서(`drawGrade()`, 자리는 `GRADE`) 화면 · 저장 · 공유 이미지에 똑같이 들어가고, 공유 글에도 점수가 붙음. 맞춰 보려면 주소 끝에 `?score-debug`를 붙이고 콘솔에서 `__scoreHand()` |
| 도구 단추 | `pencil/desk.js`의 `ICON_PATHS` · `setTool()`. '내 점수 보기' 말고는 아이콘이고, 이름은 aria-label · title(마우스를 올리면 뜸) |
| 휴대폰 화면 | `pencil/desk.css` 맨 아래 두 칸. 860px 이하는 메모지 → 연필 → 도구 → 엽서 차례로 쌓고(연필과 도구는 메모지와 엽서 사이), 제주어로 바꾼 메모지는 화면 높이의 1/3까지만(넘치면 메모지 안에서 밀어 봄). 600px 이하는 엽서를 화면 너비의 약 두 배로 키워 글씨 쪽만 보여 주고, 엽서 오른쪽 위 단추로 글씨 쪽 · 사진 쪽 · 전체를 바꿈. 창에 보이는 비율은 `--cw`의 `0.52` |
| 화면 | `pencil/index.html` · `pencil/desk.css` |

- 측정 이벤트: `pc_desk_view` · `pc_desk_convert` · `pc_desk_pickup` · `pc_desk_side`(휴대폰 엽서 보기: write · photo · all) · `pc_desk_pencil`(고른 색 id · 굵기 id) · `pc_desk_finish`(획 수 · 지우개 수 · 쓴 색 가짓수 · 쓴 초 · 따라 쓰기 점수) · `pc_desk_photo`(내 사진 넣음) · `pc_desk_photo_remove`(뺀 것: card · own) · `pc_desk_save` · `pc_desk_share`(kakao · share_sheet · share_link · copy) · `pc_desk_replay` · `pc_desk_rewrite` · `pc_desk_restart` · `pc_desk_to_postcard`. 필통 · 보기 단추의 `pc_click` 이름은 `lead_색` · `size_굵기` · `side_보기`. 적은 말과 손글씨는 담지 않음.
- 손글씨는 이 기기에만 남음(새로고침해도 이어 씀). 게시판에 붙이기는 아직 없음.
- 로컬: 위 명령을 포트 4181로 띄우고 `http://127.0.0.1:4181/pencil/`

## 인스타 캐러셀 (`carousel/`)

엽서 사이트 홍보용 인스타그램 캐러셀(1080×1350)을 만드는 도구. 올리는 사이트가 아니라 작업용이라 배포하지 않음. 레퍼런스는 사진 위 큰 제목 + 왼쪽 체크 라벨 + 아래 빛나는 자막 모양의 여행 카드뉴스.

| 고칠 것 | 곳 |
| --- | --- |
| 처음 문구 · 장 수 | `carousel/carousel.js` 맨 위 `DEFAULT`. `[대괄호]` 안은 강조색(로고 주황 #ff9767, 화면에서 바꿀 수 있음). 제주어는 엽서 사이트 번역기로 실제 바꾼 결과만 씀 |
| 글자 자리 · 크기 | `carousel/carousel.js`의 `coverLayout()` · `checkLayout()` (1080×1350 기준 픽셀) |
| 그림자 · 빛 | `carousel/carousel.js`의 `SH`. blur는 피그마 Blur 값과 같음 |
| 글꼴 | 제목 Noto Sans KR(피그마에 기본으로 있음) · 손글씨 Hayeong Hand. 피그마에서 손글씨를 보려면 `carousel/fonts-for-figma/HayeongHand-Regular.ttf`를 설치 |

- 사진 · 영상과 글은 그 브라우저(IndexedDB `hy-carousel`)에만 남음. 어디에도 올리지 않음.
- 영상 장: 피그마는 영상을 내보내지 못해서 SVG에는 멈춘 화면(「영상 자리」 레이어)만 들어감. 올릴 영상은 `carousel.js`의 `mp4Blob()`이 영상을 끝까지 재생하며 캔버스를 녹화해 MP4(H.264)로 만듦 — 영상 길이만큼 걸리고 그동안 탭이 화면에 떠 있어야 함. 소리는 WebAudio로 녹화에만 넣음. 피그마에서 글을 고쳤으면 글만 투명 PNG(1080×1350)로 내보내 「피그마 글 PNG 올리기」로 얹음(`overlayOf()`).
- 피그마용 SVG: 사진은 이미지 채우기(보이는 자리만 잘라 최대 2배 해상도), 글은 고칠 수 있는 글 레이어, 그림자는 drop shadow 효과로 들어가게 피그마가 내보내는 SVG 모양을 따름.
- 로컬: 위 명령으로 서버를 띄우고 `http://127.0.0.1:4180/carousel/`
