// ISO codes keep spelling variations out of the stored country answers.
export const countryCodes = ("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" ");
export type CountryExperience = ({ countryCode: string; countryName?: never } | { countryName: string; countryCode?: never }) & {
  experience: "travel" | "lived" | "both";
};

export function parseCountryExperiences(value: unknown): CountryExperience[] | null {
  if (typeof value !== "string" || value.length > 3000) return null;
  try {
    const entries: unknown = JSON.parse(value);
    if (!Array.isArray(entries) || entries.length > 20) return null;
    const seen = new Set<string>();
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") return null;
      const name = typeof entry.countryName === "string" ? entry.countryName : null;
      const validName = name !== null && name === name.trim() && name.length > 0 && name.length <= 50 && !/[\p{Cc}\p{Cf}]/u.test(name);
      const validCode = countryCodes.includes(entry.countryCode);
      const key = validName ? `name:${name.normalize("NFKC").toLocaleLowerCase()}` : `code:${entry.countryCode}`;
      if ((validName ? entry.countryCode !== undefined : !validCode || entry.countryName !== undefined) ||
        !["travel", "lived", "both"].includes(entry.experience) ||
        seen.has(key)) return null;
      seen.add(key);
    }
    return entries as CountryExperience[];
  } catch {
    return null;
  }
}

export function countryExperienceName(entry: CountryExperience): string {
  return entry.countryName ?? new Intl.DisplayNames(["ko"], { type: "region" }).of(entry.countryCode!) ?? entry.countryCode!;
}

// Convert answers from the previous country picker when reopening a draft.
export function countryAnswerText(value: string): string {
  const entries = parseCountryExperiences(value);
  if (!entries) return value;
  return entries.length ? entries.map(countryExperienceName).join(", ") : "아직 해외 거주·여행 경험은 없어요.";
}

export function countryExperiencesLabel(value: unknown): string | null {
  const entries = parseCountryExperiences(value);
  if (!entries) return null;
  if (!entries.length) return "해외 거주·여행 경험이 없어요.";
  return entries.map((entry) => `${countryExperienceName(entry)} · ${{ travel: "여행", lived: "거주", both: "여행·거주" }[entry.experience]}`).join(" / ");
}
