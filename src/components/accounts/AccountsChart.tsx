import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AccountsChartProps {
  data: any[];
  // { created_at: string; total_amount: number }[];
}

export function AccountsChart({ data }: AccountsChartProps) {
  const chartData = data.map((sale) => ({
    date: new Date(sale.created_at).toLocaleDateString(),
    revenue: sale.total_amount,
    cost: sale.total_amount * 0.6, // Assuming 60% cost for example
  }));

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="revenue" name="Revenue" fill="#4CAF50" />
          <Bar dataKey="cost" name="Cost" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
