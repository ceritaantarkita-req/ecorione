export function percentile(values, fraction) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new Error("fraction harus berada pada rentang 0..1");
  }
  const sorted = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  );
  return sorted[index] ?? 0;
}

export function summarizeNumbers(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (finite.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0 };
  }
  const sum = finite.reduce((total, value) => total + value, 0);
  return {
    count: finite.length,
    min: Math.min(...finite),
    max: Math.max(...finite),
    mean: sum / finite.length,
    p50: percentile(finite, 0.5),
    p95: percentile(finite, 0.95),
  };
}

function labelsMatch(actual, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (actual?.[key] !== value) return false;
  }
  return true;
}

export function counterTotal(snapshot, name, labels = {}) {
  return (snapshot?.counters ?? [])
    .filter((counter) => counter?.name === name && labelsMatch(counter.labels, labels))
    .reduce((total, counter) => total + Number(counter.value ?? 0), 0);
}

export function counterDelta(before, after, name, labels = {}) {
  return counterTotal(after, name, labels) - counterTotal(before, name, labels);
}

export function spansForRun(snapshots, requestPrefix) {
  const spans = [];
  for (const [service, snapshot] of Object.entries(snapshots)) {
    for (const span of snapshot?.recentRequests ?? []) {
      if (typeof span?.requestId !== "string" || !span.requestId.startsWith(requestPrefix))
        continue;
      spans.push({ ...span, service: span.service ?? service });
    }
  }
  return spans.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
}

export function summarizeProcessResources(beforeSnapshots, afterSnapshots) {
  const services = {};
  for (const service of Object.keys(afterSnapshots).sort()) {
    const before = beforeSnapshots[service]?.process;
    const after = afterSnapshots[service]?.process;
    if (before === undefined || after === undefined) continue;
    services[service] = {
      pid: after.pid,
      uptimeSeconds: after.uptimeSeconds,
      rssBytes: {
        before: before.rssBytes,
        after: after.rssBytes,
        delta: after.rssBytes - before.rssBytes,
      },
      heapUsedBytes: {
        before: before.heapUsedBytes,
        after: after.heapUsedBytes,
        delta: after.heapUsedBytes - before.heapUsedBytes,
      },
      cpuUserMicrosDelta: after.cpuUserMicros - before.cpuUserMicros,
      cpuSystemMicrosDelta: after.cpuSystemMicros - before.cpuSystemMicros,
    };
  }
  return services;
}

export function assertObservabilityReport(report) {
  if (report?.phase !== "measured") throw new Error("report phase bukan measured");
  if (typeof report?.revision !== "string" || report.revision.length < 7) {
    throw new Error("revision observability tidak valid");
  }
  const config = report?.sampleConfig;
  for (const key of ["ownerReads", "ecx", "model"]) {
    if (!Number.isInteger(config?.[key]) || config[key] < 3) {
      throw new Error(`sampleConfig.${key} harus integer >= 3`);
    }
  }

  for (const lane of ["hub", "context", "artifact", "flow"]) {
    const samples = report?.workloads?.ownerReads?.[lane] ?? [];
    if (samples.length !== config.ownerReads) {
      throw new Error(`owner-read ${lane} sample count tidak sesuai`);
    }
    if (samples.some((sample) => sample.ok !== true)) {
      throw new Error(`owner-read ${lane} memiliki sample gagal`);
    }
  }

  const ecx = report?.workloads?.ecx ?? [];
  if (ecx.length !== config.ecx || ecx.some((sample) => sample.ok !== true)) {
    throw new Error("ECX sample count/status tidak sesuai");
  }

  const model = report?.workloads?.model ?? [];
  if (model.length !== config.model) throw new Error("model sample count tidak sesuai");
  for (const sample of model) {
    if (sample.ok !== true || sample.pass !== true || sample.target !== "local") {
      throw new Error("model sample local tidak PASS");
    }
    if (sample.cacheHit !== false) {
      throw new Error("model baseline harus memakai unique uncached prompts");
    }
    if (typeof sample.provider !== "string" || typeof sample.model !== "string") {
      throw new Error("model/provider identity tidak tersedia");
    }
  }

  if (report?.summary?.workloadErrors !== 0) {
    throw new Error("observability workload memiliki HTTP/semantic error");
  }
  if (report?.summary?.traceCoverage?.ecxHydrationsWithArtifactSpan !== config.ecx) {
    throw new Error("distributed trace coverage ECX tidak lengkap");
  }

  const resources = report?.summary?.processResources ?? {};
  for (const service of report?.requiredServices ?? []) {
    const item = resources[service];
    if (item === undefined) throw new Error(`resource snapshot tidak ada: ${service}`);
    const numeric = [
      item.pid,
      item.uptimeSeconds,
      item.rssBytes?.before,
      item.rssBytes?.after,
      item.heapUsedBytes?.before,
      item.heapUsedBytes?.after,
      item.cpuUserMicrosDelta,
      item.cpuSystemMicrosDelta,
    ];
    if (numeric.some((value) => !Number.isFinite(value))) {
      throw new Error(`resource snapshot tidak valid: ${service}`);
    }
  }
  return report;
}
