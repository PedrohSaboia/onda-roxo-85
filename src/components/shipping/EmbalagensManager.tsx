import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import EmballagemModal from './EmballagemModal';

type Embalagem = {
  id: string;
  nome: string;
  altura: number;
  largura: number;
  comprimento: number;
  peso: number;
};

export default function EmbalagensManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [embalagens, setEmbalagens] = useState<Embalagem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Embalagem | null>(null);

  useEffect(() => {
    loadEmbalagens();
  }, []);

  const loadEmbalagens = async () => {
    try {
      const { data, error } = await supabase
        .from('embalagens')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      setEmbalagens(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar embalagens:', err);
      toast({ 
        title: 'Erro', 
        description: 'Não foi possível carregar as embalagens',
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
          .from('embalagens')
          .update(data)
          .eq('id', selected.id);
        
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Embalagem atualizada' });
      } else {
        // Insert
        const { error } = await supabase
          .from('embalagens')
          .insert(data);
        
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Embalagem criada' });
      }
      
      await loadEmbalagens();
    } catch (err: any) {
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta embalagem?')) return;
    
    try {
      const { error } = await supabase
        .from('embalagens')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Embalagem excluída' });
      await loadEmbalagens();
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      toast({ 
        title: 'Erro', 
        description: 'Não foi possível excluir a embalagem',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (embalagem: Embalagem) => {
    setSelected(embalagem);
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
        <CardTitle>Embalagens</CardTitle>
        <Button onClick={handleNew}>Nova Embalagem</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Dimensões (cm)</TableHead>
              <TableHead>Peso (kg)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {embalagens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Nenhuma embalagem cadastrada
                </TableCell>
              </TableRow>
            ) : (
              embalagens.map((embalagem) => (
                <TableRow key={embalagem.id}>
                  <TableCell className="font-medium">{embalagem.nome}</TableCell>
                  <TableCell>
                    {embalagem.altura} × {embalagem.largura} × {embalagem.comprimento}
                  </TableCell>
                  <TableCell>{embalagem.peso}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(embalagem)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(embalagem.id)}
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

      <EmballagemModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        embalagem={selected}
      />
    </Card>
  );
}
