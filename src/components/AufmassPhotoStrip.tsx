import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface AufmassPhoto {
  id: string;
  sheet_id: string;
  position_id: string | null;
  file_path: string;
  file_name: string | null;
  sort_order: number;
}

interface Props {
  sheetId: string;
  /** null = globale Anhaenge des Sheets, sonst eine Position */
  positionId: string | null;
  projectId: string;
  photos: AufmassPhoto[];
  onChange: (next: AufmassPhoto[]) => void;
  disabled?: boolean;
}

/**
 * Kleine Foto-Strip-Komponente fuer Aufmaßblaetter.
 * Speichert Datei in storage.project-aufmass/<projectId>/photos/<uuid>.<ext>
 * und einen Eintrag in aufmass_photos.
 */
export const AufmassPhotoStrip = ({
  sheetId,
  positionId,
  projectId,
  photos,
  onChange,
  disabled,
}: Props) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  // Preview-URLs (signed) fuer alle Fotos laden.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const p of photos) {
        if (previewUrls[p.id]) {
          next[p.id] = previewUrls[p.id];
          continue;
        }
        const { data } = await supabase
          .storage
          .from("project-aufmass")
          .createSignedUrl(p.file_path, 60 * 30);
        if (data) next[p.id] = data.signedUrl;
      }
      if (!cancelled) setPreviewUrls(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.map((p) => p.id).join(",")]);

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const newPhotos: AufmassPhoto[] = [];
    for (const file of Array.from(files)) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${projectId}/photos/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("project-aufmass")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (upErr) {
        toast({ variant: "destructive", title: "Upload-Fehler", description: upErr.message });
        continue;
      }
      const sort_order = (photos.length + newPhotos.length) * 10;
      const { data: row, error: insErr } = await supabase
        .from("aufmass_photos")
        .insert({
          sheet_id: sheetId,
          position_id: positionId,
          user_id: user.id,
          file_path: path,
          file_name: file.name,
          sort_order,
        })
        .select("*")
        .single();
      if (insErr || !row) {
        toast({ variant: "destructive", title: "Fehler", description: insErr?.message });
        await supabase.storage.from("project-aufmass").remove([path]);
        continue;
      }
      newPhotos.push(row as AufmassPhoto);
    }
    if (newPhotos.length > 0) onChange([...photos, ...newPhotos]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemove = async (p: AufmassPhoto) => {
    await supabase.storage.from("project-aufmass").remove([p.file_path]);
    await supabase.from("aufmass_photos").delete().eq("id", p.id);
    setPreviewUrls((prev) => {
      const next = { ...prev };
      delete next[p.id];
      return next;
    });
    onChange(photos.filter((x) => x.id !== p.id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {photos.length === 0 ? "Keine Fotos" : `${photos.length} Foto${photos.length === 1 ? "" : "s"}`}
        </span>
        {!disabled && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleAdd}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Camera className="w-3.5 h-3.5 mr-1" />}
              <span className="text-xs">Foto</span>
            </Button>
          </>
        )}
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square border rounded overflow-hidden bg-muted">
              {previewUrls[p.id] ? (
                <img
                  src={previewUrls[p.id]}
                  alt={p.file_name || ""}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!disabled && (
                <button
                  type="button"
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center"
                  onClick={() => handleRemove(p)}
                  title="Foto entfernen"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
