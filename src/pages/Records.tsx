import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Edit3Icon } from "lucide-react";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner"; // or your preferred toast lib

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

type EditRecordState = {
  open: boolean;
  record: RecordItem | null;
};

export default function Records() {
  const userBranch = useUserBranch();
  const [branchFilter, setBranchFilter] = useState<string | null>(
    userBranch.data?.name === "HEAD OFFICE" ? null : userBranch.data?.id || null
  );
  const [dateFilter, setDateFilter] = useState("today");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editState, setEditState] = useState<EditRecordState>({
    open: false,
    record: null,
  });
  const [newQuantity, setNewQuantity] = useState<number | "">("");

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
        startDate = startOfDay(
          new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        );
        break;
      case "last_30_days":
        startDate = startOfDay(
          new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        );
        break;
      case "last_365_days":
        startDate = startOfDay(
          new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        );
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

  const updateRecordMutation = useMutation({
    mutationFn: async ({
      id,
      type,
      quantity,
    }: {
      id: string;
      type: string;
      quantity: number;
    }) => {
      const { error } = await supabase
        .from("records_view")
        .update({ quantity })
        .eq("id", id)
        .eq("type", type);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Quantity updated!");
      setEditState({ open: false, record: null });
      setNewQuantity("");
      // Refetch records
      refetch();
    },
    onError: (err: any) => {
      toast.error("Failed to update quantity");
    },
  });

  const {
    data: records,
    isLoading,
    refetch,
  } = useQuery<RecordItem[], Error>({
    queryKey: ["records", branchFilter, dateFilter, typeFilter],
    queryFn: fetchRecords,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name");
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
            <Select onValueChange={setDateFilter} value={dateFilter}>
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

            <Select onValueChange={setTypeFilter} value={typeFilter}>
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
            <h2 className=" font-bold text-2xl">
              ₦
              {records
                ?.reduce((acc, record) => acc + record.cost, 0)
                .toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
            </h2>
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
                  <TableHead>UPDATE</TableHead> {/* New column */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <div className="flex justify-center items-center">
                        Loading...
                        <div className="animate-spin rounded-full text-green-500 h-8 w-8 border-t-2 border-b-2  border-green-500">
                          {" "}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : records && records.length > 0 ? (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.name}</TableCell>
                      <TableCell className="capitalize">
                        {record.type}
                      </TableCell>
                      <TableCell>{record.quantity}</TableCell>
                      <TableCell>{record.branch}</TableCell>
                      <TableCell>
                        {format(new Date(record.date), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell>{record.cost}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={userBranch.data?.name !== "HEAD OFFICE"}
                          onClick={() => {
                          setEditState({ open: true, record });
                          setNewQuantity(record.quantity);
                          }}
                        >
                          <Edit3Icon />
                        </Button>
                      </TableCell>
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

      {/* Edit Quantity Dialog */}
      <Dialog
        open={editState.open}
        onOpenChange={(open) =>
          setEditState({ open, record: open ? editState.record : null })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Quantity</DialogTitle>
          </DialogHeader>
          {editState.record && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (typeof newQuantity === "number" && editState.record) {
                  updateRecordMutation.mutate({
                    id: editState.record.id,
                    type: editState.record.type,
                    quantity: newQuantity,
                  });
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium">Item Name</label>
                <div className="border rounded px-2 py-1">
                  {editState.record.name}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Type</label>
                <div className="border rounded px-2 py-1 capitalize">
                  {editState.record.type}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Old Quantity
                </label>
                <div className="border rounded px-2 py-1">
                  {editState.record.quantity}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Timestamp</label>
                <div className="border rounded px-2 py-1">
                  {format(
                    new Date(editState.record.date),
                    "MMM d, yyyy h:mm a"
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">
                  New Quantity
                </label>
                <Input
                  type="number"
                  value={newQuantity}
                  min={0}
                  onChange={(e) => setNewQuantity(Number(e.target.value))}
                  required
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditState({ open: false, record: null })}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateRecordMutation.isPending}>
                  {updateRecordMutation.isPending ? (
              <div className="flex justify-center items-center">
                Updating...
                <div className="animate-spin rounded-full text-green-500 h-8 w-8 border-t-2 border-b-2 border-white"></div>
              </div>
            ) : (
              "Update"
            )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
