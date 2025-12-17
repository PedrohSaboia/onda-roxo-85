import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Edit, Trash, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '@/components/layout/AppHeader';
import EmballagemModal from '@/components/shipping/EmballagemModal';
import EstoqueSidebar from '@/components/layout/EstoqueSidebar';

export function ListaEmbalagens() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { empresaId } = useAuth();
  const [embalagens, setEmbalagens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmbalagem, setEditingEmbalagem] = useState<any | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const loadEmbalagens = async () => {
    setLoading(true);
    try {
      // Get total count
      const { count } = await supabase
        .from('embalagens')
        .select('*', { count: 'exact', head: true });
      
      setTotal(count || 0);

      // Get paginated data
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('embalagens')
        .select('*')
        .order('nome');

      if (searchTerm) {
        query = query.ilike('nome', `%${searchTerm}%`);
      }

      const { data, error } = await query.range(from, to);
      
      if (error) throw error;
      setEmbalagens(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar embalagens:', err);
      toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmbalagens();
  }, [page, searchTerm]);

  const handleSaveEmbalagem = async (data: any) => {
    try {
      if (editingEmbalagem && editingEmbalagem.id) {
        const { error } = await supabase
          .from('embalagens')
          .update(data)
          .eq('id', editingEmbalagem.id);
        if (error) throw error;
        toast({ title: 'Embalagem atualizada com sucesso!' });
      } else {
        const insertData = { ...data, empresa_id: empresaId || null };
        const { error } = await supabase
          .from('embalagens')
          .insert(insertData);
        if (error) throw error;
        toast({ title: 'Embalagem criada com sucesso!' });
      }
      loadEmbalagens();
      setModalOpen(false);
      setEditingEmbalagem(undefined);
    } catch (err: any) {
      console.error('Erro ao salvar embalagem:', err);
      toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta embalagem?')) return;
    
    try {
      const { error } = await supabase
        .from('embalagens')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: 'Embalagem excluída com sucesso!' });
      loadEmbalagens();
    } catch (err: any) {
      console.error('Erro ao excluir embalagem:', err);
      toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  const handleEdit = (embalagem: any) => {
    setEditingEmbalagem(embalagem);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditingEmbalagem(undefined);
    setModalOpen(true);
  };

  const totalPages = Math.ceil(total / pageSize);
  const filteredCount = embalagens.length;

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1); // Reset to first page when searching
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader activeModule="estoque" onModuleChange={(m) => {
        // navigate to root with module query so other modules still work
        const next = new URLSearchParams(location.search);
        next.set('module', m);
        navigate({ pathname: '/', search: next.toString() });
      }} />

      <main className="min-h-[calc(100vh-8rem)]">
        <div className="flex items-start gap-6">
          <EstoqueSidebar />
          
          <div className="flex-1 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Lista de Embalagens</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {total} embalagem(ns) cadastrada(s)
                </p>
              </div>
              <Button onClick={handleNew} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                Nova Embalagem
              </Button>
            </div>

            {/* Search Bar */}
            <Card className="mb-4">
              <CardHeader>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar embalagens por nome..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : embalagens.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchTerm ? 'Nenhuma embalagem encontrada' : 'Nenhuma embalagem cadastrada'}
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Altura (cm)</TableHead>
                          <TableHead>Largura (cm)</TableHead>
                          <TableHead>Comprimento (cm)</TableHead>
                          <TableHead>Peso (kg)</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {embalagens.map((emb) => (
                          <TableRow key={emb.id}>
                            <TableCell className="font-medium">{emb.nome}</TableCell>
                            <TableCell>{emb.altura}</TableCell>
                            <TableCell>{emb.largura}</TableCell>
                            <TableCell>{emb.comprimento}</TableCell>
                            <TableCell>{emb.peso}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(emb)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(emb.id)}
                                >
                                  <Trash className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                          Página {page} de {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

                <EmballagemModal
              open={modalOpen}
              onClose={() => {
                setModalOpen(false);
                setEditingEmbalagem(undefined);
              }}
              onSave={handleSaveEmbalagem}
              embalagem={editingEmbalagem}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default ListaEmbalagens;
