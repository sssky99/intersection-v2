export function sessionIsMissing(error: { name?: string; code?: string } | null) {
  return !error || error.name === "AuthSessionMissingError" || [
    "refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired",
  ].includes(error.code ?? "");
}
