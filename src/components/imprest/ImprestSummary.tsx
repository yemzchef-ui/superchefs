import { useRef, useState, useMemo } from "react";
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
import PaginationComponent from "@/components/pagination";

const PAGE_LIMIT = 1000;

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

interface BranchImprestSummary {
  branch_id: string;
  total_cost: number;
}

export const ImprestSummary = () => {
  const printRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  // Fetch weekly imprest summary
  const { start, end } = getCurrentWeekRange();

  // Fetch all branches for lookup
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("branches")
        .select("id, name, manager");
      return data || [];
    },
  });

  // Fetch imprest_supplied for all branches for the week
  const { data, isLoading } = useQuery<{
    items: BranchImprestSummary[];
    hasNextPage: boolean;
  }>({
    queryKey: ["imprest_supplied_branch_summary", page, start, end],
    queryFn: async () => {
      const from = (page - 1) * PAGE_LIMIT;
      const to = from + PAGE_LIMIT - 1;

      const { data, error, count } = await supabase
        .from("imprest_supplied")
        .select(
          `
            branch_id,
            cost
          `,
          { count: "exact" }
        )
        .gte("created_at", start)
        .lte("created_at", end);

      if (error) throw error;

      // Group by branch_id and sum cost
      const summaryMap: { [id: string]: BranchImprestSummary } = {};
      (data || []).forEach((row) => {
        const branchId = row.branch_id || "unknown";
        if (!summaryMap[branchId]) {
          summaryMap[branchId] = {
            branch_id: branchId,
            total_cost: 0,
          };
        }
        summaryMap[branchId].total_cost += Number(row.cost) || 0;
      });

      const items = Object.values(summaryMap);

      return {
        items: items.slice(from, to + 1),
        hasNextPage: count ? to < count : false,
      };
    },
    placeholderData: (previousData) => previousData,
  });

  // Build branch lookup map
  const branchMap = useMemo(() => {
    const map: Record<string, { name: string; manager: string }> = {};
    (branchesData || []).forEach((b: any) => {
      map[b.id] = { name: b.name, manager: b.manager };
    });
    return map;
  }, [branchesData]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Weekly Imprest Branch Summary",
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

  return (
    <div className="space-y-4 bg-white p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <h2 className="text-2xl font-semibold">Weekly Imprest</h2>
          <p className="text-sm text-gray-500">
            {`${new Date(start).toLocaleDateString()} - ${new Date(
              end
            ).toLocaleDateString()}`}
          </p>
        </div>
        <Button onClick={() => handlePrint()}>Print</Button>
      </div>

      <div ref={printRef}>
        <h2 className="text-lg font-semibold bg-gray-200 p-4 rounded-md shadow-sm">
          Total Cost:{" "}
          {`₦${data?.items
            ?.reduce((acc, item) => acc + (item.total_cost || 0), 0)
            .toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
        </h2>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch Name</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Total Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                 <div className="flex justify-center items-center">Loading... Please wait
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2  border-green-500"></div>
    </div>
                </TableCell>
              </TableRow>
            ) : data?.items && data.items.length > 0 ? (
              data.items.map((item) => (
                <TableRow key={item.branch_id}>
                  <TableCell>
                    {branchMap[item.branch_id]?.name || item.branch_id}
                  </TableCell>
                  <TableCell>
                    {branchMap[item.branch_id]?.manager || "n/a"}
                  </TableCell>
                  <TableCell>
                    ₦
                    {Number(item.total_cost).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  No imprests found for this week.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
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

export default ImprestSummary;
