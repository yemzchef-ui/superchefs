import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectContent,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Trash2 } from "lucide-react";
import { useUserBranch } from "@/hooks/user-branch";

interface InsertProductQuantityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: { id: string; name: string }[];
  products: { id: string; name: string }[];
  onSuccess: () => void;
}

interface ProductField {
  product_id: string;
  quantity: number | "";
}

const InsertProductQuantityDialog = ({
  open,
  onOpenChange,
  branches,
  products,
  onSuccess,
}: InsertProductQuantityDialogProps) => {
  const { data: userBranch } = useUserBranch() as {
    data: { id: string; name: string } | null;
  };
  const isHeadOffice = userBranch?.name === "HEAD OFFICE";
  const [selectedBranch, setSelectedBranch] = useState<string>(
    isHeadOffice ? "" : userBranch?.id || ""
  );
  const [productFields, setProductFields] = useState<ProductField[]>([
    { product_id: "", quantity: "" },
  ]);
  const { toast } = useToast();

  const addProductField = () => {
    setProductFields([...productFields, { product_id: "", quantity: "" }]);
  };

  const removeProductField = (index: number) => {
    setProductFields(productFields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (
    index: number,
    field: keyof ProductField,
    value: string | number
  ) => {
    const updatedFields = [...productFields];
    updatedFields[index][field] = value as never;
    setProductFields(updatedFields);
  };

  const handleSubmit = async () => {
  if (!selectedBranch) {
    toast({
      title: "Error",
      description: "Please select a branch",
      variant: "destructive",
    });
    return;
  }

  if (
    productFields.some(
      (field) =>
        !field.product_id || field.quantity === "" || Number(field.quantity) < 0
    )
  ) {
    toast({
      title: "Error",
      description: "Please fill all fields correctly with valid quantities",
      variant: "destructive",
    });
    return;
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0]; // e.g., "2025-04-05"

  for (const field of productFields) {
    const { product_id, quantity } = field;

    // Step 1: Query for any record with matching branch_id, product_id, and today's date
    const { data: existingRecords, error: fetchError } = await supabase
  .from("product_inventory")
  .select("id, quantity, updated_at")
  .eq("branch_id", selectedBranch)
  .eq("product_id", product_id)
  .gte("updated_at", `${today}T00:00:00Z`)
  .lt("updated_at", `${today}T23:59:59Z`);

if (fetchError) {
  toast({
    title: "Error checking today's record",
    description: fetchError.message,
    variant: "destructive",
  });
  return;
}
    const existingRecord = existingRecords[0];
    const currentQuantity = existingRecord?.quantity || 0;
    const newQuantity = currentQuantity + Number(quantity);

    if (existingRecord) {
      // Update existing record
      const { error: updateError } = await supabase
        .from("product_inventory")
        .update({ quantity: newQuantity })
        .eq("id", existingRecord.id); // safest: update by primary key

      if (updateError) {
        toast({
          title: "Error updating product quantity",
          description: updateError.message,
          variant: "destructive",
        });
        return;
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from("product_inventory")
        .insert({
          branch_id: selectedBranch,
          product_id,
          quantity: newQuantity,
          // updated_at will be auto-filled by Supabase
        });

      if (insertError) {
        toast({
          title: "Error inserting product inventory",
          description: insertError.message,
          variant: "destructive",
        });
        return;
      }
    }
  }

  toast({
    title: "Success",
    description: "Product quantities updated successfully",
    variant: "default",
  });

  onSuccess();
  onOpenChange(false);
};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <h2 className="text-xl font-bold">Insert Product Quantities</h2>
        </DialogHeader>

        <div className="space-y-4">
          {/* Branch Selection - Conditional rendering based on role */}
          {isHeadOffice ? (
            <Select
              value={selectedBranch}
              onValueChange={(value) => setSelectedBranch(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm text-muted-foreground">
              <strong>Branch:</strong> {userBranch?.name}
            </div>
          )}

          {/* Product and Quantity Fields */}
          {productFields.map((field, index) => (
            <div key={index} className="flex gap-4 items-center relative">
              <Select
                value={field.product_id}
                onValueChange={(value) =>
                  handleFieldChange(index, "product_id", value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Product" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                value={field.quantity}
                onChange={(e) =>
                  handleFieldChange(index, "quantity", Number(e.target.value))
                }
                placeholder="Enter Quantity"
                min="0"
              />

              {index > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 p-1 absolute right-0"
                  onClick={() => removeProductField(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-fit px-3 py-1 text-green-600 hover:bg-green-50"
            onClick={addProductField}
          >
            + Add Product
          </Button>
        </div>

        <DialogFooter className="gap-4 mt-4">
          <Button
            variant="destructive"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InsertProductQuantityDialog;