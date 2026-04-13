CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    uuid NOT NULL REFERENCES auth.users(id),
  action      text NOT NULL,
  target_id   uuid,
  target_type text,
  payload     jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no update" ON public.admin_audit_log FOR UPDATE USING (false);
CREATE POLICY "no delete" ON public.admin_audit_log FOR DELETE USING (false);
