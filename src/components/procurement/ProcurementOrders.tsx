import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import PaginationComponent from "@/components/pagination";
import { PAGE_LIMIT } from "@/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface ProcurementOrderItem {
  id: string;
  material_request: {
    quantity: number;
    material: {
      id: string;
      name: string;
      unit: string;
      unit_price: number;
    };
    branch: {
      id: string;
      name: string;
    };
  };
}

export interface MiniProcurementOrderItem {
  id: string;
  order_id: string;
  quantity: string;
  name: string;
  unit: string;
}

export interface ProcurementOrder {
  id: string;
  status: "pending" | "supplied" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
  items: ProcurementOrderItem[];
}

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

const ProcurementOrders = () => {
  const printRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<
    "supplied" | "approved" | "rejected"
  >("supplied");
  const [timeframe, setTimeframe] = useState<"weekly" | "monthly" | "yearly">(
    "weekly"
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // Fetch branches
  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Fetch procurement orders
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "procurement-orders",
      page,
      statusFilter,
      timeframe,
      selectedBranchId,
    ],
    queryFn: async () => {
      const from = (page - 1) * PAGE_LIMIT;
      const to = from + PAGE_LIMIT - 1;

      let query = supabase
        .from("procurement_orders")
        .select(
          `
          *,
          items:procurement_order_items(
            material_request:material_requests(quantity, 
              material:materials(id, name, unit, unit_price),
              branch:branches(id, name, address, manager, phone)
            )
          )
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(from, to)
        .eq("status", statusFilter);

      // Filter by branch if a branch is selected
      if (selectedBranchId && selectedBranchId !== "SELECT") {
        query = query.eq("branch_id", selectedBranchId);
      }

      // Filter by time period
      const { start, end } = getTimeframeRange(timeframe);
      query = query.gte("created_at", start).lte("created_at", end);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        orders: data,
        hasNextPage: count ? to + 1 < count : false,
      };
    },
    placeholderData: (previousData) => previousData,
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Procurement Orders",
    onBeforePrint: () => {
      if (!printRef.current) {
        toast({
          title: "Error",
          description: "Print content not ready",
          variant: "destructive",
        });
        return Promise.reject();
      }
      return Promise.resolve();
    },
    onPrintError: () => {
      toast({
        title: "Error",
        description: "Failed to print",
        variant: "destructive",
      });
    },
    onAfterPrint: () => {
      toast({
        title: "Success",
        description: "Print completed",
      });
    },
  });

  const loading = isLoading || isFetching;

  return (
    <div className="space-y-4 bg-white p-6 rounded-lg shadow-md w-full mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Procurement Orders</h2>
        <div className="flex justify-between items-center space-x-4">
          <Button onClick={() => handlePrint()}>Print Orders</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        {/* Radio Buttons for Status */}
        <RadioGroup
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as "supplied" | "approved" | "rejected")
          }
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="supplied" id="supplied" />
            <label htmlFor="supplied" className="text-sm font-medium">
              Supplied
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="approved" id="approved" />
            <label htmlFor="approved" className="text-sm font-medium">
              Approved
            </label>
          </div>
          {/* New: Rejected status filter */}
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="rejected" id="rejected" />
            <label htmlFor="rejected" className="text-sm font-medium">
              Rejected
            </label>
          </div>
        </RadioGroup>

        {/* Select for Time Period */}
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

        {/* Select for Branch */}
        <Select
          value={selectedBranchId}
          onValueChange={(value) => setSelectedBranchId(value)}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="SELECT BRANCH" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SELECT">SELECT BRANCH</SelectItem>
            {branches?.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div ref={printRef}>
        {data?.orders?.length > 0 && (
            <div className="flex flex-col mb-4 gap-4 bg-green-100 p-4 rounded-md shadow-sm overflow-x-auto relative">
            {/* Logo positioned top right */}
            <img
              src="/superchefs-logo.png"
              alt="SuperChefs Logo"
              className="w-10 h-10 absolute top-4 right-4"
              style={{ zIndex: 10 }}
            />

            <div className="w-full flex gap-4 justify-start items-center">
              <p className="text-xl font-bold">
              {`₦${data?.orders
                ?.reduce((orderAcc, order) => {
                return (
                  orderAcc +
                  order.items.reduce((itemAcc: number, item: { material_request: { quantity: number; material: { unit_price: number; }; }; }) => {
                  return (
                    itemAcc +
                    item.material_request.quantity *
                    item.material_request.material.unit_price
                  );
                  }, 0)
                );
                }, 0)
                .toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                }) || "₦0.00"}`}
              </p>
              <p>
              {data?.orders[0]?.items[0]?.material_request?.branch?.name ||
                "N/A"}
              </p>
            </div>

            <div className="w-full flex gap-4 justify-start">
              <p>{new Date().toLocaleDateString()}</p>
              <p>
              {data?.orders[0]?.items[0]?.material_request?.branch?.manager ||
                "N/A"}
              </p>
            </div>

            <div className="w-full flex gap-4 justify-start">
              <h1>{new Date().toLocaleTimeString()}</h1>
              <p>
              {data?.orders[0]?.items[0]?.material_request?.branch?.phone ||
                "N/A"}
              </p>
            </div>

            <div className="w-full flex gap-4 justify-start">
              {data?.orders[0]?.items[0]?.material_request?.branch?.address ||
              "N/A"}
            </div>
            </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          {data?.orders?.length && !loading ? (
            <TableBody>
              {data.orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>{order.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge status={order.status}>{order.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {order.items[0]?.material_request?.material?.name}
                  </TableCell>
                  <TableCell>
                    {order.items[0]?.material_request?.quantity}{" "}
                    {order.items[0]?.material_request?.material?.unit}
                  </TableCell>
                  <TableCell>
                    ₦
                    {(
                      order.items[0]?.material_request?.quantity *
                      order.items[0]?.material_request?.material?.unit_price
                    ).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {order.items[0]?.material_request?.branch?.name}
                  </TableCell>
                  <TableCell>
                    {new Date(order.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          ) : (
            <TableBody>
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  {loading ? <div className="flex justify-center items-center">Loading... Please wait
      <div className="animate-spin rounded-full text-green-500 h-8 w-8 border-t-2 border-b-2  border-green-500"></div>
    </div> : "No procurement orders found."}
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

export default ProcurementOrders;
