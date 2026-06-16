import { useEffect, useState } from "react";

type ConfirmProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export function ConfirmModal({
  open, title, message, confirmLabel = "Bevestig", cancelLabel = "Annuleer",
  destructive, onConfirm, onClose,
}: ConfirmProps) {
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center pb-20 lg:pb-0 overflow-y-auto" style={{ background: "rgba(34,31,27,0.6)" }}>
      <div className="w-full sm:max-w-sm max-h-[85vh] overflow-y-auto" style={{ background: "var(--cream)", border: "1px solid var(--charcoal)" }}>
        <div className="px-4 py-3" style={{ background: "var(--charcoal)", color: "var(--cream)", fontFamily: "var(--font-display)" }}>
          {title}
        </div>
        <div className="px-4 py-4 space-y-4">
          <p className="text-sm" style={{ lineHeight: 1.55 }}>{message}</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onClose} disabled={busy} className="btn-y">{cancelLabel}</button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try { await onConfirm(); onClose(); } finally { setBusy(false); }
              }}
              className="text-xs uppercase tracking-[0.18em] py-3"
              style={{
                border: "1px solid " + (destructive ? "var(--oxide)" : "var(--charcoal)"),
                background: destructive ? "var(--oxide)" : "var(--charcoal)",
                color: "var(--cream)",
              }}
            >
              {busy ? "Bezig…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type PromptProps = {
  open: boolean;
  title: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  onSave: (value: string) => void | Promise<void>;
  onClose: () => void;
};

export function PromptModal({
  open, title, initial = "", placeholder, confirmLabel = "Opslaan", onSave, onClose,
}: PromptProps) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setValue(initial); }, [open, initial]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center pb-20 lg:pb-0 overflow-y-auto" style={{ background: "rgba(34,31,27,0.6)" }}>
      <div className="w-full sm:max-w-sm max-h-[85vh] overflow-y-auto" style={{ background: "var(--cream)", border: "1px solid var(--charcoal)" }}>
        <div className="px-4 py-3" style={{ background: "var(--charcoal)", color: "var(--cream)", fontFamily: "var(--font-display)" }}>
          {title}
        </div>
        <form
          className="px-4 py-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = value.trim();
            if (!v) return;
            setBusy(true);
            try { await onSave(v); onClose(); } finally { setBusy(false); }
          }}
        >
          <input
            autoFocus
            className="field-y"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            disabled={busy}
          />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="btn-y">Annuleer</button>
            <button type="submit" disabled={busy || !value.trim()} className="btn-y-solid">
              {busy ? "Bezig…" : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}