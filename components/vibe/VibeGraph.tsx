import {
  vibeAxes,
  vibeAxisConfig,
  type VibeAxis,
  type VibeScores,
} from "@/components/vibe/vibeGraphConfig";

type VibeAxisLabelOverride = Partial<{
  label: string;
  leftLabel: string;
  rightLabel: string;
}>;

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function isValidScore(value: number | null | undefined) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 1 &&
    value <= 5
  );
}

function positionPercent(score: number) {
  return 8 + ((score - 1) / 4) * 84;
}

export function VibeGraph({
  title,
  description,
  scores,
  visibleAxes = vibeAxes,
  className,
  showAxisHeader = true,
  axisLabelOverrides,
}: {
  title: string;
  description?: string;
  scores?: VibeScores | null;
  visibleAxes?: readonly VibeAxis[];
  className?: string;
  showAxisHeader?: boolean;
  axisLabelOverrides?: Partial<Record<VibeAxis, VibeAxisLabelOverride>>;
}) {
  const axes = visibleAxes.filter((axis) => isValidScore(scores?.[axis]));

  if (axes.length === 0) return null;

  return (
    <section
      className={cn(
        "rounded-[22px] border border-black/8 bg-white px-5 py-5 shadow-[0_10px_28px_rgba(0,0,0,0.025)]",
        className,
      )}
    >
      <h2 className="text-[15px] font-black text-black">{title}</h2>
      {description && (
        <p className="mt-2 text-xs font-semibold leading-5 text-black/40">
          {description}
        </p>
      )}

      <div className="mt-5 space-y-4">
        {axes.map((axis) => {
          const config = {
            ...vibeAxisConfig[axis],
            ...axisLabelOverrides?.[axis],
          };
          const score = scores?.[axis] as number;

          return (
            <div key={axis}>
              {showAxisHeader && (
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-black/70">
                    {config.label}
                  </span>
                  <span className="text-[11px] font-semibold text-black/35">
                    {config.leftLabel} ↔ {config.rightLabel}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-[62px_minmax(0,1fr)_78px] items-center gap-3">
                <span className="text-[11px] font-bold text-black/38">
                  {config.leftLabel}
                </span>
                <div className="relative h-3 rounded-full bg-black/[0.06]">
                  <span className="absolute left-1/2 top-1/2 h-4 w-px -translate-y-1/2 bg-black/10" />
                  <span
                    className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow-[0_3px_10px_rgba(0,0,0,0.14)]"
                    style={{ left: `${positionPercent(score)}%` }}
                  />
                </div>
                <span className="text-right text-[11px] font-bold text-black/38">
                  {config.rightLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
