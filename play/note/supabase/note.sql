-- ᄆᆞ음 고라보게 게시판 (아직 실행하지 않은 초안. 실제 데이터베이스에서 시험하지 못했음)
-- 엽서 게시판(board_posts)과 따로 둠: 엽서 한 장은 글 400자 · 11줄이라 다섯 개의 답이 들어가지 않고,
-- '다른 사람들의 답'을 질문별로 보여 주려면 답을 낱개로 저장해야 함.
-- Supabase → SQL Editor 에 붙여 넣고 Run. 그다음 config.js 의 NOTE_POST_MODE 를 'supabase' 로.
--
-- 돌리기 전에 고칠 것: 아래 '금칙어 자리'에 board.sql 의 금칙어 검사를 넣을 것.
-- (board.sql 은 공개 저장소에 없어서 함수 이름을 확인하지 못했음. 지금 상태로는 화면의 badwords.js 만 막아 줌)

-- ① 표
create table if not exists public.note_posts (
  no bigserial primary key,
  name text not null default '' check (char_length(name) <= 12),
  art smallint not null default 0 check (art between 0 and 9),
  answers jsonb not null,                 -- [{ id, q, std, jeju }, ...] 다섯 개
  hidden boolean not null default false,  -- 관리자가 가린 글
  created_at timestamptz not null default now()
);
create index if not exists note_posts_created_at on public.note_posts (created_at desc);

create table if not exists public.note_answers (
  id bigserial primary key,
  post_no bigint not null references public.note_posts (no) on delete cascade,
  question_id text not null check (char_length(question_id) <= 8),
  standard text not null check (char_length(standard) <= 70),
  jeju text not null check (char_length(jeju) <= 300),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists note_answers_question on public.note_answers (question_id, created_at desc);

-- ② 읽기: 가리지 않은 글만. 쓰기는 아래 함수로만
alter table public.note_posts enable row level security;
alter table public.note_answers enable row level security;
revoke all on table public.note_posts, public.note_answers from anon, authenticated;
grant select on table public.note_posts, public.note_answers to anon, authenticated;

drop policy if exists note_posts_read on public.note_posts;
create policy note_posts_read on public.note_posts for select using (not hidden);
drop policy if exists note_answers_read on public.note_answers;
create policy note_answers_read on public.note_answers for select using (not hidden);

-- ③ 붙이기: 1분에 30장까지, 답은 다섯 개만. 붙인 번호를 돌려줌
create or replace function public.post_note(p_name text, p_art int, p_answers jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_no bigint;
  item jsonb;
begin
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> 5 then
    raise exception '답이 다섯 개가 아니에요.';
  end if;
  if (select count(*) from note_posts where created_at > now() - interval '1 minute') >= 30 then
    raise exception '지금 붙이는 사람이 많아요. 잠시 뒤에 다시 붙여 주세요.';
  end if;

  -- 금칙어 자리: board.sql 의 검사 함수로 p_name 과 각 답(std, jeju)을 검사하고,
  -- 걸리면 raise exception '고운 말로 써 주세요.'

  insert into note_posts (name, art, answers)
  values (left(coalesce(p_name, ''), 12), coalesce(p_art, 0), p_answers)
  returning no into new_no;

  for item in select * from jsonb_array_elements(p_answers) loop
    insert into note_answers (post_no, question_id, standard, jeju)
    values (new_no, left(item->>'id', 8), left(item->>'std', 70), left(item->>'jeju', 300));
  end loop;
  return new_no;
end;
$$;
revoke all on function public.post_note(text, int, jsonb) from public;
grant execute on function public.post_note(text, int, jsonb) to anon, authenticated;
