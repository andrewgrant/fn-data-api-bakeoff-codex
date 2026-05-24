import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { shortDate, whole } from "../lib/format.js";

interface MetricChartProps {
  data: Array<{ timestamp: string; value: number | null }>;
  color?: string;
}

export default function MetricChart({ data, color = "#047857" }: MetricChartProps) {
  const chartData = data.map((point) => ({
    ...point,
    label: shortDate(point.timestamp)
  }));

  return (
    <div className="chart-panel">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 12, right: 22, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="#e2e8df" strokeDasharray="4 4" />
          <XAxis dataKey="label" minTickGap={28} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={whole} width={58} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) => [whole(value as number), "Value"]}
            labelStyle={{ color: "#15201b" }}
            contentStyle={{ borderRadius: 8, border: "1px solid #cad6ce" }}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
