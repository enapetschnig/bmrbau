import { jsPDF } from "jspdf";
import {
  COMPANY_NAME,
  COMPANY_ADDRESS_LINES,
  COMPANY_ADDRESS_ONE_LINE,
  BMR_ACCENT_RGB,
  BMR_DARK_RGB,
} from "./companyInfo";

export interface Material {
  id: string;
  material: string;
  menge: string | null;
  notizen: string | null;
}

export interface Photo {
  id: string;
  file_path: string;
  file_name: string;
}

export interface Disturbance {
  id: string;
  datum: string;
  start_time: string;
  end_time: string;
  pause_minutes: number;
  stunden: number;
  kunde_name: string;
  kunde_email: string | null;
  kunde_adresse: string | null;
  kunde_telefon: string | null;
  beschreibung: string;
  notizen: string | null;
  unterschrift_kunde: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("de-AT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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

export async function generateDisturbancePDF(
  disturbance: Disturbance,
  materials: Material[],
  technicians: string[],
  photos: Photo[],
  supabaseUrl: string
): Promise<{ pdfBase64: string; pdfFilename: string }> {
  // Fetch photo images
  const photoImages: (string | null)[] = [];
  for (const photo of photos) {
    const url = `${supabaseUrl}/storage/v1/object/public/disturbance-photos/${photo.file_path}`;
    photoImages.push(await fetchImageAsBase64(url));
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // Logo fuer Header laden
  const logoBase64 = await fetchImageAsBase64("/bmr-logo.png");

  // Accent-Bar oben
  doc.setFillColor(...BMR_DARK_RGB);
  doc.rect(0, 0, pageWidth, 3, "F");

  // Header: NUR Logo, gross + zentriert (ohne Firmenname-Block)
  let yPos = margin;
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
      doc.addImage(logoBase64, "PNG", (pageWidth - w) / 2, yPos, w, h);
      yPos += h + 4;
    } catch {
      doc.addImage(logoBase64, "PNG", (pageWidth - logoMaxWidth) / 2, yPos, logoMaxWidth, logoMaxHeight);
      yPos += logoMaxHeight + 4;
    }
  } else {
    yPos += 6;
  }

  // Titel links + Datum rechts unter dem Logo
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BMR_DARK_RGB);
  doc.text("REGIEBERICHT", margin, yPos + 4);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(formatDateShort(disturbance.datum), pageWidth - margin, yPos + 4, { align: "right" });
  yPos += 7;

  doc.setDrawColor(...BMR_ACCENT_RGB);
  doc.setLineWidth(0.8);
  doc.line(margin, yPos, margin + contentWidth, yPos);
  yPos += 8;

  doc.setTextColor(0, 0, 0);

