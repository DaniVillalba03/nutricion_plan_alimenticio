-- ==============================================================================
-- SISTEMA NUTRICIONAL DE PLANIFICACIÓN POR INTERCAMBIOS (PARAGUAY)
-- Migración Inicial: Extensiones, Catálogo Oficial, Tablas Clínicas y RLS
-- Basado en tablas de la Lic. Laura Molinas (Reg. Prof. 6020)
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ==============================================================================
-- 2. TABLAS DEL CATÁLOGO DE INTERCAMBIO
-- ==============================================================================

-- 2.1 Unidades de Medida Casera
CREATE TABLE IF NOT EXISTS measure_units (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    ml_equivalent NUMERIC(6,2), -- Taza = 200, Cuchara sopera = 10, Cucharadita = 5, otros = null
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.2 Grupos de Intercambio
CREATE TABLE IF NOT EXISTS exchange_groups (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    short_name VARCHAR(50) NOT NULL,
    ref_kcal NUMERIC(6,2) NOT NULL,
    ref_cho NUMERIC(6,2) NOT NULL,
    ref_pro NUMERIC(6,2) NOT NULL,
    ref_lip NUMERIC(6,2) NOT NULL,
    tolerance_pct NUMERIC(4,2) DEFAULT 10.0,
    is_discretionary BOOLEAN DEFAULT false,
    is_free_consumption BOOLEAN DEFAULT false,
    educational_warning TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.3 Subgrupos de Intercambio
CREATE TABLE IF NOT EXISTS exchange_subgroups (
    id VARCHAR(50) PRIMARY KEY,
    group_id VARCHAR(50) NOT NULL REFERENCES exchange_groups(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.4 Catálogo Maestro de Alimentos
CREATE TABLE IF NOT EXISTS foods (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    group_id VARCHAR(50) NOT NULL REFERENCES exchange_groups(id) ON DELETE RESTRICT,
    subgroup_id VARCHAR(50) REFERENCES exchange_subgroups(id) ON DELETE SET NULL,
    state VARCHAR(20) NOT NULL CHECK (state IN ('crudo', 'cocido', 'no_aplica')),
    country_origin VARCHAR(10) DEFAULT 'PY',
    brand VARCHAR(150),
    is_paraguayan_marked BOOLEAN DEFAULT false, -- True para productos con sello comercial (*)
    source VARCHAR(150) DEFAULT 'Lic. Laura Molinas (Reg. Prof. 6020)',
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.5 Sinónimos Regionales y Términos Populares (Paraguay)
CREATE TABLE IF NOT EXISTS food_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_id VARCHAR(100) NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    alias VARCHAR(150) NOT NULL,
    region VARCHAR(50) DEFAULT 'PY',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.6 Porciones Caseras y Equivalencias de Gramos Base (1 Intercambio)
CREATE TABLE IF NOT EXISTS food_portions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_id VARCHAR(100) NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    grams NUMERIC(8,2) NOT NULL,
    household_qty NUMERIC(6,2) NOT NULL,
    measure_unit_id VARCHAR(50) REFERENCES measure_units(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.7 Composición Nutricional Base Extendida (Opcional por 100g)
CREATE TABLE IF NOT EXISTS food_nutrients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_id VARCHAR(100) NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    kcal_100g NUMERIC(6,2),
    cho_100g NUMERIC(6,2),
    pro_100g NUMERIC(6,2),
    lip_100g NUMERIC(6,2),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 3. TABLAS CLÍNICAS Y DE PLANIFICACIÓN (NUTRICIONISTA / PACIENTE)
-- ==============================================================================

-- 3.1 Clientes / Pacientes
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nutritionist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    age INT,
    gender VARCHAR(20) CHECK (gender IN ('masculino', 'femenino')),
    weight_kg NUMERIC(5,2),
    height_cm NUMERIC(5,2),
    activity_level VARCHAR(100),
    target_kcal NUMERIC(6,2) NOT NULL,
    target_cho_g NUMERIC(6,2) NOT NULL,
    target_pro_g NUMERIC(6,2) NOT NULL,
    target_lip_g NUMERIC(6,2) NOT NULL,
    notes TEXT,
    consent_accepted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3.2 Reglas de Alimentos por Cliente (Exclusiones / Preferencias)
CREATE TABLE IF NOT EXISTS client_food_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    food_id VARCHAR(100) REFERENCES foods(id) ON DELETE CASCADE,
    group_id VARCHAR(50) REFERENCES exchange_groups(id) ON DELETE CASCADE,
    rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('exclude', 'prefer')),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.3 Planes de Alimentación
CREATE TABLE IF NOT EXISTS meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    nutritionist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3.4 Versiones del Plan (Control de Cambios y Enlaces de Compartir)
CREATE TABLE IF NOT EXISTS plan_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    share_token VARCHAR(100) UNIQUE,
    share_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.5 Tiempos de Comida del Plan (Desayuno, Almuerzo, Merienda, Cena, etc.)
CREATE TABLE IF NOT EXISTS plan_meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    time TIME,
    order_index INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.6 Ítems del Plan (Grupos de Intercambio y Alimento Fijado/Sugerido)
CREATE TABLE IF NOT EXISTS plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id UUID NOT NULL REFERENCES plan_meals(id) ON DELETE CASCADE,
    group_id VARCHAR(50) NOT NULL REFERENCES exchange_groups(id) ON DELETE RESTRICT,
    subgroup_id VARCHAR(50) REFERENCES exchange_subgroups(id) ON DELETE SET NULL,
    exchanges NUMERIC(5,2) NOT NULL CHECK (exchanges > 0),
    pinned_food_id VARCHAR(100) REFERENCES foods(id) ON DELETE SET NULL,
    notes TEXT,
    order_index INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.7 Plantillas Reutilizables de Planes
CREATE TABLE IF NOT EXISTS plan_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nutritionist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    template_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 4. TABLAS DE IMPORTACIÓN Y AUDITORÍA
-- ==============================================================================

-- 4.1 Lotes de Importación (CSV / Excel / Base Extendida)
CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nutritionist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_name VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending',
    total_rows INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.2 Filas de Importación en Validación
CREATE TABLE IF NOT EXISTS import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    raw_data JSONB NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('pending', 'needs_review', 'approved', 'error')),
    validation_errors TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 5. ÍNDICES DE RENDIMIENTO Y BÚSQUEDA TOLERANTE (PG_TRGM)
-- ==============================================================================

-- Búsqueda de alta velocidad y tolerancia a errores tipográficos en nombres y sinónimos
CREATE INDEX IF NOT EXISTS idx_foods_name_trgm ON foods USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_food_aliases_trgm ON food_aliases USING gin (alias gin_trgm_ops);

-- Índices de claves foráneas frecuentes
CREATE INDEX IF NOT EXISTS idx_foods_group_id ON foods(group_id);
CREATE INDEX IF NOT EXISTS idx_foods_subgroup_id ON foods(subgroup_id);
CREATE INDEX IF NOT EXISTS idx_food_portions_food_id ON food_portions(food_id);
CREATE INDEX IF NOT EXISTS idx_clients_nutritionist_id ON clients(nutritionist_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_client_id ON meal_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_plan_versions_plan_id ON plan_versions(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_versions_share_token ON plan_versions(share_token);
CREATE INDEX IF NOT EXISTS idx_plan_meals_version_id ON plan_meals(plan_version_id);
CREATE INDEX IF NOT EXISTS idx_plan_items_meal_id ON plan_items(meal_id);

-- ==============================================================================
-- 6. POLÍTICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE measure_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_subgroups ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_portions ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_food_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;

-- 6.1 Políticas para Tablas de Catálogo (Lectura universal para usuarios autenticados y anónimos de vista pública)
CREATE POLICY "Catalogo visible para todos" ON measure_units FOR SELECT USING (true);
CREATE POLICY "Grupos visibles para todos" ON exchange_groups FOR SELECT USING (true);
CREATE POLICY "Subgrupos visibles para todos" ON exchange_subgroups FOR SELECT USING (true);
CREATE POLICY "Alimentos visibles para todos" ON foods FOR SELECT USING (is_active = true);
CREATE POLICY "Sinonimos visibles para todos" ON food_aliases FOR SELECT USING (true);
CREATE POLICY "Porciones visibles para todos" ON food_portions FOR SELECT USING (true);
CREATE POLICY "Nutrientes visibles para todos" ON food_nutrients FOR SELECT USING (true);

-- 6.2 Políticas para Datos Clínicos de Pacientes (Aislamiento por Nutricionista)
CREATE POLICY "Nutricionistas gestionan sus pacientes" ON clients
    FOR ALL USING (auth.uid() = nutritionist_id);

CREATE POLICY "Nutricionistas gestionan reglas de alimentos de sus pacientes" ON client_food_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM clients WHERE clients.id = client_food_rules.client_id AND clients.nutritionist_id = auth.uid()
        )
    );

CREATE POLICY "Nutricionistas gestionan sus planes" ON meal_plans
    FOR ALL USING (auth.uid() = nutritionist_id);

CREATE POLICY "Nutricionistas gestionan versiones de plan" ON plan_versions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM meal_plans WHERE meal_plans.id = plan_versions.plan_id AND meal_plans.nutritionist_id = auth.uid()
        )
    );

-- Acceso público de lectura a versiones compartidas mediante share_token activo
CREATE POLICY "Acceso publico con share_token" ON plan_versions
    FOR SELECT USING (
        share_token IS NOT NULL AND (share_expires_at IS NULL OR share_expires_at > now())
    );

CREATE POLICY "Nutricionistas gestionan comidas del plan" ON plan_meals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM plan_versions
            JOIN meal_plans ON meal_plans.id = plan_versions.plan_id
            WHERE plan_versions.id = plan_meals.plan_version_id AND meal_plans.nutritionist_id = auth.uid()
        )
    );

