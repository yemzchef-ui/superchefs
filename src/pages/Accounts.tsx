// Accounts.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { DateRange } from "react-day-picker";

import { supabase } from "@/integrations/supabase/client"; // <- adjust if your path differs
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/accounts/DateRangePicker";
import { Button } from "@/components/ui/button";
import { AccountsMetricsCards } from "@/components/accounts/AccountsMetricsCards";
import { AccountsChart } from "@/components/accounts/AccountsChart";
import { naira } from "@/lib/utils";
import useAccountReportGenerator from "@/hooks/use-generate-report"; // kept as-is; we treat this as a function
import { useUserBranch } from "@/hooks/user-branch";
import { UserMetadata } from "@supabase/supabase-js";
import ProductPerformance from "@/components/accounts/ProductPerformance";
import BranchPerformance from "@/components/accounts/BranchPerformance";

// dayjs plugin
dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

/* -------------------------
   Types
   ------------------------- */

type Branch = { id: string; name?: string };
type Product = {
  id: string;
  name?: string;
  unit_cost?: number | null;
  unit_price?: number | null;
  price?: number | null;
};
type Material = { id: string; name?: string; unit_price?: number | null };

type SaleItem = {
  product?: Product | null;
  product_id?: string | null;
  quantity?: number | null;
  subtotal?: number | null;
  total_cost?: number | null;
  unit_price?: number | null;
  unit_cost?: number | null;
};

type Sale = {
  id?: string;
  created_at?: string | null;
  branch_id?: string | null;
  total_amount?: number | null;
  items?: SaleItem[] | null;
  branch?: Branch | null;
};

type SimpleRecord = {
  id?: string;
  created_at?: string | null;
  branch_id?: string | null;
  quantity?: number | null;
  opening_stock?: number | null;
  closing_stock?: number | null;
  material_id?: string | null;
  product_id?: string | null;
  cost?: number | null;
  // ...other fields may exist on records
};

/* -------------------------
   Small helpers
   ------------------------- */
const safeNumber = (v: any) => (Number(v) || 0);

function applyDateFilter(query: any, dateRange?: DateRange) {
  if (!dateRange) return query;
  if (dateRange.from && dateRange.to) {
    return query
      .gte("created_at", dayjs(dateRange.from).startOf("day").toISOString())
      .lte("created_at", dayjs(dateRange.to).endOf("day").toISOString());
  }
  if (dateRange.from && !dateRange.to) {
    // single day selection
    return query
      .gte("created_at", dayjs(dateRange.from).startOf("day").toISOString())
      .lte("created_at", dayjs(dateRange.from).endOf("day").toISOString());
  }
  return query;
}

const Spinner: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    className="animate-spin"
    style={{ width: size, height: size }}
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      fill="none"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);

const ErrorBanner: React.FC<{ messages: string[] }> = ({ messages }) => {
  if (!messages || messages.length === 0) return null;
  return (
    <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-md space-y-1">
      {messages.map((m, i) => (
        <div key={i} className="text-sm">
          {m}
        </div>
      ))}
    </div>
  );
};

/* -------------------------
   New helpers for opening/closing per group (product+branch or material+branch)
   ------------------------- */
// Replace existing sort helpers with these

// function sortByDateAsc<T extends { created_at?: string | null }>(arr: T[]): T[] {
//   return [...arr].sort((a, b) => {
//     const ta = a.created_at ? dayjs(a.created_at).valueOf() : -Infinity;
//     const tb = b.created_at ? dayjs(b.created_at).valueOf() : -Infinity;
//     return ta - tb;
//   });
// }

// function sortByDateDesc<T extends { created_at?: string | null }>(arr: T[]): T[] {
//   return [...arr].sort((a, b) => {
//     const ta = a.created_at ? dayjs(a.created_at).valueOf() : -Infinity;
//     const tb = b.created_at ? dayjs(b.created_at).valueOf() : -Infinity;
//     return tb - ta;
//   });
// }


// function getOpeningStockForGroup(records: SimpleRecord[], dateRange?: DateRange) {
//   if (!records || records.length === 0) return 0;
//   const start = dateRange?.from ? dayjs(dateRange.from).startOf("day") : null;
//   const end = dateRange?.to ? dayjs(dateRange.to).endOf("day") : null;

