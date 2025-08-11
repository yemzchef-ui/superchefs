import { RefetchOptions, QueryObserverResult } from "@tanstack/react-query";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ImprestForm from "./ImprestForm";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImprestFormValues } from "./ImprestForm"; // Ensure this import matches the path
import { Imprest } from "@/types/imprest"; // Ensure this import matches the path
import { useUserBranch } from "@/hooks/user-branch";
import { useAuth } from "@/hooks/auth";

interface ImprestDialogProps {
  onOpenChange: (open: boolean) => void;
  refetch: (
    options?: RefetchOptions
  ) => Promise<
    QueryObserverResult<{ imprests: Imprest[]; hasNextpage?: boolean }, Error>
  >;
}

export const ImprestDialog = ({
  onOpenChange,
  refetch,
}: ImprestDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { data } = useUserBranch();
  const userBranchId = data?.id;
  const { user } = useAuth();
  const handleSubmit = async (values: ImprestFormValues) => {
    try {
      setIsLoading(true);
      const new_items = values?.items?.map((x) => ({
        branch_id: userBranchId,
        name: x?.name,
        quantity: Number(x?.quantity),
        status: "pending" as Imprest["status"],
        unit: x?.unit,
        unit_price: Number(x?.unit_price),
        user_id: user?.id,
      }));

      const { error } = await supabase
        .from("imprest_requests")
        .insert(new_items);
      if (error) throw error;

      toast({
        title: "Success",
        description: "Imprest sent successfully",
      });
      await refetch();
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending imprest:", error);
      toast({
        title: "Error",
        description: "Failed to send imprest",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogContent aria-describedby="imprest request" className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Send Imprest Request</DialogTitle>
      </DialogHeader>
      <ImprestForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        onCancel={() => onOpenChange(false)}
      />
    </DialogContent>
  );
};
