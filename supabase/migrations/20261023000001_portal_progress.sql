-- ==============================================================================
-- Portal del paciente: avance diario (comidas completadas y alimentos elegidos)
-- ==============================================================================
-- El portal es anónimo (acceso por token). El paciente NO tiene permisos sobre las
-- tablas: solo puede llamar a funciones que validan el token y escriben dentro del
-- plan de ese token. La nutricionista lee el avance de sus pacientes por RLS.
--
-- Las comidas se identifican por su posición (`meal_index`) y no por id, porque al
-- volver a guardar una versión del plan sus comidas se recrean con ids nuevos.

CREATE TABLE IF NOT EXISTS portal_meal_progress (
    plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    meal_index INT NOT NULL CHECK (meal_index >= 0),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (plan_version_id, day, meal_index)
);

CREATE TABLE IF NOT EXISTS portal_food_choices (
    plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
    meal_index INT NOT NULL CHECK (meal_index >= 0),
    item_index INT NOT NULL CHECK (item_index >= 0),
    food_id VARCHAR(100) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (plan_version_id, meal_index, item_index)
);

ALTER TABLE portal_meal_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_food_choices ENABLE ROW LEVEL SECURITY;

-- La nutricionista solo lee el avance de las versiones de sus propios planes.
-- No hay políticas de escritura: el paciente escribe únicamente vía las funciones de abajo.
DROP POLICY IF EXISTS "Nutricionistas leen el avance de sus pacientes" ON portal_meal_progress;
CREATE POLICY "Nutricionistas leen el avance de sus pacientes" ON portal_meal_progress
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM plan_versions v
            JOIN meal_plans p ON p.id = v.plan_id
            WHERE v.id = portal_meal_progress.plan_version_id AND p.nutritionist_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Nutricionistas leen las elecciones de sus pacientes" ON portal_food_choices;
CREATE POLICY "Nutricionistas leen las elecciones de sus pacientes" ON portal_food_choices
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM plan_versions v
            JOIN meal_plans p ON p.id = v.plan_id
            WHERE v.id = portal_food_choices.plan_version_id AND p.nutritionist_id = auth.uid()
        )
    );

-- Versión de plan que corresponde a un token vigente (la misma regla que get_shared_plan).
-- Es interna: no se concede a anon ni authenticated.
CREATE OR REPLACE FUNCTION portal_version_for_token(p_token text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT v.id
  FROM plan_versions v
  WHERE v.share_token = p_token
    AND length(p_token) >= 32
    AND v.is_active
    AND (v.share_expires_at IS NULL OR v.share_expires_at > now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION portal_version_for_token(text) FROM PUBLIC;

-- Avance del día + alimentos elegidos para el token. Devuelve null si el token no es válido.
CREATE OR REPLACE FUNCTION get_portal_progress(p_token text, p_day date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_id uuid := portal_version_for_token(p_token);
BEGIN
  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'completed_meals', COALESCE((
      SELECT jsonb_agg(meal_index ORDER BY meal_index)
      FROM portal_meal_progress
      WHERE plan_version_id = v_id AND day = p_day
    ), '[]'::jsonb),
    'food_choices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('meal', meal_index, 'item', item_index, 'food_id', food_id))
      FROM portal_food_choices
      WHERE plan_version_id = v_id
    ), '[]'::jsonb)
  );
END;
$$;

-- Marca o desmarca una comida como completada en un día. Devuelve false si el token o los
-- datos no son válidos (día fuera de rango, comida inexistente).
CREATE OR REPLACE FUNCTION set_portal_meal(p_token text, p_day date, p_meal_index int, p_completed boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := portal_version_for_token(p_token);
BEGIN
  IF v_id IS NULL OR p_day IS NULL OR p_meal_index IS NULL OR p_completed IS NULL THEN
    RETURN false;
  END IF;
  -- Solo hoy (con un día de margen por zona horaria): evita llenar la tabla con fechas inventadas
  IF abs(p_day - current_date) > 1 THEN
    RETURN false;
  END IF;
  IF p_meal_index < 0 OR p_meal_index >= (SELECT count(*) FROM plan_meals WHERE plan_version_id = v_id) THEN
    RETURN false;
  END IF;

  IF p_completed THEN
    INSERT INTO portal_meal_progress (plan_version_id, day, meal_index)
    VALUES (v_id, p_day, p_meal_index)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM portal_meal_progress
    WHERE plan_version_id = v_id AND day = p_day AND meal_index = p_meal_index;
  END IF;
  RETURN true;
END;
$$;

-- Guarda el alimento que el paciente eligió para un ítem del plan (null = volver al original).
CREATE OR REPLACE FUNCTION set_portal_food(p_token text, p_meal_index int, p_item_index int, p_food_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := portal_version_for_token(p_token);
BEGIN
  IF v_id IS NULL OR p_meal_index IS NULL OR p_item_index IS NULL OR p_meal_index < 0 OR p_item_index < 0 THEN
    RETURN false;
  END IF;
  IF p_food_id IS NOT NULL AND (length(p_food_id) = 0 OR length(p_food_id) > 100) THEN
    RETURN false;
  END IF;
  -- El ítem debe existir en esa posición del plan
  IF NOT EXISTS (
    SELECT 1
    FROM (
      SELECT id, row_number() OVER (ORDER BY order_index, created_at, id) - 1 AS idx
      FROM plan_meals WHERE plan_version_id = v_id
    ) m
    JOIN (
      SELECT meal_id, row_number() OVER (PARTITION BY meal_id ORDER BY order_index, created_at, id) - 1 AS idx
      FROM plan_items
    ) i ON i.meal_id = m.id
    WHERE m.idx = p_meal_index AND i.idx = p_item_index
  ) THEN
    RETURN false;
  END IF;

  IF p_food_id IS NULL THEN
    DELETE FROM portal_food_choices
    WHERE plan_version_id = v_id AND meal_index = p_meal_index AND item_index = p_item_index;
  ELSE
    INSERT INTO portal_food_choices (plan_version_id, meal_index, item_index, food_id)
    VALUES (v_id, p_meal_index, p_item_index, p_food_id)
    ON CONFLICT (plan_version_id, meal_index, item_index)
    DO UPDATE SET food_id = EXCLUDED.food_id, updated_at = now();
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION get_portal_progress(text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_portal_meal(text, date, int, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_portal_food(text, int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_portal_progress(text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_portal_meal(text, date, int, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_portal_food(text, int, int, text) TO anon, authenticated;

-- Supabase concede EXECUTE a anon/authenticated por defecto sobre funciones nuevas:
-- se quita explícitamente a la función interna, y las tablas quedan sin acceso directo.
REVOKE ALL ON FUNCTION portal_version_for_token(text) FROM anon, authenticated;
REVOKE ALL ON portal_meal_progress, portal_food_choices FROM anon;
