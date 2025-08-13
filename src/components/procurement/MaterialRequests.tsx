import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Edit2Icon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCheck } from "@/hooks/use-check";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { EditRequestDialog } from "../ui/edit-request";
import type { EditRequestFormValues } from "@/types/edit-request";
import PaginationComponent from "@/components/pagination";
import { PAGE_LIMIT } from "@/constants";
import { MaterialRequest } from "@/types/material_request";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Helper to get the start and end ISO strings for the selected timeframe
const getTimeframeRange = (timeframe: "weekly" | "monthly" | "yearly") => {
  const now = new Date();
  let start: Date, end: Date;

  if (timeframe === "weekly") {
    // Week starts on Monday
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    start = new Date(now);
    start.setDate(now.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (timeframe === "monthly") {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    // yearly
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

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

const MaterialRequests = () => {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const {
    selectedItems,
    setSelectedItems,
    toggleCheck,
    resetCheck,
    handleSelectAll,
  } = useCheck();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Add timeframe state
  const [timeframe, setTimeframe] = useState<"weekly" | "monthly" | "yearly">(
    "weekly"
  );

  const [currentQtyMap, setCurrentQtyMap] = useState<Record<string, number>>({});
  const [currentQtyLoading, setCurrentQtyLoading] = useState(false);

  

  // State for average usage
  const [avgUsageMap, setAvgUsageMap] = useState<Record<string, number>>({});
  const [avgUsageLoading, setAvgUsageLoading] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["material-requests", page, timeframe],
    queryFn: async () => {
      const from = (page - 1) * PAGE_LIMIT;
      const to = from + PAGE_LIMIT - 1;

      // Get date range for selected timeframe
      const { start, end } = getTimeframeRange(timeframe);

      const { data, error, count } = await supabase
        .from("material_requests")
        .select(
          `
          *,
          material:materials(*),
          orders:procurement_order_items_material_request_id_fkey(procurement_order_id),
          branch:branches(*),
          user:user_id(first_name, last_name)
        `,
          { count: "exact" }
        )
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return {
        requests: data as MaterialRequest[],
        hasNextPage: count ? to + 1 < count : false,
      };
    },
    placeholderData: (prevData) => prevData,
  });

  useEffect(() => {
    const fetchCurrentQuantities = async () => {
      if(!data?.requests?.length) return;
      setCurrentQtyLoading(true);

      //get unique materials
      const pairs = data.requests.map((req) => ({
        material_id: req.material_id,
        branch_id: req.branch_id,
        request_id: req.id,
      }));

      //Fetch summary data for pairs
      const { data: summaryRows, error } = await supabase
      .from("branch_material_today_view")
      .select("*")
      .in( "material_id", pairs.map((p) => p.material_id))
      .in("branch_id", pairs.map((p) => p.branch_id));

      //Map materials to summary view
      const summaryMap: Record<string, any> = {};
      summaryRows?.forEach((row) => {
        summaryMap[`${row.material_id}_${row.branch_id}`] = row;
      });

      //Calculate current quantities
      const qtyEntries = pairs.map((p) => {
        const item = summaryMap[`${p.material_id}_${p.branch_id}`] || {};
        const currentQuantity = 
        (item.total_quantity ?? 0) +
        (item.opening_stock ?? 0) +
        (item.total_procurement_quantity ?? 0) +
        (item.total_transfer_in_quantity ?? 0) -
        (item.total_transfer_out_quantity ?? 0) -
        (item.total_usage ?? 0) -
        (item.total_damage_quantity ?? 0);
        return [p.request_id, currentQuantity];
      });

      setCurrentQtyMap(Object.fromEntries(qtyEntries));
      setCurrentQtyLoading(false);
     };
     fetchCurrentQuantities();
  }, [data?.requests?.map((r) => r.id).join(",")]);

  // Fetch average weekly usage for all requests on this page
  useEffect(() => {
    const fetchAllAvgUsage = async () => {
      if (!data?.requests?.length) return;
      setAvgUsageLoading(true);
      const entries = await Promise.all(
        data.requests.map(async (req) => {
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
  }, [data?.requests?.map((r) => r.id).join(",")]);

  const handleEditRequest = async (values: EditRequestFormValues) => {
    try {
      setLoading(true);

      // Ensure we only update items with valid quantities
      const itemsToUpdate = values.items
        .filter((item) => item.quantity && !isNaN(Number(item.quantity)))
        .map((item) => ({
          id: item.id,
          quantity: Number(item.quantity),
        }));

      if (itemsToUpdate.length === 0) {
        toast({
          title: "No Changes",
          description: "No valid quantity updates were provided.",
        });
        return;
      }

      // Sequentially update each record
      for (const item of itemsToUpdate) {
        const { error } = await supabase
          .from("material_requests")
          .update({ quantity: item.quantity })
          .eq("id", item.id);

        if (error) {
          throw new Error(`Failed to update request ${item.id}`);
        }
      }

      toast({
        title: "Success",
        description: `You have successfully updated ${
          itemsToUpdate.length > 1 ? "requests" : "request"
        }.`,
      });

      await refetch();
      setIsAddDialogOpen(false);
      resetCheck();
    } catch (error) {
      console.error(
        `Error updating ${values.items?.length > 1 ? "requests" : "request"}:`,
        error
      );
      toast({
        title: "Error",
        description: `Failed to update ${
          values.items?.length > 1 ? "requests" : "request"
        }.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProcurementOrder = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one request",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      // Create procurement order
      const { data: updatedOrders, error: updateMRError } = await supabase
        .from("material_requests")
        .update({ status: "approved" })
        .in("id", selectedItems)
        .select();

      if (updateMRError) throw updateMRError;

      // Now, fetch the newly inserted procurement orders
      const { data: newProcurementOrders, error: procurementError } =
        await supabase
          .from("procurement_orders")
          .insert(
            updatedOrders?.map((uo) => ({
              material_request_id: uo?.id,
              status: uo?.status,
              material_id: uo?.material_id,
              quantity: uo?.quantity,
              branch_id: uo?.branch_id,
            }))
          )
          .select();

      if (procurementError) throw procurementError;

      // Create procurement order items
      const { error: itemsError } = await supabase
        .from("procurement_order_items")
        .insert(
          selectedItems.map((requestId) => ({
            procurement_order_id: newProcurementOrders.find(
              (x) => x?.material_request_id === requestId
            )?.id,
            material_request_id: requestId,
          }))
        );

      if (itemsError) throw itemsError;

      // Create notifications for branches
      const notifications = data?.requests
        ?.filter((req) => selectedItems.includes(req.id))
        .map((req) => ({
          branch_id: req.branch_id,
          title: "Material Request Approved",
          message: `Your request for ${req.material?.name} has been approved`,
        }));

      if (notifications?.length) {
        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (notificationError) throw notificationError;
      }

      toast({
        title: "Success",
        description: "Procurement order created successfully",
      });

      setSelectedItems([]);
      refetch();
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Pending Material Requests</h2>
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild id="material damage">
              <Button disabled={selectedItems.length === 0 || loading}>
                <Edit2Icon className="mr-2 h-4 w-4" />
                Edit request
              </Button>
            </DialogTrigger>
            <EditRequestDialog
              onOpenChange={setIsAddDialogOpen}
              items={data?.requests
                ?.filter((x) => selectedItems?.includes(x?.id))
                ?.map((x) => ({
                  id: x.id,
                  name: x.material?.name,
                  quantity: String(x.quantity),
                  unit: x.material?.unit,
                }))}
              handleEditRequest={handleEditRequest}
              loading={loading}
            />
          </Dialog>
          <Button
            onClick={handleCreateProcurementOrder}
            disabled={selectedItems.length === 0 || loading}
          >
            Approve Order
          </Button>
        </div>
      </div>

      {/* Time period filter */}
      <div className="mb-4 flex items-center gap-4">
        <Select
          value={timeframe}
          onValueChange={(value) =>
            setTimeframe(value as "weekly" | "monthly" | "yearly")
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Time Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">This Week</SelectItem>
            <SelectItem value="monthly">This Month</SelectItem>
            <SelectItem value="yearly">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="w-4 text-center text-bold bg-gray-100">
            <TableHead >
              <input
                type="checkbox"
                checked={selectedItems?.length === data?.requests?.length}
                onChange={() =>
                  handleSelectAll(
                    data?.requests ?? [],
                    (req) => req.status === "pending"
                  )
                }
                className="h-4 w-4"
              />
            </TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Current</TableHead>
            <TableHead>Avg/wk</TableHead>
            <TableHead>Request</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        {data?.requests?.length && !isLoading ? (
          <TableBody>
            {data?.requests?.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(request.id)}
                    onChange={() => toggleCheck(request.id)}
                    className="h-4 w-4"
                    // Only allow selection for "pending" and "rejected" items
                    disabled={!["pending", "rejected"].includes(request.status)}
                  />
                </TableCell>
                <TableCell>{request.material?.name}</TableCell>
                <TableCell>{request.branch?.name}</TableCell>
                <TableCell>{currentQtyLoading
    ? <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-400"></div>
      </div>
    : currentQtyMap[request.id] !== undefined
    ? currentQtyMap[request.id].toFixed(2)
    : "N/A"}</TableCell>
                <TableCell>
                  {avgUsageLoading
                    ? <div className="flex justify-center items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2  border-green-500"></div>
    </div>
                    : avgUsageMap[request.id] !== undefined
                    ? avgUsageMap[request.id].toFixed(2)
                    : "N/A"}
                </TableCell>
                <TableCell>
                  {request.quantity} {request.material?.unit}
                </TableCell>
                <TableCell>
                  <Badge status={request.status}>{request.status}</Badge>
                </TableCell>
                <TableCell>
                  {new Date(request.created_at).toLocaleDateString()}
                </TableCell>
                
              </TableRow>
            ))}
          </TableBody>
        ) : !data?.requests?.length && !isLoading ? (
          <TableBody>
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                No current material requests
              </TableCell>
            </TableRow>
          </TableBody>
        ) : (
          <TableBody>
            <TableRow>
              <TableCell colSpan={7} className="text-center">
               <div className="flex justify-center items-center">Loading... Please wait
      <div className="animate-spin rounded-full text-green-500 h-8 w-8 border-t-2 border-b-2  border-green-500"></div>
    </div>
              </TableCell>
            </TableRow>
          </TableBody>
        )}
      </Table>
      <PaginationComponent
        className="justify-end"
        page={page}
        setPage={setPage}
        hasNextPage={data?.hasNextPage || false}
      />
    </div>
  );
};

export default MaterialRequests;
