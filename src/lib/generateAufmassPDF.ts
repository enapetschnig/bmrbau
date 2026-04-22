import { jsPDF } from "jspdf";
import {
  COMPANY_NAME,
  COMPANY_ADDRESS_ONE_LINE,
  BMR_ACCENT_RGB,
  BMR_DARK_RGB,
} from "./companyInfo";

export interface AufmassSheetForPDF {
  titel: string | null;
  aufmass_nr: string | null;
  datum: string;
  bauleiter: string | null;
  gewerk: string | null;
  notizen: string | null;
  project: { name: string; adresse: string | null; plz: string | null } | null;
}

export interface AufmassPositionForPDF {
  sort_order: number;
  input_mode: "text" | "sketch";
  pos_nr: string | null;
  bezeichnung: string | null;
  raum: string | null;
  berechnung: string | null;
  menge: number | null;
  einheit: string | null;
  sketch_data_url: string | null;
}

export interface GenerateAufmassOptions {
  asBlob?: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-AT", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-AT", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function getAufmassPDFFilename(sheet: AufmassSheetForPDF): string {
  const projectSlug = (sheet.project?.name || "Projekt").replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_");
  const nrSlug = (sheet.aufmass_nr || "").replace(/[^a-zA-Z0-9]/g, "_");
  const dateSlug = formatDateShort(sheet.datum).replace(/\./g, "-");
  const parts = ["Aufmassblatt", projectSlug];
  if (nrSlug) parts.push("Nr_" + nrSlug);
  parts.push(dateSlug);
  return parts.join("_") + ".pdf";
}

export async function generateAufmassPDF(
  sheet: AufmassSheetForPDF,
  positions: AufmassPositionForPDF[],
  options: GenerateAufmassOptions = {},
): Promise<Blob | void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  const logoBase64 = await fetchImageAsBase64("/bmr-logo.png");

  // Akzent-Bar
  doc.setFillColor(...BMR_DARK_RGB);
  doc.rect(0, 0, pageWidth, 4, "F");

  let y = margin;
  // Logo
  const logoMaxWidth = 90;
  const logoMaxHeight = 28;
  if (logoBase64) {
    try {
      const imgProps = (doc as unknown as { getImageProperties: (data: string) => { width: number; height: number } }).getImageProperties(logoBase64);
      const ratio = imgProps.width / imgProps.height;
      let w = logoMaxWidth;
      let h = w / ratio;
      if (h > logoMaxHeight) {
        h = logoMaxHeight;
        w = h * ratio;
      }
      doc.addImage(logoBase64, "PNG", (pageWidth - w) / 2, y, w, h);
      y += h + 4;
    } catch {
      doc.addImage(logoBase64, "PNG", (pageWidth - logoMaxWidth) / 2, y, logoMaxWidth, logoMaxHeight);
      y += logoMaxHeight + 4;
    }
  } else {
    y += 6;
  }