  // Customer
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Kundendaten", margin, yPos);
  yPos += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Name: ${disturbance.kunde_name}`, margin, yPos);
  yPos += 5;
  if (disturbance.kunde_adresse) { doc.text(`Adresse: ${disturbance.kunde_adresse}`, margin, yPos); yPos += 5; }
  if (disturbance.kunde_telefon) { doc.text(`Telefon: ${disturbance.kunde_telefon}`, margin, yPos); yPos += 5; }
  if (disturbance.kunde_email) { doc.text(`E-Mail: ${disturbance.kunde_email}`, margin, yPos); yPos += 5; }
  yPos += 10;

  // Work info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Einsatzdaten", margin, yPos);
  yPos += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Datum: ${formatDate(disturbance.datum)}`, margin, yPos); yPos += 5;
  doc.text(`Arbeitszeit: ${disturbance.start_time.slice(0, 5)} - ${disturbance.end_time.slice(0, 5)} Uhr`, margin, yPos); yPos += 5;
  if (disturbance.pause_minutes > 0) { doc.text(`Pause: ${disturbance.pause_minutes} Minuten`, margin, yPos); yPos += 5; }
  doc.setFont("helvetica", "bold");
  doc.text(`Gesamtstunden: ${disturbance.stunden.toFixed(2)} Stunden`, margin, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 5;

  if (technicians.length === 1) {
    doc.text(`Techniker: ${technicians[0]}`, margin, yPos); yPos += 5;
  } else if (technicians.length > 1) {
    doc.text("Techniker:", margin, yPos); yPos += 5;
    technicians.forEach((n) => { doc.text(`  - ${n}`, margin, yPos); yPos += 5; });
  }
  yPos += 7;

  // Description
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Durchgeführte Arbeiten", margin, yPos); yPos += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const beschLines = doc.splitTextToSize(disturbance.beschreibung, contentWidth);
  doc.text(beschLines, margin, yPos); yPos += beschLines.length * 5 + 5;

  if (disturbance.notizen) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Notizen", margin, yPos); yPos += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const notizenLines = doc.splitTextToSize(disturbance.notizen, contentWidth);
    doc.text(notizenLines, margin, yPos); yPos += notizenLines.length * 5 + 5;
  }
  yPos += 5;

  // Materials
  if (materials && materials.length > 0) {
    if (yPos > 220) { doc.addPage(); yPos = margin; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Verwendetes Material", margin, yPos); yPos += 7;
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 4, contentWidth, 7, "F");
    doc.text("Material", margin + 2, yPos);
    doc.text("Menge", margin + 90, yPos);
    doc.text("Notizen", margin + 120, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    materials.forEach((mat) => {
      if (yPos > 270) { doc.addPage(); yPos = margin; }
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos + 2, margin + contentWidth, yPos + 2);
      doc.text(mat.material || "-", margin + 2, yPos);
      doc.text(mat.menge || "-", margin + 90, yPos);
      doc.text(mat.notizen || "-", margin + 120, yPos);
      yPos += 7;
    });
    yPos += 8;
  }

  // Photos
  if (photos.length > 0 && photoImages.some((img) => img !== null)) {
    doc.addPage(); yPos = margin;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Fotos", margin, yPos); yPos += 10;
    for (let i = 0; i < photos.length; i++) {
      const imageData = photoImages[i];
      if (!imageData) continue;
      if (yPos > 200) { doc.addPage(); yPos = margin; }
      try {
        doc.addImage(imageData, "JPEG", margin, yPos, 80, 60); yPos += 65;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(photos[i].file_name, margin, yPos); yPos += 8;
        doc.setTextColor(0, 0, 0);
      } catch { /* skip broken images */ }
    }
  }

  // Signature - nur rendern wenn wirklich eine da ist.
  if (yPos > 200) { doc.addPage(); yPos = margin; }
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Kundenunterschrift", margin, yPos); yPos += 5;
  const sig = disturbance.unterschrift_kunde?.trim() ?? "";
  if (sig && sig.startsWith("data:")) {
    try {
      doc.addImage(sig, "PNG", margin, yPos, 60, 25);
      yPos += 30;
    } catch {
      // 2. Versuch mit reinem base64 fuer alte jsPDF-Varianten.
      try {
        const b64 = sig.split(",").pop() || "";
        doc.addImage(b64, "PNG", margin, yPos, 60, 25);
        yPos += 30;
      } catch {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.text("[Unterschrift konnte nicht geladen werden]", margin, yPos + 10);
        yPos += 20;
      }
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text("(Noch keine Kundenunterschrift vorhanden)", margin, yPos + 10);
    doc.setTextColor(0, 0, 0);
    yPos += 20;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const confirmText = "Der Kunde bestätigt mit seiner Unterschrift die ordnungsgemäße Durchführung der oben genannten Arbeiten.";
  const confirmLines = doc.splitTextToSize(confirmText, contentWidth);
  doc.text(confirmLines, margin, yPos);

  // Footer auf jeder Seite: 2 Zeilen, kein Overlap
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

  const pdfBase64 = doc.output("datauristring").split(",")[1];
  const dateForFilename = formatDateShort(disturbance.datum).replace(/\./g, "-");
  const kundeForFilename = disturbance.kunde_name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_");
  const pdfFilename = `Regiebericht_${kundeForFilename}_${dateForFilename}.pdf`;

  return { pdfBase64, pdfFilename };
}

export function generateEmailHtml(
  disturbance: Disturbance,
  technicians: string[]
): string {
  const technicianDisplay = technicians.length === 1 ? technicians[0] : technicians.join(", ");
  return `
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; color: #333; line-height: 1.5; }
      .header { color: #7CA373; font-size: 24px; font-weight: bold; margin-bottom: 10px; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .info-box { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0; }
    </style></head>
    <body><div class="container">
      <div class="header">BMR BAU GMBH</div>
      <h2>Regiebericht</h2>
      <p>Sehr geehrte Damen und Herren,</p>
      <p>im Anhang finden Sie den Regiebericht für den Einsatz bei <strong>${disturbance.kunde_name}</strong>.</p>
      <div class="info-box">
        <strong>Zusammenfassung:</strong><br>
        Techniker: ${technicianDisplay}<br>
        Arbeitszeit: ${disturbance.start_time.slice(0, 5)} - ${disturbance.end_time.slice(0, 5)} Uhr<br>
        Gesamtstunden: ${disturbance.stunden.toFixed(2)} h
      </div>
      <p>Der vollständige Bericht befindet sich im angehängten PDF-Dokument.</p>
      <p>Mit freundlichen Grüßen,<br>BMR Bau GmbH</p>
    </div></body></html>
  `;
}
