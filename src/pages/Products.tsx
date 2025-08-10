import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types/products";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProductForm } from "@/components/products/ProductForm";
import { ProductDamageDialog } from "@/components/products/ProductDamageDialog";
import { ProductTransferDialog } from "@/components/products/ProductTransferDialog";
import { ComplimentaryProductDialog } from "@/components/products/ComplimentaryProductDialog";
import { useToast } from "@/components/ui/use-toast";
import { useUserBranch } from "@/hooks/user-branch";
import UpdateProductPriceDialog from "@/components/products/UpdateProductPriceDialog";
import UpdateProductQuantityDialog from "@/components/products/UpdateProductQuantityDialog";
import InsertProductQuantityDialog from "@/components/products/InsertProductQuantityDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type CumulativeProductView = {
  total_transfer_out_quantity: number;
  total_transfer_in_quantity: number;
  product_id: string;
  product_name: string;
  branch_id: string;
  total_quantity: number;
  selling_price: number;
  total_sale_quantity: number;
  total_damage_quantity: number;
  total_transfer_quantity: number;
  total_complimentary_quantity: number;
  total_yield: number;
};

type ProductRecipe = {
  product_id: string;
  unit_cost: number;
  selling_price: number;
  ucrr: number;
};

type ExtendedProduct = Product & {
  product_damage?: { quantity: number }[];
  product_transfer?: {
    quantity: number;
    from_branch_id: string;
    to_branch_id: string;
  }[];
};

function getProductId(product: any) {
  return product.product_id || product.id || "";
}
function getProductName(product: any) {
  return product.product_name || product.name || "";
}