  // Titel + Datum
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BMR_DARK_RGB);
  const titelLeft = sheet.aufmass_nr
    ? `AUFMASSBLATT Nr. ${sheet.aufmass_nr}`
    : "AUFMASSBLATT";
  doc.text(titelLeft, margin, y + 4);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(formatDate(sheet.datum), pageWidth - margin, y + 4, { align: "right" });
  y += 7;

  doc.setDrawColor(...BMR_ACCENT_RGB);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + contentWidth, y);
  y += 7;
  doc.setTextColor(0, 0, 0);

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      y = margin;
    }
  };

  // Projekt-Infobox
  if (sheet.project) {
    ensureSpace(22);
    doc.setFillColor(245, 247, 243);
    doc.rect(margin, y, contentWidth, 18, "F");
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(sheet.project.name, margin + 3, y + 6);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);
    const adrParts = [sheet.project.adresse, sheet.project.plz].filter(Boolean);
    if (adrParts.length > 0) doc.text(adrParts.join(", "), margin + 3, y + 11);
    const meta: string[] = [];
    if (sheet.titel)     meta.push(sheet.titel);
    if (sheet.gewerk)    meta.push(`Gewerk: ${sheet.gewerk}`);
    if (sheet.bauleiter) meta.push(`Bauleiter: ${sheet.bauleiter}`);
    if (meta.length > 0) doc.text(meta.join(" · "), margin + 3, y + 15);
    y += 22;
  }

  // Tabelle Header
  const colPos    = 14;  // Pos.-Nr.
  const colMenge  = 24;  // Menge
  const colEinh   = 20;  // Einheit
  // Bezeichnung + Raum + Berechnung teilen sich den Rest:
  const colMid    = contentWidth - colPos - colMenge - colEinh;

  ensureSpace(10);
  doc.setFillColor(235, 240, 232);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Pos.", margin + 2, y + 5);
  doc.text("Bezeichnung / Raum / Berechnung", margin + colPos + 2, y + 5);
  doc.text("Menge", margin + colPos + colMid + 2, y + 5);
  doc.text("Einheit", margin + colPos + colMid + colMenge + 2, y + 5);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  // Sortierung
  const sortedPositions = [...positions].sort((a, b) => a.sort_order - b.sort_order);

  for (const pos of sortedPositions) {
    if (pos.input_mode === "sketch" && pos.sketch_data_url) {
      // Stift-Zeile: Bild ueber die volle Breite (links Pos-Nr falls da).
      const sketchHeight = 22;
      ensureSpace(sketchHeight + 3);
      // Pos-Nr (optional)
      if (pos.pos_nr) {
        doc.setFont("helvetica", "bold");
        doc.text(pos.pos_nr, margin + 2, y + 7);
      }
      try {
        doc.addImage(
          pos.sketch_data_url,
          "PNG",
          margin + colPos,
          y + 1,
          contentWidth - colPos - 2,
          sketchHeight,
        );
      } catch {
        doc.setFont("helvetica", "italic");
        doc.setTextColor(150, 150, 150);
        doc.text("[Skizze konnte nicht geladen werden]", margin + colPos + 2, y + 8);
        doc.setTextColor(0, 0, 0);
      }
      // Trennlinie unten
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, y + sketchHeight + 1, margin + contentWidth, y + sketchHeight + 1);
      y += sketchHeight + 2;
      doc.setFont("helvetica", "normal");
      continue;
    }

    // Text-Zeile
    const middleParts: string[] = [];
    if (pos.bezeichnung) middleParts.push(pos.bezeichnung);
    const subParts: string[] = [];
    if (pos.raum)       subParts.push(`Raum: ${pos.raum}`);
    if (pos.berechnung) subParts.push(`Berechnung: ${pos.berechnung}`);
    if (subParts.length > 0) middleParts.push(subParts.join(" · "));
    const middleText = middleParts.join("\n");
    const midLines = doc.splitTextToSize(middleText || "—", colMid - 4);
    const lineCount = Math.max(1, midLines.length);
    const rowHeight = lineCount * 4.5 + 3;
    ensureSpace(rowHeight);

    // Pos-Nr
    if (pos.pos_nr) doc.text(pos.pos_nr, margin + 2, y + 4.5);
    // Mitte
    doc.text(midLines, margin + colPos + 2, y + 4.5);
    // Menge
    if (pos.menge !== null && pos.menge !== undefined) {
      doc.text(String(pos.menge), margin + colPos + colMid + colMenge - 2, y + 4.5, { align: "right" });
    }
    // Einheit
    if (pos.einheit) doc.text(pos.einheit, margin + colPos + colMid + colMenge + 2, y + 4.5);

    // Trennlinie
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
    y += rowHeight;
  }

  y += 4;

  // Notizen
  if (sheet.notizen && sheet.notizen.trim()) {
    ensureSpace(10);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BMR_DARK_RGB);
    doc.text("Notizen", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(sheet.notizen, contentWidth);
    ensureSpace(lines.length * 4.5);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
  }

  // Unterschriftsblock
  ensureSpace(35);
  y += 6;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  const sigW = (contentWidth - 10) / 2;
  doc.line(margin, y + 18, margin + sigW, y + 18);
  doc.line(margin + sigW + 10, y + 18, margin + contentWidth, y + 18);
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Auftragnehmer", margin, y + 22);
  doc.text("Auftraggeber / Bauleiter", margin + sigW + 10, y + 22);
  y += 26;

  // Footer (2 Zeilen, kein Overlap)
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const lineY1 = pageHeight - 12;
    const lineY2 = pageHeight - 8;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, lineY1 - 4, pageWidth - margin, lineY1 - 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(COMPANY_NAME, margin, lineY1);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`Seite ${p} / ${totalPages}`, pageWidth - margin, lineY1, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(COMPANY_ADDRESS_ONE_LINE, margin, lineY2);
  }

  const filename = getAufmassPDFFilename(sheet);
  if (options.asBlob) return doc.output("blob");
  doc.save(filename);
}
