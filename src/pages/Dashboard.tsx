import { useEffect, useState, useMemo } from "react";
import { timeAgo } from "@/utils/timeUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AttendanceButton from "@/components/attendance/AttendanceButton";

import {
  CakeIcon,
  ShoppingCart,
  Package,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
// import { productionData } from "./Production";
import { useUserBranch } from "@/hooks/user-branch";
import { useProductionContext } from "@/context/ProductionContext";
import { AccountsMetricsCards } from "@/components/accounts/Profitability";
import { Progress } from "@/components/ui/progress";



function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
  };
}

const Dashboard = () => {
  const { data: userBranch, isLoading: isBranchLoading } = useUserBranch() as {
    data: { name: string; role: string; id: string } | null;
    isLoading: boolean;
  };
  const { productionData } = useProductionContext();
  const { toast } = useToast();

  const [recentProduction, setRecentProduction] = useState([]);

  // Real-time subscription for production table
  useEffect(() => {
    const channel = supabase
      .channel("production_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "production",
        },
        (payload) => {
          toast({
            title: "Production Update",
            description: "A production record has been updated.",
          });
          // Refetch recent production activities
          fetchRecentProduction();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // fetchRecentProduction must be stable or wrapped in useCallback to avoid infinite loop
  }, [toast, userBranch]);

  // Move fetchRecentProduction outside useEffect so it can be called from subscription
  const fetchRecentProduction = async () => {
    if (userBranch) {
      try {
        let query = supabase
          .from("production")
          .select(
            `
          id,
          branch_name,
          product_name,
          yield,
          timestamp
        `
          )
          .order("timestamp", { ascending: false }) // by most recent
          .limit(20); // last 20 records

        // If the user is not from HEAD OFFICE, filter by branch
        if (userBranch.name !== "HEAD OFFICE") {
          query = query.eq("branch_name", userBranch.name);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching recent production data:", error);
          return;
        }

        if (!data || data.length === 0) {
          console.warn("No recent production data found.");
          setRecentProduction([]);
          return;
        }

        const recentData = data.map((item) => ({
          branch: item.branch_name || "Unknown Branch",
          productName: item.product_name || "Unknown Product",
          yield: item.yield || 0,
          timestamp: item.timestamp || new Date().toISOString(),
        }));

        setRecentProduction(recentData);
      } catch (err) {
        console.error("Unexpected error fetching recent production data:", err);
      }
    }
  };

  // Update the first useEffect to use fetchRecentProduction
  useEffect(() => {
    fetchRecentProduction();
  }, [userBranch]);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: user, error } = await supabase.auth.getUser();
        if (error) {
          console.error("Error fetching user:", error);
          return;
        }

        const { data: roles, error: roleError } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user?.user?.id);

        if (roleError) {
          console.error("Error fetching user roles:", roleError);
          return;
        }

        console.log("User:", user);
        console.log("Roles:", roles);
      } catch (err) {
        console.error("Unexpected error fetching user and roles:", err);
      }
    };

    fetchUserRole();
  }, []);

  const { start, end } = getCurrentWeekRange();
  const isHeadOffice = userBranch?.name === "HEAD OFFICE";
  const branchFilter = isHeadOffice ? undefined : userBranch?.name;

  // Fetch sales data for the week
  const { data: salesData } = useQuery({
    queryKey: ["dashboard_sales", start, end, branchFilter],
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

      query = query.gte("created_at", start).lte("created_at", end);

      if (branchFilter) {
        const { data: branch } = await supabase
          .from("branches")
          .select("id, name")
          .eq("name", branchFilter)
          .single();
        if (branch?.id) {
          query = query.eq("branch_id", branch.id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Helper to fetch costs from other tables
  const fetchCostTable = (table) =>
    useQuery({
      queryKey: [`dashboard_${table}_costs`, start, end, branchFilter],
      queryFn: async () => {
        let query = supabase.from(table).select("cost, created_at, branch_id");
        query = query.gte("created_at", start).lte("created_at", end);
        if (branchFilter) {
          const { data: branch } = await supabase
            .from("branches")
            .select("id, name")
            .eq("name", branchFilter)
            .single();
          if (branch?.id) {
            query = query.eq("branch_id", branch.id);
          }
        }
        const { data, error } = await query;
        if (error) throw error;
        return data;
      },
    });

  const { data: complimentaryCosts } = fetchCostTable("complimentary_products");
  const { data: damageCosts } = fetchCostTable("product_damages");
  const { data: imprestCosts } = fetchCostTable("imprest_supplied");
  const { data: materialDamageCosts } = fetchCostTable("damaged_materials");
  const {data: indirectMaterialCosts} = fetchCostTable("material_usage");

  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;

    (salesData || []).forEach((sale) => {
      (sale.items || []).forEach((item) => {
        totalRevenue += Number(item.subtotal) || 0;
        totalCost += Number(item.total_cost) || 0;
      });
    });

    const sumCost = (arr) =>
      (arr || []).reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);

    totalCost += sumCost(complimentaryCosts);
    totalCost += sumCost(damageCosts);
    totalCost += sumCost(imprestCosts);
    totalCost += sumCost(materialDamageCosts);
    totalCost += sumCost(indirectMaterialCosts);

    const costToRevenueRatio =
      totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

    return {
      costToRevenueRatio,
    };
  }, [
    salesData,
    complimentaryCosts,
    damageCosts,
    imprestCosts,
    materialDamageCosts,
    indirectMaterialCosts,
  ]);

  const { data: lowStockCount, isLoading: isLoadingLowStock } = useQuery({
    queryKey: ["low_stock_count", userBranch?.id, userBranch?.name],
    enabled: !!userBranch?.id,
    queryFn: async () => {
      // Fetch all materials and their summary for the branch or all branches
      let materialsQuery = supabase.from("materials").select("*");
      const { data: materials, error: matError } = await materialsQuery;
      if (matError) throw matError;

      // Decide which view to use for summary data
      const viewName =
        userBranch?.name === "HEAD OFFICE"
          ? "admin_material_today_view"
          : "branch_material_today_view";

      let summaryQuery = supabase.from(viewName).select("*");
      if (userBranch?.name !== "HEAD OFFICE") {
        summaryQuery = summaryQuery.eq("branch_id", userBranch.id);
      }
      const { data: summary, error: sumError } = await summaryQuery;
      if (sumError) throw sumError;

      // Map summary by material_id for fast lookup
      const summaryByMaterialId: Record<string, any> = {};
      summary?.forEach((row: any) => {
        summaryByMaterialId[row.material_id] = row;
      });

      // Count low stock items
      let count = 0;
      (materials || []).forEach((material: any) => {
        const item = summaryByMaterialId[material.id] || {};
        const currentQuantity =
          (item.total_quantity ?? 0) +
          (item.opening_stock ?? 0) +
          (item.total_procurement_quantity ?? 0) +
          (item.total_transfer_in_quantity ?? 0) -
          (item.total_transfer_out_quantity ?? 0) -
          (item.total_usage ?? 0) -
          (item.total_damage_quantity ?? 0);

        if (
  material.minimum_stock !== undefined &&
  currentQuantity !== 0 && // Exclude exactly zero
  currentQuantity <= (material.minimum_stock ?? 0)
) {
  count += 1;
}
      });

      return count;
    },
  });

  return (
    <div className="space-y-6 p-3 bg-transparent rounded-lg shadow-md w-full mx-auto margin-100">
      <div className="flex align-items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <AttendanceButton
          supabase={supabase}
          staffId={""}
          locationId={""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <AccountsMetricsCards
          metrics={{
            revenue: 0,
            cost: 0,
            profit: 0,
            totalItems: 0,
            costToRevenueRatio: metrics.costToRevenueRatio,
          }}
        />

        <Card className="hover:bg-green-50 transition-colors cursor-pointer hover:scale-110 hover:shadow-lg transition-transform duration-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium" >
              Low Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 flex items-center justify-center">
              {isLoadingLowStock ? (
                <Progress className="w-8 h-2" />
              ) : (
                lowStockCount
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {userBranch?.name === "HEAD OFFICE"
                ? "Total items across all branches"
                : "Low stocks in your branch"}
            </p>
          </CardContent>
        </Card>

        <Link to="/inventory">
          <Card className="hover:bg-green-50 transition-colors cursor-pointer hover:scale-110 hover:shadow-lg transition-transform duration-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Inventory</CardTitle>
              <Package className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Track and manage your inventory levels
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/products">
          <Card className="hover:bg-green-50 transition-colors cursor-pointer hover:scale-110 hover:shadow-lg transition-transform duration-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Products</CardTitle>
              <CakeIcon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Track and manage your product catalog
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/sales">
          <Card className="hover:bg-green-50 transition-colors cursor-pointer hover:scale-110 hover:shadow-lg transition-transform duration-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Sales</CardTitle>
              <ShoppingCart className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View and manage sales transactions
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Production Activities */}
      <Card className="col-span-12">
        <CardHeader>
          <CardTitle>Recent Production Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {recentProduction.length === 0 ? (
            <p>No recent production activities.</p>
          ) : (
            <div className="space-y-4">
              {recentProduction.map((record, index) => (
                <div key={index} className="flex border-b-2">
                  <div className="flex w-full items-center justify-between space-y-4">
                    <div className="flex text-sm items-center gap-1 font-medium">
                      <CakeIcon className="h-4 w-4 text-primary" />
                      {record.branch}
                    </div>

                    <p className="text-sm ">
                      <span className="text-sm font-bold">
                        {record.yield} {""}
                      </span>
                      {record.productName}
                    </p>
                    <div className="flex items-center">
                      <p className="text-sm font-bold">
                        {timeAgo(record.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
