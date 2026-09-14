#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const materializerPath = new URL("./w13-materialize-v2.mjs", import.meta.url);
let materializer = readFileSync(materializerPath, "utf8");
const oldCount = '    2,\n    "http canary responses identity",';
const newCount = '    1,\n    "http canary responses identity",';
if (!materializer.includes(oldCount)) {
  throw new Error("W13 v2 HTTP response count marker not found");
}
materializer = materializer.replace(oldCount, newCount);
writeFileSync(materializerPath, materializer);

await import(`${materializerPath.href}?candidate=${Date.now().toString()}`);

const httpPath = new URL("../services/connect/src/http.ts", import.meta.url);
let http = readFileSync(httpPath, "utf8");
const oldCredentialResponse =
  "          responseModel: result.responseModel,\n          cacheHit: result.cacheHit,";
const newCredentialResponse =
  "          responseModel: result.responseModel,\n          modelIdentity: result.modelIdentity,\n          modelIdentityPinned: result.modelIdentityPinned,\n          cacheHit: result.cacheHit,";
const count = http.split(oldCredentialResponse).length - 1;
if (count !== 1) {
  throw new Error(`credential test response identity: expected 1, found ${count.toString()}`);
}
http = http.replace(oldCredentialResponse, newCredentialResponse);
writeFileSync(httpPath, http);

console.log("W13 candidate response shapes materialized");
