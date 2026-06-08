-- Migration: 011_hospital_applications.sql
-- Create table for managing clinic and hospital registration requests

CREATE TABLE IF NOT EXISTS hospital_applications (
  id SERIAL PRIMARY KEY,
  hospital_name VARCHAR(160) NOT NULL,
  contact_person VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(24) NOT NULL,
  address TEXT NOT NULL,
  hospital_type VARCHAR(60) NOT NULL,
  number_of_doctors INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
