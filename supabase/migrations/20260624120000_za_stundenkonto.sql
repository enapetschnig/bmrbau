-- ============================================================
-- ZA-Stundenkonto: Tracking-Stichtag + Monatsabschluss-Posting
-- ============================================================
--
-- - tracking_start_date pro Konto (Default 2026-06-24)
-- - monthly_signoffs um Posting-Felder erweitert
-- - Konsistenz-Check fuer Stunden-Split auf time_entries
-- - Storno-Schutz fuer ZA-Abwesenheits-Eintraege
-- - app_settings fuer Warn-Schwellen
-- - Audit-Trigger bei Stichtag-Aenderung
-- ============================================================

-- 1) tracking_start_date pro time_account
ALTER TABLE public.time_accounts
  ADD COLUMN IF NOT EXISTS za_tracking_start_date DATE NOT NULL DEFAULT '2026-06-24';

-- 2) monthly_signoffs erweitern (eingefrorene Summen + Posting-Pointer)
ALTER TABLE public.monthly_signoffs
  ADD COLUMN IF NOT EXISTS lohnstunden_total NUMERIC,
  ADD COLUMN IF NOT EXISTS zeitausgleich_total NUMERIC,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_transaction_id UUID REFERENCES public.time_account_transactions(id);

-- 3) Konsistenz-Constraint auf time_entries
-- NOT VALID: existierende Daten werden NICHT geprueft (Bestands-Inkonsistenzen
-- wuerden sonst die Migration blockieren). Nur neue/geaenderte Zeilen muessen
-- das Invariant erfuellen. Postgres erlaubt CHECK nicht als DEFERRABLE, also
-- braucht der Code (TimeTracking.tsx) die Split-Logik so dass stunden ==
-- lohnstunden + zeitausgleich_stunden direkt beim Insert gilt — das tut er.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_stunden_split_konsistent'
  ) THEN
    ALTER TABLE public.time_entries
      ADD CONSTRAINT chk_stunden_split_konsistent
      CHECK (
        stunden IS NULL
        OR (COALESCE(lohnstunden, 0) + COALESCE(zeitausgleich_stunden, 0) = stunden)
      ) NOT VALID;
  END IF;
END $$;

-- 4) Storno-Schutz: ZA-Abwesenheits-Entries duerfen nicht hart geloescht
-- werden (User muss expliziten Storno-Flow nutzen).
DROP POLICY IF EXISTS "no_delete_za_entries" ON public.time_entries;
CREATE POLICY "no_delete_za_entries" ON public.time_entries
  FOR DELETE TO authenticated
  USING (
    COALESCE(taetigkeit, '') <> 'Zeitausgleich'
    OR public.has_role(auth.uid(), 'administrator')
  );

-- 5) app_settings fuer Warn-Schwellen
INSERT INTO public.app_settings(key, value) VALUES
  ('za_max_balance_hours', '60'),
  ('za_min_balance_hours', '-20')
ON CONFLICT (key) DO NOTHING;

