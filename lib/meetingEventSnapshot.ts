export function syncMeetingEventSnapshotStageTitle(
  snapshot: Record<string, unknown> | null,
  sequence: number,
  title: string,
) {
  const currentSnapshot = snapshot ?? {};
  const courseSteps = Array.isArray(currentSnapshot.courseSteps)
    ? currentSnapshot.courseSteps
    : [];
  const targetIndex = sequence - 1;

  if (targetIndex < 0 || targetIndex >= courseSteps.length) {
    return currentSnapshot;
  }

  return {
    ...currentSnapshot,
    courseSteps: courseSteps.map((step, index) => {
      if (index !== targetIndex || !step || typeof step !== "object") {
        return step;
      }

      return { ...(step as Record<string, unknown>), title };
    }),
  };
}
