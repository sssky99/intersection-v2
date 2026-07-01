import {
  meetingAtmosphereSummary,
  type MeetingAtmosphereGenderMood,
  type MeetingAtmosphereProfile,
} from "@/lib/meetingAtmosphere";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type MoodVisual = {
  primary: string;
  soft: string;
  softFill: string;
  stroke: string;
  shadow: string;
};

type GenderGaugeSegment = {
  mood: MeetingAtmosphereGenderMood;
  label: string;
  startAngle: number;
  endAngle: number;
};

const moodVisuals: Record<MeetingAtmosphereGenderMood, MoodVisual> = {
  male: {
    primary: "#4f8dd8",
    soft: "rgba(79, 141, 216, 0.13)",
    softFill: "rgba(79, 141, 216, 0.24)",
    stroke: "rgba(79, 141, 216, 0.7)",
    shadow: "rgba(79, 141, 216, 0.22)",
  },
  female: {
    primary: "#e783ad",
    soft: "rgba(231, 131, 173, 0.13)",
    softFill: "rgba(231, 131, 173, 0.24)",
    stroke: "rgba(231, 131, 173, 0.7)",
    shadow: "rgba(231, 131, 173, 0.22)",
  },
  balanced: {
    primary: "#99c765",
    soft: "rgba(153, 199, 101, 0.14)",
    softFill: "rgba(153, 199, 101, 0.24)",
    stroke: "rgba(153, 199, 101, 0.75)",
    shadow: "rgba(153, 199, 101, 0.22)",
  },
};

const genderGaugeSegments: GenderGaugeSegment[] = [
  { mood: "male", label: "남성 선호", startAngle: -90, endAngle: -18 },
  { mood: "balanced", label: "모두 선호", startAngle: -18, endAngle: 18 },
  { mood: "female", label: "여성 선호", startAngle: 18, endAngle: 90 },
];

const moodCopy: Record<MeetingAtmosphereGenderMood, string> = {
  female: "현재 여성분들이 더 많은 관심을 보이고 있어요",
  male: "남성 분들이 더 많은 관심을 보이고 있어요.",
  balanced: "남녀 모두 고르게 관심을 보이고 있어요.",
};

const gaugeCenterX = 120;
const gaugeCenterY = 118;
const gaugeOuterRadius = 104;
const gaugeInnerRadius = 66;
const gaugeGapDegrees = 2;

const needleAngles: Record<MeetingAtmosphereGenderMood, number> = {
  male: -44,
  balanced: 0,
  female: 44,
};

function polarPoint(radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: gaugeCenterX + radius * Math.sin(radians),
    y: gaugeCenterY - radius * Math.cos(radians),
  };
}

function arcSegmentPath(startAngle: number, endAngle: number) {
  const adjustedStart = startAngle + gaugeGapDegrees / 2;
  const adjustedEnd = endAngle - gaugeGapDegrees / 2;
  const outerStart = polarPoint(gaugeOuterRadius, adjustedStart);
  const outerEnd = polarPoint(gaugeOuterRadius, adjustedEnd);
  const innerEnd = polarPoint(gaugeInnerRadius, adjustedEnd);
  const innerStart = polarPoint(gaugeInnerRadius, adjustedStart);

  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${gaugeOuterRadius} ${gaugeOuterRadius} 0 0 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${gaugeInnerRadius} ${gaugeInnerRadius} 0 0 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function midpointAngle(segment: GenderGaugeSegment) {
  return (segment.startAngle + segment.endAngle) / 2;
}

export function MeetingAtmospherePanel({
  profile,
  className,
}: {
  profile?: MeetingAtmosphereProfile | null;
  className?: string;
}) {
  const summary = meetingAtmosphereSummary(profile);
  const visual = moodVisuals[summary.genderMood];
  const activeSegment =
    genderGaugeSegments.find((segment) => segment.mood === summary.genderMood) ??
    genderGaugeSegments[1];
  const needleAngle = needleAngles[activeSegment.mood];

  return (
    <div className={cn("rounded-[28px] border border-black/8 bg-white p-4", className)}>
      <div
        className="rounded-[24px] border border-black/6 px-3 py-4 shadow-[0_12px_28px_rgba(0,0,0,0.035)]"
        style={{
          background: `linear-gradient(145deg, #ffffff 0%, #ffffff 52%, ${visual.soft} 100%)`,
        }}
      >
        <div
          className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1 text-[10px] font-bold text-black/45"
          aria-label="성별 관심도 색상 안내"
        >
          {genderGaugeSegments.map((item) => (
            <span key={item.mood} className="inline-flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: moodVisuals[item.mood].primary }}
                aria-hidden
              />
              {item.label}
            </span>
          ))}
        </div>

        <div className="mx-auto mt-2 w-full max-w-[268px]">
          <svg
            viewBox="0 0 240 132"
            role="img"
            aria-label={`성별 관심도. ${moodCopy[summary.genderMood]}`}
            className="h-auto w-full overflow-visible"
          >
            <defs>
              <filter id="meeting-atmosphere-needle-shadow">
                <feDropShadow
                  dx="0"
                  dy="8"
                  stdDeviation="5"
                  floodColor={visual.shadow}
                />
              </filter>
            </defs>

            {genderGaugeSegments.map((segment) => {
              const segmentVisual = moodVisuals[segment.mood];
              const selected = segment.mood === summary.genderMood;

              return (
                <g key={segment.mood}>
                  <path
                    d={arcSegmentPath(segment.startAngle, segment.endAngle)}
                    fill={segmentVisual.softFill}
                    stroke={selected ? segmentVisual.stroke : "rgba(255,255,255,0.75)"}
                    strokeWidth={selected ? 2.5 : 1}
                  />
                </g>
              );
            })}

            <g
              transform={`rotate(${needleAngle} ${gaugeCenterX} ${gaugeCenterY})`}
              filter="url(#meeting-atmosphere-needle-shadow)"
            >
              <path
                d={`M ${gaugeCenterX - 6} ${gaugeCenterY - 2} L ${gaugeCenterX} 34 L ${gaugeCenterX + 6} ${gaugeCenterY - 2} Z`}
                fill={visual.primary}
              />
            </g>
            <circle
              cx={gaugeCenterX}
              cy={gaugeCenterY}
              r="19"
              fill="white"
              stroke="rgba(0,0,0,0.08)"
              strokeWidth="1"
            />
            <circle cx={gaugeCenterX} cy={gaugeCenterY} r="7" fill={visual.primary} />
          </svg>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-black/[0.025] px-4 py-3">
        <p className="text-sm font-semibold leading-6 text-black/70">
          성비는 최대한 비슷하게 조정돼요.
        </p>
        <p className="mt-1 text-sm font-semibold leading-6 text-black/70">
          {moodCopy[summary.genderMood]}
        </p>
      </div>
    </div>
  );
}
