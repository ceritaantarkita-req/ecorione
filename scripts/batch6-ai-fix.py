from pathlib import Path

for path in [
    "apps/ai/app/api/voice/session/route.ts",
    "apps/ai/app/api/voice/chunk/route.ts",
    "apps/ai/app/api/voice/interrupt/route.ts",
    "apps/ai/app/api/voice/close/route.ts",
]:
    p = Path(path)
    text = p.read_text()
    old = 'from "../../../lib/proxy";'
    if old not in text:
        raise SystemExit(f"missing proxy import marker: {path}")
    p.write_text(text.replace(old, 'from "../../../../lib/proxy";', 1))

p = Path("apps/ai/app/api/voice/stream/route.ts")
text = p.read_text()
text = text.replace('from "../../../lib/env";', 'from "../../../../lib/env";', 1)
text = text.replace('from "../../../lib/proxy";', 'from "../../../../lib/proxy";', 1)
p.write_text(text)

p = Path("apps/ai/lib/voice-client.ts")
text = p.read_text()
old = 'payload !== undefined && typeof payload === "object" && "error" in payload'
new = 'payload !== undefined && payload !== null && typeof payload === "object" && "error" in payload'
if old not in text:
    raise SystemExit("missing voice-client null guard marker")
p.write_text(text.replace(old, new, 1))