CREATE POLICY "Acceso publico a comidas de version compartida" ON plan_meals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM plan_versions
            WHERE plan_versions.id = plan_meals.plan_version_id
            AND share_token IS NOT NULL
            AND (share_expires_at IS NULL OR share_expires_at > now())
        )
    );

CREATE POLICY "Nutricionistas gestionan items del plan" ON plan_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM plan_meals
            JOIN plan_versions ON plan_versions.id = plan_meals.plan_version_id
            JOIN meal_plans ON meal_plans.id = plan_versions.plan_id
            WHERE plan_meals.id = plan_items.meal_id AND meal_plans.nutritionist_id = auth.uid()
        )
    );

CREATE POLICY "Acceso publico a items de version compartida" ON plan_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM plan_meals
            JOIN plan_versions ON plan_versions.id = plan_meals.plan_version_id
            WHERE plan_meals.id = plan_items.meal_id
            AND plan_versions.share_token IS NOT NULL
            AND (plan_versions.share_expires_at IS NULL OR plan_versions.share_expires_at > now())
        )
    );

CREATE POLICY "Nutricionistas gestionan sus plantillas" ON plan_templates
    FOR ALL USING (auth.uid() = nutritionist_id);

CREATE POLICY "Nutricionistas gestionan sus lotes de importacion" ON import_batches
    FOR ALL USING (auth.uid() = nutritionist_id);

CREATE POLICY "Nutricionistas gestionan filas de importacion" ON import_rows
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM import_batches
            WHERE import_batches.id = import_rows.batch_id AND import_batches.nutritionist_id = auth.uid()
        )
    );
