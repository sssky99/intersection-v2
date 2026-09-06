"use client";
import type { BlindDateUserOffer } from "@/types/blindDate";
import type { UserTicket, UserTicketsResponse } from "@/types/ticket";

export const userTicketsCacheTtlMs = 20_000;

export const userTicketsCache = new Map<
  string,
  { response: UserTicketsResponse; expiresAt: number }
>();

export const userTicketsRequests = new Map<
  string,
  Promise<UserTicketsResponse | null>
>();

export type FetchUserTicketsOptions = {
  force?: boolean;
  limit?: number;
  offset?: number;
  scope?: string;
};

export function userTicketsRequestKey({
  limit,
  offset = 0,
  scope = "anonymous",
}: FetchUserTicketsOptions) {
  return `${scope}:${offset}:${limit ?? "all"}`;
}

export function userTicketsRequestPath({
  limit,
  offset = 0,
}: FetchUserTicketsOptions) {
  const params = new URLSearchParams();
  if (typeof limit === "number") params.set("limit", String(limit));
  if (offset > 0) params.set("offset", String(offset));
  const query = params.toString();
  return query
    ? `/api/meetings/my-tickets?${query}`
    : "/api/meetings/my-tickets";
}

export function mergeUserTickets(
  current: UserTicket[],
  incoming: UserTicket[],
) {
  const merged = new Map(current.map((ticket) => [ticket.id, ticket]));
  for (const ticket of incoming) {
    merged.set(ticket.id, ticket);
  }
  return Array.from(merged.values());
}

export async function fetchUserTickets(options: FetchUserTicketsOptions = {}) {
  const { force = false } = options;
  const key = userTicketsRequestKey(options);
  const cached = userTicketsCache.get(key);

  if (!force && cached && cached.expiresAt > Date.now()) {
    return cached.response;
  }

  const existingRequest = userTicketsRequests.get(key);
  if (existingRequest) return existingRequest;

  const request = fetch(userTicketsRequestPath(options), { cache: "no-store" })
    .then(async (response) => {
      const data = (await response
        .json()
        .catch(() => null)) as Partial<UserTicketsResponse> | null;

      if (!response.ok || !data || !Array.isArray(data.tickets)) return null;

      const responseData: UserTicketsResponse = {
        tickets: data?.tickets ?? [],
        participationCount:
          typeof data?.participationCount === "number"
            ? data.participationCount
            : 0,
        totalCount:
          typeof data?.totalCount === "number" ? data.totalCount : undefined,
        hasMore: data?.hasMore === true,
        nextOffset:
          typeof data?.nextOffset === "number" ? data.nextOffset : null,
      };
      userTicketsCache.set(key, {
        response: responseData,
        expiresAt: Date.now() + userTicketsCacheTtlMs,
      });

      return responseData;
    })
    .catch(() => null)
    .finally(() => {
      userTicketsRequests.delete(key);
    });

  userTicketsRequests.set(key, request);
  return request;
}

export async function fetchBlindDateOffers() {
  const response = await fetch("/api/meetings/blind-dates").catch(() => null);
  if (!response) return null;

  const data = (await response.json().catch(() => null)) as {
    offers?: BlindDateUserOffer[];
  } | null;

  return response.ok ? (data?.offers ?? []) : null;
}
