import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Package, Banknote} from "lucide-react";

// interface ProductInventoryItem {
//   id: string;
//   quantity: number;
//   product_id: string;
//   branch_id: string;
//   products: {
//     name: string;
//   }[];
// }

interface Branch {
  id: string;
  name: string;
}

const BranchAnalytics = () => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [timeframe, setTimeframe] = useState<"weekly" | "monthly" | "yearly">(
    "weekly"
  );

  // Fetch all branches
  const { data: branches, isLoading: isLoadingBranches } = useQuery({
    queryKey: ["admin-branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*");

      if (error) {
        console.error("Error fetching branches:", error);
        throw error;
      }

      return data as Branch[];
    },
  });

  // Fetch sales data for selected branch or all branches if none selected
  const { data: salesData, isLoading: isLoadingSales } = useQuery({
    queryKey: ["admin-sales", selectedBranchId, timeframe],
    queryFn: async () => {
      try {
        let query = supabase
          .from("sales")
          .select(`id, created_at, total_amount, branch_id, payment_method`)
          .order("created_at", { ascending: false });

        if (selectedBranchId) {
          query = query.eq("branch_id", selectedBranchId);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching sales:", error);
          throw error;
        }

        return groupByTimeframe(data || [], timeframe);
      } catch (error) {
        console.error("Sales query failed:", error);
        return [];
      }
    },
    enabled: true,
  });

  // Fetch inventory data
  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ["admin-inventory", selectedBranchId],
    queryFn: async () => {
      try {
        let query = supabase.from("inventory").select(`
            id, quantity, material_id, branch_id,
            materials ( name, unit )
          `);

        if (selectedBranchId) {
          query = query.eq("branch_id", selectedBranchId);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching inventory:", error);
          throw error;
        }

        return data || [];
      } catch (error) {
        console.error("Inventory query failed:", error);
        return [];
      }
    },
    enabled: !!true,
  });

  // Fetch product inventory data
  const { data: productInventoryData, isLoading: isLoadingProducts } = useQuery(
    {
      queryKey: ["admin-product-inventory", selectedBranchId],
      queryFn: async () => {
        try {
          let query = supabase.from("product_inventory").select(`
            id, quantity, product_id, branch_id,
            products ( name )
          `);

          if (selectedBranchId) {
            query = query.eq("branch_id", selectedBranchId);
          }

          const { data, error } = await query;

          if (error) {
            console.error("Error fetching product inventory:", error);
            throw error;
          }

          return data || [];
        } catch (error) {
          console.error("Product inventory query failed:", error);
          return [];
        }
      },
      enabled: true,
    }
  );

  // Fetch all materials
  const { data: materialsData, isLoading: isLoadingMaterials } = useQuery({
    queryKey: ["admin-materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials").select("*");

      if (error) {
        console.error("Error fetching materials:", error);
        throw error;
      }

      return data || [];
    },
  });

  // Fetch all products
  const { data: productsData, isLoading: isLoadingAllProducts } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*");

      if (error) {
        console.error("Error fetching products:", error);
        throw error;
      }

      return data || [];
    },
  });

  // Define type for material summary items
  interface MaterialSummaryItem {
    material_name?: string;
    materials?: { name?: string };
    total_quantity?: number;
    opening_stock?: number;
    total_procurement_quantity?: number;
    total_transfer_in_quantity?: number;
    total_transfer_out_quantity?: number;
    total_usage?: number;
    total_damage_quantity?: number;
    [key: string]: any;
  }

  // Define type for product summary items
  interface ProductSummaryItem {
    product_name?: string;
    products?: { name?: string };
    total_production_quantity?: number;
    total_quantity?: number;
    opening_stock?: number;
    total_transfer_in_quantity?: number;
    total_usage_quantity?: number;
    total_transfer_out_quantity?: number;
    total_complimentary_quantity?: number;
    total_damage_quantity?: number;
    total_sales_quantity?: number;
    [key: string]: any;
  }

  // Fetch material inventory summary view (admin or branch)
  const { data: materialSummary, isLoading: isLoadingMaterialSummary } =
    useQuery<MaterialSummaryItem[]>({
      queryKey: ["admin-material-summary", selectedBranchId],
      queryFn: async () => {
        let view = selectedBranchId
          ? "branch_material_today_view"
          : "admin_material_today_view";
        let query = supabase.from(view).select("*");
        if (selectedBranchId) query = query.eq("branch_id", selectedBranchId);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      },
      enabled: !!true,
    });

  // Fetch product inventory summary view (admin or branch)
  const { data: productSummary, isLoading: isLoadingProductSummary } = useQuery<ProductSummaryItem[]>(
    {
      queryKey: ["admin-product-summary", selectedBranchId],
      queryFn: async () => {
        let view = selectedBranchId
          ? "branch_product_today_view"
          : "admin_product_today_view";
        let query = supabase.from(view).select("*");
        if (selectedBranchId) query = query.eq("branch_id", selectedBranchId);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      },
      enabled: !!true,
    }
  );

  // Helper function to filter sales by timeframe
  const filterSalesByTimeframe = (
    data: any[],
    timeframe: "weekly" | "monthly" | "yearly"
  ) => {
    const now = new Date();
    return data.filter((item) => {
      const date = new Date(item.created_at);
      if (timeframe === "weekly") {
      // Start of week: Monday
      const startOfWeek = new Date(now);
      const day = now.getDay() === 0 ? 7 : now.getDay(); // Sunday as 7
      startOfWeek.setDate(now.getDate() - (day - 1));
      startOfWeek.setHours(0, 0, 0, 0);
      // End of week: Sunday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return date >= startOfWeek && date <= endOfWeek;
      } else if (timeframe === "monthly") {
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
      } else {
      return date.getFullYear() === now.getFullYear();
      }
    });
  };

  // Helper function to group data by timeframe
  const groupByTimeframe = (
    data: any[],
    timeframe: "weekly" | "monthly" | "yearly"
  ) => {
    // Filter data first
    const filtered = filterSalesByTimeframe(data, timeframe);

    const result: Record<string, number> = {};

    filtered.forEach((item) => {
      const date = new Date(item.created_at);
      let key: string;

      if (timeframe === "weekly") {
        const dayOfWeek = date.toLocaleString("en-US", { weekday: "short" });
        key = dayOfWeek;
      } else if (timeframe === "monthly") {
        const month = date.toLocaleString("en-US", { month: "short" });
        const day = date.getDate();
        key = `${month} ${day}`;
      } else {
        key = date.toLocaleString("en-US", { month: "short" });
      }

      if (!result[key]) {
        result[key] = 0;
      }

      result[key] += item.total_amount || 0;
    });

    return Object.entries(result).map(([name, value]) => ({ name, value }));
  };

  // Calculate summary metrics
  const calculateSummaryMetrics = () => {
    const salesTotal =
      salesData?.reduce((sum, item) => sum + (item.value || 0), 0) || 0;
    const materialCount = materialsData?.length || 0;
    const productCount = productsData?.length || 0;

    return {
      salesTotal,
      materialCount,
      productCount,
    };
  };

  const metrics = calculateSummaryMetrics();
  const branchName =
    selectedBranchId && branches?.length
      ? branches.find((b) => b.id === selectedBranchId)?.name ||
        "Unknown Branch"
      : "All Branches";

  // Loading state for all queries
  if (
    isLoadingBranches ||
    isLoadingSales ||
    isLoadingInventory ||
    isLoadingProducts ||
    isLoadingMaterials ||
    isLoadingAllProducts
  ) {
    return (
      <div className="flex justify-center items-center">
        Loading data...
        <div className="animate-spin rounded-full text-green-500 h-8 w-8 border-t-2 border-b-2  border-green-500"></div>
      </div>
    );
  }

  console.log("Inventory Data:", inventoryData);
  console.log("Product Inventory Data:", productInventoryData);
  console.log(
    "Materials Field:",
    inventoryData?.map((item) => item.materials)
  );

  // Helper to compute currentQuantity for materials
  const getMaterialCurrentQuantity = (item: any) => {
    return (
      (item.total_quantity ?? 0) +
      (item.opening_stock ?? 0) +
      (item.total_procurement_quantity ?? 0) +
      (item.total_transfer_in_quantity ?? 0) -
      (item.total_transfer_out_quantity ?? 0) -
      (item.total_usage ?? 0) -
      (item.total_damage_quantity ?? 0)
    );
  };

  // Helper to compute currentQuantity for products
  const getProductCurrentQuantity = (item: any) => {
    return (
      (item.total_production_quantity ?? 0) +
      (item.total_quantity ?? 0) +
      (item.opening_stock ?? 0) +
      (item.total_transfer_in_quantity ?? 0) -
      (item.total_usage_quantity ?? 0) -
      (item.total_transfer_out_quantity ?? 0) -
      (item.total_complimentary_quantity ?? 0) -
      (item.total_damage_quantity ?? 0) -
      (item.total_sales_quantity ?? 0)
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="space-y-2">
          <Label>Select Branch</Label>
          <Select
            value={selectedBranchId || "all"}
            onValueChange={(value) =>
              setSelectedBranchId(value === "all" ? "" : value)
            }
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="All Branches" />
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
        </div>

        <div className="space-y-2">
          <Label>Time Period</Label>
          <Select
            value={timeframe}
            onValueChange={(value) => setTimeframe(value as any)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <h2 className="text-2xl font-bold">{branchName} Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{metrics.salesTotal.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {timeframe === "weekly"
                ? "This week"
                : timeframe === "monthly"
                ? "This month"
                : "This year"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Materials</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.materialCount}</div>
            <p className="text-xs text-muted-foreground">Inventory items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.productCount}</div>
            <p className="text-xs text-muted-foreground">
              Product inventory items
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Material Inventory</TabsTrigger>
          <TabsTrigger value="products">Product Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales Performance</CardTitle>
              <CardDescription>
                {timeframe === "weekly"
                  ? "Weekly"
                  : timeframe === "monthly"
                  ? "Monthly"
                  : "Yearly"}{" "}
                sales performance for {branchName}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" name="Sales (₦)" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Material Inventory</CardTitle>
              <CardDescription>
                Current material inventory levels for {branchName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(materialSummary || []).map((item, idx) => ({
                      name: idx + 1, // Use index as x-axis value (1-based)
                      label:
                        item.material_name ||
                        (item.materials?.name ?? "Unknown"),
                      value: getMaterialCurrentQuantity(item),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tickFormatter={(value) => value}
                      tickLine={true}
                      axisLine={true}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: any, name: any, props: any) => value}
                      labelFormatter={(index: any) => {
                        const item = (materialSummary || [])[index];
                        return (
                          item?.material_name ||
                          item?.materials?.name ||
                          `Material ${index}`
                        );
                      }}
                    />
                    <Legend />
                    <Bar dataKey="value" name="Quantity" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6">
                <h3 className="text-lg font-bold">Material List</h3>
                <table className="w-full border-collapse border border-gray-300 mt-4">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">
                        Material Name
                      </th>
                      <th className="border border-gray-300 px-4 py-2">
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(materialSummary || []).map((item, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="border border-gray-300 px-4 py-2">
                          {item.material_name ||
                            (item.materials?.name ?? "Unknown")}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {getMaterialCurrentQuantity(item).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Inventory</CardTitle>
              <CardDescription>
                Current product inventory levels for {branchName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(productSummary || []).map((item, idx) => ({
                      name: idx + 1, // Use index as x-axis value (1-based)
                      label:
                        item.product_name || (item.products?.name ?? "Unknown"),
                      value: getProductCurrentQuantity(item),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="1 1" />
                    <XAxis
                      dataKey="name"
                      tickFormatter={(value) => value}
                      tickLine={true}
                      axisLine={true}
                      // label={null}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: any, name: any, props: any) => value}
                      labelFormatter={(index: any) => {
                        const item = (productSummary || [])[index - 1];
                        return (
                          item?.product_name ||
                          item?.products?.name ||
                          `Product ${index}`
                        );
                      }}
                    />
                    <Legend />
                    <Bar dataKey="value" name="Quantity" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6">
                <h3 className="text-lg font-bold">Product List</h3>
                <table className="w-full border-collapse border border-gray-300 mt-4">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">
                        Product Name
                      </th>
                      <th className="border border-gray-300 px-4 py-2">
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(productSummary || []).map((item, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="border border-gray-300 px-4 py-2">
                          {item.product_name ||
                            (item.products?.name ?? "Unknown")}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {getProductCurrentQuantity(item).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BranchAnalytics;
