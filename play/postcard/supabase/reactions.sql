-- 엽서 게시판 좋아요 · 댓글 (엽서 v7.31)
-- board.sql · board_admin.sql 을 먼저 실행한 데이터베이스에서, Supabase → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 괜찮음.
--
-- 규칙 (화면이 아니라 데이터베이스가 지킴)
--   · 로그인 없이 누구나 숨기지 않은 엽서에 댓글을 달고, 숨기지 않은 댓글을 볼 수 있음
--   · 댓글 고치기 · 지우기 · 숨기기는 관리자만 (admin.html). 쓴 사람이 직접 지우지는 못함
--   · 좋아요는 브라우저의 임의 번호로 엽서마다 한 번만, 다시 누르면 취소. 누가 눌렀는지는 사이트 키로 볼 수 없고 수만 볼 수 있음
--   · 장난 막기: 게시판 전체에 댓글은 1분에 20개, 좋아요는 1분에 120번까지
--   · 욕설 · 야한 말 · 혐오 표현이 들어간 댓글은 올릴 수 없음 (board.sql 의 has_bad_word)
--   · 엽서를 지우면 그 엽서의 댓글 · 좋아요도 함께 지워짐

-- ① 댓글
create table if not exists public.board_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.board_posts (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 10),                   -- 비어 있으면 화면에 '익명'
  body text not null check (char_length(btrim(body)) between 1 and 100),
  hidden boolean not null default false,                                            -- 관리자가 숨긴 댓글
  created_at timestamptz not null default now()
);

create index if not exists board_comments_post on public.board_comments (post_id, created_at) where not hidden;

alter table public.board_comments enable row level security;

drop policy if exists "누구나 댓글 보기" on public.board_comments;
create policy "누구나 댓글 보기" on public.board_comments
  for select to anon, authenticated using (not hidden);

drop policy if exists "누구나 댓글 달기" on public.board_comments;
create policy "누구나 댓글 달기" on public.board_comments
  for insert to anon, authenticated
  with check (not hidden and exists (select 1 from public.board_posts p where p.id = post_id));   -- 볼 수 있는 엽서에만

-- 사이트가 쓸 수 있는 칸만 열어 둠 (hidden은 읽지도 쓰지도 못함)
revoke all on public.board_comments from anon, authenticated;
grant select (id, post_id, name, body, created_at) on public.board_comments to anon, authenticated;
grant insert (post_id, name, body) on public.board_comments to anon, authenticated;

create or replace function public.board_comments_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.board_comments where created_at > now() - interval '1 minute') >= 20 then
    raise exception '잠시 뒤에 다시 올려 주세요' using errcode = 'P0001';
  end if;
  if public.has_bad_word(new.name) or public.has_bad_word(new.body) then
    raise exception '고운 말로 써 주세요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.board_comments_guard() from public, anon, authenticated;

drop trigger if exists board_comments_guard on public.board_comments;
create trigger board_comments_guard
  before insert on public.board_comments
  for each row execute function public.board_comments_guard();

-- 관리자: 숨긴 댓글까지 보기 · 숨기기 · 지우기 (board_admin.sql 의 is_board_admin)
grant select (hidden) on public.board_comments to authenticated;
grant update (hidden) on public.board_comments to authenticated;
grant delete on public.board_comments to authenticated;

drop policy if exists "관리자 댓글 모두 보기" on public.board_comments;
create policy "관리자 댓글 모두 보기" on public.board_comments
  for select to authenticated using (public.is_board_admin());

drop policy if exists "관리자 댓글 숨기기" on public.board_comments;
create policy "관리자 댓글 숨기기" on public.board_comments
  for update to authenticated using (public.is_board_admin()) with check (public.is_board_admin());

drop policy if exists "관리자 댓글 지우기" on public.board_comments;
create policy "관리자 댓글 지우기" on public.board_comments
  for delete to authenticated using (public.is_board_admin());

-- ② 좋아요: 사이트 키로는 표를 바로 읽거나 고칠 수 없음 (정책 없음). 아래 두 함수로만
create table if not exists public.board_likes (
  post_id bigint not null references public.board_posts (id) on delete cascade,
  liker text not null check (liker ~ '^[a-z0-9-]{16,40}$'),                        -- 브라우저에 저장한 임의 번호
  created_at timestamptz not null default now(),
  primary key (post_id, liker)
);

alter table public.board_likes enable row level security;
revoke all on public.board_likes from anon, authenticated;

-- 보이는 엽서마다 좋아요 수 · 댓글 수 · 이 브라우저가 눌렀는지
create or replace function public.board_reactions(p_liker text default '')
returns table (post_id bigint, likes int, comments int, liked boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
    (select count(*)::int from public.board_likes l where l.post_id = p.id),
    (select count(*)::int from public.board_comments c where c.post_id = p.id and not c.hidden),
    exists (select 1 from public.board_likes l where l.post_id = p.id and l.liker = p_liker)
  from public.board_posts p
  where not p.hidden
  order by p.created_at desc
  limit 300;
$$;

-- 좋아요 누르기 · 다시 누르면 취소. 지금 수와 눌렸는지를 돌려줌
create or replace function public.toggle_board_like(p_post bigint, p_liker text)
returns table (likes int, liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_liked boolean;
begin
  if coalesce(p_liker, '') !~ '^[a-z0-9-]{16,40}$' then
    raise exception '잘못된 요청이에요' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.board_posts p where p.id = p_post and not p.hidden) then
    raise exception '없는 엽서예요' using errcode = 'P0001';
  end if;
  delete from public.board_likes l where l.post_id = p_post and l.liker = p_liker;
  if found then
    now_liked := false;
  else
    if (select count(*) from public.board_likes l where l.created_at > now() - interval '1 minute') >= 120 then
      raise exception '잠시 뒤에 다시 눌러 주세요' using errcode = 'P0001';
    end if;
    insert into public.board_likes (post_id, liker) values (p_post, p_liker) on conflict do nothing;
    now_liked := true;
  end if;
  return query
    select (select count(*)::int from public.board_likes l where l.post_id = p_post), now_liked;
end;
$$;

revoke all on function public.board_reactions(text) from public;
revoke all on function public.toggle_board_like(bigint, text) from public;
grant execute on function public.board_reactions(text) to anon, authenticated;
grant execute on function public.toggle_board_like(bigint, text) to anon, authenticated;
