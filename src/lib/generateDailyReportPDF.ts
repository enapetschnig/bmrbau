import { jsPDF } from "jspdf";
import {
  COMPANY_NAME,
  COMPANY_ADDRESS_LINES,
  COMPANY_ADDRESS_ONE_LINE,
  BMR_ACCENT_RGB,
  BMR_DARK_RGB,
} from "./companyInfo";

export interface DailyReportForPDF {
  report_type: string;
  datum: string;
  temperatur_min: number | null;
  temperatur_max: number | null;
  wetter: string[] | null;
  beschreibung: string;
  notizen: string | null;
  sicherheitscheckliste: { id: string; label: string; checked: boolean }[] | null;
  sicherheit_bestaetigt: boolean;
  unterschrift_kunde: string | null;
  unterschrift_am: string | null;
  unterschrift_name: string | null;
  project: { name: string; adresse: string | null; plz: string | null } | null;
}

export interface ActivityForPDF {
  geschoss: string;
  beschreibung: string;
}

export interface PhotoForPDF {
  file_path: string;
  file_name: string;
}

const WETTER_LABELS_PDF: Record<string, string> = {
  sonnig: "Sonnig",
  bewoelkt: "Bewölkt",
  regen: "Regen",
  schnee: "Schnee",
  wind: "Wind",
  frost: "Frost",
};

