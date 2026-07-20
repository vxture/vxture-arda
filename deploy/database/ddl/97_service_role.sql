-- 97_service_role.sql - least-privilege app service role (org governance #7).
--
-- The app connects as arda_svc, NOT as the database owner. arda_svc can read,
-- insert and delete rows but holds NO DDL rights and NO blanket UPDATE - the
-- writable-column whitelist lives in 98_column_locks.sql.
--
-- Idempotent: safe to re-run (role create is guarded; grants are additive).
-- Requires psql var  -v svc_password='<password>'  (apply.sh passes it from
-- the ARDA_SVC_PASSWORD env var; the value never lands on disk or in argv of
-- anything but psql itself inside the db container).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'arda_svc') THEN
    CREATE ROLE arda_svc LOGIN;
  END IF;
END
$$;

ALTER ROLE arda_svc LOGIN PASSWORD :'svc_password';

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO arda_svc', current_database());
END
$$;

-- Multi-schema (ADR-012): usage on every schema arda owns. local_authz is
-- empty today but granted so future product-RBAC tables inherit access.
GRANT USAGE ON SCHEMA vx_provision, local_usage, local_authz, catalog TO arda_svc;

-- Row-level DML floor: SELECT / INSERT / DELETE on every table across the
-- non-empty schemas. UPDATE is deliberately absent here - 98_column_locks.sql
-- grants it per-column. (DELETE stays broad: the ADR 5.1 workspace wipe deletes
-- rows across all business tables and runs as the service role.)
GRANT SELECT, INSERT, DELETE ON ALL TABLES IN SCHEMA vx_provision, local_usage, catalog TO arda_svc;

-- Future tables created by the owner role inherit the same floor.
ALTER DEFAULT PRIVILEGES IN SCHEMA vx_provision, local_usage, local_authz, catalog
  GRANT SELECT, INSERT, DELETE ON TABLES TO arda_svc;
