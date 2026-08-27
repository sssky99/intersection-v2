import { describe, expect, it } from "vitest";
import {
  isDirectClientTicketInteractionStatus,
  isGuestImportTicketInteractionStatus,
  ticketInteractionBadgeLabel,
  ticketInteractionCanRespond,
  ticketInteractionShowsDeadline,
} from "./ticketInteractions";

describe("ticket interaction presentation", () => {
  it("only labels a confirmed payment as a completed application", () => {
    expect(ticketInteractionBadgeLabel("open")).toBeNull();
    expect(ticketInteractionBadgeLabel("no")).toBe("거절");
    expect(ticketInteractionBadgeLabel("yes")).toBeNull();
    expect(ticketInteractionBadgeLabel("payment_pending")).toBeNull();
    expect(ticketInteractionBadgeLabel("payment_confirmed")).toBe("신청 완료");
  });

  it("keeps the response choices available until payment starts", () => {
    expect(
      ticketInteractionCanRespond({
        status: "open",
        paymentStartedAt: null,
        paymentConfirmedAt: null,
      }),
    ).toBe(true);
    expect(
      ticketInteractionCanRespond({
        status: "yes",
        paymentStartedAt: null,
        paymentConfirmedAt: null,
      }),
    ).toBe(true);
    expect(
      ticketInteractionCanRespond({
        status: "payment_pending",
        paymentStartedAt: "2026-08-23T00:00:00.000Z",
        paymentConfirmedAt: null,
      }),
    ).toBe(false);
  });

  it("shows the deadline until payment is confirmed", () => {
    expect(ticketInteractionShowsDeadline("open")).toBe(true);
    expect(ticketInteractionShowsDeadline("yes")).toBe(true);
    expect(ticketInteractionShowsDeadline("payment_pending")).toBe(true);
    expect(ticketInteractionShowsDeadline("payment_confirmed")).toBe(false);
    expect(ticketInteractionShowsDeadline("no")).toBe(false);
  });
});

describe("ticket interaction client status permissions", () => {
  it("never accepts payment confirmation from a client", () => {
    expect(isDirectClientTicketInteractionStatus("payment_pending")).toBe(true);
    expect(isDirectClientTicketInteractionStatus("payment_confirmed")).toBe(false);
  });

  it("only imports answer states from guest storage", () => {
    expect(isGuestImportTicketInteractionStatus("yes")).toBe(true);
    expect(isGuestImportTicketInteractionStatus("payment_pending")).toBe(false);
    expect(isGuestImportTicketInteractionStatus("payment_confirmed")).toBe(false);
  });
});
