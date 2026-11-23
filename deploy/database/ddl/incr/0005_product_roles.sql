BEGIN;
CREATE TABLE IF NOT EXISTS local_authz.member (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL,                       -- [ref]
  sub            VARCHAR(128) NOT NULL,               -- [ref] full "usr_<uuid>"
  display_name   VARCHAR(255),                        -- platform cache (may go stale)
  avatar_hash    VARCHAR(128),                        -- platform cache
  status         VARCHAR(32) NOT NULL DEFAULT 'active'
                   CONSTRAINT chk_member_status CHECK (status IN ('active', 'inactive')),
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uidx_member_ws_sub UNIQUE (workspace_id, sub)
);

-- Product function-role catalog (product seed; e.g. reviewer/editor). This is
-- NOT the platform governance role domain (owner/manager/member/readonly/guest).
CREATE TABLE IF NOT EXISTS local_authz.role (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code   VARCHAR(64) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uidx_role_role_code UNIQUE (role_code)
);

CREATE TABLE IF NOT EXISTS local_authz.permission (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perm_code   VARCHAR(64) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uidx_permission_perm_code UNIQUE (perm_code)
);

CREATE TABLE IF NOT EXISTS local_authz.member_role (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL,
  role_id     UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_member_role_member FOREIGN KEY (member_id) REFERENCES local_authz.member (id) ON DELETE CASCADE,
  CONSTRAINT fk_member_role_role FOREIGN KEY (role_id) REFERENCES local_authz.role (id) ON DELETE CASCADE,
  CONSTRAINT uidx_member_role_member_role UNIQUE (member_id, role_id)
);

CREATE TABLE IF NOT EXISTS local_authz.role_permission (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id        UUID NOT NULL,
  permission_id  UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_role_permission_role FOREIGN KEY (role_id) REFERENCES local_authz.role (id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permission_permission FOREIGN KEY (permission_id) REFERENCES local_authz.permission (id) ON DELETE CASCADE,
  CONSTRAINT uidx_role_permission_role_perm UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS local_authz.owner_anchor (
  workspace_id UUID PRIMARY KEY,
  member_id UUID NOT NULL UNIQUE REFERENCES local_authz.member(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS local_authz.role_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  actor_sub VARCHAR(128) NOT NULL,
  target_sub VARCHAR(128) NOT NULL,
  action VARCHAR(64) NOT NULL,
  roles_before JSONB NOT NULL,
  roles_after JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catalogs are product-owned; runtime may assign roles, not rewrite policy.
INSERT INTO local_authz.role(role_code,name) VALUES ('owner','owner') ON CONFLICT (role_code) DO NOTHING;
INSERT INTO local_authz.role(role_code,name) VALUES ('administrator','administrator') ON CONFLICT (role_code) DO NOTHING;
INSERT INTO local_authz.role(role_code,name) VALUES ('member','member') ON CONFLICT (role_code) DO NOTHING;
INSERT INTO local_authz.role(role_code,name) VALUES ('readonly','readonly') ON CONFLICT (role_code) DO NOTHING;
INSERT INTO local_authz.role(role_code,name) VALUES ('guest','guest') ON CONFLICT (role_code) DO NOTHING;
INSERT INTO local_authz.permission(perm_code,name) VALUES ('product.enter','product.enter') ON CONFLICT (perm_code) DO NOTHING;
INSERT INTO local_authz.permission(perm_code,name) VALUES ('data.read','data.read') ON CONFLICT (perm_code) DO NOTHING;
INSERT INTO local_authz.permission(perm_code,name) VALUES ('data.write','data.write') ON CONFLICT (perm_code) DO NOTHING;
INSERT INTO local_authz.permission(perm_code,name) VALUES ('data.export','data.export') ON CONFLICT (perm_code) DO NOTHING;
INSERT INTO local_authz.permission(perm_code,name) VALUES ('ai.use','ai.use') ON CONFLICT (perm_code) DO NOTHING;
INSERT INTO local_authz.permission(perm_code,name) VALUES ('service.publish','service.publish') ON CONFLICT (perm_code) DO NOTHING;
INSERT INTO local_authz.permission(perm_code,name) VALUES ('members.manage','members.manage') ON CONFLICT (perm_code) DO NOTHING;
INSERT INTO local_authz.permission(perm_code,name) VALUES ('product.manage','product.manage') ON CONFLICT (perm_code) DO NOTHING;
INSERT INTO local_authz.permission(perm_code,name) VALUES ('ownership.transfer','ownership.transfer') ON CONFLICT (perm_code) DO NOTHING;
INSERT INTO local_authz.permission(perm_code,name) VALUES ('guest.read','guest.read') ON CONFLICT (perm_code) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='owner' AND p.perm_code='product.enter' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='owner' AND p.perm_code='data.read' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='owner' AND p.perm_code='data.write' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='owner' AND p.perm_code='data.export' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='owner' AND p.perm_code='ai.use' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='owner' AND p.perm_code='service.publish' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='owner' AND p.perm_code='members.manage' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='owner' AND p.perm_code='product.manage' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='owner' AND p.perm_code='ownership.transfer' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='owner' AND p.perm_code='guest.read' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='administrator' AND p.perm_code='product.enter' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='administrator' AND p.perm_code='data.read' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='administrator' AND p.perm_code='data.write' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='administrator' AND p.perm_code='data.export' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='administrator' AND p.perm_code='ai.use' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='administrator' AND p.perm_code='service.publish' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='administrator' AND p.perm_code='members.manage' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='administrator' AND p.perm_code='product.manage' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='administrator' AND p.perm_code='guest.read' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='member' AND p.perm_code='product.enter' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='member' AND p.perm_code='data.read' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='member' AND p.perm_code='data.write' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='member' AND p.perm_code='data.export' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='member' AND p.perm_code='ai.use' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='member' AND p.perm_code='service.publish' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='readonly' AND p.perm_code='product.enter' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='readonly' AND p.perm_code='data.read' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='guest' AND p.perm_code='product.enter' ON CONFLICT (role_id,permission_id) DO NOTHING;
INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT r.id,p.id FROM local_authz.role r CROSS JOIN local_authz.permission p WHERE r.role_code='guest' AND p.perm_code='guest.read' ON CONFLICT (role_id,permission_id) DO NOTHING;

GRANT USAGE ON SCHEMA local_authz TO arda_svc;
GRANT SELECT, INSERT ON local_authz.member TO arda_svc;
GRANT SELECT, INSERT, DELETE ON local_authz.member_role, local_authz.owner_anchor TO arda_svc;
REVOKE DELETE ON local_authz.member FROM arda_svc;
GRANT SELECT, INSERT ON local_authz.role_audit TO arda_svc;
GRANT SELECT ON local_authz.role, local_authz.permission, local_authz.role_permission TO arda_svc;
REVOKE INSERT, UPDATE, DELETE ON local_authz.role, local_authz.permission, local_authz.role_permission FROM arda_svc;
REVOKE UPDATE ON local_authz.member, local_authz.member_role, local_authz.owner_anchor FROM arda_svc;
GRANT UPDATE (display_name, avatar_hash, status, updated_at) ON local_authz.member TO arda_svc;
REVOKE UPDATE, DELETE ON local_authz.role_audit FROM arda_svc;
COMMIT;
