export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      disturbance_materials: {
        Row: {
          created_at: string
          disturbance_id: string
          id: string
          material: string
          menge: string | null
          notizen: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disturbance_id: string
          id?: string
          material: string
          menge?: string | null
          notizen?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disturbance_id?: string
          id?: string
          material?: string
          menge?: string | null
          notizen?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disturbance_materials_disturbance_id_fkey"
            columns: ["disturbance_id"]
            isOneToOne: false
            referencedRelation: "disturbances"
            referencedColumns: ["id"]
          },
        ]
      }
      disturbance_photos: {
        Row: {
          created_at: string
          disturbance_id: string
          file_name: string
          file_path: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disturbance_id: string
          file_name: string
          file_path: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disturbance_id?: string
          file_name?: string
          file_path?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disturbance_photos_disturbance_id_fkey"
            columns: ["disturbance_id"]
            isOneToOne: false
            referencedRelation: "disturbances"
            referencedColumns: ["id"]
          },
        ]
      }
      disturbance_workers: {
        Row: {
          created_at: string
          disturbance_id: string
          id: string
          is_main: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          disturbance_id: string
          id?: string
          is_main?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          disturbance_id?: string
          id?: string
          is_main?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disturbance_workers_disturbance_id_fkey"
            columns: ["disturbance_id"]
            isOneToOne: false
            referencedRelation: "disturbances"
            referencedColumns: ["id"]
          },
        ]
      }
      disturbances: {
        Row: {
          beschreibung: string
          created_at: string
          datum: string
          end_time: string
          geschoss: string[] | null
          id: string
          is_verrechnet: boolean
          kunde_adresse: string | null
          kunde_email: string | null
          kunde_name: string
          kunde_telefon: string | null
          notizen: string | null
          pause_minutes: number
          pdf_gesendet_am: string | null
          start_time: string
          status: string
          stunden: number
          temperatur_max: number | null
          temperatur_min: number | null
          unterschrift_am: string | null
          unterschrift_kunde: string | null
          updated_at: string
          user_id: string
          wetter: string[] | null
        }
        Insert: {
          beschreibung: string
          created_at?: string
          datum: string
          end_time: string
          geschoss?: string[] | null
          id?: string
          is_verrechnet?: boolean
          kunde_adresse?: string | null
          kunde_email?: string | null
          kunde_name: string
          kunde_telefon?: string | null
          notizen?: string | null
          pause_minutes?: number
          pdf_gesendet_am?: string | null
          start_time: string
          status?: string
          stunden: number
          temperatur_max?: number | null
          temperatur_min?: number | null
          unterschrift_am?: string | null
          unterschrift_kunde?: string | null
          updated_at?: string
          user_id: string
          wetter?: string[] | null
        }
        Update: {
          beschreibung?: string
          created_at?: string
          datum?: string
          end_time?: string
          geschoss?: string[] | null
          id?: string
          is_verrechnet?: boolean
          kunde_adresse?: string | null
          kunde_email?: string | null
          kunde_name?: string
          kunde_telefon?: string | null
          notizen?: string | null
          pause_minutes?: number
          pdf_gesendet_am?: string | null
          start_time?: string
          status?: string
          stunden?: number
          temperatur_max?: number | null
          temperatur_min?: number | null
          unterschrift_am?: string | null
          unterschrift_kunde?: string | null
          updated_at?: string
          user_id?: string
          wetter?: string[] | null
        }
        Relationships: []
      }
      bad_weather_records: {
        Row: {
          id: string
          user_id: string
          project_id: string
          datum: string
          beginn_schlechtwetter: string
          ende_schlechtwetter: string
          schlechtwetter_stunden: number
          arbeitsstunden_vor_schlechtwetter: number
          wetter_art: string[] | null
          notizen: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          datum: string
          beginn_schlechtwetter: string
          ende_schlechtwetter: string
          schlechtwetter_stunden: number
          arbeitsstunden_vor_schlechtwetter?: number
          wetter_art?: string[] | null
          notizen?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          datum?: string
          beginn_schlechtwetter?: string
          ende_schlechtwetter?: string
          schlechtwetter_stunden?: number
          arbeitsstunden_vor_schlechtwetter?: number
          wetter_art?: string[] | null
          notizen?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          id: string
          user_id: string
          project_id: string
          report_type: string
          datum: string
          temperatur_min: number | null
          temperatur_max: number | null
          wetter: string[] | null
          geschoss: string[] | null
          beschreibung: string
          notizen: string | null
          sicherheitscheckliste: Json | null
          sicherheit_bestaetigt: boolean
          unterschrift_kunde: string | null
          unterschrift_am: string | null
          unterschrift_name: string | null
          status: string
          pdf_gesendet_am: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          report_type?: string
          datum: string
          temperatur_min?: number | null
          temperatur_max?: number | null
          wetter?: string[] | null
          geschoss?: string[] | null
          beschreibung?: string
          notizen?: string | null
          sicherheitscheckliste?: Json | null
          sicherheit_bestaetigt?: boolean
          unterschrift_kunde?: string | null
          unterschrift_am?: string | null
          unterschrift_name?: string | null
          status?: string
          pdf_gesendet_am?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          report_type?: string
          datum?: string
          temperatur_min?: number | null
          temperatur_max?: number | null
          wetter?: string[] | null
          geschoss?: string[] | null
          beschreibung?: string
          notizen?: string | null
          sicherheitscheckliste?: Json | null
          sicherheit_bestaetigt?: boolean
          unterschrift_kunde?: string | null
          unterschrift_am?: string | null
          unterschrift_name?: string | null
          status?: string
          pdf_gesendet_am?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_report_activities: {
        Row: {
          id: string
          daily_report_id: string
          geschoss: string
          beschreibung: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          daily_report_id: string
          geschoss: string
          beschreibung: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          daily_report_id?: string
          geschoss?: string
          beschreibung?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_report_activities_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_report_photos: {
        Row: {
          id: string
          daily_report_id: string
          user_id: string
          file_path: string
          file_name: string
          created_at: string
        }
        Insert: {
          id?: string
          daily_report_id: string
          user_id: string
          file_path: string
          file_name: string
          created_at?: string
        }
        Update: {
          id?: string
          daily_report_id?: string
          user_id?: string
          file_path?: string
          file_name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_report_photos_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_report_workers: {
        Row: {
          id: string
          daily_report_id: string
          user_id: string
          is_main: boolean
          created_at: string
        }
        Insert: {
          id?: string
          daily_report_id: string
          user_id: string
          is_main?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          daily_report_id?: string
          user_id?: string
          is_main?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_report_workers_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          id: string
          name: string
          kategorie: string
          seriennummer: string | null
          kaufdatum: string | null
          zustand: string
          standort_typ: string
          standort_project_id: string | null
          notizen: string | null
          naechste_wartung: string | null
          wartungsintervall_monate: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          kategorie: string
          seriennummer?: string | null
          kaufdatum?: string | null
          zustand?: string
          standort_typ?: string
          standort_project_id?: string | null
          notizen?: string | null
          naechste_wartung?: string | null
          wartungsintervall_monate?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          kategorie?: string
          seriennummer?: string | null
          kaufdatum?: string | null
          zustand?: string
          standort_typ?: string
          standort_project_id?: string | null
          notizen?: string | null
          naechste_wartung?: string | null
          wartungsintervall_monate?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_standort_project_id_fkey"
            columns: ["standort_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_transfers: {
        Row: {
          id: string
          equipment_id: string
          von_typ: string
          von_project_id: string | null
          nach_typ: string
          nach_project_id: string | null
          transferiert_am: string
          transferiert_von: string
          notizen: string | null
          created_at: string
        }
        Insert: {
          id?: string
          equipment_id: string
          von_typ: string
          von_project_id?: string | null
          nach_typ: string
          nach_project_id?: string | null
          transferiert_am?: string
          transferiert_von: string
          notizen?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          equipment_id?: string
          von_typ?: string
          von_project_id?: string | null
          nach_typ?: string
          nach_project_id?: string | null
          transferiert_am?: string
          transferiert_von?: string
          notizen?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_transfers_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          beschreibung: string | null
          created_at: string
          file_url: string
          id: string
          name: string
          project_id: string
          typ: string
          user_id: string
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string
          file_url: string
          id?: string
          name: string
          project_id: string
          typ: string
          user_id: string
        }
        Update: {
          beschreibung?: string | null
          created_at?: string
          file_url?: string
          id?: string
          name?: string
          project_id?: string
          typ?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          adresse: string | null
          austritt_datum: string | null
          bank_name: string | null
          beschaeftigung_art: string | null
          bic: string | null
          created_at: string | null
          eintritt_datum: string | null
          email: string | null
          geburtsdatum: string | null
          iban: string | null
          id: string
          is_external: boolean | null
          kategorie: string | null
          kleidungsgroesse: string | null
          land: string | null
          nachname: string
          notizen: string | null
          ort: string | null
          plz: string | null
          position: string | null
          regelarbeitszeit: Json | null
          schuhgroesse: string | null
          stundenlohn: number | null
          sv_nummer: string | null
          telefon: string | null
          updated_at: string | null
          user_id: string | null
          vorname: string
          wochen_soll_stunden: number | null
        }
        Insert: {
          adresse?: string | null
          austritt_datum?: string | null
          bank_name?: string | null
          beschaeftigung_art?: string | null
          bic?: string | null
          created_at?: string | null
          eintritt_datum?: string | null
          email?: string | null
          geburtsdatum?: string | null
          iban?: string | null
          id?: string
          is_external?: boolean | null
          kategorie?: string | null
          kleidungsgroesse?: string | null
          land?: string | null
          nachname: string
          notizen?: string | null
          ort?: string | null
          plz?: string | null
          position?: string | null
          regelarbeitszeit?: Json | null
          schuhgroesse?: string | null
          stundenlohn?: number | null
          sv_nummer?: string | null
          telefon?: string | null
          updated_at?: string | null
          user_id?: string | null
          vorname: string
          wochen_soll_stunden?: number | null
        }
        Update: {
          adresse?: string | null
          austritt_datum?: string | null
          bank_name?: string | null
          beschaeftigung_art?: string | null
          bic?: string | null
          created_at?: string | null
          eintritt_datum?: string | null
          email?: string | null
          geburtsdatum?: string | null
          iban?: string | null
          id?: string
          is_external?: boolean | null
          kategorie?: string | null
          kleidungsgroesse?: string | null
          land?: string | null
          nachname?: string
          notizen?: string | null
          ort?: string | null
          plz?: string | null
          position?: string | null
          regelarbeitszeit?: Json | null
          schuhgroesse?: string | null
          stundenlohn?: number | null
          sv_nummer?: string | null
          telefon?: string | null
          updated_at?: string | null
          user_id?: string | null
          vorname?: string
          wochen_soll_stunden?: number | null
        }
        Relationships: []
      }
      invitation_logs: {
        Row: {
          gesendet_am: string | null
          gesendet_von: string | null
          id: string
          status: string | null
          telefonnummer: string
        }
        Insert: {
          gesendet_am?: string | null
          gesendet_von?: string | null
          id?: string
          status?: string | null
          telefonnummer: string
        }
        Update: {
          gesendet_am?: string | null
          gesendet_von?: string | null
          id?: string
          status?: string | null
          telefonnummer?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          beschreibung: string
          created_at: string
          einheit: string | null
          einzelpreis: number
          gesamtpreis: number
          id: string
          invoice_id: string
          menge: number
          position: number
        }
        Insert: {
          beschreibung: string
          created_at?: string
          einheit?: string | null
          einzelpreis?: number
          gesamtpreis?: number
          id?: string
          invoice_id: string
          menge?: number
          position?: number
        }
        Update: {
          beschreibung?: string
          created_at?: string
          einheit?: string | null
          einzelpreis?: number
          gesamtpreis?: number
          id?: string
          invoice_id?: string
          menge?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          brutto_summe: number
          created_at: string
          datum: string
          faellig_am: string | null
          id: string
          jahr: number
          kunde_adresse: string | null
          kunde_email: string | null
          kunde_land: string | null
          kunde_name: string
          kunde_ort: string | null
          kunde_plz: string | null
          kunde_telefon: string | null
          kunde_uid: string | null
          laufnummer: number
          leistungsdatum: string | null
          mwst_betrag: number
          mwst_satz: number
          netto_summe: number
          notizen: string | null
          nummer: string
          project_id: string | null
          status: string
          typ: string
          updated_at: string
          user_id: string
          zahlungsbedingungen: string | null
        }
        Insert: {
          brutto_summe?: number
          created_at?: string
          datum?: string
          faellig_am?: string | null
          id?: string
          jahr?: number
          kunde_adresse?: string | null
          kunde_email?: string | null
          kunde_land?: string | null
          kunde_name: string
          kunde_ort?: string | null
          kunde_plz?: string | null
          kunde_telefon?: string | null
          kunde_uid?: string | null
          laufnummer: number
          leistungsdatum?: string | null
          mwst_betrag?: number
          mwst_satz?: number
          netto_summe?: number
          notizen?: string | null
          nummer: string
          project_id?: string | null
          status?: string
          typ?: string
          updated_at?: string
          user_id: string
          zahlungsbedingungen?: string | null
        }
        Update: {
          brutto_summe?: number
          created_at?: string
          datum?: string
          faellig_am?: string | null
          id?: string
          jahr?: number
          kunde_adresse?: string | null
          kunde_email?: string | null
          kunde_land?: string | null
          kunde_name?: string
          kunde_ort?: string | null
          kunde_plz?: string | null
          kunde_telefon?: string | null
          kunde_uid?: string | null
          laufnummer?: number
          leistungsdatum?: string | null
          mwst_betrag?: number
          mwst_satz?: number
          netto_summe?: number
          notizen?: string | null
          nummer?: string
          project_id?: string | null
          status?: string
          typ?: string
          updated_at?: string
          user_id?: string
          zahlungsbedingungen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          created_at: string
          id: string
          total_days: number
          updated_at: string
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id: string
          year?: number
        }
        Update: {
          created_at?: string
          id?: string
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          days: number
          end_date: string
          id: string
          notizen: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days?: number
          end_date: string
          id?: string
          notizen?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: number
          end_date?: string
          id?: string
          notizen?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      material_entries: {
        Row: {
          created_at: string
          id: string
          material: string
          menge: string | null
          notizen: string | null
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material: string
          menge?: string | null
          notizen?: string | null
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material?: string
          menge?: string | null
          notizen?: string | null
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          anleitung_completed: boolean | null
          created_at: string
          id: string
          is_active: boolean | null
          nachname: string
          updated_at: string
          vorname: string
        }
        Insert: {
          anleitung_completed?: boolean | null
          created_at?: string
          id: string
          is_active?: boolean | null
          nachname: string
          updated_at?: string
          vorname: string
        }
        Update: {
          anleitung_completed?: boolean | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          nachname?: string
          updated_at?: string
          vorname?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          adresse: string | null
          bauherr: string | null
          bauherr_kontakt: string | null
          bauleiter: string | null
          beschreibung: string | null
          budget: number | null
          created_at: string
          end_datum: string | null
          id: string
          name: string
          plz: string
          start_datum: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          bauherr?: string | null
          bauherr_kontakt?: string | null
          bauleiter?: string | null
          beschreibung?: string | null
          budget?: number | null
          created_at?: string
          end_datum?: string | null
          id?: string
          name: string
          plz: string
          start_datum?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          bauherr?: string | null
          bauherr_kontakt?: string | null
          bauleiter?: string | null
          beschreibung?: string | null
          budget?: number | null
          created_at?: string
          end_datum?: string | null
          id?: string
          name?: string
          plz?: string
          start_datum?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          arbeitszeit: number
          beschreibung: string
          created_at: string
          datum: string
          id: string
          project_id: string
          unterschrift_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          arbeitszeit: number
          beschreibung: string
          created_at?: string
          datum: string
          id?: string
          project_id: string
          unterschrift_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          arbeitszeit?: number
          beschreibung?: string
          created_at?: string
          datum?: string
          id?: string
          project_id?: string
          unterschrift_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_account_transactions: {
        Row: {
          balance_after: number
          balance_before: number
          change_type: string
          changed_by: string
          created_at: string
          hours: number
          id: string
          reason: string | null
          reference_id: string | null
          user_id: string
        }
        Insert: {
          balance_after: number
          balance_before: number
          change_type: string
          changed_by: string
          created_at?: string
          hours: number
          id?: string
          reason?: string | null
          reference_id?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number
          balance_before?: number
          change_type?: string
          changed_by?: string
          created_at?: string
          hours?: number
          id?: string
          reason?: string | null
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      time_accounts: {
        Row: {
          balance_hours: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_hours?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_hours?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          created_at: string
          datum: string
          diaeten_betrag: number | null
          diaeten_typ: string | null
          disturbance_id: string | null
          end_time: string
          id: string
          kilometer: number | null
          km_beschreibung: string | null
          location_type: string | null
          notizen: string | null
          pause_end: string | null
          pause_minutes: number
          pause_start: string | null
          project_id: string | null
          start_time: string
          stunden: number
          taetigkeit: string | null
          updated_at: string
          user_id: string
          week_type: string | null
          zeit_typ: string | null
        }
        Insert: {
          created_at?: string
          datum: string
          diaeten_betrag?: number | null
          diaeten_typ?: string | null
          disturbance_id?: string | null
          end_time: string
          id?: string
          kilometer?: number | null
          km_beschreibung?: string | null
          location_type?: string | null
          notizen?: string | null
          pause_end?: string | null
          pause_minutes?: number
          pause_start?: string | null
          project_id?: string | null
          start_time: string
          stunden: number
          taetigkeit?: string | null
          updated_at?: string
          user_id: string
          week_type?: string | null
          zeit_typ?: string | null
        }
        Update: {
          created_at?: string
          datum?: string
          diaeten_betrag?: number | null
          diaeten_typ?: string | null
          disturbance_id?: string | null
          end_time?: string
          id?: string
          kilometer?: number | null
          km_beschreibung?: string | null
          location_type?: string | null
          notizen?: string | null
          pause_end?: string | null
          pause_minutes?: number
          pause_start?: string | null
          project_id?: string | null
          start_time?: string
          stunden?: number
          taetigkeit?: string | null
          updated_at?: string
          user_id?: string
          week_type?: string | null
          zeit_typ?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_disturbance_id_fkey"
            columns: ["disturbance_id"]
            isOneToOne: false
            referencedRelation: "disturbances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_workers: {
        Row: {
          created_at: string
          id: string
          source_entry_id: string
          target_entry_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_entry_id: string
          target_entry_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_entry_id?: string
          target_entry_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_workers_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_workers_target_entry_id_fkey"
            columns: ["target_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_overrides: {
        Row: {
          override_role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          override_role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          override_role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      week_settings: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          week_start: string
          week_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          week_start: string
          week_type: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          week_start?: string
          week_type?: string
        }
        Relationships: []
      }
    }
      project_contacts: {
        Row: {
          id: string
          project_id: string
          name: string
          rolle: string | null
          telefon: string | null
          email: string | null
          firma: string | null
          phase: string
          notizen: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          rolle?: string | null
          telefon?: string | null
          email?: string | null
          firma?: string | null
          phase?: string
          notizen?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          rolle?: string | null
          telefon?: string | null
          email?: string | null
          firma?: string | null
          phase?: string
          notizen?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_resources: {
        Row: {
          id: string
          project_id: string
          datum: string
          resource_name: string
          menge: number | null
          einheit: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          datum: string
          resource_name: string
          menge?: number | null
          einheit?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          datum?: string
          resource_name?: string
          menge?: number | null
          einheit?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_resources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_daily_targets: {
        Row: {
          id: string
          project_id: string
          datum: string
          tagesziel: string | null
          nachkalkulation_stunden: number | null
          notizen: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          datum: string
          tagesziel?: string | null
          nachkalkulation_stunden?: number | null
          notizen?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          datum?: string
          tagesziel?: string | null
          nachkalkulation_stunden?: number | null
          notizen?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_daily_targets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_daily_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_extras: {
        Row: {
          id: string
          user_id: string
          monat: number
          jahr: number
          bezeichnung: string
          betrag: number | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          monat: number
          jahr: number
          bezeichnung: string
          betrag?: number | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          monat?: number
          jahr?: number
          bezeichnung?: string
          betrag?: number | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_extras_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_extras_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_favorites: {
        Row: {
          id: string
          user_id: string
          project_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_assignments: {
        Row: {
          id: string
          user_id: string
          project_id: string
          datum: string
          notizen: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          datum: string
          notizen?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          datum?: string
          notizen?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_user_profile: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_invoice_number: {
        Args: { p_jahr?: number; p_typ: string }
        Returns: string
      }
      transfer_equipment: {
        Args: {
          p_equipment_id: string
          p_nach_typ: string
          p_nach_project_id?: string | null
          p_notizen?: string | null
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "administrator" | "mitarbeiter"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["administrator", "mitarbeiter"],
    },
  },
} as const
