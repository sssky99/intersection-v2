import {
  meetingAtmosphereAgeBands,
  meetingAtmosphereSummary,
  type MeetingAtmosphereAgeBandId,
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

const preferenceLegend = [
  { label: "남성 선호", color: moodVisuals.male.primary },
  { label: "여성 선호", color: moodVisuals.female.primary },
  { label: "모두 선호", color: moodVisuals.balanced.primary },
];

const center = 120;
const outerRadius = 104;
const innerRadius = 50;
const labelRadius = 78;
const segmentDegrees = 72;
const segmentGap = 0;

const bandAngles: Record<MeetingAtmosphereAgeBandId, number> = {
  "20-early": 0,
  "20-middle": 72,
  "20-late": 144,
  "30-early": 216,
  "30-middle": 288,
};

function polarPoint(radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: center + radius * Math.sin(radians),
    y: center - radius * Math.cos(radians),
  };
}

function segmentPath(angle: number) {
  const startAngle = angle - segmentDegrees / 2 + segmentGap / 2;
  const endAngle = angle + segmentDegrees / 2 - segmentGap / 2;
  const outerStart = polarPoint(outerRadius, startAngle);
  const outerEnd = polarPoint(outerRadius, endAngle);
  const innerEnd = polarPoint(innerRadius, endAngle);
  const innerStart = polarPoint(innerRadius, startAngle);

  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 0 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    "Z",
  ].join(" ");
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
  const selectedBandId = summary.ageBand?.id ?? "20-middle";
  const needleAngle = bandAngles[selectedBandId];

  return (
    <div className={cn("rounded-[28px] border border-black/8 bg-white p-4", className)}>
      <div
        className="rounded-[24px] border border-black/6 px-3 py-4 shadow-[0_12px_28px_rgba(0,0,0,0.035)]"
        style={{
          background: `linear-gradient(145deg, #ffffff 0%, #ffffff 52%, ${visual.soft} 100%)`,
        }}
      >
        <div
          className="flex items-center gap-3 text-[10px] font-bold text-black/45"
          aria-label="선호 색상 안내"
        >
          {preferenceLegend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {item.label}
            </span>
          ))}
        </div>

        <div className="mx-auto aspect-square w-full max-w-[268px]">
          <svg
            viewBox="0 0 240 240"
            role="img"
            aria-label={`${summary.agePhrase} ${summary.genderPhrase}`}
            className="h-full w-full overflow-visible"
          >
            <defs>
              <filter id="meeting-atmosphere-needle-shadow">
                <feDropShadow
                  dx="0"
                  dy="8"
                  stdDeviation="6"
                  floodColor={visual.shadow}
                />
              </filter>
            </defs>

            <circle cx={center} cy={center} r="111" fill="rgba(0,0,0,0.025)" />
            <circle cx={center} cy={center} r="49" fill="white" />

            {meetingAtmosphereAgeBands.map((band) => {
              const angle = bandAngles[band.id];
              const selected = band.id === selectedBandId;
              const labelPoint = polarPoint(labelRadius, angle);
              const [decade, phase] = band.label.split(" ");

              return (
                <g key={band.id}>
                  <path
                    d={segmentPath(angle)}
                    fill={selected ? visual.softFill : "rgba(0,0,0,0.04)"}
                    stroke={selected ? visual.stroke : "rgba(255,255,255,0.72)"}
                    strokeWidth={selected ? 2 : 0.8}
                  />
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y - 5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={selected ? visual.primary : "rgba(0,0,0,0.48)"}
                    fontSize={selected ? 11 : 10}
                    fontWeight={selected ? 900 : 800}
                  >
                    <tspan x={labelPoint.x} dy="0">
                      {decade}
                    </tspan>
                    <tspan x={labelPoint.x} dy="13">
                      {phase}
                    </tspan>
                  </text>
                </g>
              );
            })}

            <g
              transform={`rotate(${needleAngle} ${center} ${center})`}
              filter="url(#meeting-atmosphere-needle-shadow)"
            >
              <path
                d="M 120 44 L 128 119 L 120 134 L 112 119 Z"
                fill={visual.primary}
              />
            </g>
            <circle
              cx={center}
              cy={center}
              r="18"
              fill="white"
              stroke="rgba(0,0,0,0.08)"
              strokeWidth="1"
            />
            <circle cx={center} cy={center} r="7" fill={visual.primary} />
          </svg>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-black/[0.025] px-4 py-3">
        <p className="text-[15px] font-black leading-6 text-black/82">
          {summary.agePhrase}
        </p>
        <p className="mt-1 text-[15px] font-black leading-6 text-black/82">
          {summary.genderPhrase}
        </p>
      </div>
    </div>
  );
}