//   if (start && end) {
//     const inRange = records.filter((r) => r.created_at && dayjs(r.created_at).isBetween(start, end, null, "[]"));
//     if (inRange.length > 0) {
//       const first = sortByDateAsc(inRange)[0];
//       return safeNumber(first.opening_stock);
//     }
//     // fallback to latest before start
//     const before = records.filter((r) => r.created_at && dayjs(r.created_at).isBefore(start));
//     if (before.length > 0) return safeNumber(sortByDateDesc(before)[0].opening_stock);
//     return 0;
//   }

//   if (start && !end) {
//     // single day selected
//     const sameDay = records.filter((r) => r.created_at && dayjs(r.created_at).isSame(start, "day"));
//     if (sameDay.length > 0) return safeNumber(sortByDateAsc(sameDay)[0].opening_stock);
//     const before = records.filter((r) => r.created_at && dayjs(r.created_at).isBefore(start));
//     if (before.length > 0) return safeNumber(sortByDateDesc(before)[0].opening_stock);
//     return 0;
//   }

//   // no date range: return most recent opening_stock (best-effort)
//   const latest = sortByDateDesc(records)[0];
//   return safeNumber(latest.opening_stock);
// }

// function getClosingStockForGroup(records: SimpleRecord[], dateRange?: DateRange) {
//   if (!records || records.length === 0) return 0;
//   const start = dateRange?.from ? dayjs(dateRange.from).startOf("day") : null;
//   const end = dateRange?.to ? dayjs(dateRange.to).endOf("day") : null;

//   if (start && end) {
//     const inRange = records.filter((r) => r.created_at && dayjs(r.created_at).isBetween(start, end, null, "[]"));
//     if (inRange.length > 0) {
//       const last = sortByDateAsc(inRange)[inRange.length - 1];
//       // prefer closing_stock then quantity
//       return safeNumber(last.closing_stock ?? last.quantity);
//     }
//     // fallback to latest before end
//     const before = records.filter((r) => r.created_at && dayjs(r.created_at).isBefore(end));
//     if (before.length > 0) return safeNumber(sortByDateDesc(before)[0].closing_stock ?? sortByDateDesc(before)[0].quantity);
//     return 0;
//   }

//   if (start && !end) {
//     // single day selected
//     const sameDay = records.filter((r) => r.created_at && dayjs(r.created_at).isSame(start, "day"));
//     if (sameDay.length > 0) return safeNumber(sortByDateDesc(sameDay)[0].closing_stock ?? sortByDateDesc(sameDay)[0].quantity);
//     const before = records.filter((r) => r.created_at && dayjs(r.created_at).isBefore(start));
//     if (before.length > 0) return safeNumber(sortByDateDesc(before)[0].closing_stock ?? sortByDateDesc(before)[0].quantity);
//     return 0;
//   }

//   // no date range: return most recent closing_stock or quantity
//   const latest = sortByDateDesc(records)[0];
//   return safeNumber(latest.closing_stock ?? latest.quantity);
// }

/* -------------------------
   New helpers for opening/closing per group (product+branch or material+branch)
   ------------------------- */
// Replace existing sort helpers with these (keep these if you use them elsewhere)
/* -------------------------
   New helpers for opening/closing per group (product+branch or material+branch)
   ------------------------- */
/* -------------------------
   New helpers for opening/closing per group (product+branch or material+branch)
   ------------------------- */
function sortByDateAsc<T extends { created_at?: string | null }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const ta = a.created_at ? dayjs(a.created_at).valueOf() : -Infinity;
    const tb = b.created_at ? dayjs(b.created_at).valueOf() : -Infinity;
    return ta - tb;
  });
}
function sortByDateDesc<T extends { created_at?: string | null }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const ta = a.created_at ? dayjs(a.created_at).valueOf() : -Infinity;
    const tb = b.created_at ? dayjs(b.created_at).valueOf() : -Infinity;
    return tb - ta;
  });
}

/**
 * Gets the authoritative stock value at a point in time.
 * Always uses `quantity` — never relies on `opening_stock` or `closing_stock`.
 * 
 * Opening Stock (for date X) = quantity of last record BEFORE X
 * Closing Stock (for date X) = quantity of last record ON OR BEFORE X
 */
