-- Migration: Add offline payment support columns to payments table
-- Run: node --env-file=.env backend/src/db/migrations/run_migration.js

-- Step 1: Add new columns to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'online';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_number VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS received_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;

-- Step 2: Expand payment_method constraint to include offline payment methods
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method::text = ANY(ARRAY[
    'UPI',
    'Credit Card',
    'Debit Card',
    'Net Banking',
    'Wallet',
    'Cash',
    'Card Machine',
    'Bank Transfer'
  ]::text[]));

-- Step 3: Expand invoices status constraint to include partially_paid
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status::text = ANY(ARRAY[
    'draft',
    'pending',
    'partially_paid',
    'paid',
    'cancelled',
    'refunded'
  ]::text[]));
