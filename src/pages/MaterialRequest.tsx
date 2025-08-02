import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import capitalize from "lodash/capitalize";
import { supabase } from "@/integrations/supabase/client";
import type { MaterialRequest } from "@/types/material_request";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { MaterialRequestDialog } from "@/components/material_request/MaterialRequestDialog";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import PaginationComponent from "@/components/pagination";
import { PAGE_LIMIT } from "@/constants";
import { useCheck } from "@/hooks/use-check";
import { useUserBranch } from "@/hooks/user-branch";
import { useAuth } from "@/hooks/auth";
import { useToast } from "@/hooks/use-toast";
import {
  MiniProcurementOrderItem,
  ProcurementOrder,
} from "@/components/procurement/ProcurementOrders";
import { FinalizeOrderDialog } from "@/components/ui/finalize-order";
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

interface FormValues {
  items: MiniProcurementOrderItem[];
}

const TIME_PERIODS = [
  { label: "Today", value: "day" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "This Year", value: "year" },
];

// Helper to fetch average weekly usage for a material and branch
const fetchAverageWeeklyUsage = async (
  materialId: string,
  branchId: string
): Promise<number | null> => {
  const fourWeeksAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("material_usage")
    .select("quantity")
    .eq("material_id", materialId)
    .eq("branch_id", branchId)
    .gte("created_at", fourWeeksAgo);

  if (error) return null;

  const totalUsage = data?.reduce((sum, row) => sum + (row.quantity || 0), 0) || 0;
  return totalUsage / 4;
};

