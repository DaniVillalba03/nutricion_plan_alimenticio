-- ==============================================================================
-- Varios controles el mismo día
-- ==============================================================================
-- La migración anterior limitaba a un control por paciente y día, de modo que registrar un
-- segundo control el mismo día reemplazaba al primero. Ahora cada control se conserva; se
-- ordenan por fecha y, dentro del mismo día, por el momento en que se registraron.

ALTER TABLE client_measurements DROP CONSTRAINT IF EXISTS client_measurements_client_id_measured_on_key;

DROP INDEX IF EXISTS idx_client_measurements_client_date;
CREATE INDEX IF NOT EXISTS idx_client_measurements_client_date
    ON client_measurements (client_id, measured_on DESC, created_at DESC);

-- Registra un control (siempre uno nuevo) y deja el peso de la ficha igual al del más reciente.
CREATE OR REPLACE FUNCTION add_measurement(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_client uuid := (p->>'client_id')::uuid;
  v_row client_measurements;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión no válida' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM clients WHERE id = v_client AND nutritionist_id = auth.uid()) THEN
    RAISE EXCEPTION 'Paciente no encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO client_measurements (client_id, measured_on, weight_kg, body_fat_pct, waist_cm, notes)
  VALUES (
    v_client,
    COALESCE(NULLIF(p->>'measured_on', '')::date, current_date),
    (p->>'weight_kg')::numeric,
    NULLIF(p->>'body_fat_pct', '')::numeric,
    NULLIF(p->>'waist_cm', '')::numeric,
    NULLIF(trim(COALESCE(p->>'notes', '')), '')
  )
  RETURNING * INTO v_row;

  UPDATE clients
     SET weight_kg = (
           SELECT weight_kg FROM client_measurements
            WHERE client_id = v_client ORDER BY measured_on DESC, created_at DESC LIMIT 1),
         updated_at = now()
   WHERE id = v_client;

  RETURN jsonb_build_object(
    'id', v_row.id, 'measured_on', v_row.measured_on, 'weight_kg', v_row.weight_kg,
    'body_fat_pct', v_row.body_fat_pct, 'waist_cm', v_row.waist_cm, 'notes', v_row.notes
  );
END;
$$;

CREATE OR REPLACE FUNCTION delete_measurement(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
BEGIN
  DELETE FROM client_measurements WHERE id = p_id RETURNING client_id INTO v_client;
  IF v_client IS NULL THEN
    RETURN false;
  END IF;
  UPDATE clients
     SET weight_kg = COALESCE(
           (SELECT weight_kg FROM client_measurements
             WHERE client_id = v_client ORDER BY measured_on DESC, created_at DESC LIMIT 1),
           weight_kg),
         updated_at = now()
   WHERE id = v_client;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION add_measurement(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION delete_measurement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION add_measurement(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_measurement(uuid) TO authenticated;

-- El orden dentro del mismo día depende de created_at: now() es igual dentro de una transacción,
-- así que se usa la hora real de cada inserción.
ALTER TABLE client_measurements ALTER COLUMN created_at SET DEFAULT clock_timestamp();
