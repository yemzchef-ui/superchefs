import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductDamageForm } from "./ProductDamageForm";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Product } from "@/types/products";
import { useUserBranch } from "@/hooks/user-branch";
import { useQuery, useQueryClient} from "@tanstack/react-query";

interface ExtendedProduct extends Product {
  product_damage?: { quantity: number }[];
}

interface ProductDamageDialogProps {
  products: ExtendedProduct[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const ProductDamageDialog = ({
  products,
  open,
  onOpenChange,
  onSuccess,
}: ProductDamageDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get the logged-in user's branch information
  const { data: userBranch } = useUserBranch() as {
    data: { id: string; name: string; role: string } | null;
  };

  // Fetch product_recipes for unit_cost
  const { data: productRecipes } = useQuery({
    queryKey: ["product_recipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_recipes")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  // Determine which branch to use
  const branchToUse =
    userBranch?.name === "HEAD OFFICE"
      ? undefined // HEAD OFFICE might allow selecting a branch elsewhere
      : userBranch?.id;

  const handleSubmit = async (values: {
    product: string;
    quantity: string;
    reason: string;
    branch?: string;
  }) => {
    try {
      setIsLoading(true);

      const selectedBranchId = values.branch || branchToUse;

      if (!selectedBranchId) {
        throw new Error("Branch ID is missing. Please log in again.");
      }

      // Get unit_price from products and unit_cost from product_recipes
      const selectedProduct = products.find((p) => p.id === values.product);
      const recipe = productRecipes?.find(
        (r) => r.product_id === values.product
      );
      const unit_price = selectedProduct?.price ?? 0;
      const unit_cost = recipe?.unit_cost ?? 0;

      // Insert into product_damages table
      const { error } = await supabase.from("product_damages").insert([
        {
          branch_id: selectedBranchId,
          product_id: values.product,
          quantity: Number(values.quantity),
          reason: values.reason,
          unit_price,
          unit_cost,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product damage recorded successfully",
      });

      // Invalidate product quantity view to reflect the change
      queryClient.invalidateQueries({
        queryKey: ["branch_product_today_view", selectedBranchId],
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error recording product damage:", error);
      toast({
        title: "Error",
        description: "Failed to record product damage",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Product Damage</DialogTitle>
        </DialogHeader>
        <ProductDamageForm
          products={products}
          onSubmit={async (values) => {
            const finalValues = {
              ...values,
              branch: branchToUse,
            };
            await handleSubmit(finalValues);
          }}
          branchId={branchToUse ?? ""}
          isLoading={isLoading}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};