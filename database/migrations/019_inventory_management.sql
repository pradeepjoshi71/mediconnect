-- Migration: 019_inventory_management.sql
-- Creates inventory_items and inventory_transactions tables and registers permissions.

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL, -- e.g., 'Medicine', 'Consumable', 'Equipment'
  unit VARCHAR(50) NOT NULL, -- e.g., 'Box', 'Tablet', 'Piece'
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  minimum_stock INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  expiry_date DATE,
  vendor VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_hospital_sku UNIQUE (hospital_id, sku)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('Stock In', 'Stock Out', 'Adjustment', 'Transfer')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_hospital ON inventory_items (hospital_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_hospital_item ON inventory_transactions (hospital_id, inventory_item_id);

-- Ensure updated_at trigger exists
CREATE OR REPLACE TRIGGER trg_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Register permission if not already done
INSERT INTO permissions (code, name, description)
VALUES ('manage_inventory_ops', 'Manage Inventory Operations', 'Ability to view, create, edit, transact, and report on clinic inventory')
ON CONFLICT (code) DO NOTHING;

-- Grant to Admin / Hospital Admin / Super Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'hospital_admin', 'admin')
  AND p.code = 'manage_inventory_ops'
ON CONFLICT DO NOTHING;
