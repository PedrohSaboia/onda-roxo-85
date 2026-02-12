import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { LogisticaSidebar } from '@/components/layout/LogisticaSidebar';
import { FileText, Search, RefreshCw, ExternalLink, Eye, Copy, Calendar, CheckCircle, XCircle } from 'lucide-react';

interface Pedido {
  id: string;
  id_externo: string;
  cliente_nome: string;
  criado_em: string;
  etiquetas_uploads: string[];
  status: {
    id: string;
    nome: string;
    cor_hex: string;
  };
  responsavel: {
    id: string;
    nome: string;
    img_url?: string;
  };
  plataforma: {
    id: string;
    nome: string;
    img_url?: string;
  };
  itens_pedido?: Array<{
    id: string;
    quantidade: number;
    preco_unitario: number;
    codigo_barras?: string;
    produto?: {
      id: string;
      nome: string;
      sku?: string;
      img_url?: string;
    };
    variacao?: {
      id: string;
      nome: string;
      sku?: string;
      img_url?: string;
    };
  }>;
}

export function EnvioPorEtiqueta() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [itemInputs, setItemInputs] = useState<Record<string, string>>({});
  const [itemStatus, setItemStatus] = useState<Record<string, 'idle' | 'success' | 'error'>>({});
  const [bipedItemIds, setBipedItemIds] = useState<string[]>([]);
  const [viewedEtiquetasIndices, setViewedEtiquetasIndices] = useState<number[]>([]);
  const [settingAsEnviado, setSettingAsEnviado] = useState(false);
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { empresaId, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchPedidos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id,
          id_externo,
          cliente_nome,
          criado_em,
          etiquetas_uploads,
          status:status_id (id, nome, cor_hex),
          responsavel:responsavel_id (id, nome, img_url),
          plataforma:plataforma_id (id, nome, img_url),
          itens_pedido(id, quantidade, preco_unitario, codigo_barras, produto:produtos(id, nome, sku, img_url), variacao:variacoes_produto(id, nome, sku, img_url))
        `)
        .not('etiquetas_uploads', 'is', null)
        .neq('status_id', 'fa6b38ba-1d67-4bc3-821e-ab089d641a25')
        .eq('empresa_id', empresaId || 1)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      setPedidos(data as any || []);
    } catch (err: any) {
      console.error('Erro ao buscar pedidos:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os pedidos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos();
  }, [empresaId]);

  const filteredPedidos = pedidos.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.id_externo?.toLowerCase().includes(term) ||
      p.cliente_nome?.toLowerCase().includes(term)
    );
  });

  const handleOpenPedido = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setModalOpen(true);
    setItemInputs({});
    setItemStatus({});
    setBipedItemIds([]);
    setViewedEtiquetasIndices([]);
  };

  const handleNavigateToPedido = (pedidoId: string) => {
    navigate(`/pedido/${pedidoId}`);
  };

  const handleVisualizarEtiqueta = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank');
  };

  return (
    <div className="flex h-full">
      <LogisticaSidebar />
      <div className="flex-1 h-full overflow-y-auto">
        <div className="space-y-6 p-6">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Envio por Etiqueta
                </h1>
                <p className="text-muted-foreground">
                  Pedidos com etiquetas não geradas no sistema
                </p>
              </div>
              <Button onClick={fetchPedidos} variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número do pedido ou cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredPedidos.length} pedido(s) encontrado(s)
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="m-2 p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-custom-600 border-t-transparent rounded-full" />
                </div>
              ) : filteredPedidos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhum pedido encontrado</p>
                  <p className="text-sm">Não há pedidos com etiquetas não geradas no momento</p>
                </div>
              ) : (
                <div className="overflow-x-auto p-0 m-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Informações do Pedido</TableHead>
                        <TableHead className="text-center w-[120px] px-1">Data</TableHead>
                        <TableHead className="text-center w-[100px] px-1">Resp. Pedido</TableHead>
                        <TableHead className="text-center w-[80px] px-1">Plataf.</TableHead>
                        <TableHead className="text-center w-[100px] px-1">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPedidos.map((pedido) => (
                        <TableRow 
                          key={pedido.id} 
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleOpenPedido(pedido)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <div
                                  className="max-w-[220px] truncate overflow-hidden whitespace-nowrap cursor-pointer"
                                  title="Clique para copiar"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const text = String(pedido.id_externo || '');
                                    navigator.clipboard.writeText(text).then(() => {
                                      toast({ title: 'Copiado', description: 'ID do pedido copiado para a área de transferência.' });
                                    }).catch((err) => {
                                      console.error('Erro ao copiar:', err);
                                      toast({ title: 'Erro', description: 'Não foi possível copiar o ID.', variant: 'destructive' });
                                    });
                                  }}
                                >
                                  {pedido.id_externo || pedido.id.slice(0, 8)}
                                </div>
                              </div>
                              <div>
                                <div
                                  className="text-xs max-w-[260px] truncate overflow-hidden whitespace-nowrap"
                                  title={pedido.cliente_nome}
                                >
                                  <span className="text-gray-700">{pedido.cliente_nome}</span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-center">
                            {new Date(pedido.criado_em).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center justify-center">
                              {pedido.responsavel?.img_url ? (
                                <img 
                                  src={pedido.responsavel.img_url} 
                                  alt={pedido.responsavel.nome}
                                  className="h-12 w-12 rounded-full border-4 border-custom-600 object-cover"
                                />
                              ) : (
                                <div className="h-12 w-12 rounded-full border-4 border-custom-600 bg-gray-200 flex items-center justify-center text-sm font-medium">
                                  {pedido.responsavel?.nome?.slice(0, 2).toUpperCase() || '?'}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              {pedido.plataforma?.img_url ? (
                                <div className="w-10 h-8 overflow-hidden flex items-center justify-center">
                                  <img
                                    src={pedido.plataforma.img_url}
                                    alt={pedido.plataforma.nome || 'Plataforma'}
                                    loading="lazy"
                                    className="max-w-full max-h-full object-contain"
                                  />
                                </div>
                              ) : pedido.plataforma?.nome ? (
                                <Badge className="text-white text-xs">
                                  {pedido.plataforma.nome}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <Badge style={{ backgroundColor: pedido.status?.cor_hex }}>
                              {pedido.status?.nome || '—'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Detalhes do Pedido */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 w-[95vw] sm:w-full">
          {selectedPedido && (
            <div>
              {/* Header do Modal */}
              <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 pb-3 sm:pb-4 border-b">
                {/* Imagem do Responsável */}
                {selectedPedido.responsavel?.img_url ? (
                  <img
                    src={selectedPedido.responsavel.img_url}
                    alt={selectedPedido.responsavel.nome}
                    className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium border-2 border-gray-200 flex-shrink-0">
                    {selectedPedido.responsavel?.nome?.slice(0, 2).toUpperCase() || '??'}
                  </div>
                )}
                
                {/* ID e Data do Pedido */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold truncate">
                    {selectedPedido.id_externo || selectedPedido.id.slice(0, 8)}
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {new Date(selectedPedido.criado_em).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {/* Status e Plataforma */}
                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                  <Badge 
                    style={{ backgroundColor: selectedPedido.status?.cor_hex }}
                    className="text-white text-xs px-2 py-1"
                  >
                    {selectedPedido.status?.nome}
                  </Badge>
                  
                  {selectedPedido.plataforma && (
                    <Badge variant="outline" className="text-xs px-2 py-1 flex items-center gap-1">
                      {selectedPedido.plataforma.img_url && (
                        <img
                          src={selectedPedido.plataforma.img_url}
                          alt={selectedPedido.plataforma.nome}
                          className="w-3 h-3 object-contain"
                        />
                      )}
                      {selectedPedido.plataforma.nome}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Conteúdo do Modal */}
              <div className="p-4 sm:p-6 space-y-4">
                {/* Itens do Pedido */}
                {selectedPedido.itens_pedido && selectedPedido.itens_pedido.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">ITENS DO PEDIDO</h3>
                    <div className="space-y-2">
                      {selectedPedido.itens_pedido.map((item) => (
                        <div key={item.id} className={`border rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 ${bipedItemIds.includes(item.id) ? 'border-green-500 bg-green-50' : ''}`}>
                          <div className="flex items-center gap-3">
                            {item.variacao?.img_url || item.produto?.img_url ? (
                              <img
                                src={item.variacao?.img_url || item.produto?.img_url}
                                alt={item.variacao?.nome || item.produto?.nome}
                                className="w-12 h-12 rounded-full border-2 border-gray-200 object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400">
                                <FileText className="w-6 h-6" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-sm">
                                {item.produto?.nome}
                              </div>
                              {item.variacao?.nome && (
                                <div className="text-xs text-muted-foreground">{item.variacao.nome}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-medium">Qtd: {item.quantidade}</div>
                            {bipedItemIds.includes(item.id) ? (
                              <div className="flex items-center gap-2">
                                <div className="px-2 py-1 bg-green-100 border border-green-500 rounded text-xs font-mono text-green-700">
                                  {item.codigo_barras}
                                </div>
                                <CheckCircle className="text-green-600 w-5 h-5" />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  ref={(el) => (itemRefs.current[item.id] = el)}
                                  className={`border rounded px-2 py-1 text-sm w-32 ${itemStatus[item.id] === 'success' ? 'border-green-600' : ''} ${itemStatus[item.id] === 'error' ? 'border-red-600' : ''}`}
                                  placeholder="Bipar código"
                                  value={itemInputs[item.id] || ''}
                                  onChange={(e) => setItemInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const val = (itemInputs[item.id] || '').trim();
                                      if (!val) return;

                                      if (val === item.codigo_barras) {
                                        setItemStatus(prev => ({ ...prev, [item.id]: 'success' }));
                                        setBipedItemIds(prev => [...prev, item.id]);
                                        setItemInputs(prev => ({ ...prev, [item.id]: '' }));

                                        // Focar próximo item não bipado
                                        const items = selectedPedido?.itens_pedido || [];
                                        const next = items.find((x) => x.id !== item.id && !bipedItemIds.includes(x.id));
                                        if (next) {
                                          setTimeout(() => itemRefs.current[next.id]?.focus(), 0);
                                        }

                                        toast({
                                          title: 'Item bipado!',
                                          description: 'Código de barras validado com sucesso',
                                        });
                                      } else {
                                        setItemStatus(prev => ({ ...prev, [item.id]: 'error' }));
                                        setItemInputs(prev => ({ ...prev, [item.id]: '' }));
                                        setTimeout(() => itemRefs.current[item.id]?.focus(), 0);
                                        setTimeout(() => setItemStatus(prev => ({ ...prev, [item.id]: 'idle' })), 2000);

                                        toast({
                                          title: 'Código incorreto',
                                          description: 'O código não corresponde ao item',
                                          variant: 'destructive'
                                        });
                                      }
                                    }
                                  }}
                                />
                                {itemStatus[item.id] === 'error' && (
                                  <XCircle className="text-red-600 w-5 h-5" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Etiquetas em Quadradinhos - só aparecem quando todos os itens foram bipados */}
                {selectedPedido.etiquetas_uploads && selectedPedido.etiquetas_uploads.length > 0 && (
                  <>
                    {selectedPedido.itens_pedido && selectedPedido.itens_pedido.length > 0 && bipedItemIds.length === selectedPedido.itens_pedido.length ? (
                      <div className="border-t pt-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">
                          ETIQUETAS ({selectedPedido.etiquetas_uploads.length})
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {selectedPedido.etiquetas_uploads.map((url: string, index: number) => {
                            // Extrair nome do arquivo da URL
                            const fileName = url.split('/').pop()?.replace('.pdf', '') || `etiqueta-${index + 1}`;
                            
                            return (
                              <div
                                key={index}
                                className="flex flex-col items-center justify-center p-4 border-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer w-32 h-32"
                                onClick={() => {
                                  window.open(url, '_blank');
                                  // Marcar como visualizada
                                  if (!viewedEtiquetasIndices.includes(index)) {
                                    setViewedEtiquetasIndices(prev => [...prev, index]);
                                  }
                                }}
                                title={fileName}
                              >
                                <FileText className="h-8 w-8 text-blue-600 mb-2" />
                                <p className="text-xs font-medium text-center line-clamp-2 px-1">
                                  {fileName}
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(url);
                                    toast({
                                      title: 'Link copiado',
                                      description: `Link copiado para área de transferência`
                                    });
                                  }}
                                  className="mt-1 h-6 w-6 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-center p-6 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="text-center">
                            <FileText className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                            <p className="text-sm font-medium text-amber-800">
                              Bipe todos os itens para visualizar as etiquetas
                            </p>
                            <p className="text-xs text-amber-600 mt-1">
                              {bipedItemIds.length}/{selectedPedido.itens_pedido?.length || 0} itens bipados
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Botão Definir como Enviado */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={async () => {
                      if (!selectedPedido || !user) return;

                      try {
                        setSettingAsEnviado(true);

                        const { error } = await supabase
                          .from('pedidos')
                          .update({
                            resp_envio: user.id,
                            data_enviado: new Date().toISOString(),
                            atualizado_em: new Date().toISOString(),
                            status_id: 'fa6b38ba-1d67-4bc3-821e-ab089d641a25'
                          })
                          .eq('id', selectedPedido.id);

                        if (error) throw error;

                        toast({
                          title: 'Pedido definido como enviado',
                          description: 'O pedido foi marcado como enviado com sucesso'
                        });

                        setModalOpen(false);
                        fetchPedidos();
                      } catch (err: any) {
                        console.error('Erro ao definir como enviado:', err);
                        toast({
                          title: 'Erro',
                          description: 'Não foi possível definir o pedido como enviado',
                          variant: 'destructive'
                        });
                      } finally {
                        setSettingAsEnviado(false);
                      }
                    }}
                    disabled={settingAsEnviado || viewedEtiquetasIndices.length < (selectedPedido?.etiquetas_uploads?.length || 0)}
                    className="bg-custom-600 hover:bg-custom-700 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {settingAsEnviado ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-b-transparent rounded-full mr-2" />
                        Processando...
                      </>
                    ) : (
                      `Definir como Enviado ${viewedEtiquetasIndices.length < (selectedPedido?.etiquetas_uploads?.length || 0) ? `(${viewedEtiquetasIndices.length}/${selectedPedido?.etiquetas_uploads?.length || 0} visualizadas)` : ''}`
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EnvioPorEtiqueta;
