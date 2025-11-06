-- Cloudflare Monitor Database Schema
-- SQLite optimized for real-time monitoring workloads

-- Design Principles:
-- 1. Denormalization for query performance
-- 2. Timestamps for temporal queries
-- 3. Indexes on high-cardinality lookup columns
-- 4. STRICT tables for type safety (SQLite 3.37+)

-- Projects Table: Core Cloudflare Pages projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    account_id TEXT NOT NULL,
    subdomain TEXT,
    production_branch TEXT,
    created_at TEXT NOT NULL,
    last_synced_at TEXT NOT NULL,
    metadata TEXT -- JSON blob for extensibility
) STRICT;

CREATE INDEX IF NOT EXISTS idx_projects_account ON projects(account_id);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- Deployments Table: Deployment records with denormalized project data
CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    short_id TEXT,
    project_id TEXT NOT NULL,
    project_name TEXT NOT NULL, -- Denormalized for query efficiency
    environment TEXT NOT NULL CHECK(environment IN ('production', 'preview')),
    url TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active', 'building', 'deploying', 'failure', 'queued', 'cancelled')),
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    last_synced_at TEXT NOT NULL,
    stage_name TEXT,
    stage_status TEXT,
    stage_started_at TEXT,
    stage_ended_at TEXT,
    metadata TEXT, -- JSON blob for additional data
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS idx_deployments_project ON deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_environment ON deployments(environment);
CREATE INDEX IF NOT EXISTS idx_deployments_modified ON deployments(modified_at DESC);

-- Workers Table: Cloudflare Workers metadata
CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    account_id TEXT NOT NULL,
    etag TEXT NOT NULL,
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    last_synced_at TEXT NOT NULL,
    usage_model TEXT CHECK(usage_model IN ('bundled', 'unbound')),
    metadata TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS idx_workers_account ON workers(account_id);
CREATE INDEX IF NOT EXISTS idx_workers_modified ON workers(modified_at DESC);

-- Worker Routes Table: Traffic routing configuration
CREATE TABLE IF NOT EXISTS worker_routes (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    pattern TEXT NOT NULL,
    zone_id TEXT,
    zone_name TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(worker_id) REFERENCES workers(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS idx_worker_routes_worker ON worker_routes(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_routes_zone ON worker_routes(zone_id);

-- Metrics Snapshots Table: Time-series metrics for dashboards
CREATE TABLE IF NOT EXISTS metrics_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    total_projects INTEGER NOT NULL DEFAULT 0,
    total_deployments INTEGER NOT NULL DEFAULT 0,
    active_deployments INTEGER NOT NULL DEFAULT 0,
    building_deployments INTEGER NOT NULL DEFAULT 0,
    failed_deployments INTEGER NOT NULL DEFAULT 0,
    total_workers INTEGER NOT NULL DEFAULT 0,
    metadata TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics_snapshots(timestamp DESC);

-- System Health Table: Service health tracking
CREATE TABLE IF NOT EXISTS system_health (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('healthy', 'degraded', 'unhealthy')),
    database_status TEXT NOT NULL CHECK(database_status IN ('operational', 'degraded', 'down')),
    cloudflare_api_status TEXT NOT NULL CHECK(cloudflare_api_status IN ('operational', 'degraded', 'down')),
    polling_status TEXT NOT NULL CHECK(polling_status IN ('operational', 'degraded', 'down')),
    uptime_seconds INTEGER NOT NULL,
    details TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS idx_health_timestamp ON system_health(timestamp DESC);
