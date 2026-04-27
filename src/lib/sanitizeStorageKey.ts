/**
 * Bereinigt einen Dateinamen, sodass er als Supabase-Storage-Key
 * akzeptiert wird. Der Storage-Validator akzeptiert nur ASCII —
 * Umlaute & andere Unicode-Zeichen führen zu "Invalid key"-Fehlern.
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
    // alles andere Nicht-ASCII auf "_"
    .replace(/[^\x20-\x7E]/g, "_")
    // Leerzeichen vereinheitlichen (mehrfach → eines)
    .replace(/\s+/g, " ")
    .trim();
}
