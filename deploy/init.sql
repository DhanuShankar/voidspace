-- ============================================================================
-- VOID Cloud IDE - Database Initialization Schema
-- ============================================================================
-- This script sets up the initial database schema for the application.
-- Run this once during initial deployment.
--
-- Features supported:
-- - User management with plans
-- - Session management
-- - Colab session tracking
-- - File uploads
-- - Session storage
-- - Gateway configurations
-- - Migration tracking
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Users Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    google_id VARCHAR(255) UNIQUE,
    google_access_token TEXT,
    google_refresh_token TEXT,
    colab_quota_used FLOAT DEFAULT 0,
    colab_quota_limit FLOAT DEFAULT 10,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    preferences JSONB DEFAULT '{}'
);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- ============================================================================
-- JWT Tokens Table (for refresh tokens, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    token_type VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_token_hash ON tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_tokens_expires_at ON tokens(expires_at);

-- ============================================================================
-- Colab Sessions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS colab_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_url TEXT,
    access_token TEXT,
    workspace_name VARCHAR(500),
    runtime_type VARCHAR(100) DEFAULT 't4',
    gpu_enabled BOOLEAN DEFAULT TRUE,
    auto_shutdown_minutes INTEGER DEFAULT 720,
    status VARCHAR(50) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'shutting_down')),
    started_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW(),
    shutdown_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_colab_sessions_user_id ON colab_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_colab_sessions_status ON colab_sessions(status);
CREATE INDEX IF NOT EXISTS idx_colab_sessions_last_seen ON colab_sessions(last_seen_at);

-- ============================================================================
-- Session Storage (for files)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_data JSONB NOT NULL,
    drive_file_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created ON user_sessions(created_at);

-- ============================================================================
-- File Uploads
-- ============================================================================
CREATE TABLE IF NOT EXISTS uploaded_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(255),
    storage_path TEXT NOT NULL,
    drive_file_id TEXT,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_uploaded ON uploaded_files(uploaded_at);

-- ============================================================================
-- Code Executions (Audit Log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS code_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    language VARCHAR(50) NOT NULL,
    gateway VARCHAR(50) DEFAULT 'colab',
    execution_time_ms INTEGER,
    result JSONB,
    error TEXT,
    executed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_executions_user_id ON code_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_code_executions_executed ON code_executions(executed_at);
CREATE INDEX IF NOT EXISTS idx_code_executions_language ON code_executions(language);

-- ============================================================================
-- Gateway Configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS gateways (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    gateway_type VARCHAR(50) NOT NULL,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gateways_type ON gateways(gateway_type);
CREATE INDEX IF NOT EXISTS idx_gateways_active ON gateways(is_active);

-- Insert default gateways
INSERT INTO gateways (name, gateway_type, config, is_active) VALUES
    ('Colab', 'colab', '{"timeout": 30000, "autoShutdownMinutes": 720}', TRUE),
    ('Local', 'local', '{"timeout": 10000}', FALSE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- API Usage Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    ip_address INET,
    user_agent TEXT,
    executed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_executed ON api_usage(executed_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_endpoint ON api_usage(user_id, endpoint);

-- ============================================================================
-- System Settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT 'null',
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

INSERT INTO settings (key, value, description) VALUES
    ('max_colab_quota_free', '10', 'Max Colab GPU hours for free tier'),
    ('max_colab_quota_pro', '50', 'Max Colab GPU hours for pro tier'),
    ('max_colab_quota_enterprise', '200', 'Max Colab GPU hours for enterprise tier'),
    ('default_auto_shutdown', '720', 'Default auto-shutdown time in minutes'),
    ('maintenance_mode', 'false', 'System maintenance mode')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Audit Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    executed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_executed ON audit_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================================================
-- Migration Tracking Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gateways_updated_at BEFORE UPDATE ON gateways
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Views
-- ============================================================================

-- User stats view
CREATE OR REPLACE VIEW user_stats AS
SELECT
    u.id,
    u.email,
    u.name,
    u.plan,
    u.created_at,
    COUNT(DISTINCT cs.id) as total_sessions,
    COUNT(DISTINCT ce.id) as total_executions,
    COALESCE(SUM(ce.execution_time_ms), 0) as total_execution_time_ms,
    u.colab_quota_used,
    u.colab_quota_limit,
    (u.colab_quota_limit - u.colab_quota_used) as quota_remaining
FROM users u
LEFT JOIN colab_sessions cs ON u.id = cs.user_id
LEFT JOIN code_executions ce ON u.id = ce.user_id
GROUP BY u.id;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on user-sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Note: When using Supabase or similar, use their built-in auth system
-- For standalone Postgres, you'll implement JWT-based auth in application layer

-- ============================================================================
-- Initial Admin User (if needed)
-- ============================================================================
-- Uncomment and modify for initial admin setup
-- INSERT INTO users (email, password_hash, name, plan, email_verified)
-- VALUES (
--     'admin@void.local',
--     crypt('admin_password', gen_salt('bf')),
--     'Admin User',
--     'enterprise',
--     true
-- );

COMMIT;

-- ============================================================================
-- End of Schema
-- ============================================================================
