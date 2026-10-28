"use client";
import {
  Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ReferenceLine,
  ResponsiveContainer, XAxis, YAxis, Tooltip,
} from "recharts";

export type TrendPoint = { name: string; spend: number; sale: number; roas: number; sub: string };
export type SharePoint = { name: string; value: number; color: string };

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));

export function SpendSaleChart({ data, breakEven }: { data: TrendPoint[]; breakEven: number }) {
  return (
    <div role="img" aria-label="Biểu đồ chi tiêu, doanh thu và ROAS theo chiến dịch" className="h-80">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="money" tickFormatter={(v) => (v >= 1e6 ? v / 1e6 + " Tr" : v / 1e3 + "K")} tick={{ fontSize: 12 }} />
          <YAxis yAxisId="roas" orientation="right" tickFormatter={(v) => v + "x"} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v, k) => (k === "ROAS" ? Number(v).toFixed(2).replace(".", ",") + "x" : fmt(Number(v)) + " đ")} />
          <Legend />
          <Bar yAxisId="money" dataKey="spend" name="Chi tiêu" fill="#e11d48" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="money" dataKey="sale" name="Total Sale" fill="#2563eb" radius={[4, 4, 0, 0]} />
          <Line yAxisId="roas" dataKey="roas" name="ROAS" stroke="#f59e0b" strokeWidth={2} dot />
          <ReferenceLine yAxisId="roas" y={breakEven} stroke="#059669" strokeDasharray="6 4"
            label={{ value: `ROAS hoà vốn (CIR 45%): ${breakEven.toFixed(2).replace(".", ",")}x`, fontSize: 11, fill: "#059669" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ShareDonut({ data }: { data: SharePoint[] }) {
  return (
    <div role="img" aria-label="Tỷ trọng đóng góp Total Sale theo chiến dịch" className="h-56 w-56 shrink-0">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={60} outerRadius={95} paddingAngle={2}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={(v) => fmt(Number(v)) + " đ"} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
