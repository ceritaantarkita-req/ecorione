# @ecorione/sdk

`packages/sdk` is the baseline typed client for self-host integrations. It does not bypass service ownership or authority.

```ts
import { EcorioneSdk } from "@ecorione/sdk";
const sdk = new EcorioneSdk({ token: process.env.ECORIONE_INTERNAL_TOKEN });
const health = await sdk.health("flow");
```

The SDK exposes health, Context retrieval, Connect completion, Flow graph run, and Artifact byte retrieval. Callers still supply valid domain request bodies and remain subject to Hub/Connect/Flow policy, scope, sensitivity, idempotency, and owner-service validation.

Do not embed the internal bearer token in browser bundles. Use the SDK from trusted server-side/local integration code.