const GESCHOSS_LABELS: Record<string, string> = {
  aussen: "Aussen",
  keller: "Keller",
  eg: "EG",
  og: "OG",
  dg: "DG",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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

export interface GenerateOptions {
  /** Wenn true: PDF wird als Blob zurueckgegeben (nicht ueber doc.save()
      heruntergeladen). Fuer den Auto-Upload-in-Projekt-Workflow. */
  asBlob?: boolean;
}

export async function generateDailyReportPDF(
  report: DailyReportForPDF,
  activities: ActivityForPDF[],
  photos: PhotoForPDF[],
  supabaseUrl: string,
  options: GenerateOptions = {},
): Promise<Blob | void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // Logo einmal laden - wird in Header + (falls nicht vorhanden) gesund durchfallen.
  const logoBase64 = await fetchImageAsBase64("/bmr-logo.png");

  // -- Header: NUR das Logo, schoen gross und zentriert --
  // Auf Wunsch: kein Firmenname, kein Untertitel - das Logo allein.
  // Akzent-Bar oben (BMR-dunkelgrün) bleibt als feines Branding-Element.
  doc.setFillColor(...BMR_DARK_RGB);
  doc.rect(0, 0, pageWidth, 4, "F");

  let y = margin;
  const logoMaxWidth = 90;   // mm - prominent, aber nicht zu uebertrieben
  const logoMaxHeight = 28;  // mm
  if (logoBase64) {
    try {
      // Versuch ueber jsPDF die Original-Bildmasse zu ermitteln und aspect-ratio
      // zu wahren. Fallback: feste Breite, Hoehe auto.
      const imgProps = (doc as unknown as { getImageProperties: (data: string) => { width: number; height: number } }).getImageProperties(logoBase64);
      const ratio = imgProps.width / imgProps.height;
      let w = logoMaxWidth;
      let h = w / ratio;
      if (h > logoMaxHeight) {
        h = logoMaxHeight;
        w = h * ratio;
      }
      const x = (pageWidth - w) / 2;
      doc.addImage(logoBase64, "PNG", x, y, w, h);
      y += h + 4;
    } catch {
      // Fallback: feste Box
      doc.addImage(logoBase64, "PNG", (pageWidth - logoMaxWidth) / 2, y, logoMaxWidth, logoMaxHeight);
      y += logoMaxHeight + 4;
    }
  } else {
    y += 6;
  }

  // Titel + Datum auf einer Zeile UNTER dem Logo
  const title = report.report_type === "tagesbericht" ? "BAUTAGESBERICHT" : "ZWISCHENBERICHT";
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BMR_DARK_RGB);
  doc.text(title, margin, y + 4);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(formatDate(report.datum), pageWidth - margin, y + 4, { align: "right" });
  y += 7;

  // Trennlinie in BMR-Akzent
  doc.setDrawColor(...BMR_ACCENT_RGB);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + contentWidth, y);
  y += 7;

  doc.setTextColor(0, 0, 0);

  const ensureSpace = (needed: number) => {
    // Footer-Reserve: 18 mm fuer Adress-Footer + Seitenzahl
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      y = margin;
    }
  };

  const sectionHeader = (label: string) => {
    ensureSpace(12);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BMR_DARK_RGB);
    doc.text(label, margin, y);
    y += 6;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  // -- Projekt-Infobox --------------------------------------------
  if (report.project) {
    ensureSpace(18);
    doc.setFillColor(245, 247, 243);
    doc.rect(margin, y, contentWidth, 16, "F");
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(report.project.name, margin + 3, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    const adrParts: string[] = [];
    if (report.project.adresse) adrParts.push(report.project.adresse);
    if (report.project.plz) adrParts.push(report.project.plz);
    if (adrParts.length > 0) {
      doc.text(adrParts.join(", "), margin + 3, y + 11);
    }
    // Datum steht bereits oben unter dem Logo - hier nicht doppelt anzeigen.
    doc.setTextColor(0, 0, 0);
    y += 20;
  }

  // -- Wetter -----------------------------------------------------
  if ((report.wetter && report.wetter.length > 0) || report.temperatur_min != null || report.temperatur_max != null) {
    sectionHeader("Wetter");
    const parts: string[] = [];
    if (report.wetter && report.wetter.length > 0) {
      parts.push(report.wetter.map((w) => WETTER_LABELS_PDF[w] || w).join(", "));
    }
    if (report.temperatur_min != null || report.temperatur_max != null) {
      parts.push(`Temperatur: ${report.temperatur_min ?? "–"}° / ${report.temperatur_max ?? "–"}°C`);
    }
    doc.text(parts.join("  ·  "), margin, y);
    y += 7;
  }

  // -- Taetigkeiten ----------------------------------------------
  if (activities.length > 0) {
    sectionHeader("Tätigkeiten");

    const grouped: Record<string, string[]> = {};
    for (const act of activities) {
      const key = act.geschoss || "aussen";
      if (!grouped[key]) grouped[key] = [];
      if (act.beschreibung.trim()) grouped[key].push(act.beschreibung.trim());
    }

    for (const [geschoss, items] of Object.entries(grouped)) {
      if (items.length === 0) continue;
      ensureSpace(8 + items.length * 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(GESCHOSS_LABELS[geschoss] || geschoss, margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      for (const item of items) {
        const lines = doc.splitTextToSize(`• ${item}`, contentWidth - 5);
        ensureSpace(lines.length * 4.5 + 2);
        doc.text(lines, margin + 3, y);
        y += lines.length * 4.5 + 1;
      }
      y += 2;
    }
    y += 2;
  }

  // -- Beschreibung ----------------------------------------------
  if (report.beschreibung) {
    sectionHeader("Beschreibung");
    const lines = doc.splitTextToSize(report.beschreibung, contentWidth);
    ensureSpace(lines.length * 4.5 + 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
  }

  // -- Notizen ---------------------------------------------------
  if (report.notizen) {
    sectionHeader("Notizen");
    const lines = doc.splitTextToSize(report.notizen, contentWidth);
    ensureSpace(lines.length * 4.5 + 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
  }

  // -- Fotos (2-Spalten-Grid, pagebreak-aware) -------------------
  if (photos.length > 0) {
    sectionHeader(`Fotos (${photos.length})`);
    const photoW = (contentWidth - 4) / 2;
    const photoH = 55;

    for (let i = 0; i < photos.length; i += 2) {
      ensureSpace(photoH + 10);
      const rowY = y;
      for (let col = 0; col < 2 && i + col < photos.length; col++) {
        const photo = photos[i + col];
        const url = `${supabaseUrl}/storage/v1/object/public/daily-report-photos/${photo.file_path}`;
        const imageData = await fetchImageAsBase64(url);
        if (!imageData) continue;
        const xPos = margin + col * (photoW + 4);
        try {
          doc.addImage(imageData, "JPEG", xPos, rowY, photoW, photoH);
        } catch {
          /* skip broken images */
        }
      }
      y = rowY + photoH + 5;
    }
    y += 2;
  }

  // -- Sicherheits-Checkliste (nur wenn vorhanden) ---------------
  if (report.sicherheitscheckliste && report.sicherheitscheckliste.length > 0) {
    sectionHeader("Sicherheitscheckliste");
    for (const item of report.sicherheitscheckliste) {
      ensureSpace(5);
      const check = item.checked ? "[x]" : "[ ]";
      doc.text(`${check}  ${item.label}`, margin, y);
      y += 5;
    }
    if (report.sicherheit_bestaetigt) {
      ensureSpace(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 120, 0);
      doc.text("Sicherheitscheckliste vollständig bestätigt", margin, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      y += 7;
    }
    y += 2;
  }

  // -- Unterschrift (nur wenn vorhanden) -------------------------
  if (report.unterschrift_kunde) {
    ensureSpace(45);
    sectionHeader("Unterschrift");
    try {
      doc.addImage(report.unterschrift_kunde, "PNG", margin, y, 60, 25);
      y += 28;
    } catch {
      doc.setFont("helvetica", "italic");
      doc.text("[Unterschrift konnte nicht geladen werden]", margin, y + 10);
      y += 20;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (report.unterschrift_name) {
      doc.text(report.unterschrift_name, margin, y);
      y += 4;
    }
    if (report.unterschrift_am) {
      doc.setTextColor(100, 100, 100);
      doc.text(
        new Date(report.unterschrift_am).toLocaleDateString("de-AT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        margin,
        y,
      );
      doc.setTextColor(0, 0, 0);
    }
  }

  // -- Footer auf jeder Seite: 2 Zeilen, kein Overlap -----------
  // Zeile 1 (links): Firmenname, (rechts): Seitenzahl
  // Zeile 2 (links): Adresse
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerLine1Y = pageHeight - 12;
    const footerLine2Y = pageHeight - 8;

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, footerLine1Y - 4, pageWidth - margin, footerLine1Y - 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(COMPANY_NAME, margin, footerLine1Y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Seite ${p} / ${totalPages}`, pageWidth - margin, footerLine1Y, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(COMPANY_ADDRESS_ONE_LINE, margin, footerLine2Y);
  }

  const projectSlug = (report.project?.name || "Projekt").replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_");
  const dateSlug = formatDateShort(report.datum).replace(/\./g, "-");
  const typeLabel = report.report_type === "tagesbericht" ? "Bautagesbericht" : "Zwischenbericht";
  const filename = `${typeLabel}_${projectSlug}_${dateSlug}.pdf`;

  if (options.asBlob) {
    return doc.output("blob");
  }
  doc.save(filename);
}

export function getDailyReportPDFFilename(report: DailyReportForPDF): string {
  const projectSlug = (report.project?.name || "Projekt").replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_");
  const dateSlug = formatDateShort(report.datum).replace(/\./g, "-");
  const typeLabel = report.report_type === "tagesbericht" ? "Bautagesbericht" : "Zwischenbericht";
  return `${typeLabel}_${projectSlug}_${dateSlug}.pdf`;
}
