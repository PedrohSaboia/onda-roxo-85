import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Truck, CheckCircle, Clock, XCircle, RefreshCw, X, ChevronLeft, ChevronRight, ChevronDown, Users, TriangleAlert } from 'lucide-react';
import { FaBoxesStacked } from 'react-icons/fa6';
import { HiFilter } from 'react-icons/hi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockPedidos } from '@/data/mockData';
import { Pedido, EtiquetaEnvio } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LogisticaSidebar } from '@/components/layout/LogisticaSidebar';
import { registrarHistoricoMovimentacao } from '@/lib/historicoMovimentacoes';

export function Logistica() {
  const MERCADO_LIVRE_PLATAFORMA_ID = '3e5a2b44-245a-4be9-a0b1-ef67d83fd8ec';
  const ENVIADO_STATUS_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';
  const LOGISTICA_STATUS_ID = '3473cae9-47c8-4b85-96af-b41fe0e15fa9';
  const ITEM_PRIORITARIO_ML_ID = 'ab8a89a1-aa95-4a98-99c2-eaa3de670462';

  type ProdutoFiltro = { id: string; nome: string; tipo: 'produto' | 'variacao'; variacaoNome?: string };

  const [barcode, setBarcode] = useState('');
  const barcodeRef = useRef<HTMLInputElement | null>(null);
  const { user, empresaId } = useAuth();
  
  // Estados para a etiqueta ML
  const [gerandoEtiquetaML, setGerandoEtiquetaML] = useState(false);
  const [etiquetaMLModalOpen, setEtiquetaMLModalOpen] = useState(false);
  const [etiquetaMLPdfUrl, setEtiquetaMLPdfUrl] = useState<string | null>(null);

  // Estados para o modal de etiqueta padrão
  const [etiquetaModalOpen, setEtiquetaModalOpen] = useState(false);
  const [etiquetaUrl, setEtiquetaUrl] = useState<string | null>(null);

  // Estados para saldo Melhor Envio
  const [saldoMelhorEnvio, setSaldoMelhorEnvio] = useState<number | null>(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);

  // Estados para envio por pedido
  const [pedidoIdModalOpen, setPedidoIdModalOpen] = useState(false);
  const [pedidoIdInput, setPedidoIdInput] = useState('');
  const [loadingPedidoManual, setLoadingPedidoManual] = useState(false);
  
  // Estados para pedido já enviado
  const [pedidoJaEnviadoModalOpen, setPedidoJaEnviadoModalOpen] = useState(false);
  const [pedidoJaEnviado, setPedidoJaEnviado] = useState<any | null>(null);

  // Modal de confirmação de envio (após abrir link da etiqueta)
  type ConfirmEnvioData = {
    open: boolean;
    link: string | null;
    pedidoId: string;
    pedidoIdExterno: string | null;
    updatePayload: Record<string, any>;
  };
  const [confirmEnvioModal, setConfirmEnvioModal] = useState<ConfirmEnvioData | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  // User ID para histórico
  const [userId, setUserId] = useState<string | null>(null);

  // Buscar saldo do Melhor Envio
  const fetchSaldoMelhorEnvio = async () => {
    setLoadingSaldo(true);
    try {
      // Obter token de sessão do usuário autenticado
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('Usuário não autenticado');
        return;
      }
      
      const response = await fetch('https://rllypkctvckeaczjesht.supabase.co/functions/v1/buscar_saldo_melhor_envio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(errorData.message || 'Erro ao buscar saldo');
      }

      const data = await response.json();
      console.log('Saldo Melhor Envio:', data);
      
      if (data?.balance !== undefined) {
        setSaldoMelhorEnvio(data.balance);
      }
    } catch (error) {
      console.error('Erro ao buscar saldo do Melhor Envio:', error);
    } finally {
      setLoadingSaldo(false);
    }
  };

  const { toast } = useToast();
  const [loadingScan, setLoadingScan] = useState(false);
  const [foundPedido, setFoundPedido] = useState<any | null>(null);
  const [foundItemIds, setFoundItemIds] = useState<string[]>([]);
  const [itemInputs, setItemInputs] = useState<Record<string, string>>({});
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [itemStatus, setItemStatus] = useState<Record<string, 'idle' | 'success' | 'error'>>({});
  
  // Estado para dados agrupados da view (usado na seção de bipagem de itens)
  const [gruposAgrupados, setGruposAgrupados] = useState<Record<string, { nome_completo: string; quantidade_total: number }>>({});

  // logística view items (cards)
  type LogItem = { produto_id: string | null; variacao_id: string | null; quantidade_total: number; produto?: any; variacao?: any };
  const [logItems, setLogItems] = useState<LogItem[]>([]);
  const [loadingLogItems, setLoadingLogItems] = useState(false);
  const [logItemsError, setLogItemsError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [plataformasList, setPlataformasList] = useState<Array<{ id: string; nome: string }>>([]);
  // cards por plataforma (nova exibição de itens a enviar)
  const [plataformasCards, setPlataformasCards] = useState<Array<any>>([]);
  const [loadingPlataformaCards, setLoadingPlataformaCards] = useState(false);
  const [openPlatformId, setOpenPlatformId] = useState<string | null>(null);
  const [platformOrderItems, setPlatformOrderItems] = useState<Record<string, any[]>>({});
  const PLATFORM_PAGE_SIZE = 4;
  const [platformPage, setPlatformPage] = useState<Record<string, number>>({});
  const [filterPlataformaId, setFilterPlataformaId] = useState('');
  const [tempFilterPlataformaId, setTempFilterPlataformaId] = useState('');
  const [produtosList, setProdutosList] = useState<Array<{ id: string; nome: string; sku: string; temVariacoes: boolean }>>([]);
  const [produtoSearchTerm, setProdutoSearchTerm] = useState('');
  const [filterProdutos, setFilterProdutos] = useState<ProdutoFiltro[]>([]);
  const [tempFilterProdutos, setTempFilterProdutos] = useState<ProdutoFiltro[]>([]);
  const [showVariacoesModal, setShowVariacoesModal] = useState(false);
  const [variacoesList, setVariacoesList] = useState<Array<{ id: string; nome: string; produtoId: string; produtoNome: string }>>([]);
  const [selectedProdutoParaVariacao, setSelectedProdutoParaVariacao] = useState<{ id: string; nome: string } | null>(null);
  const [modoListaPorPlataforma, setModoListaPorPlataforma] = useState(false);
  const [pedidosFiltrados, setPedidosFiltrados] = useState<any[]>([]);
  const [loadingPedidosFiltrados, setLoadingPedidosFiltrados] = useState(false);
  const [pedidoAtualIndex, setPedidoAtualIndex] = useState(0);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const targetPedidoIdRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef<number | null>(null);

  // Restaura posição do scroll após qualquer re-render causado por paginação
  useLayoutEffect(() => {
    if (savedScrollRef.current !== null && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollRef.current;
      savedScrollRef.current = null;
    }
  });

  const pedidoTemItemPrioritario = (pedido: any) => {
    const itens = pedido?.itens_pedido || [];
    return itens.some((item: any) =>
      item?.id === ITEM_PRIORITARIO_ML_ID ||
      item?.produto_id === ITEM_PRIORITARIO_ML_ID ||
      item?.variacao_id === ITEM_PRIORITARIO_ML_ID
    );
  };

  // Ordenação determinística compartilhada entre cards e sequência de pedidos
  const sortPedidos = (pedidos: any[]): any[] => {
    return [...pedidos].sort((a, b) => {
      // 1. Itens prioritários do ML (só disponível com dados completos)
      const aItemML = a?.plataforma_id === MERCADO_LIVRE_PLATAFORMA_ID && pedidoTemItemPrioritario(a);
      const bItemML = b?.plataforma_id === MERCADO_LIVRE_PLATAFORMA_ID && pedidoTemItemPrioritario(b);
      if (aItemML !== bItemML) return aItemML ? -1 : 1;

      // 2. ML com shipping_id (só disponível com dados completos)
      const aShipML = a?.plataforma_id === MERCADO_LIVRE_PLATAFORMA_ID && !!String(a?.shipping_id || '').trim();
      const bShipML = b?.plataforma_id === MERCADO_LIVRE_PLATAFORMA_ID && !!String(b?.shipping_id || '').trim();
      if (aShipML !== bShipML) return aShipML ? -1 : 1;

      // 3. Urgente primeiro
      const aUrg = !!a?.urgente;
      const bUrg = !!b?.urgente;
      if (aUrg !== bUrg) return aUrg ? -1 : 1;

      // 4. Mais antigo primeiro (criado_em asc)
      const aTime = new Date(a?.criado_em || 0).getTime();
      const bTime = new Date(b?.criado_em || 0).getTime();
      if (aTime !== bTime) return aTime - bTime;

      // 5. Tiebreaker estável: UUID
      return String(a?.id || '').localeCompare(String(b?.id || ''));
    });
  };

  const filterProdutosKey = filterProdutos.map((p) => `${p.tipo}:${p.id}`).sort().join('|');

  const buscarProdutos = async (termo: string) => {
    if (!termo || termo.length < 2) {
      setProdutosList([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, sku, variacoes_produto(id)')
        .ilike('nome', `%${termo}%`)
        .limit(20);

      if (error) throw error;

      const produtos = (data || []).map((p: any) => ({
        id: p.id,
        nome: p.nome,
        sku: p.sku || '',
        temVariacoes: (p.variacoes_produto && p.variacoes_produto.length > 0),
      }));

      setProdutosList(produtos);
    } catch (err) {
      console.error('Erro ao buscar produtos:', err);
      toast({ title: 'Erro', description: 'Não foi possível buscar produtos', variant: 'destructive' });
    }
  };

  const carregarVariacoes = async (produtoId: string, produtoNome: string) => {
    try {
      const { data, error } = await supabase
        .from('variacoes_produto')
        .select('id, nome')
        .eq('produto_id', produtoId)
        .order('ordem');

      if (error) throw error;

      const variacoes = (data || []).map((v: any) => ({
        id: v.id,
        nome: v.nome,
        produtoId,
        produtoNome,
      }));

      setVariacoesList(variacoes);
      setSelectedProdutoParaVariacao({ id: produtoId, nome: produtoNome });
      setShowVariacoesModal(true);
    } catch (err) {
      console.error('Erro ao carregar variações:', err);
      toast({ title: 'Erro', description: 'Não foi possível carregar variações', variant: 'destructive' });
    }
  };

  const selecionarProduto = async (produto: { id: string; nome: string; temVariacoes: boolean }) => {
    if (produto.temVariacoes) {
      await carregarVariacoes(produto.id, produto.nome);
      return;
    }

    if (!tempFilterProdutos.find((p) => p.id === produto.id && p.tipo === 'produto')) {
      setTempFilterProdutos((prev) => [...prev, { id: produto.id, nome: produto.nome, tipo: 'produto' }]);
    }
    setProdutoSearchTerm('');
    setProdutosList([]);
  };

  const selecionarVariacao = (variacao: { id: string; nome: string; produtoId: string; produtoNome: string }) => {
    if (!tempFilterProdutos.find((p) => p.id === variacao.id && p.tipo === 'variacao')) {
      setTempFilterProdutos((prev) => [
        ...prev,
        {
          id: variacao.id,
          nome: variacao.produtoNome,
          tipo: 'variacao',
          variacaoNome: variacao.nome,
        },
      ]);
    }
    setShowVariacoesModal(false);
    setProdutoSearchTerm('');
    setProdutosList([]);
  };

  const removerProdutoFiltro = (id: string, tipo: 'produto' | 'variacao') => {
    setTempFilterProdutos((prev) => prev.filter((p) => !(p.id === id && p.tipo === tipo)));
  };

  const fetchLogItems = async () => {
    setLoadingLogItems(true);
    setLogItemsError(null);
    try {
      let rows: Array<{ produto_id: string | null; variacao_id: string | null; quantidade_total: number }> = [];

      if (filterPlataformaId) {
        const { data: pedidosData, error: pedidosError } = await (supabase as any)
          .from('pedidos')
          .select('id, status_id, plataforma_id, itens_pedido(produto_id, variacao_id, quantidade)')
          .eq('plataforma_id', filterPlataformaId)
          .eq('status_id', LOGISTICA_STATUS_ID);

        if (pedidosError) throw pedidosError;

        const aggregate = new Map<string, { produto_id: string | null; variacao_id: string | null; quantidade_total: number }>();
        const pedidos = (pedidosData ?? []) as Array<any>;

        for (const pedido of pedidos) {
          const itens = (pedido?.itens_pedido ?? []) as Array<{ produto_id: string | null; variacao_id: string | null; quantidade: number | null }>;
          for (const item of itens) {
            const key = `${item.produto_id ?? 'p'}-${item.variacao_id ?? 'v'}`;
            const quantidade = Number(item.quantidade ?? 0);
            const existing = aggregate.get(key);
            if (existing) {
              existing.quantidade_total += quantidade;
            } else {
              aggregate.set(key, {
                produto_id: item.produto_id ?? null,
                variacao_id: item.variacao_id ?? null,
                quantidade_total: quantidade,
              });
            }
          }
        }

        rows = Array.from(aggregate.values());
      } else {
        const { data, error } = await (supabase as any)
          .from('vw_itens_logistica')
          .select('produto_id, variacao_id, quantidade_total');
        if (error) throw error;
        rows = (data ?? []) as Array<{ produto_id: string | null; variacao_id: string | null; quantidade_total: number }>;
      }

      // collect ids
      const produtoIds = Array.from(new Set(rows.map(r => r.produto_id).filter(Boolean))) as string[];
      const variacaoIds = Array.from(new Set(rows.map(r => r.variacao_id).filter(Boolean))) as string[];

      // fetch products and variations in parallel
      const [prodRes, varRes] = await Promise.all([
        produtoIds.length ? (supabase as any).from('produtos').select('id, nome, sku, img_url').in('id', produtoIds) : Promise.resolve({ data: [], error: null }),
        variacaoIds.length ? (supabase as any).from('variacoes_produto').select('id, nome, sku, img_url, produto_id').in('id', variacaoIds) : Promise.resolve({ data: [], error: null })
      ] as const);

      if (prodRes?.error) throw prodRes.error;
      if (varRes?.error) throw varRes.error;

      const prodMap = new Map<string, any>((prodRes?.data ?? []).map((p: any) => [p.id, p]));
      const varMap = new Map<string, any>((varRes?.data ?? []).map((v: any) => [v.id, v]));

      const enriched = rows.map(r => ({
        ...r,
        produto: r.produto_id ? prodMap.get(r.produto_id) : undefined,
        variacao: r.variacao_id ? varMap.get(r.variacao_id) : undefined,
      }));

      if (filterProdutos.length > 0) {
        const produtoIds = new Set(filterProdutos.filter((p) => p.tipo === 'produto').map((p) => p.id));
        const variacaoIds = new Set(filterProdutos.filter((p) => p.tipo === 'variacao').map((p) => p.id));

        const filtradosPorProduto = enriched.filter((item: any) => {
          const variacaoProdutoId = item.variacao?.produto_id;
          return (
            (item.produto_id && produtoIds.has(item.produto_id)) ||
            (variacaoProdutoId && produtoIds.has(variacaoProdutoId)) ||
            (item.variacao_id && variacaoIds.has(item.variacao_id))
          );
        });

        setLogItems(filtradosPorProduto);
      } else {
        setLogItems(enriched);
      }
    } catch (err) {
      console.error('Erro ao buscar itens de logística:', err);
      setLogItemsError(String(err));
      setLogItems([]);
    } finally {
      setLoadingLogItems(false);
    }
  };

  const FULL_PEDIDO_SELECT = `id,id_externo,plataforma_id,shipping_id,urgente,status_id,criado_em,remetente_id,link_etiqueta,responsavel:usuarios(id,nome,img_url),plataformas(id,nome,img_url),itens_pedido(id,produto_id,variacao_id,quantidade,preco_unitario,codigo_barras,pintado,produto:produtos(id,nome,sku,img_url),variacao:variacoes_produto(id,nome,sku,img_url))`;

  const fetchPedidosPorIds = async (ids: string[]): Promise<any[]> => {
    if (!ids.length) return [];
    const { data, error } = await (supabase as any)
      .from('pedidos')
      .select(FULL_PEDIDO_SELECT)
      .in('id', ids);
    if (error) throw error;
    return data || [];
  };

  const fetchPedidosPorPlataforma = async (plataformaId: string) => {
    setLoadingPedidosFiltrados(true);
    try {
      const selectQuery = FULL_PEDIDO_SELECT;

      let pedidoIdsFiltroProduto: string[] | null = null;
      if (filterProdutos.length > 0) {
        const produtoIds = filterProdutos.filter((p) => p.tipo === 'produto').map((p) => p.id);
        const variacaoIds = filterProdutos.filter((p) => p.tipo === 'variacao').map((p) => p.id);

        let itemsQuery: any = (supabase as any).from('itens_pedido').select('pedido_id');

        if (produtoIds.length > 0 && variacaoIds.length > 0) {
          itemsQuery = itemsQuery.or(`produto_id.in.(${produtoIds.join(',')}),variacao_id.in.(${variacaoIds.join(',')})`);
        } else if (produtoIds.length > 0) {
          itemsQuery = itemsQuery.in('produto_id', produtoIds);
        } else if (variacaoIds.length > 0) {
          itemsQuery = itemsQuery.in('variacao_id', variacaoIds);
        }

        const { data: itemsData, error: itemsError } = await itemsQuery;
        if (itemsError) throw itemsError;

        pedidoIdsFiltroProduto = [...new Set((itemsData || []).map((item: any) => item.pedido_id))] as string[];

        if (pedidoIdsFiltroProduto.length === 0) {
          setPedidosFiltrados([]);
          setPedidoAtualIndex(0);
          setFoundPedido(null);
          return;
        }
      }

      let query: any = (supabase as any)
        .from('pedidos')
        .select(selectQuery)
        .eq('plataforma_id', plataformaId)
        .eq('status_id', LOGISTICA_STATUS_ID)
        .eq('etiqueta_envio_id', '466958dd-e525-4e8d-95f1-067124a5ea7f');

      if (pedidoIdsFiltroProduto && pedidoIdsFiltroProduto.length > 0) {
        query = query.in('id', pedidoIdsFiltroProduto);
      }

      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const pedidos = (data || []) as any[];
      const priorizados = sortPedidos(pedidos);

      const targetId = targetPedidoIdRef.current;
      targetPedidoIdRef.current = null;
      const targetIdx = targetId ? priorizados.findIndex((p: any) => p.id === targetId) : -1;
      const startIdx = targetIdx >= 0 ? targetIdx : 0;

      setPedidosFiltrados(priorizados);
      setPedidoAtualIndex(startIdx);
      setFoundItemIds([]);
      setItemInputs({});
      setItemStatus({});
      setFoundPedido(priorizados[startIdx] || null);
    } catch (err) {
      console.error('Erro ao buscar pedidos por plataforma:', err);
      setPedidosFiltrados([]);
      setPedidoAtualIndex(0);
      setFoundPedido(null);
    } finally {
      setLoadingPedidosFiltrados(false);
    }
  };

  const handleMudarPedidoPaginacao = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= pedidosFiltrados.length) return;
    setPedidoAtualIndex(nextIndex);
    setFoundPedido(pedidosFiltrados[nextIndex]);
    setFoundItemIds([]);
    setItemInputs({});
    setItemStatus({});
    setTimeout(() => barcodeRef.current?.focus(), 50);
  };

  const avancarParaProximoPedidoAposConclusao = (pedidoConcluidoId?: string) => {
    if (!modoListaPorPlataforma) {
      setFoundPedido(null);
      setFoundItemIds([]);
      setItemInputs({});
      setItemStatus({});
      setTimeout(() => barcodeRef.current?.focus(), 0);
      return;
    }

    setPedidosFiltrados((prev) => {
      const listaAtual = Array.isArray(prev) ? prev : [];
      const listaSemConcluido = pedidoConcluidoId
        ? listaAtual.filter((p: any) => p.id !== pedidoConcluidoId)
        : listaAtual;

      if (listaSemConcluido.length === 0) {
        setPedidoAtualIndex(0);
        setFoundPedido(null);
        setFoundItemIds([]);
        setItemInputs({});
        setItemStatus({});
        setTimeout(() => barcodeRef.current?.focus(), 0);
        return [];
      }

      // após imprimir etiqueta, volta sempre ao primeiro da lista
      setPedidoAtualIndex(0);
      setFoundPedido(listaSemConcluido[0]);
      setFoundItemIds([]);
      setItemInputs({});
      setItemStatus({});
      setTimeout(() => barcodeRef.current?.focus(), 50);

      return listaSemConcluido;
    });
  };

  useEffect(() => {
    fetchLogItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterPlataformaId, filterProdutosKey]);

  useEffect(() => {
    if (!filterPlataformaId) {
      if (modoListaPorPlataforma) {
        setFoundPedido(null);
        setFoundItemIds([]);
        setItemInputs({});
        setItemStatus({});
      }
      setModoListaPorPlataforma(false);
      setPedidosFiltrados([]);
      setPedidoAtualIndex(0);
      return;
    }

    setModoListaPorPlataforma(true);
    fetchPedidosPorPlataforma(filterPlataformaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterPlataformaId, empresaId, filterProdutosKey]);

  useEffect(() => {
    let mounted = true;
    const loadPlataformas = async () => {
      try {
        let query = supabase
          .from('plataformas')
          .select('id, nome, empresa_id')
          .order('nome');

        if (empresaId) {
          query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!mounted) return;

        const plataformasOrdenadas = (data || []).map((p: any) => ({ id: p.id, nome: p.nome }));
        setPlataformasList(plataformasOrdenadas);
        // também buscar os cards por plataforma (contagens de pedidos em logística com etiqueta disponível)
        try {
          await fetchPlataformaCards();
        } catch (e) {
          // ignore
        }
      } catch (err) {
        console.error('Erro ao carregar plataformas:', err);
        if (!mounted) return;
        setPlataformasList([]);
      }
    };

    loadPlataformas();

    return () => {
      mounted = false;
    };
  }, [empresaId]);

  const fetchPlataformaCards = async () => {
    setLoadingPlataformaCards(true);
    try {
      // obter plataformas (já carregadas normalmente) e pedidos que estão em status LOGISTICA
      const { data: plataformas } = await supabase
        .from('plataformas')
        .select('id, nome, img_url')
        .order('nome');

      const TARGET_ETIQUETA_ID = '466958dd-e525-4e8d-95f1-067124a5ea7f';

      // IDs das plataformas de leads
      const LEADS_PLATFORM_IDS = new Set([
        '0e27f292-924c-4ffc-a141-bbe00ec00428',
        'c85e1fc7-b03e-48a2-92ec-9123dcb3dd4f',
        'd83fff08-7ac4-4a15-9e6d-0a9247b24fe4',
      ]);

      // buscar pedidos com status LOGISTICA e etiqueta_envio_id exatos (filtros aplicados no servidor)
      let pedidosQuery = (supabase as any)
        .from('pedidos')
        .select('id,id_externo,plataforma_id,link_etiqueta,etiqueta_envio_id,status_id,urgente,etiqueta_ml,criado_em,shipping_id')
        .eq('status_id', LOGISTICA_STATUS_ID)
        .eq('etiqueta_envio_id', TARGET_ETIQUETA_ID);
      if (empresaId) pedidosQuery = pedidosQuery.eq('empresa_id', empresaId);

      const { data: pedidosData, error: pedidosErr } = await pedidosQuery;
      if (pedidosErr) throw pedidosErr;
      const pedidosComEtiqueta = pedidosData || [];

      const platformMap = new Map((plataformas || []).map((p: any) => [p.id, p]));

      // identificar plataformas principais
      const yampiPlatform = (plataformas || []).find((p: any) => /yampi/i.test(p.nome));
      const mlPlatform = (plataformas || []).find((p: any) => p.id === MERCADO_LIVRE_PLATAFORMA_ID || /mercado livre/i.test(p.nome));

      // nomes de plataformas urgentes (exceto ML e Yampi)
      const urgentPlatformNames = ['shopee', 'tiktok', 'magalu'];

      const yampiPedidos = pedidosComEtiqueta.filter((p: any) =>
        p.plataforma_id === yampiPlatform?.id && !p.urgente,
      );
      const mlPedidos = pedidosComEtiqueta.filter((p: any) =>
        p.plataforma_id === mlPlatform?.id && !p.etiqueta_ml && !p.urgente,
      );
      const leadsPedidos = pedidosComEtiqueta.filter((p: any) =>
        LEADS_PLATFORM_IDS.has(p.plataforma_id),
      );
      const urgentesPedidos = pedidosComEtiqueta.filter((p: any) => {
        const pname = String(platformMap.get(p.plataforma_id)?.nome || '').toLowerCase();
        const isUrgentPlatform = urgentPlatformNames.some((n) => pname.includes(n));
        const isMLComEtiquetaML = p.plataforma_id === mlPlatform?.id && !!p.etiqueta_ml;
        const isUrgente = !!p.urgente;
        return isUrgentPlatform || isMLComEtiquetaML || isUrgente;
      });

      const cards = [
        {
          id: yampiPlatform?.id || 'yampi-card',
          nome: yampiPlatform?.nome || 'Yampi',
          img_url: yampiPlatform?.img_url,
          count: yampiPedidos.length,
          pedidos: sortPedidos(yampiPedidos),
        },
        {
          id: mlPlatform?.id || MERCADO_LIVRE_PLATAFORMA_ID,
          nome: mlPlatform?.nome || 'Mercado Livre',
          img_url: mlPlatform?.img_url,
          count: mlPedidos.length,
          pedidos: sortPedidos(mlPedidos),
        },
        {
          id: 'leads',
          nome: 'Leads',
          img_url: null,
          count: leadsPedidos.length,
          pedidos: sortPedidos(leadsPedidos),
        },
        {
          id: 'urgentes',
          nome: 'Urgentes',
          img_url: null,
          count: urgentesPedidos.length,
          pedidos: sortPedidos(urgentesPedidos),
        },
      ];

      setPlataformasCards(cards);
    } catch (err) {
      console.error('Erro ao buscar cards por plataforma:', err);
      setPlataformasCards([]);
    } finally {
      setLoadingPlataformaCards(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    };

    if (showFilters) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilters]);

  const fetchItemsForPedidoIds = async (pedidoIds: string[]) => {
    if (!pedidoIds || pedidoIds.length === 0) return;
    try {
      const { data: itemsData, error: itemsErr } = await (supabase as any)
        .from('itens_pedido')
        .select('pedido_id, quantidade, produto:produtos(id,nome,img_url), variacao:variacoes_produto(id,nome,img_url)')
        .in('pedido_id', pedidoIds);
      if (itemsErr) throw itemsErr;
      const grouped: Record<string, any[]> = {};
      (itemsData || []).forEach((it: any) => {
        const pid = it.pedido_id;
        const entry = grouped[pid] || [];
        entry.push({
          quantidade: it.quantidade,
          img_url: it.produto?.img_url || it.variacao?.img_url || null,
          nome: it.produto?.nome || it.variacao?.nome || null,
        });
        grouped[pid] = entry;
      });
      setPlatformOrderItems((prev) => ({ ...prev, ...grouped }));
    } catch (err) {
      console.error('Erro ao buscar itens para pedidos:', err);
    }
  };

  useEffect(() => {
    // focus on mount
    setTimeout(() => barcodeRef.current?.focus(), 50);
    // buscar saldo ao carregar a página
    fetchSaldoMelhorEnvio();
  }, []);

  // Buscar userId da sessão
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    };
    fetchUser();
  }, []);

  // Buscar dados agrupados da view quando foundPedido muda
  useEffect(() => {
    if (foundPedido?.id) {
      (supabase as any)
        .from('itens_pedido_agrupados')
        .select('*')
        .eq('pedido_id', foundPedido.id)
        .then(({ data, error }) => {
          if (!error && data) {
            console.log('📊 Dados da view itens_pedido_agrupados:', data);
            const grupos: Record<string, { nome_completo: string; quantidade_total: number }> = {};
            data.forEach((item: any) => {
              grupos[item.item_referencia_id] = {
                nome_completo: item.nome_completo,
                quantidade_total: item.quantidade_total
              };
            });
            console.log('📦 Grupos processados:', grupos);
            setGruposAgrupados(grupos);
          }
        });
    } else {
      setGruposAgrupados({});
    }
  }, [foundPedido?.id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // agora a pesquisa é por id_externo do pedido
      const code = barcode.trim();
      if (!code) return;
      void handleBuscarPedidoPorId(code);
    }
  };

  // derived helpers for UI
  const items = foundPedido?.itens_pedido || [];
  const allItemsBipado = items.length > 0 && items.every((it: any) => (foundItemIds || []).includes(it.id));
  const filteredLogItems = logItems;
  
  // Verifica se deve mostrar o botão da etiqueta ML
  // Prioridade: shipping_id deve ter valor (não null, não vazio)
  // Secundário: deve ser da plataforma Mercado Livre
  const shouldShowMLButton = foundPedido?.plataforma_id === MERCADO_LIVRE_PLATAFORMA_ID 
                            && foundPedido?.shipping_id 
                            && String(foundPedido.shipping_id).trim() !== '';

  const handleGerarEtiquetaML = async () => {
    if (!foundPedido?.id) {
      toast({ 
        title: 'Erro', 
        description: 'O pedido não possui id primário definido',
        variant: 'destructive'
      });
      return;
    }

    setGerandoEtiquetaML(true);

    try {
      const EDGE_FUNCTION_URL = 'https://rllypkctvckeaczjesht.supabase.co/functions/v1/gerar-etiqueta-ml';

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pedido_id: foundPedido.id }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro desconhecido ao gerar etiqueta');
      }

      const data = await response.json();
      const pdfBase64 = data.pdf_base64;

      if (!pdfBase64) {
        throw new Error('O Base64 do PDF não foi retornado.');
      }

      // Converte Base64 para Blob
      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // Cria URL do Blob e abre o modal
      const blobUrl = URL.createObjectURL(blob);
      setEtiquetaMLPdfUrl(blobUrl);
      setEtiquetaMLModalOpen(true);

      toast({ title: 'Sucesso', description: 'Etiqueta gerada! Visualize e imprima.' });

      // Manter filtros/paginação e avançar para o próximo pedido (quando aplicável)
      avancarParaProximoPedidoAposConclusao(foundPedido?.id);
      
      // Registrar no histórico
      if (foundPedido?.id && userId) {
        await registrarHistoricoMovimentacao(
          foundPedido.id,
          `Etiqueta Mercado Livre gerada via logística (ID Externo: ${foundPedido.id_externo})`,
          userId
        );
      }
    } catch (error: any) {
      console.error('Erro ao processar a etiqueta:', error);
      toast({ 
        title: 'Erro', 
        description: `Erro ao processar a etiqueta: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setGerandoEtiquetaML(false);
    }
  };

  const handleFecharModalEtiquetaML = () => {
    setEtiquetaMLModalOpen(false);
    if (etiquetaMLPdfUrl) {
      URL.revokeObjectURL(etiquetaMLPdfUrl);
      setEtiquetaMLPdfUrl(null);
    }
  };

  const handleScan = async (code: string) => {
    if (!code) return;
    setLoadingScan(true);
    try {

      // Call RPC to find item by barcode (server function `achar_item_por_codigo_bipado`)
      let data: any = null;
      let error: any = null;
      try {
        const rpcRes: any = await (supabase as any).rpc('achar_item_por_codigo_bipado', { codigo_bipado: code });
        data = rpcRes?.data ?? rpcRes;
        error = rpcRes?.error ?? null;
      } catch (e: any) {
        error = e;
      }

      if (error) throw error;

      if (!data || (Array.isArray(data) && data.length === 0)) {
        toast({ title: 'Não encontrado', description: 'Nenhum item encontrado para esse código', variant: 'destructive' });
        setFoundPedido(null);
        setFoundItemIds([]);
        return;
      }

      const row: any = Array.isArray(data) ? data[0] : data;

      // fetch pedido details (responsável, plataforma, itens)
      const { data: pedidoData, error: pedErr } = await supabase
        .from('pedidos')
        .select(`id,id_externo,plataforma_id,urgente,remetente_id,link_etiqueta,responsavel:usuarios(id,nome,img_url),plataformas(id,nome,img_url), itens_pedido(id,produto_id,variacao_id,quantidade,preco_unitario,codigo_barras,pintado, produto:produtos(id,nome,sku,img_url), variacao:variacoes_produto(id,nome,sku,img_url))`)
        .eq('id', row.pedido_id)
        .single();

      if (pedErr) throw pedErr;
      const pedidoRow = pedidoData as any;

      console.log('Pedido encontrado:', pedidoRow);
      console.log('Itens do pedido:', pedidoRow?.itens_pedido?.map((it: any) => ({ 
        id: it.id, 
        nome: it.produto?.nome || it.variacao?.nome, 
        pintado: it.pintado,
        tipo_pintado: typeof it.pintado 
      })));

      setFoundPedido(pedidoRow);
      
      // Registrar no histórico que um item foi bipado
      if (pedidoRow?.id && userId) {
        const itemBipado = pedidoRow.itens_pedido?.find((it: any) => it.id === row.item_pedido_id);
        const descricao = itemBipado 
          ? `Item bipado via código de barras: ${itemBipado.produto?.nome || itemBipado.variacao?.nome || 'Item'} (${code})`
          : `Item bipado via código de barras: ${code}`;
        await registrarHistoricoMovimentacao(
          pedidoRow.id,
          descricao,
          userId
        );
      }
      
      // merge the newly found id into existing state and focus next missing item based on the merged list
      setFoundItemIds((prev) => {
        const merged = Array.from(new Set([...(prev || []), row.item_pedido_id]));
        // clear input for next scan
        setBarcode('');

        // decide next focus using the merged ids
        const itemsForFocus: any[] = pedidoRow?.itens_pedido || [];
        const next = itemsForFocus.find((it: any) => !merged.includes(it.id));
        if (next) {
          const start = Date.now();
          const tryFocus = () => {
            const el = itemRefs.current[next.id];
            if (el) {
              el.focus();
              return;
            }
            if (Date.now() - start < 2000) {
              setTimeout(tryFocus, 30);
            } else {
              barcodeRef.current?.focus();
            }
          };
          setTimeout(tryFocus, 30);
        } else {
          setTimeout(() => barcodeRef.current?.focus(), 0);
        }

        return merged;
      });
      // refresh cards after marking an item on the server
      try {
        await fetchLogItems();
      } catch (e) {
        // ignore — fetchLogItems logs its own errors
      }
    } catch (err: any) {
      console.error('Erro ao buscar item por código:', err);
      toast({ title: 'Erro', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setLoadingScan(false);
    }
  };

  // note: botão "Enviar por pedido" removido — pesquisa agora é feita diretamente pelo input principal

  const handleBuscarPedidoPorId = async (pedidoIdParam?: string) => {
    const pedidoId = (pedidoIdParam ?? pedidoIdInput).trim();
    if (!pedidoId) {
      toast({ 
        title: 'ID inválido', 
        description: 'Digite um ID de pedido válido', 
        variant: 'destructive' 
      });
      return;
    }

    setLoadingPedidoManual(true);
    try {
      const selectQuery = `id,id_externo,plataforma_id,urgente,shipping_id,remetente_id,status_id,link_etiqueta,responsavel:usuarios(id,nome,img_url),plataformas(id,nome,img_url), itens_pedido(id,produto_id,variacao_id,quantidade,preco_unitario,codigo_barras,pintado, produto:produtos(id,nome,sku,img_url), variacao:variacoes_produto(id,nome,sku,img_url))`;

      // Tentar buscar por id_externo primeiro
      let { data: pedidoData, error: pedErr } = await supabase
        .from('pedidos')
        .select(selectQuery)
        .eq('id_externo', pedidoId)
        .maybeSingle();

      // Se não encontrou por id_externo, tenta por id
      if (!pedidoData) {
        const res = await supabase
          .from('pedidos')
          .select(selectQuery)
          .eq('id', pedidoId)
          .maybeSingle();
        
        pedidoData = res.data;
        pedErr = res.error;
      }

      if (pedErr) throw pedErr;

      if (!pedidoData) {
        throw new Error('Pedido não encontrado');
      }

      const pedidoRow2 = pedidoData as any;

      console.log('Pedido encontrado manualmente:', pedidoRow2);
      console.log('Itens do pedido manual:', pedidoRow2?.itens_pedido?.map((it: any) => ({ 
        id: it.id, 
        nome: it.produto?.nome || it.variacao?.nome, 
        pintado: it.pintado,
        tipo_pintado: typeof it.pintado 
      })));

      // Verificar se o pedido já foi enviado
      if (pedidoRow2.status_id === 'fa6b38ba-1d67-4bc3-821e-ab089d641a25') {
        setPedidoJaEnviado(pedidoRow2);
        setPedidoIdModalOpen(false);
        setPedidoJaEnviadoModalOpen(true);
        return;
      }

      setFoundPedido(pedidoRow2);
      setFoundItemIds([]);
      setPedidoIdModalOpen(false);
      setPedidoIdInput('');

      toast({ 
        title: 'Pedido carregado', 
        description: `Pedido ${pedidoRow2.id_externo || pedidoRow2.id} carregado com sucesso` 
      });

      // Registrar no histórico
      if (pedidoRow2?.id && userId) {
        await registrarHistoricoMovimentacao(
          pedidoRow2.id,
          `Pedido carregado manualmente via logística (ID/ID Externo: ${pedidoId})`,
          userId
        );
      }

      // Focar no primeiro item
      setTimeout(() => {
        const items = pedidoRow2?.itens_pedido || [];
        const first = items[0];
        if (first && itemRefs.current[first.id]) {
          itemRefs.current[first.id]?.focus();
        } else {
          barcodeRef.current?.focus();
        }
      }, 100);

    } catch (err: any) {
      console.error('Erro ao buscar pedido:', err);
      toast({ 
        title: 'Erro ao buscar pedido', 
        description: err.message || String(err), 
        variant: 'destructive' 
      });
    } finally {
      setLoadingPedidoManual(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // Função: processar etiqueta e abrir modal de confirmação
  // ──────────────────────────────────────────────────────────
  const handleImprimirEtiqueta = async () => {
    try {
      setLoadingScan(true);

      // Atalho: pedido já tem link_etiqueta
      if (foundPedido?.link_etiqueta && String(foundPedido.link_etiqueta).trim() !== '') {
        const link = String(foundPedido.link_etiqueta).trim();
        window.open(link, '_blank');
        setConfirmEnvioModal({
          open: true,
          link,
          pedidoId: foundPedido.id,
          pedidoIdExterno: foundPedido.id_externo ?? null,
          updatePayload: {
            status_id: ENVIADO_STATUS_ID,
            data_enviado: new Date().toISOString(),
          },
        });
        return;
      }

      if (!empresaId) throw new Error('Empresa do usuário não encontrada');

      // Verificar saldo Melhor Envio
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');

      const saldoResponse = await fetch('https://rllypkctvckeaczjesht.supabase.co/functions/v1/buscar_saldo_melhor_envio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!saldoResponse.ok) {
        const e = await saldoResponse.json().catch(() => ({ message: 'Erro ao verificar saldo' }));
        throw new Error(e.message || 'Erro ao verificar saldo do Melhor Envio');
      }
      const saldoData = await saldoResponse.json();
      const saldoAtual = saldoData?.balance || 0;
      if (saldoAtual < 50) {
        toast({
          title: '⚠️ Saldo Insuficiente',
          description: `Saldo atual: R$ ${saldoAtual.toFixed(2)}. Mínimo necessário: R$ 50,00. Por favor, recarregue sua conta no Melhor Envio.`,
          variant: 'destructive',
          duration: 8000,
        });
        return;
      }

      // Definir remetente_id
      let remetenteId = foundPedido?.remetente_id;
      if (!remetenteId) {
        const plataformaId = foundPedido?.plataforma_id;
        const plataformasEspeciais = [
          '0e27f292-924c-4ffc-a141-bbe00ec00428',
          'c85e1fc7-b03e-48a2-92ec-9123dcb3dd4f',
          'd83fff08-7ac4-4a15-9e6d-0a9247b24fe4',
        ];
        remetenteId = plataformasEspeciais.includes(plataformaId)
          ? '3fc6839c-e959-4dc1-a983-f61d557e50ec'
          : '128a7de7-d649-43e1-8ba3-2b54c3496b14';
        const { error: updateError } = await supabase.from('pedidos').update({ remetente_id: remetenteId } as any).eq('id', foundPedido?.id);
        if (updateError) throw new Error('Erro ao definir remetente do pedido');
        if (foundPedido?.id && userId) {
          const plataformaNome = plataformasEspeciais.includes(foundPedido?.plataforma_id) ? 'especial' : 'padrão';
          await registrarHistoricoMovimentacao(foundPedido.id, `Remetente definido automaticamente via logística (plataforma ${plataformaNome})`, userId);
        }
      }

      // Chamar Edge Function para processar etiqueta
      const edgeFunctionUrl = 'https://rllypkctvckeaczjesht.supabase.co/functions/v1/processar_etiqueta_em_envio_de_pedido';
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const edgeResponse = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ pedido_id: foundPedido?.id, empresa_id: empresaId, remetente_id: remetenteId }),
      });
      if (!edgeResponse.ok) {
        const errorData = await edgeResponse.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || `Erro ao processar etiqueta: ${edgeResponse.status}`);
      }
      const etiquetaData = await edgeResponse.json();

      if (etiquetaData?.etiqueta_error) {
        toast({ title: '❌ Erro ao gerar etiqueta', description: etiquetaData.etiqueta_error, variant: 'destructive', duration: 10000 });
        return;
      }

      if (foundPedido?.id && userId) {
        await registrarHistoricoMovimentacao(foundPedido.id, `Etiqueta Melhor Envio gerada via logística (ID Externo: ${foundPedido.id_externo || foundPedido.id})`, userId);
      }

      const link = etiquetaData?.etiqueta?.link_etiqueta as string | undefined;

      const updatePayload: Record<string, any> = {
        status_id: ENVIADO_STATUS_ID,
        data_enviado: new Date().toISOString(),
        etiqueta_envio_id: '466958dd-e525-4e8d-95f1-067124a5ea7f',
      };
      if (link) updatePayload.link_etiqueta = link;

      // Abrir link da etiqueta
      if (link) window.open(link, '_blank');

      // Mostrar modal de confirmação — o status só muda quando o usuário confirmar
      setConfirmEnvioModal({
        open: true,
        link: link ?? null,
        pedidoId: foundPedido?.id,
        pedidoIdExterno: foundPedido?.id_externo ?? null,
        updatePayload,
      });
    } catch (err: any) {
      console.error('Erro ao processar pedido:', err);
      toast({ title: 'Erro ao processar pedido', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setLoadingScan(false);
    }
  };

  // Confirma o envio: atualiza status e avança para o próximo pedido
  const handleConfirmarEnvio = async () => {
    if (!confirmEnvioModal) return;
    const { pedidoId, pedidoIdExterno, updatePayload } = confirmEnvioModal;
    setConfirmEnvioModal(null);
    try {
      const { data: dataArray, error } = await supabase
        .from('pedidos')
        .update(updatePayload)
        .eq('id', pedidoId)
        .select('id, id_externo');
      if (error) throw error;
      const data = dataArray?.[0];
      toast({ title: 'Pedido concluído', description: 'Etiqueta processada e status atualizado com sucesso' });
      if (data?.id && userId) {
        await registrarHistoricoMovimentacao(
          data.id,
          `Pedido enviado via logística - status atualizado para "Enviado" (${data.id_externo || data.id})`,
          userId,
        );
      }
      avancarParaProximoPedidoAposConclusao(pedidoId);
      try { await fetchLogItems(); } catch (_) {}
    } catch (err: any) {
      console.error('Erro ao confirmar envio:', err);
      toast({ title: 'Erro ao atualizar status', description: err.message || String(err), variant: 'destructive' });
    }
  };

  const handleConfirmarPedidoJaEnviado = () => {
    if (!pedidoJaEnviado) return;

    // Carregar o pedido e marcar todos os itens como já bipados
    setFoundPedido(pedidoJaEnviado);
    const todosIds = (pedidoJaEnviado.itens_pedido || []).map((item: any) => item.id);
    setFoundItemIds(todosIds);
    
    // Fechar modais e limpar estados
    setPedidoJaEnviadoModalOpen(false);
    setPedidoJaEnviado(null);
    setPedidoIdInput('');

    toast({ 
      title: 'Pedido carregado', 
      description: `Pedido ${pedidoJaEnviado.id_externo || pedidoJaEnviado.id} pronto para regerar etiqueta` 
    });

    // Focar no input principal já que não precisa bipar
    setTimeout(() => barcodeRef.current?.focus(), 100);
  };

 return (
    <div className="flex h-full">
      <LogisticaSidebar />
      <div ref={scrollContainerRef} className="flex-1 h-full overflow-y-auto">
        <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            {(modoListaPorPlataforma || !!foundPedido) && (
              <div className="mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-1"
                  onClick={() => {
                    setFoundPedido(null);
                    setFoundItemIds([]);
                    setFilterPlataformaId('');
                    setModoListaPorPlataforma(false);
                    setPedidosFiltrados([]);
                    setPedidoAtualIndex(0);
                    setOpenPlatformId(null);
                    setItemInputs({});
                    setItemStatus({});
                    setTimeout(() => barcodeRef.current?.focus(), 50);
                  }}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </div>
            )}
            <h1 className="text-2xl font-bold">Logística</h1>
            <p className="text-muted-foreground">Envio de pedidos</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Saldo Melhor Envio</div>
            <div className="text-2xl font-bold text-green-600">
              {loadingSaldo ? (
                <span className="text-base">Carregando...</span>
              ) : saldoMelhorEnvio !== null ? (
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoMelhorEnvio)
              ) : (
                <span className="text-base text-muted-foreground">--</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2">
            <div className="relative" ref={filterDropdownRef}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-12 px-4 bg-card rounded-[16px]"
                onClick={() => {
                  setTempFilterPlataformaId(filterPlataformaId);
                  setTempFilterProdutos(filterProdutos);
                  setProdutoSearchTerm('');
                  setProdutosList([]);
                  setShowFilters((s) => !s);
                }}
              >
                <HiFilter className="h-8 w-8" />
              </Button>

              {showFilters && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-white border rounded shadow z-50 p-3 overflow-visible">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Filtros</div>
                    <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setShowFilters(false)}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="filter-plataforma-logistica" className="text-sm block mb-1">Filtrar por plataforma</label>
                    <select
                      id="filter-plataforma-logistica"
                      value={tempFilterPlataformaId}
                      onChange={(e) => setTempFilterPlataformaId(e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    >
                      <option value="">Todas</option>
                      {plataformasList.map((plataforma) => (
                        <option key={plataforma.id} value={plataforma.id}>{plataforma.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setProdutoSearchTerm('');
                        setProdutosList([]);
                        setTempFilterPlataformaId('');
                        setFilterPlataformaId('');
                        setTempFilterProdutos([]);
                        setFilterProdutos([]);
                      }}
                    >
                      Limpar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setProdutoSearchTerm('');
                        setProdutosList([]);
                        setFilterPlataformaId(tempFilterPlataformaId);
                        setFilterProdutos(tempFilterProdutos);
                        setShowFilters(false);
                      }}
                    >
                      Aplicar
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="relative flex-1">
              <input
                ref={barcodeRef}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => {
                  if (showFilters) return;
                  if (filterDropdownRef.current?.contains(document.activeElement)) return;
                  // if there's an active pedido with remaining un-bipado items, don't force focus back to main input
                  const items = foundPedido?.itens_pedido || [];
                  const hasMissing = items.some((it: any) => !foundItemIds.includes(it.id) && !it.bipado);
                  if (!hasMissing) barcodeRef.current?.focus();
                }, 0)}
                className="w-full text-2xl py-2 pl-3 pr-24 border-2 rounded-[16px] bg-white focus:outline-none focus:ring-0 focus:border-custom-600 transition-colors"
                placeholder="Pesquisar pelo ID do pedido"
                aria-label="Leitor de código"
              />
              <Button
                variant="ghost"
                onClick={() => { setFoundPedido(null); setFoundItemIds([]); setItemInputs({}); setItemStatus({}); setBarcode(''); }}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3 text-sm"
              >
                Limpar
              </Button>
            </div>
          </div>
        </div>

        {/* Cards: itens a enviar (view vw_itens_logistica) - show only when no pedido is active and no filtro por plataforma */}
        {!foundPedido && !modoListaPorPlataforma && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-medium" style={{ fontSize: '18px', fontWeight: 600 }}>ITENS A ENVIAR</h3>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => fetchLogItems()} className="border border-gray-200 rounded-md px-2 py-1 flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" />
                          Atualizar
                        </Button>
                      </div>
            </div>

            {loadingPlataformaCards ? (
              <div className="text-sm text-muted-foreground">Carregando plataformas...</div>
            ) : plataformasCards.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma plataforma com pedidos prontos para etiqueta.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full mx-auto">
                {plataformasCards.map((pc) => {
                  const currentPage = platformPage[pc.id] ?? 1;
                  const totalPages = Math.max(1, Math.ceil((pc.pedidos?.length ?? 0) / PLATFORM_PAGE_SIZE));
                  const sliceStart = (currentPage - 1) * PLATFORM_PAGE_SIZE;
                  const pedidosPagina = (pc.pedidos || []).slice(sliceStart, sliceStart + PLATFORM_PAGE_SIZE);

                  const handleGoToPage = (e: React.MouseEvent, page: number) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (page < 1 || page > totalPages) return;
                    // Puramente síncrono — todos os itens já foram carregados ao abrir o card
                    setPlatformPage((s) => ({ ...s, [pc.id]: page }));
                  };

                  const isSyntheticCard = pc.id === 'urgentes' || pc.id === 'leads';

                  return (
                  <Card key={pc.id} className="p-4 cursor-pointer">
                    <CardContent className="flex items-center gap-4 p-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center flex-shrink-0">
                        {pc.img_url ? (
                          <img src={pc.img_url} alt={pc.nome} className="w-9 h-9 object-cover" />
                        ) : pc.id === 'urgentes' ? (
                          <TriangleAlert className="w-5 h-5 text-red-500" />
                        ) : pc.id === 'leads' ? (
                          <Users className="w-5 h-5 text-gray-600" />
                        ) : (
                          <FaBoxesStacked className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-base">{pc.nome}</div>
                        <div className="text-sm text-muted-foreground">{pc.count} pedido(s)</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenPlatformId(null);
                            if (isSyntheticCard) {
                              setLoadingPedidosFiltrados(true);
                              try {
                                const ids = (pc.pedidos || []).map((x: any) => x.id).filter(Boolean);
                                const fullList = sortPedidos(await fetchPedidosPorIds(ids));
                                setModoListaPorPlataforma(true);
                                setFilterPlataformaId('');
                                setPedidosFiltrados(fullList);
                                setPedidoAtualIndex(0);
                                setFoundPedido(fullList[0] || null);
                                setFoundItemIds([]);
                                setItemInputs({});
                                setItemStatus({});
                              } catch (err) {
                                console.error('Erro ao buscar pedidos do card:', err);
                              } finally {
                                setLoadingPedidosFiltrados(false);
                              }
                            } else {
                              setFilterPlataformaId(pc.id);
                              try { await fetchPedidosPorPlataforma(pc.id); } catch (_) {}
                            }
                            setTimeout(() => barcodeRef.current?.focus(), 50);
                          }}
                        >
                          Enviar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const next = openPlatformId === pc.id ? null : pc.id;
                            setOpenPlatformId(next);
                            if (next) {
                              setPlatformPage((s) => ({ ...s, [pc.id]: 1 }));
                              try {
                                // Carrega TODOS os itens do card de uma vez
                                const ids = (pc.pedidos || []).map((x: any) => x.id).filter(Boolean);
                                if (ids.length > 0) await fetchItemsForPedidoIds(ids);
                              } catch (err) { console.error(err); }
                            }
                          }}
                          aria-label="Abrir pedidos"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>

                    {openPlatformId === pc.id && (
                      <div className="p-2 border-t">
                        {/* Paginação no topo */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between mb-2 pb-2 border-b">
                            <span className="text-sm text-muted-foreground">
                              {pc.pedidos.length} pedidos • {currentPage}/{totalPages}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={currentPage <= 1}
                                onClick={(e) => handleGoToPage(e, currentPage - 1)}
                                className="px-4 py-2 text-lg border rounded disabled:opacity-40 hover:bg-muted"
                              >
                                ‹
                              </button>
                              <button
                                type="button"
                                disabled={currentPage >= totalPages}
                                onClick={(e) => handleGoToPage(e, currentPage + 1)}
                                className="px-4 py-2 text-lg border rounded disabled:opacity-40 hover:bg-muted"
                              >
                                ›
                              </button>
                            </div>
                          </div>
                        )}
                        {pedidosPagina.length === 0 ? (
                          <div className="text-sm text-muted-foreground">Nenhum pedido disponível.</div>
                        ) : (
                          <div className="space-y-2">
                            {pedidosPagina.map((p: any) => {
                              const items = platformOrderItems[p.id] || [];
                              return (
                                <div key={p.id} className="rounded border px-3 py-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className="font-mono text-sm">{p.id_externo || p.id}</span>
                                      <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">{items.length} itens</span>
                                    </div>
                                    <button
                                      type="button"
                                      className="text-sm text-primary underline-offset-4 hover:underline"
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setOpenPlatformId(null);
                                        if (isSyntheticCard) {
                                          // card sintético: buscar dados completos por IDs
                                          try {
                                            const ids = (pc.pedidos || []).map((x: any) => x.id).filter(Boolean);
                                            const fullList = sortPedidos(await fetchPedidosPorIds(ids));
                                            const startIdx = Math.max(0, fullList.findIndex((x: any) => x.id === p.id));
                                            setModoListaPorPlataforma(true);
                                            setFilterPlataformaId('');
                                            setPedidosFiltrados(fullList);
                                            setPedidoAtualIndex(startIdx);
                                            setFoundPedido(fullList[startIdx] || null);
                                            setFoundItemIds([]);
                                            setItemInputs({});
                                            setItemStatus({});
                                            setTimeout(() => barcodeRef.current?.focus(), 50);
                                          } catch (err) {
                                            console.error('Erro ao buscar pedidos do card:', err);
                                          }
                                        } else {
                                          // plataforma real: buscar lista completa e navegar ao pedido específico
                                          targetPedidoIdRef.current = p.id;
                                          setFilterPlataformaId(pc.id);
                                        }
                                      }}
                                    >
                                      Abrir
                                    </button>
                                  </div>
                                  {items.length > 0 && (
                                    <div className="flex flex-wrap gap-2 border-t mt-2 pt-2">
                                      {items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex flex-col items-center gap-1 max-w-[60px]">
                                          {item.img_url ? (
                                            <img src={item.img_url} alt={item.nome || ''} className="h-12 w-12 rounded object-cover border" />
                                          ) : (
                                            <div className="h-12 w-12 rounded border bg-muted flex items-center justify-center text-[10px] text-muted-foreground">sem foto</div>
                                          )}
                                          <span className="text-[10px] text-center leading-tight line-clamp-2 w-full">{item.nome || '—'}</span>
                                          {(item.quantidade ?? 1) > 1 && (
                                            <span className="text-[10px] font-semibold text-muted-foreground">×{item.quantidade}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}


                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Estado vazio/carregando do modo de pedidos por plataforma */}
        {!foundPedido && modoListaPorPlataforma && (
          <div className="mt-4 text-sm text-muted-foreground">
            {loadingPedidosFiltrados
              ? 'Carregando pedidos da plataforma...'
              : 'Nenhum pedido pendente encontrado para esta plataforma.'}
          </div>
        )}

          {/* If a pedido was found, show a single pedido card with its items */}
          {foundPedido && (
            <div className="mt-6">
              <Card>
                {/* make the header area itself use the app header color (inline style for gradient) */}
                <CardHeader className="!p-4 text-white rounded-t" style={{ background: 'var(--gradient-primary)' }}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center">
                          <Avatar className="h-10 w-10">
                            {foundPedido.responsavel?.img_url ? (
                              <img src={foundPedido.responsavel.img_url} alt={foundPedido.responsavel?.nome} className="h-full w-full object-cover rounded-full" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-white/20 rounded-full text-sm font-medium text-white">{(foundPedido.responsavel?.nome || '—').split(' ').map((n: string) => n[0]).slice(0,2).join('')}</div>
                            )}
                          </Avatar>
                        </div>
                      <div className="flex items-center gap-2">
                        {foundPedido.plataformas?.img_url && (
                          <img src={foundPedido.plataformas.img_url} alt={foundPedido.plataformas.nome} className="w-8 h-8 rounded" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-white/90">{foundPedido.id_externo || foundPedido.id || '—'}</div>
                            {(foundPedido?.urgente === true || String(foundPedido?.urgente).toLowerCase() === 'true' || pedidoTemItemPrioritario(foundPedido)) && (
                              <Badge className="bg-red-600 text-white border-red-600 h-5 px-2 text-[10px]">
                                URGENTE
                              </Badge>
                            )}
                          </div>
                          {modoListaPorPlataforma && foundPedido?.criado_em && (
                            <div className="text-sm text-white/80">
                              {new Intl.DateTimeFormat('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              }).format(new Date(foundPedido.criado_em))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {modoListaPorPlataforma && pedidosFiltrados.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white hover:bg-white/20 disabled:opacity-40"
                          disabled={pedidoAtualIndex <= 0}
                          onClick={() => handleMudarPedidoPaginacao(pedidoAtualIndex - 1)}
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="text-base font-semibold text-white">
                          {pedidoAtualIndex + 1} de {pedidosFiltrados.length}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white hover:bg-white/20 disabled:opacity-40"
                          disabled={pedidoAtualIndex >= pedidosFiltrados.length - 1}
                          onClick={() => handleMudarPedidoPaginacao(pedidoAtualIndex + 1)}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="mt-3">
                  {/* Badges dos grupos (antes da lista de itens) */}
                  {(() => {
                    const items = foundPedido.itens_pedido || [];
                    const gruposExibidos = new Set<string>();
                    const badges = [];
                    
                    for (const it of items) {
                      const item_referencia_id = it.variacao_id || it.produto_id;
                      const grupoInfo = gruposAgrupados[item_referencia_id];
                      
                      if (grupoInfo && !gruposExibidos.has(item_referencia_id)) {
                        gruposExibidos.add(item_referencia_id);
                        badges.push(
                          <Badge key={item_referencia_id} variant="secondary" className="text-sm font-medium px-3 py-1">
                            {grupoInfo.nome_completo} - {grupoInfo.quantidade_total}x
                          </Badge>
                        );
                      }
                    }
                    
                    return badges.length > 0 ? (
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        {badges}
                      </div>
                    ) : null;
                  })()}
                  
                  <div className="space-y-3">
                    {(() => {
                      const items = foundPedido.itens_pedido || [];
                      console.log('Logística - Items with pintado:', items.map(it => ({ 
                        nome: it.produto?.nome, 
                        pintado: it.pintado,
                        item: it 
                      })));
                      
                      // Renderizar apenas os itens (sem badges)
                      return items.map((it: any) => {
                        return (
                          <div key={it.id}>
                            <div className={`relative border rounded p-3 flex items-center justify-between ${foundItemIds.includes(it.id) ? 'border-red-500' : 'border-gray-200'}`}>
                              {it.pintado === true && (
                                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                                  <Badge 
                                    variant="default"
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-base px-4 py-1"
                                  >
                                     PINTADO
                                  </Badge>
                                </div>
                              )}
                              <div className="flex items-center gap-3">
                          {it.produto?.img_url || it.variacao?.img_url ? (
                            <img src={it.variacao?.img_url || it.produto?.img_url} className="w-12 h-12 rounded-full border-2 border-gray-200" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400">
                              <FaBoxesStacked className="w-6 h-6" aria-hidden />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{it.produto?.nome || it.variacao?.nome}</span>
                            </div>
                            {it.variacao?.nome ? (
                              <div className="text-sm text-muted-foreground">{it.variacao.nome}</div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-sm">Qtd: {it.quantidade}</div>
                          {foundItemIds.includes(it.id) ? (
                            <div className="px-3 py-1 border border-red-500 rounded text-sm font-medium text-red-700">{it.codigo_barras}</div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                ref={(el) => (itemRefs.current[it.id] = el)}
                                className={`border rounded px-2 py-1 text-sm ${itemStatus[it.id] === 'success' ? 'border-green-600' : ''} ${itemStatus[it.id] === 'error' ? 'border-red-600' : ''}`}
                                placeholder="Código"
                                value={itemInputs[it.id] || ''}
                                onChange={(e) => setItemInputs(prev => ({ ...prev, [it.id]: e.target.value }))}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = (itemInputs[it.id] || '').trim();
                                    if (!val) return;

                                    // immediate local comparison
                                    if (val === it.codigo_barras) {
                                      // success UI
                                      setItemStatus(prev => ({ ...prev, [it.id]: 'success' }));
                                      setFoundItemIds(prev => Array.from(new Set([...(prev || []), it.id])));
                                      setItemInputs(prev => ({ ...prev, [it.id]: '' }));

                                      // focus next missing item if present
                                      const items = foundPedido?.itens_pedido || [];
                                      const next = items.find((x: any) => x.id !== it.id && !((x.bipado === true) || (foundItemIds || []).includes(x.id)));
                                      if (next) {
                                        setTimeout(() => itemRefs.current[next.id]?.focus(), 0);
                                      } else {
                                        // Todos os itens foram bipados - não foca no input principal
                                        // O botão de imprimir etiqueta será habilitado automaticamente
                                      }
                                    } else {
                                      // error UI: clear the input but keep focus so the user can bip again
                                      setItemStatus(prev => ({ ...prev, [it.id]: 'error' }));
                                      setItemInputs(prev => ({ ...prev, [it.id]: '' }));
                                      // ensure focus stays on this input for immediate re-scan
                                      setTimeout(() => itemRefs.current[it.id]?.focus(), 0);
                                      setTimeout(() => setItemStatus(prev => ({ ...prev, [it.id]: 'idle' })), 2000);
                                    }
                                  }
                                }}
                              />
                              {itemStatus[it.id] === 'success' && (
                                <CheckCircle className="text-green-600" />
                              )}
                              {itemStatus[it.id] === 'error' && (
                                <XCircle className="text-red-600" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                        );
                      });
                    })()}
                  </div>
                </CardContent>
                {allItemsBipado && (
                  <div className="p-4 flex justify-center">
                    {shouldShowMLButton ? (
                      // Botão Etiqueta Mercado Livre
                      <Button
                        onClick={handleGerarEtiquetaML}
                        disabled={gerandoEtiquetaML}
                        className="bg-yellow-500 hover:bg-yellow-600"
                      >
                        {gerandoEtiquetaML ? (
                          <>
                            <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full" />
                            Gerando...
                          </>
                        ) : (
                          '📦 Etiqueta Mercado Livre'
                        )}
                      </Button>
                    ) : (
                      // Botão Imprimir Etiqueta original
                      <Button
                        disabled={loadingScan}
                        onClick={() => void handleImprimirEtiqueta()}
                      >
                        {loadingScan ? 'PROCESSANDO...' : 'IMPRIMIR ETIQUETA'}
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}
      </div>
      
      {/* Modal: Confirmação de Envio */}
      <Dialog
        open={!!confirmEnvioModal?.open}
        onOpenChange={(open) => { if (!open) setConfirmEnvioModal(null); }}
      >
        <DialogContent
          className="max-w-md"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleConfirmarEnvio(); } }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Confirmar envio do pedido
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              A etiqueta foi aberta em uma nova aba.
            </p>
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Pedido</p>
              <p className="font-mono font-semibold text-base">
                {confirmEnvioModal?.pedidoIdExterno || confirmEnvioModal?.pedidoId || '—'}
              </p>
            </div>
            <p className="text-sm text-center font-medium">
              Após imprimir a etiqueta, confirme para atualizar o status para <span className="text-green-600 font-semibold">Enviado</span>.
            </p>
            <p className="text-xs text-center text-muted-foreground">
              Pressione <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs bg-muted">Enter</kbd> ou clique em Confirmar.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmEnvioModal(null)}
            >
              Cancelar
            </Button>
            <Button
              ref={confirmBtnRef}
              type="button"
              autoFocus
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => void handleConfirmarEnvio()}
            >
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Etiqueta Mercado Livre */}
      <Dialog open={etiquetaMLModalOpen} onOpenChange={(open) => { if (!open) handleFecharModalEtiquetaML(); }}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>📦 Etiqueta Mercado Livre</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {etiquetaMLPdfUrl && (
              <iframe
                src={etiquetaMLPdfUrl}
                className="w-full h-full border rounded-lg"
                title="Etiqueta ML PDF"
              />
            )}
          </div>
          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button variant="outline" onClick={handleFecharModalEtiquetaML}>
                Fechar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Etiqueta Padrão */}
      <Dialog open={etiquetaModalOpen} onOpenChange={setEtiquetaModalOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>📄 Etiqueta de Envio</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {etiquetaUrl && (
              <iframe
                src={etiquetaUrl}
                className="w-full h-full border rounded-lg"
                title="Etiqueta de Envio"
              />
            )}
          </div>
          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button variant="outline" onClick={() => setEtiquetaModalOpen(false)}>
                Fechar
              </Button>
              <Button onClick={() => {
                if (etiquetaUrl) {
                  window.open(etiquetaUrl, '_blank');
                }
              }}>
                Abrir em Nova Guia
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: ID do Pedido */}
      <Dialog open={pedidoIdModalOpen} onOpenChange={setPedidoIdModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📦 Buscar Pedido</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm text-muted-foreground mb-2 block">
              Digite o ID ou ID Externo do pedido:
            </label>
            <input
              type="text"
              value={pedidoIdInput}
              onChange={(e) => setPedidoIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleBuscarPedidoPorId();
                }
              }}
              placeholder="Ex: 12345 ou abc-123-xyz"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-custom-600"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPedidoIdModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBuscarPedidoPorId} disabled={loadingPedidoManual}>
              {loadingPedidoManual ? 'Buscando...' : 'Buscar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Pedido Já Enviado */}
      <Dialog open={pedidoJaEnviadoModalOpen} onOpenChange={setPedidoJaEnviadoModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>⚠️ Pedido Já Enviado</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-center text-muted-foreground mb-4">
              Este pedido já foi enviado anteriormente.
            </p>
            <p className="text-center font-medium">
              Deseja gerar a etiqueta novamente?
            </p>
          </div>
          <DialogFooter className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => {
                setPedidoJaEnviadoModalOpen(false);
                setPedidoJaEnviado(null);
                setPedidoIdModalOpen(true);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmarPedidoJaEnviado}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Selecionar Variação do Produto */}
      <Dialog open={showVariacoesModal} onOpenChange={setShowVariacoesModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha uma variação</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2 py-2">
            {selectedProdutoParaVariacao && (
              <div className="text-sm text-muted-foreground mb-2">
                Produto: {selectedProdutoParaVariacao.nome}
              </div>
            )}
            {variacoesList.map((variacao) => (
              <button
                key={variacao.id}
                type="button"
                className="w-full text-left px-3 py-2 border rounded hover:bg-muted"
                onClick={() => selecionarVariacao(variacao)}
              >
                {variacao.nome}
              </button>
            ))}
            {variacoesList.length === 0 && (
              <div className="text-sm text-muted-foreground">Nenhuma variação encontrada.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVariacoesModal(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}
