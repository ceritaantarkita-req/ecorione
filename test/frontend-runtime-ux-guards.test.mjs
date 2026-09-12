import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("frontend runtime UX guard contracts", () => {
  it("keeps Space page loads and create mutations race-safe", async () => {
    const space = await source("apps/ai/app/space/page.tsx");

    expect(space).toContain("const createPageInFlightRef = useRef(false)");
    expect(space).toContain("const selectedPageIdRef = useRef<string | null>(null)");
    expect(space).toContain("const pageRequestRef = useRef(0)");
    expect(space).toContain(
      "requestId !== pageRequestRef.current || selectedPageIdRef.current !== id",
    );
    expect(space).toContain("createPageInFlightRef.current = true");
    expect(space).toContain("createPageInFlightRef.current = false");
  });

  it("keeps Flow dirty-state, stale-validation, and run guards explicit", async () => {
    const flow = await source("apps/ai/app/flow/page.tsx");

    expect(flow).toContain("const draftRevisionRef = useRef(0)");
    expect(flow).toContain("const lastPersistedRevisionRef = useRef<number | null>(null)");
    expect(flow).toContain("const validationInFlightRef = useRef(false)");
    expect(flow).toContain("Draft berubah saat validasi berjalan; hasil lama diabaikan.");
    expect(flow).toContain("Save perubahan terbaru sebelum Run.");
    expect(flow).toContain("savedCurrentDraft");
    expect(flow).toContain("!validation?.valid");
  });

  it("preserves narrow responsive fallbacks and intentional Flow canvas scrolling", async () => {
    const [spaceCss, flowCss, opsCss, settingsCss, navCss] = await Promise.all([
      source("apps/ai/app/space/Space.module.css"),
      source("apps/ai/app/flow/FlowCanvas.module.css"),
      source("apps/ai/app/ops/OpsDashboard.module.css"),
      source("apps/ai/app/settings/Settings.module.css"),
      source("apps/ai/app/navigation.css"),
    ]);

    expect(spaceCss).toContain("@media (max-width: 760px)");
    expect(spaceCss).toMatch(
      /\.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    );

    expect(flowCss).toContain("@media (max-width: 760px)");
    expect(flowCss).toMatch(/\.canvas\s*\{[^}]*overflow:\s*auto/s);
    expect(flowCss).toMatch(
      /\.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    );
    expect(flowCss).toMatch(/\.canvasWrap\s*\{[^}]*overflow-x:\s*auto/s);

    expect(opsCss).toContain("@media (max-width: 760px)");
    expect(opsCss).toMatch(/\.grid\s*\{[^}]*grid-template-columns:\s*1fr/s);

    expect(settingsCss).toContain("@media (max-width: 720px)");
    expect(settingsCss).toMatch(/\.formGrid\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(settingsCss).toMatch(/\.inline\s*\{[^}]*flex-direction:\s*column/s);

    expect(navCss).toContain("@media (max-width: 780px)");
    expect(navCss).toMatch(/\.ecr-global-nav__links\s*\{[^}]*overflow-x:\s*auto/s);
    expect(navCss).toMatch(/\.ecr-global-nav__links\s*\{[^}]*min-width:\s*0/s);
  });
});
