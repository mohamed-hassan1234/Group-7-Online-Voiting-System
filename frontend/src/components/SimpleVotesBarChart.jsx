const formatTick = (value) => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
};

function SimpleVotesBarChart({
  title = "Votes per Candidate",
  data = [],
  caption = "",
  height = 280,
}) {
  const normalized = (Array.isArray(data) ? data : [])
    .map((item, index) => ({
      id: item?.id || `${item?.label || "item"}-${index}`,
      label: item?.label || "Unknown",
      value: Number(item?.value || 0),
    }))
    .filter((item) => item.value >= 0);

  if (!normalized.length) {
    return (
      <div className="ems-chart-shell p-4">
        <h3 className="text-2xl font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">No chart data available.</p>
      </div>
    );
  }

  const maxValue = Math.max(1, ...normalized.map((item) => item.value));
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, idx) => {
    const ratio = (tickCount - 1 - idx) / (tickCount - 1);
    return maxValue * ratio;
  });
  const plotWidth = Math.max(520, normalized.length * 170);

  return (
    <div className="ems-chart-shell p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-2xl font-semibold text-slate-900">{title}</h3>
        {caption ? <p className="text-xs text-slate-500">{caption}</p> : null}
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
        <div className="grid grid-cols-[52px_1fr] gap-3">
          <div className="relative" style={{ height: `${height}px` }}>
            {ticks.map((tick, idx) => (
              <div
                className="absolute right-0 text-[12px] font-medium text-[#1F2937]"
                key={`${tick}-${idx}`}
                style={{ top: `${(idx / (ticks.length - 1)) * 100}%`, transform: "translateY(-50%)" }}
              >
                {formatTick(tick)}
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <div style={{ minWidth: `${plotWidth}px` }}>
              <div className="relative border-b border-l border-[#CBD5E1] bg-white" style={{ height: `${height}px` }}>
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  {ticks.map((tick, idx) => (
                    <div className="border-t border-[#E5E7EB]" key={`grid-${tick}-${idx}`} />
                  ))}
                </div>

                <div className="absolute inset-x-6 bottom-12 top-2 flex items-end justify-around gap-8">
                  {normalized.map((item) => {
                    const barHeight =
                      item.value === 0
                        ? 0
                        : Math.max(8, Math.round((item.value / maxValue) * (height - 60)));

                    return (
                      <div className="flex w-full max-w-[220px] flex-col items-center justify-end" key={item.id}>
                        <div
                          className="w-full rounded-t-xl bg-[#1F2937]"
                          style={{ height: `${barHeight}px` }}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="absolute inset-x-4 bottom-2 flex items-start justify-around gap-8">
                  {normalized.map((item) => (
                    <div className="w-full max-w-[220px] text-center" key={`label-${item.id}`}>
                      <p className="line-clamp-2 text-sm font-medium text-[#1F2937]">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimpleVotesBarChart;
