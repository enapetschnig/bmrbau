import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Globaler Bestaetigungs-Dialog – Ersatz fuer das native `window.confirm()`.
 *
 * Nutzung in Komponenten:
 *   import { confirm } from "@/lib/confirm";
 *   if (!(await confirm({ title: "Wirklich loeschen?" }))) return;
 *
 * Der Dialog muss einmal im Root (App.tsx) gemountet werden.
 */

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

// Modul-weite Referenz auf den internen Setter — erlaubt imperatives API
let openConfirm: ((state: ConfirmState) => void) | null = null;

/**
 * Imperatives confirm() – gibt ein Promise<boolean> zurueck.
 * Muss nach Mount des Providers verwendet werden (passiert direkt nach App-Start).
 */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  if (!openConfirm) {
    // Fallback falls Provider noch nicht gemountet ist
    return Promise.resolve(window.confirm(opts.title));
  }
  return new Promise<boolean>((resolve) => {
    openConfirm!({ ...opts, resolve });
  });
}

export function ConfirmDialogProvider() {
  const [state, setState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    openConfirm = (next) => setState(next);
    return () => {
      openConfirm = null;
    };
  }, []);

  const close = (answer: boolean) => {
    state?.resolve(answer);
    setState(null);
  };

  return (
    <AlertDialog open={!!state} onOpenChange={(next) => !next && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title}</AlertDialogTitle>
          {state?.description && (
            <AlertDialogDescription>{state.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {state?.cancelLabel ?? "Abbrechen"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={state?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {state?.confirmLabel ?? "Bestätigen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
