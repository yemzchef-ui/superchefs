import { useMemo } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface ProductPerformanceProps {
  salesData: any[];
}

const COLORS = [
  "#6366f1",
  "#f59e42",
  "#10b981",
  "#ef4444",
  "#fbbf24",
  "#3b82f6",
  "#a21caf",
  "#14b8a6",
  "#eab308",
  "#f472b6",
  "#818cf8",
  "#f87171",
  "#34d399",
  "#facc15",
  "#60a5fa",
  "#c026d3",
];

export default function ProductPerformance({
  salesData,
}: ProductPerformanceProps) {
  // Aggregate sales by product
  const productSales = useMemo(() => {
    const map: Record<string, { name: string; quantity: number }> = {};
    (salesData || []).forEach((sale) => {
      (sale.items || []).forEach((item: any) => {
        const id = item.product?.id;
        if (!id) return;
        if (!map[id]) {
          map[id] = {
            name: item.product?.name || "Unknown",
            quantity: 0,
          };
        }
        map[id].quantity += Number(item.quantity) || 0;
      });
    });
    return Object.values(map).sort((a, b) => b.quantity - a.quantity); // Sort by quantity descending
  }, [salesData]);

  const pieData = {
    labels: productSales.map((p) => p.name),
    datasets: [
      {
        label: "Sales Volume (Qty)",
        data: productSales.map((p) => p.quantity),
        backgroundColor: COLORS.slice(0, productSales.length),
        borderWidth: 0.1,
      },
    ],
  };

  const options = {
    plugins: {
      legend: {
        display: false, // Display names of products if true
        position: "right" as const,
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          padding: 1,
        },
      },
      tooltip: {
        callbacks: {
            title: () => "",
          label: function (context: any) {
            const label = context.label || "";
            const value = context.parsed || 0;
            return `${label}: ${value} sold`;
          },
        },
      },
    },
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        {productSales.length > 0 ? (
          <Pie data={pieData} options={options} />
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No sales data available for this period.
          </div>
        )}
      </div>
        {/* <div className="text-sm text-muted-foreground">
            Chart shows the total quantity sold for each product during the selected period, sorted by sales volume.
        </div> */}
    </div>
  );
}
