// 사이트 설정. 여기 넣는 키는 모두 웹페이지에 공개돼도 되는 키만 씀.
// REST API 키, Admin 키, Client Secret, Supabase secret(service_role) 키는 절대 넣지 말 것.
// 측정 · 카카오 값은 엽서 사이트(…/team1/play/postcard/config.js)와 같게 맞춤. 거기 값이 바뀌면 여기도 같이 고칠 것
window.POSTCARD_CONFIG = (function () {
  // 내 컴퓨터에서 미리 볼 때(localhost · 127.0.0.1)는 측정값을 보내지 않고 카카오톡도 부르지 않음 — 실제 통계가 시험으로 섞이지 않게.
  // 내 컴퓨터에서도 실제로 보내 보려면 주소 끝에 ?track-live (보낸 이벤트를 화면에서 보려면 ?track-debug)
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !/[?&]track-live\b/.test(location.search);
  const live = (value) => (local ? '' : value);

  return {
    // 카카오톡 공유: 카카오 개발자 앱 '하영고라보게'의 JavaScript 키(엽서 사이트와 같음). 앱에 등록한 사이트 주소에서만 동작함
    // 비어 있으면 카카오톡 대신 휴대폰 · 컴퓨터 공유 창 · 링크 복사
    KAKAO_JS_KEY: live('2712d9d852d5069a4e4375574d2c4c04'),

    // 성과 측정 (track.js) — 웹진 · 엽서 사이트와 같은 Google 태그 관리자(GTM) 컨테이너. GA4는 GTM 안에서 보냄(엽서 사이트도 GA4_ID는 비워 둠)
    // 웹진 안에 띄워졌을 때는 이 값과 상관없이 웹진으로 넘김(두 번 세지 않게)
    GA4_ID: '',
    GTM_ID: live('GTM-K97VS62N'),
    // 웹진 주소(이 사이트를 띄우는 바깥 페이지)의 출처 — 여기서 온 '인사'만 믿음. 엽서 사이트와 같은 목록
    WEBZINE_ORIGINS: ['https://gamboyartmad-commits.github.io', 'https://lxwebzine.hankyung.com', 'https://www.hankyung.com', 'https://hankyung.com', 'http://localhost:4174', 'http://127.0.0.1:4174', 'http://localhost:4175', 'http://127.0.0.1:4175'],
    // GA4 교차 도메인(따로 열렸을 때 웹진과 같은 방문으로 이어 보기)
    WEBZINE_DOMAINS: ['hankyung.com', 'gamboyartmad-commits.github.io'],
    WEBZINE_URL: '../../',   // 웹진 첫 화면. 이 폴더를 웹진 저장소의 play/ 아래(예: play/note/)에 둔다고 보고 맞춘 값

    // 게시 저장 위치: 'local' = 이 기기에만 저장(미리보기) · 'supabase' = 모두가 보는 게시판 (supabase/note.sql을 돌린 뒤)
    NOTE_POST_MODE: 'local',
    SUPABASE_URL: '',
    SUPABASE_KEY: '',

    POSTCARD_URL: 'https://lxwebzine.hankyung.com/2026-1/team1/play/postcard/',   // 로고 · 끝 화면의 '엽서로 보내기'가 가는 곳
    SHARE_URL: '',        // 다섯 문항 화면의 공유 링크. 비어 있으면 지금 주소(올린 주소가 그대로 쓰임)
    PENCIL_SHARE_URL: '', // 연필 엽서(pencil/)의 공유 링크. 비어 있으면 지금 주소
  };
}());
