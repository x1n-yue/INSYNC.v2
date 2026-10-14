-- Preserve the reviewed existing-project last Active Admin safeguard on rebuild.
-- No institution policy, account repair or new role; minimum-owner availability.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.admin_update_account(uuid,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'M14 requires trusted postgres and reviewed M07 lifecycle'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_last_active_admin()') AND proowner<>'postgres'::regrole)
 THEN RAISE EXCEPTION 'Unreviewed last-admin function owner'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.guard_last_active_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF old.role<>'admin' OR old.status<>'Active' THEN
  IF tg_op='DELETE' THEN RETURN old; END IF;
  RETURN new;
 END IF;
 IF tg_op='UPDATE' AND new.role='admin' AND new.status='Active' THEN RETURN new; END IF;
 PERFORM pg_advisory_xact_lock(404,1);
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id<>old.id AND role='admin' AND status='Active') THEN
  RAISE EXCEPTION 'Keep at least one Active Admin. Activate another administrator before removing this account or changing its role/status.' USING errcode='23514';
 END IF;
 IF tg_op='DELETE' THEN RETURN old; END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.guard_last_active_admin() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS m14_last_active_admin ON public.profiles;
CREATE TRIGGER m14_last_active_admin BEFORE UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_last_active_admin();
NOTIFY pgrst,'reload schema';
COMMIT;
