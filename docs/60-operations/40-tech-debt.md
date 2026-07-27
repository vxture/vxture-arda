# Arda 技术债寄存器（TD-NNN，append-only）

> 规则（org taxonomy §4）：稳定 ID、从 001 递增、永不复用/重排；只追加。
> 每项给出：现状、为什么是债、还债验收口径。

## TD-001 测试基建缺失（test-coverage 必查未落）— CLOSED 2026-07-21

- **登记**：2026-07-17（仓库整顿批 A 发现；owner 决定 2026-07-17 列入待办，后续引入真实测试基建）
- **现状（登记时）**：仓内没有任何测试套件；org `main-ruleset.json` 模板要求的 `test-coverage` required check 因此缺席（现行必查 = quality-gate/build/audit/gitleaks）。造恒绿空 job 比没有更糟，故未伪造。
- **为什么是债**：quality-gate 只覆盖静态检查 + 类型 + 构建；行为回归（权益门控、workspace 隔离过滤、C3 幂等、配额判定）无自动化防线，靠 beta 人肉验证。
- **还债方向**（引入时按此验收）：
  1. vitest + @arda/app 单测起步，优先覆盖纯逻辑层：`app/entitlement/*`（capability/quota 矩阵）、workspaceId 过滤 helper、C3 事件 seq/幂等判定。
  2. CI 增 `test-coverage` job（名字必须精确匹配 org ruleset 模板），接入 ruleset required checks。
  3. 覆盖率地板从可达的低线起步（如 lines 40%），只升不降。
- **验收**：`test-coverage` 在 ruleset 必查列表中且 CI 绿；本寄存器该项标记 CLOSED（保留记录不删行）。
- **CLOSED**：PR #166（`ci/add-test-coverage-check`，2026-07-21 合并）引入 `node:test` 单测（`app/entitlement/roles.test.ts` 等）+ CI `test-coverage` job；ruleset 18998777 的 required status checks 已确认包含
  `[quality-gate, build, audit, gitleaks, test-coverage]`。后续会话又补充了 `app/lib/status.test.ts`（C1/C2/C3 状态面板的无泄密断言）等测试，目前共 22 条通过。覆盖率地板未来可再收紧，但本项验收口径（必查上线且绿）已满足。
