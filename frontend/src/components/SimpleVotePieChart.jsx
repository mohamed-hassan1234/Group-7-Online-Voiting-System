function SimpleVotePieChart({ title = "Vote Distribution", data = [] }) {
  const normalized = (Array.isArray(data) ? data : [])
    .map((item, index) => ({
      id: item?.id || `slice-${index}`,
      label: item?.label || "Unknown",
      value: Number(item?.value || 0),
    }))
    .filter((item) => item.value > 0);

  if (!normalized.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
        <h3 className="text-3xl font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">No vote distribution data yet.</p>
      </div>
    );
  }

  const total = normalized.reduce((sum, item) => sum + item.value, 0);
  let angle = 0;
  const palette = ["#1F2937", "#14B8A6", "#374151", "#0F766E", "#111827", "#5EEAD4"];
  const slices = normalized.map((item, index) => {
    const start = angle;
    const part = (item.value / total) * 360;
    angle += part;
    return {
      ...item,
      color: palette[index % palette.length],
      start,
      end: angle,
      percentage: Number(((item.value / total) * 100).toFixed(2)),
    };
  });

  const gradient = slices
    .map((slice) => `${slice.color} ${slice.start}deg ${slice.end}deg`)
    .join(", ");

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-panel">
      <h3 className="text-3xl font-bold text-slate-900">{title}</h3>
      <div className="mt-5 flex flex-col items-center justify-center">
        <div
          className="h-64 w-64 rounded-full border border-[#E5E7EB]"
          style={{ background: `conic-gradient(${gradient})` }}
        />

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {slices.map((slice) => (
            <div className="flex items-center gap-2 text-sm text-[#1F2937]" key={slice.id}>
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: slice.color }}
              />
              <span className="font-medium">
                {slice.label} ({slice.value})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SimpleVotePieChart;
