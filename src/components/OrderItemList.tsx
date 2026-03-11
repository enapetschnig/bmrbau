import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Check } from "lucide-react";

export type OrderItem = {
  id: string;
  order_id: string;
  material: string;
  menge: string | null;
  einheit: string | null;
  status: string;
  checked_by: string | null;
  checked_at: string | null;
  comment: string | null;
  sort_order: number;
};

interface OrderItemListProps {
  items: OrderItem[];
  onUpdate: () => void;
  readOnly?: boolean;
}

export function OrderItemList({ items, onUpdate, readOnly }: OrderItemListProps) {
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const toggleStatus = async (item: OrderItem) => {
    if (readOnly) return;

    const newStatus = item.status === "offen" ? "geliefert" : "offen";
    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from("order_items")
      .update({
        status: newStatus,
        checked_by: newStatus === "geliefert" ? user?.id || null : null,
        checked_at: newStatus === "geliefert" ? new Date().toISOString() : null,
      })
      .eq("id", item.id);

    onUpdate();
  };

  const saveComment = async (itemId: string) => {
    await supabase
      .from("order_items")
      .update({ comment: commentText.trim() || null })
      .eq("id", itemId);

    setCommentingId(null);
    setCommentText("");
    onUpdate();
  };

  const delivered = items.filter(i => i.status === "geliefert").length;
  const total = items.length;

  return (
    <div className="space-y-3">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-green-500 h-full rounded-full transition-all"
            style={{ width: total > 0 ? `${(delivered / total) * 100}%` : "0%" }}
          />
        </div>
        <span className="text-sm font-medium text-muted-foreground shrink-0">
          {delivered} / {total} geliefert
        </span>
      </div>

      {/* Items */}
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50">
              <Checkbox
                checked={item.status === "geliefert"}
                onCheckedChange={() => toggleStatus(item)}
                disabled={readOnly}
              />
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${item.status === "geliefert" ? "line-through text-muted-foreground" : ""}`}>
                  {item.material}
                </span>
              </div>
              {(item.menge || item.einheit) && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  {item.menge} {item.einheit}
                </Badge>
              )}
              <div className="flex items-center gap-1 shrink-0">
                {item.status === "geliefert" && (
                  <Badge variant="default" className="bg-green-600 text-xs">
                    <Check className="w-3 h-3" />
                  </Badge>
                )}
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      setCommentingId(commentingId === item.id ? null : item.id);
                      setCommentText(item.comment || "");
                    }}
                  >
                    <MessageSquare className={`w-3.5 h-3.5 ${item.comment ? "text-blue-500" : ""}`} />
                  </Button>
                )}
              </div>
            </div>

            {/* Comment */}
            {item.comment && commentingId !== item.id && (
              <p className="text-xs text-muted-foreground ml-9 italic">{item.comment}</p>
            )}
            {commentingId === item.id && (
              <div className="flex gap-2 ml-9">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Kommentar..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") saveComment(item.id); }}
                />
                <Button size="sm" className="h-8" onClick={() => saveComment(item.id)}>OK</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
