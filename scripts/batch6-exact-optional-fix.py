from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing strict-optional marker in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


for path in [
    "services/connect/src/providers/local.ts",
    "services/connect/src/providers/anthropic.ts",
    "services/connect/src/providers/openai-compatible.ts",
    "services/connect/src/multimodal.ts",
]:
    replace_once(
        path,
        "      signal,\n",
        "      ...(signal === undefined ? {} : { signal }),\n",
    )

replace_once(
    "services/hub/src/http.ts",
    "            signal,\n",
    "            ...(signal === undefined ? {} : { signal }),\n",
)

p = Path("services/hub/src/orchestrate.ts")
text = p.read_text()
old = """  try {
    return await httpJson<T>(`${deps.contextUrl}${path}`, {
      token: deps.internalToken,
      ...init,
    });"""
new = """  try {
    const { signal, ...requestInit } = init;
    return await httpJson<T>(`${deps.contextUrl}${path}`, {
      token: deps.internalToken,
      ...requestInit,
      ...(signal === undefined ? {} : { signal }),
    });"""
if old not in text:
    raise SystemExit("missing callContext strict-optional marker")
text = text.replace(old, new, 1)
text = text.replace(
    "      signal: options.signal,",
    "      ...(options.signal === undefined ? {} : { signal: options.signal }),",
)
p.write_text(text)
