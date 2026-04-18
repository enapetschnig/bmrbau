import {
  startOfISOWeek,
  addWeeks,
  subWeeks,
  getISOWeek,
  format,
  addDays,
} from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScheduleMode } from "./scheduleTypes";
import { useBuakWeekType } from "@/hooks/useBuakWeekType";

interface Props {
  weekStart: Date;
  onWeekChange: (date: Date) => void;
  mode: ScheduleMode;
  onModeChange?: (mode: ScheduleMode) => void;
  title?: string;
  children?: React.ReactNode;
  showYearToggle?: boolean;
}

export function ScheduleHeader({
  weekStart,
  onWeekChange,
  mode,
  onModeChange,
  title,
  children,
  showYearToggle = true,
}: Props) {
  const weekEnd = addDays(weekStart, 4);
  const buak = useBuakWeekType(weekStart);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <CalendarDays className="h-7 w-7" />
          {title ?? "Plantafel"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Zeit- und Ressourcenplanung
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Mode toggle */}
        {onModeChange && showYearToggle && (
          <Tabs
            value={mode}
            onValueChange={(v) => onModeChange(v as ScheduleMode)}
          >
            <TabsList className="h-9">
              <TabsTrigger value="week" className="text-xs px-3">
                Woche
              </TabsTrigger>
              <TabsTrigger value="year" className="text-xs px-3">
                Jahr
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Week navigation */}
        {mode === "week" && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => onWeekChange(subWeeks(weekStart, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => onWeekChange(startOfISOWeek(new Date()))}
            >
              Heute
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => onWeekChange(addWeeks(weekStart, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium ml-1 whitespace-nowrap">
              KW {getISOWeek(weekStart)} &middot;{" "}
              {format(weekStart, "dd.MM.", { locale: de })} –{" "}
              {format(weekEnd, "dd.MM.yyyy", { locale: de })}
            </span>
            <Badge
              variant={buak.weekType === "lang" ? "default" : "secondary"}
              className="ml-1 text-[10px] uppercase tracking-wide"
              title={buak.notiz ?? undefined}
            >
              {buak.weekType === "lang" ? "Lang" : "Kurz"}
            </Badge>
          </div>
        )}

        {mode === "year" && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                const prev = new Date(weekStart);
                prev.setFullYear(prev.getFullYear() - 1);
                onWeekChange(startOfISOWeek(prev));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2">
              {weekStart.getFullYear()}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                const next = new Date(weekStart);
                next.setFullYear(next.getFullYear() + 1);
                onWeekChange(startOfISOWeek(next));
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Extra buttons (e.g., CompanyHolidayManager) */}
        {children}
      </div>
    </div>
  );
}
