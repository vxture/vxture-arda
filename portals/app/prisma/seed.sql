-- Demo/sample seed for a single workspace, runnable against a deployed stack's
-- Postgres (the DB is internal to the compose network, so this runs on the host
-- via `docker exec <stack>-db psql`). Idempotent: re-running upserts. Pass the
-- target workspace with `-v workspace_id='<id>'`.
--
--   docker exec -i arda-beta-db sh -c \
--     'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
--        -v workspace_id=ws_xxx' < seed.sql
--
-- Mirrors prisma/seed.ts (the local dev seed). Ids are md5(workspace||code) so
-- they are deterministic and foreign keys resolve without round-trips.

-- Resolve unqualified domain tables to the `catalog` schema (ADR-012); the
-- workspace mirror moved to vx_provision.app_instance and is qualified below.
SET search_path TO "catalog", "vx_provision", "local_usage", "public";

-- Workspace mirror (isolation anchor; vx_provision.app_instance <- WorkspaceRef).
INSERT INTO "vx_provision"."app_instance" (id, "orgId", "createdAt")
VALUES (:'workspace_id', 'demo-org', now())
ON CONFLICT (id) DO NOTHING;

-- Datasets ------------------------------------------------------------------
INSERT INTO "Dataset" (id, "workspaceId", code, name, description, domain, team, "refreshFreq", type, "rowCountEst", "ownerUserId", classification, "createdAt", "updatedAt")
VALUES
  (md5(:'workspace_id' || 'dw_customer_master'), :'workspace_id', 'dw_customer_master', 'Customer Master', 'Authoritative master record for every customer: identity, contacts, and lifecycle attributes.', 'customer', 'platform', 'realtime', 'table', 12100000, 'A. Rivera', 'core'::"AssetLevel", now(), now()),
  (md5(:'workspace_id' || 'dw_order_txn'), :'workspace_id', 'dw_order_txn', 'Order Transactions', 'Line-item order and transaction history across all channels.', 'product', 'engineering', 'daily', 'table', 384000000, 'L. Chen', 'internal'::"AssetLevel", now(), now()),
  (md5(:'workspace_id' || 'dw_web_clickstream'), :'workspace_id', 'dw_web_clickstream', 'Web Clickstream', 'Page views, sessions, and events from web and app surfaces.', 'web', 'growth', 'realtime', 'stream', 1200000000, 'M. Okafor', 'public'::"AssetLevel", now(), now()),
  (md5(:'workspace_id' || 'dw_revenue_ledger'), :'workspace_id', 'dw_revenue_ledger', 'Revenue Ledger', 'Recognized revenue and billing events reconciled to the general ledger.', 'finance', 'finance', 'daily', 'table', 27400000, 'S. Patel', 'sensitive'::"AssetLevel", now(), now()),
  (md5(:'workspace_id' || 'dw_mkt_attribution'), :'workspace_id', 'dw_mkt_attribution', 'Marketing Attribution', 'Multi-touch attribution joining campaign spend to conversions.', 'marketing', 'growth', 'daily', 'table', 9100000, 'R. Haddad', 'internal'::"AssetLevel", now(), now()),
  (md5(:'workspace_id' || 'dw_support_tickets'), :'workspace_id', 'dw_support_tickets', 'Support Tickets', 'Customer support cases, interactions, and resolution metrics.', 'customer', 'ops', 'realtime', 'table', 18600000, 'J. Park', 'sensitive'::"AssetLevel", now(), now()),
  (md5(:'workspace_id' || 'dw_inventory_iot'), :'workspace_id', 'dw_inventory_iot', 'Inventory Telemetry', 'Warehouse and fulfilment sensor telemetry.', 'operations', 'ops', 'realtime', 'stream', 640000000, 'T. Mori', 'internal'::"AssetLevel", now(), now()),
  (md5(:'workspace_id' || 'dw_product_catalog'), :'workspace_id', 'dw_product_catalog', 'Product Catalog', 'Canonical product, SKU, and pricing reference.', 'product', 'engineering', 'weekly', 'table', 182000, 'C. Silva', 'public'::"AssetLevel", now(), now()),
  (md5(:'workspace_id' || 'dw_subscriptions'), :'workspace_id', 'dw_subscriptions', 'Subscription Entitlements', 'Per-workspace subscription state and tier history mirrored from the platform.', 'finance', 'platform', 'daily', 'table', 4600000, 'H. Yusuf', 'core'::"AssetLevel", now(), now()),
  (md5(:'workspace_id' || 'dw_campaign_perf'), :'workspace_id', 'dw_campaign_perf', 'Campaign Performance', 'Aggregated campaign delivery, engagement, and ROI metrics.', 'marketing', 'analytics', 'daily', 'view', 52800000, 'R. Haddad', 'internal'::"AssetLevel", now(), now()),
  (md5(:'workspace_id' || 'dw_churn_scores'), :'workspace_id', 'dw_churn_scores', 'Churn Risk Scores', 'Model-scored churn propensity per customer with feature contributions.', 'customer', 'analytics', 'weekly', 'table', 12000000, 'L. Chen', 'sensitive'::"AssetLevel", now(), now()),
  (md5(:'workspace_id' || 'dw_web_sessions'), :'workspace_id', 'dw_web_sessions', 'Clickstream Sessions', 'Sessionised clickstream rollups with device, geo, and acquisition attributes.', 'web', 'growth', 'weekly', 'view', 340000000, 'M. Okafor', 'public'::"AssetLevel", now(), now())
