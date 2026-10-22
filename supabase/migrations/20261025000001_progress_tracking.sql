-- ==============================================================================
-- Seguimiento del paciente (controles) + nota de cada versión del plan
-- ==============================================================================

-- 1. Controles periódicos: peso y medidas a lo largo del tiempo (un control por día)
CREATE TABLE IF NOT EXISTS client_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    measured_on DATE NOT NULL DEFAULT current_date,
    weight_kg NUMERIC(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
    body_fat_pct NUMERIC(4,1) CHECK (body_fat_pct IS NULL OR (body_fat_pct > 0 AND body_fat_pct < 100)),
    waist_cm NUMERIC(5,1) CHECK (waist_cm IS NULL OR (waist_cm > 0 AND waist_cm < 400)),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (client_id, measured_on)
);

CREATE INDEX IF NOT EXISTS idx_client_measurements_client_date
    ON client_measurements (client_id, measured_on DESC);

ALTER TABLE client_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nutricionistas gestionan los controles de sus pacientes" ON client_measurements;
CREATE POLICY "Nutricionistas gestionan los controles de sus pacientes" ON client_measurements
    FOR ALL
    USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = client_measurements.client_id AND c.nutritionist_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM clients c WHERE c.id = client_measurements.client_id AND c.nutritionist_id = auth.uid()));

REVOKE ALL ON client_measurements FROM anon;

-- Punto de partida: el peso que cada paciente ya tiene en su ficha pasa a ser su primer control
INSERT INTO client_measurements (client_id, measured_on, weight_kg)
SELECT id, created_at::date, weight_kg FROM clients WHERE weight_kg IS NOT NULL AND weight_kg > 0
ON CONFLICT (client_id, measured_on) DO NOTHING;

-- Registra (o corrige, si ya hay uno ese día) un control y deja el peso de la ficha igual al
-- del control más reciente. SECURITY INVOKER: las políticas RLS siguen aplicando.
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
  ON CONFLICT (client_id, measured_on) DO UPDATE
     SET weight_kg = EXCLUDED.weight_kg,
         body_fat_pct = EXCLUDED.body_fat_pct,
         waist_cm = EXCLUDED.waist_cm,
         notes = EXCLUDED.notes
  RETURNING * INTO v_row;

  UPDATE clients
     SET weight_kg = (SELECT weight_kg FROM client_measurements WHERE client_id = v_client ORDER BY measured_on DESC LIMIT 1),
         updated_at = now()
   WHERE id = v_client;

  RETURN jsonb_build_object(
    'id', v_row.id, 'measured_on', v_row.measured_on, 'weight_kg', v_row.weight_kg,
    'body_fat_pct', v_row.body_fat_pct, 'waist_cm', v_row.waist_cm, 'notes', v_row.notes
  );
END;
$$;

-- Elimina un control y vuelve a sincronizar el peso de la ficha con el más reciente que quede
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
           (SELECT weight_kg FROM client_measurements WHERE client_id = v_client ORDER BY measured_on DESC LIMIT 1),
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

-- 2. Cada versión del plan guarda la nota de por qué se creó ("subí a 1.800 kcal por…")
ALTER TABLE plan_versions ADD COLUMN IF NOT EXISTS change_note TEXT;

CREATE OR REPLACE FUNCTION save_plan(p jsonb, p_new_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_client uuid := (p->>'client_id')::uuid;
  v_plan uuid;
  v_version int := round((p->>'version_number')::numeric)::int;
  v_version_id uuid;
  v_token text;
  v_prev record;
  v_expires timestamptz := NULLIF(p->>'share_expires_at', '')::timestamptz;
  v_note text := NULLIF(trim(COALESCE(p->>'change_note', '')), '');
  v_active boolean := NOT COALESCE((p->>'is_share_revoked')::boolean, false);
  v_meal jsonb;
  v_meal_id uuid;
  v_item jsonb;
  m_idx int;
  i_idx int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión no válida' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM clients WHERE id = v_client AND nutritionist_id = v_uid) THEN
    RAISE EXCEPTION 'Paciente no encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Plan: se actualiza si ya existe y es de esta nutricionista; si no, se crea
  v_plan := NULLIF(p->>'id', '')::uuid;
  IF v_plan IS NOT NULL AND EXISTS (
    SELECT 1 FROM meal_plans WHERE id = v_plan AND nutritionist_id = v_uid AND client_id = v_client
  ) THEN
    UPDATE meal_plans
       SET title = p->>'title', notes = NULLIF(p->>'notes', ''), updated_at = now()
     WHERE id = v_plan;
  ELSE
    INSERT INTO meal_plans (client_id, nutritionist_id, title, notes)
    VALUES (v_client, v_uid, p->>'title', NULLIF(p->>'notes', ''))
    RETURNING id INTO v_plan;
  END IF;

  -- Versión: misma versión se reemplaza; una nueva hereda el token estable del plan
  SELECT id, share_token INTO v_prev FROM plan_versions WHERE plan_id = v_plan AND version_number = v_version;
  IF FOUND THEN
    v_version_id := v_prev.id;
    v_token := COALESCE(v_prev.share_token, p_new_token);
    UPDATE plan_versions
       SET is_active = v_active, share_token = v_token, share_expires_at = v_expires, change_note = v_note
     WHERE id = v_version_id;
    DELETE FROM plan_meals WHERE plan_version_id = v_version_id;
  ELSE
    SELECT id, share_token INTO v_prev
      FROM plan_versions
     WHERE plan_id = v_plan AND share_token IS NOT NULL
     ORDER BY version_number DESC LIMIT 1;
    v_token := COALESCE(v_prev.share_token, p_new_token);
    IF v_prev.id IS NOT NULL THEN
      -- El token pasa a la nueva versión; la anterior queda archivada (UNIQUE en share_token)
      UPDATE plan_versions SET share_token = NULL, is_active = false WHERE id = v_prev.id;
    END IF;
    INSERT INTO plan_versions (plan_id, version_number, is_active, share_token, share_expires_at, change_note)
    VALUES (v_plan, v_version, v_active, v_token, v_expires, v_note)
    RETURNING id INTO v_version_id;
  END IF;

  -- Comidas e ítems (la posición en el arreglo es el orden)
  m_idx := 0;
  FOR v_meal IN SELECT * FROM jsonb_array_elements(COALESCE(p->'meals', '[]'::jsonb)) LOOP
    INSERT INTO plan_meals (plan_version_id, name, time, order_index)
    VALUES (v_version_id, v_meal->>'name', NULLIF(v_meal->>'time', '')::time, m_idx)
    RETURNING id INTO v_meal_id;

    i_idx := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_meal->'items', '[]'::jsonb)) LOOP
      INSERT INTO plan_items (meal_id, group_id, subgroup_id, exchanges, pinned_food_id, order_index)
      VALUES (
        v_meal_id,
        v_item->>'group_id',
        NULLIF(v_item->>'subgroup_id', ''),
        (v_item->>'exchanges')::numeric,
        NULLIF(v_item->>'pinned_food_id', ''),
        i_idx
      );
      i_idx := i_idx + 1;
    END LOOP;
    m_idx := m_idx + 1;
  END LOOP;

  UPDATE meal_plans SET updated_at = now() WHERE id = v_plan;

  RETURN jsonb_build_object('plan_id', v_plan, 'version_id', v_version_id, 'share_token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION save_plan(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION save_plan(jsonb, text) TO authenticated;
