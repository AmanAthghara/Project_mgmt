require('dotenv').config();
const { pool } = require('./db');

const SCHEMA = `
-- ── ENUMS ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE gender_type        AS ENUM ('male','female','other','prefer_not_to_say');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_visibility AS ENUM ('public','private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE membership_role    AS ENUM ('admin','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE request_status     AS ENUM ('pending','accepted','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE request_type       AS ENUM ('admin_invite','member_request');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status        AS ENUM ('pending','in_progress','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_priority      AS ENUM ('low','medium','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── OTP STORE (pre-registration) ─────────────────────────────
CREATE TABLE IF NOT EXISTS otp_store (
  id           BIGSERIAL    PRIMARY KEY,
  email        VARCHAR(255) NOT NULL,
  otp_hash     VARCHAR(255) NOT NULL,
  payload      JSONB        NOT NULL,  -- stores registration data until verified
  expires_at   TIMESTAMPTZ  NOT NULL,
  verified     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_store (email, verified);

-- ── USERS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL       PRIMARY KEY,
  first_name    VARCHAR(80)     NOT NULL,
  last_name     VARCHAR(80)     NOT NULL,
  email         VARCHAR(255)    NOT NULL UNIQUE,
  age           SMALLINT        CHECK (age >= 13 AND age <= 120),
  gender        gender_type,
  phone_number  VARCHAR(20),
  password_hash VARCHAR(255)    NOT NULL,
  is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ── PASSWORD RESET TOKENS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used        BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens (user_id);

-- ── PROJECTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          BIGSERIAL           PRIMARY KEY,
  name        VARCHAR(150)        NOT NULL,
  description TEXT,
  visibility  project_visibility  NOT NULL DEFAULT 'public',
  created_by  BIGINT              NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects (visibility);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects (created_by);

-- ── PROJECT MEMBERS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_members (
  id         BIGSERIAL       PRIMARY KEY,
  project_id BIGINT          NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id    BIGINT          NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
  role       membership_role NOT NULL DEFAULT 'member',
  joined_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user    ON project_members (user_id);

-- ── JOIN REQUESTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS join_requests (
  id           BIGSERIAL      PRIMARY KEY,
  project_id   BIGINT         NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  requester_id BIGINT         NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
  type         request_type   NOT NULL,
  status       request_status NOT NULL DEFAULT 'pending',
  message      TEXT,
  resolved_by  BIGINT         REFERENCES users (id) ON DELETE SET NULL,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_open_request UNIQUE (project_id, requester_id)
);
CREATE INDEX IF NOT EXISTS idx_join_requests_project   ON join_requests (project_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_requester ON join_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status    ON join_requests (status);

-- ── TASKS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           BIGSERIAL     PRIMARY KEY,
  project_id   BIGINT        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  title        VARCHAR(200)  NOT NULL,
  description  TEXT,
  priority     task_priority NOT NULL DEFAULT 'medium',
  status       task_status   NOT NULL DEFAULT 'pending',
  created_by   BIGINT        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  assigned_to  BIGINT        REFERENCES users (id) ON DELETE SET NULL,
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_project     ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks (status);

-- ── AUTO updated_at TRIGGER ───────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_users_updated_at    ON users;
DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS trg_tasks_updated_at    ON tasks;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── VIEWS ─────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_project_tasks AS
SELECT t.*, 
  creator.first_name  AS creator_first_name,
  creator.last_name   AS creator_last_name,
  assignee.first_name AS assignee_first_name,
  assignee.last_name  AS assignee_last_name
FROM tasks t
JOIN  users creator  ON creator.id  = t.created_by
LEFT JOIN users assignee ON assignee.id = t.assigned_to;

CREATE OR REPLACE VIEW v_my_tasks AS
SELECT t.*, p.name AS project_name
FROM tasks t
JOIN projects p ON p.id = t.project_id
WHERE t.assigned_to IS NOT NULL;
`;

async function migrate() {
  console.log('[MIGRATE] Starting database migration...');
  try {
    await pool.query(SCHEMA);
    console.log('[MIGRATE] ✅ All tables, indexes, triggers, and views created successfully.');
  } catch (err) {
    console.error('[MIGRATE] ❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
