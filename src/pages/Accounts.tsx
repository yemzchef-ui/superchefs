import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import dayjs from "dayjs";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/accounts/DateRangePicker";
import { Button } from "@/components/ui/button";
import { AccountsMetricsCards } from "@/components/accounts/AccountsMetricsCards";
import { AccountsChart } from "@/components/accounts/AccountsChart";
// import { Sale } from "@/types/sales";
import { naira } from "@/lib/utils";
import useAccountReportGenerator from "@/hooks/use-generate-report";
import { useUserBranch } from "@/hooks/user-branch";
import { UserMetadata } from "@supabase/supabase-js";
import ProductPerformance from "@/components/accounts/ProductPerformance";
import BranchPerformance from "@/components/accounts/BranchPerformance";

const Accounts = () => {
  const ContentRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState({
    email: null,
    email_verified: true,
    first_name: null,
    last_name: null,
    phone_verified: false,
    role: null,
    sub: null,
  } as UserMetadata);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const generate = useAccountReportGenerator;
  // const browserPrint = useHandlePrint(ContentRef); // for browser printing
  const { data: userBranch } = useUserBranch();
  const branchName = userBranch?.name || "";

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch sales data
  const { data: salesData } = useQuery({
    queryKey: ["sales", dateRange, selectedBranch, selectedProduct],
    queryFn: async () => {
      let query = supabase.from("sales").select(`
        *,
        branch:branches(name),
        items:sale_items(
          quantity,
          unit_price,
          unit_cost,
          total_cost,
          subtotal,
          product:products(*)
        )
      `);

      if (dateRange?.from && dateRange?.to) {
        query = query
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString());
      } else if (dateRange?.from && !dateRange?.to) {
        // Single date selected
        const fromDate = new Date(dateRange.from);
        const startOfDay = new Date(
          fromDate.setHours(0, 0, 0, 0)
        ).toISOString();
        const endOfDay = new Date(
          fromDate.setHours(23, 59, 59, 999)
        ).toISOString();
        query = query.gte("created_at", startOfDay).lte("created_at", endOfDay);
      }

      if (selectedBranch !== "all") {
        query = query.eq("branch_id", selectedBranch);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });
      if (error) throw error;

      if (selectedProduct !== "all") {
        return data.map((sale) => ({
          ...sale,
          items: sale.items.filter(
            (item: { product: { id: string } }) =>
              item.product.id === selectedProduct
          ),
        }));
      }

      return data;
    },
  });

  // Fetch complimentary_products cost
  const { data: complimentaryCosts } = useQuery({
    queryKey: ["complimentary_costs", dateRange, selectedBranch],
    queryFn: async () => {
      let query = supabase
        .from("complimentary_products")
        .select("cost, created_at, branch_id");
      if (dateRange?.from && dateRange?.to) {
        query = query
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString());
      } else if (dateRange?.from && !dateRange?.to) {
        const fromDate = new Date(dateRange.from);
        const startOfDay = new Date(
          fromDate.setHours(0, 0, 0, 0)
        ).toISOString();
        const endOfDay = new Date(
          fromDate.setHours(23, 59, 59, 999)
        ).toISOString();
        query = query.gte("created_at", startOfDay).lte("created_at", endOfDay);
      }
      if (selectedBranch !== "all") {
        query = query.eq("branch_id", selectedBranch);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  //Fetch material_damages cost
  const { data: materialDamageCosts } = useQuery({
    queryKey: ["material_damage_costs", dateRange, selectedBranch],
    queryFn: async () => {
      let query = supabase
        .from("damaged_materials")
        .select("cost, created_at, branch_id");
      if (dateRange?.from && dateRange?.to) {
        query = query
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString());
      } else if (dateRange?.from && !dateRange?.to) {
        const fromDate = new Date(dateRange.from);
        const startOfDay = new Date(
          fromDate.setHours(0, 0, 0, 0)
        ).toISOString();
        const endOfDay = new Date(
          fromDate.setHours(23, 59, 59, 999)
        ).toISOString();
        query = query.gte("created_at", startOfDay).lte("created_at", endOfDay);
      }
      if (selectedBranch !== "all") {
        query = query.eq("branch_id", selectedBranch);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch product_damages cost
  const { data: damageCosts } = useQuery({
    queryKey: ["damage_costs", dateRange, selectedBranch],
    queryFn: async () => {
      let query = supabase
        .from("product_damages")
        .select("cost, created_at, branch_id");
      if (dateRange?.from && dateRange?.to) {
        query = query
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString());
      } else if (dateRange?.from && !dateRange?.to) {
        const fromDate = new Date(dateRange.from);
        const startOfDay = new Date(
          fromDate.setHours(0, 0, 0, 0)
        ).toISOString();
        const endOfDay = new Date(
          fromDate.setHours(23, 59, 59, 999)
        ).toISOString();
        query = query.gte("created_at", startOfDay).lte("created_at", endOfDay);
      }
      if (selectedBranch !== "all") {
        query = query.eq("branch_id", selectedBranch);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch imprest_supplied cost
  const { data: imprestCosts } = useQuery({
    queryKey: ["imprest_costs", dateRange, selectedBranch],
    queryFn: async () => {
      let query = supabase
        .from("imprest_supplied")
        .select("cost, created_at, branch_id");
      if (dateRange?.from && dateRange?.to) {
        query = query
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString());
      } else if (dateRange?.from && !dateRange?.to) {
        const fromDate = new Date(dateRange.from);
        const startOfDay = new Date(
          fromDate.setHours(0, 0, 0, 0)
        ).toISOString();
        const endOfDay = new Date(
          fromDate.setHours(23, 59, 59, 999)
        ).toISOString();
        query = query.gte("created_at", startOfDay).lte("created_at", endOfDay);
      }
      if (selectedBranch !== "all") {
        query = query.eq("branch_id", selectedBranch);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch indirect materials cost
  const { data: indirectMaterialCosts } = useQuery({
    queryKey: ["indirect_material_costs", dateRange, selectedBranch],
    queryFn: async () => {
      let query = supabase
        .from("material_usage")
        .select("cost, created_at, branch_id");
      if (dateRange?.from && dateRange?.to) {
        query = query
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString());
      } else if (dateRange?.from && !dateRange?.to) {
        const fromDate = new Date(dateRange.from);
        const startOfDay = new Date(
          fromDate.setHours(0, 0, 0, 0)
        ).toISOString();
        const endOfDay = new Date(
          fromDate.setHours(23, 59, 59, 999)
        ).toISOString();
        query = query.gte("created_at", startOfDay).lte("created_at", endOfDay);
      }
      if (selectedBranch !== "all") {
        query = query.eq("branch_id", selectedBranch);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalItems = 0;

    // Revenue and cost from sales
    (salesData || []).forEach((sale) => {
      (sale.items || []).forEach(
        (item: { subtotal: any; total_cost: any; quantity: any }) => {
          totalRevenue += Number(item.subtotal) || 0;
          totalCost += Number(item.total_cost) || 0; // Use total_cost directly
          totalItems += Number(item.quantity) || 0;
        }
      );
    });

    // Add costs from other tables
    const sumCost = (arr: { cost: any; created_at: any; branch_id: any }[]) =>
      (arr || []).reduce(
        (acc: number, curr: { cost: any }) => acc + (Number(curr.cost) || 0),
        0
      );

    totalCost += sumCost(complimentaryCosts || []);
    totalCost += sumCost(damageCosts || []);
    totalCost += sumCost(imprestCosts || []);
    totalCost += sumCost(materialDamageCosts || []);
    totalCost += sumCost(indirectMaterialCosts || []);

    const profit = totalRevenue - totalCost;
    const costToRevenueRatio =
      totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

    return {
      revenue: totalRevenue,
      cost: totalCost,
      profit,
      costToRevenueRatio,
      totalItems,
    };
  }, [
    salesData,
    complimentaryCosts,
    damageCosts,
    imprestCosts,
    materialDamageCosts,
    indirectMaterialCosts,
  ]);

  const accountData = useMemo(() => {
    return {
      username: `${user?.first_name} ${user?.last_name}`,
      userBranch: branchName || "All Branches",
      dateRange: !dateRange
        ? "All time"
        : `${dayjs(dateRange?.from).format("Do MMMM YYYY")} - ${dayjs(
            dateRange?.to
          ).format("Do MMMM YYYY")}`,
      filters: {
        branches:
          selectedBranch === "all"
            ? "All Branches"
            : branches?.filter((x) => x?.id === selectedBranch)[0]?.name,
        products:
          selectedProduct === "all"
            ? "All Products"
            : products?.filter((x) => x?.id === selectedProduct)[0]?.name,
      },
      financialSummary: {
        totalRevenue: metrics.revenue,
        itemsSold: metrics.totalItems,
        totalCost: metrics.cost,
        netProfit: metrics.profit,
        costRevenueRatio: metrics.costToRevenueRatio.toFixed(1),
      },
      salesDetails: salesData?.map((x) => {
        return {
          date: dayjs(x?.created_at).format("D MMMM, YYYY"),
          branch: branches?.filter((b) => b?.id === x?.branch_id)[0]?.name,
          items: x?.items
            ?.map(
              (t: { quantity: any; product: { name: any } }) =>
                `${t?.quantity}x ${t?.product?.name}`
            )
            .join(", "),
          amount: naira(x?.total_amount),
        };
      }),
      revenueVsCost: {
        labels: [dayjs(salesData?.[0]?.created_at).format("DD/MM/YYYY")],
        revenue: [metrics?.revenue],
        cost: [metrics?.cost],
      },
    };
  }, [
    branches,
    dateRange,
    metrics.cost,
    metrics.costToRevenueRatio,
    metrics.profit,
    metrics.revenue,
    metrics.totalItems,
    branchName,
    salesData,
    selectedBranch,
    products,
    salesData,
    selectedBranch,
    selectedProduct,
    user?.first_name,
    user?.last_name,
  ]);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) {
        console.error("Error fetching user:", error);
        return;
      }
      if (user && user.user_metadata) {
        setUser(user.user_metadata);
      }
    };

    fetchUser();
  }, []);

  return (
    <div className="space-y-6 p-3 bg-transparent rounded-lg shadow-md w-full mx-auto margin-100">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Accounts</h2>
        <Button onClick={generate({ data: accountData }).pdf}>
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <DatePickerWithRange date={dateRange} setDate={setDateRange} />

        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Select Branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches?.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Select Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {products?.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AccountsMetricsCards metrics={metrics} ref={ContentRef} />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <AccountsChart data={salesData || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductPerformance salesData={salesData || []} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Branch Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <BranchPerformance
            salesData={salesData || []}
            branches={branches || []}
            complimentaryCosts={complimentaryCosts}
            damageCosts={damageCosts}
            imprestCosts={imprestCosts}
            materialDamageCosts={materialDamageCosts}
            indirectMaterialCosts={indirectMaterialCosts}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Accounts;
