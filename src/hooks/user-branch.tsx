import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth";
import { supabase } from "@/integrations/supabase/client";
import { Branch } from "@/types/branch";

export const useUserBranch = () => {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["user-branch", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select(
          `branch:branches!profiles_branch_id_fkey(*)
        `
        )
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user branch:", error);
        return null;
      }

      return data?.branch as unknown as Branch; // Return branch as an object
    },
    enabled: !!session?.user?.id,
  });
};
