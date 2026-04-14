import { useMemo, useState, useEffect } from "react";
import {
  startOfYear,
  endOfYear,
  startOfISOWeek,
  addWeeks,
  getISOWeek,
  format,
  isSameDay,
  parseISO,
  isWithinInterval,
  isBefore,
  isAfter,
} from "date-fns";
import { de } from "date-fns/locale";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getProjectColor } from "./scheduleUtils";
import type {
  Project,
  Assignment,
  CompanyHoliday,
  LeaveRequest,
} from "./scheduleTypes";

interface PlanBlock {
  id: string;
  project_id: string | null;
  title: string;
  color: string;
  start_week: number;
  end_week: number;
  year: number;
  partie: string | null;
  sort_order: number;
}

interface Props {
  year: number;
  projects: Project[];
  assignments: Assignment[];
  holidays: CompanyHoliday[];
  leaveRequests: LeaveRequest[];
}

const BLOCK_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#84CC16",
];

export function YearPlanningView({
  year,
  projects,
  assignments,
  holidays,
}: Props) {
  const { toast } = useToast();
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([]);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [editingBlock, setEditingBlock] = useState<PlanBlock | null>(null);
  const [blockForm, setBlockForm] = useState({
    title: "", projectId: "", color: BLOCK_COLORS[0],
    startWeek: "1", endWeek: "4", partie: "",
  });

  useEffect(() => {
    fetchPlanBlocks();
  }, [year]);

  const fetchPlanBlocks = async () => {
    const { data } = await supabase
      .from("yearly_plan_blocks")
      .select("*")
      .eq("year", year)
      .order("sort_order");
    if (data) setPlanBlocks(data as PlanBlock[]);
  };

  const handleSaveBlock = async () => {
    if (!blockForm.title.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      title: blockForm.title.trim(),
      project_id: blockForm.projectId || null,
      color: blockForm.color,
      start_week: parseInt(blockForm.startWeek),
      end_week: parseInt(blockForm.endWeek),
      year,
      partie: blockForm.partie.trim() || null,
      created_by: user.id,
    };

    if (editingBlock) {
      await supabase.from("yearly_plan_blocks").update(payload).eq("id", editingBlock.id);
    } else {
      await supabase.from("yearly_plan_blocks").insert(payload);
    }
    setShowBlockDialog(false);
    setEditingBlock(null);
    setBlockForm({ title: "", projectId: "", color: BLOCK_COLORS[0], startWeek: "1", endWeek: "4", partie: "" });
    fetchPlanBlocks();
  };

  const handleDeleteBlock = async (id: string) => {
    await supabase.from("yearly_plan_blocks").delete().eq("id", id);
    fetchPlanBlocks();
  };

  const openEditBlock = (block: PlanBlock) => {
    setEditingBlock(block);
    setBlockForm({
      title: block.title,
      projectId: block.project_id || "",
      color: block.color || BLOCK_COLORS[0],
      startWeek: block.start_week.toString(),
      endWeek: block.end_week.toString(),
      partie: block.partie || "",
    });
    setShowBlockDialog(true);
  };
  // Generate all ISO weeks for the year
  const weeks = useMemo(() => {
    const result: { weekNum: number; start: Date; month: string }[] = [];
    let current = startOfISOWeek(new Date(year, 0, 4)); // First ISO week
    const yearEnd = endOfYear(new Date(year, 0, 1));

    while (isBefore(current, yearEnd) || isSameDay(current, yearEnd)) {
      const weekNum = getISOWeek(current);
      result.push({
        weekNum,
        start: current,
        month: format(current, "MMM", { locale: de }),
      });
      current = addWeeks(current, 1);
      // Stop if we've gone past 53 weeks
      if (result.length > 53) break;
    }
    return result;
  }, [year]);

  // Group weeks by month for header
  const monthGroups = useMemo(() => {
    const groups: { month: string; span: number }[] = [];
    let lastMonth = "";
    for (const w of weeks) {
      if (w.month !== lastMonth) {
        groups.push({ month: w.month, span: 1 });
        lastMonth = w.month;
      } else {
        groups[groups.length - 1].span++;
      }
    }
    return groups;
  }, [weeks]);

  // Active projects (those with assignments this year)
  const activeProjectIds = [
    ...new Set(assignments.map((a) => a.project_id)),
  ];
  const activeProjects = projects.filter((p) =>
    activeProjectIds.includes(p.id)
  );

  // Check if a project has assignments in a given week
  const hasAssignmentsInWeek = (
    projectId: string,
    weekStart: Date
  ): number => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    return assignments.filter((a) => {
      if (a.project_id !== projectId) return false;
      const d = parseISO(a.datum);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    }).length;
  };

  const isHolidayWeek = (weekStart: Date): boolean => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 4);
    return holidays.some((h) => {
      const d = parseISO(h.datum);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    });
  };

  return (
    <>
    <div className="border rounded-lg overflow-x-auto">
      {/* Month header */}
      <div
        className="grid sticky top-0 z-20 bg-card border-b"
        style={{
          gridTemplateColumns: `minmax(140px, 200px) ${monthGroups
            .map((g) => `repeat(${g.span}, minmax(24px, 1fr))`)
            .join(" ")}`,
        }}
      >
        <div className="p-1 border-r sticky left-0 bg-card z-30" />
        {monthGroups.map((g, i) => (
          <div
            key={i}
            className="text-xs font-medium text-center py-1 border-r"
            style={{ gridColumn: `span ${g.span}` }}
          >
            {g.month}
          </div>
        ))}
      </div>

      {/* KW header */}
      <div
        className="grid sticky top-[28px] z-20 bg-card border-b"
        style={{
          gridTemplateColumns: `minmax(140px, 200px) repeat(${weeks.length}, minmax(24px, 1fr))`,
        }}
      >
        <div className="p-1 border-r text-xs text-muted-foreground sticky left-0 bg-card z-30">
          KW
        </div>
        {weeks.map((w) => (
          <div
            key={w.weekNum}
            className={`text-[10px] text-center py-0.5 border-r ${
              isHolidayWeek(w.start)
                ? "bg-gray-200 text-gray-400"
                : "text-muted-foreground"
            }`}
          >
            {w.weekNum}
          </div>
        ))}
      </div>

      {/* Project rows */}
      {activeProjects.map((project) => {
        const color = getProjectColor(project.id);
        return (
          <div
            key={project.id}
            className="grid border-b"
            style={{
              gridTemplateColumns: `minmax(140px, 200px) repeat(${weeks.length}, minmax(24px, 1fr))`,
            }}
          >
            <div className="p-1.5 border-r text-xs font-medium truncate sticky left-0 bg-card z-10">
              {project.name}
            </div>
            {weeks.map((w) => {
              const count = hasAssignmentsInWeek(project.id, w.start);
              const holiday = isHolidayWeek(w.start);
              return (
                <div
                  key={w.weekNum}
                  className={`border-r min-h-[24px] ${
                    holiday ? "bg-gray-100" : ""
                  }`}
                >
                  {count > 0 && (
                    <div
                      className={`h-full ${color.bg} ${color.border} border-y`}
                      title={`${project.name} – KW ${w.weekNum}: ${count} Zuweisungen`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {activeProjects.length === 0 && (
        <div className="px-3 py-8 text-sm text-muted-foreground text-center">
          Keine Projekte mit Zuweisungen in {year}
        </div>
      )}

      {/* Grobplanung Separator */}
      <div className="border-t-2 border-primary/30">
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
          <h3 className="text-sm font-semibold">Jahresgrobplanung</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingBlock(null);
              setBlockForm({ title: "", projectId: "", color: BLOCK_COLORS[0], startWeek: "1", endWeek: "4", partie: "" });
              setShowBlockDialog(true);
            }}
          >
            <Plus className="h-3 w-3 mr-1" /> Block
          </Button>
        </div>
      </div>

      {/* Plan blocks */}
      {planBlocks.map((block) => (
        <div
          key={block.id}
          className="grid border-b cursor-pointer hover:bg-muted/20"
          style={{
            gridTemplateColumns: `minmax(140px, 200px) repeat(${weeks.length}, minmax(24px, 1fr))`,
          }}
          onClick={() => openEditBlock(block)}
        >
          <div className="p-1.5 border-r text-xs font-medium truncate sticky left-0 bg-card z-10 flex items-center gap-1">
            <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span>{block.title}</span>
            {block.partie && <span className="text-muted-foreground">({block.partie})</span>}
          </div>
          {weeks.map((w) => {
            const inRange = w.weekNum >= block.start_week && w.weekNum <= block.end_week;
            const holiday = isHolidayWeek(w.start);
            return (
              <div
                key={w.weekNum}
                className={`border-r min-h-[24px] ${holiday ? "bg-gray-100" : ""}`}
              >
                {inRange && (
                  <div
                    className="h-full border-y"
                    style={{ backgroundColor: block.color + "40", borderColor: block.color }}
                    title={`${block.title}${block.partie ? ` (${block.partie})` : ""} – KW ${block.start_week}-${block.end_week}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}

      {planBlocks.length === 0 && (
        <div className="px-3 py-4 text-xs text-muted-foreground text-center">
          Noch keine Grobplanungsbloecke angelegt
        </div>
      )}
    </div>

    {/* Block Editor Dialog */}
    <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editingBlock ? "Block bearbeiten" : "Neuer Planungsblock"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titel *</Label>
            <Input value={blockForm.title} onChange={(e) => setBlockForm({ ...blockForm, title: e.target.value })} placeholder="z.B. Rohbau Graz Nord" />
          </div>
          <div>
            <Label>Projekt (optional)</Label>
            <Select value={blockForm.projectId} onValueChange={(v) => setBlockForm({ ...blockForm, projectId: v })}>
              <SelectTrigger><SelectValue placeholder="Kein Projekt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Kein Projekt</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Partie</Label>
            <Input value={blockForm.partie} onChange={(e) => setBlockForm({ ...blockForm, partie: e.target.value })} placeholder="z.B. Partie 1, Partie 2..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Von KW</Label>
              <Input type="number" min="1" max="53" value={blockForm.startWeek} onChange={(e) => setBlockForm({ ...blockForm, startWeek: e.target.value })} />
            </div>
            <div>
              <Label>Bis KW</Label>
              <Input type="number" min="1" max="53" value={blockForm.endWeek} onChange={(e) => setBlockForm({ ...blockForm, endWeek: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Farbe</Label>
            <div className="flex gap-1.5 mt-1">
              {BLOCK_COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-7 h-7 rounded-full border-2 ${blockForm.color === c ? "border-gray-900 ring-2 ring-offset-1 ring-gray-400" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setBlockForm({ ...blockForm, color: c })}
                  type="button"
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          {editingBlock && (
            <Button variant="destructive" size="sm" onClick={() => { handleDeleteBlock(editingBlock.id); setShowBlockDialog(false); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Loeschen
            </Button>
          )}
          <Button size="sm" onClick={handleSaveBlock} disabled={!blockForm.title.trim()}>
            {editingBlock ? "Speichern" : "Block erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
