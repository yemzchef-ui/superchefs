import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface BranchPerformanceProps {
  salesData: any[];
  branches: any[];
  complimentaryCosts?: any[];
  damageCosts?: any[];
  imprestCosts?: any[];
  materialDamageCosts?: any[];
  indirectMaterialCosts?: any[];
}

export default function BranchPerformance({
  salesData,
  branches,
  complimentaryCosts = [],
  damageCosts = [],
  imprestCosts = [],
  materialDamageCosts = [],
  indirectMaterialCosts = [],
}: BranchPerformanceProps) {
  // Aggregate profitability by branch
  const branchMetrics = useMemo(() => {
    const map: Record<
      string,
      {
        name: string;
        revenue: number;
        cost: number;
        profit: number;
        costToRevenueRatio: number;
      }
    > = {};

    // Helper to sum costs for a branch
    const sumCost = (arr: any[], branchId: string) =>
      (arr || []).reduce(
        (acc, curr) =>
          curr.branch_id === branchId ? acc + (Number(curr.cost) || 0) : acc,
        0
      );

    (branches || []).forEach((branch) => {
      map[branch.id] = {
        name: branch.name,
        revenue: 0,
        cost: 0,
        profit: 0,
        costToRevenueRatio: 0,
      };
    });

    (salesData || []).forEach((sale) => {
      const branchId = sale.branch_id;
      if (!map[branchId]) return;
      (sale.items || []).forEach((item: any) => {
        map[branchId].revenue += Number(item.subtotal) || 0;
        map[branchId].cost += Number(item.total_cost) || 0;
      });
    });

    // Add costs from other tables
    Object.keys(map).forEach((branchId) => {
      map[branchId].cost += sumCost(complimentaryCosts, branchId);
      map[branchId].cost += sumCost(damageCosts, branchId);
      map[branchId].cost += sumCost(imprestCosts, branchId);
      map[branchId].cost += sumCost(materialDamageCosts, branchId);
      map[branchId].cost += sumCost(indirectMaterialCosts, branchId);
      map[branchId].profit = map[branchId].revenue - map[branchId].cost;
      map[branchId].costToRevenueRatio =
        map[branchId].revenue > 0
          ? (map[branchId].cost / map[branchId].revenue) * 100
          : 0;
    });

    return Object.values(map);
  }, [
    salesData,
    branches,
    complimentaryCosts,
    damageCosts,
    imprestCosts,
    materialDamageCosts,
    indirectMaterialCosts,
  ]);

  // Prepare data for diverging bar chart (vertical)
  const sorted = branchMetrics.sort((a, b) => b.profit - a.profit);
  const labels = sorted.map((b) => b.name);

  // Profitable (75% and below) point up (positive, green), less profitable (>75%) point down (negative, red)
  const dataDiverge = sorted.map((b) =>
    b.costToRevenueRatio <= 75 
  ? Math.abs(b.profit)
  : -Math.abs(b.profit)
);

//   const dataDiverge = sorted.map((b) =>
//   b.costToRevenueRatio <= 75
//     ? 100 - b.costToRevenueRatio // green/up: higher % = lower bar
//     : -(100 - b.costToRevenueRatio) // red/down: higher % = lower bar, negative
// );

  const backgroundColors = sorted.map((b) =>
    b.costToRevenueRatio <= 75 ? "#10b981" : "#ef4444"
  );

  const chartData = {
    labels,
    datasets: [
      {
        label: "Branch Profit",
        data: dataDiverge,
        backgroundColor: backgroundColors,
        borderRadius: 2,
        borderSkipped: false,
      },
    ],
  };

  const options = {
    indexAxis: "x" as const, // vertical bars
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const value = Math.abs(context.parsed.y || context.parsed[1]);
            const ratio = sorted[context.dataIndex]?.costToRevenueRatio ?? 0;
            const ratioStr = ratio.toFixed(1) + "%";
            return [
              `₦${value.toLocaleString()}`,
              `(${ratioStr})`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Profit (₦)" },
        grid: {
          color: (ctx: any) => (ctx.tick.value === 0 ? "000" : "gray"),
          lineWidth: (ctx: any) => (ctx.tick.value === 0 ? 2 : 0.2),
        },
        ticks: {
          callback: function (value: number) {
            return value < 0 ? `-₦${Math.abs(value)}` : `₦${value}`;
          },
        },
      },
      x: {
        title: { display: false },
      },
    },
  };

  return (
    <div style={{ width: "100%" }}>
      <Bar
        data={chartData}
        options={options}
        height={100}
        style={{ width: "100%" }}
      />
    </div>
  );
}
