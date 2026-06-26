export function requestClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();
  return (
    forwardedIp ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export function requestActorKey(request: Request) {
  const userAgent = request.headers.get("user-agent")?.trim().slice(0, 180);
  return `${requestClientIp(request)}:${userAgent || "unknown"}`;
}

export function isSameOriginRequest(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");

  if (origin) {
    try {
      return new URL(origin).origin === requestOrigin;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (!referer) return false;

  try {
    return new URL(referer).origin === requestOrigin;
  } catch {
    return false;
  }
}
