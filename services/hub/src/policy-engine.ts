/**
 * Policy engine — `docs/api-fase1.md` §Hub "Policy engine (`policy-engine.ts`)", `prd.md` §22.
 *
 * Aturan deterministik bernomor, dievaluasi berurutan, berhenti di yang pertama menyala.
 * **Bukan** ML/heuristik yang bisa "belajar" mengizinkan lebih banyak diam-diam — setiap
 * perubahan perilaku gerbang harus terlihat di diff aturan ini, dengan `version` yang naik.
 *
 * Fase 1 hanya benar-benar melatih jalur aturan 1 dan 3 lewat chat + forget (keduanya
 * `READ`/`REVERSIBLE_WRITE` yang tidak masuk `ALWAYS_GATED`); aturan 2/4 ditulis lengkap
 * dan diuji unit supaya Fase 3+ (Flow/Sandbox/AutoClick) tidak mulai dari nol.
 */

import {
  alwaysRequiresApproval,
  autonomyExceeds,
  MAX_AUTONOMY_V1,
  type ActionRequest,
  type PolicyRule,
  type PolicyVerdict,
} from "@ecorione/shared-schema";

export const POLICY_RULES = {
  ALWAYS_GATED: {
    id: "always-gated",
    description: "Kelas aksi yang selalu butuh persetujuan manusia, berapa pun otonominya.",
    version: "1",
  },
  AUTONOMY_CEILING: {
    id: "autonomy-ceiling",
    description: `Level otonomi request melebihi plafon Fase 1 (${MAX_AUTONOMY_V1}).`,
    version: "1",
  },
  READ_ALWAYS_ALLOWED: {
    id: "read-always-allowed",
    description: "Aksi baca-saja selalu diizinkan — tidak mengubah apa pun.",
    version: "1",
  },
  DEFAULT_ALLOW_L1_L3: {
    id: "default-allow-l1-l3",
    description: "Reversible write dalam plafon otonomi — diizinkan default.",
    version: "1",
  },
} as const satisfies Readonly<Record<string, PolicyRule>>;

export interface PolicyEvaluation {
  readonly verdict: PolicyVerdict;
  readonly rule: PolicyRule;
}

export function evaluatePolicy(req: ActionRequest): PolicyEvaluation {
  // 1. Kelas yang selalu butuh approval — IRREVERSIBLE_WRITE, SPEND, EXTERNAL_SEND,
  //    CREDENTIAL_ACCESS (lihat ALWAYS_GATED di shared-schema/policy.ts).
  if (alwaysRequiresApproval(req.actionClass)) {
    return {
      verdict: {
        outcome: "REQUIRE_APPROVAL",
        reason: `Kelas aksi "${req.actionClass}" selalu butuh persetujuan, berapa pun otonominya.`,
        prompt: `Setujui "${req.tool}" (${req.actionClass}) di scope "${req.scope}"?`,
      },
      rule: POLICY_RULES.ALWAYS_GATED,
    };
  }

  // 2. Plafon otonomi — L4 tidak ada untuk apa pun yang konsekuensial.
  if (autonomyExceeds(req.autonomy, MAX_AUTONOMY_V1)) {
    return {
      verdict: {
        outcome: "DENY",
        reason: `Otonomi "${req.autonomy}" melebihi plafon Fase 1 ("${MAX_AUTONOMY_V1}").`,
      },
      rule: POLICY_RULES.AUTONOMY_CEILING,
    };
  }

  // 3. Baca-saja selalu boleh.
  if (req.actionClass === "READ") {
    return {
      verdict: { outcome: "ALLOW", reason: "Aksi READ tidak mengubah state apa pun." },
      rule: POLICY_RULES.READ_ALWAYS_ALLOWED,
    };
  }

  // 4. Sisanya (reversible write dalam plafon otonomi) — diizinkan default.
  return {
    verdict: {
      outcome: "ALLOW",
      reason: "Reversible write dalam plafon otonomi — diizinkan default.",
    },
    rule: POLICY_RULES.DEFAULT_ALLOW_L1_L3,
  };
}
