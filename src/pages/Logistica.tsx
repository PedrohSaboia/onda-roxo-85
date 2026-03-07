import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Truck, CheckCircle, Clock, XCircle, RefreshCw, X, ChevronLeft, ChevronRight, ChevronDown, Users, TriangleAlert, Copy, Check } from 'lucide-react';
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
  const SHOPEE_PLATAFORMA_ID = 'c22b2def-47fc-4fbb-aab1-660c951734c7';
  const ENVIADO_STATUS_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';
  const LOGISTICA_STATUS_ID = '3473cae9-47c8-4b85-96af-b41fe0e15fa9';
  const ETIQUETA_DISPONIVEL_ID = '466958dd-e525-4e8d-95f1-067124a5ea7f';
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
  const [foundItemScans, setFoundItemScans] = useState<Record<string, number>>({});
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
  const [comumPedidos, setComumPedidos] = useState<any[]>([]);
  const [incomumPedidos, setIncomumPedidos] = useState<any[]>([]);
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
  const [openSections, setOpenSections] = useState<{ produtos: boolean; comuns: boolean; incomuns: boolean }>({
    produtos: false,
    comuns: false,
    incomuns: false,
  });
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const targetPedidoIdRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Modal: Pedidos do Produto
  type ProdutoModalItem = { produto_id: string | null; variacao_id: string | null; nomeProduto: string; nomeVariacao: string | null; imgUrl: string | null };
  const [produtoPedidosModal, setProdutoPedidosModal] = useState<{ open: boolean; item: ProdutoModalItem | null; pedidos: any[]; loading: boolean }>({ open: false, item: null, pedidos: [], loading: false });
  const [copiedPedidoId, setCopiedPedidoId] = useState<string | null>(null);

  const handleCopyPedidoId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedPedidoId(id);
      setTimeout(() => setCopiedPedidoId(null), 2000);
    }).catch(() => {
      toast({ title: 'Erro', description: 'Não foi possível copiar o ID', variant: 'destructive' });
    });
  };

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

      const TARGET_ETIQUETA_ID = '466958dd-e525-4e8d-95f1-067124a5ea7f';

      if (filterPlataformaId) {
        const { data: pedidosData, error: pedidosError } = await (supabase as any)
          .from('pedidos')
          .select('id, status_id, plataforma_id, itens_pedido(produto_id, variacao_id, quantidade)')
          .eq('plataforma_id', filterPlataformaId)
          .eq('status_id', LOGISTICA_STATUS_ID)
          .eq('etiqueta_envio_id', TARGET_ETIQUETA_ID);

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
        // Busca pedidos com status logística E etiqueta disponível, depois agrega os itens
        let pedidosQuery = (supabase as any)
          .from('pedidos')
          .select('itens_pedido(produto_id, variacao_id, quantidade)')
          .eq('status_id', LOGISTICA_STATUS_ID)
          .eq('etiqueta_envio_id', TARGET_ETIQUETA_ID);
        if (empresaId) pedidosQuery = pedidosQuery.eq('empresa_id', empresaId);

        const { data: pedidosData, error: pedidosError } = await pedidosQuery;
        if (pedidosError) throw pedidosError;

        const aggregate = new Map<string, { produto_id: string | null; variacao_id: string | null; quantidade_total: number }>();
        for (const pedido of (pedidosData ?? [])) {
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

  const FULL_PEDIDO_SELECT = `id,id_externo,plataforma_id,shipping_id,urgente,status_id,criado_em,remetente_id,link_etiqueta,etiquetas_uploads,responsavel:usuarios(id,nome,img_url),plataformas(id,nome,img_url),itens_pedido(id,produto_id,variacao_id,quantidade,preco_unitario,codigo_barras,pintado,produto:produtos(id,nome,sku,img_url),variacao:variacoes_produto(id,nome,sku,img_url))`;

  const fetchPedidosPorIds = async (ids: string[]): Promise<any[]> => {
    if (!ids.length) return [];
    const { data, error } = await (supabase as any)
      .from('pedidos')
      .select(FULL_PEDIDO_SELECT)
      .in('id', ids)
      .eq('etiqueta_envio_id', ETIQUETA_DISPONIVEL_ID);
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
        .eq('etiqueta_envio_id', ETIQUETA_DISPONIVEL_ID);

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
      setFoundItemScans({});
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
    setFoundItemScans({});
    setItemInputs({});
    setItemStatus({});
    setTimeout(() => barcodeRef.current?.focus(), 50);
  };

  const avancarParaProximoPedidoAposConclusao = (pedidoConcluidoId?: string) => {
    if (!modoListaPorPlataforma) {
      setFoundPedido(null);
      setFoundItemScans({});
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
        setFoundItemScans({});
        setItemInputs({});
        setItemStatus({});
        setTimeout(() => barcodeRef.current?.focus(), 0);
        return [];
      }

      // após imprimir etiqueta, volta sempre ao primeiro da lista
      setPedidoAtualIndex(0);
      setFoundPedido(listaSemConcluido[0]);
      setFoundItemScans({});
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
        setFoundItemScans({});
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
        .select('id,id_externo,plataforma_id,link_etiqueta,etiqueta_envio_id,status_id,urgente,etiqueta_ml,criado_em,shipping_id,itens_pedido(produto_id,variacao_id,quantidade)')
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
      const shopeePlatform = (plataformas || []).find((p: any) => p.id === SHOPEE_PLATAFORMA_ID || /shopee/i.test(p.nome));

      // nomes de plataformas urgentes (Shopee fica em aba própria)
      const urgentPlatformNames = ['tiktok', 'magalu'];

      const isShopeePedido = (p: any) => {
        const pname = String(platformMap.get(p.plataforma_id)?.nome || '').toLowerCase();
        return p.plataforma_id === shopeePlatform?.id || p.plataforma_id === SHOPEE_PLATAFORMA_ID || pname.includes('shopee');
      };

      const yampiPedidos = pedidosComEtiqueta.filter((p: any) =>
        p.plataforma_id === yampiPlatform?.id && !p.urgente,
      );
      const mlPedidos = pedidosComEtiqueta.filter((p: any) =>
        p.plataforma_id === mlPlatform?.id && !p.etiqueta_ml && !p.urgente,
      );
      const shopeePedidos = pedidosComEtiqueta.filter((p: any) => isShopeePedido(p));
      const leadsPedidos = pedidosComEtiqueta.filter((p: any) =>
        LEADS_PLATFORM_IDS.has(p.plataforma_id),
      );
      const urgentesPedidos = pedidosComEtiqueta.filter((p: any) => {
        const pname = String(platformMap.get(p.plataforma_id)?.nome || '').toLowerCase();
        if (isShopeePedido(p)) return false;
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
          id: shopeePlatform?.id || SHOPEE_PLATAFORMA_ID,
          nome: shopeePlatform?.nome || 'Shopee',
          img_url: shopeePlatform?.img_url,
          count: shopeePedidos.length,
          pedidos: sortPedidos(shopeePedidos),
        },
        {
          id: 'leads',
          nome: 'Comercial',
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

      const pedidoIds = (pedidosComEtiqueta || []).map((p: any) => p.id).filter(Boolean);
      let pedidosDetalhados: any[] = [];
      if (pedidoIds.length > 0) {
        pedidosDetalhados = await fetchPedidosPorIds(pedidoIds);
      }
      const pedidosComuns = sortPedidos(
        (pedidosDetalhados || []).filter((p: any) => getPedidoType(p) === 'comum'),
      );
      const pedidosIncomuns = sortPedidos(
        (pedidosDetalhados || []).filter((p: any) => getPedidoType(p) === 'incomum'),
      );
      setComumPedidos(pedidosComuns);
      setIncomumPedidos(pedidosIncomuns);
      if (pedidosIncomuns.length > 0) {
        try {
          await fetchItemsForPedidoIds(pedidosIncomuns.map((p: any) => p.id).filter(Boolean));
        } catch (e) {
          console.error('Erro ao pré-carregar itens dos pedidos incomuns:', e);
        }
      }

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

  const fetchPedidosDoProduto = async (item: ProdutoModalItem) => {
    setProdutoPedidosModal({ open: true, item, pedidos: [], loading: true });
    try {
      const TARGET_ETIQUETA_ID = '466958dd-e525-4e8d-95f1-067124a5ea7f';

      // 1. Busca pedidos já filtrados por status + etiqueta (mesma lógica do fetchLogItems)
      let pedidosQuery: any = (supabase as any)
        .from('pedidos')
        .select('id, id_externo, criado_em, urgente, plataformas(id, nome, img_url)')
        .eq('status_id', LOGISTICA_STATUS_ID)
        .eq('etiqueta_envio_id', TARGET_ETIQUETA_ID);
      if (empresaId) pedidosQuery = pedidosQuery.eq('empresa_id', empresaId);

      const { data: pedidosData, error: pedidosErr } = await pedidosQuery;
      if (pedidosErr) throw pedidosErr;

      const todosPedidoIds = (pedidosData || []).map((p: any) => p.id) as string[];
      if (!todosPedidoIds.length) {
        setProdutoPedidosModal((prev) => ({ ...prev, pedidos: [], loading: false }));
        return;
      }

      // 2. Busca itens desses pedidos filtrados pelo produto/variação específico
      let itensQuery: any = (supabase as any)
        .from('itens_pedido')
        .select('pedido_id, quantidade')
        .in('pedido_id', todosPedidoIds);

      if (item.variacao_id) {
        itensQuery = itensQuery.eq('variacao_id', item.variacao_id);
      } else if (item.produto_id) {
        itensQuery = itensQuery.eq('produto_id', item.produto_id).is('variacao_id', null);
      }

      const { data: itensData, error: itensErr } = await itensQuery;
      if (itensErr) throw itensErr;

      const pedidoIdsComItem = new Set((itensData || []).map((i: any) => i.pedido_id));
      if (!pedidoIdsComItem.size) {
        setProdutoPedidosModal((prev) => ({ ...prev, pedidos: [], loading: false }));
        return;
      }

      // 3. Monta mapa de quantidades e cruza com pedidos
      const quantMap = new Map<string, number>();
      (itensData || []).forEach((i: any) => {
        quantMap.set(i.pedido_id, (quantMap.get(i.pedido_id) || 0) + Number(i.quantidade || 0));
      });

      const pedidosComQtd = (pedidosData || [])
        .filter((p: any) => pedidoIdsComItem.has(p.id))
        .map((p: any) => ({
          ...p,
          quantidade_item: quantMap.get(p.id) || 0,
        }));

      setProdutoPedidosModal((prev) => ({ ...prev, pedidos: pedidosComQtd, loading: false }));
    } catch (err) {
      console.error('Erro ao buscar pedidos do produto:', err);
      setProdutoPedidosModal((prev) => ({ ...prev, pedidos: [], loading: false }));
    }
  };

  const iniciarSequenciaPorProduto = async () => {
    if (!produtoPedidosModal.pedidos.length) {
      toast({ title: 'Sem pedidos', description: 'Nenhum pedido disponível para iniciar a sequência', variant: 'destructive' });
      return;
    }

    setLoadingPedidosFiltrados(true);
    try {
      const ids = produtoPedidosModal.pedidos.map((p: any) => p.id).filter(Boolean);
      const fullList = sortPedidos(await fetchPedidosPorIds(ids));

      setProdutoPedidosModal((prev) => ({ ...prev, open: false }));
      setOpenPlatformId(null);
      setModoListaPorPlataforma(true);
      setFilterPlataformaId('');
      setPedidosFiltrados(fullList);
      setPedidoAtualIndex(0);
      setFoundPedido(fullList[0] || null);
      setFoundItemScans({});
      setItemInputs({});
      setItemStatus({});

      setTimeout(() => barcodeRef.current?.focus(), 50);
    } catch (err) {
      console.error('Erro ao iniciar sequência por produto:', err);
      toast({ title: 'Erro', description: 'Não foi possível iniciar a sequência por produto', variant: 'destructive' });
    } finally {
      setLoadingPedidosFiltrados(false);
    }
  };

  useEffect(() => {
    // focus on mount
    setTimeout(() => barcodeRef.current?.focus(), 50);
    // buscar saldo ao carregar a página
    fetchSaldoMelhorEnvio();

    // Injetar fonte Poppins somente nesta página
    const link = document.createElement('link');
    link.id = 'poppins-font-logistica';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';
    if (!document.getElementById('poppins-font-logistica')) {
      document.head.appendChild(link);
    }
    return () => {
      document.getElementById('poppins-font-logistica')?.remove();
    };
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

  const getRequiredQty = (item: any) => Math.max(1, Number(item?.quantidade ?? 1));
  const getScannedQty = (itemId: string) => Number(foundItemScans[itemId] ?? 0);
  const isItemFullyScanned = (item: any, scans: Record<string, number> = foundItemScans) => {
    if (item?.bipado) return true;
    const required = getRequiredQty(item);
    const scanned = Number(scans[item?.id] ?? 0);
    return scanned >= required;
  };
  const getUnitKey = (itemId: string, unitIndex: number) => `${itemId}__${unitIndex}`;

  const getNextPendingUnit = (pedidoItems: any[], scans: Record<string, number>) => {
    for (const item of pedidoItems || []) {
      const required = getRequiredQty(item);
      const scanned = Number(scans[item.id] ?? 0);
      if (scanned < required) {
        return { item, unitIndex: scanned };
      }
    }
    return null;
  };

  // Classifica um pedido como comum ou incomum
  const getPedidoType = (pedido: any): 'comum' | 'incomum' => {
    const itens = pedido?.itens_pedido || [];
    if (!itens.length) return 'comum';

    const totalUnidades = itens.reduce((acc: number, it: any) => acc + Math.max(1, Number(it?.quantidade ?? 1)), 0);
    return totalUnidades > 2 ? 'incomum' : 'comum';
  };

  const getPedidoCaseItems = (pedido: any): Array<{ key: string; nome: string; quantidade: number; imgUrl: string | null }> => {
    const grouped = new Map<string, { key: string; nome: string; quantidade: number; imgUrl: string | null }>();
    (pedido?.itens_pedido || []).forEach((it: any) => {
      const refKey = String(it?.variacao_id || it?.produto_id || it?.id || 'sem-ref');
      const nomeProduto = it?.produto?.nome || '';
      const nomeVariacao = it?.variacao?.nome || '';
      const nome = nomeProduto && nomeVariacao
        ? `${nomeProduto} - ${nomeVariacao}`
        : (nomeVariacao || nomeProduto || 'Produto');
      const imgUrl = it?.variacao?.img_url || it?.produto?.img_url || null;
      const qtd = Math.max(1, Number(it?.quantidade ?? 1));
      const existing = grouped.get(refKey);
      if (existing) {
        existing.quantidade += qtd;
      } else {
        grouped.set(refKey, { key: refKey, nome, quantidade: qtd, imgUrl });
      }
    });
    return Array.from(grouped.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  };

  const getPedidoCaseSignature = (pedido: any) => {
    return getPedidoCaseItems(pedido)
      .map((item) => `${item.quantidade}x ${item.nome}`)
      .join(' | ');
  };

  const toggleSection = (key: 'produtos' | 'comuns' | 'incomuns') => {
    setOpenSections((prev) => {
      const willOpen = !prev[key];
      return {
        produtos: false,
        comuns: false,
        incomuns: false,
        [key]: willOpen,
      };
    });
  };

  // derived helpers for UI
  const items = foundPedido?.itens_pedido || [];
  const allItemsBipado = items.length > 0 && items.every((it: any) => isItemFullyScanned(it));
  const filteredLogItems = logItems;
  const normalizeProductTypeText = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const getProductCardType = (item: any) => {
    const sourceText = normalizeProductTypeText(`${item?.produto?.nome || ''} ${item?.variacao?.nome || ''}`);
    if (sourceText.includes('livraria branca')) return 'Livraria branca';
    if (sourceText.includes('livraria preta')) return 'Livraria preta';
    if (sourceText.includes('organizador')) return 'Organizador';
    return 'Outros';
  };
  
  const getProductTypeFromText = (text: string) => {
    const sourceText = normalizeProductTypeText(text);
    if (sourceText.includes('livraria branca')) return 'Livraria branca';
    if (sourceText.includes('livraria preta')) return 'Livraria preta';
    if (sourceText.includes('organizador')) return 'Organizador';
    return 'Outros';
  };

  const productCardTypePriority: Record<string, number> = {
    'Livraria branca': 1,
    'Livraria preta': 2,
    Organizador: 3,
    Outros: 99,
  };

  const groupedLogItemsByType = (() => {
    const grouped = new Map<string, any[]>();
    filteredLogItems
      .slice()
      .sort((a, b) => b.quantidade_total - a.quantidade_total)
      .forEach((item) => {
        const type = getProductCardType(item);
        const current = grouped.get(type) || [];
        current.push(item);
        grouped.set(type, current);
      });

    return Array.from(grouped.entries())
      .sort((a, b) => {
        const prioA = productCardTypePriority[a[0]] ?? 50;
        const prioB = productCardTypePriority[b[0]] ?? 50;
        if (prioA !== prioB) return prioA - prioB;
        return a[0].localeCompare(b[0], 'pt-BR');
      })
      .map(([type, items]) => ({ type, items }));
  })();
  
  const groupCaseGroupsByType = (caseGroups: any[]) => {
    const grouped = new Map<string, any[]>();
    (caseGroups || []).forEach((caseGroup: any) => {
      const type = getProductTypeFromText(caseGroup?.label || '');
      const current = grouped.get(type) || [];
      current.push(caseGroup);
      grouped.set(type, current);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => {
        const prioA = productCardTypePriority[a[0]] ?? 50;
        const prioB = productCardTypePriority[b[0]] ?? 50;
        if (prioA !== prioB) return prioA - prioB;
        return a[0].localeCompare(b[0], 'pt-BR');
      })
      .map(([type, groups]) => ({ type, groups }));
  };

  const comumCaseGroups = (() => {
    const groups = new Map<string, { signature: string; pedidos: any[]; label: string; totalUnidades: number; imgUrl: string | null }>();
    (comumPedidos || []).forEach((pedido: any) => {
      const caseItems = getPedidoCaseItems(pedido);
      const signature = getPedidoCaseSignature(pedido);
      const label = caseItems.map((it) => `${it.quantidade}x ${it.nome}`).join(' + ') || 'Caso comum';
      const totalUnidades = caseItems.reduce((acc, it) => acc + it.quantidade, 0);
      const imgUrl = caseItems[0]?.imgUrl || null;
      const existing = groups.get(signature);
      if (existing) {
        existing.pedidos.push(pedido);
      } else {
        groups.set(signature, { signature, pedidos: [pedido], label, totalUnidades, imgUrl });
      }
    });
    return Array.from(groups.values()).sort((a, b) => b.pedidos.length - a.pedidos.length);
  })();

  const incomumCaseGroups = (() => {
    const groups = new Map<string, { signature: string; pedidos: any[]; label: string; totalUnidades: number; imgUrl: string | null }>();
    (incomumPedidos || []).forEach((pedido: any) => {
      const caseItems = getPedidoCaseItems(pedido);
      const signature = getPedidoCaseSignature(pedido);
      const label = caseItems.map((it) => `${it.quantidade}x ${it.nome}`).join(' + ') || 'Caso incomum';
      const totalUnidades = caseItems.reduce((acc, it) => acc + it.quantidade, 0);
      const imgUrl = caseItems[0]?.imgUrl || null;
      const existing = groups.get(signature);
      if (existing) {
        existing.pedidos.push(pedido);
      } else {
        groups.set(signature, { signature, pedidos: [pedido], label, totalUnidades, imgUrl });
      }
    });
    return Array.from(groups.values()).sort((a, b) => b.pedidos.length - a.pedidos.length);
  })();

  const groupedComumCaseGroupsByType = groupCaseGroupsByType(comumCaseGroups);
  const groupedIncomumCaseGroupsByType = groupCaseGroupsByType(incomumCaseGroups);

  const dropdownHeaderStyles: Record<'produtos' | 'comuns' | 'incomuns', React.CSSProperties> = {
    produtos: { backgroundColor: '#0ea5e90f', borderColor: '#0284c7' },
    comuns: { backgroundColor: '#8b5cf60f', borderColor: '#8b5cf6' },
    incomuns: { backgroundColor: '#f973160f', borderColor: '#f97316' },
  };
  
  // Verifica se deve mostrar o botão da etiqueta ML
  // Prioridade: shipping_id deve ter valor (não null, não vazio)
  // Secundário: deve ser da plataforma Mercado Livre
  const shouldShowMLButton = foundPedido?.plataforma_id === MERCADO_LIVRE_PLATAFORMA_ID 
                            && foundPedido?.shipping_id 
                            && String(foundPedido.shipping_id).trim() !== '';

  const handleGerarEtiquetaML = async () => {
    if (!foundPedido?.id_externo) {
      toast({ 
        title: 'Erro', 
        description: 'O pedido não possui ID externo definido',
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
        body: JSON.stringify({ id_externo: foundPedido.id_externo }),
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
        setFoundItemScans({});
        return;
      }

      const row: any = Array.isArray(data) ? data[0] : data;

      // fetch pedido details (responsável, plataforma, itens)
      const { data: pedidoData, error: pedErr } = await supabase
        .from('pedidos')
        .select(`id,id_externo,plataforma_id,urgente,remetente_id,status_id,etiqueta_envio_id,link_etiqueta,etiquetas_uploads,responsavel:usuarios(id,nome,img_url),plataformas(id,nome,img_url), itens_pedido(id,produto_id,variacao_id,quantidade,preco_unitario,codigo_barras,pintado, produto:produtos(id,nome,sku,img_url), variacao:variacoes_produto(id,nome,sku,img_url))`)
        .eq('id', row.pedido_id)
        .single();

      if (pedErr) throw pedErr;
      const pedidoRow = pedidoData as any;

      if (pedidoRow?.etiqueta_envio_id !== ETIQUETA_DISPONIVEL_ID) {
        toast({
          title: 'Pedido fora do filtro',
          description: 'Este pedido não está com etiqueta disponível.',
          variant: 'destructive',
        });
        setFoundPedido(null);
        setFoundItemScans({});
        return;
      }

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
      
      // incrementa a quantidade escaneada do item e foca a próxima unidade pendente
      setFoundItemScans((prev) => {
        const nextScans = { ...prev };
        const itemsForFocus: any[] = pedidoRow?.itens_pedido || [];
        const targetItem = itemsForFocus.find((it: any) => it.id === row.item_pedido_id);
        if (targetItem) {
          const required = getRequiredQty(targetItem);
          const current = Number(nextScans[targetItem.id] ?? 0);
          if (current < required) nextScans[targetItem.id] = current + 1;
        }

        // clear input for next scan
        setBarcode('');

        const pending = getNextPendingUnit(itemsForFocus, nextScans);
        if (pending) {
          const start = Date.now();
          const tryFocus = () => {
            const el = itemRefs.current[getUnitKey(pending.item.id, pending.unitIndex)];
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

        return nextScans;
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

  const handleBuscarPedidoPorId = async (pedidoIdParam?: string | Event) => {
    const pedidoIdRaw = typeof pedidoIdParam === 'string' ? pedidoIdParam : pedidoIdInput;
    const pedidoId = (pedidoIdRaw ?? '').trim();
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
      const selectQuery = `id,id_externo,plataforma_id,urgente,shipping_id,remetente_id,status_id,etiqueta_envio_id,link_etiqueta,etiquetas_uploads,responsavel:usuarios(id,nome,img_url),plataformas(id,nome,img_url), itens_pedido(id,produto_id,variacao_id,quantidade,preco_unitario,codigo_barras,pintado, produto:produtos(id,nome,sku,img_url), variacao:variacoes_produto(id,nome,sku,img_url))`;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pedidoId);

      // Tentar buscar por id_externo primeiro
      let { data: pedidoData, error: pedErr } = await supabase
        .from('pedidos')
        .select(selectQuery)
        .eq('id_externo', pedidoId)
        .eq('etiqueta_envio_id', ETIQUETA_DISPONIVEL_ID)
        .maybeSingle();

      // Se não encontrou por id_externo, tenta por id
      if (!pedidoData && isUuid) {
        const res = await supabase
          .from('pedidos')
          .select(selectQuery)
          .eq('id', pedidoId)
          .eq('etiqueta_envio_id', ETIQUETA_DISPONIVEL_ID)
          .maybeSingle();
        
        pedidoData = res.data;
        pedErr = res.error;
      }

      if (pedErr) throw pedErr;

      if (!pedidoData) {
        toast({
          title: 'Pedido não permitido pelo filtro',
          description: 'O pedido não foi encontrado com etiqueta disponível. Verifique se ele está com etiqueta Disponível.',
          variant: 'destructive',
        });
        return;
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
      setFoundItemScans({});
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
      const message = String(err?.message || err || '');
      const isSyntaxUuidError =
        message.toLowerCase().includes('invalid input syntax for type uuid') ||
        message.toLowerCase().includes('erro de sintaxe') ||
        message.toLowerCase().includes('sintaxe inválida');

      toast({ 
        title: isSyntaxUuidError ? 'Pedido não permitido pelo filtro' : 'Erro ao buscar pedido', 
        description: isSyntaxUuidError
          ? 'Este identificador não pode ser usado nessa busca ou o pedido não está com etiqueta disponível.'
          : (err.message || String(err)), 
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

      const etiquetasUploads = Array.isArray((foundPedido as any)?.etiquetas_uploads)
        ? ((foundPedido as any).etiquetas_uploads as string[]).filter((url) => !!url)
        : [];

      // Atalho: pedido já tem PDF(s) de etiqueta uploadados
      if (etiquetasUploads.length > 0) {
        const pdfUrl = String(etiquetasUploads[0]);
        window.open(pdfUrl, '_blank');
        setConfirmEnvioModal({
          open: true,
          link: pdfUrl,
          pedidoId: foundPedido.id,
          pedidoIdExterno: foundPedido.id_externo ?? null,
          updatePayload: {
            status_id: ENVIADO_STATUS_ID,
            data_enviado: new Date().toISOString(),
          },
        });
        return;
      }

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
    const scansCompletos: Record<string, number> = {};
    (pedidoJaEnviado.itens_pedido || []).forEach((item: any) => {
      scansCompletos[item.id] = Math.max(1, Number(item.quantidade ?? 1));
    });
    setFoundItemScans(scansCompletos);
    
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
    <div className="flex h-full" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <LogisticaSidebar />
      <div ref={scrollContainerRef} className="flex-1 h-full overflow-y-auto">
        <div className="space-y-4 p-4">
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
                    setFoundItemScans({});
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
            <h1 className="text-lg font-bold">Logística</h1>
            <p className="text-xs text-muted-foreground">Envio de pedidos</p>
          </div>

        </div>

        <div className="mt-3">
          <div className="flex items-center gap-2">
            <div className="relative" ref={filterDropdownRef}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 bg-card rounded-[12px]"
                onClick={() => {
                  setTempFilterPlataformaId(filterPlataformaId);
                  setTempFilterProdutos(filterProdutos);
                  setProdutoSearchTerm('');
                  setProdutosList([]);
                  setShowFilters((s) => !s);
                }}
              >
                <HiFilter className="h-5 w-5" />
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
                  // Só re-foca automaticamente quando há um pedido ativo sendo processado
                  if (!foundPedido) return;
                  // if there's an active pedido with remaining un-bipado items, don't force focus back to main input
                  const items = foundPedido?.itens_pedido || [];
                  const hasMissing = items.some((it: any) => !isItemFullyScanned(it));
                  if (!hasMissing) barcodeRef.current?.focus();
                }, 0)}
                className="w-full text-base py-1.5 pl-3 pr-20 border-2 rounded-[12px] bg-white focus:outline-none focus:ring-0 focus:border-custom-600 transition-colors"
                placeholder="Pesquisar pelo ID do pedido"
                aria-label="Leitor de código"
              />
              <Button
                variant="ghost"
                onClick={() => { setFoundPedido(null); setFoundItemScans({}); setItemInputs({}); setItemStatus({}); setBarcode(''); }}
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

            {/* Seção: Produtos a Embalar */}
            <div className="mb-5">
              <button
                type="button"
                onClick={() => toggleSection('produtos')}
                className="mb-3 flex w-full items-center justify-between rounded-md border bg-card px-3 py-2 text-left hover:bg-muted/30"
                style={dropdownHeaderStyles.produtos}
              >
                <h3 className="font-semibold" style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em', textShadow: '1px 1px 2px rgba(0,0,0,0.25)' }}>PRODUTOS A EMBALAR</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {loadingLogItems ? 'Carregando...' : `${filteredLogItems.length} produto(s)`}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.produtos ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {openSections.produtos && (
                <div className="rounded-md border p-3" style={dropdownHeaderStyles.produtos}>
                  {loadingLogItems ? (
                    <div className="flex gap-2 flex-wrap">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-24 h-36 rounded-lg border bg-muted/40 animate-pulse" />
                      ))}
                    </div>
                  ) : logItemsError ? (
                    <div className="text-sm text-red-500">Erro ao carregar produtos: {logItemsError}</div>
                  ) : filteredLogItems.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum produto pendente de embalagem.</div>
                  ) : (
                    <div className="space-y-3">
                      {groupedLogItemsByType.map((group) => (
                        <div key={group.type} className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.type}</p>
                          <div className="flex flex-wrap gap-2">
                            {group.items.map((item: any, idx: number) => {
                              const nomeProduto = item.produto?.nome || '—';
                              const nomeVariacao = item.variacao?.nome || null;
                              const sku = item.variacao?.sku || item.produto?.sku || null;
                              const imgUrl = item.variacao?.img_url || item.produto?.img_url || null;

                              return (
                                <div
                                  key={`${group.type}-${item.produto_id}-${item.variacao_id}-${idx}`}
                                  className="relative flex flex-col items-center gap-1.5 rounded-lg border bg-card p-2 w-24 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                  onClick={() => fetchPedidosDoProduto({ produto_id: item.produto_id, variacao_id: item.variacao_id, nomeProduto, nomeVariacao, imgUrl })}
                                >
                                  <span className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[10px] px-1.5 py-0.5 min-w-[1.25rem] shadow">
                                    ×{item.quantidade_total}
                                  </span>

                                  {imgUrl ? (
                                    <img
                                      src={imgUrl}
                                      alt={nomeProduto}
                                      className="h-14 w-14 rounded-md object-cover border"
                                    />
                                  ) : (
                                    <div className="h-14 w-14 rounded-md border bg-muted flex items-center justify-center text-[9px] text-muted-foreground">
                                      sem foto
                                    </div>
                                  )}

                                  <p className="text-[10px] font-semibold text-center leading-tight line-clamp-2 w-full">
                                    {nomeProduto}
                                  </p>

                                  {nomeVariacao && (
                                    <p className="text-[9px] text-muted-foreground text-center leading-tight line-clamp-1 w-full -mt-0.5">
                                      {nomeVariacao}
                                    </p>
                                  )}

                                  {sku && (
                                    <span className="text-[9px] font-mono text-muted-foreground/70 truncate w-full text-center">
                                      {sku}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mb-6">
              <button
                type="button"
                onClick={() => toggleSection('comuns')}
                className="mb-3 flex w-full items-center justify-between rounded-md border bg-card px-3 py-2 text-left hover:bg-muted/30"
                style={dropdownHeaderStyles.comuns}
              >
                <h3 className="font-semibold" style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em', textShadow: '1px 1px 2px rgba(0,0,0,0.25)' }}>PACOTES COMUNS</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{comumCaseGroups.length} caso(s) comum(ns)</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.comuns ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {openSections.comuns && (
                <div className="rounded-md border p-3" style={dropdownHeaderStyles.comuns}>
                  {comumCaseGroups.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum pedido comum encontrado.</div>
                  ) : (
                    <div className="space-y-3">
                      {groupedComumCaseGroupsByType.map((group) => (
                        <div key={`comum-${group.type}`} className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.type}</p>
                          <div className="flex flex-wrap gap-2">
                            {group.groups.map((caseGroup: any) => {
                              const nomePreview = caseGroup.label;
                              const imgPreview = caseGroup.imgUrl;

                              return (
                                <div
                                  key={caseGroup.signature}
                                  className="relative flex flex-col items-center gap-1.5 rounded-lg border bg-card p-2 w-24 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                  onClick={() => {
                                    const groupedPedidos = sortPedidos(caseGroup.pedidos || []);
                                    setModoListaPorPlataforma(true);
                                    setFilterPlataformaId('');
                                    setPedidosFiltrados(groupedPedidos);
                                    setPedidoAtualIndex(0);
                                    setFoundPedido(groupedPedidos[0] || null);
                                    setFoundItemScans({});
                                    setItemInputs({});
                                    setItemStatus({});
                                    setTimeout(() => barcodeRef.current?.focus(), 50);
                                  }}
                                >
                                  <span className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[10px] px-1.5 py-0.5 min-w-[1.25rem] shadow">
                                    ×{caseGroup.pedidos.length}
                                  </span>

                                  {imgPreview ? (
                                    <img
                                      src={imgPreview}
                                      alt={nomePreview}
                                      className="h-14 w-14 rounded-md object-cover border"
                                    />
                                  ) : (
                                    <div className="h-14 w-14 rounded-md border bg-muted flex items-center justify-center text-[9px] text-muted-foreground">
                                      sem foto
                                    </div>
                                  )}

                                  <p className="text-[10px] font-semibold text-center leading-tight line-clamp-2 w-full">
                                    {nomePreview}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground text-center leading-tight line-clamp-2 w-full">
                                    {caseGroup.pedidos.length} pedido(s) • {caseGroup.totalUnidades} unid.
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => toggleSection('incomuns')}
                className="mb-3 flex w-full items-center justify-between rounded-md border bg-card px-3 py-2 text-left hover:bg-muted/30"
                style={dropdownHeaderStyles.incomuns}
              >
                <h3 className="font-semibold" style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em', textShadow: '1px 1px 2px rgba(0,0,0,0.25)' }}>PACOTES INCOMUNS</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{incomumCaseGroups.length} caso(s) incomum(ns)</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.incomuns ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {openSections.incomuns && (
                <div className="rounded-md border p-3" style={dropdownHeaderStyles.incomuns}>
                  {incomumCaseGroups.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum pedido incomum encontrado.</div>
                  ) : (
                    <div className="space-y-3">
                      {groupedIncomumCaseGroupsByType.map((group) => (
                        <div key={`incomum-${group.type}`} className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.type}</p>
                          <div className="flex flex-wrap gap-2">
                            {group.groups.map((caseGroup: any) => {
                              const nomePreview = caseGroup.label;
                              const imgPreview = caseGroup.imgUrl;

                              return (
                                <div
                                  key={caseGroup.signature}
                                  className="relative flex flex-col items-center gap-1.5 rounded-lg border bg-card p-2 w-24 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                  onClick={() => {
                                    const groupedPedidos = sortPedidos(caseGroup.pedidos || []);
                                    setModoListaPorPlataforma(true);
                                    setFilterPlataformaId('');
                                    setPedidosFiltrados(groupedPedidos);
                                    setPedidoAtualIndex(0);
                                    setFoundPedido(groupedPedidos[0] || null);
                                    setFoundItemScans({});
                                    setItemInputs({});
                                    setItemStatus({});
                                    setTimeout(() => barcodeRef.current?.focus(), 50);
                                  }}
                                >
                                  <span className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[10px] px-1.5 py-0.5 min-w-[1.25rem] shadow">
                                    ×{caseGroup.pedidos.length}
                                  </span>

                                  {imgPreview ? (
                                    <img
                                      src={imgPreview}
                                      alt={nomePreview}
                                      className="h-14 w-14 rounded-md object-cover border"
                                    />
                                  ) : (
                                    <div className="h-14 w-14 rounded-md border bg-muted flex items-center justify-center text-[9px] text-muted-foreground">
                                      sem foto
                                    </div>
                                  )}

                                  <p className="text-[10px] font-semibold text-center leading-tight line-clamp-2 w-full">
                                    {nomePreview}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground text-center leading-tight line-clamp-2 w-full">
                                    {caseGroup.pedidos.length} pedido(s) • {caseGroup.totalUnidades} unid.
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold" style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em' }}>ITENS A ENVIAR</h3>
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
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${plataformasCards.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3 w-full mx-auto items-start`}>
                  {plataformasCards.map((pc, idx) => {
                    const currentPage = platformPage[pc.id] ?? 1;
                    const totalPages = Math.max(1, Math.ceil((pc.pedidos?.length ?? 0) / PLATFORM_PAGE_SIZE));
                    const sliceStart = (currentPage - 1) * PLATFORM_PAGE_SIZE;
                    const pedidosPagina = (pc.pedidos || []).slice(sliceStart, sliceStart + PLATFORM_PAGE_SIZE);
                    const cardDropdownKey = `${pc.id || 'sem-id'}-${idx}`;

                    const handleGoToPage = (e: React.MouseEvent, page: number) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (page < 1 || page > totalPages) return;
                      setPlatformPage((s) => ({ ...s, [pc.id]: page }));
                    };

                    const isSyntheticCard = pc.id === 'urgentes' || pc.id === 'leads';

                    return (
                    <Card
                      key={pc.id}
                      className="p-3 cursor-pointer select-none self-start"
                      onClick={async (e) => {
                        e.preventDefault();
                        const next = openPlatformId === cardDropdownKey ? null : cardDropdownKey;
                        setOpenPlatformId(next);
                        if (next) {
                          setPlatformPage((s) => ({ ...s, [pc.id]: 1 }));
                          try {
                            const ids = (pc.pedidos || []).map((x: any) => x.id).filter(Boolean);
                            if (ids.length > 0) await fetchItemsForPedidoIds(ids);
                          } catch (err) { console.error(err); }
                        }
                      }}
                    >
                      <CardContent className="flex items-center gap-3 p-0">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center flex-shrink-0">
                          {pc.img_url ? (
                            <img src={pc.img_url} alt={pc.nome} className="w-7 h-7 object-cover" />
                          ) : pc.id === 'urgentes' ? (
                            <TriangleAlert className="w-4 h-4 text-red-500" />
                          ) : pc.id === 'leads' ? (
                            <Users className="w-4 h-4 text-gray-600" />
                          ) : (
                            <FaBoxesStacked className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{pc.nome}</div>
                          <div className="text-xs text-muted-foreground">{pc.count} pedido(s)</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={async (e) => {
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
                                  setFoundItemScans({});
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
                            }}
                          >
                            Enviar
                          </Button>
                          <div className="p-1.5" aria-hidden>
                            <ChevronDown className={`h-4 w-4 transition-transform ${openPlatformId === cardDropdownKey ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </CardContent>

                      {openPlatformId === cardDropdownKey && (
                        <div className="p-2 border-t" onClick={(e) => e.stopPropagation()}>
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
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-sm truncate max-w-[10rem]">{p.id_externo || p.id}</span>
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
                                            try {
                                              const ids = (pc.pedidos || []).map((x: any) => x.id).filter(Boolean);
                                              const fullList = sortPedidos(await fetchPedidosPorIds(ids));
                                              const startIdx = Math.max(0, fullList.findIndex((x: any) => x.id === p.id));
                                              setModoListaPorPlataforma(true);
                                              setFilterPlataformaId('');
                                              setPedidosFiltrados(fullList);
                                              setPedidoAtualIndex(startIdx);
                                              setFoundPedido(fullList[startIdx] || null);
                                              setFoundItemScans({});
                                              setItemInputs({});
                                              setItemStatus({});
                                              setTimeout(() => barcodeRef.current?.focus(), 50);
                                            } catch (err) {
                                              console.error('Erro ao buscar pedidos do card:', err);
                                            }
                                          } else {
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
                      const expandedItems = items.flatMap((it: any) => {
                        const qty = Math.max(1, Number(it.quantidade ?? 1));
                        return Array.from({ length: qty }, (_, idx) => ({
                          ...it,
                          __unitIndex: idx,
                          __unitKey: getUnitKey(it.id, idx),
                        }));
                      });

                      console.log('Logística - Items with pintado:', items.map((it: any) => ({ 
                        nome: it.produto?.nome, 
                        pintado: it.pintado,
                        item: it 
                      })));
                      
                      // Renderizar itens expandidos por quantidade (1 linha por unidade)
                      return expandedItems.map((it: any) => {
                        const unitKey = it.__unitKey as string;
                        const unitIndex = it.__unitIndex as number;
                        const scannedQty = getScannedQty(it.id);
                        const isUnitScanned = unitIndex < scannedQty;
                        return (
                          <div key={unitKey}>
                            <div className={`relative border rounded p-3 flex items-center justify-between ${isUnitScanned ? 'border-red-500' : 'border-gray-200'}`}>
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
                          <div className="text-sm">Unid: {unitIndex + 1}/{getRequiredQty(it)}</div>
                          {isUnitScanned ? (
                            <div className="px-3 py-1 border border-red-500 rounded text-sm font-medium text-red-700">{it.codigo_barras}</div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                ref={(el) => (itemRefs.current[unitKey] = el)}
                                className={`border rounded px-2 py-1 text-sm ${itemStatus[unitKey] === 'success' ? 'border-green-600' : ''} ${itemStatus[unitKey] === 'error' ? 'border-red-600' : ''}`}
                                placeholder="Código"
                                value={itemInputs[unitKey] || ''}
                                onChange={(e) => setItemInputs(prev => ({ ...prev, [unitKey]: e.target.value }))}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = (itemInputs[unitKey] || '').trim();
                                    if (!val) return;

                                    // immediate local comparison
                                    if (val === it.codigo_barras) {
                                      // success UI
                                      setItemStatus(prev => ({ ...prev, [unitKey]: 'success' }));
                                      setFoundItemScans((prev) => {
                                        const next = { ...prev };
                                        const required = getRequiredQty(it);
                                        const current = Number(next[it.id] ?? 0);
                                        if (current < required) next[it.id] = current + 1;

                                        const pedidoItems = foundPedido?.itens_pedido || [];
                                        const pending = getNextPendingUnit(pedidoItems, next);
                                        if (pending) {
                                          setTimeout(() => itemRefs.current[getUnitKey(pending.item.id, pending.unitIndex)]?.focus(), 0);
                                        }
                                        return next;
                                      });
                                      setItemInputs(prev => ({ ...prev, [unitKey]: '' }));

                                      // Todos os itens bipados -> botão de imprimir será habilitado
                                    } else {
                                      // error UI: clear the input but keep focus so the user can bip again
                                      setItemStatus(prev => ({ ...prev, [unitKey]: 'error' }));
                                      setItemInputs(prev => ({ ...prev, [unitKey]: '' }));
                                      // ensure focus stays on this input for immediate re-scan
                                      setTimeout(() => itemRefs.current[unitKey]?.focus(), 0);
                                      setTimeout(() => setItemStatus(prev => ({ ...prev, [unitKey]: 'idle' })), 2000);
                                    }
                                  }
                                }}
                              />
                              {itemStatus[unitKey] === 'success' && (
                                <CheckCircle className="text-green-600" />
                              )}
                              {itemStatus[unitKey] === 'error' && (
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
            <Button onClick={() => void handleBuscarPedidoPorId()} disabled={loadingPedidoManual}>
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

      {/* Modal: Pedidos do Produto */}
      <Dialog open={produtoPedidosModal.open} onOpenChange={(open) => { if (!open) setProdutoPedidosModal((prev) => ({ ...prev, open: false })); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-3">
                {produtoPedidosModal.item?.imgUrl ? (
                  <img src={produtoPedidosModal.item.imgUrl} alt="" className="h-10 w-10 rounded-lg object-cover border flex-shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-lg border bg-muted flex-shrink-0" />
                )}
                <div className="leading-tight">
                  <div className="text-base font-semibold">{produtoPedidosModal.item?.nomeProduto}</div>
                  {produtoPedidosModal.item?.nomeVariacao && (
                    <div className="text-sm font-normal text-muted-foreground">{produtoPedidosModal.item.nomeVariacao}</div>
                  )}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            {produtoPedidosModal.loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : produtoPedidosModal.pedidos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido encontrado para este produto.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                <p className="text-xs text-muted-foreground mb-3">{produtoPedidosModal.pedidos.length} pedido(s) com este produto</p>
                {produtoPedidosModal.pedidos.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {p.plataformas?.img_url ? (
                        <img src={p.plataformas.img_url} alt={p.plataformas.nome} className="h-6 w-6 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-6 w-6 rounded bg-muted flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-medium truncate max-w-[10rem]">{p.id_externo || p.id}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyPedidoId(p.id_externo || p.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Copiar ID"
                          >
                            {copiedPedidoId === (p.id_externo || p.id) ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {p.plataformas?.nome && (
                          <div className="text-[10px] text-muted-foreground">{p.plataformas.nome}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.urgente && (
                        <span className="text-[10px] font-semibold text-red-500 uppercase">Urgente</span>
                      )}
                      <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs px-2 py-0.5 min-w-[1.5rem]">
                        ×{p.quantidade_item}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            {produtoPedidosModal.pedidos.length > 0 && !produtoPedidosModal.loading && (
              <Button onClick={() => void iniciarSequenciaPorProduto()}>
                Iniciar sequência por produto
              </Button>
            )}
            <Button variant="outline" onClick={() => setProdutoPedidosModal((prev) => ({ ...prev, open: false }))}>
              Fechar
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
