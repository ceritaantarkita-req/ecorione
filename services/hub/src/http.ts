  options: BuildHubServerOptions,
): FastifyInstance {
  const app = createServer({ name: "hub", token: options.token, logger: options.logger });
  const repo = new HubRepository(db);
  const history = new HistoryLedger(db);
  const projects = new ProjectRegistry(db);
  const authority = new CapabilityRegistry(db);
  const extensions = new ExtensionRegistry(db, authority);
  const deps: OrchestrateDeps = {
    repo,
    history,
    projects,
    authority,
    contextUrl: options.contextUrl,
    connectUrl: options.connectUrl,
    rndUrl: options.rndUrl,
    internalToken: options.internalToken,
  };

  const voice = new RealtimeVoiceRuntime({
    store: new VoiceSessionStore(db),
    authority,
    repo,
    history,
    now: nowIso,
    infer: async (input, signal) => {
      try {
        return MultimodalAdapterResultSchema.parse(
          await httpJson(`${options.connectUrl}/v1/multimodal/infer`, {
            token: options.internalToken,
            body: input,
            ...(signal === undefined ? {} : { signal }),
          }),
        );
      } catch (err) {
        throw forwardOrUpstreamError("Connect", err);
      }
    },
    chat: async (input, execution) =>
      chat(deps, input, nowIso(), {
        target: execution.target,
        syncClass: execution.syncClass,
        signal: execution.signal,
        sourceApp: "ai:voice",
      }),
  });
  registerVoiceRoutes(app, voice);

  app.post("/v1/chat", async (req) => {
    const body = parseOrBadRequest(ChatRequestSchema, req.body);
    try {
      return await chat(deps, body, nowIso());
    } catch (err) {
      throw toHttpError(err);
    }
  });

  app.post("/v1/memory/forget", async (req) => {
    const body = parseOrBadRequest(ForgetFactRequestSchema, req.body);
    const now = nowIso();
    const resolvedProject = projects.resolve({
      workspaceId: body.workspaceId,
      projectId: body.projectId,
    });
    const operationId = makeId("operation");
    const actionBase = {
      module: "Hub" as const,
      tool: "memory.forget",
      args: {
        factId: body.factId,
        reason: body.reason,
        workspaceId: resolvedProject.workspaceId,
        projectId: resolvedProject.project.id,
      },
    };
    const idempotencyKey = makeIdempotencyKey(actionBase);
    const actionRequest: ActionRequest = {
      operationId,
      ...actionBase,
      actionClass: "REVERSIBLE_WRITE",
      scope: "personal",
      sensitivity: "INTERNAL",
      autonomy: "L1",
      idempotencyKey,
    };
    repo.recordAuditEvent({
      type: "ACTION_REQUESTED",
      operationId,
      module: "Hub",
      detail: { tool: actionRequest.tool, idempotencyKey },
      now,
    });
    const { verdict, rule } = evaluatePolicy(actionRequest);
    repo.recordAuditEvent({
      type: "POLICY_EVALUATED",
      operationId,
      module: "Hub",
      detail: { outcome: verdict.outcome },
      ruleId: rule.id,
      now,
    });
    if (verdict.outcome !== "ALLOW")
      throw new BadGatewayError(
        `memory.forget tidak diizinkan policy engine: ${verdict.reason}`,
      );

    const prior = repo.getIdempotentResult<MemoryFact>(idempotencyKey);
    if (prior !== null) {
      repo.recordAuditEvent({
        type: "ACTION_SKIPPED_IDEMPOTENT",
        operationId,
        module: "Hub",
        detail: { idempotencyKey, priorOperationId: prior.operationId },
        now,
      });
      return prior.result;
    }
    let fact: MemoryFact;
    try {
      fact = await httpJson<MemoryFact>(
        `${options.contextUrl}/v1/facts/${body.factId}/forget`,
        {
          method: "POST",
          token: options.internalToken,
          body: { now, projectId: resolvedProject.project.id },
        },
      );
    } catch (err) {
      throw forwardOrUpstreamError("Context", err);