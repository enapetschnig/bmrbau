import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeStorageKey } from "@/lib/sanitizeStorageKey";

interface Attachment {
  id: string;
  file_path: string;
  file_name: string;
  size_bytes: number | null;
  created_at: string;
}

interface Props {
  disturbanceId: string;
  canEdit: boolean;
}

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB pro PDF

export const DisturbanceAttachments = ({ disturbanceId, canEdit }: Props) => {
  const { toast } = useToast();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchItems(); }, [disturbanceId]);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("disturbance_attachments")
      .select("*")
      .eq("disturbance_id", disturbanceId)
      .order("created_at", { ascending: true });
    if (data) setItems(data as Attachment[]);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    let uploaded = 0;
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        toast({ variant: "destructive", title: "Nur PDF möglich", description: `${file.name} — es können nur PDF-Dokumente an den Regiebericht angehängt werden.` });
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast({ variant: "destructive", title: "Zu groß", description: `${file.name} ist größer als 20MB` });
        continue;
      }

      const filePath = `${disturbanceId}/${Date.now()}_${sanitizeStorageKey(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("disturbance-attachments")
        .upload(filePath, file, { contentType: "application/pdf" });
      if (upErr) {
        toast({ variant: "destructive", title: "Upload fehlgeschlagen", description: upErr.message });
        continue;
      }
      const { error: dbErr } = await supabase
        .from("disturbance_attachments")
        .insert({
          disturbance_id: disturbanceId,
          user_id: user.id,
          file_path: filePath,
          file_name: file.name,
          size_bytes: file.size,
        });
      if (dbErr) {
        await supabase.storage.from("disturbance-attachments").remove([filePath]);
        toast({ variant: "destructive", title: "Fehler", description: "Anhang konnte nicht gespeichert werden" });
        continue;
      }
      uploaded++;
    }

    if (uploaded > 0) {
      toast({ title: "Hochgeladen", description: `${uploaded} Dokument${uploaded > 1 ? "e" : ""} hinzugefügt — wird am Regiebericht-PDF hinten angehängt.` });
      await fetchItems();
    }
    if (inputRef.current) inputRef.current.value = "";
    setUploading(false);
  };

  const handleDelete = async (att: Attachment) => {
    await supabase.storage.from("disturbance-attachments").remove([att.file_path]);
    const { error } = await supabase.from("disturbance_attachments").delete().eq("id", att.id);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: "Anhang konnte nicht gelöscht werden" });
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== att.id));
    toast({ title: "Gelöscht" });
  };

  const handleOpen = (att: Attachment) => {
    const { data } = supabase.storage.from("disturbance-attachments").getPublicUrl(att.file_path);
    window.open(data.publicUrl, "_blank");
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Dokumente
          </CardTitle>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Lädt..." : "Dokument hinzufügen"}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Lade PDFs hoch (z.B. Kundenrechnung, externer Plan). Sie werden ans Ende des Regiebericht-PDFs angehängt — beim Download und beim Versand per E-Mail.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-4 text-sm text-muted-foreground">Lädt…</p>
        ) : items.length === 0 ? (
          <p className="text-center py-4 text-sm text-muted-foreground">Keine PDF-Anhänge</p>
        ) : (
          <div className="space-y-2">
            {items.map((att) => (
              <div key={att.id} className="flex items-center gap-2 border rounded-md p-2 hover:bg-muted/40 transition-colors">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{att.file_name}</p>
                  {att.size_bytes != null && (
                    <p className="text-xs text-muted-foreground">{formatSize(att.size_bytes)}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpen(att)}
                  className="h-8 px-2"
                  title="PDF öffnen"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(att)}
                    className="h-8 px-2 text-destructive"
                    title="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
