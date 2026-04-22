// Zentrale Firmendaten fuer PDF-Exports (Tagesbericht, Regiebericht,
// Aufmaßblatt, ...). Aenderung hier wirkt in allen Client-PDFs; die
// Edge-Function `send-disturbance-report` hat eine eigene Kopie der
// Konstante und muss bei Umbenennung nachgezogen + neu deployed werden.

export const COMPANY_NAME = "BMR Bau GmbH";
export const COMPANY_ADDRESS_LINES = ["Wirtschaftspark 15", "9130 Poggersdorf"];
export const COMPANY_ADDRESS_ONE_LINE = COMPANY_ADDRESS_LINES.join(" · ");
// Accent-Color (BMR-Grün, auch in der Edge-Function verwendet).
export const BMR_ACCENT_RGB: [number, number, number] = [124, 163, 115];
export const BMR_DARK_RGB: [number, number, number] = [92, 128, 82];
