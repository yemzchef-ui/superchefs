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
import { useState, useEffect } from "react";
import { useUserBranch } from "@/hooks/user-branch";

interface UpdateQuantityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  branches?: Array<{ id: string; name: string }>;
}

interface MaterialField {
  material_id: string;
  quantity: number | "";
}

export default function UpdateQuantityDialog({
  open,
  onOpenChange,
  onSuccess,
}: UpdateQuantityDialogProps) {
  const { data: userBranch } = useUserBranch() as {
     data: { id: string; name: string } | null;
  };
  const isHeadOffice = userBranch?.name === "HEAD OFFICE";
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [materials, setMaterials] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(
    isHeadOffice ? "" : userBranch?.id || ""
  );
  const [materialFields, setMaterialFields] = useState<MaterialField[]>([
    { material_id: "", quantity: "" },
  ]);
  const { toast } = useToast();

  // Fetch branches and materials
  useEffect(() => {
    const fetchBranchesAndMaterials = async () => {
      const { data: branchData, error: branchError } = await supabase
        .from("branches")
        .select("*");
      const { data: materialData, error: materialError } = await supabase
        .from("materials")
        .select("*");

      if (branchError || materialError) {
        toast({
          title: "Error fetching data",
          description: branchError?.message || materialError?.message,
          variant: "destructive",
        });
        return;
      }

      setBranches(branchData || []);
      setMaterials(materialData || []);
    };

    fetchBranchesAndMaterials();
  }, []);

  // Fetch current quantity
  const fetchCurrentQuantity = async (
    branch_id: string,
    material_id: string
  ) => {
    if (!branch_id || !material_id) return null;

    const { data, error } = await supabase
      .from("inventory")
      .select("quantity")
      .eq("branch_id", branch_id)
      .eq("material_id", material_id)
      .single();

    if (error) {
      toast({
        title: "Error fetching quantity",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    return data?.quantity || 0;
  };

  // Handle adding new field
  const addMaterialField = () => {
    setMaterialFields([...materialFields, { material_id: "", quantity: "" }]);
  };

  // Handle removing a field
  const removeMaterialField = (index: number) => {
    setMaterialFields(materialFields.filter((_, i) => i !== index));
  };

  // Handle field change
  const handleFieldChange = async (
    index: number,
    field: keyof MaterialField,
    value: string | number
  ) => {
    const updatedFields = [...materialFields];
    updatedFields[index][field] = value as never;

    // Fetch current quantity if material changes
    if (field === "material_id" && selectedBranch) {
      const material_id = updatedFields[index].material_id;
      if (material_id) {
        const currentQuantity = await fetchCurrentQuantity(
          selectedBranch,
          material_id
        );
        updatedFields[index].quantity = currentQuantity;
      }
    }

    setMaterialFields(updatedFields);
  };

  // Submit handler
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
    materialFields.some(
      (field) =>
        !field.material_id ||
        field.quantity === "" ||
        Number(field.quantity) <= 0
    )
  ) {
    toast({
      title: "Error",
      description: "Please fill all fields correctly with positive values",
      variant: "destructive",
    });
    return;
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0]; // e.g., "2025-04-05"

  for (const field of materialFields) {
    const { material_id, quantity } = field;

    // Step 1: Query for any record where branch_id, material_id, and date (from updated_at) = today
    const { data: existingRecords, error: fetchError } = await supabase
      .from("inventory")
      .select("id, quantity, updated_at")
      .eq("branch_id", selectedBranch)
      .eq("material_id", material_id)
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
      // Update the existing record for today
      const { error: updateError } = await supabase
        .from("inventory")
        .update({ quantity: newQuantity })
        .eq("id", existingRecord.id); // safest: update by ID

      if (updateError) {
        toast({
          title: "Error updating quantity",
          description: updateError.message,
          variant: "destructive",
        });
        return;
      }
    } else {
      // Insert a new record (updated_at will be set by Supabase)
      const { error: insertError } = await supabase
        .from("inventory")
        .insert({
          branch_id: selectedBranch,
          material_id,
          quantity: newQuantity,
          // updated_at will be auto-generated
        });

      if (insertError) {
        toast({
          title: "Error inserting inventory",
          description: insertError.message,
          variant: "destructive",
        });
        return;
      }
    }
  }

  toast({
    title: "Success",
    description: "Quantities updated successfully",
    variant: "default",
  });

  onSuccess();
  onOpenChange(false);
};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <h2 className="text-xl font-bold">Add New Material Quantities</h2>
        </DialogHeader>

        {/* Branch Selection */}
        {isHeadOffice ? (
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
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

        {/* Material Fields */}
        {materialFields.map((field, index) => (
          <div key={index} className="flex gap-4 items-center relative">
            <Select
              value={field.material_id}
              onValueChange={(value) =>
                handleFieldChange(index, "material_id", value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Material" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {materials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={field.quantity}
              onChange={(e) =>
                handleFieldChange(index, "quantity", Number(e.target.value))
              }
              placeholder="New Qty"
            />

            {index > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeMaterialField(index)}
                className="absolute right-0 text-red-500 hover:text-red-700 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-fit px-3 py-1 text-green-600 hover:bg-green-500"
          onClick={addMaterialField}
        >
          + Add Material
        </Button>

        <DialogFooter>
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
}