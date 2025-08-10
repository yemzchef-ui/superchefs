import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  DialogContentText,
} from "@mui/material";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Utensils } from "lucide-react";
import { useUserBranch } from "@/hooks/user-branch";
// import { useProductionContext } from "@/context/ProductionContext";
import { Input } from "@/components/ui/input";

interface RecipeMaterial {
  product_id?: any;
  product?: {
    name: string;
    unit: string;
  };
  id: string;
  material_id?: string;
  quantity: number;
  material?: {
    name: string;
    unit: string;
  };
}

interface Recipe {
  id: string;
  name: string;
  yield: number;
  updated_at: number;
  description: string | null;
  product: {
    name: string;
    id: string;
    weight: string;
  };
  recipe_materials: RecipeMaterial[];
}

export const productionData = async (
  recipes: Recipe[],
  branchName: string | null
) => {
  return recipes.map((recipe) => ({
    branch: branchName || "Unknown Branch",
    productName: recipe.product.name,
    yield: recipe.yield,
    timestamp: recipe.updated_at,
  }));
};

const Production = () => {
  const queryClient = useQueryClient();
  const { data: userBranch } = useUserBranch();
  // const { addProductionRecord } = useProductionContext();

  // Fetch current material quantities
  const { data: materialQtyData, isLoading: isMaterialQtyLoading } = useQuery({
    queryKey: ["branch_material_today_view", userBranch?.id],
    enabled: !!userBranch?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_material_today_view")
        .select("*")
        .eq("branch_id", userBranch?.id);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Fetch current product quantities
  const { data: productQtyData, isLoading: isProductQtyLoading } = useQuery({
    queryKey: ["branch_product_today_view", userBranch?.id],
    enabled: !!userBranch?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_product_today_view")
        .select("*")
        .eq("branch_id", userBranch?.id);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Map material and product quantities for fast lookup
  const materialQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    (materialQtyData || []).forEach((row: any) => {
      map[row.material_id] =
        (row.total_quantity ?? 0) +
        (row.opening_stock ?? 0) +
        (row.total_procurement_quantity ?? 0) +
        (row.total_transfer_in_quantity ?? 0) -
        (row.total_transfer_out_quantity ?? 0) -
        (row.total_usage ?? 0) -
        (row.total_damage_quantity ?? 0);
    });
    return map;
  }, [materialQtyData]);

  const productQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    (productQtyData || []).forEach((row: any) => {
      map[row.product_id] =
        (row.total_quantity ?? 0) +
        (row.opening_stock ?? 0) +
        (row.total_production_quantity ?? 0) +
        (row.total_transfer_in_quantity ?? 0) -
        (row.total_transfer_out_quantity ?? 0) -
        (row.total_usage_quantity ?? 0) -
        (row.total_damage_quantity ?? 0) -
        (row.total_sales_quantity ?? 0) -
        (row.total_complimentary_quantity ?? 0);
    });
    return map;
  }, [productQtyData]);

  const { data: fetchedRecipes } = useQuery<Recipe[], Error>({
    queryKey: ["recipes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_recipes").select(`
        *,
        product:products(name, id, weight),
        recipe_materials(
          id,
          product_id,
          material_id,
          quantity,
          material:materials(name, unit),
          product:products(name)
        )
      `);
      if (error) {
        console.error("Error fetching recipes:", error);
        throw error;
      }
      return (data as Partial<Recipe>[]).map((recipe) => ({
        ...recipe,
        yield: recipe.yield || 1,
      })) as Recipe[];
    },
  });

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState("");
  const [insufficientItems, setInsufficientItems] = useState<
    Array<{ type: string; name: string; needed: number; available: number }>
  >([]);
  const [showInsufficientDialog, setShowInsufficientDialog] = useState(false);

  useEffect(() => {
    const fetchProductionData = async () => {
      if (
        fetchedRecipes &&
        userBranch &&
        typeof userBranch === "object" &&
        "name" in userBranch
      ) {
        const branchName =
          (userBranch as { name: string }).name || "Unknown Branch";
        const productionDataWithBranch = await productionData(
          fetchedRecipes,
          branchName
        );
        setRecipes(
          fetchedRecipes.map((recipe, index) => ({
            ...recipe,
            branch: productionDataWithBranch[index].branch,
          }))
        );
      }
    };
    fetchProductionData();
  }, [fetchedRecipes, userBranch]);

  const produceMutation = useMutation({
    mutationFn: async (recipe: Recipe) => {
      try {
        // const timestamp = new Date().toISOString();

        for (const material of recipe.recipe_materials) {
          if (material.material_id && material.material) {
            const { error: usageInsertError } = await supabase
              .from("material_usage")
              .insert({
                material_id: material.material_id,
                branch_id:
                  userBranch && typeof userBranch === "object" && "id" in userBranch
                    ? (userBranch as { id: string }).id
                    : "Unknown Branch",
                quantity: material.quantity,
              });
            if (usageInsertError) throw usageInsertError;
          } else if (material.product_id && material.product) {
            const { error: productUsageInsertError } = await supabase
              .from("product_usage")
              .insert({
                product_id: material.product_id,
                branch_id:
                  userBranch && typeof userBranch === "object" && "id" in userBranch
                    ? (userBranch as { id: string }).id
                    : "Unknown Branch",
                quantity: material.quantity,
              });
            if (productUsageInsertError) throw productUsageInsertError;
          }
        }

        const { error: productionInsertError } = await supabase
          .from("production")
          .insert({
            branch_name:
              userBranch &&
              typeof userBranch === "object" &&
              "name" in userBranch
                ? (userBranch as { name: string }).name
                : "Unknown Branch",
            branch_id:
              userBranch && typeof userBranch === "object" && "id" in userBranch
                ? (userBranch as { id: string }).id
                : "Unknown Branch",
            product_id: recipe.product.id,
            product_name: recipe.product.name,
            yield: recipe.yield,
            timestamp: new Date().toISOString(),
          });

        if (productionInsertError) {
          console.error("Error inserting into production table:", productionInsertError);
          throw productionInsertError;
        }

        return recipe;
      } catch (error) {
        console.error("Production process failed:", error);
        throw error;
      }
    },
    onSuccess: (recipe) => {
      toast({
        title: "Production Successful",
        description: `Producing ${recipe.yield || 0} units of ${
          recipe.product.name
        }`,
      });
      queryClient.invalidateQueries({ queryKey: ["material_usage"] });
      queryClient.invalidateQueries({ queryKey: ["production"] });
      queryClient.invalidateQueries({ queryKey: ["branch_material_today_view", userBranch?.id] });
      queryClient.invalidateQueries({ queryKey: ["branch_product_today_view", userBranch?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Production Error",
        description: `Failed to produce: ${error?.message || "Unknown error"}`,
        variant: "destructive",
      });
    },
  });

  // Helper to check sufficiency for all recipe ingredients
  const checkSufficiency = (recipe: Recipe) => {
    const insufficient: {
      type: string;
      name: string;
      needed: number;
      available: number;
    }[] = [];

    recipe.recipe_materials.forEach((item) => {
      if (item.material_id && item.material) {
        const available = materialQtyMap[item.material_id] ?? 0;
        if (item.quantity > available) {
          insufficient.push({
            type: "Material",
            name: item.material.name,
            needed: item.quantity,
            available,
          });
        }
      } else if (item.product_id && item.product) {
        const available = productQtyMap[item.product_id] ?? 0;
        if (item.quantity > available) {
          insufficient.push({
            type: "Product",
            name: item.product.name,
            needed: item.quantity,
            available,
          });
        }
      }
    });

    return insufficient;
  };

  const handleProduce = (recipe: Recipe) => {
    if (isMaterialQtyLoading || isProductQtyLoading) {
      toast({
        title: "Please wait",
        description: "Checking inventory...",
        variant: "destructive",
      });
      return;
    }

    const insufficient = checkSufficiency(recipe);
    if (insufficient.length > 0) {
      setInsufficientItems(insufficient);
      setShowInsufficientDialog(true);
      return;
    }

    produceMutation.mutate(recipe);
    handleClose();
  };

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Recipe | null>(null);

  const createDialog = (production: Recipe) => {
    setSelectedProduct(production);
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
    setSelectedProduct(null);
  };

  const handleYieldChange = (recipeId: string, newYield: number) => {
    if (newYield < 1) return;

    setRecipes((prevRecipes) =>
      prevRecipes.map((recipe) => {
        if (recipe.id === recipeId) {
          const yieldRatio = newYield / recipe.yield;
          return {
            ...recipe,
            yield: newYield,
            recipe_materials: recipe.recipe_materials.map((material) => ({
              ...material,
              quantity: material.quantity * yieldRatio,
            })),
          };
        }
        return recipe;
      })
    );
  };

  // Filter recipes by search term (product name)
  const filteredRecipes = recipes.filter((recipe) =>
    recipe.product.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-3 bg-white rounded-lg shadow-md w-full mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Utensils className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Production</h1>
        </div>
        <div>
          <Input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-32 md:w-64 lg:w-96"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredRecipes.map((recipe) => (
          <Card key={recipe.id} className="shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <CardTitle>{recipe.product.name}</CardTitle>
              </div>
              <CardDescription>
                {recipe.description && <p>{recipe.description}</p>}
                <div className="flex items-center gap-2 mt-2">
                  Yield:
                  <input
                    type="number"
                    value={recipe.yield}
                    onChange={(e) =>
                      handleYieldChange(recipe.id, Number(e.target.value))
                    }
                    className="w-full border rounded px-1 text-center"
                  /> <p>{recipe.product.weight}</p>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <details>
                <summary className="w-full bg-gray-200 rounded shadow-md pl-4 cursor-pointer hover:bg-green-50 hover:text-green-700">
                  Ingredients
                </summary>
                <div className="space-y-2 mt-2">
                  {recipe.recipe_materials.map((material) => {
                    let name = "";
                    let unit = "";
                    if (material.material_id && material.material) {
                      name = material.material.name;
                      unit = material.material.unit;
                    } else if (material.product_id && material.product) {
                      name = material.product.name;
                      unit = material.product.unit || "unit";
                    } else {
                      name = "Unknown";
                      unit = "";
                    }
                    return (
                      <div
                        key={material.id}
                        className="flex justify-between items-center py-1 border-b"
                      >
                        <span>{name}</span>
                        <span className="text-sm text-muted-foreground">
                          {material.quantity.toFixed(2)} {unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    onClick={() => createDialog(recipe)}
                    variant="outline"
                  >
                    Produce
                  </Button>
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog for confirming production */}
      <Dialog open={openDialog} onClose={handleClose}>
        <DialogTitle className="text-red-700">
          This action cannot be undone!
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Produce{" "}
            <span className="font-bold">{selectedProduct?.yield}</span> units of{" "}
            {selectedProduct?.product.name}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} variant="destructive">
            Cancel
          </Button>
          <Button
            onClick={() => handleProduce(selectedProduct!)}
            variant="default"
            disabled={produceMutation.isPending}
          >
            {produceMutation.isPending ? "Processing..." : "Produce"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for insufficient inventory */}
      
      <AlertDialog open={showInsufficientDialog} onOpenChange={setShowInsufficientDialog}>
        <AlertDialogContent className="z-[2000]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              ⚠️ INSUFFICIENT INVENTORY
            </AlertDialogTitle>
            <AlertDialogDescription>
          
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            {insufficientItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="font-medium">
                  {item.type}: {item.name}
                </span>
                <span>
                  Need:{" "}
                  <span className="text-green-600">{item.needed.toFixed(2)}</span>{" "}
                  | Stock:{" "}
                  <span className="text-red-600">{item.available.toFixed(2)}</span>
                </span>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Production;