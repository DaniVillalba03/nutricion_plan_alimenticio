-- ==============================================================================
-- Portal del paciente: acceso por token SIN exponer las tablas
-- ==============================================================================
-- Las políticas "Acceso publico ..." de la migración inicial permitían a cualquier
-- visitante (clave anon, que es pública) listar TODOS los planes compartidos y sus
-- tokens, porque no estaban atadas a un token concreto. Se eliminan y se reemplazan
-- por una función que devuelve únicamente el plan del token indicado.

DROP POLICY IF EXISTS "Acceso publico con share_token" ON plan_versions;
DROP POLICY IF EXISTS "Acceso publico a comidas de version compartida" ON plan_meals;
DROP POLICY IF EXISTS "Acceso publico a items de version compartida" ON plan_items;

CREATE OR REPLACE FUNCTION get_shared_plan(p_token text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    -- Solo lo necesario para el portal: sin correo, teléfono, peso ni notas clínicas
    'client', jsonb_build_object(
      'id', c.id,
      'full_name', c.full_name,
      'age', c.age,
      'gender', c.gender,
      'target_kcal', c.target_kcal,
      'target_cho_g', c.target_cho_g,
      'target_pro_g', c.target_pro_g,
      'target_lip_g', c.target_lip_g,
      'exclusions', COALESCE((
        SELECT jsonb_agg(r.reason)
        FROM client_food_rules r
        WHERE r.client_id = c.id AND r.rule_type = 'exclude' AND r.reason IS NOT NULL
      ), '[]'::jsonb)
    ),
    'plan', jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'version_number', v.version_number,
      'updated_at', v.created_at,
      'meals', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'name', m.name,
            'time', to_char(m.time, 'HH24:MI'),
            'items', COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', i.id,
                  'group_id', i.group_id,
                  'subgroup_id', i.subgroup_id,
                  'exchanges', i.exchanges,
                  'pinned_food_id', i.pinned_food_id
                ) ORDER BY i.order_index
              )
              FROM plan_items i
              WHERE i.meal_id = m.id
            ), '[]'::jsonb)
          ) ORDER BY m.order_index
        )
        FROM plan_meals m
        WHERE m.plan_version_id = v.id
      ), '[]'::jsonb)
    )
  )
  FROM plan_versions v
  JOIN meal_plans p ON p.id = v.plan_id
  JOIN clients c ON c.id = p.client_id
  WHERE v.share_token = p_token
    AND length(p_token) >= 32            -- los tokens reales son largos y aleatorios
    AND v.is_active
    AND (v.share_expires_at IS NULL OR v.share_expires_at > now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_shared_plan(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_shared_plan(text) TO anon, authenticated;
