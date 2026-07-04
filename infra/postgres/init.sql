-- Sentinel OS - init.sql
-- Initial database schema setup

-- CREATE DATABASE sentinel_db;
-- Note: Database creation is handled automatically by the postgres:16-alpine container environment variables.

-- Enable UUID generation capabilities
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stub schema for multi-tenant Organization Workspace scoping
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
