-- 카카오톡으로 보낸 엽서 보관 (엽서 v7.25)
-- 카카오톡 메시지의 '엽서 보기'를 누르면 보낸 엽서(글 · 넣은 사진)가 열림. 카카오톡 링크에는 엽서 번호(?id=…)만 담김 (app.js saveSharedPost · fetchSharedPost)
--  · 링크(엽서 번호)를 받은 사람만 볼 수 있음 — 사이트 키로는 표를 바로 읽거나 목록을 볼 수 없고, 아래 두 함수로만 넣고 꺼냄
--  · 게시판(board_posts)과 따로 — 게시판에는 나오지 않음
--  · 보낸 날부터 12개월 동안 보관: 12개월이 지나면 열리지 않고, 다음에 누가 엽서를 보낼 때 함께 지워짐(③을 켜면 매일 지움)
-- Supabase → SQL Editor 에 ①② 를 붙여 넣고 Run (여러 번 돌려도 됨)

-- ① 표
create table if not exists public.shared_posts (
  id text primary key,
  card smallint not null check (card between 0 and 99),
  to_name text not null default '' check (char_length(to_name) <= 20),
  message text not null default '' check (char_length(message) <= 400),
  from_name text not null default '' check (char_length(from_name) <= 20),
  post_date text not null default '' check (char_length(post_date) <= 10),
  standard text not null default '' check (char_length(standard) <= 400),
  photo text check (photo is null or (photo like 'data:image/jpeg;base64,%' and char_length(photo) <= 200000)),
  created_at timestamptz not null default now()
);
create index if not exists shared_posts_created_at on public.shared_posts (created_at);

alter table public.shared_posts enable row level security;   -- 정책을 하나도 두지 않음 → 사이트 키로는 표를 바로 못 읽고 못 씀
revoke all on table public.shared_posts from anon, authenticated;

-- ② 넣기 · 꺼내기
-- 넣기: 12개월 지난 엽서를 지우고, 1분에 30장까지만 받고, 새 엽서 번호(16자리)를 돌려줌
create or replace function public.save_shared_post(
  p_card int, p_to text, p_message text, p_from text, p_date text, p_standard text default '', p_photo text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id text := substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 16);
begin
  delete from shared_posts where created_at < now() - interval '12 months';
  if (select count(*) from shared_posts where created_at > now() - interval '1 minute') >= 30 then
    raise exception '지금 보내는 사람이 많아요. 잠시 뒤에 다시 보내 주세요.';
  end if;
  insert into shared_posts (id, card, to_name, message, from_name, post_date, standard, photo)
  values (new_id, p_card, left(coalesce(p_to, ''), 20), left(coalesce(p_message, ''), 400), left(coalesce(p_from, ''), 20),
          left(coalesce(p_date, ''), 10), left(coalesce(p_standard, ''), 400), p_photo);
  return new_id;
end;
$$;

-- 꺼내기: 엽서 번호가 맞고 12개월이 안 지난 엽서 한 장만
create or replace function public.get_shared_post(p_id text)
returns table (card smallint, to_name text, message text, from_name text, post_date text, standard text, photo text)
language sql
stable
security definer
set search_path = public
as $$
  select s.card, s.to_name, s.message, s.from_name, s.post_date, s.standard, s.photo
  from shared_posts s
  where s.id = p_id and s.created_at >= now() - interval '12 months';
$$;

revoke all on function public.save_shared_post(int, text, text, text, text, text, text) from public;
revoke all on function public.get_shared_post(text) from public;
grant execute on function public.save_shared_post(int, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_shared_post(text) to anon, authenticated;

-- ③ (고르면) 보내는 사람이 없어도 매일 새벽 4시에 12개월 지난 엽서 지우기
--    Database → Extensions 에서 pg_cron 을 켠 뒤, 아래 한 줄의 맨 앞 -- 를 지우고 그 줄만 따로 Run
-- select cron.schedule('shared-posts-12months', '0 4 * * *', $$delete from public.shared_posts where created_at < now() - interval '12 months'$$);
