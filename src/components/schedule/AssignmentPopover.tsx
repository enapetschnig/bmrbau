import { useState, useEffect } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
} from "@/components/ui/dialog";
import type { Profile, Project, Assignment } from "./scheduleTypes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile | null;
  date: Date | null;
  assignment: Assignment | null;
  projects: Project[];
  onAssign: (userId: string, date: Date, projectId: string, notizen?: string) => void;
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
  const [selectedProject, setSelectedProject] = useState(assignment?.project_id || "");
  const [notizen, setNotizen] = useState(assignment?.notizen || "");

  useEffect(() => {
    setSelectedProject(assignment?.project_id || "");
    setNotizen(assignment?.notizen || "");
  }, [assignment, open]);

  if (!profile || !date) return null;

  const handleSave = () => {
    if (!selectedProject) return;
    onAssign(profile.id, date, selectedProject, notizen || undefined);
    onOpenChange(false);
  };

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
          <Select value={selectedProject} onValueChange={setSelectedProject}>
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

          <Textarea
            placeholder="Notiz für den Mitarbeiter (optional)..."
            value={notizen}
            onChange={(e) => setNotizen(e.target.value)}
            rows={3}
            className="text-sm resize-none"
          />

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

        <DialogFooter>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!selectedProject}
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
