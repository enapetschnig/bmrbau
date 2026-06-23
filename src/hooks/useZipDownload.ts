// Triggert den nativen Browser-Download des Projekt-Foto-ZIPs und zeigt
// einen kurzen Hinweis-Toast. Kein Dialog, kein Progress — der Browser
// uebernimmt die Anzeige der Download-Aktivitaet selbst.

import { useCallback } from "react";
import { triggerProjectPhotosZipDownload, type ServerZipParams } from "@/lib/serverZipDownload";
import { useToast } from "@/hooks/use-toast";

export function useZipDownload() {
  const { toast } = useToast();

  const startServerZip = useCallback((params: ServerZipParams) => {
    triggerProjectPhotosZipDownload(params);
    toast({
      title: "Download gestartet",
      description:
        "Der Server packt die Fotos zusammen — kann je nach Projektgröße ein paar Sekunden dauern. Den Fortschritt siehst du im Browser-Download-Bereich.",
    });
  }, [toast]);

  return { startServerZip };
}
