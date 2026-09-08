import { describe, expect, it } from "vitest";
import { isId, SessionIdSchema } from "@ecorione/shared-schema";
import { makeSessionId } from "./session";

describe("makeSessionId", () => {
  it("berawalan sess_ dan lolos SessionIdSchema/isId Hub (verifikasi asumsi di komentar modul)", () => {
    const id = makeSessionId();
    expect(id.startsWith("sess_")).toBe(true);
    expect(isId("session", id)).toBe(true);
    expect(SessionIdSchema.safeParse(id).success).toBe(true);
  });

  it("UUID v4 lowercase apa adanya (dengan tanda hubung) lolos tanpa perlu dibersihkan", () => {
    const id = makeSessionId(() => "3fa85f64-5717-4562-b3fc-2c963f66afa6");
    expect(id).toBe("sess_3fa85f64-5717-4562-b3fc-2c963f66afa6");
    expect(isId("session", id)).toBe(true);
  });

  it("dua panggilan berbeda menghasilkan id berbeda (random bawaan, bukan konstan)", () => {
    expect(makeSessionId()).not.toBe(makeSessionId());
  });
});
