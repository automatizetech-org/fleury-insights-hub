create or replace function public.claim_next_execution_request(
  p_robot_technical_id text,
  p_robot_id text,
  p_active_schedule_rule_ids uuid[] default null
)
returns setof public.execution_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed public.execution_requests%rowtype;
begin
  with candidate as (
    select er.id
    from public.execution_requests er
    where er.status = 'pending'
      and (
        er.robot_technical_ids @> array[p_robot_technical_id]::text[]
        or 'all' = any(er.robot_technical_ids)
      )
      and (
        er.schedule_rule_id is null
        or p_active_schedule_rule_ids is null
        or coalesce(array_length(p_active_schedule_rule_ids, 1), 0) = 0
        or er.schedule_rule_id = any(p_active_schedule_rule_ids)
      )
      and (
        coalesce(er.execution_mode, 'sequential') <> 'sequential'
        or er.execution_group_id is null
        or not exists (
          select 1
          from public.execution_requests blocker
          where blocker.execution_group_id = er.execution_group_id
            and blocker.id <> er.id
            and blocker.status in ('pending', 'running')
            and (
              coalesce(blocker.execution_order, 2147483647) < coalesce(er.execution_order, 2147483647)
              or (
                coalesce(blocker.execution_order, 2147483647) = coalesce(er.execution_order, 2147483647)
                and (
                  blocker.created_at < er.created_at
                  or (blocker.created_at = er.created_at and blocker.id::text < er.id::text)
                )
              )
            )
        )
      )
    order by coalesce(er.execution_order, 2147483647), er.created_at, er.id
    for update skip locked
    limit 1
  )
  update public.execution_requests er
  set
    status = 'running',
    robot_id = p_robot_id,
    claimed_at = timezone('utc', now())
  from candidate
  where er.id = candidate.id
    and er.status = 'pending'
  returning er.* into v_claimed;

  if v_claimed.id is null then
    return;
  end if;

  return next v_claimed;
end;
$$;
