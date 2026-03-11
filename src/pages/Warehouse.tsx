import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WarehouseStockTab } from "@/components/warehouse/WarehouseStockTab";
import { WarehouseDeliveryNotesTab } from "@/components/warehouse/WarehouseDeliveryNotesTab";
import { WarehouseProductsTab } from "@/components/warehouse/WarehouseProductsTab";

export default function Warehouse() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "administrator")
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Lagerverwaltung" backPath="/" />
      <div className="container mx-auto p-4 max-w-6xl">
        <Tabs defaultValue="stock" className="space-y-4">
          <TabsList className={`grid w-full ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="stock">Lagerbestand</TabsTrigger>
            <TabsTrigger value="notes">Lieferscheine</TabsTrigger>
            {isAdmin && <TabsTrigger value="products">Produkte</TabsTrigger>}
          </TabsList>
          <TabsContent value="stock">
            <WarehouseStockTab isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="notes">
            <WarehouseDeliveryNotesTab isAdmin={isAdmin} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="products">
              <WarehouseProductsTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
