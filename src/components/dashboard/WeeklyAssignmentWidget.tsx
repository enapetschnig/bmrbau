import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfISOWeek,
  addDays,
  format,
  isSameDay,
  parseISO,
  isWithinInterval,
  getISOWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { getProjectColor } from "@/components/schedule/scheduleUtils";

type WeekAssignment = {
  datum: string;
  project_id: string;
  project_name: string;
};

type HolidayDay = {
  datum: string;
  bezeichnung: string | null;
};

type LeaveDay = {
  start_date: string;
  end_date: string;
  type: string;
};

interface Props {
  userId: string;
}

export function WeeklyAssignmentWidget({ userId }: Props) {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<WeekAssignment[]>([]);
  const [holidays, setHolidays] = useState<HolidayDay[]>([]);
  const [leaves, setLeaves] = useState<LeaveDay[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = startOfISOWeek(new Date());
  const weekEnd = addDays(weekStart, 4);
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    const fetch = async () => {
      const fromDate = format(weekStart, "yyyy-MM-dd");
      const toDate = format(weekEnd, "yyyy-MM-dd");

      const [{ data: assignData }, { data: holidayData }, { data: leaveData }] =
        await Promise.all([
          supabase
            .from("worker_assignments")
            .select("datum, project_id, projects:project_id(name)")
            .eq("user_id", userId)
            .gte("datum", fromDate)
            .lte("datum", toDate),
          supabase
            .from("company_holidays")
            .select("datum, bezeichnung")
            .gte("datum", fromDate)
            .lte("datum", toDate),
          supabase
            .from("leave_requests")
            .select("start_date, end_date, type")
            .eq("user_id", userId)
            .eq("status", "genehmigt")
            .lte("start_date", toDate)
            .gte("end_date", fromDate),
        ]);

      if (assignData) {
        setAssignments(
          assignData.map((a: any) => ({
            datum: a.datum,
            project_id: a.project_id,
            project_name: a.projects?.name || "–",
          }))
        );
      }

      if (holidayData) setHolidays(holidayData);
      if (leaveData) setLeaves(leaveData as LeaveDay[]);

      setLoading(false);
    };

    fetch();
  }, [userId]);

  // Don't show if no data at all
  if (loading) return null;

  const hasAnyData =
    assignments.length > 0 || holidays.length > 0 || leaves.length > 0;
  if (!hasAnyData) return null;

  return (
    <div
      className="mb-6 cursor-pointer"
      onClick={() => navigate("/schedule")}
    >
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        Meine Einteilung – KW {getISOWeek(weekStart)}
      </h2>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-3">
          <div className="grid grid-cols-5 gap-1.5">
            {weekDays.map((day) => {
              const assign = assignments.find((a) =>
                isSameDay(parseISO(a.datum), day)
              );
              const holiday = holidays.find((h) =>
                isSameDay(parseISO(h.datum), day)
              );
              const leave = leaves.find((l) =>
                isWithinInterval(day, {
                  start: parseISO(l.start_date),
                  end: parseISO(l.end_date),
                })
              );

              const color = assign ? getProjectColor(assign.project_id) : null;

              return (
                <div key={day.toISOString()} className="text-center">
                  <div className="text-[10px] font-medium text-muted-foreground mb-1">
                    {format(day, "EEE", { locale: de })}
                  </div>
                  {holiday ? (
                    <div className="rounded-md bg-gray-100 text-gray-500 text-[10px] px-1 py-2 border border-gray-200">
                      {holiday.bezeichnung || "Feiertag"}
                    </div>
                  ) : leave ? (
                    <div className="rounded-md bg-green-100 text-green-800 text-[10px] px-1 py-2 border border-green-300">
                      {leave.type === "urlaub"
                        ? "Urlaub"
                        : leave.type === "krankenstand"
                        ? "Krank"
                        : leave.type === "za"
                        ? "ZA"
                        : leave.type}
                    </div>
                  ) : assign ? (
                    <div
                      className={`rounded-md ${color?.bg} ${color?.text} text-[10px] px-1 py-2 border ${color?.border} truncate`}
                    >
                      {assign.project_name}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-muted-foreground/20 text-muted-foreground text-[10px] px-1 py-2">
                      –
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-end mt-2 text-xs text-muted-foreground">
            <span>Plantafel öffnen</span>
            <ArrowRight className="h-3 w-3 ml-1" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
