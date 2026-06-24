import type { MeetingPlace } from "@/types/place";

export const SEOUL_REGION_GROUPS = [
  { id: "gangnam", label: "강남", districts: ["강남구", "서초구"] },
  {
    id: "songpa_jamsil",
    label: "송파·잠실",
    districts: ["송파구", "강동구"],
  },
  {
    id: "seongsu_geondae",
    label: "성수·건대",
    districts: ["성동구", "광진구"],
  },
  {
    id: "euljiro_jongno",
    label: "을지로·종로",
    districts: ["중구", "종로구"],
  },
  {
    id: "hongdae_yeonnam",
    label: "홍대·연남",
    districts: ["마포구", "서대문구"],
  },
  { id: "yongsan_itaewon", label: "용산·이태원", districts: ["용산구"] },
  {
    id: "yeouido_yeongdeungpo",
    label: "여의도·영등포",
    districts: ["영등포구"],
  },
  {
    id: "gangbuk_nowon",
    label: "강북·노원",
    districts: ["성북구", "강북구", "도봉구", "노원구"],
  },
  {
    id: "gangseo_gwanak",
    label: "강서·관악",
    districts: ["양천구", "강서구", "구로구", "금천구", "관악구", "동작구"],
  },
  { id: "dongbuk", label: "동북권", districts: ["동대문구", "중랑구"] },
] as const;

type SeoulDistrict = (typeof SEOUL_REGION_GROUPS)[number]["districts"][number];

const districtCenters: Record<SeoulDistrict, [latitude: number, longitude: number]> = {
  강남구: [37.5172, 127.0473],
  서초구: [37.4837, 127.0324],
  송파구: [37.5145, 127.1059],
  강동구: [37.5301, 127.1238],
  성동구: [37.5633, 127.0371],
  광진구: [37.5385, 127.0823],
  중구: [37.5641, 126.9979],
  종로구: [37.5735, 126.979],
  마포구: [37.5663, 126.9019],
  서대문구: [37.5791, 126.9368],
  용산구: [37.5326, 126.9905],
  영등포구: [37.5264, 126.8962],
  성북구: [37.5894, 127.0167],
  강북구: [37.6396, 127.0257],
  도봉구: [37.6688, 127.0471],
  노원구: [37.6542, 127.0568],
  양천구: [37.517, 126.8665],
  강서구: [37.5509, 126.8495],
  구로구: [37.4955, 126.8874],
  금천구: [37.4569, 126.8955],
  관악구: [37.4784, 126.9516],
  동작구: [37.5124, 126.9393],
  동대문구: [37.5744, 127.0396],
  중랑구: [37.6063, 127.0927],
};

function districtFromAddress(address: string | null | undefined) {
  const district = address?.match(/(?:^|\s)([가-힣]+구)(?:\s|$)/)?.[1];
  return district && district in districtCenters
    ? (district as SeoulDistrict)
    : null;
}

function coordinatesFromPlace(place: MeetingPlace) {
  const longitude = place.mapx / 10_000_000;
  const latitude = place.mapy / 10_000_000;
  if (
    longitude < 126.7 ||
    longitude > 127.25 ||
    latitude < 37.4 ||
    latitude > 37.75
  ) {
    return null;
  }

  return { latitude, longitude };
}

function nearestDistrict(place: MeetingPlace) {
  const coordinates = coordinatesFromPlace(place);
  if (!coordinates) return null;

  let nearest: SeoulDistrict | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const [district, [latitude, longitude]] of Object.entries(
    districtCenters,
  ) as Array<[SeoulDistrict, [number, number]]>) {
    const latitudeDistance = coordinates.latitude - latitude;
    const longitudeDistance =
      (coordinates.longitude - longitude) *
      Math.cos((coordinates.latitude * Math.PI) / 180);
    const distance =
      latitudeDistance * latitudeDistance +
      longitudeDistance * longitudeDistance;

    if (distance < nearestDistance) {
      nearest = district;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function groupLabelFromDistrict(district: SeoulDistrict | null) {
  if (!district) return null;
  return (
    SEOUL_REGION_GROUPS.find((group) =>
      (group.districts as readonly string[]).includes(district),
    )?.label ?? null
  );
}

function fallbackAdministrativeArea(address: string | null | undefined) {
  if (!address) return null;
  const parts = address.trim().split(/\s+/);
  return (
    parts.find((part) => /(?:구|군)$/.test(part)) ??
    parts.find((part) => /(?:시|도)$/.test(part)) ??
    null
  );
}

export function meetingRegionFromPlace(place: MeetingPlace | null | undefined) {
  if (!place) return null;

  const address = place.roadAddress ?? place.jibunAddress;
  const district =
    districtFromAddress(place.roadAddress) ??
    districtFromAddress(place.jibunAddress) ??
    nearestDistrict(place);

  return (
    groupLabelFromDistrict(district) ??
    fallbackAdministrativeArea(address) ??
    "기타 지역"
  );
}
