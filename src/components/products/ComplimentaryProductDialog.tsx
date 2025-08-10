import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComplimentaryProductForm } from "./ComplimentaryProductForm";
import { useToast } from "@/hooks/use-toast";
import { Product } from "@/types/products";
import { useUserBranch } from "@/hooks/user-branch";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ComplimentaryProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onSuccess?: () => void;
}

export const ComplimentaryProductDialog: React.FC<ComplimentaryProductDialogProps> = ({
  open,
  onOpenChange,
  products,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get the logged-in user's branch information
  const { data: userBranch } = useUserBranch();
  const branchId = userBranch?.id;

  // Fetch product_recipes for unit_cost
  const { data: productRecipes } = useQuery({
    queryKey: ["product_recipes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_recipes").select("*");
      if (error) throw error;
      return data;
    },
  });


  const handleSubmit = async (values: {
    product: string;
    quantity: string;
    reason: string;
    recipient: string;
  }) => {
    try {
      if (!branchId) {
        throw new Error("Branch ID is missing. Please log in again.");
      }

      setIsLoading(true);

      // Get unit_cost from product_recipes
      const recipe = productRecipes?.find(
        (r: any) => r.product_id === values.product
      );
      const unit_cost = recipe?.unit_cost ?? 0;
      const quantity = Number(values.quantity);
      const cost = quantity * unit_cost;

      // Insert into complimentary_products table
      const { error } = await supabase.from("complimentary_products").insert([
        {
          product_id: values.product,
          branch_id: branchId,
          quantity: Number(values.quantity),
          reason: values.reason,
          recipient: values.recipient,
          unit_cost,
          cost,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Complimentary product recorded successfully",
      });

      // Invalidate queries to update UI
      queryClient.invalidateQueries({
        queryKey: ["branch_product_today_view", branchId],
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error(
        "Error recording complimentary product:",
        error.message || error
      );
      toast({
        title: "Error",
        description: error.message || "Failed to record complimentary product",
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
          <DialogTitle>Record Complimentary Product</DialogTitle>
        </DialogHeader>
        {branchId && (
          <ComplimentaryProductForm
            products={products}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            onCancel={() => onOpenChange(false)}
            branchId={branchId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};