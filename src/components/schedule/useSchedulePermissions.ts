import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Assignment } from "./scheduleTypes";

type YearRoles = {
  admin: boolean;
  vorarbeiter: boolean;
  facharbeiter: boolean;
  lehrling: boolean;
  extern: boolean;
};

const DEFAULT_YEAR_ROLES: YearRoles = {
  admin: true,
  vorarbeiter: true,
  facharbeiter: false,
  lehrling: false,
  extern: false,
};

export function useSchedulePermissions() {
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVorarbeiter, setIsVorarbeiter] = useState(false);
  const [isExtern, setIsExtern] = useState(false);
  const [kategorie, setKategorie] = useState<string | null>(null);
  const [yearRoles, setYearRoles] = useState<YearRoles>(DEFAULT_YEAR_ROLES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const [{ data: roleData }, { data: empData }, { data: settings }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("employees")
          .select("kategorie")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", "jahresgrobplanung_rollen")
          .maybeSingle(),
      ]);

      setIsAdmin(roleData?.role === "administrator");
      setIsVorarbeiter(empData?.kategorie === "vorarbeiter");
      setIsExtern(empData?.kategorie === "extern");
      setKategorie(empData?.kategorie || null);
      if (settings?.value) {
        try {
          const parsed = JSON.parse(settings.value);
          setYearRoles({ ...DEFAULT_YEAR_ROLES, ...parsed });
        } catch { /* default */ }
      }
      setLoading(false);
    };
    check();
  }, []);

  const canEditProject = useCallback(
    (projectId: string, assignments: Assignment[]): boolean => {
      if (isAdmin) return true;
      if (!isVorarbeiter) return false;
      // Vorarbeiter can edit projects where they have an assignment
      return assignments.some(
        (a) => a.user_id === userId && a.project_id === projectId
      );
    },
    [isAdmin, isVorarbeiter, userId]
  );

  const canManageHolidays = isAdmin;

  // Year Planning Access: based on admin-configured rollen setting
  const canSeeYearPlanning = (() => {
    if (isAdmin) return yearRoles.admin;
    if (isVorarbeiter) return yearRoles.vorarbeiter;
    if (kategorie === "facharbeiter") return yearRoles.facharbeiter;
    if (kategorie === "lehrling") return yearRoles.lehrling;
    if (kategorie === "extern") return yearRoles.extern;
    return false;
  })();

  return {
    userId,
    isAdmin,
    isVorarbeiter,
    isExtern,
    kategorie,
    canEditProject,
    canManageHolidays,
    canSeeYearPlanning,
    loading,
  };
}
