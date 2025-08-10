import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useUserBranch } from "@/hooks/user-branch";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay } from "date-fns";

const DATE_FILTERS = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "last_7_days" },
  { label: "Last 30 Days", value: "last_30_days" },
  { label: "Last 365 Days", value: "last_365_days" },
];

const RECORD_TYPES = [
  { label: "All Types", value: "all" },
  { label: "Production", value: "production" },
  { label: "Sales", value: "sales" },
  { label: "Material Damages", value: "mat_damages" },
  { label: "Product Damages", value: "prod_damages" },
  { label: "Material Transfers", value: "mat_transfers" },
  { label: "Product Transfers", value: "prod_transfers" },
  { label: "Complimentary", value: "complimentary" },
];

type RecordItem = {
  id: string;
  name: string;
  quantity: number;
  branch: string;
  date: string;
  type: string;
  cost: number;
};

export default function Records() {
  const userBranch = useUserBranch();
  const [branchFilter, setBranchFilter] = useState<string | null>(
    userBranch.data?.name === "HEAD OFFICE" ? null : userBranch.data?.id || null
  );
  const [dateFilter, setDateFilter] = useState("today");
  const [typeFilter, setTypeFilter] = useState("all");

 const getStartDate = () => {
  const now = new Date();
  let startDate: Date;

  switch (dateFilter) {
    case "today":
      startDate = startOfDay(now);
      break;
    case "yesterday":
      startDate = startOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
      break;
    case "last_7_days":
      startDate = startOfDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      break;
    case "last_30_days":
      startDate = startOfDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
      break;
    case "last_365_days":
      startDate = startOfDay(new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000));
      break;
    default:
      return null;
  }
  return new Date(startDate.toLocaleString()); // Converts to local time
};

  const fetchRecords = async () => {
    const startDate = getStartDate();
    const query = supabase
      .from("records_view") 
      .select("*")
      .not("name", "is", null);

    if (startDate) {
      query.gte("date", startDate.toISOString());
    }

    if (branchFilter) {
      query.eq("branch_id", branchFilter);
    }

    if (typeFilter !== "all") {
      query.eq("type", typeFilter);
    }

    const { data, error } = await query.order("date", { ascending: false });

    if (error) throw error;
    console.log("Fetched Records:", data);
    return data;
  };

  const { data: records, isLoading } = useQuery<RecordItem[], Error>({
    queryKey: ["records", branchFilter, dateFilter, typeFilter],
    queryFn: fetchRecords,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Records</CardTitle>
        </CardHeader>
        
        <CardContent>
          
          <div className="flex justify-between flex-wrap gap-4 mb-4">
            <Select
              onValueChange={setDateFilter}
              value={dateFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                {DATE_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {userBranch.data?.name === "HEAD OFFICE" && (
              <Select
                onValueChange={setBranchFilter}
                value={branchFilter || "all"}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              onValueChange={setTypeFilter}
              value={typeFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {RECORD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <h2 className=" font-bold text-2xl">₦{records?.reduce((acc, record) => acc + record.cost, 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}</h2>
          </div>
          

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ITEM</TableHead>
                  <TableHead>TYPE</TableHead>
                  <TableHead>QTY</TableHead>
                  <TableHead>BRANCH</TableHead>
                  <TableHead>DATE</TableHead>
                  <TableHead>AMOUNT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                        <div className="flex justify-center items-center">
                      Loading...
                       <div className="animate-spin rounded-full text-green-500 h-8 w-8 border-t-2 border-b-2  border-green-500"> </div>

                       </div>
                    </TableCell>
                  </TableRow>
                ) : records && records.length > 0 ? (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.name}</TableCell>
                      <TableCell className="capitalize">{record.type}</TableCell>
                      <TableCell>{record.quantity}</TableCell>
                      <TableCell>{record.branch}</TableCell>
                      <TableCell>{format(new Date(record.date), "MMM d, yyyy h:mm a")}</TableCell>
                      <TableCell>{record.cost}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No records found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}