---
name: supabase-guard
description: Audita la seguridad de Supabase leyendo migraciones y código, sin tocar la base: tablas sin RLS, políticas públicas sobre datos de pacientes, funciones SECURITY DEFINER mal cerradas y llaves en el código. Úsala al crear o cambiar migraciones, políticas, server actions o el portal, y antes de desplegar cambios que toquen datos.
---

# supabase-guard

Corre `node .claude/skills/supabase-guard/check.mjs`. Son datos de salud: un hallazgo `CRÍTICO` detiene todo hasta resolverlo.

## Qué revisa
1. **Tablas nuevas sin RLS** (`ENABLE ROW LEVEL SECURITY`).
2. **Lectura abierta** (`USING (true)` o `share_token IS NOT NULL`) sobre tablas que no son catálogo. Esto fue un hueco real: cualquiera con la clave `anon` (pública) podía listar todos los tokens. El acceso del portal va por `get_shared_plan(token)`.
3. **`SECURITY DEFINER`** sin `SET search_path` o sin `REVOKE ALL … FROM PUBLIC` explícito.
4. **Secretos en `src/`**: `service_role`, variables `NEXT_PUBLIC_*` con nombre de secreto, JWT pegados.
5. **Migraciones pendientes**: avisa cuáles hay sin aplicar.

## Reglas de trabajo
- **Nunca ejecutes SQL ni uses `service_role`.** Escribe el archivo de migración, explícale a la usuaria que debe pegarlo en Supabase → SQL Editor y espera su confirmación.
- Después de que la aplique, verifica desde fuera con la clave `anon` (pública): `curl` a `/rest/v1/<tabla>` debe devolver `[]` para tablas clínicas y la función debe devolver `null` con un token inexistente. No imprimas la llave.
- Una política nueva sobre datos de pacientes siempre cuelga de `auth.uid() = nutritionist_id` (o de una función `SECURITY DEFINER` que reciba el token).
- Catálogo (grupos, alimentos): lectura pública está bien; escritura nunca.

## Falso positivo conocido
La lista `PUBLIC_READ_OK` del script define qué tablas de catálogo pueden ser públicas. Si agregas una tabla de catálogo, súmala ahí (en el script) con su justificación.
