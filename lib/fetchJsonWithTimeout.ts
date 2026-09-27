// Keep the deadline active until the response body has finished, not just headers.
export async function fetchJsonWithTimeout<T>(
  input: string,
  init: RequestInit,
  timeoutMs = 15000,
): Promise<{ response: Response; body: T | null }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("요청 시간이 초과됐어요. 다시 시도해주세요."));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(input, { ...init, signal: controller.signal });
        const body = await response.json().catch(() => null) as T | null;
        return { response, body };
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
