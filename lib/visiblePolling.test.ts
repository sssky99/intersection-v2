import { afterEach, describe, expect, it, vi } from "vitest";
import { startVisiblePolling } from "./visiblePolling";

class Visibility extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  change(value: DocumentVisibilityState) {
    this.visibilityState = value;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}
afterEach(() => vi.useRealTimers());
describe("visible polling", () => {
  it("stops hidden-page requests and refreshes immediately on return", async () => {
    vi.useFakeTimers();
    const page = new Visibility(); const task = vi.fn(async () => {});
    const stop = startVisiblePolling(task, 30_000, page);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(task).toHaveBeenCalledTimes(2);
    page.change("hidden");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(task).toHaveBeenCalledTimes(2);
    page.change("visible");
    expect(task).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(task).toHaveBeenCalledTimes(3);
  });
  it("does not overlap slow work or restart after unmount", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const task = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const page = new Visibility();
    const stop = startVisiblePolling(task, 30_000, page);
    page.change("hidden"); page.change("visible");
    await vi.advanceTimersByTimeAsync(90_000);
    expect(task).toHaveBeenCalledTimes(1);
    stop(); finish();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
