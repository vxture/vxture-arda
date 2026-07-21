-- platform-seed.sql - arda platform-provided foundational reference data.
--
-- scope=platform rows carry workspaceId = NULL (the explicit axis; NOT a
-- fabricated sentinel - data_platform_100 2.3.2). They are read-only to ALL
-- workspaces via the workspaceId = self OR workspaceId IS NULL overlay.
-- Multi-industry basics: geography, finance, org/person identity, contact,
-- units, time. Standards are the definitions; the 10 code-sets also materialize
-- as reference-data assets in the catalog, bound back to their standard via
-- DatasetStandard.
--
-- Idempotent (ON CONFLICT on the platform-namespace partial unique indexes -
-- Standard_platform_code_key / Dataset_platform_code_key - which are the arbiters
-- for workspaceId IS NULL rows). Apply as the DB owner into each stack's arda db.
-- NOT the demo seed (prisma/seed.sql) - this is product reference data.
--
-- All targets (Standard/Dataset/DatasetStandard) are domain tables in `catalog`
-- (ADR-012); resolve them unqualified via search_path.
SET search_path TO "catalog", "public";

-- 1) Standards (16: 10 code-sets + 6 data-elements) --------------------------
INSERT INTO "Standard" (id, "workspaceId", code, name, type, ref, items, usage, status, scope, "createdAt", "updatedAt") VALUES
  ('plat_std_country',  NULL, 'STD-P01', '国家和地区代码',   'code-set',     'ISO 3166-1',    249,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_currency', NULL, 'STD-P02', '货币代码',         'code-set',     'ISO 4217',      180,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_language', NULL, 'STD-P03', '语言代码',         'code-set',     'ISO 639-1',     184,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_admindiv', NULL, 'STD-P04', '行政区划代码',     'code-set',     'GB/T 2260',    3213,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_industry', NULL, 'STD-P05', '国民经济行业分类', 'code-set',     'GB/T 4754-2017', 1381, 0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_sex',      NULL, 'STD-P06', '性别代码',         'code-set',     'GB/T 2261.1',     4,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_ethnic',   NULL, 'STD-P07', '民族代码',         'code-set',     'GB/T 3304',      56,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_idtype',   NULL, 'STD-P08', '证件类型代码',     'code-set',     'CN-IDTYPE',      12,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_uom',      NULL, 'STD-P09', '计量单位代码',     'code-set',     'GB 3100/UN-ECE', 60,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_marital',  NULL, 'STD-P10', '婚姻状况代码',     'code-set',     'GB/T 2261.2',     5,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_usci',     NULL, 'STD-P11', '统一社会信用代码', 'data-element', 'GB 32100',        0,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_citizenid',NULL, 'STD-P12', '公民身份号码',     'data-element', 'GB 11643',        0,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_mobile',   NULL, 'STD-P13', '手机号码',         'data-element', 'CN-MOBILE',       0,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_email',    NULL, 'STD-P14', '电子邮箱',         'data-element', 'RFC 5322',        0,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_amount',   NULL, 'STD-P15', '金额',             'data-element', 'DECIMAL(18,2)',   0,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_std_datetime', NULL, 'STD-P16', '日期时间',         'data-element', 'ISO 8601',        0,  0, 'published', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) WHERE "workspaceId" IS NULL DO UPDATE SET
  name = EXCLUDED.name, type = EXCLUDED.type, ref = EXCLUDED.ref, items = EXCLUDED.items,
  status = EXCLUDED.status, scope = EXCLUDED.scope, "updatedAt" = CURRENT_TIMESTAMP;

-- 2) Reference-data assets (the 10 code-sets, materialized into the catalog) --
INSERT INTO "Dataset" (id, "workspaceId", code, name, description, domain, team, "refreshFreq", type, "rowCountEst", classification, scope, "createdAt", "updatedAt") VALUES
  ('plat_ds_country',  NULL, 'ref_country',  '国家和地区代码表',   '按 ISO 3166-1 的国家与地区标准代码', 'reference', 'platform', 'monthly', 'table', 249,  'public', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_ds_currency', NULL, 'ref_currency', '货币代码表',         '按 ISO 4217 的货币标准代码',        'reference', 'platform', 'monthly', 'table', 180,  'public', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_ds_language', NULL, 'ref_language', '语言代码表',         '按 ISO 639-1 的语言标准代码',       'reference', 'platform', 'monthly', 'table', 184,  'public', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_ds_admindiv', NULL, 'ref_admindiv', '行政区划代码表',     '按 GB/T 2260 的中国行政区划代码',   'reference', 'platform', 'monthly', 'table', 3213, 'public', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_ds_industry', NULL, 'ref_industry', '国民经济行业分类表', '按 GB/T 4754-2017 的行业分类代码',  'reference', 'platform', 'monthly', 'table', 1381, 'public', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_ds_sex',      NULL, 'ref_sex',      '性别代码表',         '按 GB/T 2261.1 的性别代码',         'reference', 'platform', 'monthly', 'table', 4,    'public', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_ds_ethnic',   NULL, 'ref_ethnic',   '民族代码表',         '按 GB/T 3304 的民族代码',           'reference', 'platform', 'monthly', 'table', 56,   'public', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_ds_idtype',   NULL, 'ref_idtype',   '证件类型代码表',     '常用证件类型标准代码',              'reference', 'platform', 'monthly', 'table', 12,   'public', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_ds_uom',      NULL, 'ref_uom',      '计量单位代码表',     '常用计量单位标准代码',              'reference', 'platform', 'monthly', 'table', 60,   'public', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plat_ds_marital',  NULL, 'ref_marital',  '婚姻状况代码表',     '按 GB/T 2261.2 的婚姻状况代码',     'reference', 'platform', 'monthly', 'table', 5,    'public', 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) WHERE "workspaceId" IS NULL DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, domain = EXCLUDED.domain,
  "rowCountEst" = EXCLUDED."rowCountEst", classification = EXCLUDED.classification,
  scope = EXCLUDED.scope, "updatedAt" = CURRENT_TIMESTAMP;

-- 3) Bind each reference asset to its standard (standard -> asset thread) -----
INSERT INTO "DatasetStandard" ("datasetId", "standardId", "workspaceId") VALUES
  ('plat_ds_country',  'plat_std_country',  NULL),
  ('plat_ds_currency', 'plat_std_currency', NULL),
  ('plat_ds_language', 'plat_std_language', NULL),
  ('plat_ds_admindiv', 'plat_std_admindiv', NULL),
  ('plat_ds_industry', 'plat_std_industry', NULL),
  ('plat_ds_sex',      'plat_std_sex',      NULL),
  ('plat_ds_ethnic',   'plat_std_ethnic',   NULL),
  ('plat_ds_idtype',   'plat_std_idtype',   NULL),
  ('plat_ds_uom',      'plat_std_uom',      NULL),
  ('plat_ds_marital',  'plat_std_marital',  NULL)
ON CONFLICT ("datasetId", "standardId") DO NOTHING;
