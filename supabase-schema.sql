-- ============================================
-- BizOps — Supabase PostgreSQL Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Materials (Bahan Mentah)
-- ============================================
CREATE TABLE IF NOT EXISTS materials (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    unit        TEXT NOT NULL DEFAULT 'pcs',
    price_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_per_unit >= 0),
    stock       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (stock >= 0),
    min_stock   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. Products (Produk)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    selling_price   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. Recipes (Resep — bahan per produk)
-- ============================================
CREATE TABLE IF NOT EXISTS recipes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    qty_per_pcs NUMERIC(10,4) NOT NULL DEFAULT 0 CHECK (qty_per_pcs >= 0),
    UNIQUE(product_id, material_id)
);

-- ============================================
-- 4. Sales (Transaksi Penjualan)
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_revenue   NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_cost      NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_profit    NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- ============================================
-- 5. Sales Items (Detail Item Penjualan)
-- ============================================
CREATE TABLE IF NOT EXISTS sales_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id             UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    qty                 INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
    selling_price_at_time NUMERIC(12,2) NOT NULL DEFAULT 0,
    cost_per_pcs        NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_recipes_material ON recipes(material_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_items_sale ON sales_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_product ON sales_items(product_id);

-- ============================================
-- Updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to materials & products
CREATE TRIGGER trg_materials_updated
    BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RPC: Atomic sale transaction
-- Deducts material stock based on recipes
-- ============================================
CREATE OR REPLACE FUNCTION process_sale(
    p_items JSONB  -- Array of {product_id, qty, selling_price_at_time, cost_per_pcs}
)
RETURNS UUID AS $$
DECLARE
    v_sale_id UUID;
    v_total_revenue NUMERIC(14,2) := 0;
    v_total_cost NUMERIC(14,2) := 0;
    v_total_profit NUMERIC(14,2) := 0;
    v_item JSONB;
    v_recipe RECORD;
    v_deduct NUMERIC;
    v_current_stock NUMERIC;
BEGIN
    -- Calculate totals
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_total_revenue := v_total_revenue + (v_item->>'selling_price_at_time')::NUMERIC * (v_item->>'qty')::INTEGER;
        v_total_cost := v_total_cost + (v_item->>'cost_per_pcs')::NUMERIC * (v_item->>'qty')::INTEGER;
    END LOOP;
    v_total_profit := v_total_revenue - v_total_cost;

    -- Create sale record
    INSERT INTO sales (total_revenue, total_cost, total_profit)
    VALUES (v_total_revenue, v_total_cost, v_total_profit)
    RETURNING id INTO v_sale_id;

    -- Process each sale item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Insert sale item
        INSERT INTO sales_items (sale_id, product_id, qty, selling_price_at_time, cost_per_pcs)
        VALUES (
            v_sale_id,
            (v_item->>'product_id')::UUID,
            (v_item->>'qty')::INTEGER,
            (v_item->>'selling_price_at_time')::NUMERIC,
            (v_item->>'cost_per_pcs')::NUMERIC
        );

        -- Deduct materials based on recipe
        FOR v_recipe IN
            SELECT material_id, qty_per_pcs
            FROM recipes
            WHERE product_id = (v_item->>'product_id')::UUID
        LOOP
            v_deduct := v_recipe.qty_per_pcs * (v_item->>'qty')::INTEGER;

            -- Check stock sufficiency
            SELECT stock INTO v_current_stock FROM materials WHERE id = v_recipe.material_id FOR UPDATE;
            IF v_current_stock < v_deduct THEN
                RAISE EXCEPTION 'Stok bahan % tidak mencukupi (butuh %, tersedia %)',
                    v_recipe.material_id, v_deduct, v_current_stock;
            END IF;

            UPDATE materials
            SET stock = stock - v_deduct
            WHERE id = v_recipe.material_id;
        END LOOP;
    END LOOP;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Row Level Security (RLS) — disable for now
-- Enable & configure when auth is set up
-- ============================================
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_items ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust as needed)
CREATE POLICY "Allow all for authenticated" ON materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON recipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON sales_items FOR ALL USING (true) WITH CHECK (true);
