import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AppSettings {
  kilometergeldRate: number;
  showUeberstunden: boolean;
  showKilometergeld: boolean;
  showZusatzaufwendungen: boolean;
  loading: boolean;
}

const DEFAULTS: Omit<AppSettings, "loading"> = {
  kilometergeldRate: 0.42,
  showUeberstunden: true,
  showKilometergeld: true,
  showZusatzaufwendungen: false,
};

/**
 * Liest die globalen App-Einstellungen fuer die Stundenerfassung aus der app_settings Tabelle.
 */
export function useAppSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULTS, loading: true });

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "kilometergeld_rate",
          "show_ueberstunden",
          "show_kilometergeld",
          "show_zusatzaufwendungen",
        ]);

      if (error || !data) {
        setSettings((prev) => ({ ...prev, loading: false }));
        return;
      }

      const map = new Map(data.map((d) => [d.key, d.value]));

      setSettings({
        kilometergeldRate: parseFloat(map.get("kilometergeld_rate") || "0.42"),
        showUeberstunden: map.get("show_ueberstunden") !== "false",
        showKilometergeld: map.get("show_kilometergeld") !== "false",
        showZusatzaufwendungen: map.get("show_zusatzaufwendungen") === "true",
        loading: false,
      });
    };

    fetch();
  }, []);

  return settings;
}
