import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/orders/KanbanBoard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockPedidos } from '@/data/mockData';
import { Pedido } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Search } from 'lucide-react';
import { registrarHistoricoMovimentacao } from '@/lib/historicoMovimentacoes';

export function Producao() {
  const [pedidos, setPedidos] = useState<Pedido[]>(mockPedidos);
  const [statusList, setStatusList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
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

        // IDs de status relevantes para a página de Produção
        const PRODUCAO_STATUS_ID = 'ce505c97-8a44-4e4b-956b-d837013b252e';
        const LOGISTICA_STATUS_ID = '3473cae9-47c8-4b85-96af-b41fe0e15fa9';
        
        // Buscar também Entrada Logística dinamicamente
        const entradaLogisticaStatus = mappedStatuses.find(s => {
          const nomeNorm = s.nome.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return nomeNorm.includes('entrada') && nomeNorm.includes('logistica');
        });
        
        const statusRelevantes = [PRODUCAO_STATUS_ID, LOGISTICA_STATUS_ID];
        if (entradaLogisticaStatus) {
          statusRelevantes.push(entradaLogisticaStatus.id);
        }

        console.log('[Producao] Carregando pedidos dos status:', statusRelevantes);

        const { data, error: supaError } = await supabase
          .from('pedidos')
          .select(`*, usuarios(id,nome,img_url), plataformas(id,nome,cor,img_url), status(id,nome,cor_hex,ordem), tipos_etiqueta(id,nome,cor_hex,ordem), itens_pedido(id,quantidade,preco_unitario,item_faltante, produto:produtos(id,nome,img_url), variacao:variacoes_produto(id,nome,img_url,ordem))`) 
          .in('status_id', statusRelevantes)
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

        console.log('[Producao] Pedidos carregados:', {
          total: mapped.length,
          porStatus: mapped.reduce((acc, p) => {
            const nome = p.status?.nome || 'Sem status';
            acc[nome] = (acc[nome] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        });

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
        const statusAnterior = previousPedidos.find(p => p.id === pedidoId)?.status;

        await registrarHistoricoMovimentacao(pedidoId, `Status alterado via Kanban: ${statusAnterior?.nome || 'N/A'} → ${novoStatus?.nome || 'N/A'}`);
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

  // Status IDs específicos
  const PRODUCAO_STATUS_ID = 'ce505c97-8a44-4e4b-956b-d837013b252e';
  const LOGISTICA_STATUS_ID = '3473cae9-47c8-4b85-96af-b41fe0e15fa9';
  
  // Buscar também por nomes como fallback e Entrada Logística
  const normalizarNome = (nome: string) => {
    return nome.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };
  
  const PRODUCAO_STATUS_IDS = [PRODUCAO_STATUS_ID];
  
  const ENTRADA_LOGISTICA_STATUS_IDS = statusList
    .filter(s => {
      const nomeNorm = normalizarNome(s.nome);
      return nomeNorm.includes('entrada') && nomeNorm.includes('logistica');
    })
    .map(s => s.id);
  
  const LOGISTICA_STATUS_IDS = [LOGISTICA_STATUS_ID];
  
  // Log de diagnóstico
  console.log('[Producao] Status identificados:', {
    todosStatus: statusList.map(s => ({ id: s.id, nome: s.nome })),
    producaoIDs: PRODUCAO_STATUS_IDS,
    producaoStatus: statusList.find(s => s.id === PRODUCAO_STATUS_ID),
    logisticaIDs: LOGISTICA_STATUS_IDS,
    logisticaStatus: statusList.find(s => s.id === LOGISTICA_STATUS_ID),
    entradaLogisticaIDs: ENTRADA_LOGISTICA_STATUS_IDS
  });
  
  console.log('[Producao] Pedidos por status:', {
    total: pedidos.length,
    emProducao: pedidos.filter(p => PRODUCAO_STATUS_IDS.includes(p.statusId)).length,
    emLogistica: pedidos.filter(p => LOGISTICA_STATUS_IDS.includes(p.statusId)).length,
    emEntradaLogistica: pedidos.filter(p => ENTRADA_LOGISTICA_STATUS_IDS.includes(p.statusId)).length,
    pedidosProducao: pedidos.filter(p => PRODUCAO_STATUS_IDS.includes(p.statusId)).map(p => ({
      idExterno: p.idExterno,
      statusId: p.statusId,
      statusNome: p.status?.nome,
      itens: p.itens.length
    })),
    pedidosLogistica: pedidos.filter(p => LOGISTICA_STATUS_IDS.includes(p.statusId)).map(p => ({
      idExterno: p.idExterno,
      statusId: p.statusId,
      statusNome: p.status?.nome,
      itens: p.itens.length
    }))
  });

  const getItensAgrupadosPorProduto = (statusIds: string[]) => {
    console.log('[getItensAgrupadosPorProduto] Iniciando:', {
      statusIdsBuscados: statusIds,
      statusNomes: statusList.filter(s => statusIds.includes(s.id)).map(s => s.nome),
      totalPedidos: pedidos.length
    });
    
    const pedidosFiltrados = pedidos.filter(p => statusIds.includes(p.statusId));
    
    console.log('[getItensAgrupadosPorProduto] Pedidos filtrados:', {
      quantidade: pedidosFiltrados.length,
      primeiros5: pedidosFiltrados.slice(0, 5).map(p => ({
        idExterno: p.idExterno,
        statusId: p.statusId,
        statusNome: p.status?.nome,
        totalItens: p.itens.length
      }))
    });
    
    // Agrupar itens por produto com suas variações
    const agrupamentoPorProduto: Record<string, {
      produtoId: string;
      produtoNome: string;
      imagem?: string;
      totalQuantidade: number;
      variacoes: Array<{
        variacaoId?: string;
        variacaoNome?: string;
        imagem?: string;
        quantidade: number;
      }>;
    }> = {};

    pedidosFiltrados.forEach(pedido => {
      if (pedido.itens.length === 0) {
        console.warn(`[getItensAgrupadosPorProduto] Pedido ${pedido.idExterno} não tem itens!`);
        return;
      }
      
      pedido.itens.forEach((item: any) => {
        // Pula itens sem produto vinculado
        if (!item.produto || !item.produto.id) {
          console.warn(`[getItensAgrupadosPorProduto] Item sem produto vinculado no pedido ${pedido.idExterno}:`, {
            item,
            produtoId: item.produto?.id,
            produtoNome: item.produto?.nome
          });
          return;
        }

        const produtoId = item.produto.id;
        
        // Inicializa o produto se não existir
        if (!agrupamentoPorProduto[produtoId]) {
          agrupamentoPorProduto[produtoId] = {
            produtoId: item.produto.id,
            produtoNome: item.produto.nome || 'Produto sem nome',
            imagem: item.produto?.imagem,
            totalQuantidade: 0,
            variacoes: [],
          };
        }
        
        // Adiciona ou atualiza a variação
        const variacaoKey = item.variacao?.id || 'sem-variacao';
        const variacaoExistente = agrupamentoPorProduto[produtoId].variacoes.find(
          v => (v.variacaoId || 'sem-variacao') === variacaoKey
        );
        
        if (variacaoExistente) {
          variacaoExistente.quantidade += item.quantidade;
        } else {
          agrupamentoPorProduto[produtoId].variacoes.push({
            variacaoId: item.variacao?.id,
            variacaoNome: item.variacao?.nome,
            imagem: item.variacao?.imagem,
            quantidade: item.quantidade,
          });
        }
        
        agrupamentoPorProduto[produtoId].totalQuantidade += item.quantidade;
      });
    });

    // Converte para array e ordena por quantidade total
    const resultado = Object.values(agrupamentoPorProduto)
      .sort((a, b) => b.totalQuantidade - a.totalQuantidade)
      .map(produto => ({
        ...produto,
        variacoes: produto.variacoes.sort((a, b) => b.quantidade - a.quantidade)
      }));
    
    console.log('[getItensAgrupadosPorProduto] Resultado final:', {
      totalProdutos: resultado.length,
      totalQuantidade: resultado.reduce((sum, p) => sum + p.totalQuantidade, 0),
      produtos: resultado
    });
    
    return resultado;
  };

  const handleItemClick = (item: {
    produtoId: string;
    produtoNome: string;
    variacaoId?: string;
    variacaoNome?: string;
  }, statusIds: string[]) => {
    console.log('[handleItemClick] Item clicado:', { item, statusIds });
    
    // Buscar todos os pedidos que contêm este item
    const pedidosComItem = pedidos.filter(p => {
      if (!statusIds.includes(p.statusId)) return false;
      
      return p.itens.some((i: any) => {
        if (!i.produto?.id) return false;
        const matchProduto = i.produto.id === item.produtoId;
        
        // Se tem variação específica, buscar apenas essa variação
        // Se não tem variação, buscar apenas itens sem variação
        if (item.variacaoId) {
          return matchProduto && i.variacao?.id === item.variacaoId;
        } else {
          return matchProduto && !i.variacao?.id;
        }
      });
    });

    console.log('[handleItemClick] Pedidos encontrados:', {
      quantidade: pedidosComItem.length,
      pedidos: pedidosComItem.map(p => ({
        idExterno: p.idExterno,
        statusId: p.statusId
      }))
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
    <div className="h-full overflow-y-auto">
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

        <TabsContent value="status" className="space-y-4">
          {/* Input de busca */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por ID Externo, Cliente, Observações..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {loading && <div className="text-sm text-muted-foreground">Carregando pedidos...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          <KanbanBoard
            pedidos={pedidos.filter(pedido => {
              if (!searchTerm) return true;
              const term = searchTerm.toLowerCase();
              return (
                pedido.idExterno?.toLowerCase().includes(term) ||
                pedido.clienteNome?.toLowerCase().includes(term) ||
                pedido.observacoes?.toLowerCase().includes(term)
              );
            })}
            status={statusList}
            onOrderMove={handleOrderMove}
          />
        </TabsContent>

        <TabsContent value="itens">
          <div className="space-y-6">
            {/* Produção */}
            {PRODUCAO_STATUS_IDS.length > 0 && (() => {
              const produtos = getItensAgrupadosPorProduto(PRODUCAO_STATUS_IDS);
              const totalItens = produtos.reduce((sum, produto) => sum + produto.totalQuantidade, 0);
              
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
                    {produtos.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum item em produção
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {produtos.map((produto, idx) => (
                          <Card key={idx} className="overflow-hidden">
                            <CardHeader className="pb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {produto.imagem ? (
                                    <img 
                                      src={produto.imagem} 
                                      alt={produto.produtoNome}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Sem foto</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-base truncate">{produto.produtoNome}</h3>
                                  <Badge variant="secondary" className="mt-1">
                                    Total: {produto.totalQuantidade}×
                                  </Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                {produto.variacoes.map((variacao, vIdx) => (
                                  <div 
                                    key={vIdx}
                                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-accent/50 transition-colors cursor-pointer"
                                    onClick={() => handleItemClick({
                                      produtoId: produto.produtoId,
                                      produtoNome: produto.produtoNome,
                                      variacaoId: variacao.variacaoId,
                                      variacaoNome: variacao.variacaoNome
                                    }, PRODUCAO_STATUS_IDS)}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {variacao.imagem && (
                                        <div className="w-8 h-8 rounded bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
                                          <img 
                                            src={variacao.imagem} 
                                            alt={variacao.variacaoNome || 'Variação'}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      )}
                                      <span className="text-sm truncate">
                                        {variacao.variacaoNome || 'Sem variação'}
                                      </span>
                                    </div>
                                    <Badge variant="outline" className="text-sm font-semibold ml-2">
                                      {variacao.quantidade}×
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Entrada Logística */}
            {ENTRADA_LOGISTICA_STATUS_IDS.length > 0 && (() => {
              const produtos = getItensAgrupadosPorProduto(ENTRADA_LOGISTICA_STATUS_IDS);
              const totalItens = produtos.reduce((sum, produto) => sum + produto.totalQuantidade, 0);
              
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
                    {produtos.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum item em entrada logística
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {produtos.map((produto, idx) => (
                          <Card key={idx} className="overflow-hidden">
                            <CardHeader className="pb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {produto.imagem ? (
                                    <img 
                                      src={produto.imagem} 
                                      alt={produto.produtoNome}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Sem foto</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-base truncate">{produto.produtoNome}</h3>
                                  <Badge variant="secondary" className="mt-1">
                                    Total: {produto.totalQuantidade}×
                                  </Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                {produto.variacoes.map((variacao, vIdx) => (
                                  <div 
                                    key={vIdx}
                                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-accent/50 transition-colors cursor-pointer"
                                    onClick={() => handleItemClick({
                                      produtoId: produto.produtoId,
                                      produtoNome: produto.produtoNome,
                                      variacaoId: variacao.variacaoId,
                                      variacaoNome: variacao.variacaoNome
                                    }, ENTRADA_LOGISTICA_STATUS_IDS)}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {variacao.imagem && (
                                        <div className="w-8 h-8 rounded bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
                                          <img 
                                            src={variacao.imagem} 
                                            alt={variacao.variacaoNome || 'Variação'}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      )}
                                      <span className="text-sm truncate">
                                        {variacao.variacaoNome || 'Sem variação'}
                                      </span>
                                    </div>
                                    <Badge variant="outline" className="text-sm font-semibold ml-2">
                                      {variacao.quantidade}×
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Logística */}
            {LOGISTICA_STATUS_IDS.length > 0 && (() => {
              const produtos = getItensAgrupadosPorProduto(LOGISTICA_STATUS_IDS);
              const totalItens = produtos.reduce((sum, produto) => sum + produto.totalQuantidade, 0);
              
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
                    {produtos.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum item em logística
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {produtos.map((produto, idx) => (
                          <Card key={idx} className="overflow-hidden">
                            <CardHeader className="pb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {produto.imagem ? (
                                    <img 
                                      src={produto.imagem} 
                                      alt={produto.produtoNome}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Sem foto</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-base truncate">{produto.produtoNome}</h3>
                                  <Badge variant="secondary" className="mt-1">
                                    Total: {produto.totalQuantidade}×
                                  </Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                {produto.variacoes.map((variacao, vIdx) => (
                                  <div 
                                    key={vIdx}
                                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-accent/50 transition-colors cursor-pointer"
                                    onClick={() => handleItemClick({
                                      produtoId: produto.produtoId,
                                      produtoNome: produto.produtoNome,
                                      variacaoId: variacao.variacaoId,
                                      variacaoNome: variacao.variacaoNome
                                    }, LOGISTICA_STATUS_IDS)}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {variacao.imagem && (
                                        <div className="w-8 h-8 rounded bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
                                          <img 
                                            src={variacao.imagem} 
                                            alt={variacao.variacaoNome || 'Variação'}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      )}
                                      <span className="text-sm truncate">
                                        {variacao.variacaoNome || 'Sem variação'}
                                      </span>
                                    </div>
                                    <Badge variant="outline" className="text-sm font-semibold ml-2">
                                      {variacao.quantidade}×
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
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
    </div>
  );
}