function getStockAtDate(
  records: SimpleRecord[],
  targetDate: dayjs.Dayjs | null,
  isClosing: boolean
): number {
  if (!records || records.length === 0) return 0;
  if (!targetDate) {
    // Fallback: most recent quantity
    const latest = sortByDateDesc(records)[0];
    return safeNumber(latest.quantity);
  }

  if (isClosing) {
    // Closing: last record on or before targetDate
    const filtered = records.filter(
      (r) => r.created_at && dayjs(r.created_at).isSameOrBefore(targetDate)
    );
    if (filtered.length === 0) return 0;
    const latest = sortByDateDesc(filtered)[0];
    return safeNumber(latest.quantity); // Always use quantity — it's the real count
  } else {
    // Opening: last record strictly BEFORE targetDate
    const filtered = records.filter(
      (r) => r.created_at && dayjs(r.created_at).isBefore(targetDate)
    );
    if (filtered.length === 0) {
      // No prior records → fallback to opening_stock of first record on targetDate
      const onOrAfter = records.filter(
        (r) => r.created_at && dayjs(r.created_at).isSameOrAfter(targetDate)
      );
      if (onOrAfter.length > 0) {
        const first = sortByDateAsc(onOrAfter)[0];
        return safeNumber(first.opening_stock ?? first.quantity);
      }
      return 0;
    }
    const latest = sortByDateDesc(filtered)[0];
    return safeNumber(latest.quantity); // Always use quantity
  }
}

// Replaced functions — simple wrappers
function getOpeningStockForGroup(records: SimpleRecord[], dateRange?: DateRange): number {
  if (!records || records.length === 0) return 0;
  const startDate = dateRange?.from ? dayjs(dateRange.from).startOf("day") : null;
  const openingDate = startDate ? startDate.subtract(1, 'day') : null;
  return getStockAtDate(records, openingDate, false);
}

function getClosingStockForGroup(records: SimpleRecord[], dateRange?: DateRange): number {
  if (!records || records.length === 0) return 0;
  const endDate = dateRange?.to ? dayjs(dateRange.to).endOf("day") : null;
  return getStockAtDate(records, endDate, true);
}


/* -------------------------
   Main component
   ------------------------- */
