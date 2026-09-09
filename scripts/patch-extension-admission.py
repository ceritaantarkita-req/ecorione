from pathlib import Path

path = Path("services/hub/src/extension-http.ts")
text = path.read_text()
needle = """function auditFailure(\n  repo: HubRepository,\n  request: ActionRequest,\n  error: unknown,\n  now: Timestamp,\n): void {\n"""
helper = """function enforceSecurityAdmission(\n  report: ReturnType<ExtensionRegistry[\"validate\"]>,\n): void {\n  if (!report.allowed) {\n    throw toHttpError(new ExtensionSecurityBlockedError(report));\n  }\n}\n\n"""
if helper not in text:
    if needle not in text:
        raise SystemExit("auditFailure anchor not found")
    text = text.replace(needle, helper + needle, 1)

old_install = """    const report = registry.validate(body.manifest);\n    const action = mutationActionRequest(\"install\", body.manifest.id, body, {\n"""
new_install = """    const report = registry.validate(body.manifest);\n    enforceSecurityAdmission(report);\n    const action = mutationActionRequest(\"install\", body.manifest.id, body, {\n"""
if old_install in text:
    text = text.replace(old_install, new_install, 1)
elif new_install not in text:
    raise SystemExit("install admission anchor not found")

old_update = """    const report = registry.validate(body.manifest);\n    const action = mutationActionRequest(\"update\", params.id, body, {\n"""
new_update = """    const report = registry.validate(body.manifest);\n    enforceSecurityAdmission(report);\n    const action = mutationActionRequest(\"update\", params.id, body, {\n"""
if old_update in text:
    text = text.replace(old_update, new_update, 1)
elif new_update not in text:
    raise SystemExit("update admission anchor not found")

path.write_text(text)
