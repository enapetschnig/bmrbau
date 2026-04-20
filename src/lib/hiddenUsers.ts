/**
 * User-IDs, die in allen Listen/Dropdowns/Reports der App ausgeblendet werden.
 * Der betreffende User kann sich trotzdem einloggen und seine eigenen Daten sehen
 * (Self-Routes wie /my-hours, /my-documents), er taucht aber nicht in
 * Mitarbeiter-Uebersichten anderer Admins auf.
 *
 * Nutzung: Entwickler-/Support-Accounts, die nicht in der Lohnabrechnung
 * auftauchen sollen.
 */

export const HIDDEN_USER_IDS: ReadonlySet<string> = new Set([
  "f31bc638-9835-4e05-8f47-c386b69fb9f3", // Christoph Napetschnig (Entwickler-Account)
]);

export function isHiddenUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return HIDDEN_USER_IDS.has(userId);
}

/**
 * Filtert eine Liste von Profilen (Tabelle profiles) – filtert nach `id`.
 */
export function filterHiddenProfiles<T extends { id: string }>(items: T[] | null | undefined): T[] {
  if (!items) return [];
  return items.filter((p) => !HIDDEN_USER_IDS.has(p.id));
}

/**
 * Filtert Listen die per user_id referenziert sind (employees, user_roles,
 * time_entries aus Admin-Sicht, worker_assignments, ...).
 */
export function filterHiddenByUserId<T extends { user_id?: string | null }>(
  items: T[] | null | undefined,
): T[] {
  if (!items) return [];
  return items.filter((p) => !p.user_id || !HIDDEN_USER_IDS.has(p.user_id));
}
