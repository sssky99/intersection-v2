import { describe, expect, it } from "vitest";
import { syncMeetingEventSnapshotStageTitle } from "./meetingEventSnapshot";

describe("syncMeetingEventSnapshotStageTitle", () => {
  it("updates the matching course step while preserving its details", () => {
    const snapshot = {
      moodTags: ["대화"],
      courseSteps: [
        { order: 1, title: "저녁 식사", placeName: null },
        { order: 2, title: "한옥에서 즐기는 수제 맥주", placeName: "기와탭룸" },
      ],
    };

    expect(syncMeetingEventSnapshotStageTitle(snapshot, 2, "비어")).toEqual({
      moodTags: ["대화"],
      courseSteps: [
        { order: 1, title: "저녁 식사", placeName: null },
        { order: 2, title: "비어", placeName: "기와탭룸" },
      ],
    });
  });

  it("leaves the snapshot unchanged when the stage has no course step", () => {
    const snapshot = { courseSteps: [{ order: 1, title: "저녁 식사" }] };
    expect(syncMeetingEventSnapshotStageTitle(snapshot, 3, "피드백")).toBe(
      snapshot,
    );
  });
});
