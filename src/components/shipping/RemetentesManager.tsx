import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import RemetenteModal from './RemetenteModal';

type Remetente = {
  id: string;
  nome: string;
  cep: string;
  endereco: string;
  cidade: string;
  estado: string;
};

export default function RemetentesManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [remetentes, setRemetentes] = useState<Remetente[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Remetente | null>(null);

  useEffect(() => {
    loadRemetentes();
  }, []);

  const loadRemetentes = async () => {
    try {
      const { data, error } = await supabase
        .from('remetentes')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      setRemetentes(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar remetentes:', err);
      toast({ 
        title: 'Erro', 
        description: 'Não foi possível carregar os remetentes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: any) => {
    try {
      if (selected) {
        // Update
        const { error } = await supabase
          .from('remetentes')
          .update(data)
          .eq('id', selected.id);
        
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Remetente atualizado' });
      } else {
        // Insert
        const { error } = await supabase
          .from('remetentes')
          .insert(data);
        
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Remetente criado' });
      }
      
      await loadRemetentes();
    } catch (err: any) {
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este remetente?')) return;
    
    try {
      const { error } = await supabase
        .from('remetentes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Remetente excluído' });
      await loadRemetentes();
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      toast({ 
        title: 'Erro', 
        description: 'Não foi possível excluir o remetente',
        variant: 'destructive'
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Remetentes</CardTitle>
        <Button onClick={handleNew}>Novo Remetente</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CEP</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead className="text-right">Ações</TableHead>
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
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(remetente)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(remetente.id)}
                    >
                      Excluir
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
