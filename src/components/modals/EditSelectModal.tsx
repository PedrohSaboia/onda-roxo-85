import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Option = { id: string; nome: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  options: Option[];
  value?: string | null;
  onSave: (selectedId: string | null) => Promise<void> | void;
  loading?: boolean;
};

export default function EditSelectModal({ open, onOpenChange, title = 'Editar', options, value, onSave, loading }: Props) {
  const [selected, setSelected] = React.useState<string | null>(value || null);

  React.useEffect(() => {
    setSelected(value || null);
  }, [value, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <select className="w-full border rounded p-3" value={selected || ''} onChange={(e) => setSelected(e.target.value || null)}>
            <option value="">Nenhum</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </div>

        <DialogFooter>
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="bg-purple-700 text-white" onClick={async () => { await onSave(selected); }}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
