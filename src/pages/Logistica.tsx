import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Truck, CheckCircle, Clock, XCircle, RefreshCw, X, ChevronLeft, ChevronRight, ChevronDown, Users, TriangleAlert, Copy, Check, Package, PackageCheck, Eclipse } from 'lucide-react';
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

  // Estados para painel de enviados por card (Etapa 3)
  const [openEnviadosId, setOpenEnviadosId] = useState<string | null>(null);
  const [atrasadosModalOpen, setAtrasadosModalOpen] = useState(false);
  const [enviadosContagem, setEnviadosContagem] = useState<Record<string, number>>({});
  const [pedidosEnviadosCache, setPedidosEnviadosCache] = useState<Record<string, any[]>>({});
  const [loadingEnviados, setLoadingEnviados] = useState<string | null>(null);

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

  const fetchAtrasados = async () => {
    if (!empresaId) return;
    setLoadingAtrasados(true);
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const { data, error } = await (supabase as any)
        .from('pedidos')
        .select('id,id_externo,data_logistica_urgente,plataformas(id,nome,img_url),itens_pedido(id,quantidade,produto:produtos(id,nome,img_url),variacao:variacoes_produto(id,nome,img_url))')
        .eq('empresa_id', empresaId)
        .neq('status_id', ENVIADO_STATUS_ID)
        .not('data_logistica_urgente', 'is', null)
        .lt('data_logistica_urgente', now.toISOString());
      if (error) throw error;
      setAtrasados(data || []);
    } catch (err) {
      console.error('Erro ao buscar atrasados:', err);
    } finally {
      setLoadingAtrasados(false);
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
  const [enviadosPage, setEnviadosPage] = useState<Record<string, number>>({});
  const [comumPedidos, setComumPedidos] = useState<any[]>([]);
  const [incomumPedidos, setIncomumPedidos] = useState<any[]>([]);

  // Modal de dar entrada no pacote
  type EntradaPacoteModal = {
    open: boolean;
    caseGroup: { signature: string; pedidos: any[]; label: string; totalUnidades: number; imgUrl: string | null } | null;
    loading: boolean;
  };
  const [entradaPacoteModal, setEntradaPacoteModal] = useState<EntradaPacoteModal>({ open: false, caseGroup: null, loading: false });
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
  const [logisticaMainTab, setLogisticaMainTab] = useState<'itens-produzir' | 'pacotes' | 'enviar'>('itens-produzir');
  const [pacotesSubTab, setPacotesSubTab] = useState<'comuns' | 'incomuns'>('comuns');
  const [pacotesDisponivelTab, setPacotesDisponivelTab] = useState<'disponivel' | 'parcial' | 'indisponivel'>('disponivel');
  const [produzidosPorGrupo, setProduzidosPorGrupo] = useState<Record<string, Record<string, number>>>({});
  const [itemProduzidoFlash, setItemProduzidoFlash] = useState<string | null>(null);
  const [salvandoBaixaCategoria, setSalvandoBaixaCategoria] = useState(false);
  const [produtoInputQty, setProdutoInputQty] = useState<Record<string, string>>({});
  const [atrasados, setAtrasados] = useState<any[]>([]);
  const [loadingAtrasados, setLoadingAtrasados] = useState(false);
  const [pacotesLiberados, setPacotesLiberados] = useState<any[]>([]);
  const [loadingPacotesLiberados, setLoadingPacotesLiberados] = useState(false);
  const [pacotesLiberadosModalOpen, setPacotesLiberadosModalOpen] = useState(false);
  const [baixaCategoriaModal, setBaixaCategoriaModal] = useState<{ open: boolean; groupId: string | null; itemKey: string; quantidade: string }>({
    open: false,
    groupId: null,
    itemKey: '',
    quantidade: '1',
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

  // Ordena para envio: pacote disponível primeiro, depois ordem padrão
  const sortPedidosEnvio = (pedidos: any[]): any[] => {
    const disponiveis = sortPedidos(pedidos.filter((p: any) => p.pacote_disponivel === true));
    const restantes   = sortPedidos(pedidos.filter((p: any) => p.pacote_disponivel !== true));
    return [...disponiveis, ...restantes];
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
      let rows: Array<{ produto_id: string | null; variacao_id: string | null; quantidade_total: number; quantidade_embalada: number }> = [];

      const TARGET_ETIQUETA_ID = '466958dd-e525-4e8d-95f1-067124a5ea7f';

      if (filterPlataformaId) {
        const { data: pedidosData, error: pedidosError } = await (supabase as any)
          .from('pedidos')
          .select('id, status_id, plataforma_id, itens_pedido(produto_id, variacao_id, quantidade, embalado)')
          .eq('plataforma_id', filterPlataformaId)
          .eq('status_id', LOGISTICA_STATUS_ID)
          .eq('etiqueta_envio_id', TARGET_ETIQUETA_ID);

        if (pedidosError) throw pedidosError;

        const aggregate = new Map<string, { produto_id: string | null; variacao_id: string | null; quantidade_total: number; quantidade_embalada: number }>();
        const pedidos = (pedidosData ?? []) as Array<any>;

        for (const pedido of pedidos) {
          const itens = (pedido?.itens_pedido ?? []) as Array<{ produto_id: string | null; variacao_id: string | null; quantidade: number | null; embalado: boolean | null }>;
          for (const item of itens) {
            const key = `${item.produto_id ?? 'p'}-${item.variacao_id ?? 'v'}`;
            const quantidade = Number(item.quantidade ?? 0);
            const quantidadeEmbalada = item.embalado ? quantidade : 0;
            const existing = aggregate.get(key);
            if (existing) {
              existing.quantidade_total += quantidade;
              existing.quantidade_embalada += quantidadeEmbalada;
            } else {
              aggregate.set(key, {
                produto_id: item.produto_id ?? null,
                variacao_id: item.variacao_id ?? null,
                quantidade_total: quantidade,
                quantidade_embalada: quantidadeEmbalada,
              });
            }
          }
        }

        rows = Array.from(aggregate.values());
      } else {
        // Busca pedidos com status logística E etiqueta disponível, depois agrega os itens
        let pedidosQuery = (supabase as any)
          .from('pedidos')
          .select('itens_pedido(produto_id, variacao_id, quantidade, embalado)')
          .eq('status_id', LOGISTICA_STATUS_ID)
          .eq('etiqueta_envio_id', TARGET_ETIQUETA_ID);
        if (empresaId) pedidosQuery = pedidosQuery.eq('empresa_id', empresaId);

        const { data: pedidosData, error: pedidosError } = await pedidosQuery;
        if (pedidosError) throw pedidosError;

        const aggregate = new Map<string, { produto_id: string | null; variacao_id: string | null; quantidade_total: number; quantidade_embalada: number }>();
        for (const pedido of (pedidosData ?? [])) {
          const itens = (pedido?.itens_pedido ?? []) as Array<{ produto_id: string | null; variacao_id: string | null; quantidade: number | null; embalado: boolean | null }>;
          for (const item of itens) {
            const key = `${item.produto_id ?? 'p'}-${item.variacao_id ?? 'v'}`;
            const quantidade = Number(item.quantidade ?? 0);
            const quantidadeEmbalada = item.embalado ? quantidade : 0;
            const existing = aggregate.get(key);
            if (existing) {
              existing.quantidade_total += quantidade;
              existing.quantidade_embalada += quantidadeEmbalada;
            } else {
              aggregate.set(key, {
                produto_id: item.produto_id ?? null,
                variacao_id: item.variacao_id ?? null,
                quantidade_total: quantidade,
                quantidade_embalada: quantidadeEmbalada,
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

  const FULL_PEDIDO_SELECT = `id,id_externo,plataforma_id,shipping_id,urgente,status_id,criado_em,remetente_id,link_etiqueta,etiquetas_uploads,data_logistica_urgente,pacote_disponivel,pacote_id,responsavel:usuarios(id,nome,img_url),plataformas(id,nome,img_url),itens_pedido(id,produto_id,variacao_id,quantidade,preco_unitario,codigo_barras,pintado,embalado,produto:produtos(id,nome,sku,img_url),variacao:variacoes_produto(id,nome,sku,img_url))`;

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
        .eq('etiqueta_envio_id', ETIQUETA_DISPONIVEL_ID)
        .eq('pacote_disponivel', true);

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
          await Promise.all([fetchPlataformaCards(), fetchPacotesLiberados()]);
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
        .select('id,id_externo,plataforma_id,link_etiqueta,etiqueta_envio_id,status_id,urgente,etiqueta_ml,criado_em,shipping_id,pacote_disponivel,pacote_id,itens_pedido(produto_id,variacao_id,quantidade,produto:produtos(nome),variacao:variacoes_produto(nome)),pacotes(id,rotulo,tipo,criado_em)')
        .eq('status_id', LOGISTICA_STATUS_ID)
        .eq('etiqueta_envio_id', TARGET_ETIQUETA_ID);
      if (empresaId) pedidosQuery = pedidosQuery.eq('empresa_id', empresaId);

      const { data: pedidosData, error: pedidosErr } = await pedidosQuery;
      if (pedidosErr) throw pedidosErr;
      const pedidosComEtiqueta = pedidosData || [];

      const platformMap = new Map((plataformas || []).map((p: any) => [p.id, p]));

      // identificar plataformas principais
      const yampiPlatform = (plataformas || []).find((p: any) => /yampi/i.test(p.nome));
      const mlPlatform    = (plataformas || []).find((p: any) => p.id === MERCADO_LIVRE_PLATAFORMA_ID || /mercado livre/i.test(p.nome));
      const shopeePlatform = (plataformas || []).find((p: any) => p.id === SHOPEE_PLATAFORMA_ID || /shopee/i.test(p.nome));

      // nomes de plataformas urgentes (além de Shopee / ML-organizador / urgente flag)
      const urgentPlatformNames = ['tiktok', 'magalu'];

      const isShopeePedido = (p: any) => {
        const pname = String(platformMap.get(p.plataforma_id)?.nome || '').toLowerCase();
        return p.plataforma_id === shopeePlatform?.id || p.plataforma_id === SHOPEE_PLATAFORMA_ID || pname.includes('shopee');
      };

      // Pedido ML com pelo menos 1 item "organizador"
      const isMLOrganizadorPedido = (p: any): boolean => {
        if (p.plataforma_id !== mlPlatform?.id && !(String(platformMap.get(p.plataforma_id)?.nome || '').toLowerCase().includes('mercado'))) return false;
        return (p.itens_pedido || []).some((it: any) => {
          const nome = `${it?.produto?.nome || ''} ${it?.variacao?.nome || ''}`.toLowerCase();
          return nome.includes('organizador');
        });
      };

      const urgentesPedidos = pedidosComEtiqueta.filter((p: any) => {
        const pname = String(platformMap.get(p.plataforma_id)?.nome || '').toLowerCase();
        if (isShopeePedido(p)) return true;                                         // Shopee → urgentes
        if (isMLOrganizadorPedido(p)) return true;                                  // ML organizador → urgentes
        const isUrgentPlatform = urgentPlatformNames.some((n) => pname.includes(n));
        const isMLComEtiquetaML = p.plataforma_id === mlPlatform?.id && !!p.etiqueta_ml;
        return isUrgentPlatform || isMLComEtiquetaML || !!p.urgente;
      });

      const leadsPedidos = pedidosComEtiqueta.filter((p: any) =>
        LEADS_PLATFORM_IDS.has(p.plataforma_id),
      );

      // ML: sem organizador, sem etiqueta_ml própria, sem urgente flag
      const mlPedidos = pedidosComEtiqueta.filter((p: any) =>
        p.plataforma_id === mlPlatform?.id &&
        !p.etiqueta_ml &&
        !p.urgente &&
        !isMLOrganizadorPedido(p),
      );

      const yampiPedidos = pedidosComEtiqueta.filter((p: any) =>
        p.plataforma_id === yampiPlatform?.id && !p.urgente,
      );

      // Ordem: Urgentes → Comercial → Mercado Livre → Yampi
      const cards = [
        {
          id: 'urgentes',
          nome: 'Urgentes',
          img_url: null,
          count: urgentesPedidos.length,
          pedidos: sortPedidosEnvio(urgentesPedidos),
        },
        {
          id: 'leads',
          nome: 'Comercial',
          img_url: null,
          count: leadsPedidos.length,
          pedidos: sortPedidosEnvio(leadsPedidos),
        },
        {
          id: mlPlatform?.id || MERCADO_LIVRE_PLATAFORMA_ID,
          nome: mlPlatform?.nome || 'Mercado Livre',
          img_url: mlPlatform?.img_url,
          count: mlPedidos.length,
          pedidos: sortPedidosEnvio(mlPedidos),
        },
        {
          id: yampiPlatform?.id || 'yampi-card',
          nome: yampiPlatform?.nome || 'Yampi',
          img_url: yampiPlatform?.img_url,
          count: yampiPedidos.length,
          pedidos: sortPedidosEnvio(yampiPedidos),
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

      // Busca contagem de enviados com pacote por card (apenas hoje)
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        let contagemQuery = (supabase as any)
          .from('pedidos')
          .select('urgente, plataforma_id')
          .eq('status_id', ENVIADO_STATUS_ID)
          .eq('pacote_disponivel', true)
          .gte('atualizado_em', startOfToday.toISOString());
        if (empresaId) contagemQuery = contagemQuery.eq('empresa_id', empresaId);
        const { data: envData } = await contagemQuery;
        if (envData) {
          const contagem: Record<string, number> = {};
          const leadsSet = new Set(LEADS_PLATAFORMA_IDS);
          for (const p of envData) {
            // urgentes
            const isUrgente = !!p.urgente;
            const isLead = leadsSet.has(p.plataforma_id);
            if (isUrgente) contagem['urgentes'] = (contagem['urgentes'] || 0) + 1;
            if (isLead) contagem['leads'] = (contagem['leads'] || 0) + 1;
            if (!isUrgente && !isLead && p.plataforma_id)
              contagem[p.plataforma_id] = (contagem[p.plataforma_id] || 0) + 1;
          }
          setEnviadosContagem(contagem);
        }
      } catch (_) {}
    } catch (err) {
      console.error('Erro ao buscar cards por plataforma:', err);
      setPlataformasCards([]);
    } finally {
      setLoadingPlataformaCards(false);
    }
  };

  const handleDarEntradaPacote = async () => {
    const caseGroup = entradaPacoteModal.caseGroup;
    if (!caseGroup) return;
    setEntradaPacoteModal((prev) => ({ ...prev, loading: true }));
    try {
      // Libera apenas UM pedido pendente do grupo por vez
      const pedidoPendente = (caseGroup.pedidos || []).find((p: any) => !p.pacote_disponivel);
      
      if (!pedidoPendente) {
        toast({ title: 'Aviso', description: 'Todos os pedidos deste grupo já foram liberados.', variant: 'destructive' });
        setEntradaPacoteModal({ open: false, caseGroup: null, loading: false });
        return;
      }
      
      const pedidoId = pedidoPendente.id;

      // 1. Cria o registro do pacote
      const { data: novoPacote, error: pacoteError } = await (supabase as any)
        .from('pacotes')
        .insert({
          empresa_id: empresaId || null,
          rotulo: caseGroup.label,
          assinatura: caseGroup.signature,
          tipo: pacotesSubTab === 'comuns' ? 'comum' : 'incomum',
        })
        .select('id')
        .single();

      if (pacoteError) throw pacoteError;

      const pacoteId = novoPacote.id;

      // 2. Vincula o pacote ao pedido e marca como disponível
      const { error } = await (supabase as any)
        .from('pedidos')
        .update({ pacote_disponivel: true, pacote_id: pacoteId })
        .eq('id', pedidoId);
        
      if (error) throw error;
      
      // Atualiza localmente
      setComumPedidos((prev) =>
        prev.map((p: any) => p.id === pedidoId ? { ...p, pacote_disponivel: true, pacote_id: pacoteId } : p),
      );
      setIncomumPedidos((prev) =>
        prev.map((p: any) => p.id === pedidoId ? { ...p, pacote_disponivel: true, pacote_id: pacoteId } : p),
      );
      // Atualiza também os cards da aba Enviar
      setPlataformasCards((prev) =>
        prev.map((pc: any) => ({
          ...pc,
          pedidos: (pc.pedidos || []).map((p: any) =>
            p.id === pedidoId ? { ...p, pacote_disponivel: true, pacote_id: pacoteId } : p,
          ),
        })),
      );
      
      const pedidosRestantes = (caseGroup.pedidos || []).filter((p: any) => !p.pacote_disponivel && p.id !== pedidoId).length;
      const mensagemRestante = pedidosRestantes > 0 
        ? ` ${pedidosRestantes} pacote(s) do mesmo tipo ainda aguardando.` 
        : ' Último pacote deste tipo liberado!';
      
      toast({ title: 'Entrada registrada!', description: `Pacote "${caseGroup.label}" marcado como disponível.${mensagemRestante}` });
      setEntradaPacoteModal({ open: false, caseGroup: null, loading: false });
      fetchPacotesLiberados();
    } catch (err) {
      console.error('Erro ao dar entrada no pacote:', err);
      toast({ title: 'Erro', description: 'Não foi possível registrar a entrada do pacote.', variant: 'destructive' });
      setEntradaPacoteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Busca pacotes já liberados (vinculados a pedidos) da tabela pacotes
  const fetchPacotesLiberados = async () => {
    setLoadingPacotesLiberados(true);
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      let query = (supabase as any)
        .from('pacotes')
        .select('id, rotulo, assinatura, tipo, criado_em, pedidos:pedidos(id, id_externo, status_id, plataforma_id, plataformas(id, nome, img_url))')
        .gte('criado_em', startOfToday.toISOString())
        .order('criado_em', { ascending: false })
        .limit(100);

      if (empresaId) query = query.eq('empresa_id', empresaId);

      const { data, error } = await query;
      if (error) throw error;
      setPacotesLiberados(data || []);
    } catch (err) {
      console.error('Erro ao buscar pacotes liberados:', err);
    } finally {
      setLoadingPacotesLiberados(false);
    }
  };

  // Busca pedidos com status enviado e pacote_disponivel=true para um card da Etapa 3
  const LEADS_PLATAFORMA_IDS = [
    '0e27f292-924c-4ffc-a141-bbe00ec00428',
    'c85e1fc7-b03e-48a2-92ec-9123dcb3dd4f',
    'd83fff08-7ac4-4a15-9e6d-0a9247b24fe4',
  ];

  const fetchPedidosEnviados = async (cardKey: string, pc: any) => {
    setLoadingEnviados(cardKey);
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      let query = (supabase as any)
        .from('pedidos')
        .select('id, id_externo, pacote_id, criado_em, atualizado_em, plataformas(id, nome, img_url), pacotes(id, rotulo, assinatura, tipo), itens_pedido(id, quantidade, produto:produtos(nome, img_url), variacao:variacoes_produto(nome, img_url))')
        .eq('status_id', ENVIADO_STATUS_ID)
        .eq('pacote_disponivel', true)
        .gte('atualizado_em', startOfToday.toISOString())
        .order('atualizado_em', { ascending: false })
        .limit(50);

      if (pc.id === 'urgentes') {
        query = query.eq('urgente', true);
      } else if (pc.id === 'leads') {
        query = query.in('plataforma_id', LEADS_PLATAFORMA_IDS);
      } else {
        query = query.eq('plataforma_id', pc.id);
      }

      if (empresaId) query = query.eq('empresa_id', empresaId);

      const { data, error } = await query;
      if (error) throw error;
      setPedidosEnviadosCache((prev) => ({ ...prev, [cardKey]: data || [] }));
    } catch (err) {
      console.error('Erro ao buscar pedidos enviados:', err);
    } finally {
      setLoadingEnviados(null);
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
      const fullList = sortPedidos(await fetchPedidosPorIds(ids)).filter((p: any) => p.pacote_disponivel === true);

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
    // buscar pedidos atrasados
    fetchAtrasados();

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
  // Regra: incomum quando o pedido contém mais de 1 item
  const getPedidoType = (pedido: any): 'comum' | 'incomum' => {
    const itens = pedido?.itens_pedido || [];
    if (!itens.length) return 'comum';

    const totalUnidades = itens.reduce((acc: number, it: any) => acc + Math.max(1, Number(it?.quantidade ?? 1)), 0);
    return totalUnidades > 1 ? 'incomum' : 'comum';
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

  const produtosProduzirByType = useMemo(() => groupedLogItemsByType.map((group) => {
    const groupId = `tipo-${group.type.toLowerCase().replace(/\s+/g, '-')}`;
    const produtos = (group.items || []).map((item: any, index: number) => {
      const nomeProduto = item.produto?.nome || 'Produto';
      const nomeVariacao = item.variacao?.nome || null;
      const imgUrl = item.variacao?.img_url || item.produto?.img_url || null;
      const quantidadeTotal = Number(item.quantidade_total ?? 0);
      const baseKey = `${item.produto_id ?? 'p'}-${item.variacao_id ?? 'v'}`;
      return {
        itemKey: `${baseKey}-${index}`,
        produtoId: item.produto_id ?? null,
        variacaoId: item.variacao_id ?? null,
        nomeProduto,
        nomeVariacao,
        imgUrl,
        quantidadeTotal,
        quantidadeEmbaladaInicial: Number(item.quantidade_embalada ?? 0),
      };
    });

    return {
      id: groupId,
      nome: group.type,
      produtos,
    };
  }), [logItems]);

  const isPedidoFullyEmbalado = (pedido: any): boolean => {
    const itens = pedido?.itens_pedido || [];
    if (!itens.length) return false;
    // Alterado: agora retorna true se pelo menos UM item está embalado
    return itens.some((it: any) => it?.embalado === true);
  };

  const isCaseGroupPronto = (caseGroup: any): boolean => {
    // Verifica se há itens embalados suficientes para liberar pelo menos um pacote
    // considerando os itens já consumidos pelos pacotes já liberados
    
    const pedidosPendentes = (caseGroup.pedidos || []).filter((p: any) => !p.pacote_disponivel);
    if (pedidosPendentes.length === 0) return false; // Todos já liberados
    
    // Pega os itens necessários para UM pacote (todos os pedidos do grupo têm a mesma composição)
    const caseItems = getPedidoCaseItems(pedidosPendentes[0]);
    
    // Conta quantos itens embalados disponíveis existem no total (de TODOS os pedidos do grupo)
    const itensEmbaladasDisponiveis = new Map<string, number>();
    (caseGroup.pedidos || []).forEach((pedido: any) => {
      (pedido?.itens_pedido || []).forEach((item: any) => {
        if (item?.embalado === true) {
          const refKey = String(item?.variacao_id || item?.produto_id || item?.id || 'sem-ref');
          const qtd = Math.max(1, Number(item?.quantidade ?? 1));
          itensEmbaladasDisponiveis.set(refKey, (itensEmbaladasDisponiveis.get(refKey) || 0) + qtd);
        }
      });
    });
    
    // Subtrai os itens já consumidos pelos pedidos liberados
    const pedidosLiberados = (caseGroup.pedidos || []).filter((p: any) => p.pacote_disponivel === true);
    pedidosLiberados.forEach((pedido: any) => {
      (pedido?.itens_pedido || []).forEach((item: any) => {
        const refKey = String(item?.variacao_id || item?.produto_id || item?.id || 'sem-ref');
        const qtd = Math.max(1, Number(item?.quantidade ?? 1));
        const atual = itensEmbaladasDisponiveis.get(refKey) || 0;
        itensEmbaladasDisponiveis.set(refKey, Math.max(0, atual - qtd));
      });
    });
    
    // Verifica se há itens suficientes para completar pelo menos UM pacote pendente
    return caseItems.every((caseItem) => {
      const disponiveis = itensEmbaladasDisponiveis.get(caseItem.key) || 0;
      return disponiveis >= caseItem.quantidade;
    });
  };

  // ── Contagem de slots disponíveis por caseGroup ────────────────────────
  const getCaseGroupAvailableSlotCount = (caseGroup: any): number => {
    const pedidosPendentes = (caseGroup.pedidos || []).filter((p: any) => !p.pacote_disponivel);
    if (pedidosPendentes.length === 0) return 0;
    const caseItems = getPedidoCaseItems(pedidosPendentes[0]);
    if (caseItems.length === 0) return pedidosPendentes.length;
    // Conta itens embalados disponíveis
    const itensDisponiveis = new Map<string, number>();
    (caseGroup.pedidos || []).forEach((pedido: any) => {
      (pedido?.itens_pedido || []).forEach((item: any) => {
        if (item?.embalado === true) {
          const refKey = String(item?.variacao_id || item?.produto_id || item?.id || 'sem-ref');
          const qtd = Math.max(1, Number(item?.quantidade ?? 1));
          itensDisponiveis.set(refKey, (itensDisponiveis.get(refKey) || 0) + qtd);
        }
      });
    });
    // Subtrai consumidos pelos já liberados
    (caseGroup.pedidos || []).filter((p: any) => p.pacote_disponivel === true).forEach((pedido: any) => {
      (pedido?.itens_pedido || []).forEach((item: any) => {
        const refKey = String(item?.variacao_id || item?.produto_id || item?.id || 'sem-ref');
        const qtd = Math.max(1, Number(item?.quantidade ?? 1));
        itensDisponiveis.set(refKey, Math.max(0, (itensDisponiveis.get(refKey) || 0) - qtd));
      });
    });
    // Quantos slots completos cabem
    let slots = pedidosPendentes.length;
    caseItems.forEach((caseItem) => {
      const avail = itensDisponiveis.get(caseItem.key) || 0;
      slots = Math.min(slots, Math.floor(avail / caseItem.quantidade));
    });
    return Math.max(0, Math.min(slots, pedidosPendentes.length));
  };

  // ── Info parcial de um caseGroup (tem alguns itens embalados mas não o suficiente para 1 pacote completo) ──
  const getCaseGroupPartialInfo = (caseGroup: any): { isPartial: boolean; missingItems: { nome: string; imgUrl: string | null; disponivel: number; necessario: number }[] } => {
    const pedidosPendentes = (caseGroup.pedidos || []).filter((p: any) => !p.pacote_disponivel);
    if (pedidosPendentes.length === 0) return { isPartial: false, missingItems: [] };
    const caseItems = getPedidoCaseItems(pedidosPendentes[0]);
    if (caseItems.length === 0) return { isPartial: false, missingItems: [] };
    // monta mapa de disponíveis embalados
    const itensDisp = new Map<string, number>();
    (caseGroup.pedidos || []).forEach((pedido: any) => {
      (pedido?.itens_pedido || []).forEach((item: any) => {
        if (item?.embalado === true) {
          const refKey = String(item?.variacao_id || item?.produto_id || item?.id || 'sem-ref');
          itensDisp.set(refKey, (itensDisp.get(refKey) || 0) + Math.max(1, Number(item?.quantidade ?? 1)));
        }
      });
    });
    // subtrai os já consumidos pelos liberados
    (caseGroup.pedidos || []).filter((p: any) => p.pacote_disponivel === true).forEach((pedido: any) => {
      (pedido?.itens_pedido || []).forEach((item: any) => {
        const refKey = String(item?.variacao_id || item?.produto_id || item?.id || 'sem-ref');
        itensDisp.set(refKey, Math.max(0, (itensDisp.get(refKey) || 0) - Math.max(1, Number(item?.quantidade ?? 1))));
      });
    });
    const hasAnyEmbalado = caseItems.some((ci) => (itensDisp.get(ci.key) || 0) > 0);
    const hasCompleteSlot = caseItems.every((ci) => (itensDisp.get(ci.key) || 0) >= ci.quantidade);
    if (!hasAnyEmbalado || hasCompleteSlot) return { isPartial: false, missingItems: [] };
    const missingItems = caseItems
      .filter((ci) => (itensDisp.get(ci.key) || 0) < ci.quantidade)
      .map((ci) => ({ nome: ci.nome, imgUrl: ci.imgUrl, disponivel: itensDisp.get(ci.key) || 0, necessario: ci.quantidade }));
    return { isPartial: true, missingItems };
  };

  // ── Prioridade de plataforma para ordenação dos pacotes ──────────────────
  const getPlatformPriority = (pedido: any): number => {
    if (pedido?.urgente) return 0;
    const pid = pedido?.plataforma_id || '';
    const pname = String(pedido?.plataformas?.nome || '').toLowerCase();
    if (pid === MERCADO_LIVRE_PLATAFORMA_ID || pname.includes('mercado livre') || pname.includes('mercadolivre')) return 1;
    if (pid === SHOPEE_PLATAFORMA_ID || pname.includes('shopee')) return 2;
    if (pname.includes('tiktok')) return 3;
    if (pname.includes('magalu') || pname.includes('magazine')) return 4;
    // PIX recuperado, Carrinho AB, Social / WhatsApp também são urgentes
    if (
      pid === '0e27f292-924c-4ffc-a141-bbe00ec00428' ||
      pid === 'c85e1fc7-b03e-48a2-92ec-9123dcb3dd4f' ||
      pid === 'd83fff08-7ac4-4a15-9e6d-0a9247b24fe4' ||
      pname.includes('whatsapp')
    ) return 5;
    if (pname.includes('yampi')) return 10;
    return 6;
  };

  const getCaseGroupPriority = (caseGroup: any): number =>
    Math.min(...(caseGroup.pedidos || []).map((p: any) => getPlatformPriority(p)), 99);

  // ── Status de prazo baseado em data_logistica_urgente ────────────────────
  type DeadlineStatus = 'atrasado' | 'hoje' | 'amanha' | null;

  const getDeadlineStatus = (dateStr: string | null | undefined): DeadlineStatus => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);
    const tomorrowEnd = new Date(todayStart.getTime() + 2 * 86400000 - 1);
    if (d < todayStart) return 'atrasado';
    if (d <= todayEnd) return 'hoje';
    if (d <= tomorrowEnd) return 'amanha';
    return null;
  };

  const getCaseGroupDeadlineStatus = (caseGroup: any): DeadlineStatus => {
    const statuses: DeadlineStatus[] = (caseGroup.pedidos || [])
      .map((p: any) => getDeadlineStatus(p?.data_logistica_urgente))
      .filter(Boolean);
    if (statuses.includes('atrasado')) return 'atrasado';
    if (statuses.includes('hoje')) return 'hoje';
    if (statuses.includes('amanha')) return 'amanha';
    return null;
  };

  const sortCaseGroups = (groups: any[]): any[] => {
    return [...groups].sort((a, b) => {
      const prioA = getCaseGroupPriority(a);
      const prioB = getCaseGroupPriority(b);
      if (prioA !== prioB) return prioA - prioB;
      const deadlineOrder: Record<string, number> = { atrasado: 0, hoje: 1, amanha: 2 };
      const dA = deadlineOrder[getCaseGroupDeadlineStatus(a) ?? ''] ?? 9;
      const dB = deadlineOrder[getCaseGroupDeadlineStatus(b) ?? ''] ?? 9;
      if (dA !== dB) return dA - dB;
      return b.pedidos.length - a.pedidos.length;
    });
  };

  const sortedComumCaseGroups = sortCaseGroups(comumCaseGroups);
  const sortedIncomumCaseGroups = sortCaseGroups(incomumCaseGroups);
  const groupedComumCaseGroupsByType = groupCaseGroupsByType(sortedComumCaseGroups);
  const groupedIncomumCaseGroupsByType = groupCaseGroupsByType(sortedIncomumCaseGroups);

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

  const getQuantidadeProduzida = (groupId: string, itemKey: string) => {
    return Number(produzidosPorGrupo[groupId]?.[itemKey] ?? 0);
  };

  useEffect(() => {
    setProduzidosPorGrupo((prev) => {
      const next: Record<string, Record<string, number>> = {};

      for (const group of produtosProduzirByType) {
        const currentGroup = prev[group.id] || {};
        const nextGroup: Record<string, number> = {};

        for (const produto of group.produtos) {
          const atual = Number(currentGroup[produto.itemKey] ?? 0);
          const inicial = Number(produto.quantidadeEmbaladaInicial ?? 0);
          nextGroup[produto.itemKey] = Math.max(atual, inicial);
        }

        next[group.id] = nextGroup;
      }

      return next;
    });
  }, [produtosProduzirByType]);

  const abrirBaixaCategoriaModal = (groupId: string) => {
    const group = produtosProduzirByType.find((g) => g.id === groupId);
    if (!group || !group.produtos.length) return;

    const firstDisponivel = group.produtos.find((produto: any) => {
      const produzido = getQuantidadeProduzida(groupId, produto.itemKey);
      return produzido < Number(produto.quantidadeTotal ?? 0);
    });

    const itemKeyInicial = firstDisponivel?.itemKey || group.produtos[0].itemKey;
    const totalInicial = Number((firstDisponivel || group.produtos[0]).quantidadeTotal ?? 0);
    const produzidoInicial = getQuantidadeProduzida(groupId, itemKeyInicial);
    const restanteInicial = Math.max(0, totalInicial - produzidoInicial);

    setBaixaCategoriaModal({
      open: true,
      groupId,
      itemKey: itemKeyInicial,
      quantidade: String(Math.max(1, restanteInicial > 0 ? 1 : 0)),
    });
  };

  const executarBaixaProduto = async (groupId: string, produto: any, quantidade: string, secao?: 'urgente' | 'normal') => {
    if (salvandoBaixaCategoria) return;

    const group = produtosProduzirByType.find((g) => g.id === groupId);
    if (!group || !produto) return;

    const total = Number(produto.quantidadeTotal ?? 0);
    const atual = getQuantidadeProduzida(groupId, produto.itemKey);
    const restante = Math.max(0, total - atual);
    const qtd = Number(quantidade);

    if (!Number.isInteger(qtd) || qtd <= 0) {
      toast({ title: 'Quantidade inválida', description: 'Informe uma quantidade inteira maior que zero.', variant: 'destructive' });
      return;
    }

    if (qtd > restante) {
      toast({ title: 'Quantidade acima do restante', description: `Restam ${restante} unidade(s) para este produto.`, variant: 'destructive' });
      return;
    }

    setSalvandoBaixaCategoria(true);
    try {
      const TARGET_ETIQUETA_ID = '466958dd-e525-4e8d-95f1-067124a5ea7f';

      let pedidosQuery: any = (supabase as any)
        .from('pedidos')
        .select('id')
        .eq('status_id', LOGISTICA_STATUS_ID)
        .eq('etiqueta_envio_id', TARGET_ETIQUETA_ID);

      if (empresaId) pedidosQuery = pedidosQuery.eq('empresa_id', empresaId);
      if (filterPlataformaId) pedidosQuery = pedidosQuery.eq('plataforma_id', filterPlataformaId);

      const { data: pedidosData, error: pedidosError } = await pedidosQuery;
      if (pedidosError) throw pedidosError;

      let pedidoIds = (pedidosData || []).map((p: any) => p.id).filter(Boolean);

      // Filtra pedidos pela seção (urgente/normal) priorizando a alocação correta
      if (secao) {
        const LEADS_URG_BAIXA = new Set([
          '0e27f292-924c-4ffc-a141-bbe00ec00428', // PIX
          'c85e1fc7-b03e-48a2-92ec-9123dcb3dd4f', // Carrinho AB
          'd83fff08-7ac4-4a15-9e6d-0a9247b24fe4', // Social
        ]);
        const URG_NOMES_BAIXA = ['tiktok', 'magalu', 'shopee', 'whatsapp'];
        const isUrgPedido = (p: any) => {
          const pid = String(p?.plataforma_id || '');
          const pname = String(p?.plataformas?.nome || '').toLowerCase();
          return !!p.urgente || pid === MERCADO_LIVRE_PLATAFORMA_ID || pid === SHOPEE_PLATAFORMA_ID || LEADS_URG_BAIXA.has(pid) || URG_NOMES_BAIXA.some((n) => pname.includes(n));
        };
        const todosPedidosCarregados = [...comumPedidos, ...incomumPedidos];
        const allowedIds = new Set(
          todosPedidosCarregados
            .filter(secao === 'urgente' ? isUrgPedido : (p: any) => !isUrgPedido(p))
            .map((p: any) => p.id)
            .filter(Boolean)
        );
        pedidoIds = pedidoIds.filter((id: string) => allowedIds.has(id));
      }
      if (!pedidoIds.length) {
        toast({ title: 'Nenhum pedido encontrado', description: 'Não há pedidos elegíveis para baixar embalagem.', variant: 'destructive' });
        return;
      }

      let itensQuery: any = (supabase as any)
        .from('itens_pedido')
        .select('id, pedido_id, criado_em')
        .in('pedido_id', pedidoIds)
        .or('embalado.is.null,embalado.eq.false')
        .order('criado_em', { ascending: true })
        .limit(qtd);

      if (produto.variacaoId) {
        itensQuery = itensQuery.eq('variacao_id', produto.variacaoId);
      } else if (produto.produtoId) {
        itensQuery = itensQuery.eq('produto_id', produto.produtoId).is('variacao_id', null);
      } else {
        toast({ title: 'Produto inválido', description: 'Não foi possível identificar o produto para dar baixa.', variant: 'destructive' });
        return;
      }

      const { data: itensDisponiveis, error: itensError } = await itensQuery;
      if (itensError) throw itensError;

      const idsParaAtualizar = (itensDisponiveis || []).map((it: any) => it.id).filter(Boolean);
      if (!idsParaAtualizar.length) {
        toast({ title: 'Sem itens pendentes', description: 'Todos os itens deste produto já estão marcados como embalados.' });
        return;
      }

      const { error: updateError } = await (supabase as any)
        .from('itens_pedido')
        .update({ embalado: true, atualizado_em: new Date().toISOString() } as any)
        .in('id', idsParaAtualizar);
      if (updateError) throw updateError;

      const quantidadeAtualizada = idsParaAtualizar.length;
      const itemKey = produto.itemKey;

      setProduzidosPorGrupo((prev) => {
        const groupMap = prev[groupId] || {};
        const novoValor = Math.min(total, Number(groupMap[itemKey] ?? 0) + quantidadeAtualizada);
        return { ...prev, [groupId]: { ...groupMap, [itemKey]: novoValor } };
      });

      const flashKey = `${groupId}:${itemKey}`;
      setItemProduzidoFlash(flashKey);
      setTimeout(() => setItemProduzidoFlash((curr) => (curr === flashKey ? null : curr)), 700);

      toast({
        title: quantidadeAtualizada < qtd ? 'Baixa parcial concluída' : 'Baixa concluída',
        description: quantidadeAtualizada < qtd
          ? `Foram marcados ${quantidadeAtualizada} item(ns) como embalados (solicitado: ${qtd}).`
          : `${quantidadeAtualizada} item(ns) marcados como embalados.`,
      });

      await fetchLogItems();
      await fetchPlataformaCards();
    } catch (error) {
      console.error('Erro ao dar baixa de embalagem:', error);
      toast({ title: 'Erro ao dar baixa', description: 'Não foi possível atualizar os itens na tabela itens_pedido.', variant: 'destructive' });
    } finally {
      setSalvandoBaixaCategoria(false);
    }
  };

  const confirmarBaixaCategoria = async () => {
    const { groupId, itemKey, quantidade } = baixaCategoriaModal;
    if (!groupId || !itemKey || salvandoBaixaCategoria) return;

    const group = produtosProduzirByType.find((g) => g.id === groupId);
    const produto = group?.produtos.find((p: any) => p.itemKey === itemKey);
    if (!group || !produto) return;

    const total = Number(produto.quantidadeTotal ?? 0);
    const atual = getQuantidadeProduzida(groupId, itemKey);
    const restante = Math.max(0, total - atual);
    const qtd = Number(quantidade);

    if (!Number.isInteger(qtd) || qtd <= 0) {
      toast({ title: 'Quantidade inválida', description: 'Informe uma quantidade inteira maior que zero.', variant: 'destructive' });
      return;
    }

    if (qtd > restante) {
      toast({ title: 'Quantidade acima do restante', description: `Restam ${restante} unidade(s) para este produto.`, variant: 'destructive' });
      return;
    }

    setSalvandoBaixaCategoria(true);
    try {
      const TARGET_ETIQUETA_ID = '466958dd-e525-4e8d-95f1-067124a5ea7f';

      let pedidosQuery: any = (supabase as any)
        .from('pedidos')
        .select('id')
        .eq('status_id', LOGISTICA_STATUS_ID)
        .eq('etiqueta_envio_id', TARGET_ETIQUETA_ID);

      if (empresaId) pedidosQuery = pedidosQuery.eq('empresa_id', empresaId);
      if (filterPlataformaId) pedidosQuery = pedidosQuery.eq('plataforma_id', filterPlataformaId);

      const { data: pedidosData, error: pedidosError } = await pedidosQuery;
      if (pedidosError) throw pedidosError;

      const pedidoIds = (pedidosData || []).map((p: any) => p.id).filter(Boolean);
      if (!pedidoIds.length) {
        toast({ title: 'Nenhum pedido encontrado', description: 'Não há pedidos elegíveis para baixar embalagem.', variant: 'destructive' });
        return;
      }

      let itensQuery: any = (supabase as any)
        .from('itens_pedido')
        .select('id, pedido_id, criado_em')
        .in('pedido_id', pedidoIds)
        .or('embalado.is.null,embalado.eq.false')
        .order('criado_em', { ascending: true })
        .limit(qtd);

      if (produto.variacaoId) {
        itensQuery = itensQuery.eq('variacao_id', produto.variacaoId);
      } else if (produto.produtoId) {
        itensQuery = itensQuery.eq('produto_id', produto.produtoId).is('variacao_id', null);
      } else {
        toast({ title: 'Produto inválido', description: 'Não foi possível identificar o produto para dar baixa.', variant: 'destructive' });
        return;
      }

      const { data: itensDisponiveis, error: itensError } = await itensQuery;
      if (itensError) throw itensError;

      const idsParaAtualizar = (itensDisponiveis || []).map((it: any) => it.id).filter(Boolean);
      if (!idsParaAtualizar.length) {
        toast({ title: 'Sem itens pendentes', description: 'Todos os itens deste produto já estão marcados como embalados.' });
        return;
      }

      const { error: updateError } = await (supabase as any)
        .from('itens_pedido')
        .update({ embalado: true, atualizado_em: new Date().toISOString() } as any)
        .in('id', idsParaAtualizar);
      if (updateError) throw updateError;

      const quantidadeAtualizada = idsParaAtualizar.length;

      setProduzidosPorGrupo((prev) => {
        const groupMap = prev[groupId] || {};
        const novoValor = Math.min(total, Number(groupMap[itemKey] ?? 0) + quantidadeAtualizada);
        return {
          ...prev,
          [groupId]: {
            ...groupMap,
            [itemKey]: novoValor,
          },
        };
      });

      const flashKey = `${groupId}:${itemKey}`;
      setItemProduzidoFlash(flashKey);
      setTimeout(() => {
        setItemProduzidoFlash((curr) => (curr === flashKey ? null : curr));
      }, 700);

      if (quantidadeAtualizada < qtd) {
        toast({
          title: 'Baixa parcial concluída',
          description: `Foram marcados ${quantidadeAtualizada} item(ns) como embalados (solicitado: ${qtd}).`,
        });
      } else {
        toast({
          title: 'Baixa concluída',
          description: `${quantidadeAtualizada} item(ns) marcados como embalados.`,
        });
      }

      setBaixaCategoriaModal({ open: false, groupId: null, itemKey: '', quantidade: '1' });
      await fetchLogItems();
      await fetchPlataformaCards();
    } catch (error) {
      console.error('Erro ao confirmar baixa de embalagem:', error);
      toast({
        title: 'Erro ao dar baixa',
        description: 'Não foi possível atualizar os itens na tabela itens_pedido.',
        variant: 'destructive',
      });
    } finally {
      setSalvandoBaixaCategoria(false);
    }
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
          <>
          <div className="mt-4 rounded-lg border bg-card/70 p-3">
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { key: 'itens-produzir', label: 'Itens a embalar', step: 1 },
                { key: 'pacotes', label: 'Pacotes', step: 2 },
                { key: 'enviar', label: 'Enviar', step: 3 },
              ].map((tab) => {
                const active = logisticaMainTab === (tab.key as 'itens-produzir' | 'pacotes' | 'enviar');
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setLogisticaMainTab(tab.key as 'itens-produzir' | 'pacotes' | 'enviar')}
                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${active ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-muted'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {tab.step}
                      </span>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Etapa {tab.step}</p>
                        <p className="text-sm font-semibold">{tab.label}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {logisticaMainTab === 'itens-produzir' && (
              <div>
                {atrasados.length > 0 && (() => {
                  const atrasadosIds = new Set(atrasados.map((p: any) => p.id));
                  const atrasadosPedidos = [...comumPedidos, ...incomumPedidos].filter((p: any) => atrasadosIds.has(p.id));
                  if (atrasadosPedidos.length === 0) return null;

                  // Agrupa os itens por produto+variacao
                  const itemMap = new Map<string, { nome: string; nomeVariacao: string | null; imgUrl: string | null; quantidade: number; emEtapa2: boolean; embalado: number; naoEmbalado: number }>();
                  atrasadosPedidos.forEach((pedido: any) => {
                    const jaEmEtapa2 = !!(pedido.pacote_id || pedido.pacote_disponivel);
                    (pedido.itens_pedido || []).forEach((it: any) => {
                      const key = `${it.produto_id ?? ''}-${it.variacao_id ?? ''}`;
                      const nomeProduto = it.produto?.nome || '—';
                      const nomeVariacao = it.variacao?.nome || null;
                      const imgUrl = it.variacao?.img_url || it.produto?.img_url || null;
                      const qtd = Number(it.quantidade ?? 1);
                      const isEmbalado = !!it.embalado;
                      const existing = itemMap.get(key);
                      if (existing) {
                        existing.quantidade += qtd;
                        if (jaEmEtapa2) existing.emEtapa2 = true;
                        if (isEmbalado) existing.embalado += qtd;
                        else existing.naoEmbalado += qtd;
                      } else {
                        itemMap.set(key, {
                          nome: nomeProduto,
                          nomeVariacao,
                          imgUrl,
                          quantidade: qtd,
                          emEtapa2: jaEmEtapa2,
                          embalado: isEmbalado ? qtd : 0,
                          naoEmbalado: isEmbalado ? 0 : qtd,
                        });
                      }
                    });
                  });
                  const itemsList = Array.from(itemMap.values());

                  return (
                    <div className="mb-4 rounded-lg border-2 border-red-500 bg-red-50 p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white font-bold text-xs shrink-0">{atrasadosPedidos.length}</div>
                        <h3 className="text-xs font-bold text-red-700 uppercase tracking-wide">⚠️ Itens com prazo ultrapassado — {atrasadosPedidos.length} pedido(s)</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {itemsList.map((item, idx) => {
                          const temMisto = item.embalado > 0 && item.naoEmbalado > 0;
                          const tudoEmbalado = item.embalado > 0 && item.naoEmbalado === 0;
                          return (
                            <div
                              key={idx}
                              className={`flex flex-col items-center gap-1 rounded-lg border p-2 w-[72px] shadow-sm transition-all ${
                                item.emEtapa2
                                  ? 'border-green-400 bg-green-100 opacity-60'
                                  : 'border-red-300 bg-white'
                              }`}
                            >
                              {item.imgUrl ? (
                                <img src={item.imgUrl} alt={item.nome} className="h-12 w-12 rounded object-cover border" />
                              ) : (
                                <div className="h-12 w-12 rounded border bg-muted flex items-center justify-center text-[9px] text-muted-foreground">sem foto</div>
                              )}
                              <p className="text-[10px] font-semibold text-center leading-tight line-clamp-2 w-full">{item.nome}</p>
                              {item.nomeVariacao && (
                                <p className="text-[9px] text-muted-foreground text-center leading-tight line-clamp-1 w-full">{item.nomeVariacao}</p>
                              )}
                              {temMisto ? (
                                <div className="flex flex-col items-center gap-0.5 w-full">
                                  <span className="text-[9px] font-bold text-green-700 bg-green-100 border border-green-300 rounded-full px-1.5 py-0.5 w-full text-center">✓ {item.embalado} emb.</span>
                                  <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-300 rounded-full px-1.5 py-0.5 w-full text-center">✗ {item.naoEmbalado} falt.</span>
                                </div>
                              ) : (
                                <span className={`text-[10px] font-bold ${item.emEtapa2 ? 'text-green-700' : 'text-red-700'}`}>×{item.quantidade}</span>
                              )}
                              {item.emEtapa2 && (
                                <span className="text-[8px] text-green-700 font-semibold">✓ etapa 2</span>
                              )}
                              {tudoEmbalado && !item.emEtapa2 && (
                                <span className="text-[8px] text-green-700 font-semibold bg-green-50 border border-green-200 rounded px-1">✓ embalado</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}


                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold tracking-wide">ITENS A PRODUZIR</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => fetchPlataformaCards()} className="border rounded-md px-3 py-1.5 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Atualizar
                    </Button>
                  </div>
                </div>

                {(() => {
                  const totalProdutos = produtosProduzirByType.reduce(
                    (acc, grupo) => acc + grupo.produtos.reduce((subtotal: number, produto: any) => subtotal + Number(produto.quantidadeTotal ?? 0), 0),
                    0,
                  );
                  const totalEmbalados = produtosProduzirByType.reduce((acc, grupo) => {
                    return acc + grupo.produtos.reduce((subtotal: number, produto: any) => {
                      return subtotal + getQuantidadeProduzida(grupo.id, produto.itemKey);
                    }, 0);
                  }, 0);
                  const totalFaltam = Math.max(0, totalProdutos - totalEmbalados);

                  return (
                    <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-custom-600 bg-custom-50 p-3">
                        <p className="text-xs text-custom-700 uppercase tracking-wide font-semibold">Total de produtos</p>
                        <p className="text-2xl font-bold mt-1 text-custom-800">{totalProdutos}</p>
                      </div>
                      <div className="rounded-lg border border-green-300 bg-green-50 p-3">
                        <p className="text-xs text-green-700 uppercase tracking-wide font-semibold">Já embalados</p>
                        <p className="text-2xl font-bold mt-1 text-green-700">{totalEmbalados}</p>
                      </div>
                      <div className="rounded-lg border border-red-300 bg-red-50 p-3">
                        <p className="text-xs text-red-700 uppercase tracking-wide font-semibold">Faltam embalar</p>
                        <p className="text-2xl font-bold mt-1 text-red-700">{totalFaltam}</p>
                      </div>
                    </div>
                  );
                })()}

                {produtosProduzirByType.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum produto pendente para produção.</div>
                ) : (() => {
                  // ── Divide pedidos por urgência ──────────────────────────
                  const LEADS_URG = new Set([
                    '0e27f292-924c-4ffc-a141-bbe00ec00428', // PIX
                    'c85e1fc7-b03e-48a2-92ec-9123dcb3dd4f', // Carrinho AB
                    'd83fff08-7ac4-4a15-9e6d-0a9247b24fe4', // Social
                  ]);
                  const URG_NAMES = ['tiktok', 'magalu', 'shopee', 'whatsapp'];
                  const urgQtyByKey = new Map<string, number>();
                  const normQtyByKey = new Map<string, number>();
                  for (const pedido of [...comumPedidos, ...incomumPedidos]) {
                    const pid = String(pedido?.plataforma_id || '');
                    const pname = String(pedido?.plataformas?.nome || '').toLowerCase();
                    const isUrg =
                      !!pedido.urgente ||
                      pid === MERCADO_LIVRE_PLATAFORMA_ID ||
                      pid === SHOPEE_PLATAFORMA_ID ||
                      LEADS_URG.has(pid) ||
                      URG_NAMES.some((n) => pname.includes(n));
                    const tgt = isUrg ? urgQtyByKey : normQtyByKey;
                    for (const item of (pedido.itens_pedido || [])) {
                      const k = `${item.produto_id ?? 'p'}-${item.variacao_id ?? 'v'}`;
                      tgt.set(k, (tgt.get(k) || 0) + Number(item.quantidade ?? 1));
                    }
                  }

                  // Filtra e sobrescreve quantidadeTotal com a fração da seção
                  const buildGrupos = (qtyMap: Map<string, number>) =>
                    produtosProduzirByType
                      .map((grupo) => ({
                        ...grupo,
                        produtos: grupo.produtos
                          .filter((p: any) => (qtyMap.get(`${p.produtoId ?? 'p'}-${p.variacaoId ?? 'v'}`) || 0) > 0)
                          .map((p: any) => ({
                            ...p,
                            quantidadeTotal: qtyMap.get(`${p.produtoId ?? 'p'}-${p.variacaoId ?? 'v'}`) || 0,
                          })),
                      }))
                      .filter((g) => g.produtos.length > 0);

                  // Renderizador compartilhado de cards interativos
                  const renderGrupos = (grupos: typeof produtosProduzirByType, secao: 'urgente' | 'normal') => (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 w-full mx-auto items-start">
                      {grupos.map((grupo) => {
                        const totalQuantidadeGrupo = grupo.produtos.reduce((acc: number, produto: any) => acc + Number(produto.quantidadeTotal ?? 0), 0);
                        const produzidosCount = grupo.produtos.reduce((acc: number, produto: any) => {
                          return acc + Math.min(getQuantidadeProduzida(grupo.id, produto.itemKey), Number(produto.quantidadeTotal ?? 0));
                        }, 0);
                        const faltamCount = Math.max(0, totalQuantidadeGrupo - produzidosCount);
                        const grupoConcluido = totalQuantidadeGrupo > 0 && faltamCount === 0;
                        const progressoPercent = totalQuantidadeGrupo > 0 ? Math.round((produzidosCount / totalQuantidadeGrupo) * 100) : 0;
                        const currentPage = platformPage[grupo.id] ?? 1;
                        const totalPages = Math.max(1, Math.ceil((grupo.produtos?.length ?? 0) / PLATFORM_PAGE_SIZE));
                        const sliceStart = (currentPage - 1) * PLATFORM_PAGE_SIZE;
                        const produtosPagina = (grupo.produtos || []).slice(sliceStart, sliceStart + PLATFORM_PAGE_SIZE);

                        const handleGoToPage = (e: React.MouseEvent, page: number) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (page < 1 || page > totalPages) return;
                          setPlatformPage((s) => ({ ...s, [grupo.id]: page }));
                        };

                        return (
                          <Card
                            key={grupo.id}
                            className={`p-5 select-none self-start transition-all shadow-sm ${grupoConcluido ? 'ring-1 ring-green-400 border-green-400 bg-green-100 opacity-50' : secao === 'urgente' ? 'border-2 border-red-300 bg-red-50/50 hover:shadow-md' : 'border-2 border-blue-300 bg-blue-50/50 hover:shadow-md'}`}
                          >
                            <CardContent className="flex items-center gap-3 p-0">
                              <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 ${grupoConcluido ? 'bg-green-100' : 'bg-muted'}`}>
                                <FaBoxesStacked className={`w-3.5 h-3.5 ${grupoConcluido ? 'text-green-700' : 'text-muted-foreground'}`} />
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-sm leading-tight">{grupo.nome}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{grupo.produtos.length} produto(s)</div>
                                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold">
                                  <span className="rounded-md bg-green-100 text-green-700 px-1.5 py-0.5">Embalados: {produzidosCount}</span>
                                  <span className="rounded-md bg-red-100 text-red-700 px-1.5 py-0.5">Faltam: {faltamCount}</span>
                                </div>
                              </div>
                            </CardContent>

                            <div className="mt-3">
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progressoPercent}%` }} />
                              </div>
                              <div className="mt-1 text-[11px] text-muted-foreground">Progresso: {progressoPercent}%</div>
                            </div>

                            <div className="pt-2 border-t mt-2.5">
                              {grupoConcluido && (
                                <div className="mb-2 rounded-md border border-green-300 bg-green-100 text-green-700 text-xs font-semibold px-2 py-1.5 animate-pulse">
                                  ✅ Todos os itens deste grupo foram embalados
                                </div>
                              )}

                              {totalPages > 1 && (
                                <div className="flex items-center justify-between mb-3 pb-3 border-b">
                                  <span className="text-xs text-muted-foreground">
                                    {grupo.produtos.length} produtos • {currentPage}/{totalPages}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={currentPage <= 1}
                                      onClick={(e) => handleGoToPage(e, currentPage - 1)}
                                      className="px-3 py-1 text-base border rounded disabled:opacity-40 hover:bg-muted"
                                    >
                                      ‹
                                    </button>
                                    <button
                                      type="button"
                                      disabled={currentPage >= totalPages}
                                      onClick={(e) => handleGoToPage(e, currentPage + 1)}
                                      className="px-3 py-1 text-base border rounded disabled:opacity-40 hover:bg-muted"
                                    >
                                      ›
                                    </button>
                                  </div>
                                </div>
                              )}
                              {produtosPagina.length === 0 ? (
                                <div className="text-sm text-muted-foreground">Nenhum produto disponível.</div>
                              ) : (
                                <div className="space-y-3">
                                  {produtosPagina.map((produto: any) => {
                                    const globalEmb = getQuantidadeProduzida(grupo.id, produto.itemKey);
                                    const sectionQty = Number(produto.quantidadeTotal ?? 0);
                                    const produzidoQty = Math.min(globalEmb, sectionQty);
                                    const produzido = produzidoQty >= sectionQty;
                                    const faltamItem = Math.max(0, sectionQty - produzidoQty);
                                    const flashAtivo = itemProduzidoFlash === `${grupo.id}:${produto.itemKey}`;
                                    const inlineQtyKey = `${grupo.id}:${produto.itemKey}`;

                                    return (
                                      <div key={produto.itemKey} className={`rounded-md border px-3 py-3 transition-all ${flashAtivo ? 'bg-green-100 border-green-500 animate-pulse' : produzido ? 'bg-green-50/40 border-green-200 opacity-35' : 'border-red-200 bg-red-50/30'}`}>
                                        <div className="flex items-start gap-3">
                                          {produto.imgUrl ? (
                                            <img src={produto.imgUrl} alt={produto.nomeProduto} className="h-10 w-10 rounded object-cover border flex-shrink-0" />
                                          ) : (
                                            <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center text-[9px] text-muted-foreground flex-shrink-0">sem foto</div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <span className="text-xs font-semibold block leading-tight">{produto.nomeProduto}</span>
                                            {produto.nomeVariacao && (
                                              <span className="text-[11px] text-muted-foreground block">{produto.nomeVariacao}</span>
                                            )}
                                            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${produzido ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                Emb.: {produzidoQty}/{sectionQty}
                                              </span>
                                              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${produzido ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {produzido ? 'EMBALADO' : `FALTAM ${faltamItem}`}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        {!produzido && (
                                          <div className="mt-2.5">
                                            <input
                                              type="number"
                                              min="1"
                                              max={faltamItem}
                                              value={produtoInputQty[inlineQtyKey] ?? ''}
                                              onChange={(e) => setProdutoInputQty((prev) => ({ ...prev, [inlineQtyKey]: e.target.value }))}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  const qty = produtoInputQty[inlineQtyKey]?.trim() || '1';
                                                  executarBaixaProduto(grupo.id, produto, qty, secao);
                                                  setProdutoInputQty((prev) => ({ ...prev, [inlineQtyKey]: '' }));
                                                }
                                              }}
                                              placeholder={`Qtd (máx ${faltamItem}) → Enter`}
                                              disabled={salvandoBaixaCategoria}
                                              className="w-full text-xs border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:opacity-50"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  );

                  const urgGrupos = buildGrupos(urgQtyByKey);
                  const normGrupos = buildGrupos(normQtyByKey);

                  return (
                    <div className="space-y-8">
                      {/* ───── URGENTES ───── */}
                      {urgGrupos.length > 0 && (
                        <div className="rounded-xl border-2 border-red-300 bg-red-50/60 p-4">
                          <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-red-400">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-bold shrink-0">!</span>
                            <h4 className="text-sm font-bold uppercase tracking-wide text-red-700">Urgentes</h4>
                            <span className="text-[11px] text-red-400">ML · Shopee · TikTok · Magalu · PIX · Carrinho · Social</span>
                          </div>
                          {renderGrupos(urgGrupos, 'urgente')}
                        </div>
                      )}
                      {/* ───── NORMAIS ───── */}
                      {normGrupos.length > 0 && (
                        <div className="rounded-xl border-2 border-blue-300 bg-blue-50/60 p-4">
                          <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-blue-300">
                            <FaBoxesStacked className="h-4 w-4 text-blue-500" />
                            <h4 className="text-sm font-bold uppercase tracking-wide text-blue-700">Normais</h4>
                            <span className="text-[11px] text-blue-400">Yampi e outros</span>
                          </div>
                          {renderGrupos(normGrupos, 'normal')}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {logisticaMainTab === 'pacotes' && (
              <>
                {(() => {
                  const overdueCaseGroups = [
                    ...sortedComumCaseGroups.filter((cg: any) => getCaseGroupDeadlineStatus(cg) === 'atrasado'),
                    ...sortedIncomumCaseGroups.filter((cg: any) => getCaseGroupDeadlineStatus(cg) === 'atrasado'),
                  ];
                  if (!overdueCaseGroups.length) return null;
                  return (
                    <div className="mb-4 rounded-lg border-2 border-red-500 bg-red-50 p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white font-bold text-xs shrink-0">{overdueCaseGroups.length}</div>
                        <h3 className="text-xs font-bold text-red-700 uppercase tracking-wide">⚠️ Pacotes com prazo ultrapassado</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {overdueCaseGroups.map((caseGroup: any) => {
                          const pronto = isCaseGroupPronto(caseGroup);
                          const temUrgente = (caseGroup.pedidos as any[]).some((p: any) => p.urgente);
                          const totalPedidos = (caseGroup.pedidos as any[]).length;
                          const liberados = (caseGroup.pedidos as any[]).filter((p: any) => p.pacote_disponivel).length;
                          const naoLiberados = totalPedidos - liberados;
                          const todoLiberado = liberados === totalPedidos;
                          const parcialLiberado = liberados > 0 && naoLiberados > 0;
                          return (
                            <div
                              key={caseGroup.signature}
                              className={`relative flex flex-col items-center gap-1 rounded-lg border-2 p-2 w-24 shadow-sm transition-shadow cursor-pointer hover:shadow-md ${
                                todoLiberado
                                  ? 'border-green-500 bg-green-100 opacity-60'
                                  : parcialLiberado
                                  ? 'border-amber-400 bg-amber-50'
                                  : pronto
                                  ? 'border-red-400 bg-white'
                                  : 'border-red-400 bg-white opacity-60 cursor-not-allowed'
                              }`}
                              onClick={() => {
                                if (!pronto) return;
                                setEntradaPacoteModal({ open: true, caseGroup, loading: false });
                              }}
                            >
                              {/* badge topo-direito */}
                              {!todoLiberado && (
                                <span className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center justify-center rounded-full bg-red-600 text-white font-bold text-[10px] px-1.5 py-0.5 min-w-[1.25rem] shadow">
                                  ×{naoLiberados}
                                </span>
                              )}
                              {todoLiberado && (
                                <span className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center justify-center rounded-full bg-green-600 text-white font-bold text-[10px] px-1.5 py-0.5 min-w-[1.25rem] shadow">
                                  ✓
                                </span>
                              )}
                              {caseGroup.imgUrl ? (
                                <img src={caseGroup.imgUrl} alt={caseGroup.label} className="h-12 w-12 rounded-md object-cover border" />
                              ) : (
                                <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center text-[9px] text-muted-foreground">sem foto</div>
                              )}
                              <p className="text-[10px] font-semibold text-center leading-tight line-clamp-2 w-full">{caseGroup.label}</p>
                              <div className="flex flex-wrap justify-center gap-0.5 w-full">
                                {temUrgente && <span className="text-[8px] font-bold bg-purple-600 text-white rounded px-1 py-0.5">URGENTE</span>}
                                <span className="text-[8px] font-bold bg-red-600 text-white rounded px-1 py-0.5">ATRASADO</span>
                              </div>
                              {parcialLiberado && (
                                <div className="flex flex-col items-center gap-0.5 w-full mt-0.5">
                                  <span className="text-[9px] font-bold text-green-700 bg-green-100 border border-green-300 rounded-full px-1.5 py-0.5 w-full text-center">✓ {liberados} lib.</span>
                                  <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-300 rounded-full px-1.5 py-0.5 w-full text-center">✗ {naoLiberados} falt.</span>
                                </div>
                              )}
                              {todoLiberado && <span className="text-[8px] text-green-700 font-semibold">✓ liberado</span>}
                              {!pronto && !todoLiberado && <p className="text-[8px] text-red-600 font-semibold text-center w-full">Insuficientes embalados</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={pacotesSubTab === 'comuns' ? 'default' : 'outline'}
                      onClick={() => { setPacotesSubTab('comuns'); if (pacotesDisponivelTab === 'parcial') setPacotesDisponivelTab('disponivel'); }}
                    >
                      Comuns
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={pacotesSubTab === 'incomuns' ? 'default' : 'outline'}
                      onClick={() => setPacotesSubTab('incomuns')}
                    >
                      Incomuns
                    </Button>
                  </div>
                </div>
                {/* Tab disponíveis / parcial / indisponíveis */}
                <div className="mb-4 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={pacotesDisponivelTab === 'disponivel' ? 'default' : 'outline'}
                    className={pacotesDisponivelTab === 'disponivel' ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' : 'text-green-700 border-green-600 hover:bg-green-50'}
                    onClick={() => setPacotesDisponivelTab('disponivel')}
                  >
                    ✓ Disponíveis
                  </Button>
                  {pacotesSubTab === 'incomuns' && (
                  <Button
                    type="button"
                    size="sm"
                    variant={pacotesDisponivelTab === 'parcial' ? 'default' : 'outline'}
                    className={pacotesDisponivelTab === 'parcial' ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' : 'text-amber-600 border-amber-500 hover:bg-amber-50'}
                    onClick={() => setPacotesDisponivelTab('parcial')}
                  >
                     <Eclipse className="h-3 w-3 text-amber-600 shrink-0" />
                     Parcial
                  </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant={pacotesDisponivelTab === 'indisponivel' ? 'default' : 'outline'}
                    className={pacotesDisponivelTab === 'indisponivel' ? 'bg-red-600 hover:bg-red-700 text-white border-red-600' : 'text-red-700 border-red-600 hover:bg-red-50'}
                    onClick={() => setPacotesDisponivelTab('indisponivel')}
                  >
                    ✕ Indisponíveis
                  </Button>
                </div>

                {pacotesSubTab === 'comuns' && (
                  <div className="mb-6">
                    <div className="rounded-md border p-3" style={dropdownHeaderStyles.comuns}>
                      {comumCaseGroups.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                          <span className="text-3xl">📦</span>
                          <p className="text-sm font-medium text-muted-foreground">Nenhum pedido comum encontrado.</p>
                        </div>
                      ) : (() => {
                        const comumFilter = (cg: any) => {
                          const avail = getCaseGroupAvailableSlotCount(cg);
                          const pend = (cg.pedidos || []).filter((p: any) => !p.pacote_disponivel).length;
                          if (pacotesDisponivelTab === 'disponivel') return avail > 0;
                          if (pacotesDisponivelTab === 'parcial') return avail === 0 && pend > 0 && getCaseGroupPartialInfo(cg).isPartial;
                          return avail === 0 && pend > 0 && !getCaseGroupPartialInfo(cg).isPartial;
                        };
                        const hasVisibleComum = groupedComumCaseGroupsByType.some((g) => g.groups.some(comumFilter));
                        const emptyLabels: Record<string, { icon: string; text: string }> = {
                          disponivel: { icon: '✅', text: 'Nenhum pacote disponível nos pedidos comuns.' },
                          indisponivel: { icon: '⏳', text: 'Nenhum pacote indisponível nos pedidos comuns.' },
                        };
                        if (!hasVisibleComum) {
                          const label = emptyLabels[pacotesDisponivelTab] || { icon: '📦', text: 'Nenhum item nesta aba.' };
                          return (
                            <div className="flex flex-col items-center gap-2 py-8 text-center">
                              <span className="text-3xl">{label.icon}</span>
                              <p className="text-sm font-medium text-muted-foreground">{label.text}</p>
                            </div>
                          );
                        }
                        return (
                        <div className="space-y-3">
                          {groupedComumCaseGroupsByType.map((group) => (
                            <div key={`comum-${group.type}`} className="space-y-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.type}</p>
                              <div className="flex flex-wrap gap-2">
                                {group.groups
                                  .filter(comumFilter)
                                  .sort((a: any, b: any) => getCaseGroupPriority(a) - getCaseGroupPriority(b))
                                  .map((caseGroup: any) => {
                                  const nomePreview = caseGroup.label;
                                  const imgPreview = caseGroup.imgUrl;
                                  const deadline = getCaseGroupDeadlineStatus(caseGroup);
                                  const temUrgente = (caseGroup.pedidos as any[]).some((p: any) => p.urgente);
                                  const pacoteDisponivel = (caseGroup.pedidos as any[]).every((p: any) => p.pacote_disponivel);
                                  const availSlots = getCaseGroupAvailableSlotCount(caseGroup);
                                  const pendSlots = (caseGroup.pedidos || []).filter((p: any) => !p.pacote_disponivel).length;
                                  const parcialInfo = pacotesDisponivelTab === 'parcial' ? getCaseGroupPartialInfo(caseGroup) : null;
                                  const badgeCount = pacotesDisponivelTab === 'disponivel' ? availSlots : pendSlots - availSlots;
                                  const isDisponivelTab = pacotesDisponivelTab === 'disponivel';
                                  const isParcialTab = pacotesDisponivelTab === 'parcial';

                                  return (
                                    <div
                                      key={caseGroup.signature}
                                      className={`relative rounded-lg border shadow-sm transition-shadow ${
                                        pacoteDisponivel
                                          ? 'border-green-500 bg-green-50 hover:shadow-md cursor-pointer'
                                          : isDisponivelTab
                                          ? 'bg-card hover:shadow-md cursor-pointer'
                                          : isParcialTab
                                          ? 'border-amber-400 bg-amber-50 hover:shadow-md cursor-default'
                                          : 'bg-card opacity-45 cursor-not-allowed'
                                      } ${isParcialTab ? 'flex flex-row items-stretch max-w-sm' : 'flex flex-col items-center gap-1.5 p-2 w-24'}`}
                                      onClick={() => {
                                        if (!isDisponivelTab) return;
                                        setEntradaPacoteModal({ open: true, caseGroup, loading: false });
                                      }}
                                    >
                                      {/* ── Lado esquerdo: info do produto ── */}
                                      <div className={isParcialTab ? 'flex flex-col items-center gap-1 p-2 w-24 shrink-0' : 'contents'}>
                                        <span className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[10px] px-1.5 py-0.5 min-w-[1.25rem] shadow">
                                          ×{badgeCount}
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

                                        {/* Badges de prazo, urgência e disponibilidade */}
                                        <div className="flex flex-wrap justify-center gap-0.5 w-full">
                                          {pacoteDisponivel && (
                                            <span className="text-[8px] font-bold bg-green-600 text-white rounded px-1 py-0.5 leading-tight">✓ DISPONÍVEL</span>
                                          )}
                                          {temUrgente && (
                                            <span className="text-[8px] font-bold bg-purple-600 text-white rounded px-1 py-0.5 leading-tight">URGENTE</span>
                                          )}
                                          {deadline === 'atrasado' && (
                                            <span className="text-[8px] font-bold bg-red-600 text-white rounded px-1 py-0.5 leading-tight">ATRASADO</span>
                                          )}
                                          {deadline === 'hoje' && (
                                            <span className="text-[8px] font-bold bg-orange-500 text-white rounded px-1 py-0.5 leading-tight">HOJE</span>
                                          )}
                                          {deadline === 'amanha' && (
                                            <span className="text-[8px] font-bold bg-yellow-400 text-gray-800 rounded px-1 py-0.5 leading-tight">AMANHÃ</span>
                                          )}
                                        </div>

                                        {/* Mensagem para aba indisponível */}
                                        {!isDisponivelTab && !isParcialTab && (
                                          <p className="text-[9px] text-red-600 font-semibold text-center leading-tight w-full mt-0.5">
                                            Itens insuficientes embalados
                                          </p>
                                        )}
                                      </div>

                                      {/* ── Lado direito: itens faltando (só na aba Parcial) ── */}
                                      {isParcialTab && parcialInfo && parcialInfo.missingItems.length > 0 && (
                                        <div className="w-44 border-l border-amber-300 bg-amber-50/50 p-2 flex flex-col justify-center gap-1 rounded-r-lg">
                                          <p className="text-[9px] font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1 mb-0.5">
                                            <span>⏳</span> Faltando
                                          </p>
                                          {parcialInfo.missingItems.map((mi, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 bg-white rounded p-1 border border-amber-200">
                                              {mi.imgUrl ? (
                                                <img src={mi.imgUrl} alt={mi.nome} className="h-7 w-7 rounded object-cover border border-amber-300 shrink-0 opacity-40 grayscale" />
                                              ) : (
                                                <div className="h-7 w-7 rounded border border-dashed border-amber-400 bg-amber-50 flex items-center justify-center shrink-0">
                                                  <span className="text-[9px] text-amber-400">?</span>
                                                </div>
                                              )}
                                              <div className="flex-1 min-w-0">
                                                <p className="text-[9px] font-semibold text-amber-900 leading-tight truncate">{mi.nome}</p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                  <div className="flex-1 h-1.5 rounded-full bg-amber-200 overflow-hidden">
                                                    <div
                                                      className="h-full rounded-full bg-amber-500 transition-all"
                                                      style={{ width: `${Math.round((mi.disponivel / mi.necessario) * 100)}%` }}
                                                    />
                                                  </div>
                                                  <span className="text-[8px] font-bold text-amber-700 whitespace-nowrap">{mi.disponivel}/{mi.necessario}</span>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {pacotesSubTab === 'incomuns' && (
                  <div className="mb-6">
                    <div className="rounded-md border p-3" style={dropdownHeaderStyles.incomuns}>
                      {incomumCaseGroups.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                          <span className="text-3xl">📦</span>
                          <p className="text-sm font-medium text-muted-foreground">Nenhum pedido incomum encontrado.</p>
                        </div>
                      ) : (() => {
                        const incomumFilter = (cg: any) => {
                          const avail = getCaseGroupAvailableSlotCount(cg);
                          const pend = (cg.pedidos || []).filter((p: any) => !p.pacote_disponivel).length;
                          if (pacotesDisponivelTab === 'disponivel') return avail > 0;
                          if (pacotesDisponivelTab === 'parcial') return avail === 0 && pend > 0 && getCaseGroupPartialInfo(cg).isPartial;
                          return avail === 0 && pend > 0 && !getCaseGroupPartialInfo(cg).isPartial;
                        };
                        const hasVisibleIncomum = groupedIncomumCaseGroupsByType.some((g) => g.groups.some(incomumFilter));
                        const emptyLabelsInc: Record<string, { icon: string; text: string }> = {
                          disponivel: { icon: '✅', text: 'Nenhum pacote disponível nos pedidos incomuns.' },
                          parcial: { icon: '◑', text: 'Nenhum pacote parcialmente embalado nos pedidos incomuns.' },
                          indisponivel: { icon: '⏳', text: 'Nenhum pacote indisponível nos pedidos incomuns.' },
                        };
                        if (!hasVisibleIncomum) {
                          const label = emptyLabelsInc[pacotesDisponivelTab] || { icon: '📦', text: 'Nenhum item nesta aba.' };
                          return (
                            <div className="flex flex-col items-center gap-2 py-8 text-center">
                              <span className="text-3xl">{label.icon}</span>
                              <p className="text-sm font-medium text-muted-foreground">{label.text}</p>
                            </div>
                          );
                        }
                        return (
                        <div className="space-y-3">
                          {groupedIncomumCaseGroupsByType.map((group) => (
                            <div key={`incomum-${group.type}`} className="space-y-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.type}</p>
                              <div className="flex flex-wrap gap-2">
                                {group.groups
                                  .filter(incomumFilter)
                                  .sort((a: any, b: any) => getCaseGroupPriority(a) - getCaseGroupPriority(b))
                                  .map((caseGroup: any) => {
                                  const nomePreview = caseGroup.label;
                                  const imgPreview = caseGroup.imgUrl;
                                  const deadline = getCaseGroupDeadlineStatus(caseGroup);
                                  const temUrgente = (caseGroup.pedidos as any[]).some((p: any) => p.urgente);
                                  const pacoteDisponivel = (caseGroup.pedidos as any[]).every((p: any) => p.pacote_disponivel);
                                  const availSlots = getCaseGroupAvailableSlotCount(caseGroup);
                                  const pendSlots = (caseGroup.pedidos || []).filter((p: any) => !p.pacote_disponivel).length;
                                  const parcialInfo = pacotesDisponivelTab === 'parcial' ? getCaseGroupPartialInfo(caseGroup) : null;
                                  const badgeCount = pacotesDisponivelTab === 'disponivel' ? availSlots : pendSlots - availSlots;
                                  const isDisponivelTab = pacotesDisponivelTab === 'disponivel';
                                  const isParcialTab = pacotesDisponivelTab === 'parcial';

                                  return (
                                    <div
                                      key={caseGroup.signature}
                                      className={`relative rounded-lg border shadow-sm transition-shadow ${
                                        pacoteDisponivel
                                          ? 'border-green-500 bg-green-50 hover:shadow-md cursor-pointer'
                                          : isDisponivelTab
                                          ? 'bg-card hover:shadow-md cursor-pointer'
                                          : isParcialTab
                                          ? 'border-amber-400 bg-amber-50 hover:shadow-md cursor-default'
                                          : 'bg-card opacity-45 cursor-not-allowed'
                                      } ${isParcialTab ? 'flex flex-row items-stretch max-w-sm' : 'flex flex-col items-center gap-1.5 p-2 w-24'}`}
                                      onClick={() => {
                                        if (!isDisponivelTab) return;
                                        setEntradaPacoteModal({ open: true, caseGroup, loading: false });
                                      }}
                                    >
                                      {/* ── Lado esquerdo: info do produto ── */}
                                      <div className={isParcialTab ? 'flex flex-col items-center gap-1 p-2 w-24 shrink-0' : 'contents'}>
                                        <span className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[10px] px-1.5 py-0.5 min-w-[1.25rem] shadow">
                                          ×{badgeCount}
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

                                        {/* Badges de disponibilidade, prazo e urgência */}
                                        <div className="flex flex-wrap justify-center gap-0.5 w-full">
                                          {pacoteDisponivel && (
                                            <span className="text-[8px] font-bold bg-green-600 text-white rounded px-1 py-0.5 leading-tight">✓ DISPONÍVEL</span>
                                          )}
                                          {temUrgente && (
                                            <span className="text-[8px] font-bold bg-purple-600 text-white rounded px-1 py-0.5 leading-tight">URGENTE</span>
                                          )}
                                          {deadline === 'atrasado' && (
                                            <span className="text-[8px] font-bold bg-red-600 text-white rounded px-1 py-0.5 leading-tight">ATRASADO</span>
                                          )}
                                          {deadline === 'hoje' && (
                                            <span className="text-[8px] font-bold bg-orange-500 text-white rounded px-1 py-0.5 leading-tight">HOJE</span>
                                          )}
                                          {deadline === 'amanha' && (
                                            <span className="text-[8px] font-bold bg-yellow-400 text-gray-800 rounded px-1 py-0.5 leading-tight">AMANHÃ</span>
                                          )}
                                        </div>

                                        {/* Mensagem para aba indisponível */}
                                        {!isDisponivelTab && !isParcialTab && (
                                          <p className="text-[9px] text-red-600 font-semibold text-center leading-tight w-full mt-0.5">
                                            Itens insuficientes embalados
                                          </p>
                                        )}
                                      </div>

                                      {/* ── Lado direito: itens faltando (só na aba Parcial) ── */}
                                      {isParcialTab && parcialInfo && parcialInfo.missingItems.length > 0 && (
                                        <div className="w-44 border-l border-amber-300 bg-amber-50/50 p-2 flex flex-col justify-center gap-1 rounded-r-lg">
                                          <p className="text-[9px] font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1 mb-0.5">
                                            <span>⏳</span> Faltando
                                          </p>
                                          {parcialInfo.missingItems.map((mi, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 bg-white rounded p-1 border border-amber-200">
                                              {mi.imgUrl ? (
                                                <img src={mi.imgUrl} alt={mi.nome} className="h-7 w-7 rounded object-cover border border-amber-300 shrink-0 opacity-40 grayscale" />
                                              ) : (
                                                <div className="h-7 w-7 rounded border border-dashed border-amber-400 bg-amber-50 flex items-center justify-center shrink-0">
                                                  <span className="text-[9px] text-amber-400">?</span>
                                                </div>
                                              )}
                                              <div className="flex-1 min-w-0">
                                                <p className="text-[9px] font-semibold text-amber-900 leading-tight truncate">{mi.nome}</p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                  <div className="flex-1 h-1.5 rounded-full bg-amber-200 overflow-hidden">
                                                    <div
                                                      className="h-full rounded-full bg-amber-500 transition-all"
                                                      style={{ width: `${Math.round((mi.disponivel / mi.necessario) * 100)}%` }}
                                                    />
                                                  </div>
                                                  <span className="text-[8px] font-bold text-amber-700 whitespace-nowrap">{mi.disponivel}/{mi.necessario}</span>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}

            {logisticaMainTab === 'enviar' && (
              <div className="mt-6">
              {/* Botões de ação rápida */}
              <div className="flex justify-end gap-2 mb-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-red-700 border-red-400 hover:bg-red-50"
                  onClick={() => setAtrasadosModalOpen(true)}
                >
                  <TriangleAlert className="h-3.5 w-3.5 mr-1" />
                  Prazo Ultrapassado ({atrasados.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-green-700 border-green-600 hover:bg-green-50"
                  onClick={() => { fetchPacotesLiberados(); setPacotesLiberadosModalOpen(true); }}
                >
                  <PackageCheck className="h-3.5 w-3.5 mr-1" />
                  Pacotes Liberados ({pacotesLiberados.length})
                </Button>
              </div>
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
                <div className="space-y-4">
                  {plataformasCards.map((pc, idx) => {
                    const currentPage = platformPage[pc.id] ?? 1;
                    const totalPages = Math.max(1, Math.ceil((pc.pedidos?.length ?? 0) / PLATFORM_PAGE_SIZE));
                    const sliceStart = (currentPage - 1) * PLATFORM_PAGE_SIZE;
                    const pedidosPagina = (pc.pedidos || []).slice(sliceStart, sliceStart + PLATFORM_PAGE_SIZE);
                    const cardDropdownKey = `${pc.id || 'sem-id'}-${idx}`;
                    const isOpen = openPlatformId === cardDropdownKey;

                    const handleGoToPage = (e: React.MouseEvent, page: number) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (page < 1 || page > totalPages) return;
                      setPlatformPage((s) => ({ ...s, [pc.id]: page }));
                    };

                    const isSyntheticCard = pc.id === 'urgentes' || pc.id === 'leads';

                    const sectionStyle =
                      pc.id === 'urgentes'
                        ? { backgroundColor: '#ff00000e', borderColor: '#ff0000' }
                        : /mercado livre/i.test(pc.nome)
                        ? { backgroundColor: '#ffd9000e', borderColor: '#ffd900' }
                        : /shopee/i.test(pc.nome)
                        ? { backgroundColor: '#ee440010', borderColor: '#ee4400' }
                        : /yampi/i.test(pc.nome)
                        ? { backgroundColor: '#ff88c30e', borderColor: '#ff0080' }
                        : pc.id === 'leads'
                        ? { backgroundColor: '#00a86b0e', borderColor: '#00a86b' }
                        : { backgroundColor: '#6366f10e', borderColor: '#6366f1' };

                    const sectionLabel =
                      pc.id === 'urgentes'
                        ? 'URGENTES'
                        : pc.id === 'leads'
                        ? 'COMERCIAL'
                        : (pc.nome || '').toUpperCase();

                    // qual aba está ativa para este card: 'a-enviar' | 'enviados' | null
                    const activeTab: 'a-enviar' | 'enviados' | null =
                      isOpen ? 'a-enviar' : openEnviadosId === cardDropdownKey ? 'enviados' : null;

                    const handleTabAEnviar = async (e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (activeTab === 'a-enviar') {
                        setOpenPlatformId(null);
                      } else {
                        setOpenEnviadosId(null);
                        setOpenPlatformId(cardDropdownKey);
                        setPlatformPage((s) => ({ ...s, [pc.id]: 1 }));
                        try {
                          const ids = (pc.pedidos || []).map((x: any) => x.id).filter(Boolean);
                          if (ids.length > 0) await fetchItemsForPedidoIds(ids);
                        } catch (err) { console.error(err); }
                      }
                    };

                    const handleTabEnviados = async (e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (activeTab === 'enviados') {
                        setOpenEnviadosId(null);
                      } else {
                        setOpenPlatformId(null);
                        setOpenEnviadosId(cardDropdownKey);
                        await fetchPedidosEnviados(cardDropdownKey, pc);
                      }
                    };

                    return (
                      <Card key={pc.id} className="overflow-hidden" style={sectionStyle}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2 text-sm tracking-wide md:text-base">
                              <div className="w-6 h-6 rounded-full overflow-hidden bg-white/60 flex items-center justify-center flex-shrink-0">
                                {pc.img_url ? (
                                  <img src={pc.img_url} alt={pc.nome} className="w-6 h-6 object-cover" />
                                ) : pc.id === 'urgentes' ? (
                                  <TriangleAlert className="w-4 h-4 text-red-500" />
                                ) : pc.id === 'leads' ? (
                                  <Users className="w-4 h-4 text-gray-600" />
                                ) : (
                                  <FaBoxesStacked className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                              {sectionLabel}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-sm">
                                <span className="font-semibold">{pc.count + (enviadosContagem[pc.id] ?? 0)}</span>
                                <span className="text-muted-foreground">pedido(s)</span>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                disabled={(pc.pedidos || []).filter((p: any) => p.pacote_disponivel === true).length === 0}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setOpenPlatformId(null);
                                  setOpenEnviadosId(null);
                                  if (isSyntheticCard) {
                                    setLoadingPedidosFiltrados(true);
                                    try {
                                      const ids = (pc.pedidos || []).map((x: any) => x.id).filter(Boolean);
                                      const fullList = sortPedidos(await fetchPedidosPorIds(ids)).filter((p: any) => p.pacote_disponivel === true);
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
                            </div>
                          </div>

                          {/* Tab bar */}
                          <div className="flex mt-3 rounded-lg overflow-hidden border border-black/10 bg-black/5 p-0.5 gap-0.5">
                            <button
                              type="button"
                              onClick={handleTabAEnviar}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                activeTab === 'a-enviar'
                                  ? 'bg-white shadow-sm text-foreground'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${activeTab === 'a-enviar' ? 'rotate-180' : ''}`} />
                              A Enviar
                              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                                activeTab === 'a-enviar' ? 'bg-foreground/10 text-foreground' : 'bg-black/10 text-muted-foreground'
                              }`}>{pc.count}</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleTabEnviados}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                activeTab === 'enviados'
                                  ? 'bg-green-600 text-white shadow-sm'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              Enviados
                              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                                activeTab === 'enviados' ? 'bg-white/25 text-white' : 'bg-black/10 text-muted-foreground'
                              }`}>{enviadosContagem[pc.id] ?? 0}</span>
                            </button>
                          </div>
                        </CardHeader>

                        {openEnviadosId === cardDropdownKey && (
                          <CardContent className="pt-0 border-t">
                            <div className="rounded-lg border bg-white/70 p-3" onClick={(e) => e.stopPropagation()}>
                              <h4 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <PackageCheck className="h-3.5 w-3.5" />
                                Pedidos enviados com pacote
                              </h4>
                              {(() => {
                                const allEnviados = pedidosEnviadosCache[cardDropdownKey] || [];
                                const envCurrentPage = enviadosPage[cardDropdownKey] ?? 1;
                                const envTotalPages = Math.max(1, Math.ceil(allEnviados.length / PLATFORM_PAGE_SIZE));
                                const envSliceStart = (envCurrentPage - 1) * PLATFORM_PAGE_SIZE;
                                const enviadosPagina = allEnviados.slice(envSliceStart, envSliceStart + PLATFORM_PAGE_SIZE);
                                const handleEnvGoToPage = (e: React.MouseEvent, page: number) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (page < 1 || page > envTotalPages) return;
                                  setEnviadosPage((s) => ({ ...s, [cardDropdownKey]: page }));
                                };
                                if (loadingEnviados === cardDropdownKey) return <div className="text-sm text-muted-foreground py-2">Carregando...</div>;
                                if (allEnviados.length === 0) return (
                                  <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
                                    <Package className="h-8 w-8 opacity-30" />
                                    <span className="text-xs">Nenhum pedido enviado com pacote.</span>
                                  </div>
                                );
                                return (
                                  <>
                                    {envTotalPages > 1 && (
                                      <div className="flex items-center justify-between mb-3 pb-3 border-b">
                                        <span className="text-sm text-muted-foreground">
                                          {allEnviados.length} enviados • {envCurrentPage}/{envTotalPages}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            disabled={envCurrentPage <= 1}
                                            onClick={(e) => handleEnvGoToPage(e, envCurrentPage - 1)}
                                            className="px-4 py-2 text-lg border rounded disabled:opacity-40 hover:bg-muted"
                                          >
                                            ‹
                                          </button>
                                          <button
                                            type="button"
                                            disabled={envCurrentPage >= envTotalPages}
                                            onClick={(e) => handleEnvGoToPage(e, envCurrentPage + 1)}
                                            className="px-4 py-2 text-lg border rounded disabled:opacity-40 hover:bg-muted"
                                          >
                                            ›
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {enviadosPagina.map((p: any) => {
                                    const itens: any[] = p.itens_pedido || [];
                                    return (
                                      <div key={p.id} className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-2">
                                        {/* Linha de cabeçalho */}
                                        <div className="flex items-center justify-between gap-1 mb-1.5">
                                          <div className="flex items-center gap-1.5">
                                            <CheckCircle className="h-3 w-3 text-green-600 shrink-0" />
                                            <span className="text-xs font-semibold text-green-800">{p.id_externo || p.id}</span>
                                          </div>
                                          <span className="text-[10px] text-green-700">{new Date(p.criado_em).toLocaleDateString('pt-BR')}</span>
                                        </div>

                                        {/* Conteúdo: produtos à esquerda, pacote à direita */}
                                        <div className="flex items-start gap-2">
                                          {/* Produtos */}
                                          <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                                            {itens.length === 0 ? (
                                              <span className="text-[10px] text-green-700/60">Sem itens</span>
                                            ) : (
                                              itens.map((it: any, itIdx: number) => {
                                                const nome = it.variacao?.nome || it.produto?.nome || '—';
                                                const imgUrl = it.variacao?.img_url || it.produto?.img_url;
                                                const qty = it.quantidade ?? 1;
                                                return (
                                                  <div key={itIdx} className="flex flex-col items-center gap-0.5 max-w-[44px]">
                                                    {imgUrl ? (
                                                      <img src={imgUrl} alt={nome} className="h-8 w-8 rounded object-cover border border-green-200" />
                                                    ) : (
                                                      <div className="h-8 w-8 rounded border border-green-200 bg-green-100 flex items-center justify-center">
                                                        <Package className="h-3.5 w-3.5 text-green-400" />
                                                      </div>
                                                    )}
                                                    <span className="text-[8px] text-center leading-tight line-clamp-2 text-green-800 w-full">{nome}</span>
                                                    {qty > 1 && <span className="text-[8px] font-semibold text-green-700">×{qty}</span>}
                                                  </div>
                                                );
                                              })
                                            )}
                                          </div>

                                          {/* Pacote */}
                                          {p.pacotes && (
                                            <div className="shrink-0 flex flex-col items-end gap-0.5 min-w-[90px] max-w-[120px]">
                                              <div className="flex items-center gap-1 rounded bg-green-100 border border-green-300 px-1.5 py-0.5 w-full">
                                                <PackageCheck className="h-3 w-3 text-green-600 shrink-0" />
                                                <span className="text-[9px] text-green-800 font-medium leading-tight line-clamp-2">{p.pacotes.rotulo}</span>
                                              </div>
                                              <span className="text-[8px] rounded-full bg-green-200 text-green-800 px-1.5 py-0.5">{p.pacotes.tipo}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </CardContent>
                        )}

                        {isOpen && (
                          <CardContent className="pt-0">
                            <div className="rounded-xl border bg-white/80 p-3 shadow-sm" onClick={(e) => e.stopPropagation()}>
                              {totalPages > 1 && (
                                <div className="flex items-center justify-between mb-3 pb-3 border-b">
                                  <span className="text-sm font-medium text-muted-foreground">
                                    {pc.pedidos.length} pedidos • {currentPage}/{totalPages}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={currentPage <= 1}
                                      onClick={(e) => handleGoToPage(e, currentPage - 1)}
                                      className="h-8 w-8 flex items-center justify-center text-base border rounded-lg disabled:opacity-30 hover:bg-muted transition-colors"
                                    >
                                      ‹
                                    </button>
                                    <button
                                      type="button"
                                      disabled={currentPage >= totalPages}
                                      onClick={(e) => handleGoToPage(e, currentPage + 1)}
                                      className="h-8 w-8 flex items-center justify-center text-base border rounded-lg disabled:opacity-30 hover:bg-muted transition-colors"
                                    >
                                      ›
                                    </button>
                                  </div>
                                </div>
                              )}
                              {pedidosPagina.length === 0 ? (
                                <div className="text-sm text-muted-foreground">Nenhum pedido disponível.</div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {pedidosPagina.map((p: any) => {
                                    const items = platformOrderItems[p.id] || [];
                                    const pacoteOk = p.pacote_disponivel === true;
                                    const pacoteInfo = pacoteOk ? p.pacotes : null;
                                    return (
                                      <div
                                        key={p.id}
                                        className={`rounded-xl border-2 p-3 bg-white shadow-sm transition-all ${
                                          !pacoteOk
                                            ? 'border-orange-200 bg-orange-50/40 opacity-60 pointer-events-none'
                                            : 'border-green-200 bg-green-50/30 hover:shadow-md'
                                        }`}
                                      >
                                        {/* Cabeçalho */}
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className={`h-2 w-2 rounded-full shrink-0 ${pacoteOk ? 'bg-green-500' : 'bg-orange-400'}`} />
                                            <span className="text-sm font-semibold truncate text-gray-800">{p.id_externo || p.id}</span>
                                            <span className="rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500 shrink-0">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
                                          </div>
                                          {pacoteOk ? (
                                            <button
                                              type="button"
                                              className="shrink-0 text-[11px] font-semibold bg-primary text-white px-3 py-1 rounded-full hover:bg-primary/90 transition-colors"
                                              onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setOpenPlatformId(null);
                                                if (isSyntheticCard) {
                                                  try {
                                                    const ids = (pc.pedidos || []).map((x: any) => x.id).filter(Boolean);
                                                    const fullList = sortPedidos(await fetchPedidosPorIds(ids)).filter((p: any) => p.pacote_disponivel === true);
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
                                          ) : (
                                            <span className="shrink-0 rounded-full bg-orange-100 border border-orange-300 text-orange-700 px-2.5 py-0.5 text-[10px] font-semibold">Aguardando pacote</span>
                                          )}
                                        </div>

                                        {/* Itens + Pacote */}
                                        {(items.length > 0 || pacoteInfo) && (
                                          <div className="flex items-start gap-3 mt-3 pt-3 border-t border-gray-100">
                                            {/* Imagens dos itens */}
                                            <div className="flex flex-wrap gap-2 flex-1">
                                              {items.map((item: any, itemIdx: number) => (
                                                <div key={itemIdx} className="flex flex-col items-center gap-1 max-w-[52px]">
                                                  {item.img_url ? (
                                                    <img src={item.img_url} alt={item.nome || ''} className="h-11 w-11 rounded-lg object-cover border-2 border-white shadow-sm" />
                                                  ) : (
                                                    <div className="h-11 w-11 rounded-lg border-2 border-gray-100 bg-gray-50 flex items-center justify-center text-[8px] text-gray-400 shadow-sm">sem foto</div>
                                                  )}
                                                  <span className="text-[9px] text-center leading-tight line-clamp-2 w-full text-gray-600 font-medium">{item.nome || '—'}</span>
                                                  {(item.quantidade ?? 1) > 1 && (
                                                    <span className="text-[9px] font-bold text-primary bg-primary/10 rounded-full px-1.5">×{item.quantidade}</span>
                                                  )}
                                                </div>
                                              ))}
                                            </div>

                                            {/* Pacote vinculado */}
                                            {pacoteInfo && (
                                              <div className="shrink-0 flex flex-col gap-1 min-w-[96px] max-w-[120px] self-start">
                                                <div className="flex items-center gap-1.5 rounded-lg bg-green-100 border border-green-300 px-2 py-1.5 w-full">
                                                  <PackageCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                                  <span className="text-[10px] text-green-800 font-semibold leading-tight line-clamp-2">{pacoteInfo.rotulo}</span>
                                                </div>
                                                <span className="text-[9px] rounded-full bg-green-200 text-green-700 font-medium text-center px-2 py-0.5">{pacoteInfo.tipo}</span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
            )}

          </div>
          </>
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
                <div className="relative">
                {foundPedido.pacote_disponivel !== true && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-b-lg bg-white/80 backdrop-blur-sm">
                    <span className="text-4xl">📦</span>
                    <p className="text-base font-semibold text-gray-700">Pacote ainda não disponível</p>
                    <p className="text-sm text-muted-foreground text-center max-w-xs">Dê entrada no pacote na aba <strong>Pacotes</strong> antes de bipar e imprimir a etiqueta.</p>
                  </div>
                )}
                <CardContent className={`mt-3 ${foundPedido.pacote_disponivel !== true ? 'pointer-events-none opacity-30' : ''}`}>
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
                {allItemsBipado && foundPedido.pacote_disponivel === true && (
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
                </div>
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

      {/* Modal: Pedidos com Prazo Ultrapassado (Etapa 3) */}
      <Dialog open={atrasadosModalOpen} onOpenChange={setAtrasadosModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-red-600" />
              Pedidos com Prazo Ultrapassado
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 py-2">
            {atrasados.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum pedido com prazo ultrapassado.</p>
            ) : (
              <div className="space-y-2">
                {atrasados.map((pedido: any) => {
                  const dataUrgente = new Date(pedido.data_logistica_urgente);
                  const now = new Date(); now.setHours(0, 0, 0, 0);
                  const diasAtraso = Math.ceil((now.getTime() - dataUrgente.getTime()) / 86400000);
                  const itens: any[] = pedido.itens_pedido || [];
                  return (
                    <div
                      key={pedido.id}
                      className="rounded-lg border border-red-300 bg-red-50/40 px-3 py-2 cursor-pointer hover:bg-red-50 transition-colors"
                      onClick={() => { setBarcode(pedido.id_externo || pedido.id); setTimeout(() => barcodeRef.current?.focus(), 50); setAtrasadosModalOpen(false); }}
                    >
                      {/* Cabeçalho da row */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {pedido.plataformas?.img_url && <img src={pedido.plataformas.img_url} alt={pedido.plataformas.nome} className="h-4 w-4 rounded object-cover" />}
                          <span className="text-sm font-semibold text-red-800">{pedido.id_externo || pedido.id}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-red-700">Prazo: {dataUrgente.toLocaleDateString('pt-BR')}</span>
                          <span className="rounded-full bg-red-600 text-white text-[10px] font-bold px-2 py-0.5">
                            {diasAtraso > 0 ? `${diasAtraso}d atrasado` : 'Vence hoje'}
                          </span>
                        </div>
                      </div>
                      {/* Produtos */}
                      {itens.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {itens.map((it: any, idx: number) => {
                            const nome = it.variacao?.nome || it.produto?.nome || '—';
                            const imgUrl = it.variacao?.img_url || it.produto?.img_url;
                            const qty = it.quantidade ?? 1;
                            return (
                              <div key={idx} className="flex items-center gap-1 rounded bg-white border border-red-200 px-1.5 py-0.5">
                                {imgUrl ? (
                                  <img src={imgUrl} alt={nome} className="h-5 w-5 rounded object-cover border border-red-100" />
                                ) : (
                                  <div className="h-5 w-5 rounded border border-red-100 bg-red-50 flex items-center justify-center">
                                    <Package className="h-3 w-3 text-red-300" />
                                  </div>
                                )}
                                <span className="text-[10px] text-red-800 font-medium leading-tight max-w-[80px] truncate">{nome}</span>
                                {qty > 1 && <span className="text-[10px] font-bold text-red-700">×{qty}</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Pacotes Liberados */}
      <Dialog open={pacotesLiberadosModalOpen} onOpenChange={setPacotesLiberadosModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-green-600" />
                Pacotes Liberados
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] border border-green-300 text-green-700 hover:bg-green-100"
                onClick={() => fetchPacotesLiberados()}
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 py-2">
            {loadingPacotesLiberados ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Carregando pacotes...</p>
            ) : pacotesLiberados.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum pacote liberado ainda.</p>
            ) : (
              <div className="space-y-2">
                {pacotesLiberados.map((pacote: any) => {
                  const pedidos = pacote.pedidos || [];
                  const dataCriacao = new Date(pacote.criado_em);
                  return (
                    <div key={pacote.id} className="flex items-center justify-between rounded-md border border-green-200 bg-green-50/40 px-3 py-2 hover:bg-green-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <PackageCheck className="h-4 w-4 text-green-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-green-900 leading-tight truncate">{pacote.rotulo}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">{dataCriacao.toLocaleDateString('pt-BR')} {dataCriacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${pacote.tipo === 'comum' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {pacote.tipo || 'comum'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {pedidos.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap justify-end">
                            {pedidos.slice(0, 3).map((p: any) => (
                              <div key={p.id} className="flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5">
                                {p.plataformas?.img_url && <img src={p.plataformas.img_url} alt="" className="h-3 w-3 rounded object-cover" />}
                                <span className="text-[10px] text-muted-foreground font-medium">{p.id_externo || String(p.id).slice(0, 8)}</span>
                              </div>
                            ))}
                            {pedidos.length > 3 && (
                              <span className="text-[10px] text-muted-foreground font-medium">+{pedidos.length - 3}</span>
                            )}
                          </div>
                        )}
                        <span className="text-[10px] font-semibold rounded-full bg-green-100 text-green-700 px-2 py-0.5 shrink-0">
                          {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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

      {/* Modal: Dar baixa por categoria */}
      <Dialog
        open={baixaCategoriaModal.open}
        onOpenChange={(open) => {
          if (!open) setBaixaCategoriaModal({ open: false, groupId: null, itemKey: '', quantidade: '1' });
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dar baixa na categoria</DialogTitle>
          </DialogHeader>

          {(() => {
            const group = produtosProduzirByType.find((g) => g.id === baixaCategoriaModal.groupId);
            const selected = group?.produtos.find((p: any) => p.itemKey === baixaCategoriaModal.itemKey);
            const produzido = group && selected ? getQuantidadeProduzida(group.id, selected.itemKey) : 0;
            const total = Number(selected?.quantidadeTotal ?? 0);
            const restante = Math.max(0, total - produzido);

            return (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Produto</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={baixaCategoriaModal.itemKey}
                    onChange={(e) => {
                      const itemKey = e.target.value;
                      if (!group) return;
                      const nextSelected = group.produtos.find((p: any) => p.itemKey === itemKey);
                      const nextTotal = Number(nextSelected?.quantidadeTotal ?? 0);
                      const nextProduzido = nextSelected ? getQuantidadeProduzida(group.id, nextSelected.itemKey) : 0;
                      const nextRestante = Math.max(0, nextTotal - nextProduzido);

                      setBaixaCategoriaModal((prev) => ({
                        ...prev,
                        itemKey,
                        quantidade: String(Math.max(1, nextRestante > 0 ? 1 : 0)),
                      }));
                    }}
                  >
                    {(group?.produtos || []).map((produto: any) => {
                      const prodQtd = group ? getQuantidadeProduzida(group.id, produto.itemKey) : 0;
                      const prodRestante = Math.max(0, Number(produto.quantidadeTotal ?? 0) - prodQtd);
                      return (
                        <option key={produto.itemKey} value={produto.itemKey}>
                          {produto.nomeProduto}{produto.nomeVariacao ? ` - ${produto.nomeVariacao}` : ''} ({prodQtd}/{produto.quantidadeTotal}, faltam {prodRestante})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <p>Total: <strong>{total}</strong></p>
                  <p>Já embalado: <strong className="text-green-700">{produzido}</strong></p>
                  <p>Faltam: <strong className="text-red-700">{restante}</strong></p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Quantidade embalada agora</label>
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(1, restante)}
                    value={baixaCategoriaModal.quantidade}
                    onChange={(e) => setBaixaCategoriaModal((prev) => ({ ...prev, quantidade: e.target.value }))}
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={salvandoBaixaCategoria}
              onClick={() => setBaixaCategoriaModal({ open: false, groupId: null, itemKey: '', quantidade: '1' })}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarBaixaCategoria}
              disabled={salvandoBaixaCategoria}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {salvandoBaixaCategoria ? 'Salvando...' : 'Confirmar baixa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Dar Entrada no Pacote */}
      <Dialog
        open={entradaPacoteModal.open}
        onOpenChange={(open) => { if (!open) setEntradaPacoteModal({ open: false, caseGroup: null, loading: false }); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              📦 Dar entrada no pacote
            </DialogTitle>
          </DialogHeader>

          {entradaPacoteModal.caseGroup && (
            <div className="py-4 space-y-4">
              <div className="flex flex-col items-center gap-3">
                {entradaPacoteModal.caseGroup.imgUrl ? (
                  <img
                    src={entradaPacoteModal.caseGroup.imgUrl}
                    alt={entradaPacoteModal.caseGroup.label}
                    className="h-20 w-20 rounded-lg object-cover border shadow-sm"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-lg border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    sem foto
                  </div>
                )}
                <div className="text-center">
                  <p className="font-semibold text-base">{entradaPacoteModal.caseGroup.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {entradaPacoteModal.caseGroup.pedidos.length} pedido(s) • {entradaPacoteModal.caseGroup.totalUnidades} unidade(s)
                  </p>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-center text-muted-foreground">
                Confirme que o pacote chegou e está disponível para envio.
                O status será marcado como <span className="font-semibold text-green-600">disponível</span>.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={entradaPacoteModal.loading}
              onClick={() => setEntradaPacoteModal({ open: false, caseGroup: null, loading: false })}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={entradaPacoteModal.loading}
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => void handleDarEntradaPacote()}
            >
              {entradaPacoteModal.loading ? 'Registrando...' : '✓ Confirmar entrada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}
