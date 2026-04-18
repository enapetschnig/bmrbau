# BMR Bau – Interne App

Digitale Projektdokumentation und Zeiterfassung für **BMR Bau GmbH**
(Ausführung · Beratung · Sanierung).

## Stack

- **Frontend:** Vite + React 18 + TypeScript + shadcn/ui + Tailwind (PWA via `vite-plugin-pwa`)
- **Backend:** Supabase (Postgres + Auth + Edge Functions + Storage + Realtime)
- **Integrationen:** OpenAI (Dokumenten-Extraktion, Audio-Transkription), Resend (E-Mail-Versand), Twilio (SMS-Einladungen), Web Push (VAPID)

## Lokale Entwicklung

Voraussetzungen: Node 20+ (getestet mit 25), npm 11+.

```sh
git clone git@github.com:enapetschnig/bmrbau.git
cd bmrbau
npm install
cp .env.example .env   # Werte eintragen (siehe unten)
npm run dev            # http://localhost:8080
```

## Environment Variables

**Frontend (`.env`)** — werden von Vite in den Client gebundlet:

| Variable | Zweck |
|----------|-------|
| `VITE_SUPABASE_URL` | Projekt-URL des Supabase-Projekts |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable/Anon-Key (darf öffentlich sein) |
| `VITE_SUPABASE_PROJECT_ID` | Projekt-Ref (nur für CLI-Nutzung) |
| `VITE_VAPID_PUBLIC_KEY` | VAPID-Public-Key für Web-Push |

**Edge Functions (Supabase Dashboard > Edge Functions > Secrets)** — NIE in `.env`:

| Secret | Benötigt von |
|--------|--------------|
| `OPENAI_API_KEY` | extract-document, extract-materials, compare-documents, split-payslips, improve-text, ai-import-equipment, transcribe-audio, parse-safety-checklist |
| `RESEND_API_KEY` | send-disturbance-report |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | send-invitation |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | send-push |
| `APP_URL` | send-invitation (SMS-Link, Default `https://www.bmrbau.app`) |

## Deployment

- **Frontend**: über Vercel automatisch bei Push auf `main` (Projekt-Root, `npm run build` → `dist/`)
- **Edge Functions**: `npx supabase functions deploy <name> --project-ref cwkknbcygbuouuctwujh`
- **Migrationen**: `npx supabase db push --linked` (Access-Token als `SUPABASE_ACCESS_TOKEN` exportieren)

## Icons & Branding regenerieren

```sh
# Original-Logo liegt in ~/Downloads/BMR Bau GmbH Logo optimiert.jpg
python3 scripts/generate-icons.py
```

Erzeugt `public/bmr-logo.png`, `public/bmr-monogram.png`, `icon-192.png`,
`icon-512.png`, `apple-touch-icon.png`, `favicon.ico`.

## Rollen

- **administrator** — voller Zugriff, Stammdatenpflege, Lohnauswertung, Lieferanten-Abgleich
- **vorarbeiter** — Baustellen-Leitung, Plantafel, Regie-/Tagesberichte, Sicherheits-Unterweisungen
- **facharbeiter** — Zeit-/Dokumentations-Erfassung auf Baustelle
- **extern** — eingeschränkt auf eigene Zeiten und Chat

## Tests

```sh
npm run lint
npx playwright test  # Smoke-Tests (TEST_URL + TEST_EMAIL in .env.test)
```
