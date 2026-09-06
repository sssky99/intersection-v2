/** Poll only while the page is visible, and never overlap this poller's work. */
export function startVisiblePolling(
  task: () => Promise<unknown>,
  intervalMs: number,
  visibility: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener"> = document,
) {
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { clearTimeout(timer); timer = undefined; };
  const run = async () => {
    clear();
    if (stopped || running || visibility.visibilityState !== "visible") return;
    running = true;
    try { await task(); }
    catch (error) { console.error("Background refresh failed", error); }
    finally {
      running = false;
      if (!stopped && visibility.visibilityState === "visible") timer = setTimeout(run, intervalMs);
    }
  };
  const onVisibility = () => {
    clear();
    if (visibility.visibilityState === "visible") void run();
  };
  visibility.addEventListener("visibilitychange", onVisibility);
  void run();
  return () => {
    stopped = true;
    clear();
    visibility.removeEventListener("visibilitychange", onVisibility);
  };
}
