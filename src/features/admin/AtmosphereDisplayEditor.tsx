import {
  meetingAtmosphereAgeBandById,
  meetingAtmosphereAgeBands,
  meetingAtmosphereAgePhraseFromBand,
  meetingAtmosphereGenderMoodLabels,
  meetingAtmosphereGenderPhraseFromMood,
  type MeetingAtmosphereAgeBandId,
  type MeetingAtmosphereGenderMood,
} from "@/lib/meetingAtmosphere";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const genderOptions: Array<{
  value: MeetingAtmosphereGenderMood;
  label: string;
}> = [
  { value: "male", label: meetingAtmosphereGenderMoodLabels.male },
  { value: "female", label: meetingAtmosphereGenderMoodLabels.female },
  { value: "balanced", label: meetingAtmosphereGenderMoodLabels.balanced },
];

function ageBandLabel(id: MeetingAtmosphereAgeBandId | null | undefined) {
  return id ? meetingAtmosphereAgeBandById(id)?.label ?? "기본값 없음" : "기본값 없음";
}

function genderLabel(mood: MeetingAtmosphereGenderMood | null | undefined) {
  return mood ? meetingAtmosphereGenderMoodLabels[mood] : "기본값 없음";
}

function defaultBody(value: string | null | undefined, fallback: string) {
  return value ? fallback : "현재 신청자 정보가 아직 충분하지 않아요.";
}

export function AtmosphereDisplayEditor({
  ageBandId,
  genderMood,
  defaultAgeBandId,
  defaultGenderMood,
  disabled = false,
  onAgeBandChange,
  onGenderMoodChange,
}: {
  ageBandId: string;
  genderMood: string;
  defaultAgeBandId?: MeetingAtmosphereAgeBandId | null;
  defaultGenderMood?: MeetingAtmosphereGenderMood | null;
  disabled?: boolean;
  onAgeBandChange: (value: string) => void;
  onGenderMoodChange: (value: string) => void;
}) {
  const effectiveAgeBand =
    meetingAtmosphereAgeBandById(ageBandId) ??
    meetingAtmosphereAgeBandById(defaultAgeBandId);
  const effectiveGenderMood =
    genderOptions.find((option) => option.value === genderMood)?.value ??
    defaultGenderMood ??
    null;

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h3 className="font-bold">자리 분위기 표시</h3>
      <p className="mt-1 text-xs font-semibold leading-5 text-black/42">
        실제 신청자 기준 기본값을 보여주고, 필요할 때 화면 표시용 설정값으로 덮어씁니다.
      </p>

      <div className="mt-4 rounded-2xl border border-black/8 bg-black/[0.025] p-4">
        <p className="text-xs font-black text-black/45">
          기본값 (실제 현재 참가 신청한 사람 대비)
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <DefaultValueCard
            label="성별"
            title={genderLabel(defaultGenderMood)}
            body={defaultBody(
              defaultGenderMood,
              meetingAtmosphereGenderPhraseFromMood(defaultGenderMood),
            )}
          />
          <DefaultValueCard
            label="나이대"
            title={ageBandLabel(defaultAgeBandId)}
            body={defaultBody(
              defaultAgeBandId,
              meetingAtmosphereAgePhraseFromBand(defaultAgeBandId),
            )}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SettingSelect
          label="성별 설정값"
          value={genderMood}
          disabled={disabled}
          effectiveLabel={genderLabel(effectiveGenderMood)}
          onChange={onGenderMoodChange}
          options={[
            {
              value: "",
              label: `기본값 사용 (${genderLabel(defaultGenderMood)})`,
            },
            ...genderOptions,
          ]}
        />
        <SettingSelect
          label="나이대 설정값"
          value={ageBandId}
          disabled={disabled}
          effectiveLabel={effectiveAgeBand?.label ?? "기본값 없음"}
          onChange={onAgeBandChange}
          options={[
            {
              value: "",
              label: `기본값 사용 (${ageBandLabel(defaultAgeBandId)})`,
            },
            ...meetingAtmosphereAgeBands.map((band) => ({
              value: band.id,
              label: band.label,
            })),
          ]}
        />
      </div>
    </section>
  );
}

function DefaultValueCard({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl bg-white px-3 py-3">
      <p className="text-[11px] font-black text-accent">{label}</p>
      <p className="mt-1 text-sm font-black text-black/76">{title}</p>
      <p className="mt-1 text-[11px] font-semibold leading-5 text-black/42">
        {body}
      </p>
    </div>
  );
}

function SettingSelect({
  label,
  value,
  options,
  disabled,
  effectiveLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  effectiveLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "mt-1.5 h-11 w-full rounded-xl border border-black/10 bg-[#fbfbfa] px-3 text-sm font-bold text-black/70 outline-none transition hover:border-black/20 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {options.map((option) => (
          <option key={option.value || "default"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[11px] font-semibold text-black/38">
        현재 표시: {effectiveLabel}
      </p>
    </label>
  );
}
