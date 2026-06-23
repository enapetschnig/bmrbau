// Server-seitiger Foto-ZIP-Download. Triggert einen NATIVEN Browser-
// Download via <a href download>. Vorteile gegenueber dem alten
// fetch+blob+save-button-Pfad:
//   - iOS Safari / Android Chrome / Desktop bekommen den Download genau
//     so wie jede andere Datei (Download-Manager / Dateien-App)
//   - kein blob im Speicher
//   - kein "ZIP speichern"-Button noetig
//   - keine Edge-Function-Streaming-Buffer-Probleme (Browser zieht die
//     Bytes direkt entgegen, statt sie erst in JS zu sammeln)

import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "download-project-photos-zip";

const asciiize = (s: string): string =>
  s
    .replace(/ä/g, "ae").replace(/Ä/g, "Ae")
    .replace(/ö/g, "oe").replace(/Ö/g, "Oe")
    .replace(/ü/g, "ue").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[/\\:*?"<>|]+/g, "_")
    .slice(0, 200);

const buildZipName = (projectName: string, subType?: string | null): string => {
  const date = new Date().toISOString().slice(0, 10);
  const project = asciiize(projectName) || "projekt";
  const suffix = subType ? `_${asciiize(subType)}` : "";
  return `${project}_fotos${suffix}_${date}.zip`;
};

const functionUrl = (): string =>
  `${(supabase as unknown as { supabaseUrl: string }).supabaseUrl}/functions/v1/${FUNCTION_NAME}`;

export type ServerZipParams = {
  projectId: string;
  projectName: string;
  subType?: string | null;
};

/**
 * Triggert einen nativen Browser-Download des Projekt-Foto-ZIPs. Muss
 * synchron aus einem User-Gesture (z.B. Button-onClick) aufgerufen werden.
 *
 * Der Server braucht je nach Projekt-Groesse ein paar Sekunden bis die
 * ersten Bytes kommen — waehrenddessen zeigt der Browser-Download-Manager
 * "wartet auf Server", danach den normalen Fortschritt.
 */
export function triggerProjectPhotosZipDownload(params: ServerZipParams): void {
  const { projectId, projectName, subType = null } = params;
  const url = new URL(functionUrl());
  url.searchParams.set("projectId", projectId);
  if (subType) url.searchParams.set("subType", subType);

  const filename = buildZipName(projectName, subType);

  const a = document.createElement("a");
  a.href = url.toString();
  a.download = filename;
  a.rel = "noopener";
  // KEIN target="_blank" — der Content-Disposition-Header sorgt dafuer,
  // dass der Browser den Download anstoesst statt zu navigieren. Mit
  // _blank wuerde Safari einen Popup-Block triggern.
  document.body.appendChild(a);
  a.click();
  a.remove();
}
