import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Package, AlertTriangle, Euro } from "lucide-react";
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  type WarehouseProduct,
  type WarehouseProductCategory,
} from "@/types/warehouse";

interface Props {
  isAdmin: boolean;
}

export function WarehouseStockTab({ isAdmin }: Props) {
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<WarehouseProductCategory | "all">("all");

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("warehouse_products")
      .select("*")
      .eq("is_active", true)
      .order("category")
      .order("name");
    if (data) setProducts(data as unknown as WarehouseProduct[]);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      CATEGORY_LABELS[p.category]?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === "all" || p.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const totalProducts = products.length;
  const lowStockCount = products.filter((p) => p.current_stock <= 0).length;
  const totalValue = isAdmin
    ? products.reduce((sum, p) => sum + (p.ek_preis || 0) * Math.max(0, p.current_stock), 0)
    : 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className={`grid gap-3 ${isAdmin ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Produkte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold">{totalProducts}</span>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lagerwert</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Euro className="w-5 h-5 text-green-500" />
                <span className="text-2xl font-bold">€ {totalValue.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Niedrigbestand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${lowStockCount > 0 ? "text-red-500" : "text-green-500"}`} />
              <span className={`text-2xl font-bold ${lowStockCount > 0 ? "text-red-600" : ""}`}>
                {lowStockCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <Badge
            variant={filterCategory === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilterCategory("all")}
          >
            Alle
          </Badge>
          {CATEGORY_OPTIONS.map((cat) => (
            <Badge
              key={cat}
              variant={filterCategory === cat ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilterCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </Badge>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Einheit</TableHead>
                  {isAdmin && <TableHead className="text-right">EK-Preis</TableHead>}
                  <TableHead className="text-right">Bestand</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-8">
                      Keine Produkte gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{CATEGORY_LABELS[p.category] || p.category}</Badge>
                      </TableCell>
                      <TableCell>{p.einheit}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {p.ek_preis != null ? `€ ${p.ek_preis.toFixed(2)}` : "–"}
                        </TableCell>
                      )}
                      <TableCell
                        className={`text-right font-bold ${
                          p.current_stock < 0
                            ? "text-red-600"
                            : p.current_stock === 0
                            ? "text-orange-500"
                            : ""
                        }`}
                      >
                        {p.current_stock} {p.einheit}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
