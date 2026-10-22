-- ==============================================================================
-- Endurecimiento de planes + alimentos propios + guardado atómico del plan
-- ==============================================================================

-- 1. Un plan solo puede apuntar a un paciente de la propia nutricionista.
--    Antes la política solo comprobaba `nutritionist_id`, así que se podía crear un plan
--    con el `client_id` de un paciente ajeno.
DROP POLICY IF EXISTS "Nutricionistas gestionan sus planes" ON meal_plans;
CREATE POLICY "Nutricionistas gestionan sus planes" ON meal_plans
    FOR ALL
    USING (auth.uid() = nutritionist_id)
    WITH CHECK (
        auth.uid() = nutritionist_id
        AND EXISTS (
            SELECT 1 FROM clients c
            WHERE c.id = meal_plans.client_id AND c.nutritionist_id = auth.uid()
        )
    );

-- 2. Alimentos propios de la nutricionista. El catálogo base (created_by IS NULL) sigue siendo
--    de solo lectura; cada nutricionista solo modifica lo que ella creó. Todos los alimentos
--    activos siguen siendo legibles (el portal los necesita para los equivalentes).
ALTER TABLE foods ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Nutricionistas gestionan sus alimentos" ON foods;
CREATE POLICY "Nutricionistas gestionan sus alimentos" ON foods
    FOR ALL
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Nutricionistas gestionan porciones de sus alimentos" ON food_portions;
CREATE POLICY "Nutricionistas gestionan porciones de sus alimentos" ON food_portions
    FOR ALL
    USING (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_portions.food_id AND f.created_by = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_portions.food_id AND f.created_by = auth.uid()));

DROP POLICY IF EXISTS "Nutricionistas gestionan sinonimos de sus alimentos" ON food_aliases;
CREATE POLICY "Nutricionistas gestionan sinonimos de sus alimentos" ON food_aliases
    FOR ALL
    USING (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_aliases.food_id AND f.created_by = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_aliases.food_id AND f.created_by = auth.uid()));

DROP POLICY IF EXISTS "Nutricionistas gestionan nutrientes de sus alimentos" ON food_nutrients;
CREATE POLICY "Nutricionistas gestionan nutrientes de sus alimentos" ON food_nutrients
    FOR ALL
    USING (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_nutrients.food_id AND f.created_by = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_nutrients.food_id AND f.created_by = auth.uid()));

-- 3. Guardado atómico del plan: plan + versión + comidas + ítems en UNA transacción.
--    Antes el servidor hacía muchas consultas sueltas y un fallo a mitad dejaba el plan
--    incompleto. SECURITY INVOKER: las políticas RLS siguen aplicando a la nutricionista.
--    El token del enlace lo genera el servidor (p_new_token) y solo se usa si el plan aún no tiene.
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
       SET is_active = v_active, share_token = v_token, share_expires_at = v_expires
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
    INSERT INTO plan_versions (plan_id, version_number, is_active, share_token, share_expires_at)
    VALUES (v_plan, v_version, v_active, v_token, v_expires)
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
