import { expect, it } from "vitest";
import { sessionIsMissing } from "./sessionRecovery";
it("does not treat a timeout or server outage as logout", () => {
  expect(sessionIsMissing({ name: "AuthRetryableFetchError" })).toBe(false);
  expect(sessionIsMissing({ name: "AbortError" })).toBe(false);
  expect(sessionIsMissing({ code: "unexpected_failure" })).toBe(false);
});
it("allows login when there is no session or the server has invalidated it", () => {
  expect(sessionIsMissing(null)).toBe(true);
  expect(sessionIsMissing({ name: "AuthSessionMissingError" })).toBe(true);
  expect(sessionIsMissing({ code: "refresh_token_not_found" })).toBe(true);
});
