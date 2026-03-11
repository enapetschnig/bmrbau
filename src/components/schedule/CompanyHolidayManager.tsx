import { useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Trash2, Plus, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { CompanyHoliday } from "./scheduleTypes";

interface Props {
  holidays: CompanyHoliday[];
  onUpdate: () => void;
  userId: string;
}

export function CompanyHolidayManager({ holidays, onUpdate, userId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("Betriebsurlaub");

  const handleAdd = async () => {
    if (!newDate) return;

    const { error } = await supabase.from("company_holidays").insert({
      datum: newDate,
      bezeichnung: newLabel || "Betriebsurlaub",
      created_by: userId,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error.message,
      });
      return;
    }

    setNewDate("");
    setNewLabel("Betriebsurlaub");
    onUpdate();
    toast({ title: "Betriebsurlaub hinzugefügt" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("company_holidays")
      .delete()
      .eq("id", id);
    if (error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error.message,
      });
      return;
    }
    onUpdate();
  };

  const sorted = [...holidays].sort(
    (a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarOff className="h-4 w-4 mr-2" />
          Betriebsurlaub
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Betriebsurlaub verwalten</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new */}
          <div className="flex gap-2">
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="flex-1"
            />
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Bezeichnung"
              className="flex-1"
            />
            <Button size="sm" onClick={handleAdd} disabled={!newDate}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* List */}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine Betriebsurlaube eingetragen
              </p>
            ) : (
              sorted.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-2 px-2 py-1.5 bg-muted/30 rounded"
                >
                  <span className="text-sm font-mono">
                    {format(parseISO(h.datum), "dd.MM.yyyy")}
                  </span>
                  <span className="text-sm flex-1 truncate text-muted-foreground">
                    {h.bezeichnung}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDelete(h.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
