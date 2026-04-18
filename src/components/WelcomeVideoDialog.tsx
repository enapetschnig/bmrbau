import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share, Plus, Home, Smartphone, CheckCircle2 } from "lucide-react";

interface WelcomeVideoDialogProps {
  open: boolean;
  onContinue: () => void;
  onSkip: () => void;
  isReplay?: boolean;
}

type Platform = "ios-safari" | "android-chrome" | "desktop";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  if (isIos) return "ios-safari";
  if (/android/.test(ua)) return "android-chrome";
  return "desktop";
}

function IosSteps() {
  return (
    <ol className="space-y-4">
      <li className="flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">1</span>
        <div className="flex-1">
          <p className="font-medium">Teilen-Button antippen</p>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            <Share className="h-4 w-4" /> Unten in der Safari-Leiste
          </p>
        </div>
      </li>
      <li className="flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">2</span>
        <div className="flex-1">
          <p className="font-medium">„Zum Home-Bildschirm" wählen</p>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            <Plus className="h-4 w-4" /> Nach unten scrollen im Menü
          </p>
        </div>
      </li>
      <li className="flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">3</span>
        <div className="flex-1">
          <p className="font-medium">Mit „Hinzufügen" bestätigen</p>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            <Home className="h-4 w-4" /> App erscheint am Startbildschirm
          </p>
        </div>
      </li>
    </ol>
  );
}

function AndroidSteps() {
  return (
    <ol className="space-y-4">
      <li className="flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">1</span>
        <div className="flex-1">
          <p className="font-medium">Menü (⋮) oben rechts öffnen</p>
          <p className="text-sm text-muted-foreground mt-1">In Chrome / Firefox / Edge</p>
        </div>
      </li>
      <li className="flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">2</span>
        <div className="flex-1">
          <p className="font-medium">„App installieren" oder „Zum Startbildschirm"</p>
          <p className="text-sm text-muted-foreground mt-1">Meist als Vorschlag ganz oben</p>
        </div>
      </li>
      <li className="flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">3</span>
        <div className="flex-1">
          <p className="font-medium">Installieren bestätigen</p>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            <CheckCircle2 className="h-4 w-4" /> Fertig – App-Icon liegt am Startbildschirm
          </p>
        </div>
      </li>
    </ol>
  );
}

function DesktopSteps() {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
      <p className="flex items-center gap-2 font-medium">
        <Smartphone className="h-4 w-4" />
        Diese App ist für die Baustelle gedacht
      </p>
      <p className="text-muted-foreground">
        Öffne die Seite am Handy (gleiche URL), dort kannst du sie als App zum
        Startbildschirm hinzufügen. Am Desktop funktioniert sie trotzdem im
        Browser.
      </p>
    </div>
  );
}

export function WelcomeVideoDialog({
  open,
  onContinue,
  onSkip,
  isReplay = false,
}: WelcomeVideoDialogProps) {
  const [platform, setPlatform] = useState<Platform>("desktop");

  useEffect(() => {
    if (open) setPlatform(detectPlatform());
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onSkip()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isReplay
              ? "App zum Startbildschirm hinzufügen"
              : "Willkommen bei der BMR Bau App"}
          </DialogTitle>
          <DialogDescription>
            Speichere die App am Startbildschirm, dann startet sie wie eine
            normale App und funktioniert auch offline-freundlicher.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {platform === "ios-safari" && <IosSteps />}
          {platform === "android-chrome" && <AndroidSteps />}
          {platform === "desktop" && <DesktopSteps />}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onSkip}>
            Später
          </Button>
          <Button onClick={isReplay ? onSkip : onContinue}>
            {isReplay ? "Schließen" : "Verstanden"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
