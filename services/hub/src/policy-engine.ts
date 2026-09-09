/** Deterministic Hub policy. Hard denial ceilings are evaluated before approval rules. */
import {
  alwaysRequiresApproval,
  autonomyExceeds,
  MAX_AUTONOMY_V1,
  type ActionRequest,
  type PolicyRule,
  type PolicyVerdict,
} from "@ecorione/shared-schema";

export const POLICY_RULES = {
  AUTONOMY_CEILING: {
    id: "autonomy-ceiling",
    description: `Level otonomi melebihi plafon (${MAX_AUTONOMY_V1}).`,
    version: "2",
  },
  ALWAYS_GATED: {
    id: "always-gated",
    description: "Kelas aksi yang selalu butuh persetujuan manusia.",
    version: "2",
  },
  READ_ALWAYS_ALLOWED: {
    id: "read-always-allowed",
    description: "Aksi baca-saja selalu diizinkan.",
    version: "2",
  },
  DEFAULT_ALLOW_L1_L3: {
    id: "default-allow-l1-l3",
    description: "Side effect reversible dalam plafon otonomi.",
    version: "2",
  },
} as const satisfies Readonly<Record<string, PolicyRule>>;
export interface PolicyEvaluation {
  readonly verdict: PolicyVerdict;
  readonly rule: PolicyRule;
}
export function evaluatePolicy(req: ActionRequest): PolicyEvaluation {
  if (autonomyExceeds(req.autonomy, MAX_AUTONOMY_V1)) {
    return {
      verdict: {
        outcome: "DENY",
        reason: `Otonomi "${req.autonomy}" melebihi plafon "${MAX_AUTONOMY_V1}".`,
      },
      rule: POLICY_RULES.AUTONOMY_CEILING,
    };
  }
  if (alwaysRequiresApproval(req.actionClass)) {
    return {
      verdict: {
        outcome: "REQUIRE_APPROVAL",
        reason: `Kelas aksi "${req.actionClass}" selalu butuh persetujuan.`,
        prompt: `Setujui "${req.tool}" (${req.actionClass}) di scope "${req.scope}"?`,
      },
      rule: POLICY_RULES.ALWAYS_GATED,
    };
  }
  if (req.actionClass === "READ")
    return {
      verdict: { outcome: "ALLOW", reason: "Aksi READ tidak mengubah state apa pun." },
      rule: POLICY_RULES.READ_ALWAYS_ALLOWED,
    };
  return {
    verdict: {
      outcome: "ALLOW",
      reason: "Reversible write dalam plafon otonomi — diizinkan default.",
    },
    rule: POLICY_RULES.DEFAULT_ALLOW_L1_L3,
  };
}