-- 6) Audit-Trigger: Stichtag-Aenderungen werden ins
-- time_account_transactions geloggt, damit Backdating nachvollziehbar ist.
CREATE OR REPLACE FUNCTION public.audit_za_tracking_start_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.za_tracking_start_date IS DISTINCT FROM NEW.za_tracking_start_date THEN
    INSERT INTO public.time_account_transactions(
      user_id, changed_by, change_type, hours,
      balance_before, balance_after, reason
    ) VALUES (
      NEW.user_id,
      COALESCE(auth.uid(), NEW.user_id),
      'tracking_start_geaendert',
      0,
      NEW.balance_hours,
      NEW.balance_hours,
      'Stichtag verschoben: ' || OLD.za_tracking_start_date::text
        || ' -> ' || NEW.za_tracking_start_date::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_za_tracking_start ON public.time_accounts;
CREATE TRIGGER trg_audit_za_tracking_start
  AFTER UPDATE OF za_tracking_start_date ON public.time_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_za_tracking_start_change();

-- 7) RPC: post_za_atomically — laeuft die komplette Monatsabschluss-Logik
-- in einer Postgres-Transaktion mit Advisory-Lock. Wird von der Edge
-- Function via supabase.rpc(...) aufgerufen.
CREATE OR REPLACE FUNCTION public.post_za_atomically(
  p_user_id UUID,
  p_year INT,
  p_month INT,
  p_mode TEXT DEFAULT 'post'  -- 'post' | 'storno_repost'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key BIGINT;
  v_today_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  v_today_month INT := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  v_account RECORD;
  v_signoff RECORD;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_lohnstunden NUMERIC;
  v_za_erarbeitet NUMERIC;
  v_za_genommen NUMERIC;
  v_old_tx RECORD;
  v_new_tx_id UUID;
  v_month_start DATE;
  v_month_end DATE;
BEGIN
  -- Validierung: kein Posten in die Zukunft
  IF (p_year * 12 + p_month) > (v_today_year * 12 + v_today_month) THEN
    RETURN jsonb_build_object('error', 'Zukunfts-Monat nicht erlaubt', 'code', 400);
  END IF;

  -- Monatsgrenzen
  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Advisory-Lock (transaction-scoped) gegen Concurrent-Posting
  v_lock_key := hashtextextended(p_user_id::text || '-' || p_year::text || '-' || p_month::text, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- time_accounts laden / anlegen
  INSERT INTO time_accounts(user_id, balance_hours)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_account FROM time_accounts WHERE user_id = p_user_id;

  -- monthly_signoffs laden (kann NULL sein)
  SELECT * INTO v_signoff
    FROM monthly_signoffs
    WHERE user_id = p_user_id AND year = p_year AND month = p_month;

  -- Bereits gebucht? Nur storno_repost darf erneut buchen
  IF v_signoff.posted_at IS NOT NULL AND COALESCE(p_mode, 'post') <> 'storno_repost' THEN
    RETURN jsonb_build_object(
      'error', 'Monat ist bereits gebucht. Storno + Neu-Buchen verwenden.',
      'code', 409,
      'posted_at', v_signoff.posted_at
    );
  END IF;

  v_balance_before := v_account.balance_hours;

  -- STORNO-PHASE
  IF COALESCE(p_mode, 'post') = 'storno_repost' AND v_signoff.posted_transaction_id IS NOT NULL THEN
    SELECT * INTO v_old_tx
      FROM time_account_transactions
      WHERE id = v_signoff.posted_transaction_id;

    IF FOUND THEN
      INSERT INTO time_account_transactions(
        user_id, changed_by, change_type, hours,
        balance_before, balance_after, reason, reference_id
      ) VALUES (
        p_user_id,
        COALESCE(auth.uid(), p_user_id),
        'storno',
        -v_old_tx.hours,
        v_balance_before,
        v_balance_before - v_old_tx.hours,
        'Storno Monatsabschluss ' || LPAD(p_month::text, 2, '0') || '/' || p_year::text,
        v_old_tx.id
      );
      UPDATE time_accounts
        SET balance_hours = balance_hours - v_old_tx.hours,
            updated_at = NOW()
        WHERE user_id = p_user_id;
      v_balance_before := v_balance_before - v_old_tx.hours;
    END IF;
  END IF;

  -- SUMMEN-PHASE (nur Stunden AB Tracking-Stichtag)
  SELECT
    COALESCE(SUM(lohnstunden), 0),
    COALESCE(SUM(GREATEST(zeitausgleich_stunden, 0)), 0),
    COALESCE(SUM(CASE WHEN taetigkeit = 'Zeitausgleich' THEN stunden ELSE 0 END), 0)
  INTO v_lohnstunden, v_za_erarbeitet, v_za_genommen
  FROM time_entries
  WHERE user_id = p_user_id
    AND datum >= v_account.za_tracking_start_date
    AND datum >= v_month_start
    AND datum <= v_month_end;

  -- BUCHUNGS-PHASE
  v_new_tx_id := NULL;
  IF v_za_erarbeitet > 0 THEN
    v_balance_after := v_balance_before + v_za_erarbeitet;
    INSERT INTO time_account_transactions(
      user_id, changed_by, change_type, hours,
      balance_before, balance_after, reason
    ) VALUES (
      p_user_id,
      COALESCE(auth.uid(), p_user_id),
      'monatsabschluss',
      v_za_erarbeitet,
      v_balance_before,
      v_balance_after,
      'Monatsabschluss ' || LPAD(p_month::text, 2, '0') || '/' || p_year::text
    ) RETURNING id INTO v_new_tx_id;

    UPDATE time_accounts
      SET balance_hours = v_balance_after,
          updated_at = NOW()
      WHERE user_id = p_user_id;
  ELSE
    v_balance_after := v_balance_before;
  END IF;

  -- monthly_signoffs UPSERT
  INSERT INTO monthly_signoffs(
    user_id, year, month,
    lohnstunden_total, zeitausgleich_total,
    posted_at, posted_transaction_id
  ) VALUES (
    p_user_id, p_year, p_month,
    v_lohnstunden, v_za_erarbeitet,
    NOW(), v_new_tx_id
  )
  ON CONFLICT (user_id, year, month) DO UPDATE SET
    lohnstunden_total = EXCLUDED.lohnstunden_total,
    zeitausgleich_total = EXCLUDED.zeitausgleich_total,
    posted_at = EXCLUDED.posted_at,
    posted_transaction_id = EXCLUDED.posted_transaction_id,
    invalidated_at = NULL,
    invalidated_reason = NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'lohnstunden_total', v_lohnstunden,
    'za_erarbeitet', v_za_erarbeitet,
    'za_genommen_info', v_za_genommen,
    'balance_before', v_account.balance_hours,
    'balance_after', v_balance_after,
    'transaction_id', v_new_tx_id,
    'posted_at', NOW()
  );
END;
$$;

-- Execute-Rechte fuer die RPC fuer service_role + Admins
GRANT EXECUTE ON FUNCTION public.post_za_atomically(UUID, INT, INT, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.post_za_atomically IS
  'Atomare Monatsabschluss-Buchung fuer ZA-Konto. Mit Advisory-Lock, '
  'Cutoff-Filter (datum >= tracking_start_date) und Storno-Repost-Logik.';