const Products = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addComplimentaryOpen, setAddComplimentaryOpen] = useState(false);
  const [addDamageOpen, setAddDamageOpen] = useState(false);
  // const [addTransferOpen, setAddTransferOpen] = useState(false);
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isInsertQuantityDialogOpen, setIsInsertQuantityDialogOpen] =
    useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [timePeriod, setTimePeriod] = useState<string>("today");

  const { toast } = useToast();
  const { data: userBranch } = useUserBranch() as {
    data: { name: string; id: string; role: string } | null;
  };
  const queryClient = useQueryClient();

  const getViewName = () => {
    if (userBranch?.name === "HEAD OFFICE" && selectedBranch === "all") {
      switch (timePeriod) {
        case "today":
          return "admin_product_today_view";
        case "this_week":
          return "admin_product_this_week_view";
        case "this_month":
          return "admin_product_this_month_view";
        case "this_year":
          return "admin_product_this_year_view";
        default:
          return "admin_product_today_view";
      }
    } else {
      switch (timePeriod) {
        case "today":
          return "branch_product_today_view";
        case "this_week":
          return "branch_product_this_week_view";
        case "this_month":
          return "branch_product_this_month_view";
        case "this_year":
          return "branch_product_this_year_view";
        default:
          return "branch_product_today_view";
      }
    }
  };

  const {
    data: products,
    refetch,
    isLoading,
  } = useQuery<CumulativeProductView[] | ExtendedProduct[]>({
    queryKey: ["products", selectedBranch, timePeriod],
    queryFn: async () => {
      const viewName = getViewName();

      // If the user is a branch user, filter by their branch_id
      if (userBranch?.name !== "HEAD OFFICE") {
        const { data, error } = await supabase
          .from(viewName)
          .select("*")
          .eq("branch_id", userBranch?.id); // Filter by branch_id for branch users

        if (error) throw error;
        return data as CumulativeProductView[];
      }

      // For HEAD OFFICE users, allow filtering by selectedBranch or show all
      let query = supabase.from(viewName).select("*");

      if (selectedBranch !== "all") {
        query = query.eq("branch_id", selectedBranch);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CumulativeProductView[];
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const { data: productRecipes } = useQuery<ProductRecipe[]>({
    queryKey: ["product_recipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_recipes")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: productsData } = useQuery({
    queryKey: ["products_data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data as Product[];
    },
  });

  const handleOnSuccess = () =>
    queryClient.invalidateQueries({ queryKey: ["products"] });

  const handleAddProduct = async (values: Partial<Product>) => {
    try {
      if (!values.name) {
        toast({
          title: "Error",
          description: "Product name is required",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("products").insert({
        name: values.name,
        branch_id: userBranch?.id,
        description: values?.description,
        price: values.price || 0,
        category: values?.category,
        image_url: values?.image_url,
        is_active: values?.is_active ?? true,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product added successfully",
      });
      setIsAddDialogOpen(false);
      refetch();
    } catch (error) {
      console.error("Error adding product:", error);
      toast({
        title: "Error",
        description: "Failed to add product",
        variant: "destructive",
      });
    }
  };

  const handleOpenPriceDialog = (product: { id: string; name: string }) => {
    setSelectedProduct(product);
    setIsPriceDialogOpen(true);
  };

  const handleOpenQuantityDialog = (product: { id: string; name: string }) => {
    setSelectedProduct(product);
    setIsQuantityDialogOpen(true);
  };

  const filteredProducts = products?.filter((product) => {
    const name = (product as any).product_name || (product as any).name || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Helper function to safely get a number property
  const getNumber = (obj: any, key: string) =>
    typeof obj[key] === "number" ? obj[key] : 0;

  // Helper function to calculate current quantity
  const calculateCurrentQuantity = (product: any) => {
    return (
      ("total_production_quantity" in product
        ? getNumber(product, "total_production_quantity")
        : 0) +
      ("total_quantity" in product ? getNumber(product, "total_quantity") : 0) +
      ("opening_stock" in product ? getNumber(product, "opening_stock") : 0) +
      ("total_transfer_in_quantity" in product
        ? getNumber(product, "total_transfer_in_quantity")
        : 0) -
      ("total_usage_quantity" in product
        ? getNumber(product, "total_usage_quantity")
        : 0) -
      ("total_transfer_out_quantity" in product
        ? getNumber(product, "total_transfer_out_quantity")
        : 0) -
      ("total_complimentary_quantity" in product
        ? getNumber(product, "total_complimentary_quantity")
        : 0) -
      ("total_damage_quantity" in product
        ? getNumber(product, "total_damage_quantity")
        : 0) -
      ("total_sales_quantity" in product
        ? getNumber(product, "total_sales_quantity")
        : 0)
    );
  };

  return (
    <div className="space-y-1 p-2 bg-transparent rounded-lg shadow-md w-full mx-auto margin-100">
      
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Products</h2>
        <div className="absolute z-40 w-1/2 grid grid-cols-4 bg-transparent">
          <details className="group absolute">
            <summary className="cursor-pointer hover:text-green-600 p-2">
              <span className="text-lg font-semibold">Actions</span>
            </summary>
            <div className="absolute ">
              {/* Only HEAD OFFICE can add products and quantities */}
              {userBranch?.name === "HEAD OFFICE" && (
                <>
                  <Dialog
                    open={isAddDialogOpen}
                    onOpenChange={setIsAddDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button className="m-0.5 bg-green-800">
                        <Plus className="h-4 w-4" />
                        Create Product
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Product</DialogTitle>
                      </DialogHeader>
                      <ProductForm onSubmit={handleAddProduct} />
                    </DialogContent>
                  </Dialog>

                  <Button
                    className="m-0.5 bg-green-800"
                    onClick={() => setIsInsertQuantityDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add product
                  </Button>
                  {isInsertQuantityDialogOpen && (
                    <InsertProductQuantityDialog
                      open={isInsertQuantityDialogOpen}
                      onOpenChange={setIsInsertQuantityDialogOpen}
                      products={productsData || []}
                      branches={branches || []}
                      onSuccess={handleOnSuccess}
                    />
                  )}
                </>
              )}

              {/* Only branch users (not HEAD OFFICE) can add CMP, Damages, Transfer */}
              {userBranch?.name !== "HEAD OFFICE" && (
                <>
                  <Button
                    className="m-0.5 bg-green-800"
                    onClick={() => setIsInsertQuantityDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add Product
                  </Button>
                  {isInsertQuantityDialogOpen && (
                    <InsertProductQuantityDialog
                      open={isInsertQuantityDialogOpen}
                      onOpenChange={setIsInsertQuantityDialogOpen}
                      products={productsData || []}
                      branches={
                        userBranch?.name === "HEAD OFFICE" ? branches || [] : []
                      }
                      onSuccess={handleOnSuccess}
                    />
                  )}

                  <Button
                    className="m-0.5"
                    onClick={() => setAddComplimentaryOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add CMP
                  </Button>
                  {addComplimentaryOpen && (
                    <ComplimentaryProductDialog
                      open={addComplimentaryOpen}
                      onOpenChange={setAddComplimentaryOpen}
                      products={productsData || []}
                      onSuccess={handleOnSuccess}
                    />
                  )}

                  <Button
                    className="m-0.5"
                    onClick={() => setAddDamageOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add Damages
                  </Button>
                  {addDamageOpen && (
                    <ProductDamageDialog
                      products={productsData || []}
                      open={addDamageOpen}
                      onOpenChange={setAddDamageOpen}
                      onSuccess={handleOnSuccess}
                    />
                  )}

                  <Button
                    className="m-0.5"
                    onClick={() => setIsTransferDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Transfer
                  </Button>
                  <ProductTransferDialog
                    open={isTransferDialogOpen}
                    onOpenChange={setIsTransferDialogOpen}
                    products={productsData || []}
                    branches={branches || []}
                    onSuccess={handleOnSuccess}
                  />
                </>
              )}
            </div>
          </details>
        </div>

        <div className="grid space-y-2">

          <div className="w-32 justify-self-end">
            {userBranch?.name === "HEAD OFFICE" && (
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select> */}
          </div>
          <div>
            <Input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-32 justify-self-end"
            />
          </div>
            <div
              className={`relative top-1 text-2xl font-bold ${
                filteredProducts &&
                Number(
                  filteredProducts
                    .reduce((acc, product) => {
                      const productId = getProductId(product);
                      const recipe = productRecipes?.find(
                        (r) => r.product_id === productId
                      );
                      const price =
                        typeof recipe?.selling_price === "number"
                          ? recipe.selling_price
                          : (product as any).selling_price || 0;

                      const currentQuantity = calculateCurrentQuantity(product);

                      return acc + price * currentQuantity;
                    }, 0)
                    .toFixed(2)
                ) > 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              ₦
              {filteredProducts
                ? Number(
                    filteredProducts
                      .reduce((acc, product) => {
                        const productId = getProductId(product);
                        const recipe = productRecipes?.find(
                          (r) => r.product_id === productId
                        );
                        const price =
                          typeof recipe?.selling_price === "number"
                            ? recipe.selling_price
                            : (product as any).selling_price || 0;

                        const currentQuantity = calculateCurrentQuantity(product);

                        return acc + price * currentQuantity;
                      }, 0)
                      .toFixed(2)
                  ).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : "0.00"}
            </div>
        </div>
      </div>

      <div className="border rounded-lg bg-gray-200 max-h-[70vh] overflow-auto">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-200 sticky top-0 z-30 shadow-sm">
              <TableHead
                className="sticky left-0 z-50"
                style={{ minWidth: 180, background: "#e5e7eb", top: 0 }}
              >
                Name
              </TableHead>
              <TableHead>QTY</TableHead>
              <TableHead>Open</TableHead>
              <TableHead>Add</TableHead>
              <TableHead>Prod. Stock</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>TRF (In)</TableHead>
              <TableHead>TRF (Out)</TableHead>
              <TableHead>CMP</TableHead>
              <TableHead>DMG</TableHead>
              <TableHead>Sales</TableHead>
              <TableHead>Unit Cost</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Sales Cost</TableHead>
              <TableHead>N-S Cost</TableHead>
              <TableHead>Sales Amt</TableHead>
              <TableHead>UCRR</TableHead>
              <TableHead>ACRR</TableHead>
              <TableHead>
                <Settings className="h-4 w-4 text-gray-800 ml-2" />
              </TableHead>
            </TableRow>
          </TableHeader>
          {filteredProducts && filteredProducts.length > 0 && !isLoading ? (
            <TableBody className="">
              {filteredProducts.map((product, index) => {
                const recipe = productRecipes?.find(
                  (r) => r.product_id === getProductId(product)
                );

                // Helper functions to safely access properties
                const getNumber = (obj: any, key: string) =>
                  typeof obj[key] === "number" ? obj[key] : 0;

                const salesCost =
                  "total_cost" in product
                    ? getNumber(product, "total_cost")
                    : 0;
                const nSalesCost =
                  ("total_complimentary_cost" in product
                    ? getNumber(product, "total_complimentary_cost")
                    : 0) +
                  ("total_damage_cost" in product
                    ? getNumber(product, "total_damage_cost")
                    : 0);
                const sales =
                  "total_sale" in product
                    ? getNumber(product, "total_sale")
                    : 0;

                const acrr = {
                  acrr: ((salesCost + nSalesCost) / (sales || 1)) * 100,
                };

                const ucrr = {
                  ucrr:
                    ((recipe?.unit_cost || 0) / (recipe?.selling_price || 1)) *
                    100,
                };

                // For currentQuantity and table cells, check property existence
                const currentQuantity =
                  ("total_production_quantity" in product
                    ? getNumber(product, "total_production_quantity")
                    : 0) +
                  ("total_quantity" in product
                    ? getNumber(product, "total_quantity")
                    : 0) +
                  ("opening_stock" in product
                    ? getNumber(product, "opening_stock")
                    : 0) +
                  ("total_transfer_in_quantity" in product
                    ? getNumber(product, "total_transfer_in_quantity")
                    : 0) -
                  ("total_usage_quantity" in product
                    ? getNumber(product, "total_usage_quantity")
                    : 0) -
                  ("total_transfer_out_quantity" in product
                    ? getNumber(product, "total_transfer_out_quantity")
                    : 0) -
                  ("total_complimentary_quantity" in product
                    ? getNumber(product, "total_complimentary_quantity")
                    : 0) -
                  ("total_damage_quantity" in product
                    ? getNumber(product, "total_damage_quantity")
                    : 0) -
                  ("total_sales_quantity" in product
                    ? getNumber(product, "total_sales_quantity")
                    : 0);

                return (
                  <TableRow
                    key={getProductId(product)}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-100"}
                  >
                    <TableCell
                      className="sticky left-0 z-10 bg-white"
                      style={{
                        minWidth: 180,
                        background: index % 2 === 0 ? "#fff" : "#f3f4f6",
                      }}
                    >
                      {getProductName(product)}
                    </TableCell>
                    <TableCell>
                      <span className="text-lg font-bold">
                        {currentQuantity.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {("opening_stock" in product
                        ? getNumber(product, "opening_stock")
                        : 0
                      ).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {"total_quantity" in product
                        ? getNumber(product, "total_quantity")
                        : 0}
                    </TableCell>
                    <TableCell>
                      {("total_production_quantity" in product
                        ? getNumber(product, "total_production_quantity")
                        : 0
                      ).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {("total_usage_quantity" in product
                        ? getNumber(product, "total_usage_quantity")
                        : 0
                      ).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {"total_transfer_in_quantity" in product
                        ? getNumber(product, "total_transfer_in_quantity")
                        : 0}
                    </TableCell>
                    <TableCell>
                      {"total_transfer_out_quantity" in product
                        ? getNumber(product, "total_transfer_out_quantity")
                        : 0}
                    </TableCell>
                    <TableCell>
                      {"total_complimentary_quantity" in product
                        ? getNumber(product, "total_complimentary_quantity")
                        : 0}
                    </TableCell>
                    <TableCell>
                      {"total_damage_quantity" in product
                        ? getNumber(product, "total_damage_quantity")
                        : 0}
                    </TableCell>
                    <TableCell>
                      {"total_sales_quantity" in product
                        ? getNumber(product, "total_sales_quantity")
                        : 0}
                    </TableCell>
                    <TableCell>
                      ₦
                      {typeof recipe?.unit_cost === "number"
                        ? recipe.unit_cost.toFixed(2)
                        : "0.00"}
                    </TableCell>
                    <TableCell>
                      ₦
                      {typeof recipe?.selling_price === "number"
                        ? recipe.selling_price.toFixed(2)
                        : "0.00"}
                    </TableCell>
                    <TableCell>
                      ₦
                      {"total_cost" in product &&
                      typeof product.total_cost === "number"
                        ? product.total_cost.toFixed(2)
                        : "0.00"}
                    </TableCell>
                    <TableCell>
                      <span className="text-yellow-600">
                        ₦
                        {"total_complimentary_cost" in product &&
                        typeof (product as any).total_complimentary_cost ===
                          "number" &&
                        "total_damage_cost" in product &&
                        typeof (product as any).total_damage_cost === "number"
                          ? (
                              (product as any).total_complimentary_cost +
                              (product as any).total_damage_cost
                            ).toFixed(2)
                          : "0.00"}
                      </span>
                    </TableCell>
                    <TableCell>
                      ₦
                      {"total_sale" in product &&
                      typeof product.total_sale === "number"
                        ? product.total_sale.toFixed(2)
                        : "0.00"}
                    </TableCell>
                    <TableCell>
                      {typeof ucrr.ucrr === "number" ? (
                        ucrr.ucrr > 75 ? (
                          <span className="text-red-600">
                            {ucrr.ucrr.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-green-600">
                            {ucrr.ucrr.toFixed(2)}%
                          </span>
                        )
                      ) : (
                        "0.00%"
                      )}
                    </TableCell>
                    <TableCell>
                      {typeof acrr.acrr === "number" ? (
                        acrr.acrr > 75 ? (
                          <span className="text-red-600">
                            {acrr.acrr.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-green-600">
                            {acrr.acrr.toFixed(2)}%
                          </span>
                        )
                      ) : (
                        "0.00%"
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        onValueChange={(value) => {
                          if (value === "update_price") {
                            handleOpenPriceDialog({
                              id: getProductId(product),
                              name: getProductName(product),
                            });
                          } else if (value === "update_quantity") {
                            handleOpenQuantityDialog({
                              id: getProductId(product),
                              name: getProductName(product),
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="w-3 justify-end appearance-none [&>svg]:hidden p-0 bg-transparent border-0 text-green-500 hover:text-green-900 text-xl font-bold">
                          <SelectValue placeholder="⋮" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="update_price"
                            disabled={userBranch?.name !== "HEAD OFFICE"}
                            className={`${
                              userBranch?.name !== "HEAD OFFICE"
                                ? "text-gray-400 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <span className="pl-1">⋮</span> Update Price
                          </SelectItem>
                          <SelectItem
                            value="update_quantity"
                            disabled={userBranch?.name !== "HEAD OFFICE"}
                            className={`${
                              userBranch?.name !== "HEAD OFFICE"
                                ? "text-gray-400 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <span className="pl-1">⋮</span> Add Qty
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          ) : (
            <TableBody>
              <TableRow>
                <TableCell colSpan={18} className="text-center">
                  {isLoading ? (
                    <div className="flex justify-center items-center">
                      Loading... Please wait
                      <div className="animate-spin rounded-full text-green-500 h-8 w-8 border-t-2 border-b-2  border-green-500"></div>
                    </div>
                  ) : (
                    "No products found."
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          )}
        </Table>
      </div>

      <UpdateProductPriceDialog
        open={isPriceDialogOpen}
        onOpenChange={setIsPriceDialogOpen}
        product={selectedProduct}
        onSuccess={handleOnSuccess}
      />
      <UpdateProductQuantityDialog
        open={isQuantityDialogOpen}
        onOpenChange={setIsQuantityDialogOpen}
        product={selectedProduct}
        branches={branches || []}
        onSuccess={handleOnSuccess}
      />
    </div>
  );
};

export default Products;
