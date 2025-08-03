import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types/products";
import { Sale } from "@/types/sales";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormValues, SaleForm } from "@/components/sales/SaleForm";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { useUserBranch } from "@/hooks/user-branch";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isWithinInterval,
} from "date-fns";

const TIME_PERIODS = [
  { label: "Today", value: "day" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "This Year", value: "year" },
];

const Sales = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timePeriod, setTimePeriod] = useState("day");
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const { toast } = useToast();
  const { data: userBranchData } = useUserBranch();
  const id = userBranchData?.id;

  const queryClient = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Product[];
    },
  });

  // Fetch all branches if user is HEAD OFFICE
  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*");
      if (error) throw error;
      return data;
    },
    enabled: id === "HEAD OFFICE",
  });

  // Determine which branch to use for sales query
  const branchToUse = id === "HEAD OFFICE" ? selectedBranchId : id ?? null;

  // Fetch sales for the selected branch
  const { data: sales, refetch: refetchSales } = useQuery({
    queryKey: ["sales", branchToUse],
    queryFn: async () => {
      if (!branchToUse) return [];
      const { data, error } = await supabase
        .from("sales")
        .select(
          `
          *,
          items:sale_items(
            *,
            product:products(*)
          )
        `
        )
        .eq("branch_id", branchToUse)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!branchToUse,
  });

  const { data: productRecipes } = useQuery({
    queryKey: ["product_recipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_recipes")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const handleCreateSale = async (values: FormValues) => {
    try {
      setLoading(true);
      const total_amount = values.items.reduce(
        (sum: number, item) => sum + item.quantity * item.unit_price,
        0
      );

      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert([
          {
            payment_method: values.payment_method,
            total_amount,
            branch_id: id,
          },
        ])
        .select()
        .single();

      if (saleError) throw saleError;

      // Always get the correct unit_cost from product_recipes here
      const { error: itemsError } = await supabase.from("sale_items").insert(
        values.items.map((item) => {
          const recipe = productRecipes?.find(
            (r) => r.product_id === item.product_id
          );
          const unit_cost = recipe?.unit_cost ?? 0;
          return {
            sale_id: saleData.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.quantity * item.unit_price,
            unit_cost,
            total_cost: item.quantity * unit_cost,
            branch_id: id,
          };
        })
      );

      if (itemsError) throw itemsError;

      setLoading(false);

      toast({
        title: "Success",
        description: "Sale created successfully",
      });
      setIsAddDialogOpen(false);
      await refetchSales();

queryClient.invalidateQueries({ 
  queryKey: ["branch_product_today_view", branchToUse] 
});
    } catch (error) {
      console.error("Error creating sale:", error);
      toast({
        title: "Error",
        description: "Failed to create sale",
        variant: "destructive",
      });
    }
  };

  // Filter sales by time period
  const getPeriodRange = () => {
    const now = new Date();
    switch (timePeriod) {
      case "day":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "year":
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  const { start, end } = getPeriodRange();

  const filteredSales = (sales ?? []).filter((sale) =>
    isWithinInterval(new Date(sale.created_at), { start, end })
  );

  return (
    <div className="space-y-6 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/50 rounded-lg shadow-md w-full mx-auto margin-100">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-3xl font-bold tracking-tight">Sales</h2>
          <h2 className="text-3xl font-semibold">
            ₦{filteredSales
              .reduce((sum, sale) => sum + sale.total_amount, 0)
              .toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          </div>
          {/* Time period select */}
          <select
            className="border rounded px-2 py-1"
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
          >
            {TIME_PERIODS.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
          {/* Branch select for HEAD OFFICE */}
          {id === "HEAD OFFICE" && (
            <select
              className="border rounded px-2 py-1"
              value={selectedBranchId ?? ""}
              onChange={(e) => setSelectedBranchId(e.target.value)}
            >
              <option value="">Select Branch</option>
              {branches?.map((branch: any) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          )}
          
        {/* </div> */}

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              New Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Record New Sale</DialogTitle>
              <DialogDescription>
                Fill in the details to record sales.
              </DialogDescription>
            </DialogHeader>
            {products && (
              <SaleForm
                products={products}
                onSubmit={handleCreateSale}
                branchId={branchToUse ?? ""}
                isLoading={loading}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell>
                  {format(new Date(sale.created_at), "MMM d, yyyy h:mm a")}
                </TableCell>
                <TableCell>
                  {sale.items?.map((item) => (
                    <div key={item.id}>
                      {item.quantity}x {item.product?.name}
                    </div>
                  ))}
                </TableCell>
                <TableCell className="capitalize">
                  {sale.payment_method}
                </TableCell>
                <TableCell className="text-right">
                  ₦{sale.total_amount.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Sales;
