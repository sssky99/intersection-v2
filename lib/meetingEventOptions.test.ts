import { describe, expect, it } from "vitest";
import { readMeetingEventOptions, validateMeetingEventOptions } from "./meetingEventOptions";
import { newEventSnapshot } from "./eventContent";

describe("meeting event options", () => {
  it("defaults existing and new events to group activity without a surcharge", () => {
    expect(readMeetingEventOptions(null)).toEqual({ groupActivity: true, extraFee: { enabled: false, description: "", amount: 0 } });
    expect(newEventSnapshot(null)).toMatchObject({ groupActivity: true, extraFee: { enabled: false } });
  });
  it("preserves explicit small-group and surcharge settings when duplicating", () => {
    const settings = { groupActivity: false, extraFee: { enabled: true, description: "베이킹 클래스", amount: 50000 } };
    expect(newEventSnapshot(settings)).toMatchObject(settings);
    expect(validateMeetingEventOptions(settings)).toBeNull();
  });
  it.each([0, -1, 0.5, NaN, Infinity, 100000001, "50000"])("rejects invalid enabled fee %s", (amount) => {
    expect(validateMeetingEventOptions({ groupActivity: true, extraFee: { enabled: true, description: "베이킹", amount } })).not.toBeNull();
  });
  it("requires a description only when enabled", () => {
    expect(validateMeetingEventOptions({ groupActivity: true, extraFee: { enabled: true, description: "  ", amount: 50000 } })).not.toBeNull();
    expect(validateMeetingEventOptions({ groupActivity: true, extraFee: { enabled: false, description: "", amount: 0 } })).toBeNull();
  });
});
