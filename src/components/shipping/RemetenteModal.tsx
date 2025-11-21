import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type RemetenteModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  remetente?: any;
};
//teste

export default function RemetenteModal({ open, onClose, onSave, remetente }: RemetenteModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    cep: '',
    endereco: '',
    cidade: '',
    estado: '',
  });

  useEffect(() => {
    if (remetente) {
      setForm({
        nome: remetente.nome || '',
        cep: remetente.cep || '',
        endereco: remetente.endereco || '',
        cidade: remetente.cidade || '',
        estado: remetente.estado || '',
      });
    } else {
      setForm({
        nome: '',
        cep: '',
        endereco: '',
        cidade: '',
        estado: '',
      });
    }
  }, [remetente]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações
    if (!form.nome.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    
    const cepLimpo = form.cep.replace(/\D/g, '');
    if (!/^\d{8}$/.test(cepLimpo)) {
      toast({ 
        title: 'Erro', 
        description: 'CEP inválido. Digite 8 números.', 
        variant: 'destructive' 
      });
      return;
    }

    setLoading(true);
    try {
      await onSave({
        ...form,
        cep: cepLimpo,
      });
      onClose();
    } catch (err: any) {
      toast({ 
        title: 'Erro', 
        description: err.message || 'Erro ao salvar remetente',
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCepChange = (value: string) => {
    // Formata o CEP enquanto digita
    const cep = value.replace(/\D/g, '').slice(0, 8);
    const formatted = cep.replace(/(\d{5})(\d{3})/, '$1-$2');
    setForm(f => ({ ...f, cep: formatted }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{remetente ? 'Editar' : 'Novo'} Remetente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 flex-1 flex flex-col">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Centro de Distribuição SP"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={form.cep}
                onChange={e => handleCepChange(e.target.value)}
                placeholder="00000-000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={form.endereco}
                onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))}
                placeholder="Ex: Rua Principal, 123"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={form.cidade}
                  onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
                  placeholder="Ex: São Paulo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Input
                  id="estado"
                  value={form.estado}
                  onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                  placeholder="Ex: SP"
                  maxLength={2}
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
