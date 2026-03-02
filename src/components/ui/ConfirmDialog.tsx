import React from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  requireCheckboxLabel?: string | null;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export default function ConfirmDialog({
  open,
  title = 'Confirmação',
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  requireCheckboxLabel = null,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [checked, setChecked] = React.useState(false);
  React.useEffect(() => {
    if (!open) setChecked(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-white rounded shadow-lg overflow-hidden">
        <div className="p-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}

          {requireCheckboxLabel && (
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <span>{requireCheckboxLabel}</span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 p-3 border-t">
          <button className="px-3 py-1 rounded bg-gray-100" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50"
            onClick={async () => {
              await onConfirm();
            }}
            disabled={!!requireCheckboxLabel && !checked}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
