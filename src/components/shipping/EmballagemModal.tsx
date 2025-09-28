import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type EmballagemModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  embalagem?: any;
};

export default function EmballagemModal({ open, onClose, onSave, embalagem }: EmballagemModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    altura: '',
    largura: '',
    comprimento: '',
    peso: '',
  });

  useEffect(() => {
    if (embalagem) {
      setForm({
        nome: embalagem.nome || '',
        altura: String(embalagem.altura || ''),
        largura: String(embalagem.largura || ''),
        comprimento: String(embalagem.comprimento || ''),
        peso: String(embalagem.peso || ''),
      });
    } else {
      setForm({
        nome: '',
        altura: '',
        largura: '',
        comprimento: '',
        peso: '',
      });
    }
  }, [embalagem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações
    const altura = Number(form.altura);
    const largura = Number(form.largura);
    const comprimento = Number(form.comprimento);
    const peso = Number(form.peso);
    
    if (!form.nome.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    
    if (altura <= 0 || largura <= 0 || comprimento <= 0 || peso <= 0) {
      toast({ 
        title: 'Erro', 
        description: 'Dimensões e peso devem ser maiores que zero', 
        variant: 'destructive' 
      });
      return;
    }

    setLoading(true);
    try {
      await onSave({
        ...form,
        altura: Number(form.altura),
        largura: Number(form.largura),
        comprimento: Number(form.comprimento),
        peso: Number(form.peso),
      });
      onClose();
    } catch (err: any) {
      toast({ 
        title: 'Erro', 
        description: err.message || 'Erro ao salvar embalagem',
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{embalagem ? 'Editar' : 'Nova'} Embalagem</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Caixa Pequena"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="altura">Altura (cm)</Label>
                <Input
                  id="altura"
                  type="number"
                  value={form.altura}
                  onChange={e => setForm(f => ({ ...f, altura: e.target.value }))}
                  placeholder="Ex: 10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="largura">Largura (cm)</Label>
                <Input
                  id="largura"
                  type="number"
                  value={form.largura}
                  onChange={e => setForm(f => ({ ...f, largura: e.target.value }))}
                  placeholder="Ex: 20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="comprimento">Comprimento (cm)</Label>
                <Input
                  id="comprimento"
                  type="number"
                  value={form.comprimento}
                  onChange={e => setForm(f => ({ ...f, comprimento: e.target.value }))}
                  placeholder="Ex: 30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peso">Peso (kg)</Label>
                <Input
                  id="peso"
                  type="number"
                  step="0.1"
                  value={form.peso}
                  onChange={e => setForm(f => ({ ...f, peso: e.target.value }))}
                  placeholder="Ex: 0.5"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