ON CONFLICT ("workspaceId", code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, domain = EXCLUDED.domain,
  team = EXCLUDED.team, "refreshFreq" = EXCLUDED."refreshFreq", type = EXCLUDED.type,
  "rowCountEst" = EXCLUDED."rowCountEst", "ownerUserId" = EXCLUDED."ownerUserId",
  classification = EXCLUDED.classification, "updatedAt" = now();

-- Standards -----------------------------------------------------------------
INSERT INTO "Standard" (id, "workspaceId", code, name, type, ref, items, usage, status, "createdAt", "updatedAt")
VALUES
  (md5(:'workspace_id' || 'STD-001'), :'workspace_id', 'STD-001', 'Country Codes', 'code-set', 'ISO 3166-1', 249, 1204, 'published', now(), now()),
  (md5(:'workspace_id' || 'STD-002'), :'workspace_id', 'STD-002', 'Currency Codes', 'code-set', 'ISO 4217', 180, 968, 'published', now(), now()),
  (md5(:'workspace_id' || 'STD-003'), :'workspace_id', 'STD-003', 'Unified Org Identifier', 'data-element', 'Internal STD-ORG', 1, 842, 'published', now(), now()),
  (md5(:'workspace_id' || 'STD-004'), :'workspace_id', 'STD-004', 'Postal Address Structure', 'data-element', 'Internal STD-ADDR', 9, 624, 'published', now(), now()),
  (md5(:'workspace_id' || 'STD-005'), :'workspace_id', 'STD-005', 'Product Category Taxonomy', 'code-set', 'Internal 2026', 142, 88, 'draft', now(), now()),
  (md5(:'workspace_id' || 'STD-006'), :'workspace_id', 'STD-006', 'Data Classification Levels', 'code-set', 'Internal SEC', 64, 53, 'review', now(), now()),
  (md5(:'workspace_id' || 'STD-007'), :'workspace_id', 'STD-007', 'Date / Time Format', 'data-element', 'ISO 8601', 1, 1486, 'published', now(), now()),
  (md5(:'workspace_id' || 'STD-008'), :'workspace_id', 'STD-008', 'Language Codes', 'code-set', 'ISO 639-1', 184, 312, 'published', now(), now())
ON CONFLICT ("workspaceId", code) DO UPDATE SET
  name = EXCLUDED.name, type = EXCLUDED.type, ref = EXCLUDED.ref,
  items = EXCLUDED.items, usage = EXCLUDED.usage, status = EXCLUDED.status, "updatedAt" = now();

-- Quality rules + two results each (for trend) ------------------------------
INSERT INTO "QualityRule" (id, "workspaceId", "datasetId", code, name, dimension, type, severity, enabled)
VALUES
  (md5(:'workspace_id' || 'Q-201'), :'workspace_id', md5(:'workspace_id' || 'dw_customer_master'), 'Q-201', 'Identifier checksum', 'validity', 'not_null', 'warning', true),
  (md5(:'workspace_id' || 'Q-188'), :'workspace_id', md5(:'workspace_id' || 'dw_order_txn'), 'Q-188', 'Order id uniqueness', 'uniqueness', 'unique', 'warning', true),
  (md5(:'workspace_id' || 'Q-174'), :'workspace_id', md5(:'workspace_id' || 'dw_web_clickstream'), 'Q-174', 'Geo bounds check', 'accuracy', 'range', 'warning', true),
  (md5(:'workspace_id' || 'Q-159'), :'workspace_id', md5(:'workspace_id' || 'dw_support_tickets'), 'Q-159', 'Timestamp null rate', 'completeness', 'not_null', 'warning', true),
  (md5(:'workspace_id' || 'Q-143'), :'workspace_id', md5(:'workspace_id' || 'dw_revenue_ledger'), 'Q-143', 'Amount range threshold', 'validity', 'range', 'warning', true),
  (md5(:'workspace_id' || 'Q-126'), :'workspace_id', md5(:'workspace_id' || 'dw_churn_scores'), 'Q-126', 'Freshness SLA', 'timeliness', 'freshness', 'warning', true)
ON CONFLICT ("workspaceId", code) DO UPDATE SET
  "datasetId" = EXCLUDED."datasetId", name = EXCLUDED.name, dimension = EXCLUDED.dimension, type = EXCLUDED.type;

INSERT INTO "QualityResult" (id, "workspaceId", "ruleId", "datasetId", "runAt", status, score, issues)
VALUES
  (md5(:'workspace_id' || 'Q-201' || '-prev'), :'workspace_id', md5(:'workspace_id' || 'Q-201'), md5(:'workspace_id' || 'dw_customer_master'), now() - interval '7 days', 'pass'::"QualityStatus", 99.4, 9842),
  (md5(:'workspace_id' || 'Q-201' || '-cur'),  :'workspace_id', md5(:'workspace_id' || 'Q-201'), md5(:'workspace_id' || 'dw_customer_master'), now(), 'pass'::"QualityStatus", 99.2, 9842),
  (md5(:'workspace_id' || 'Q-188' || '-prev'), :'workspace_id', md5(:'workspace_id' || 'Q-188'), md5(:'workspace_id' || 'dw_order_txn'), now() - interval '7 days', 'pass'::"QualityStatus", 97.2, 12480),
  (md5(:'workspace_id' || 'Q-188' || '-cur'),  :'workspace_id', md5(:'workspace_id' || 'Q-188'), md5(:'workspace_id' || 'dw_order_txn'), now(), 'pass'::"QualityStatus", 97.6, 12480),
  (md5(:'workspace_id' || 'Q-174' || '-prev'), :'workspace_id', md5(:'workspace_id' || 'Q-174'), md5(:'workspace_id' || 'dw_web_clickstream'), now() - interval '7 days', 'pass'::"QualityStatus", 99.8, 1204),
  (md5(:'workspace_id' || 'Q-174' || '-cur'),  :'workspace_id', md5(:'workspace_id' || 'Q-174'), md5(:'workspace_id' || 'dw_web_clickstream'), now(), 'pass'::"QualityStatus", 99.8, 1204),
  (md5(:'workspace_id' || 'Q-159' || '-prev'), :'workspace_id', md5(:'workspace_id' || 'Q-159'), md5(:'workspace_id' || 'dw_support_tickets'), now() - interval '7 days', 'warn'::"QualityStatus", 92.0, 184200),
  (md5(:'workspace_id' || 'Q-159' || '-cur'),  :'workspace_id', md5(:'workspace_id' || 'Q-159'), md5(:'workspace_id' || 'dw_support_tickets'), now(), 'warn'::"QualityStatus", 91.4, 184200),
  (md5(:'workspace_id' || 'Q-143' || '-prev'), :'workspace_id', md5(:'workspace_id' || 'Q-143'), md5(:'workspace_id' || 'dw_revenue_ledger'), now() - interval '7 days', 'fail'::"QualityStatus", 85.0, 42600),
  (md5(:'workspace_id' || 'Q-143' || '-cur'),  :'workspace_id', md5(:'workspace_id' || 'Q-143'), md5(:'workspace_id' || 'dw_revenue_ledger'), now(), 'fail'::"QualityStatus", 86.2, 42600),
  (md5(:'workspace_id' || 'Q-126' || '-prev'), :'workspace_id', md5(:'workspace_id' || 'Q-126'), md5(:'workspace_id' || 'dw_churn_scores'), now() - interval '7 days', 'fail'::"QualityStatus", 89.5, 23400),
  (md5(:'workspace_id' || 'Q-126' || '-cur'),  :'workspace_id', md5(:'workspace_id' || 'Q-126'), md5(:'workspace_id' || 'dw_churn_scores'), now(), 'fail'::"QualityStatus", 88.7, 23400)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status, score = EXCLUDED.score, issues = EXCLUDED.issues, "runAt" = EXCLUDED."runAt";

-- Data services -------------------------------------------------------------
INSERT INTO "DataService" (id, "workspaceId", code, name, path, method, description, domain, level, type, status, "createdAt")
VALUES
  (md5(:'workspace_id' || 'API-1042'), :'workspace_id', 'API-1042', 'Customer Verify', '/api/v2/customer/verify', 'POST', 'Verify a customer by identifier and return a masked profile summary.', 'customer', 'core'::"AssetLevel", 'rest_api', 'running', now()),
  (md5(:'workspace_id' || 'API-2087'), :'workspace_id', 'API-2087', 'Org Lookup', '/api/v2/org/entity', 'GET', 'Look up an organization''s registration and status by unified identifier.', 'finance', 'internal'::"AssetLevel", 'rest_api', 'running', now()),
  (md5(:'workspace_id' || 'API-3310'), :'workspace_id', 'API-3310', 'Geocode', '/api/v2/geo/geocode', 'GET', 'Forward and reverse geocoding against the standard address library.', 'operations', 'public'::"AssetLevel", 'rest_api', 'running', now()),
  (md5(:'workspace_id' || 'API-4521'), :'workspace_id', 'API-4521', 'Risk Score', '/api/v2/risk/score', 'POST', 'Return a customer risk score; requires approval before invocation.', 'customer', 'core'::"AssetLevel", 'rest_api', 'review', now()),
  (md5(:'workspace_id' || 'API-5093'), :'workspace_id', 'API-5093', 'Realtime Heatmap', '/api/v2/web/heatmap', 'GET', 'Aggregated realtime activity heatmap, refreshed every 5 minutes.', 'web', 'sensitive'::"AssetLevel", 'query', 'running', now()),
  (md5(:'workspace_id' || 'API-6320'), :'workspace_id', 'API-6320', 'Inventory Report', '/api/v2/ops/report', 'POST', 'Submit and retrieve inventory reconciliation reports.', 'operations', 'internal'::"AssetLevel", 'rest_api', 'paused', now())
ON CONFLICT ("workspaceId", code) DO UPDATE SET
  name = EXCLUDED.name, path = EXCLUDED.path, method = EXCLUDED.method,
  description = EXCLUDED.description, domain = EXCLUDED.domain, level = EXCLUDED.level,
  type = EXCLUDED.type, status = EXCLUDED.status;

\echo 'Seed complete for workspace' :'workspace_id'
