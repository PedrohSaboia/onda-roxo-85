import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const CONTABILIDADE_STATUS_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';

interface PedidoContabilidade {
  id: string;
  id_externo: string | null;
  criado_em: string;
  observacoes: string | null;
  clientes: {
    nome: string;
    email?: string;
    cpf?: string;
    telefone?: string;
  } | null;
  plataformas: {
    nome: string;
    img_url?: string;
  } | null;
  usuarios: {
    nome: string;
    img_url?: string;
  } | null;
  itens_pedido: Array<{
    id: string;
    quantidade: number;
    preco_unitario: number;
    produtos: {
      nome: string;
      sku: string;
    } | null;
  }>;
}

export function Contabilidade() {
  const navigate = useNavigate();
  const { empresaId, permissoes, hasPermissao, isLoading } = useAuth();
  const { toast } = useToast();
  const hasAccess = hasPermissao ? hasPermissao(57) : ((permissoes || []).includes(57));
  
  const [searchTerm, setSearchTerm] = useState('');
  const [pedidos, setPedidos] = useState<PedidoContabilidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    if (!hasAccess) return;
    if (empresaId) {
      carregarPedidos();
    }
  }, [empresaId, page, pageSize, searchTerm, hasAccess]);

  const carregarPedidos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let query = (supabase as any)
        .from('pedidos')
        .select(`
          id,
          id_externo,
          criado_em,
          observacoes,
          plataformas (
            nome,
            img_url
          ),
          usuarios (
            nome,
            img_url
          ),
          itens_pedido (
            id,
            quantidade,
            preco_unitario,
            produtos (
              nome,
              sku
            )
          )
        `, { count: 'exact' })
        .eq('empresa_id', empresaId)
        .eq('status_id', CONTABILIDADE_STATUS_ID)
        .order('criado_em', { ascending: false });

      // Aplicar busca
      if (searchTerm) {
        query = query.ilike('id_externo', `%${searchTerm}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      // Buscar clientes separadamente pelo pedido_id
      const pedidosComClientes = await Promise.all(
        (data || []).map(async (pedido: any) => {
          const { data: clienteData } = await (supabase as any)
            .from('clientes')
            .select('nome, email, cpf, telefone')
            .eq('pedido_id', pedido.id)
            .single();
          
          return {
            ...pedido,
            clientes: clienteData || null
          };
        })
      );

      setPedidos(pedidosComClientes as PedidoContabilidade[]);
      setTotal(count || 0);
    } catch (err: any) {
      console.error('Erro ao carregar pedidos:', err);
      setError(err.message || 'Erro ao carregar pedidos');
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os pedidos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calcularValorTotal = (pedido: PedidoContabilidade) => {
    return pedido.itens_pedido?.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0) || 0;
  };

  const totalPages = Math.ceil(total / pageSize);
  if (!isLoading && !hasAccess) {
    return (
      <div className="p-6">
        <Card className="w-[500px] justify-center mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto mb-4 text-red-600" />
            <h3 className="text-lg font-semibold">Você não tem permissão para ver a contabilidade</h3>
            <p className="text-sm text-muted-foreground mt-2">Se você acha que deveria ter acesso, contate o administrador.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Contabilidade</h1>
            <p className="text-gray-600">Pedidos finalizados para análise contábil</p>
          </div>
          
          {/* Search Bar */}
          <div className="mb-6 flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Buscar por ID do pedido ou nome do cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500">Carregando pedidos...</p>
                </div>
              ) : error ? (
                <div className="p-8 text-center">
                  <p className="text-red-500">{error}</p>
                </div>
              ) : pedidos.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500">Nenhum pedido encontrado</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Plataforma</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Produtos</TableHead>
                        <TableHead>Valor Total</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidos.map((pedido) => (
                        <TableRow 
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => navigate(`/pedido-contabilidade/${pedido.id}`)}
                        >
                          <TableCell className="font-medium">
                            {pedido.id_externo || pedido.id.substring(0, 8)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{pedido.clientes?.nome || 'Cliente não informado'}</p>
                              {pedido.clientes?.email && (
                                <p className="text-xs text-gray-500">{pedido.clientes.email}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {pedido.plataformas?.nome && (
                              <div className="flex items-center gap-2">
                                {pedido.plataformas.img_url && (
                                  <img 
                                    src={pedido.plataformas.img_url} 
                                    alt={pedido.plataformas.nome}
                                    className="w-6 h-6 rounded object-contain"
                                  />
                                )}
                                <Badge variant="outline">{pedido.plataformas.nome}</Badge>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {pedido.usuarios?.nome && (
                              <div className="flex items-center gap-2">
                                {pedido.usuarios.img_url ? (
                                  <img 
                                    src={pedido.usuarios.img_url} 
                                    alt={pedido.usuarios.nome}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                    {pedido.usuarios.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                  </div>
                                )}
                                <span className="text-sm text-gray-600">{pedido.usuarios.nome}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {pedido.itens_pedido?.slice(0, 2).map((item, idx) => (
                                <div key={idx} className="text-gray-600">
                                  {item.produtos?.nome || 'Produto'} ({item.quantidade}x)
                                </div>
                              ))}
                              {(pedido.itens_pedido?.length || 0) > 2 && (
                                <div className="text-xs text-gray-400">
                                  +{pedido.itens_pedido.length - 2} mais
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-600">
                              {formatarValor(calcularValorTotal(pedido))}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {formatarData(pedido.criado_em)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-6 py-4 border-t">
                    <div className="text-sm text-gray-500">
                      Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, total)} de {total} pedidos
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Anterior
                      </Button>
                      <span className="text-sm text-gray-600">
                        Página {page} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
