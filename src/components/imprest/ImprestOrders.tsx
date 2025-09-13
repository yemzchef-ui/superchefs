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
import type { ImprestOrder } from "@/types/imprest";
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

function getTimeframeRange(timeframe: "weekly" | "monthly" | "yearly") {
  const now = new Date();
  let start: Date;
  let end: Date = new Date(now);

  if (timeframe === "weekly") {
    // Monday as the first day of the week
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day; // Sunday (0) => -6, Monday (1) => 0, etc.
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
}

const ImprestOrders = () => {
  const printRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"supplied" | "approved">(
    "supplied"
  );
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

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "imprest-orders",
      page,
      statusFilter,
      timeframe,
      selectedBranchId,
    ],
    queryFn: async () => {
      const from = (page - 1) * PAGE_LIMIT;
      const to = from + PAGE_LIMIT - 1;

      let query = supabase
        .from("imprest_orders")
        .select(
          `
          *,
          items:imprest_order_items (
            *,
            imprest:imprest_requests (
              id, name, quantity, unit, unit_price,
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
      if (selectedBranchId) {
        query = query.eq("branch_id", selectedBranchId);
      }

      const { start, end } = getTimeframeRange(timeframe);
      query = query.gte("created_at", start).lte("created_at", end);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        orders: data as unknown as ImprestOrder[],
        hasNextPage: count ? to + 1 < count : false,
      };
    },
    placeholderData: (prevData) => prevData,
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Imprest Orders",
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
        description: "Print completed successfully",
      });
    },
  });

  const loading = isLoading || isFetching;

  return (
    <div className="space-y-4 bg-white p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Imprest Orders</h2>
        <div className="flex justify-between items-center space-x-4">
          <Button onClick={() => handlePrint()}>Print Orders</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        {/* Radio Buttons for Status */}
        <RadioGroup
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as "supplied" | "approved")
          }
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="supplied" id="supplied" disabled={loading} />
            <label htmlFor="supplied" className="text-sm font-medium">
              Supplied
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="approved" id="approved" disabled={loading} />
            <label htmlFor="approved" className="text-sm font-medium">
              Approved
            </label>
          </div>
        </RadioGroup>

        {/* Select for Time Period */}
        <Select
          value={timeframe}
          onValueChange={(value) =>
            setTimeframe(value as "weekly" | "monthly" | "yearly")
          }
          disabled={loading}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Time Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">This week</SelectItem>
            <SelectItem value="monthly">This month</SelectItem>
            <SelectItem value="yearly">This year</SelectItem>
          </SelectContent>
        </Select>

        {/* Select for Branch */}
        <Select
          value={selectedBranchId || "all"}
          onValueChange={(value) =>
            setSelectedBranchId(value === "all" ? "" : value)
          }
          disabled={loading}
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

      <div ref={printRef}>
        {(data?.orders?.length ?? 0) > 0 && (
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
                {`₦${data.orders
                  .reduce((orderAcc, order) => {
                    return (
                      orderAcc +
                      order.items.reduce((itemAcc, item) => {
                        return (
                          itemAcc +
                          item.imprest.quantity * item.imprest.unit_price
                        );
                      }, 0)
                    );
                  }, 0)
                  .toLocaleString("en-US", {
                    minimumSignificantDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
              </p>
              <p>{data.orders[0]?.items[0]?.imprest?.branch?.name || "N/A"}</p>
            </div>

            <div className="w-full flex gap-4 justify-start">
              <p>{data.orders[0]?.items[0]?.imprest?.branch?.phone || "N/A"}</p>
              <p>
                {data.orders[0]?.items[0]?.imprest?.branch?.manager || "N/A"}
              </p>
            </div>

            <div className="w-full flex gap-4 justify-start">
              {/* <h1>{new Date().toLocaleTimeString()}</h1> */}
              
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
              {data.orders.map((order) =>
                order.items.map((item, idx) => (
                  <TableRow key={order.id + "-" + idx}>
                    <TableCell>{order.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Badge status={order.status}>{order.status}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {item.imprest?.name}
                    </TableCell>
                    <TableCell>
                      {item.imprest?.quantity} {item.imprest?.unit}
                    </TableCell>
                    <TableCell>
                      ₦
                      {(
                        (item.imprest?.quantity || 0) *
                        (item.imprest?.unit_price || 0)
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>{item.imprest?.branch?.name}</TableCell>
                    <TableCell>
                      {new Date(order.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          ) : (
            <TableBody>
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  {loading ? <div className="flex justify-center items-center">Loading... Please wait
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2  border-green-500"></div>
    </div> : "No imprest orders found."}
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

export default ImprestOrders;
