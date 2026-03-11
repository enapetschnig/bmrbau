import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Profile, Project, Assignment } from "./scheduleTypes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile | null;
  date: Date | null;
  assignment: Assignment | null;
  projects: Project[];
  onAssign: (userId: string, date: Date, projectId: string) => void;
  onRemove: (userId: string, date: Date) => void;
}

export function AssignmentPopover({
  open,
  onOpenChange,
  profile,
  date,
  assignment,
  projects,
  onAssign,
  onRemove,
}: Props) {
  if (!profile || !date) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            {profile.vorname} {profile.nachname}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(date, "EEEE, dd. MMMM yyyy", { locale: de })}
          </p>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <Select
            value={assignment?.project_id || ""}
            onValueChange={(val) => {
              onAssign(profile.id, date, val);
              onOpenChange(false);
            }}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Projekt zuweisen..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {assignment && (
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => {
                onRemove(profile.id, date);
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Zuweisung entfernen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
