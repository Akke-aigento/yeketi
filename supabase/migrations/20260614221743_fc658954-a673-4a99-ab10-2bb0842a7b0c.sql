DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'WEBHOOK_SHARED_SECRET';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret('b613edf49d87504c53502ea9bd98bbb6cf6214fed38eb97b8e3796166665e8d0', 'WEBHOOK_SHARED_SECRET', 'Shared secret used by dispatch_notify_event to authenticate to notify-events edge function');
  ELSE
    PERFORM vault.update_secret(v_id, 'b613edf49d87504c53502ea9bd98bbb6cf6214fed38eb97b8e3796166665e8d0', 'WEBHOOK_SHARED_SECRET');
  END IF;
END $$;