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
import PaginationComponent from "@/components/pagination";

const PAGE_LIMIT = 1000;

interface Material {
  name: string;
  unit_price: number;
}

interface CumulativeMaterialRequest {
  material_id: string;
  total_quantity: number;
  total_requests: number;
  materials: Material | Material[];
}

export const PoSummary = () => {
  const printRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  // Fetch cumulative material requests (no time period filter)
  const { data, isLoading } = useQuery<{
    materials: CumulativeMaterialRequest[];
    hasNextPage: boolean;
  }>({
    queryKey: ["cumulative_material_requests_view", page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_LIMIT;
      const to = from + PAGE_LIMIT - 1;

      let query = supabase
        .from("cumulative_material_requests_view")
        .select(
          `
          material_id,
          total_quantity,
          total_requests,
          materials (
            name,
            unit_price
          )
        `,
          { count: "exact" }
        )
        .order("total_quantity", { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        materials: data as CumulativeMaterialRequest[],
        hasNextPage: count ? to < count : false,
      };
    },
    placeholderData: (previousData) => previousData,
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Procurement Orders Summary",
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
    <div className="space-y-4 bg-white p-4 rounded-lg shadow-md w-full mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Procurement Orders Summary</h2>
        <Button onClick={() => handlePrint()}>Print Orders</Button>
      </div>

      <div ref={printRef}>
        <h2 className="text-lg font-semibold bg-gray-200 p-4 rounded-md shadow-sm">
          Total Cost:{" "}
          {`₦${data?.materials
            ?.reduce((acc, material) => {
              const quantity = material.total_quantity || 0;
              const price = Array.isArray(material.materials)
                ? material.materials[0]?.unit_price || 0
                : material.materials?.unit_price || 0;

              return acc + quantity * price;
            }, 0)
            .toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
        </h2>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material Name</TableHead>
               <TableHead>Total Requests</TableHead>
              <TableHead>Total Quantity</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                 <div className="flex justify-center items-center">Loading...
      <div className="animate-spin rounded-full text-green-500 h-8 w-8 border-t-2 border-b-2  border-green-500"></div>
    </div>
                </TableCell>
              </TableRow>
            ) : data?.materials && data.materials.length > 0 ? (
              data.materials.map((material) => (
                <TableRow key={material.material_id}>
                  <TableCell>
                    {Array.isArray(material.materials)
                      ? material.materials[0]?.name || "N/A"
                      : material.materials?.name || "N/A"}
                  </TableCell>
                  <TableCell>{material.total_requests || 0}</TableCell>
                  <TableCell>{material.total_quantity || 0}</TableCell>
                  <TableCell>
                    ₦
                    {(Array.isArray(material.materials)
                      ? material.materials[0]?.unit_price || 0
                      : material.materials?.unit_price || 0 
                    ).toFixed(2)}
                  </TableCell>
                  <TableCell >
                    ₦
                    {(
                      (material.total_quantity || 0) *
                      (Array.isArray(material.materials)
                        ? material.materials[0]?.unit_price || 0
                        : material.materials?.unit_price || 0)
                    ).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  No materials found.
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

export default PoSummary;
