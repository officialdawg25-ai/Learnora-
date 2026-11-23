-- Educators may request publication review for courses they manage; only the admin review workflow can publish.
create or replace function public.get_educator_course_publication_status(p_course_id uuid)
returns table (
  review_id uuid,
  review_status text,
  reviewer_notes text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  course_status text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select pr.id,pr.status,pr.reviewer_notes,pr.requested_at,pr.reviewed_at,c.publication_status
  from public.courses c
  left join lateral (
    select r.id,r.status,r.reviewer_notes,r.requested_at,r.reviewed_at
    from public.publication_reviews r
    where r.course_id=c.id
    order by r.requested_at desc
    limit 1
  ) pr on true
  where c.id=p_course_id
    and auth.uid() is not null
    and private.can_manage_academy(c.academy_id);
$function$;

create or replace function public.request_educator_course_publication_review(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_course public.courses%rowtype;
  v_review public.publication_reviews%rowtype;
  v_module_count integer;
  v_lesson_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode='42501';
  end if;
  select c.* into v_course
  from public.courses c
  where c.id=p_course_id and private.can_manage_academy(c.academy_id)
  for update;
  if not found then
    raise exception 'Course not found or you do not have permission to manage it.' using errcode='42501';
  end if;
  if v_course.publication_status='published' then
    raise exception 'This course is already published.' using errcode='22023';
  end if;
  if v_course.publication_status='archived' then
    raise exception 'Archived courses must be restored before review.' using errcode='22023';
  end if;
  select r.* into v_review
  from public.publication_reviews r
  where r.course_id=p_course_id and r.status='pending'
  order by r.requested_at desc limit 1 for update;
  if found then
    return jsonb_build_object('review_id',v_review.id,'review_status',v_review.status,'course_status',v_course.publication_status,'already_pending',true);
  end if;
  select count(*) into v_module_count from public.course_modules m where m.course_id=p_course_id;
  select count(*) into v_lesson_count from public.lessons l join public.course_modules m on m.id=l.module_id where m.course_id=p_course_id;
  if v_module_count<1 or v_lesson_count<1 then
    raise exception 'Add at least one module and one lesson before requesting publication review.' using errcode='23514';
  end if;
  insert into public.publication_reviews(course_id,requested_by,status)
  values(p_course_id,auth.uid(),'pending') returning * into v_review;
  update public.courses set publication_status='review' where id=p_course_id;
  return jsonb_build_object('review_id',v_review.id,'review_status',v_review.status,'course_status','review','already_pending',false);
end;
$function$;

revoke all on function public.get_educator_course_publication_status(uuid) from public, anon;
grant execute on function public.get_educator_course_publication_status(uuid) to authenticated;
revoke all on function public.request_educator_course_publication_review(uuid) from public, anon;
grant execute on function public.request_educator_course_publication_review(uuid) to authenticated;
