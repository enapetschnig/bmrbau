/**
 * Bereinigt einen Dateinamen, sodass er als Supabase-Storage-Key
 * akzeptiert wird. Supabase Storage akzeptiert NUR einen engen Satz
 * an Zeichen — alles andere fuehrt zu "Invalid key"-Fehlern (auch
 * ASCII-Sonderzeichen wie [], #, %, ~, \, <, >, {, }, ", ', `).
 *
 * Strategie: Umlaute auf ASCII-Aequivalente mappen (damit der Name
 * lesbar bleibt), dann aggressiv whitelisten — nur Buchstaben,
 * Ziffern, '_', '-', '.' und Leerzeichen behalten. Alles andere
 * wird zu '_'. Mehrfache '_' werden zusammengefasst.
 *
 * Verwendung nur fuer den Storage-Pfad. Der Anzeigename in der
 * documents-Tabelle bleibt unangetastet.
 */
export function sanitizeStorageKey(name: string): string {
  return name
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    // Aggressives Whitelisten: nur safe Zeichen behalten
    .replace(/[^A-Za-z0-9._\- ]/g, "_")
    // Mehrfache Underscores zu einem
    .replace(/_+/g, "_")
    // Mehrfache Leerzeichen zu einem
    .replace(/\s+/g, " ")
    // Vorne/hinten "_" oder " " entfernen
    .replace(/^[_\s.]+|[_\s.]+$/g, "")
    // Fallback wenn nach dem Sanitizen nichts mehr uebrig ist
    || "datei";
}
