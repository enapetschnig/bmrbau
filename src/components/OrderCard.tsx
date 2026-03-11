import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, Trash2, Image } from "lucide-react";
import { OrderItemList, type OrderItem } from "./OrderItemList";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export type Order = {
  id: string;
  project_id: string;
  user_id: string;
  screenshot_url: string | null;
  title: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  creator_name?: string;
};

interface OrderCardProps {
  order: Order;
  items: OrderItem[];
  isAdmin: boolean;
  onUpdate: () => void;
  onDelete: (orderId: string) => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  offen: { label: "Offen", variant: "outline" },
  teilweise_geliefert: { label: "Teilweise geliefert", variant: "secondary" },
  vollstaendig: { label: "Vollständig", variant: "default" },
};

export function OrderCard({ order, items, isAdmin, onUpdate, onDelete }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);

  const delivered = items.filter(i => i.status === "geliefert").length;
  const total = items.length;
  const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.offen;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <span className="truncate">{order.title || "Bestellung"}</span>
                <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(order.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                {order.creator_name && ` — ${order.creator_name}`}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {order.screenshot_url && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowScreenshot(true)}>
                  <Image className="w-4 h-4" />
                </Button>
              )}
              {isAdmin && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => onDelete(order.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress bar summary */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-500 h-full rounded-full transition-all"
                style={{ width: total > 0 ? `${(delivered / total) * 100}%` : "0%" }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground shrink-0">
              {delivered}/{total}
            </span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          {order.notes && (
            <p className="text-xs text-muted-foreground">{order.notes}</p>
          )}

          {/* Expanded item list */}
          {expanded && (
            <OrderItemList items={items} onUpdate={onUpdate} />
          )}
        </CardContent>
      </Card>

      {/* Screenshot dialog */}
      <Dialog open={showScreenshot} onOpenChange={setShowScreenshot}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto p-2">
          {order.screenshot_url && (
            <img src={order.screenshot_url} alt="Bestellung" className="w-full rounded" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
