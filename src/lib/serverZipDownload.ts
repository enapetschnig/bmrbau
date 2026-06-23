// Server-seitiger Foto-ZIP-Download mit Batch-Support.
//
// Supabase Edge Function RAM ist klein (~150 MB Peak); deshalb teilt sie
// grosse Projekte in mehrere ZIPs. Frontend macht zuerst einen Meta-Call,
// erfaehrt die Anzahl Fotos, und triggert pro Batch eine separate native
// Browser-Navigation (<a download>). Jeder Klick == ein User-Gesture
// (iOS-safe).

import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "download-project-photos-zip";
const DEFAULT_BATCH_LIMIT = 8;

const asciiize = (s: string): string =>
  s
    .replace(/ä/g, "ae").replace(/Ä/g, "Ae")
    .replace(/ö/g, "oe").replace(/Ö/g, "Oe")
    .replace(/ü/g, "ue").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[/\\:*?"<>|]+/g, "_")
    .slice(0, 200);

const functionUrl = (): string =>
  `${(supabase as unknown as { supabaseUrl: string }).supabaseUrl}/functions/v1/${FUNCTION_NAME}`;

export type ServerZipParams = {
  projectId: string;
  projectName: string;
  subType?: string | null;
};

export type ProjectPhotoMeta = {
  totalFiles: number;
  batchLimit: number;
  batchCount: number;
};

export async function getProjectPhotoMeta(
  params: ServerZipParams,
): Promise<ProjectPhotoMeta> {
  const url = new URL(functionUrl());
  url.searchParams.set("projectId", params.projectId);
  if (params.subType) url.searchParams.set("subType", params.subType);
  url.searchParams.set("meta", "1");

  const resp = await fetch(url.toString(), { method: "GET" });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const j = await resp.json();
      if (j?.error) detail = j.error;
    } catch {/* noop */}
    throw new Error(detail);
  }
  const data = await resp.json() as { totalFiles: number; defaultBatchLimit: number };
  const batchLimit = data.defaultBatchLimit || DEFAULT_BATCH_LIMIT;
  const totalFiles = data.totalFiles || 0;
  const batchCount = Math.max(1, Math.ceil(totalFiles / batchLimit));
  return { totalFiles, batchLimit, batchCount };
}

/**
 * Triggert einen nativen Browser-Download fuer einen einzelnen Batch.
 * MUSS synchron aus einem User-Gesture (Button-onClick) gerufen werden,
 * damit iOS Safari den Download akzeptiert.
 */
export function triggerBatchDownload(
  params: ServerZipParams & { offset: number; limit: number },
): void {
  const url = new URL(functionUrl());
  url.searchParams.set("projectId", params.projectId);
  if (params.subType) url.searchParams.set("subType", params.subType);
  url.searchParams.set("offset", String(params.offset));
  url.searchParams.set("limit", String(params.limit));

  // download-Attribut ist nur ein Hinweis — der Server schickt seinen
  // eigenen Content-Disposition-filename inklusive "_teil-N-von-M".
  const a = document.createElement("a");
  a.href = url.toString();
  a.download = `${asciiize(params.projectName) || "projekt"}_fotos.zip`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
