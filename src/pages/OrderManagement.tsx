import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { OrderCard, type Order } from "@/components/OrderCard";
import { OrderCreateDialog } from "@/components/OrderCreateDialog";
import { type OrderItem } from "@/components/OrderItemList";

export default function OrderManagement() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    checkAdmin();
    fetchProjectName();
  }, [projectId]);

  useEffect(() => {
    fetchOrders();
  }, [projectId]);

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

  const fetchProjectName = async () => {
    if (!projectId) return;
    const { data } = await supabase.from("projects").select("name").eq("id", projectId).single();
    if (data) setProjectName(data.name);
  };

  const fetchOrders = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    const { data: ordersData, error } = await supabase
      .from("orders")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: "Bestellungen konnten nicht geladen werden" });
      setLoading(false);
      return;
    }

    if (!ordersData || ordersData.length === 0) {
      setOrders([]);
      setOrderItems({});
      setLoading(false);
      return;
    }

    // Fetch creator names
    const userIds = [...new Set(ordersData.map(o => o.user_id))];
    const { data: profiles } = await supabase
      .from("employees")
      .select("user_id, vorname, nachname")
      .in("user_id", userIds);

    const nameMap: Record<string, string> = {};
    profiles?.forEach(p => {
      if (p.user_id) nameMap[p.user_id] = `${p.vorname} ${p.nachname}`.trim();
    });

    const mappedOrders: Order[] = ordersData.map(o => ({
      ...o,
      creator_name: nameMap[o.user_id] || undefined,
    }));

    setOrders(mappedOrders);

    // Fetch all items for these orders
    const orderIds = ordersData.map(o => o.id);
    const { data: allItems } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds)
      .order("sort_order");

    const grouped: Record<string, OrderItem[]> = {};
    orderIds.forEach(id => { grouped[id] = []; });
    allItems?.forEach(item => {
      if (grouped[item.order_id]) {
        grouped[item.order_id].push(item);
      }
    });
    setOrderItems(grouped);

    // Auto-update order status
    for (const order of mappedOrders) {
      const items = grouped[order.id] || [];
      if (items.length === 0) continue;
      const allDelivered = items.every(i => i.status === "geliefert");
      const someDelivered = items.some(i => i.status === "geliefert");
      const expectedStatus = allDelivered ? "vollstaendig" : someDelivered ? "teilweise_geliefert" : "offen";
      if (order.status !== expectedStatus) {
        await supabase.from("orders").update({ status: expectedStatus, updated_at: new Date().toISOString() }).eq("id", order.id);
        order.status = expectedStatus;
      }
    }

    setLoading(false);
  }, [projectId]);

  const handleDelete = async (orderId: string) => {
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: "Bestellung konnte nicht gelöscht werden" });
      return;
    }
    toast({ title: "Gelöscht", description: "Bestellung wurde entfernt" });
    fetchOrders();
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6" />
              Bestellungen
            </h1>
            {projectName && <p className="text-sm text-muted-foreground">{projectName}</p>}
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Neue Bestellung</span>
            <span className="sm:hidden">Neu</span>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Lade Bestellungen...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Keine Bestellungen</p>
          <p className="text-sm mt-1">
            {isAdmin ? "Erstellen Sie eine neue Bestellung mit Screenshot oder manueller Eingabe." : "Es wurden noch keine Bestellungen erfasst."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              items={orderItems[order.id] || []}
              isAdmin={isAdmin}
              onUpdate={fetchOrders}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      {projectId && (
        <OrderCreateDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          projectId={projectId}
          onSuccess={fetchOrders}
        />
      )}
    </div>
  );
}
