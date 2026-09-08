import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { ActionRequest, Timestamp } from "@ecorione/shared-schema";
import { openHubDatabase, type HubDatabase } from "./db.js";
import {
  ApprovalAlreadyDecidedError,
  ApprovalNotFoundError,
  HubRepository,
  RespondNotAllowedError,
} from "./repository.js";

const T0 = "2026-09-08T10:00:00.000Z" as Timestamp;
const T1 = "2026-09-08T10:05:00.000Z" as Timestamp;

let db: HubDatabase;
let repo: HubRepository;

beforeEach(() => {
  db = openHubDatabase();
  repo = new HubRepository(db);
});

afterEach(() => {
  db.close();
});

function actionRequest(overrides: Partial<ActionRequest> = {}): ActionRequest {
  return {
    operationId: "op_a" as never,
    module: "Hub",
    tool: "some.tool",
    actionClass: "SPEND",
    args: {},
    scope: "personal",
    sensitivity: "INTERNAL",
    autonomy: "L1",
    idempotencyKey: null,
    ...overrides,
  };
}

describe("audit log", () => {
  it("recordAuditEvent lalu listAuditEvents mengembalikannya urut waktu", () => {
    repo.recordAuditEvent({
      type: "ACTION_REQUESTED",
      operationId: "op_a" as never,
      module: "Hub",
      detail: { tool: "chat.reply" },
      now: T0,
    });
    repo.recordAuditEvent({
      type: "POLICY_EVALUATED",
      operationId: "op_a" as never,
      module: "Hub",
      detail: { outcome: "ALLOW" },
      ruleId: "read-always-allowed",
      now: T1,
    });

    const events = repo.listAuditEvents();
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("ACTION_REQUESTED");
    expect(events[1]?.type).toBe("POLICY_EVALUATED");
    expect(events[1]?.ruleId).toBe("read-always-allowed");
  });

  it("listAuditEvents memfilter berdasarkan operationId", () => {
    repo.recordAuditEvent({
      type: "ACTION_REQUESTED",
      operationId: "op_a" as never,
      module: "Hub",
      detail: {},
      now: T0,
    });
    repo.recordAuditEvent({
      type: "ACTION_REQUESTED",
      operationId: "op_b" as never,
      module: "Hub",
      detail: {},
      now: T0,
    });

    expect(repo.listAuditEvents({ operationId: "op_a" })).toHaveLength(1);
  });

  it("detail JSON round-trip apa adanya (arbitrary payload)", () => {
    repo.recordAuditEvent({
      type: "MODEL_CALLED",
      operationId: "op_a" as never,
      module: "Hub",
      detail: { model: "claude-sonnet-4-5-20250929", actualUsd: 0.0123, nested: { a: [1, 2] } },
      now: T0,
    });
    const [event] = repo.listAuditEvents();
    expect(event?.detail).toEqual({
      model: "claude-sonnet-4-5-20250929",
      actualUsd: 0.0123,
      nested: { a: [1, 2] },
    });
  });
});

describe("approvals", () => {
  it("createApproval lalu getApproval mengembalikan status PENDING", () => {
    const req = actionRequest();
    repo.createApproval({
      operationId: "op_a" as never,
      actionRequest: req,
      prompt: "Setujui?",
      now: T0,
    });

    const approval = repo.getApproval("op_a");
    expect(approval?.status).toBe("PENDING");
    expect(approval?.actionRequest).toEqual(req);
  });

  it("getApproval untuk operationId yang tidak ada → null", () => {
    expect(repo.getApproval("op_nope")).toBeNull();
  });

  it("decideApproval APPROVE mengubah status dan mencatat decidedAt/decidedBy", () => {
    repo.createApproval({
      operationId: "op_a" as never,
      actionRequest: actionRequest(),
      prompt: "Setujui?",
      now: T0,
    });

    const decided = repo.decideApproval("op_a", "APPROVE", "user", "oke", T1);
    expect(decided.status).toBe("APPROVE");
    expect(decided.decidedBy).toBe("user");
    expect(decided.decidedAt).toBe(T1);
    expect(decided.note).toBe("oke");
  });

  it("decideApproval untuk operationId yang tidak ada → ApprovalNotFoundError", () => {
    expect(() => repo.decideApproval("op_nope", "APPROVE", "user", null, T0)).toThrow(
      ApprovalNotFoundError,
    );
  });

  it("decideApproval dua kali → ApprovalAlreadyDecidedError, bukan overwrite diam-diam", () => {
    repo.createApproval({
      operationId: "op_a" as never,
      actionRequest: actionRequest(),
      prompt: "Setujui?",
      now: T0,
    });
    repo.decideApproval("op_a", "APPROVE", "user", null, T0);

    expect(() => repo.decideApproval("op_a", "REJECT", "user", null, T1)).toThrow(
      ApprovalAlreadyDecidedError,
    );
  });

  it('decideApproval dengan decision "RESPOND" → RespondNotAllowedError (gotcha shared-schema/policy.ts)', () => {
    repo.createApproval({
      operationId: "op_a" as never,
      actionRequest: actionRequest(),
      prompt: "Setujui?",
      now: T0,
    });

    expect(() => repo.decideApproval("op_a", "RESPOND", "user", null, T0)).toThrow(
      RespondNotAllowedError,
    );
    // Approval tetap PENDING — percobaan RESPOND yang ditolak tidak boleh mengubah state.
    expect(repo.getApproval("op_a")?.status).toBe("PENDING");
  });
});
