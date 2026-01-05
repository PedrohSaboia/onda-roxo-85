import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/orders/KanbanBoard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { mockPedidos } from '@/data/mockData';
import { Pedido } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check } from 'lucide-react';

export function Producao() {
  const [pedidos, setPedidos] = useState<Pedido[]>(mockPedidos);
  const [statusList, setStatusList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{
    produtoId: string;
    variacaoId?: string;
    produtoNome: string;
    variacaoNome?: string;
  } | null>(null);
  const [idExternos, setIdExternos] = useState<string[]>([]);
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    const fetchPedidos = async () => {
      setLoading(true);
      setError(null);
      try {
        // fetch statuses first
        const { data: statusesData, error: statusesError } = await supabase
          .from('status')
          .select('*')
          .order('ordem', { ascending: true });

        if (statusesError) throw statusesError;
        if (!mounted) return;

        // normalize to local Status type shape
        const mappedStatuses = (statusesData || []).map((s: any) => ({
          id: s.id,
          nome: s.nome,
          corHex: s.cor_hex,
          ordem: s.ordem ?? 0,
          criadoEm: s.criado_em,
          atualizadoEm: s.atualizado_em,
        }));

        setStatusList(mappedStatuses);

        const { data, error: supaError } = await supabase
          .from('pedidos')
          .select(`*, usuarios(id,nome,img_url), plataformas(id,nome,cor,img_url), status(id,nome,cor_hex,ordem), tipos_etiqueta(id,nome,cor_hex,ordem), itens_pedido(id,quantidade,preco_unitario,item_faltante, produto:produtos(id,nome,img_url), variacao:variacoes_produto(id,nome,img_url,ordem))`) 
          .order('criado_em', { ascending: false });

        if (supaError) throw supaError;
        if (!mounted) return;

        const pick = (val: any) => Array.isArray(val) ? val[0] : val;

        const mapPedidoRow = (row: any): Pedido => {
          const pick = (val: any) => Array.isArray(val) ? val[0] : val;

          const usuarioRow = pick(row.usuarios);
          const plataformaRow = pick(row.plataformas);
          const statusRow = pick(row.status);
          const etiquetaRow = pick(row.tipos_etiqueta);

          const itens = (row.itens_pedido || []).map((it: any) => ({
            id: it.id,
            quantidade: it.quantidade,
            precoUnitario: it.preco_unitario,
            item_faltante: !!it.item_faltante,
            produto: it.produto ? { id: it.produto.id, nome: it.produto.nome, imagem: it.produto.img_url } : null,
            variacao: it.variacao ? { id: it.variacao.id, nome: it.variacao.nome, imagem: it.variacao.img_url } : null,
          }));

          return {
            id: row.id,
            idExterno: row.id_externo,
            clienteNome: row.cliente_nome,
            contato: row.contato || '',
            responsavelId: row.responsavel_id,
            plataformaId: row.plataforma_id,
            statusId: row.status_id,
            etiquetaEnvio: etiquetaRow?.nome || (row.etiqueta_envio_id ? 'PENDENTE' : 'NAO_LIBERADO'),
            urgente: !!row.urgente,
            dataPrevista: row.data_prevista || undefined,
            observacoes: row.observacoes || '',
            itens,
            responsavel: usuarioRow ? { id: usuarioRow.id, nome: usuarioRow.nome, email: '', papel: 'operador', avatar: usuarioRow.img_url || undefined, ativo: true, criadoEm: '', atualizadoEm: '' } : undefined,
            plataforma: plataformaRow ? { id: plataformaRow.id, nome: plataformaRow.nome, cor: plataformaRow.cor, imagemUrl: plataformaRow.img_url || undefined, criadoEm: '', atualizadoEm: '' } : undefined,
            status: statusRow ? { id: statusRow.id, nome: statusRow.nome, corHex: statusRow.cor_hex, ordem: statusRow.ordem ?? 0, criadoEm: '', atualizadoEm: '' } : undefined,
            criadoEm: row.criado_em,
            atualizadoEm: row.atualizado_em,
            etiqueta: etiquetaRow ? { id: etiquetaRow.id, nome: etiquetaRow.nome, corHex: etiquetaRow.cor_hex, ordem: etiquetaRow.ordem ?? 0, criadoEm: '', atualizadoEm: '' } : undefined,
          }
        };

        const mapped: Pedido[] = (data || []).map(mapPedidoRow);

        setPedidos(mapped);

        // realtime subscriptions: apenas após carregar os pedidos iniciais
        // Inscreve em mudanças nas tabelas `pedidos` e `itens_pedido`
        try {
          // pedidos
          const pedidosChannel = supabase
            .channel('public:pedidos')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
              if (!mounted) return;
              const handlePedidoChange = async () => {
                const ev = (payload as any).eventType;
                const row: any = (payload as any).new ?? (payload as any).old;
                if (!row) return;

                if (ev === 'DELETE') {
                  setPedidos(prev => prev.filter(p => p.id !== row.id));
                  return;
                }

                // INSERT or UPDATE: buscar dados do pedido atualizado com itens embarcados
                const { data: pedidoRow, error } = await supabase
                  .from('pedidos')
                  .select(`*, usuarios(id,nome,img_url), plataformas(id,nome,cor,img_url), status(id,nome,cor_hex,ordem), tipos_etiqueta(id,nome,cor_hex,ordem), itens_pedido(id,quantidade,preco_unitario,item_faltante, produto:produtos(id,nome,img_url), variacao:variacoes_produto(id,nome,img_url,ordem))`)
                  .eq('id', row.id)
                  .single();
                if (error || !pedidoRow) return;
                const mappedPedido = mapPedidoRow(pedidoRow);
                setPedidos(prev => {
                  const exists = prev.some(p => p.id === mappedPedido.id);
                  if (exists) return prev.map(p => p.id === mappedPedido.id ? mappedPedido : p);
                  return [mappedPedido, ...prev];
                });
              };
              void handlePedidoChange();
            })
            .subscribe();

          // itens_pedido
          const itensChannel = supabase
            .channel('public:itens_pedido')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, (payload) => {
              if (!mounted) return;
              const row: any = (payload as any).new ?? (payload as any).old;
              if (!row) return;

              const pedidoId = row.pedido_id;
              if (!pedidoId) return;

              // Recarrega apenas o pedido afetado para manter consistência do relacionamento
              (async () => {
                const { data: pedidoRow, error } = await supabase
                  .from('pedidos')
                  .select(`*, usuarios(id,nome,img_url), plataformas(id,nome,cor,img_url), status(id,nome,cor_hex,ordem), tipos_etiqueta(id,nome,cor_hex,ordem), itens_pedido(id,quantidade,preco_unitario,item_faltante, produto:produtos(id,nome,img_url), variacao:variacoes_produto(id,nome,img_url,ordem))`)
                  .eq('id', pedidoId)
                  .single();
                if (error || !pedidoRow) return;
                const mappedPedido = mapPedidoRow(pedidoRow);
                setPedidos(prev => prev.map(p => p.id === mappedPedido.id ? mappedPedido : p));
              })();
            })
            .subscribe();

          // cleanup on unmount
          const cleanup = () => {
            try { pedidosChannel.unsubscribe(); } catch (e) { console.warn(e); }
            try { itensChannel.unsubscribe(); } catch (e) { console.warn(e); }
          };
          (window as any).__producaoRealtimeCleanup = cleanup;
        } catch (err) {
          console.warn('Erro ao criar subscriptions realtime', err);
        }
      } catch (err: any) {
        console.error('Erro ao buscar pedidos produção', err);
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();
    return () => { mounted = false };
  }, []);
  const { toast } = useToast();

  const handleOrderMove = (pedidoId: string, newStatusId: string) => {
    // capture previous state for rollback if needed
    const previousPedidos = pedidos;

    // optimistic update
    setPedidos(prev => prev.map(pedido => 
      pedido.id === pedidoId 
        ? { 
            ...pedido, 
            statusId: newStatusId,
            status: statusList.find((s: any) => s.id === newStatusId) || pedido.status,
            atualizadoEm: new Date().toISOString()
          }
        : pedido
    ));

    // persist change to Supabase
    (async () => {
      try {
        const ENVIADO_STATUS_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';
        const updateData: any = { status_id: newStatusId, atualizado_em: new Date().toISOString() };
        
        // Se o status for alterado para "Enviado", popula data_enviado
        if (newStatusId === ENVIADO_STATUS_ID) {
          updateData.data_enviado = new Date().toISOString();
        }
        
        const { data: updated, error: updateError } = await supabase
          .from('pedidos')
          .update(updateData)
          .eq('id', pedidoId)
          .select()
          .single();

        if (updateError) throw updateError;

        const movedPedido = previousPedidos.find(p => p.id === pedidoId);
        const novoStatus = statusList.find((s: any) => s.id === newStatusId);

        toast({
          title: "Status atualizado",
          description: `Pedido ${movedPedido?.idExterno || updated?.id_externo} movido para ${novoStatus?.nome}`,
        });
      } catch (err: any) {
        console.error('Erro ao atualizar status do pedido', err);
        // rollback
        setPedidos(previousPedidos);
        toast({
          title: 'Erro ao atualizar status',
          description: err?.message || String(err),
          variant: 'destructive'
        });
      }
    })();
  };

  // Status IDs que representam produção
  const PRODUCAO_STATUS_IDS = statusList
    .filter(s => s.nome === 'Produção')
    .map(s => s.id);
  
  const ENTRADA_LOGISTICA_STATUS_IDS = statusList
    .filter(s => s.nome === 'Entrada Logística')
    .map(s => s.id);
  
  const LOGISTICA_STATUS_IDS = statusList
    .filter(s => s.nome === 'Logística')
    .map(s => s.id);

  const getItensAgrupados = (statusIds: string[]) => {
    const pedidosFiltrados = pedidos.filter(p => statusIds.includes(p.statusId));
    
    // Agrupar itens por produto/variação
    const agrupamento: Record<string, {
      produtoId: string;
      produtoNome: string;
      variacaoId?: string;
      variacaoNome?: string;
      imagem?: string;
      quantidade: number;
    }> = {};

    pedidosFiltrados.forEach(pedido => {
      pedido.itens.forEach((item: any) => {
        // Pula itens sem produto vinculado
        if (!item.produto || !item.produto.id) {
          console.warn('Item sem produto vinculado encontrado:', item);
          return;
        }

        const key = item.variacao 
          ? `${item.produto.id}-${item.variacao.id}`
          : `${item.produto.id}`;
        
        if (!agrupamento[key]) {
          agrupamento[key] = {
            produtoId: item.produto.id,
            produtoNome: item.produto.nome || 'Produto sem nome',
            variacaoId: item.variacao?.id,
            variacaoNome: item.variacao?.nome,
            imagem: item.variacao?.imagem || item.produto?.imagem,
            quantidade: 0,
          };
        }
        
        agrupamento[key].quantidade += item.quantidade;
      });
    });

    return Object.values(agrupamento).sort((a, b) => b.quantidade - a.quantidade);
  };

  const handleItemClick = (item: {
    produtoId: string;
    produtoNome: string;
    variacaoId?: string;
    variacaoNome?: string;
  }, statusIds: string[]) => {
    // Buscar todos os pedidos que contêm este item
    const pedidosComItem = pedidos.filter(p => {
      if (!statusIds.includes(p.statusId)) return false;
      
      return p.itens.some((i: any) => {
        if (!i.produto?.id) return false;
        const matchProduto = i.produto.id === item.produtoId;
        const matchVariacao = item.variacaoId 
          ? i.variacao?.id === item.variacaoId 
          : !i.variacao?.id;
        return matchProduto && matchVariacao;
      });
    });

    const ids = pedidosComItem
      .map(p => p.idExterno)
      .filter(id => id) // Remove valores undefined/null
      .sort();

    setIdExternos(ids);
    setSelectedItem(item);
    setCopiedIds(new Set());
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIds(prev => new Set(prev).add(text));
      setTimeout(() => {
        setCopiedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(text);
          return newSet;
        });
      }, 2000);
      toast({
        title: "Copiado!",
        description: `ID ${text} copiado para a área de transferência`,
      });
    } catch (err) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o ID",
        variant: "destructive",
      });
    }
  };

  const copyAllIds = async () => {
    const allIds = idExternos.join('\n');
    try {
      await navigator.clipboard.writeText(allIds);
      toast({
        title: "Copiado!",
        description: `${idExternos.length} IDs copiados para a área de transferência`,
      });
    } catch (err) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar os IDs",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Produção</h1>
        <p className="text-muted-foreground">
          Gerencie a produção por status ou por dia planejado
        </p>
      </div>

      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">Por Status</TabsTrigger>
          <TabsTrigger value="itens">Itens a serem produzidos</TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          {loading && <div className="text-sm text-muted-foreground">Carregando pedidos...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          <KanbanBoard
            pedidos={pedidos}
            status={statusList}
            onOrderMove={handleOrderMove}
          />
        </TabsContent>

        <TabsContent value="itens">
          <div className="space-y-6">
            {/* Produção */}
            {PRODUCAO_STATUS_IDS.length > 0 && (() => {
              const itens = getItensAgrupados(PRODUCAO_STATUS_IDS);
              const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
              
              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Produção</span>
                      <Badge variant="secondary" className="text-base">
                        {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {itens.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum item em produção
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {itens.map((item, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                            onClick={() => handleItemClick(item, PRODUCAO_STATUS_IDS)}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                {item.imagem ? (
                                  <img 
                                    src={item.imagem} 
                                    alt={item.produtoNome}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">Sem foto</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.produtoNome}</p>
                                {item.variacaoNome && (
                                  <p className="text-xs text-muted-foreground truncate">{item.variacaoNome}</p>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-base font-semibold px-3 py-1 flex-shrink-0">
                              {item.quantidade}×
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Entrada Logística */}
            {ENTRADA_LOGISTICA_STATUS_IDS.length > 0 && (() => {
              const itens = getItensAgrupados(ENTRADA_LOGISTICA_STATUS_IDS);
              const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
              
              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Entrada Logística</span>
                      <Badge variant="secondary" className="text-base">
                        {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {itens.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum item em entrada logística
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {itens.map((item, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                            onClick={() => handleItemClick(item, ENTRADA_LOGISTICA_STATUS_IDS)}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                {item.imagem ? (
                                  <img 
                                    src={item.imagem} 
                                    alt={item.produtoNome}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">Sem foto</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.produtoNome}</p>
                                {item.variacaoNome && (
                                  <p className="text-xs text-muted-foreground truncate">{item.variacaoNome}</p>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-base font-semibold px-3 py-1 flex-shrink-0">
                              {item.quantidade}×
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Logística */}
            {LOGISTICA_STATUS_IDS.length > 0 && (() => {
              const itens = getItensAgrupados(LOGISTICA_STATUS_IDS);
              const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
              
              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Logística</span>
                      <Badge variant="secondary" className="text-base">
                        {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {itens.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum item em logística
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {itens.map((item, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                            onClick={() => handleItemClick(item, LOGISTICA_STATUS_IDS)}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                {item.imagem ? (
                                  <img 
                                    src={item.imagem} 
                                    alt={item.produtoNome}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">Sem foto</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.produtoNome}</p>
                                {item.variacaoNome && (
                                  <p className="text-xs text-muted-foreground truncate">{item.variacaoNome}</p>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-base font-semibold px-3 py-1 flex-shrink-0">
                              {item.quantidade}×
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal para exibir IDs Externos */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex flex-col gap-1">
              <span>{selectedItem?.produtoNome}</span>
              {selectedItem?.variacaoNome && (
                <span className="text-sm text-muted-foreground font-normal">
                  {selectedItem.variacaoNome}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            {idExternos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum pedido encontrado para este item
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <span className="text-sm text-muted-foreground">
                    {idExternos.length} {idExternos.length === 1 ? 'pedido' : 'pedidos'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyAllIds}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Todos
                  </Button>
                </div>
                
                <div className="grid gap-2">
                  {idExternos.map((id, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <span className="font-mono text-sm">{id}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(id)}
                        className="ml-2"
                      >
                        {copiedIds.has(id) ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}