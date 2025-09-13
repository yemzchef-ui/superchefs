import { forwardRef, RefObject } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { naira } from "@/lib/utils";
import { TrendingUp, TrendingDown, Percent } from "lucide-react";

interface AccountsMetricsCardsProps {
  metrics: {
    revenue: number;
    cost: number;
    profit: number;
    costToRevenueRatio: number;
    totalItems: number;
  };
  stockMetrics?: {
    material: {
      opening: number;
      closing: number;
      damages: number;
      stockIn: number;
      transfersOut: number;
    };
    product: {
      opening: number;
      closing: number;
      damages: number;
      stockIn: number;
      transfersOut: number;
    };
    total: {
      opening: number;
      closing: number;
      damages: number;
      stockIn: number;
      transfersOut: number;
    };
  };
}

export const AccountsMetricsCards = forwardRef<
  HTMLDivElement,
  AccountsMetricsCardsProps
>(({ metrics, stockMetrics }, ref) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" ref={ref}>
      <Card className="hover:bg-green-50 transition-colors cursor-pointer hover:scale-110 hover:shadow-lg transition-transform duration-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <div className="h-4 w-4 text-primary">₦</div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {naira(metrics.revenue.toFixed(2))}
          </div>
          <p className="text-xs text-muted-foreground">
            From {metrics.totalItems} items sold
          </p>
        </CardContent>
      </Card>

      <Card className="hover:bg-red-50 transition-colors cursor-pointer hover:scale-110 hover:shadow-lg transition-transform duration-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          <TrendingDown className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {naira(metrics.cost.toFixed(2))}
          </div>
          <p className="text-xs text-muted-foreground">Operating expenses</p>
        </CardContent>
      </Card>

      <Card className="hover:bg-green-50 transition-colors cursor-pointer hover:scale-110 hover:shadow-lg transition-transform duration-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          {metrics.profit > 0 ? (
            <div className="text-2xl font-bold text-green-600">
              {naira(metrics.profit.toFixed(2))}
            </div>
          ) : (
            <div className="text-2xl font-bold text-red-600">
              {naira(metrics.profit.toFixed(2))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Revenue - Cost</p>
        </CardContent>
      </Card>

      <Card className="hover:bg-yellow-50 transition-colors cursor-pointer hover:scale-110 hover:shadow-lg transition-transform duration-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Cost/Revenue Ratio
          </CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {metrics.costToRevenueRatio > 75 ? (
            <div className="text-2xl font-bold text-red-600">
              {metrics.costToRevenueRatio.toFixed(1)}%
            </div>
          ) : (
            <div className="text-2xl font-bold text-green-600">
              {metrics.costToRevenueRatio.toFixed(1)}%
            </div>
          )}
          <p className="text-xs text-muted-foreground">Cost as % of revenue</p>
        </CardContent>
      </Card>

      <Card className="col-span-1 md:col-span-2 overflow-hidden w-full hover:bg-blue-50 transition-colors cursor-pointer hover:scale-110 hover:shadow-lg transition-transform duration-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium mb-2">
        Stock Summary
          </CardTitle>
          <div className="overflow-x-auto">
        <table className="min-w-full text-xs border">
          <thead>
            <tr>
          <th className="border px-2 py-1">Type</th>
          <th className="border px-2 py-1">Opening Stock</th>
          <th className="border px-2 py-1">Closing Stock</th>
          <th className="border px-2 py-1">Damages</th>
          <th className="border px-2 py-1">Stock In</th>
          <th className="border px-2 py-1">Transfers Out</th>
            </tr>
          </thead>
          <tbody>
            <tr>
          <td className="border px-2 py-1 font-semibold">Material</td>
          <td className="border px-2 py-1">
            {naira((stockMetrics?.material.opening ?? 0).toFixed(2))}
          </td>
          <td className="border px-2 py-1">
            {naira((stockMetrics?.material.closing ?? 0).toFixed(2))}
          </td>
          <td className="border px-2 py-1">
            {naira((stockMetrics?.material.damages ?? 0).toFixed(2))}
          </td>
          <td className="border px-2 py-1">
            {naira((stockMetrics?.material.stockIn ?? 0).toFixed(2))}
          </td>
          <td className="border px-2 py-1">
            {naira(
              (stockMetrics?.material.transfersOut ?? 0).toFixed(2)
            )}
          </td>
            </tr>
            <tr>
          <td className="border px-2 py-1 font-semibold">Product</td>
          <td className="border px-2 py-1">
            {naira((stockMetrics?.product.opening ?? 0).toFixed(2))}
          </td>
          <td className="border px-2 py-1">
            {naira((stockMetrics?.product.closing ?? 0).toFixed(2))}
          </td>
          <td className="border px-2 py-1">
            {naira((stockMetrics?.product.damages ?? 0).toFixed(2))}
          </td>
          <td className="border px-2 py-1">
            {naira((stockMetrics?.product.stockIn ?? 0).toFixed(2))}
          </td>
          <td className="border px-2 py-1">
            {naira(
              (stockMetrics?.product.transfersOut ?? 0).toFixed(2)
            )}
          </td>
            </tr>
            <tr>
          <td className="border px-2 py-1 font-semibold">Total</td>
          <td className="border px-2 py-1">
            {naira((stockMetrics?.total.opening ?? 0).toFixed(2))}
          </td>
          <td className="border px-2 py-1">
            {naira((stockMetrics?.total.closing ?? 0).toFixed(2))}
          </td>
          <td className="border px-2 py-1">
            {naira((stockMetrics?.total.damages ?? 0).toFixed(2))}
          </td>
          <td className="border px-2 py-1">
            {naira((stockMetrics?.total.stockIn ?? 0).toFixed(2))}
          </td>
          <td className="border px-2 py-1">
            {naira((stockMetrics?.total.transfersOut ?? 0).toFixed(2))}
          </td>
            </tr>
          </tbody>
        </table>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
});
