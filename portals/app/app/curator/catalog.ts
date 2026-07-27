/**
 * arda Curator - task/function registry (ADR-013 / arda-biz-270).
 *
 * INTENTIONALLY EMPTY. Owner decision 2026-07-28: what the Curator manages
 * is not yet scoped - this file exists only so the architecture (auth,
 * tier gate, Atlas call skeleton) has somewhere to register concrete tasks
 * once they are defined, without another restructure. Mirrors karda's own
 * capability.ts posture ("empty until karda's feature keys are defined").
 *
 * When tasks are defined, add them here as entries the future dispatcher
 * can route on - do not scatter task definitions elsewhere.
 */

export interface CuratorTask {
  key: string;
  /** Minimum CuratorAccess.readonly value the task requires (false = needs write). */
  requiresWrite: boolean;
}

export const CURATOR_TASKS: readonly CuratorTask[] = [];
