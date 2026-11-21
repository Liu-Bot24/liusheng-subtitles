import assert from "node:assert/strict";
import test from "node:test";

const { FuguangBrowserTranslationProvider: provider } = await import(
  new URL("../../extension/src/background/browser-translation-provider.js", import.meta.url)
);

function httpError(status, message, providerCode = "") {
  const error = new Error(message);
  error.status = status;
  error.providerCode = providerCode;
  return error;
}

test("account and configuration failures are permanent whatever the wording", () => {
  for (const error of [
    httpError(401, "账号存在违规行为，已被禁用"),
    httpError(401, "Incorrect API key provided"),
    httpError(402, "Insufficient balance"),
    httpError(404, "The model does not exist"),
    httpError(403, "Your account was flagged for policy violation and has been deactivated")
  ]) {
    assert.equal(provider.browserTranslationErrorIsPermanent(error), true, error.message);
    assert.equal(provider.browserTranslationErrorIsContentPolicy(error), false, error.message);
  }
});

test("moderation blocks are recognized by provider code or wording", () => {
  for (const error of [
    httpError(400, "Input data may contain inappropriate content.", "data_inspection_failed"),
    httpError(400, "The response was filtered", "content_filter"),
    httpError(400, "Content Exists Risk"),
    httpError(400, "内容安全审核未通过"),
    httpError(403, "Forbidden: content safety policy violation")
  ]) {
    assert.equal(provider.browserTranslationErrorIsContentPolicy(error), true, error.message);
    assert.equal(provider.browserTranslationErrorIsPermanent(error), false, error.message);
  }
});

test("schema and rate-limit errors are not moderation", () => {
  assert.equal(provider.browserTranslationErrorIsContentPolicy(httpError(400, "messages violate the required schema")), false);
  assert.equal(provider.browserTranslationErrorIsContentPolicy(httpError(429, "content policy rate limit")), false);
  assert.equal(provider.browserTranslationErrorIsRateLimited(httpError(429, "Too many requests")), true);
});
