import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createClient } from "@/lib/supabase/server";
import type { NaverPlace } from "@/types/place";

export const dynamic = "force-dynamic";

type NaverLocalSearchItem = {
  title?: string;
  link?: string;
  category?: string;
  address?: string;
  roadAddress?: string;
  mapx?: string | number;
  mapy?: string | number;
};

type NaverLocalSearchResponse = {
  items?: NaverLocalSearchItem[];
};

const maxQueryLength = 40;

async function canSearchPlaces(request: NextRequest) {
  if (
    isAdminSessionTokenValid(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)
  ) {
    return true;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

function cleanNaverText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function coordinate(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN;
  return Number.isFinite(number) ? number : null;
}

function normalizePlace(item: NaverLocalSearchItem): NaverPlace | null {
  const name = cleanNaverText(item.title);
  const mapx = coordinate(item.mapx);
  const mapy = coordinate(item.mapy);
  if (!name || mapx === null || mapy === null) return null;

  return {
    source: "naver",
    name,
    category: cleanNaverText(item.category) || null,
    roadAddress: cleanNaverText(item.roadAddress) || null,
    jibunAddress: cleanNaverText(item.address) || null,
    mapx,
    mapy,
    link: cleanNaverText(item.link) || null,
  };
}

function searchQuery(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export async function GET(request: NextRequest) {
  if (!(await canSearchPlaces(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchQuery(searchParams.get("query"));
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

  if (!query || query.length < 2) {
    return NextResponse.json({ places: [] });
  }

  if (query.length > maxQueryLength || !/[\p{L}\p{N}]/u.test(query)) {
    return NextResponse.json({ error: "Invalid search query." }, { status: 400 });
  }

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "네이버 검색 API 설정이 필요합니다." },
      { status: 500 },
    );
  }

  const url = new URL("https://openapi.naver.com/v1/search/local.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", "5");
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "random");

  const response = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    return NextResponse.json(
      { error: "장소 검색 결과를 불러오지 못했어요." },
      { status: response?.status ?? 502 },
    );
  }

  const data = (await response.json().catch(() => null)) as
    | NaverLocalSearchResponse
    | null;
  const places = (data?.items ?? [])
    .map(normalizePlace)
    .filter((place): place is NaverPlace => Boolean(place));

  return NextResponse.json(
    { places },
    {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    },
  );
}