const MaterialRequest = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAddDialogOpenAccept, setIsAddDialogOpenAccept] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [timePeriod, setTimePeriod] = useState("day");
  const [isMarkBadLoading, setIsMarkBadLoading] = useState(false);
  const [avgUsageMap, setAvgUsageMap] = useState<Record<string, number>>({});
  const [avgUsageLoading, setAvgUsageLoading] = useState(false);
  const { selectedItems, handleSelectAll, resetCheck, toggleCheck } =
    useCheck();
  const userBranch = useUserBranch();
  const { user } = useAuth();
  const { toast } = useToast();

  const {
    data,
    refetch: refetchMaterialRequests,
    isLoading,
  } = useQuery({
    queryKey: ["material_requests", page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_LIMIT;
      const to = from + PAGE_LIMIT - 1;

      const { data, error, count } = await supabase
        .from("material_requests")
        .select(
          `*,
        branch_id,
        material:material_id(minimum_stock, name, unit, unit_price, inventory:inventory(closing_stock, usage)),
        orders:procurement_order_items_material_request_id_fkey(procurement_order_id),
        branch:branch_id(name),
        user:user_id(first_name, last_name)
      `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return {
        material_requests: data as unknown as MaterialRequest[],
        hasNextPage: count ? to + 1 < count : false,
      };
    },
    placeholderData: (prevData) => prevData,
  });

  const handleFinalizeOrder = async (values: FormValues) => {
    try {
      setLoading(true);
      const new_items = values?.items?.map((x) => ({
        branch_id: userBranch?.data?.id,
        name: x?.name,
        quantity: Number(x?.quantity),
        status: "supplied" as ProcurementOrder["status"],
        unit: x?.unit,
        material_order_id: x?.order_id,
        material_id: x?.id,
        user_id: user?.id,
      }));

      // insert new items into procurement_supplied
      const { error } = await supabase
        .from("procurement_supplied")
        .insert(new_items);
      if (error) throw error;

      // Get all order IDs that need to be updated in order table
      const orderIds = new_items.map((item) => item.material_order_id);

      // Get all order IDs that need to be updated in request table
      const orderReqIds = new_items.map((item) => item.material_id);

      // Batch update procurement_orders in a single query
      const { error: updateError } = await supabase
        .from("procurement_orders")
        .update({ status: "supplied" }) // Set new status
        .in("id", orderIds); // Filter all relevant order IDs

      if (updateError) throw updateError;

      // Batch update procurement_orders in a single query
      const { error: updateReqError } = await supabase
        .from("material_requests")
        .update({ status: "supplied" }) // Set new status
        .in("material_id", orderReqIds); // Filter all relevant order IDs

      if (updateReqError) throw updateReqError;
      // Show success toast

      toast({
        title: "Success",
        description: `You have successfully recorded ${
          values.items?.length > 1 ? "orders" : "order"
        } as supplied`,
      });
      await refetchMaterialRequests();
      setIsAddDialogOpenAccept(false);
      resetCheck();
    } catch (error) {
      console.error(
        `Error recording ${
          values.items?.length > 1 ? "orders" : "order"
        } supplied:`,
        error
      );
      toast({
        title: "Error",
        description: `Failed to record ${
          values.items?.length > 1 ? "orders" : "order"
        } supplied`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // New: Mark selected requests as "rejected" and update all connected tables
  const handleMarkAsBad = async () => {
    if (!selectedItems.length) return;
    setIsMarkBadLoading(true);
    try {
      // Update material_requests
      const { error: mrError } = await supabase
        .from("material_requests")
        .update({ status: "rejected" })
        .in("id", selectedItems);

      if (mrError) throw mrError;

      // Update procurement_orders (if material_request_id is a foreign key)
      const { error: poError } = await supabase
        .from("procurement_orders")
        .update({ status: "rejected" })
        .in("material_request_id", selectedItems);

      if (poError) throw poError;

      toast({
        title: "Marked as Rejected",
        description: "Selected materials have been marked as rejected.",
      });
      await refetchMaterialRequests();
      resetCheck();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark as rejected.",
        variant: "destructive",
      });
    } finally {
      setIsMarkBadLoading(false);
    }
  };

  const calculateTotalCost = (quantity: number, unitPrice: number) =>
    quantity * unitPrice;

  // Helper to get date range for filter
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

  const branchId = userBranch?.data?.id;

  const filteredRequests = branchId
    ? (data?.material_requests ?? []).filter(
        (req) =>
          String(req.branch_id) === String(branchId) &&
          isWithinInterval(new Date(req.created_at), { start, end })
      )
    : [];

  // Real-time subscription for material_requests changes
  useEffect(() => {
    const channel = supabase
      .channel("material_requests_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "material_requests",
        },
        (payload) => {
          // Optionally, you can show a toast or log
          toast({
            title: "Material Request Update",
            description: "A material request has been updated.",
          });
          // Refetch data for real-time update
          refetchMaterialRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, refetchMaterialRequests]);

  // Fetch average weekly usage for all filtered requests
  useEffect(() => {
    const fetchAllAvgUsage = async () => {
      if (!filteredRequests.length) return;
      setAvgUsageLoading(true);
      const entries = await Promise.all(
        filteredRequests.map(async (req) => {
          const avg = await fetchAverageWeeklyUsage(
            req.material_id,
            req.branch_id
          );
          return [req.id, avg ?? 0];
        })
      );
      setAvgUsageMap(Object.fromEntries(entries));
      setAvgUsageLoading(false);
    };
    fetchAllAvgUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRequests.map((r) => r.id).join(",")]);

  if (!branchId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex justify-center items-center">Loading branch data
      <div className="animate-spin rounded-full text-green-500 h-8 w-8 border-t-2 border-b-2  border-green-500"></div>
    </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-3 bg-white rounded-lg shadow-md w-full mx-auto margin-100">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Material requests</h2>
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-2">
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
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild id="edit-material-request">
              <Button disabled={!!selectedItems.length || isLoading}>
                Request
              </Button>
            </DialogTrigger>
            <MaterialRequestDialog
              onOpenChange={setIsAddDialogOpen}
              refetch={refetchMaterialRequests}
              requests={(data?.material_requests ?? []).map((x) => x?.material_id)}
            />
          </Dialog>
          <Dialog
            open={isAddDialogOpenAccept}
            onOpenChange={setIsAddDialogOpenAccept}
          >
            <DialogTrigger asChild id="procurement order">
              <Button disabled={!selectedItems.length || isLoading}>
                Accept
              </Button>
            </DialogTrigger>
            <FinalizeOrderDialog
              onOpenChange={setIsAddDialogOpenAccept}
              items={
                selectedItems
                .map((id) => {
                  const req = data?.material_requests?.find(
                    (r) => r.id === id && r.status !== "supplied"
                  );
                if (!req) return null;
                    return {
                          id: req?.material_id,
                          order_id: req?.orders?.[0]?.procurement_order_id,
                          name: req?.material?.name,
                          quantity: String(req?.quantity),
                          unit: req?.material.unit,
                        };
                  })

                  .filter(Boolean) as unknown as MiniProcurementOrderItem[]
              }
              loading={loading}
              onSubmit={handleFinalizeOrder}
            />
          </Dialog>
          {/* New: Mark as Bad Button */}
          <Button
            variant="destructive"
            disabled={!selectedItems.length || isMarkBadLoading}
            onClick={handleMarkAsBad}
          >
            {isMarkBadLoading ? <div className="flex justify-center items-center">Rejecting
      <div className="animate-spin rounded-full text-green-500 h-8 w-8 border-t-2 border-b-2  border-white"></div>
    </div> : "Reject"}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <input
                  type="checkbox"
                  checked={
                    selectedItems.length ===
                      data?.material_requests?.filter(
                        (req) => !["supplied", "pending"].includes(req.status)
                      )?.length &&
                    data?.material_requests?.some(
                      (req) => !["supplied", "pending"].includes(req.status)
                    )
                  }
                  onChange={() =>
                    handleSelectAll(
                      data?.material_requests ?? [],
                      // Allow selection of "bad" status for re-approval
                      (req) => !["supplied", "pending"].includes(req.status)
                    )
                  }
                  className="h-4 w-4 disabled:cursor-not-allowed"
                  disabled={data?.material_requests?.every(
                    (req) => req.status === "supplied"
                  )}
                />
              </TableHead> 
              <TableHead>Material</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Total cost</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Avg/wk</TableHead>
              {/* <TableHead>Closing stock</TableHead> */}
            </TableRow>
          </TableHeader>
          {filteredRequests.length && !isLoading ? (
            <TableBody>
              {filteredRequests.map((material_request) => (
                <TableRow key={material_request.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={
                        selectedItems.includes(material_request.id) ||
                        ["supplied", "pending"].includes(
                          material_request.status
                        )
                      }
                      onChange={() => toggleCheck(material_request.id)}
                      className="h-4 w-4 disabled:cursor-not-allowed"
                      // Allow editing if status is "rejected" or "approved"
                      disabled={["supplied", "pending"].includes(
                        material_request.status
                      )}
                    />
                  </TableCell>
                  <TableCell>{material_request?.material?.name}</TableCell>
                  <TableCell>{material_request?.material?.unit}</TableCell>
                  <TableCell>
                    {material_request?.material?.unit_price}
                  </TableCell>
                  <TableCell>{material_request?.quantity}</TableCell>
                  <TableCell>
                    {calculateTotalCost(
                      material_request?.material?.unit_price,
                      material_request?.quantity
                    )}
                  </TableCell>
                  <TableCell className="capitalize">
                    {material_request?.user
                      ? `${capitalize(
                          `${material_request?.user?.first_name} ${material_request?.user?.last_name}`
                        )}`
                      : "N / A"}
                  </TableCell>
                  <TableCell>
                    {material_request?.branch?.name ?? "N / A"}
                  </TableCell>
                  <TableCell>
                    <Badge status={material_request?.status}>
                      {material_request?.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(
                      new Date(material_request.created_at),
                      "MMM d, yyyy h:mm a"
                    )}
                  </TableCell>
                  <TableCell>
                    {avgUsageLoading ? (
                      <div className="flex justify-center items-center">Loading
      <div className="animate-spin rounded-full text-green-500 h-8 w-8 border-t-2 border-b-2  border-green-500"></div>
    </div>
                    ) : avgUsageMap[material_request.id] ? (
                      avgUsageMap[material_request.id].toFixed(2)
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  {/* <TableCell
                    style={{
                      color:
                        material_request.material?.inventory[0]?.closing_stock <
                        material_request.material?.minimum_stock
                          ? "red"
                          : "green",
                    }}
                  >
                    {material_request?.material?.inventory[0]?.closing_stock}
                  </TableCell> */}
                </TableRow>
              ))}
            </TableBody>
          ) : !filteredRequests.length && !isLoading ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No current material requests
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                 <div className="flex justify-center items-center">Loading
      <div className="animate-spin rounded-full text-green-500 h-8 w-8 border-t-2 border-b-2  border-green-500"></div>
    </div>
                </TableCell>
              </TableRow>
            </TableBody>
          )}
        </Table>
      </div>
      <PaginationComponent
        className="justify-end"
        page={page}
        setPage={setPage}
        hasNextPage={data?.hasNextPage || false}
      />
    </div>
  );
};

export default MaterialRequest;
