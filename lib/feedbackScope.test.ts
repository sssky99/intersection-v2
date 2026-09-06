import { describe, expect, it } from "vitest";
import { feedbackInstanceIdsForViewer, feedbackVenueGroup } from "./feedbackScope";

const groups = [1,2,3,4,5,6,7].map((n) => ({
  feedback_scope_key: n <= 3 || n === 7 ? "123" : "456", event_id: "event", code: String(n), title: `${n}그룹`, legacy_ticket_instance_id: `ticket-${n}`,
}));
describe("shared feedback eligibility", () => {
  it("uses the stored venue split regardless of display names", () => {
    expect(feedbackInstanceIdsForViewer(groups, "ticket-1")).toEqual(["ticket-1","ticket-2","ticket-3","ticket-7"]);
    const renamed = groups.map((group) => ({ ...group, code: "RED", title: "renamed" }));
    expect(feedbackInstanceIdsForViewer(renamed, "ticket-1")).toEqual(["ticket-1","ticket-2","ticket-3","ticket-7"]);
    expect(feedbackInstanceIdsForViewer(groups, "ticket-4")).toEqual(["ticket-4","ticket-5","ticket-6"]);
  });
  it("does not invent group numbers for named groups or leak another event", () => {
    const named = ["RED","BLUE","YELLOW"].map((code) => ({ feedback_scope_key: null, event_id: "today", code, title: code, legacy_ticket_instance_id: code }));
    expect(feedbackVenueGroup(named[0])).toBeNull();
    expect(feedbackInstanceIdsForViewer([...groups,...named], "RED")).toEqual(["RED","BLUE","YELLOW"]);
    expect(feedbackInstanceIdsForViewer([...named].reverse(), "RED").sort()).toEqual(["BLUE","RED","YELLOW"]);
  });
  it("restricts standalone tickets to their own participants", () => {
    expect(feedbackInstanceIdsForViewer(groups, "standalone")).toEqual(["standalone"]);
  });
});