const Accounts: React.FC = () => {
  const ContentRef = useRef<HTMLDivElement | null>(null);

  // useAccountReportGenerator is used as a function (keeps same behaviour as your original code)
  // we cast to 'any' to avoid typing assumptions about that utility. If you have its types, replace 'any'.
  const generateReport = (useAccountReportGenerator as unknown) as any;

  const [user, setUser] = useState<UserMetadata | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");

  const { data: userBranch } = useUserBranch();
  const branchName = userBranch?.name || "";

  // fetch logged-in user metadata
  useEffect(() => {
    (async () => {
      try {
        const res = await supabase.auth.getUser();
        // supabase v2 shape: res.data.user
        // @ts-ignore
        const _user = res?.data?.user;
        if (_user?.user_metadata) setUser(_user.user_metadata as UserMetadata);
      } catch (err) {
        console.error("Failed to get user metadata", err);
      }
    })();
  }, []);

  /* -------------------------
     Query options
     ------------------------- */
  const commonQueryOptions = {
    staleTime: 1000 * 60 * 5, // 5 minutes
    cacheTime: 1000 * 60 * 30, // 30 minutes
    keepPreviousData: true,
  } as const;

  /* -------------------------
     Reference tables (branches/products/materials)
     ------------------------- */

  const branchesQuery = useQuery<Branch[], Error>({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
    ...commonQueryOptions,
  });

  const productsQuery = useQuery<Product[], Error>({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
    ...commonQueryOptions,
  });

  const materialsQuery = useQuery<Material[], Error>({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Material[];
    },
    ...commonQueryOptions,
  });

  /* -------------------------
     Cost-type queries
     ------------------------- */
  const complimentaryCostsQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["complimentary_costs", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("complimentary_products").select("cost, created_at, branch_id");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const materialDamageCostsQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["material_damage_costs", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("damaged_materials").select("cost, created_at, branch_id");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const damageCostsQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["damage_costs", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("product_damages").select("cost, created_at, branch_id");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const imprestCostsQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["imprest_costs", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("imprest_supplied").select("cost, created_at, branch_id");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const indirectMaterialCostsQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["indirect_material_costs", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("material_usage").select("cost, created_at, branch_id");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  /* -------------------------
     Sales (with nested items)
     ------------------------- */
  const salesQuery = useQuery<Sale[], Error>({
    queryKey: ["sales", dateRange, selectedBranch, selectedProduct],
    queryFn: async () => {
      let q: any = supabase.from("sales").select(
        `
        *,
        branch:branches(name),
        items:sale_items(
          quantity,
          unit_price,
          unit_cost,
          total_cost,
          subtotal,
          product:products(*)
        )
        `
      );

      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);

      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;

      const casted = (data ?? []) as Sale[];

      if (selectedProduct !== "all") {
        // filter items to the selected product (client-side)
        return casted.map((sale) => ({
          ...sale,
          items: (sale.items || []).filter(
            (it) => String(it?.product?.id ?? it?.product_id) === String(selectedProduct)
          ),
        }));
      }

      return casted;
    },
    ...commonQueryOptions,
  });

  /* -------------------------
     Product & Material movement tables (explicitly typed)
     ------------------------- */
  const productClosingStockQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["product_closing_stock", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("product_closing_stock").select("*");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const productInventoryQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["product_inventory", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("product_inventory").select("*");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const productDamagesQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["product_damages", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("product_damages").select("*");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const productTransfersInQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["product_transfers_in", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("product_transfers_in").select("*");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const productionQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["production", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("production").select("*");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const productTransfersOutQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["product_transfers_out", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("product_transfers_out").select("*");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  /* -------------------------
     Material queries
     ------------------------- */
  const materialClosingStockQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["material_closing_stock", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("material_closing_stock").select("*");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const inventoryQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["inventory", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("inventory").select("*");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const damagedMaterialsQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["damaged_materials", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("damaged_materials").select("*");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const materialTransfersInQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["material_transfers_in", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("material_transfers_in").select("*");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const procurementSuppliedQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["procurement_supplied", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("procurement_supplied").select("*");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  const materialTransfersOutQuery = useQuery<SimpleRecord[], Error>({
    queryKey: ["material_transfers_out", dateRange, selectedBranch],
    queryFn: async () => {
      let q: any = supabase.from("material_transfers_out").select("*");
      q = applyDateFilter(q, dateRange);
      if (selectedBranch !== "all") q = q.eq("branch_id", selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SimpleRecord[];
    },
    ...commonQueryOptions,
  });

  /* -------------------------
     Convenience - coerce data to arrays (avoid 'never | ...' unions)
     ------------------------- */
  const branchesArr = branchesQuery.data ?? [];
  const productsArr = productsQuery.data ?? [];
  const materialsArr = materialsQuery.data ?? [];

  const complimentaryCosts = complimentaryCostsQuery.data ?? [];
  const materialDamageCosts = materialDamageCostsQuery.data ?? [];
  const damageCosts = damageCostsQuery.data ?? [];
  const imprestCosts = imprestCostsQuery.data ?? [];
  const indirectMaterialCosts = indirectMaterialCostsQuery.data ?? [];

  const salesArr = salesQuery.data ?? [];

  const productClosingStock = productClosingStockQuery.data ?? [];
  const productInventory = productInventoryQuery.data ?? [];
  const productDamages = productDamagesQuery.data ?? [];
  const productTransfersIn = productTransfersInQuery.data ?? [];
  const production = productionQuery.data ?? [];
  const productTransfersOut = productTransfersOutQuery.data ?? [];

  const materialClosingStock = materialClosingStockQuery.data ?? [];
  const inventoryArr = inventoryQuery.data ?? [];
  const damagedMaterials = damagedMaterialsQuery.data ?? [];
  const materialTransfersIn = materialTransfersInQuery.data ?? [];
  const procurementSupplied = procurementSuppliedQuery.data ?? [];
  const materialTransfersOut = materialTransfersOutQuery.data ?? [];

  /* -------------------------
     Helper price lookup
     ------------------------- */
  const getProductPrice = (product_id?: string | null) => {
    if (!product_id) return 0;
    const p = productsArr.find((x) => String(x.id) === String(product_id));
    return safeNumber(p?.price);
  };

  const getMaterialPrice = (material_id?: string | null) => {
    if (!material_id) return 0;
    const m = materialsArr.find((x) => String(x.id) === String(material_id));
    return safeNumber(m?.unit_price);
  };

  /* -------------------------
     Find latest record before/on date (optionally filtered by predicate)
     ------------------------- */
//   function getLatest(
//   arr: SimpleRecord[],
//   date: Date,
//   key: keyof SimpleRecord,
//   predicate?: (item: SimpleRecord) => boolean
// ): number {
//   if (!arr || arr.length === 0) return 0;

//   const filtered = arr
//     .filter((item) => {
//       if (!item?.created_at) return false;
//       if (predicate && !predicate(item)) return false;
//       const created = dayjs(item.created_at);
//       return created.isSame(dayjs(date), "day") || created.isBefore(dayjs(date), "day");
//     })
//     .sort((a, b) => dayjs(b.created_at!).valueOf() - dayjs(a.created_at!).valueOf());

//   if (filtered.length === 0) return 0;
//   return safeNumber(filtered[0][key] as any);
// }
  /* -------------------------
     Aggregations (stockMetricsValue + metrics)
     ------------------------- */
  const stockMetricsValue = useMemo(() => {
    const fromDate = dateRange?.from ? new Date(dateRange.from) : undefined;
    const toDate = dateRange?.to ? new Date(dateRange.to) : fromDate;

    const isOnDate = (item: SimpleRecord, date: Date) => dayjs(item.created_at).isSame(dayjs(date), "day");
    const isInRange = (item: SimpleRecord, start: Date, end: Date) =>
      dayjs(item.created_at).isBetween(dayjs(start).startOf("day"), dayjs(end).endOf("day"), null, "[]");

    // --- PRODUCT ---
    // Build unique (product_id, branch_id) pairs from productInventory (so we can sum per branch when 'all' is selected)
    const productPairs = Array.from(
      new Set(productInventory.map((it) => `${it.product_id}||${it.branch_id}`).filter(Boolean))
    ).map((s) => {
      const [product_id, branch_id] = s.split("||");
      return { product_id, branch_id };
    }) as { product_id: string; branch_id: string }[];

    // If a specific branch is selected, restrict pairs to that branch
    const productPairsFiltered = selectedBranch === "all" ? productPairs : productPairs.filter((p) => String(p.branch_id) === String(selectedBranch));

    let openingProductValue = 0;
    productPairsFiltered.forEach(({ product_id, branch_id }) => {
      const groupRecords = productInventory.filter(
        (it) => String(it.product_id) === String(product_id) && String(it.branch_id) === String(branch_id)
      );
      const val = getOpeningStockForGroup(groupRecords, dateRange);
      openingProductValue += safeNumber(val) * getProductPrice(product_id);
    });

    // Closing product uses product_closing_stock table grouped by product+branch
    const closingPairs = Array.from(
      new Set(productClosingStock.map((it) => `${it.product_id}||${it.branch_id}`).filter(Boolean))
    ).map((s) => {
      const [product_id, branch_id] = s.split("||");
      return { product_id, branch_id };
    }) as { product_id: string; branch_id: string }[];

    const closingPairsFiltered = selectedBranch === "all" ? closingPairs : closingPairs.filter((p) => String(p.branch_id) === String(selectedBranch));

    let closingProductValue = 0;
    closingPairsFiltered.forEach(({ product_id, branch_id }) => {
      const groupRecords = productClosingStock.filter(
        (it) => String(it.product_id) === String(product_id) && String(it.branch_id) === String(branch_id)
      );
      const val = getClosingStockForGroup(groupRecords, dateRange);
      closingProductValue += safeNumber(val) * getProductPrice(product_id);
    });

    const damagesProductValue = productDamages.reduce((acc, item) => {
      const include = fromDate && toDate ? isInRange(item, fromDate, toDate) : fromDate ? isOnDate(item, fromDate) : true;
      if (!include) return acc;
      return acc + safeNumber(item.quantity) * getProductPrice(item.product_id as string);
    }, 0 as number);

    const productStockInValue =
      productInventory.reduce((acc, item) => {
        const include = fromDate && toDate ? isInRange(item, fromDate, toDate) : fromDate ? isOnDate(item, fromDate) : true;
        if (!include) return acc;
        return acc + safeNumber(item.quantity) * getProductPrice(item.product_id);
      }, 0 as number) +
      productTransfersIn.reduce((acc, item) => {
        const include = fromDate && toDate ? isInRange(item, fromDate, toDate) : fromDate ? isOnDate(item, fromDate) : true;
        if (!include) return acc;
        return acc + safeNumber(item.quantity) * getProductPrice(item.product_id);
      }, 0 as number) +
      production.reduce((acc, item) => {
        const include = fromDate && toDate ? isInRange(item, fromDate, toDate) : fromDate ? isOnDate(item, fromDate) : true;
        if (!include) return acc;
        // production might have 'yield' or 'quantity'
        const produced = (item as any).yield ?? item.quantity ?? 0;
        return acc + safeNumber(produced) * getProductPrice(item.product_id);
      }, 0 as number);

    const transfersOutProductValue = productTransfersOut.reduce((acc, item) => {
      const include = fromDate && toDate ? isInRange(item, fromDate, toDate) : fromDate ? isOnDate(item, fromDate) : true;
      if (!include) return acc;
      return acc + safeNumber(item.quantity) * getProductPrice(item.product_id);
    }, 0 as number);

    // --- MATERIAL ---
    // Opening materials: group by material_id + branch
    const materialPairs = Array.from(
      new Set(inventoryArr.map((it) => `${it.material_id}||${it.branch_id}`).filter(Boolean))
    ).map((s) => {
      const [material_id, branch_id] = s.split("||");
      return { material_id, branch_id };
    }) as { material_id: string; branch_id: string }[];

    const materialPairsFiltered = selectedBranch === "all" ? materialPairs : materialPairs.filter((p) => String(p.branch_id) === String(selectedBranch));

    let openingMaterialValue = 0;
    materialPairsFiltered.forEach(({ material_id, branch_id }) => {
      const groupRecords = inventoryArr.filter(
        (it) => String(it.material_id) === String(material_id) && String(it.branch_id) === String(branch_id)
      );
      const val = getOpeningStockForGroup(groupRecords, dateRange);
      openingMaterialValue += safeNumber(val) * getMaterialPrice(material_id);
    });

    // Closing materials: use material_closing_stock grouped
    const closingMaterialPairs = Array.from(
      new Set(materialClosingStock.map((it) => `${it.material_id}||${it.branch_id}`).filter(Boolean))
    ).map((s) => {
      const [material_id, branch_id] = s.split("||");
      return { material_id, branch_id };
    }) as { material_id: string; branch_id: string }[];

    const closingMaterialPairsFiltered = selectedBranch === "all" ? closingMaterialPairs : closingMaterialPairs.filter((p) => String(p.branch_id) === String(selectedBranch));

    let closingMaterialValue = 0;
    closingMaterialPairsFiltered.forEach(({ material_id, branch_id }) => {
      const groupRecords = materialClosingStock.filter(
        (it) => String(it.material_id) === String(material_id) && String(it.branch_id) === String(branch_id)
      );
      const val = getClosingStockForGroup(groupRecords, dateRange);
      closingMaterialValue += safeNumber(val) * getMaterialPrice(material_id);
    });

    const damagesMaterialValue = damagedMaterials.reduce((acc, item) => {
      const include = fromDate && toDate ? isInRange(item, fromDate, toDate) : fromDate ? isOnDate(item, fromDate) : true;
      if (!include) return acc;
      return acc + safeNumber(item.quantity) * getMaterialPrice(item.material_id as string);
    }, 0 as number);

    const stockInMaterialValue =
      inventoryArr.reduce((acc, item) => {
        const include = fromDate && toDate ? isInRange(item, fromDate, toDate) : fromDate ? isOnDate(item, fromDate) : true;
        if (!include) return acc;
        return acc + safeNumber(item.quantity) * getMaterialPrice(item.material_id as string);
      }, 0 as number) +
      materialTransfersIn.reduce((acc, item) => {
        const include = fromDate && toDate ? isInRange(item, fromDate, toDate) : fromDate ? isOnDate(item, fromDate) : true;
        if (!include) return acc;
        return acc + safeNumber(item.quantity) * getMaterialPrice(item.material_id as string);
      }, 0 as number) +
      procurementSupplied.reduce((acc, item) => {
        const include = fromDate && toDate ? isInRange(item, fromDate, toDate) : fromDate ? isOnDate(item, fromDate) : true;
        if (!include) return acc;
        return acc + safeNumber(item.quantity) * getMaterialPrice(item.material_id as string);
      }, 0 as number);

    const transfersOutMaterialValue = materialTransfersOut.reduce((acc, item) => {
      const include = fromDate && toDate ? isInRange(item, fromDate, toDate) : fromDate ? isOnDate(item, fromDate) : true;
      if (!include) return acc;
      return acc + safeNumber(item.quantity) * getMaterialPrice(item.material_id as string);
    }, 0 as number);

    return {
      material: {
        opening: openingMaterialValue,
        closing: closingMaterialValue,
        damages: damagesMaterialValue,
        stockIn: stockInMaterialValue,
        transfersOut: transfersOutMaterialValue,
      },
      product: {
        opening: openingProductValue,
        closing: closingProductValue,
        damages: damagesProductValue,
        stockIn: productStockInValue,
        transfersOut: transfersOutProductValue,
      },
      total: {
        opening: openingMaterialValue + openingProductValue,
        closing: closingMaterialValue + closingProductValue,
        damages: damagesMaterialValue + damagesProductValue,
        stockIn: stockInMaterialValue + productStockInValue,
        transfersOut: transfersOutMaterialValue + transfersOutProductValue,
      },
    };
  }, [
    dateRange,
    productClosingStock,
    productInventory,
    productDamages,
    productTransfersIn,
    production,
    productTransfersOut,
    materialClosingStock,
    inventoryArr,
    damagedMaterials,
    materialTransfersIn,
    procurementSupplied,
    materialTransfersOut,
    productsArr,
    materialsArr,
    selectedBranch,
  ]);

  /* -------------------------
     Metrics (revenue/costs)
     ------------------------- */
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalItems = 0;

    salesArr.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        totalRevenue += safeNumber(item.subtotal);
        totalCost += safeNumber(item.total_cost);
        totalItems += safeNumber(item.quantity);
      });
    });

    const sumCost = (arr: SimpleRecord[]) => arr.reduce((acc, curr) => acc + safeNumber(curr.cost), 0 as number);

    totalCost += sumCost(complimentaryCosts);
    totalCost += sumCost(damageCosts);
    totalCost += sumCost(imprestCosts);
    totalCost += sumCost(materialDamageCosts);
    totalCost += sumCost(indirectMaterialCosts);

    const profit = totalRevenue - totalCost;
    const costToRevenueRatio = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

    return {
      revenue: totalRevenue,
      cost: totalCost,
      profit,
      costToRevenueRatio,
      totalItems,
    };
  }, [salesArr, complimentaryCosts, damageCosts, imprestCosts, materialDamageCosts, indirectMaterialCosts]);

  /* -------------------------
     accountData used for export
     ------------------------- */
  const accountData = useMemo(() => {
    return {
      username: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
      userBranch: branchName || "All Branches",
      dateRange: !dateRange
        ? "All time"
        : `${dayjs(dateRange.from).format("Do MMMM YYYY")} - ${dayjs(dateRange.to).format("Do MMMM YYYY")}`,
      filters: {
        branches: selectedBranch === "all" ? "All Branches" : branchesArr.find((b) => b.id === selectedBranch)?.name,
        products: selectedProduct === "all" ? "All Products" : productsArr.find((p) => p.id === selectedProduct)?.name,
      },
      financialSummary: {
        totalRevenue: metrics.revenue,
        itemsSold: metrics.totalItems,
        totalCost: metrics.cost,
        netProfit: metrics.profit,
        costRevenueRatio: metrics.costToRevenueRatio.toFixed(1),
      },
      salesDetails: salesArr.map((x) => ({
        date: dayjs(x?.created_at).format("D MMMM, YYYY"),
        branch: branchesArr.find((b) => b.id === x?.branch_id)?.name || "",
        items: (x?.items || []).map((t) => `${t?.quantity}x ${t?.product?.name || ""}`).join(", "),
        amount: naira(x?.total_amount || 0),
      })),
      revenueVsCost: {
        labels: salesArr.length ? salesArr.map((s) => dayjs(s.created_at).format("DD/MM/YYYY")) : [],
        revenue: [metrics.revenue],
        cost: [metrics.cost],
      },
    };
  }, [branchesArr, dateRange, metrics, salesArr, selectedBranch, selectedProduct, productsArr, user?.first_name, user?.last_name, branchName]);

  /* -------------------------
     Loading & errors aggregation
     ------------------------- */
  const anyLoading = [
    branchesQuery.isLoading,
    productsQuery.isLoading,
    materialsQuery.isLoading,
    salesQuery.isLoading,
    complimentaryCostsQuery.isLoading,
    materialDamageCostsQuery.isLoading,
    damageCostsQuery.isLoading,
    imprestCostsQuery.isLoading,
    indirectMaterialCostsQuery.isLoading,
    productClosingStockQuery.isLoading,
    productInventoryQuery.isLoading,
    productDamagesQuery.isLoading,
    productTransfersInQuery.isLoading,
    productionQuery.isLoading,
    productTransfersOutQuery.isLoading,
    materialClosingStockQuery.isLoading,
    inventoryQuery.isLoading,
    damagedMaterialsQuery.isLoading,
    materialTransfersInQuery.isLoading,
    procurementSuppliedQuery.isLoading,
    materialTransfersOutQuery.isLoading,
  ].some(Boolean);

  const getErrMsg = (e: any) => (e ? (e?.message ? String(e.message) : String(e)) : null);

  const allErrors = [
    getErrMsg(branchesQuery.error),
    getErrMsg(productsQuery.error),
    getErrMsg(materialsQuery.error),
    getErrMsg(salesQuery.error),
    getErrMsg(complimentaryCostsQuery.error),
    getErrMsg(materialDamageCostsQuery.error),
    getErrMsg(damageCostsQuery.error),
    getErrMsg(imprestCostsQuery.error),
    getErrMsg(indirectMaterialCostsQuery.error),
    getErrMsg(productClosingStockQuery.error),
    getErrMsg(productInventoryQuery.error),
    getErrMsg(productDamagesQuery.error),
    getErrMsg(productTransfersInQuery.error),
    getErrMsg(productionQuery.error),
    getErrMsg(productTransfersOutQuery.error),
    getErrMsg(materialClosingStockQuery.error),
    getErrMsg(inventoryQuery.error),
    getErrMsg(damagedMaterialsQuery.error),
    getErrMsg(materialTransfersInQuery.error),
    getErrMsg(procurementSuppliedQuery.error),
    getErrMsg(materialTransfersOutQuery.error),
  ].filter(Boolean) as string[];

  /* -------------------------
     Render
     ------------------------- */
  return (
    <div className="space-y-6 p-3 bg-transparent rounded-lg shadow-md w-full mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Accounts</h2>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={() => {
              try {
                // original utility expects an object and returns { pdf, spreadsheet }
                generateReport({ data: accountData }).pdf();
              } catch (err) {
                console.error("Failed to export PDF", err);
              }
            }}
            disabled={anyLoading}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <DatePickerWithRange date={dateRange} setDate={setDateRange} />

        <Select value={selectedBranch} onValueChange={(v: string) => setSelectedBranch(v)} disabled={branchesQuery.isLoading}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Select Branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branchesArr.map((branch) => (
              <SelectItem key={branch.id} value={String(branch.id)}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedProduct} onValueChange={(v: string) => setSelectedProduct(v)} disabled={productsQuery.isLoading}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Select Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {productsArr.map((product) => (
              <SelectItem key={product.id} value={String(product.id)}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {anyLoading && (
        <div className="flex items-center gap-2 text-muted text-sm">
          <Spinner size={16} /> <span>Loading data...</span>
        </div>
      )}

      <ErrorBanner messages={allErrors} />

      <AccountsMetricsCards metrics={metrics} stockMetrics={stockMetricsValue} ref={ContentRef} />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Cost</CardTitle>
          </CardHeader>
          <CardContent>
            {salesQuery.isLoading ? (
              <div className="flex items-center gap-2">
                <Spinner /> <span>Loading chart...</span>
              </div>
            ) : (
              <AccountsChart data={salesArr} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {productInventoryQuery.isLoading ? (
              <div className="flex items-center gap-2">
                <Spinner /> <span>Loading product performance...</span>
              </div>
            ) : (
              <ProductPerformance salesData={salesArr} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branch Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {salesQuery.isLoading ? (
            <div className="flex items-center gap-2">
              <Spinner /> <span>Loading branch performance...</span>
            </div>
          ) : (
            <BranchPerformance
              salesData={salesArr}
              branches={branchesArr}
              complimentaryCosts={complimentaryCosts}
              damageCosts={damageCosts}
              imprestCosts={imprestCosts}
              materialDamageCosts={materialDamageCosts}
              indirectMaterialCosts={indirectMaterialCosts}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Accounts;