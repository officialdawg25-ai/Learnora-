create table if not exists public.learning_space_posts (
 id uuid primary key default gen_random_uuid(),
 space_id uuid not null references public.learning_spaces(id) on delete cascade,
 author_user_id uuid not null references public.profiles(id) on delete cascade,
 content text not null check(length(trim(content)) between 1 and 4000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists learning_space_posts_timeline_idx on public.learning_space_posts(space_id,created_at desc);
alter table public.learning_space_posts enable row level security;
drop policy if exists learning_space_posts_select_members on public.learning_space_posts;
create policy learning_space_posts_select_members on public.learning_space_posts for select to authenticated
using(exists(select 1 from public.learning_space_memberships m where m.space_id=learning_space_posts.space_id and m.user_id=(select auth.uid()) and m.status='active')
 or exists(select 1 from public.learning_spaces s where s.id=learning_space_posts.space_id and s.owner_user_id=(select auth.uid())));
drop policy if exists learning_space_posts_insert_members on public.learning_space_posts;
create policy learning_space_posts_insert_members on public.learning_space_posts for insert to authenticated
with check(author_user_id=(select auth.uid()) and (
 exists(select 1 from public.learning_space_memberships m where m.space_id=learning_space_posts.space_id and m.user_id=(select auth.uid()) and m.status='active')
 or exists(select 1 from public.learning_spaces s where s.id=learning_space_posts.space_id and s.owner_user_id=(select auth.uid()))
));
drop policy if exists learning_space_posts_update_author on public.learning_space_posts;
create policy learning_space_posts_update_author on public.learning_space_posts for update to authenticated
using(author_user_id=(select auth.uid())) with check(author_user_id=(select auth.uid()));
drop policy if exists learning_space_posts_delete_author_or_owner on public.learning_space_posts;
create policy learning_space_posts_delete_author_or_owner on public.learning_space_posts for delete to authenticated
using(author_user_id=(select auth.uid()) or exists(select 1 from public.learning_spaces s where s.id=learning_space_posts.space_id and s.owner_user_id=(select auth.uid())));
grant select,insert,update,delete on public.learning_space_posts to authenticated;
