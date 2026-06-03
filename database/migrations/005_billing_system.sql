-- Migration: 005_billing_system.sql
-- Creates invoices, invoice_items, and redesigned payments tables for Phase 3

-- 1. Drop existing payments table
DROP TABLE IF EXISTS payments CASCADE;

-- 2. Create invoices table
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'paid', 'cancelled', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create invoice_items table
CREATE TABLE invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('consultation', 'laboratory', 'pharmacy', 'procedure', 'admission')),
  item_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
  total_price DECIMAL(12, 2) NOT NULL CHECK (total_price >= 0)
);

-- 4. Create payments table
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('UPI', 'Credit Card', 'Debit Card', 'Net Banking')),
  payment_provider VARCHAR(50) NOT NULL DEFAULT 'Razorpay',
  transaction_id VARCHAR(100),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')),
  paid_at TIMESTAMPTZ,
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  razorpay_signature VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Triggers for updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 6. Indexes for queries
CREATE INDEX idx_invoices_hospital_patient ON invoices (hospital_id, patient_id);
CREATE INDEX idx_invoices_status ON invoices (hospital_id, status);
CREATE INDEX idx_invoice_items_invoice ON invoice_items (invoice_id);
CREATE INDEX idx_payments_hospital_invoice ON payments (hospital_id, invoice_id);
CREATE INDEX idx_payments_razorpay_order ON payments (razorpay_order_id);

-- 7. Seed invoice and payment for demo patient
INSERT INTO invoices (hospital_id, invoice_number, patient_id, appointment_id, created_by, subtotal, tax_amount, discount_amount, total_amount, status, created_at)
SELECT 
  p.hospital_id,
  'INV-2026-100001',
  p.id,
  a.id,
  (SELECT id FROM users WHERE email = 'admin@mediconnect.local' LIMIT 1),
  65.00,
  5.00,
  0.00,
  70.00,
  'paid',
  now() - interval '2 days'
FROM patients p
JOIN appointments a ON a.patient_id = p.id
ORDER BY a.id ASC
LIMIT 1;

INSERT INTO invoice_items (invoice_id, item_type, item_name, quantity, unit_price, total_price)
SELECT 
  id,
  'consultation',
  'Cardiology Consultation',
  1,
  65.00,
  65.00
FROM invoices
WHERE invoice_number = 'INV-2026-100001';

INSERT INTO payments (hospital_id, invoice_id, patient_id, payment_method, payment_provider, transaction_id, amount, status, paid_at, razorpay_order_id, razorpay_payment_id, razorpay_signature)
SELECT 
  i.hospital_id,
  i.id,
  i.patient_id,
  'Credit Card',
  'Razorpay',
  'pay_mock12345678',
  70.00,
  'paid',
  now() - interval '2 days',
  'order_mock12345678',
  'pay_mock12345678',
  'sig_mock12345678'
FROM invoices i
WHERE i.invoice_number = 'INV-2026-100001';
