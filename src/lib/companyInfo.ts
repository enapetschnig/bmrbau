// Zentrale Firmendaten fuer PDF-Exports (Tagesbericht, Regiebericht, ...).
// In der App-UI bleibt die Marke "BMR Bau"; in gedruckten / versendeten
// Unterlagen verwendet der Kunde die Legal-Entity "JR Baumeisterbüro".

export const COMPANY_NAME = "JR Baumeisterbüro Rutter & Jäger GmbH";
export const COMPANY_ADDRESS_LINES = ["Wirtschaftspark 15", "9130 Poggersdorf"];
export const COMPANY_ADDRESS_ONE_LINE = COMPANY_ADDRESS_LINES.join(" · ");
// Accent-Color (BMR-Grün, auch in der Edge-Function verwendet).
export const BMR_ACCENT_RGB: [number, number, number] = [124, 163, 115];
export const BMR_DARK_RGB: [number, number, number] = [92, 128, 82];
