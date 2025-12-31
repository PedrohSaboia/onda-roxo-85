import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import RemetenteModal from './RemetenteModal';
import { Edit, Trash } from 'lucide-react';

type Remetente = {
  id?: string;
  nome: string;
  cep: string;
  endereco: string;
  cidade: string;
  estado: string;
};

type RemetenteInput = Partial<Omit<Remetente, 'id'>> & { empresa_id?: string | null };

export default function RemetentesManager() {
  const { toast } = useToast();
  const { empresaId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [remetentes, setRemetentes] = useState<Remetente[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Remetente | null>(null);

  const loadRemetentesCb = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('remetentes')
        .select('*')
        .order('nome');

      if (error) throw error;
      setRemetentes(data || []);
    } catch (err: unknown) {
      console.error('Erro ao carregar remetentes:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os remetentes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRemetentesCb();
  }, [loadRemetentesCb]);

  // kept for backwards compatibility if needed elsewhere
  const loadRemetentes = loadRemetentesCb;

  const handleSave = async (data: RemetenteInput) => {
    if (selected) {
      // Update
      const { error } = await supabase.from('remetentes').update(data as Partial<Remetente>).eq('id', selected.id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Remetente atualizado' });
    } else {
      // Insert
      const insertData = { ...data, empresa_id: empresaId || null };
      const { error } = await supabase.from('remetentes').insert(insertData as Remetente);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Remetente criado' });
    }

    await loadRemetentesCb();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este remetente?')) return;

    try {
      const { error } = await supabase.from('remetentes').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Remetente excluído' });
      await loadRemetentesCb();
    } catch (err: unknown) {
      console.error('Erro ao excluir:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o remetente',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (remetente: Remetente) => {
    setSelected(remetente);
    setModalOpen(true);
  };

  const handleNew = () => {
    setSelected(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelected(null);
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="flex px-0 pt-0 pb-4 flex-row items-center justify-between">
        <CardTitle>Remetentes</CardTitle>
        <Button className="mr-3" onClick={handleNew}>Novo Remetente</Button>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CEP</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead className="text-center w-[100px] pr-0">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {remetentes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Nenhum remetente cadastrado
                </TableCell>
              </TableRow>
            ) : (
              remetentes.map((remetente) => (
                <TableRow key={remetente.id}>
                  <TableCell className="font-medium">{remetente.nome}</TableCell>
                  <TableCell>
                    {remetente.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}
                  </TableCell>
                  <TableCell>{remetente.endereco}</TableCell>
                  <TableCell>{remetente.cidade}/{remetente.estado}</TableCell>
                  <TableCell className="text-right pr-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(remetente)}
                      title="Editar remetente"
                      aria-label="Editar remetente"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(remetente.id)}
                      title="Excluir remetente"
                      aria-label="Excluir remetente"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <RemetenteModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        remetente={selected}
      />
    </Card>
  );
}
