# Off-host DR runtime closure — 2026-09-23

Status: **CLOSED / PASS — TOTAL SUMOPOD HOST-LOSS RECOVERY PROVEN AT THE DOCUMENTED BOUNDARY**

## Closure scope

This evidence closes the real clean-replacement-host recovery drill for exact source:

```text
source_sha=b27c1e5833be0a0fccf3f525d82ae8853cd22113
source_tag=staging-b27c1e5833be
compose_project=ecorione-staging
```

The source SumoPod staging host was treated as unavailable after the immutable loss marker. No post-marker source-host access was used to retrieve the selected backup generation or to complete recovery.

## Selected generation and marker

Selected generation:

```text
ecorione-dr-20260922152938-b27c1e5833be
```

Immutable loss marker:

```text
declared_at=2026-09-22T16:21:58.074Z
expected_manifest=ecorione-dr-20260922152938-b27c1e5833be.receipt.env
drill_id=e87b8b28-61ba-46ce-8959-3091ffae7afd
```

Three complete encrypted generations were retained and the corrected remote audit reported:

```text
complete_generations=3
incomplete_generations=0
retention_ready=1
```

## Recovery chain — PASS

The real recovery chain passed all required runtime gates:

1. independent marker-bound retrieval from the retained SSH target;
2. encrypted bundle/hash/canary verification;
3. isolated clean-host restore/fingerprint verification for all 12 archived volumes;
4. clean replacement-host preflight with no existing project containers/volumes and loopback-only recovery edge;
5. guarded restore into the exact 12 Compose-owned project volumes;
6. exact-source application image build and 15-service startup;
7. semantic Historical Ledger + Context + Artifact canary verification;
8. loopback home, protected `/ops`/`/settings`, MCP protected-resource metadata and unauthenticated challenge checks;
9. authenticated Operations health and sanitized exact-host evidence;
10. reboot baseline capture;
11. full WSL2 utility-VM shutdown/relaunch with changed Linux boot ID;
12. automatic post-reboot topology recovery with preserved project volumes and Connect durable-file fingerprints;
13. repeated post-reboot semantic canary, loopback/MCP, authenticated Operations and host evidence;
14. final marker-bound closure receipt.

## Runtime defects found and closed

The drill exposed three operational issues rather than masking them:

- retained-generation audit SSH consumed the manifest loop stdin; PR #267 fixed the audit with `ssh -n`;
- modern OpenSSH SCP/SFTP treated shell quote characters in the remote filename literally; PR #268 fixed remote-path handling and made artifact fetch fail fast;
- clean-host Docker Compose startup raced multiple exporters against the same application image tag when Bake/buildx was unavailable; PR #273 changed recovered startup to build the shared application image once and then run `up -d --no-build`.

The active application recovery checkout remained pinned to exact source `b27c1e5833be0a0fccf3f525d82ae8853cd22113`; newer recovery-tooling fixes did not relabel a newer application revision as recovered source.

## Reboot persistence evidence — PASS

Baseline Linux boot ID:

```text
54ff4a46-1cf9-4152-a61f-0ee581a78859
```

Post-reboot Linux boot ID:

```text
b7504194-fbe6-4741-8752-506ab7aaccd7
```

Final post-reboot receipt reported:

```text
phase=post-verified
serviceCount=15
projectVolumeCount=12
connectFingerprintsPreserved=true
projectVolumesPreserved=true
semanticCanaryVerifiedAfterReboot=true
rebootPersistenceAccepted=true
totalHostLossRecoveryCandidate=true
```

## Final closure timing evidence — PASS

The root-owned mode-0600 final receipt is:

```text
/var/lib/ecorione-dr/recovery-closure-evidence.json
```

Final measured values:

```text
conservativeRpoSeconds=3147
retrievalReadyRtoSeconds=3138
dataReadyRtoSeconds=5582
applicationReadyRtoSeconds=30042
finalRecoveryRtoSeconds=71523
```

The receipt also records:

```text
failureDomainAcknowledged=true
independentRetrievalVerified=true
restoredVolumeCount=12
serviceCount=15
semanticCanaryAccepted=true
semanticCanaryVerifiedAfterReboot=true
changedBootIdProven=true
totalHostLossRecoveryCandidate=true
```

These are measurements from one controlled drill, not production SLA commitments.

## Claim boundary

This drill proves that the tested ECORIONE staging generation can recover from **total loss of the SumoPod staging host** using the retained encrypted off-host generation plus separately protected recovery credentials/configuration.

It does **not** prove independent physical-machine or physical-disk survival between backup storage and replacement compute because the backup-target WSL distro and replacement-host WSL distro were hosted on the same Windows machine.

The out-of-band Windows recovery-secret copy used in this drill was created immediately before loss declaration. The drill therefore proves that the recovery path can consume that separately stored copy after source loss; it does not prove long-duration historical secret-backup independence.

Public DNS/TLS, Cloudflare or production promotion, provider/account-wide disaster recovery, and production RPO/RTO SLA commitments remain separate scopes.

## Final verdict

**CLOSED / PASS** for total SumoPod staging-host-loss recovery at the documented boundary.

No Off-host DR execution tail remains open after this closure.
