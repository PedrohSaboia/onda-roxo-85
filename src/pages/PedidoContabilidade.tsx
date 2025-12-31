import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppHeader } from '@/components/layout/AppHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash, Copy, Edit, CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import EmbalagensManager from '@/components/shipping/EmbalagensManager';
import RemetentesManager from '@/components/shipping/RemetentesManager';
import CotacaoFreteModal from '@/components/shipping/CotacaoFreteModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import EditSelectModal from '@/components/modals/EditSelectModal';
import ClientEditModal from '@/components/modals/ClientEditModal';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

function formatAddress(cliente: any) {
  if (!cliente) return '-';
  const parts = [] as string[];
  if (cliente.endereco) parts.push(cliente.endereco + (cliente.numero ? `, ${cliente.numero}` : ''));
  if (cliente.complemento) parts.push(cliente.complemento);
  const cityParts = [] as string[];
  if (cliente.bairro) cityParts.push(cliente.bairro);
  if (cliente.cidade) cityParts.push(cliente.cidade);
  if (cliente.estado) cityParts.push(cliente.estado);
  if (cityParts.length) parts.push(cityParts.join(' / '));
  if (cliente.cep) parts.push(`CEP: ${cliente.cep}`);
  return parts.join(' • ');
} 

export default function PedidoContabilidade() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const readonly = params.get('readonly') === '1' || params.get('readonly') === 'true';
  const { user, empresaId } = useAuth();
  const [pedido, setPedido] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [plataformas, setPlataformas] = useState<any[]>([]);
  const [etiquetas, setEtiquetas] = useState<any[]>([]);
  const [editFieldOpen, setEditFieldOpen] = useState(false);
  const [editFieldKey, setEditFieldKey] = useState<'status' | 'plataforma' | 'responsavel' | 'etiqueta' | null>(null);
  const [editOptions, setEditOptions] = useState<{ id: string; nome: string }[]>([]);
  const [editValue, setEditValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [etiquetaText, setEtiquetaText] = useState('');
  const [linkEtiqueta, setLinkEtiqueta] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [calculandoFrete, setCalculandoFrete] = useState(false);
  const [cotacaoModal, setCotacaoModal] = useState(false);
  const [cotacoes, setCotacoes] = useState<CotacaoFrete[]>([]);
  const [processingLabel, setProcessingLabel] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const [gerandoEtiquetaML, setGerandoEtiquetaML] = useState(false);
  const [etiquetaMLModalOpen, setEtiquetaMLModalOpen] = useState(false);
  const [etiquetaMLPdfUrl, setEtiquetaMLPdfUrl] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<Record<number, string> | null>(null);
  
  // Estados para gerenciar embalagem/remetente selecionados
  const [embalagens, setEmbalagens] = useState<Embalagem[]>([]);
  const [remetentes, setRemetentes] = useState<Remetente[]>([]);
  const [embalagensVisible, setEmbalagensVisible] = useState(false);
  const [remetentesVisible, setRemetentesVisible] = useState(false);
  const [selectedEmbalagem, setSelectedEmbalagem] = useState<Embalagem | null>(null);
  const [selectedRemetente, setSelectedRemetente] = useState<Remetente | null>(null);

  const { toast } = useToast();

  // Modal: adicionar produtos
  const [addProductsVisible, setAddProductsVisible] = useState(false);
  const [produtosListModal, setProdutosListModal] = useState<any[]>([]);
  const [loadingProdutosModal, setLoadingProdutosModal] = useState(false);
  const [produtosErrorModal, setProdutosErrorModal] = useState<string | null>(null);
  const [searchModal, setSearchModal] = useState('');
  const [modalPage, setModalPage] = useState(1);
  const [modalPageSize] = useState(5);
  const [variationSelectionsModal, setVariationSelectionsModal] = useState<Record<string, string>>({});
  const [brindeSelectionsModal, setBrindeSelectionsModal] = useState<Record<string, boolean>>({});
  const [modalCart, setModalCart] = useState<any[]>([]);
  const [savingModal, setSavingModal] = useState(false);
  const [clientEditOpen, setClientEditOpen] = useState(false);
  const [editValorTotalOpen, setEditValorTotalOpen] = useState(false);
  const [tempValorTotal, setTempValorTotal] = useState<string>('');
  // Remove item modal state
  const [productToRemove, setProductToRemove] = useState<any | null>(null);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [removeValueStr, setRemoveValueStr] = useState('');
  const [removingItem, setRemovingItem] = useState(false);
  const [savingUrgente, setSavingUrgente] = useState(false);
  // Wizard for adding sale details when confirming modal cart
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardDate, setWizardDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [wizardPayment, setWizardPayment] = useState<string>('Pix');
  const [wizardValueStr, setWizardValueStr] = useState<string>('');
  const [wizardSaving, setWizardSaving] = useState(false);
  const [tempoGanho, setTempoGanho] = useState<Date | undefined>(undefined);
  const [savingTempoGanho, setSavingTempoGanho] = useState(false);
  // Up-sell states
  const [upSellModalOpen, setUpSellModalOpen] = useState(false);
  const [upSellSourceItem, setUpSellSourceItem] = useState<any | null>(null);
  const [upSellProducts, setUpSellProducts] = useState<any[]>([]);
  const [loadingUpSell, setLoadingUpSell] = useState(false);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [confirmManterOpen, setConfirmManterOpen] = useState(false);
  const [itemToKeep, setItemToKeep] = useState<any | null>(null);
  // Up-sell wizard states
  const [upSellWizardOpen, setUpSellWizardOpen] = useState(false);
  const [upSellWizardStep, setUpSellWizardStep] = useState(1);
  const [upSellDate, setUpSellDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [upSellPayment, setUpSellPayment] = useState<string>('Pix');
  const [upSellValueStr, setUpSellValueStr] = useState<string>('');
  const [upSellStatus, setUpSellStatus] = useState<string>('');
  const [statusUpSellOptions, setStatusUpSellOptions] = useState<any[]>([]);
  const [selectedUpSellProduct, setSelectedUpSellProduct] = useState<any>(null);
  const [savingUpSell, setSavingUpSell] = useState(false);
  const [statusUpSellMap, setStatusUpSellMap] = useState<Record<number, string>>({});
  const [isAumentoGratis, setIsAumentoGratis] = useState(false);
  const [isNormalFlow, setIsNormalFlow] = useState(false);
  const [pendingUpSellAlertOpen, setPendingUpSellAlertOpen] = useState(false);
  const [pendingUpSellProducts, setPendingUpSellProducts] = useState<any[]>([]);
  
  // Estados para integração com Bling
  const [integrandoBling, setIntegrandoBling] = useState(false);
  const [integrandoBlingNFe, setIntegrandoBlingNFe] = useState(false);

  const formatCurrencyBR = (n: number) => n.toFixed(2).replace('.', ',');
  const parseCurrencyBR = (s: string) => {
    if (!s) return 0;
    const cleaned = String(s).replace(/R\$|\s/g, '').replace(/\./g, '').replace(/,/g, '.');
    const v = Number(cleaned);
    return isNaN(v) ? 0 : v;
  };

  // Function to check if all up_cell products are resolved and auto-liberate the order
  // RULES:
  // 1. If there's at least 1 product WITHOUT up_cell -> DO NOT auto-liberate (button will be shown)
  // 2. If ALL products have up_cell -> auto-liberate when ALL exit status 1
  // 3. Special case: If there's ONLY 1 product with up_cell (no other products) -> auto-liberate when it exits status 1
  const checkAndAutoLiberatePedido = async (excludeItemId?: string) => {
    if (!pedido || pedido.pedido_liberado) return;
    
    try {
      // Get count of items in this order
      const totalItens = (pedido.itens || []).length;
      
      // Special case: If there's only 1 item total and it's being processed, liberate directly
      if (totalItens === 1 && excludeItemId) {
        const singleItem = pedido.itens[0];
        if (singleItem.produto?.up_cell && (singleItem.id === excludeItemId || singleItem._sourceIds?.includes(excludeItemId))) {
          // Only 1 up_cell product and it's being resolved - liberate now
          const { error } = await supabase
            .from('pedidos')
            .update({ pedido_liberado: true, atualizado_em: new Date().toISOString() })
            .eq('id', pedido.id);
          
          if (error) throw error;
          
          toast({ title: 'Pedido liberado automaticamente', description: 'Produto de up-sell foi resolvido' });
          return;
        }
      }
      
      // Get fresh itens_pedido data from database
      const { data: itensData, error: itensError } = await supabase
        .from('itens_pedido')
        .select('id, status_up_sell, produto:produtos(id, up_cell)')
        .eq('pedido_id', pedido.id);
      
      if (itensError) throw itensError;
      
      const itens = itensData || [];
      
      // Count up_cell products and non-up_cell products
      const upCellProducts = itens.filter((it: any) => it.produto?.up_cell);
      const nonUpCellProducts = itens.filter((it: any) => !it.produto?.up_cell);
      
      // Rule 1: If there's at least 1 product WITHOUT up_cell -> DO NOT auto-liberate
      // The button will be shown for the user to click manually
      if (nonUpCellProducts.length > 0) {
        return; // Don't auto-liberate, button will handle it
      }
      
      // Rule 2 & 3: ALL products are up_cell (including special case of just 1)
      // Check if all up_cell products are resolved (status !== 1)
      if (upCellProducts.length > 0) {
        const allUpCellResolved = upCellProducts.every((it: any) => {
          // Exclude the item we just updated (it might not be reflected yet in db)
          if (excludeItemId && it.id === excludeItemId) {
            return true; // This one was just resolved
          }
          return it.status_up_sell && it.status_up_sell !== 1;
        });
        
        if (allUpCellResolved) {
          // Auto-liberate the order
          const { error } = await supabase
            .from('pedidos')
            .update({ pedido_liberado: true, atualizado_em: new Date().toISOString() })
            .eq('id', pedido.id);
          
          if (error) throw error;
          
          toast({ title: 'Pedido liberado automaticamente', description: 'Todos os produtos de up-sell foram resolvidos' });
        }
      }
    } catch (err: any) {
      console.error('Erro ao verificar auto-liberação:', err);
    }
  };

  // Load produtos for modal when opened
  useEffect(() => {
    if (!addProductsVisible) return;
    let mounted = true;
    const loadProdutosModal = async () => {
      setLoadingProdutosModal(true);
      setProdutosErrorModal(null);
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select('id,nome,sku,preco,unidade,categoria,img_url,qntd,nome_variacao,codigo_barras,criado_em,atualizado_em,up_cell,contagem, variacoes_produto(id,nome,sku,valor,qntd,img_url,codigo_barras_v)')
          .order('contagem', { ascending: false, nullsFirst: false })
          .order('criado_em', { ascending: false });

        if (error) throw error;
        if (!mounted) return;

        const mapped = (data || []).map((p: any) => ({
          id: p.id,
          nome: p.nome,
          sku: p.sku,
          preco: Number(p.preco || 0),
          unidade: p.unidade || 'un',
          categoria: p.categoria || '',
          imagemUrl: p.img_url || undefined,
          codigo_barras: p.codigo_barras || null,
          up_cell: p.up_cell || false,
          variacoes: (p.variacoes_produto || []).map((v: any) => ({ id: v.id, nome: v.nome, sku: v.sku, valor: Number(v.valor || 0), qntd: v.qntd ?? 0, img_url: v.img_url || null, codigo_barras_v: v.codigo_barras_v || null })),
          nomeVariacao: p.nome_variacao || null,
          qntd: p.qntd ?? 0,
          criadoEm: p.criado_em,
          atualizadoEm: p.atualizado_em,
        }));

        setProdutosListModal(mapped);

        // set default selections for variations and brinde
        const defaults: Record<string, string> = {};
        const brindeDefaults: Record<string, boolean> = {};
        mapped.forEach((pr) => {
          if (pr.variacoes && pr.variacoes.length) defaults[pr.id] = pr.variacoes[0].id;
          brindeDefaults[pr.id] = false;
        });
        setVariationSelectionsModal(defaults);
        setBrindeSelectionsModal(brindeDefaults);
      } catch (err: any) {
        console.error('Erro ao carregar produtos para modal:', err);
        setProdutosErrorModal(err?.message || String(err));
      } finally {
        setLoadingProdutosModal(false);
      }
    };

    loadProdutosModal();
    return () => { mounted = false };
  }, [addProductsVisible]);

  // Load up-sell products when modal opens
  useEffect(() => {
    if (!upSellModalOpen || !upSellSourceItem) return;
    let mounted = true;
    const loadUpSellProducts = async () => {
      setLoadingUpSell(true);
      try {
        const productId = upSellSourceItem.produto?.id;
        if (!productId) return;
        
        // Get the product to access lista_id_upsell
        const { data: prodData, error: prodError } = await supabase
          .from('produtos')
          .select('lista_id_upsell')
          .eq('id', productId)
          .single();
        
        if (prodError) throw prodError;
        if (!mounted) return;
        
        const upSellIds = prodData?.lista_id_upsell || [];
        if (upSellIds.length === 0) {
          setUpSellProducts([]);
          return;
        }
        
        // Load the up-sell products
        const { data: upSellData, error: upSellError } = await supabase
          .from('produtos')
          .select('id, nome, sku, preco, img_url, variacoes_produto(id, nome, sku, valor, img_url)')
          .in('id', upSellIds);
        
        if (upSellError) throw upSellError;
        if (!mounted) return;
        
        setUpSellProducts(upSellData || []);
      } catch (err) {
        console.error('Erro ao carregar produtos up-sell:', err);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os produtos up-sell',
          variant: 'destructive'
        });
      } finally {
        setLoadingUpSell(false);
      }
    };
    
    loadUpSellProducts();
    return () => { mounted = false };
  }, [upSellModalOpen, upSellSourceItem]);

  // Load status up-sell options and map
  useEffect(() => {
    let mounted = true;
    const loadStatusUpSell = async () => {
      try {
        const { data, error } = await supabase
          .from('status_upsell')
          .select('*')
          .order('id');
        
        if (error) throw error;
        if (!mounted) return;
        
        setStatusUpSellOptions(data || []);
        
        // Create map for quick lookup
        const map: Record<number, string> = {};
        (data || []).forEach((status: any) => {
          map[status.id] = status.status;
        });
        setStatusUpSellMap(map);
        
        if (data && data.length > 0) {
          setUpSellStatus(String(data[0].id));
        }
      } catch (err) {
        console.error('Erro ao carregar status up-sell:', err);
      }
    };
    
    loadStatusUpSell();
    return () => { mounted = false };
  }, []); // Load once on mount

  // Tipos
  type Embalagem = {
    id: string;
    nome: string;
    altura: number;
    largura: number;
    comprimento: number;
    peso: number;
  };

  type Remetente = {
    id: string;
    nome: string;
    cep: string;
    endereco: string;
    cidade: string;
    estado: string;
    contato?: string;
    telefone?: string;
    email?: string;
    cpf?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    country_id?: string;
    postal_code?: string;
    document?: string;
    inscricao_estadual?: string;
  };

  type CotacaoFrete = {
    service_id: number;
    transportadora: string;
    modalidade: string;
    prazo: string;
    preco: number;
    raw_response: any;
    melhorEnvioId?: string;
  };

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    
    // Carregar dados de embalagens e remetentes
    const loadData = async () => {
      try {
        const [
          { data: embalagensData, error: embalagensError },
          { data: remetentesData, error: remetentesError }
        ] = await Promise.all([
          supabase.from('embalagens').select('*').order('nome'),
          supabase.from('remetentes').select('*').order('nome')
        ]);

        if (embalagensError) throw embalagensError;
        if (remetentesError) throw remetentesError;

        setEmbalagens(embalagensData || []);
        setRemetentes(remetentesData || []);

        // Auto-selecionar primeiro remetente e embalagem
        if (embalagensData?.length) setSelectedEmbalagem(embalagensData[0]);
        if (remetentesData?.length) setSelectedRemetente(remetentesData[0]);
        // try to load payment methods table if exists
        (async () => {
          try {
            const { data: pmData, error: pmError } = await (supabase as any).from('formas_pagamentos').select('id,nome');
            if (!pmError && pmData) {
              const map: Record<number, string> = {};
              pmData.forEach((r: any) => { map[r.id] = r.nome; });
              setPaymentMethods(map);
            }
          } catch (e) {
            // ignore if table doesn't exist
          }
        })();
        
        // Load status up-sell for display in table
        (async () => {
          try {
            const { data: statusData, error: statusError } = await supabase
              .from('status_upsell')
              .select('*');
            if (!statusError && statusData) {
              const map: Record<number, string> = {};
              statusData.forEach((status: any) => {
                map[status.id] = status.status;
              });
              setStatusUpSellMap(map);
            }
          } catch (e) {
            // ignore if table doesn't exist
          }
        })();
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        toast({ 
          title: 'Erro', 
          description: 'Não foi possível carregar alguns dados',
          variant: 'destructive'
        });
      }
    };

    loadData();

    const fetchData = async () => {
      setLoading(true);
      try {
        const [{ data: pedidoData, error: pedidoError }, { data: plataformasData, error: plataformasError }, { data: statusesData, error: statusesError }, { data: usuariosData, error: usuariosError }, { data: etiquetasData, error: etiquetasError }] = await Promise.all([
          supabase
            .from('pedidos')
            .select(`*, clientes(*), usuarios(id,nome,img_url), plataformas(id,nome,cor,img_url), status(id,nome,cor_hex,ordem), tipos_etiqueta(id,nome,cor_hex,ordem), itens_pedido(id,quantidade,preco_unitario, criado_em, status_up_sell, produto:produtos(id,nome,sku,img_url,preco,up_cell,lista_id_upsell,bling_id), variacao:variacoes_produto(id,nome,sku,img_url,valor,bling_id))`)
            .eq('id', id)
            .single(),
          supabase.from('plataformas').select('*').order('nome'),
          supabase.from('status').select('*').order('ordem', { ascending: true }),
          supabase.from('usuarios').select('*'),
          supabase.from('tipos_etiqueta').select('*').order('ordem', { ascending: true }),
        ]);

        if (pedidoError) throw pedidoError;
        if (statusesError) throw statusesError;
        if (usuariosError) throw usuariosError;
        if (etiquetasError) throw etiquetasError;

        if (!mounted) return;

        // normalize related shapes
        const pick = (val: any) => Array.isArray(val) ? val[0] : val;
        const pedidoRow = pedidoData;
        // Prefer explicit cliente linked by pedido_id in clientes table
        let cliente: any = pick(pedidoRow.clientes);
        try {
          const res: any = await (supabase as any)
            .from('clientes')
            .select('*')
            .eq('pedido_id', id)
            .maybeSingle();
          if (!res.error && res.data) cliente = res.data;
        } catch (e) {
          // ignore, keep existing cliente
        }
        const plataforma = pick(pedidoRow.plataformas);
        const responsavel = pick(pedidoRow.usuarios);
        const statusRow = pick(pedidoRow.status);
        const etiquetaRow = pick(pedidoRow.tipos_etiqueta);

        // map itens to include produto and variacao objects when present
        const itens = (pedidoRow.itens_pedido || []).map((it: any) => {
          const produtoData = pick(it.produto);
          const variacaoData = pick(it.variacao);
          return {
            id: it.id,
            quantidade: it.quantidade,
            preco_unitario: it.preco_unitario,
            produto: produtoData || null,
            variacao: variacaoData || null,
            criado_em: it.criado_em,
            produto_id: produtoData?.id || null,
            variacao_id: variacaoData?.id || null,
            status_up_sell: it.status_up_sell || null,
          };
        });

        setPedido({
          ...pedidoRow,
          cliente,
          plataforma,
          responsavel,
          status: statusRow ? { id: statusRow.id, nome: statusRow.nome, corHex: statusRow.cor_hex } : null,
          etiqueta: etiquetaRow ? { id: etiquetaRow.id, nome: etiquetaRow.nome, corHex: etiquetaRow.cor_hex } : null,
          itens
        });

        // Inicializar tempo_ganho se existir
        if (pedidoRow.tempo_ganho) {
          setTempoGanho(new Date(pedidoRow.tempo_ganho));
        }

    // init etiqueta input
  setEtiquetaText(etiquetaRow?.nome || '');
    // init link etiqueta input from pedido row (link_etiqueta is the field on pedidos)
    setLinkEtiqueta((pedidoRow as any)?.link_etiqueta ?? (pedidoRow as any)?.link_formulario ?? '');

  setPlataformas(plataformasData || []);
  setStatuses((statusesData || []).map((s: any) => ({ id: s.id, nome: s.nome, corHex: s.cor_hex })));
  setUsuarios(usuariosData || []);
  setEtiquetas((etiquetasData || []).map((t: any) => ({ id: t.id, nome: t.nome, corHex: t.cor_hex })));
      } catch (err: any) {
        console.error('Erro ao buscar pedido', err);
        toast({ title: 'Erro', description: err.message || String(err), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false };
  }, [id]);

  const handleSave = async () => {
    if (!pedido) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({
          status_id: pedido.status?.id || null,
          responsavel_id: pedido.responsavel?.id || null,
          observacoes: pedido.observacoes || null,
          link_etiqueta: linkEtiqueta || null,
          atualizado_em: new Date().toISOString(),
        } as any)
        .eq('id', pedido.id);

      if (error) throw error;

      toast({ title: 'Pedido atualizado', description: 'Alterações salvas com sucesso' });
      // refresh
      navigate(0);
    } catch (err: any) {
      console.error('Erro ao salvar pedido', err);
      toast({ title: 'Erro', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveLinkEtiqueta = async () => {
    if (!id) return;
    setSavingLink(true);
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ link_etiqueta: linkEtiqueta || null } as any)
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Link salvo', description: 'Link da etiqueta salvo com sucesso' });
      // refresh to show updated value if needed
      navigate(0);
    } catch (err) {
      console.error('Erro ao salvar link_etiqueta:', err);
      toast({ title: 'Erro', description: 'Não foi possível salvar o link da etiqueta', variant: 'destructive' });
    } finally {
      setSavingLink(false);
    }
  };

  const handleCalcularFrete = async () => {
    // Validar CEP do cliente
    if (!pedido?.cliente?.cep) {
      toast({ 
        title: 'Erro', 
        description: 'O CEP do cliente não está preenchido',
        variant: 'destructive'
      });
      return;
    }

    const cepLimpo = pedido.cliente.cep.replace(/\D/g, '');
    if (!/^\d{8}$/.test(cepLimpo)) {
      toast({ 
        title: 'Erro', 
        description: 'O CEP do cliente é inválido. Atualize os dados antes de prosseguir.',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedRemetente || !selectedEmbalagem) {
      toast({ 
        title: 'Erro', 
        description: 'Selecione um remetente e uma embalagem',
        variant: 'destructive'
      });
      return;
    }

  setCalculandoFrete(true);
  setCotacaoModal(true);

    console.log('Dados do remetente sendo enviados:', selectedRemetente);

    try {
      // calcular valor dos itens como seguro
      const itemsValue = (pedido?.itens || []).reduce((s: number, it: any) => s + (Number(it.preco_unitario || it.preco || 0) * Number(it.quantidade || 1)), 0);

      const payload = {
        origem: { 
          postal_code: selectedRemetente.cep.replace(/\D/g,''),
          contact: selectedRemetente.contato || selectedRemetente.nome,
          email: selectedRemetente.email || 'contato@empresa.com'
        },
        destino: { postal_code: cepLimpo },
        pacote: [{
          weight: selectedEmbalagem.peso,
          insurance_value: itemsValue || 1,
          length: selectedEmbalagem.comprimento,
          height: selectedEmbalagem.altura,
          width: selectedEmbalagem.largura,
          id: "1",
          quantity: 1
        }]
        // Opcionalmente incluir services se houver seleção
      };

      const { data: resp, error: functionError } = await supabase.functions.invoke('calculo-frete-melhorenvio', {
        body: payload
      });

      if (functionError) {
        throw new Error(functionError.message || 'Erro ao calcular frete');
      }

      if (!resp?.cotacoes) {
        throw new Error('Resposta inválida do serviço de frete');
      }
      // Filtra cotações com erro e mapeia apenas as válidas
      const cotacoesValidas = resp.cotacoes
        .filter((quote: any) => !quote.error)
        .map((quote: any) => ({
          service_id: quote.id,
          transportadora: quote.company.name,
          modalidade: quote.name,
          prazo: `${quote.delivery_time} dias úteis`,
          preco: Number(quote.price),
          raw_response: quote
        }));

      if (cotacoesValidas.length === 0) {
        throw new Error('Nenhuma opção de frete disponível para este endereço');
      }

      setCotacoes(cotacoesValidas);
    } catch (err) {
      console.error('Erro ao calcular frete:', err);
      toast({ 
        title: 'Erro', 
        description: err instanceof Error ? err.message : 'Não foi possível calcular o frete. Tente novamente.',
        variant: 'destructive'
      });
      setCotacaoModal(false);
    } finally {
      setCalculandoFrete(false);
    }
  };

  const handleSelectCotacao = async (cotacao: CotacaoFrete) => {
    try {
      const updateData: any = {
        frete_melhor_envio: {
          transportadora: cotacao.transportadora,
          modalidade: cotacao.modalidade,
          prazo: cotacao.prazo,
          preco: cotacao.preco,
          service_id: cotacao.service_id,
          raw_response: cotacao.raw_response
        }
      };

      // Se vier o melhorEnvioId, adicionar ao update
      if (cotacao.melhorEnvioId) {
        updateData.id_melhor_envio = cotacao.melhorEnvioId;
        updateData.carrinho_me = true;
      }

      const { error } = await supabase
        .from('pedidos')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Frete selecionado e salvo no pedido' });
      setCotacaoModal(false);
      
      // Recarregar página para atualizar dados
      navigate(0);
    } catch (err) {
      console.error('Erro ao salvar frete:', err);
      toast({ 
        title: 'Erro', 
        description: 'Não foi possível salvar o frete selecionado',
        variant: 'destructive'
      });
    }
  };

  const handleEnviarMaisBarato = async () => {
    if (!pedido) {
      toast({ title: 'Erro', description: 'Pedido não carregado', variant: 'destructive' });
      return;
    }

    try {
      setCalculandoFrete(true);

      // Chamar a edge function processar_etiqueta_em_envio_de_pedido
      const { data: response, error: functionError } = await supabase.functions.invoke('processar_etiqueta_em_envio_de_pedido', {
        body: { pedido_id: pedido.id, empresa_id: empresaId }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Erro ao processar etiqueta');
      }

      // Atualizar o status_id do pedido para 3473cae9-47c8-4b85-96af-b41fe0e15fa9
      const { error: updateError } = await supabase
        .from('pedidos')
        .update({ 
          status_id: '3473cae9-47c8-4b85-96af-b41fe0e15fa9',
          atualizado_em: new Date().toISOString()
        } as any)
        .eq('id', pedido.id);

      if (updateError) throw updateError;

      toast({ 
        title: 'Sucesso', 
        description: 'Etiqueta processada e pedido atualizado com sucesso' 
      });
      
      // Recarregar a página para atualizar os dados
      navigate(0);
    } catch (err: any) {
      console.error('Erro ao processar etiqueta:', err);
      toast({ 
        title: 'Erro', 
        description: err?.message || String(err), 
        variant: 'destructive' 
      });
    } finally {
      setCalculandoFrete(false);
    }
  };

  const handleGerarEtiquetaML = async () => {
    if (!pedido?.id_externo) {
      toast({ 
        title: 'Erro', 
        description: 'O pedido não possui ID externo (id_externo) definido',
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
        body: JSON.stringify({ id_externo: pedido.id_externo }),
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

  const handleImprimirEtiquetaML = () => {
    if (!etiquetaMLPdfUrl) return;
    
    // Abre o PDF em nova janela e imprime
    const printWindow = window.open(etiquetaMLPdfUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
  };

  const handleFecharModalEtiquetaML = () => {
    if (etiquetaMLPdfUrl) {
      URL.revokeObjectURL(etiquetaMLPdfUrl);
    }
    setEtiquetaMLPdfUrl(null);
    setEtiquetaMLModalOpen(false);
  };

  const handleDeletePedido = async () => {
    if (!pedido) return;
    try {
      // delete itens_pedido first
      const { error: delItemsErr } = await supabase.from('itens_pedido').delete().eq('pedido_id', pedido.id);
      if (delItemsErr) throw delItemsErr;
      // delete pedido
      const { error: delPedidoErr } = await supabase.from('pedidos').delete().eq('id', pedido.id);
      if (delPedidoErr) throw delPedidoErr;
      toast({ title: 'Pedido excluído', description: 'Pedido e itens removidos com sucesso.' });
      setDeleteConfirmOpen(false);
      navigate('/?module=comercial');
    } catch (err: any) {
      console.error('Erro ao excluir pedido:', err);
      toast({ title: 'Erro ao excluir', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  /**
   * 🟢 INTEGRAÇÃO COM BLING - Fluxo completo
   * 
   * Este fluxo segue rigorosamente a ordem:
   * 1. Consultar cliente no Bling
   * 2. Criar ou editar cliente conforme necessário
   * 3. Criar pedido no Bling
   * 4. Consultar pedido para verificar duplicidade
   * 5. Editar pedido se necessário
   */
  const integrarComBling = async () => {
    if (!pedido || !pedido.cliente) {
      toast({
        title: 'Erro',
        description: 'Pedido ou cliente não encontrado',
        variant: 'destructive'
      });
      return;
    }

    setIntegrandoBling(true);

    try {
      // 📋 Preparar dados do cliente
      const documento = pedido.cliente.cpf || pedido.cliente.cnpj;
      
      // Validar documento obrigatório
      if (!documento) {
        throw new Error('Cliente não possui CPF/CNPJ cadastrado');
      }

      // Determinar tipo de pessoa (F = Física, J = Jurídica)
      const tipo = documento.length === 11 ? 'F' : 'J';
      
      // Limpar telefone (remover caracteres especiais e deixar apenas números)
      const telefoneLimpo = (pedido.cliente.telefone || '').replace(/\D/g, '');
      
      // Preparar telefones no formato que o Bling espera (array de objetos)
      const telefones = [];
      if (telefoneLimpo && telefoneLimpo.length >= 10) {
        telefones.push({
          numero: telefoneLimpo,
          tipo: 1 // 1 = Celular, 2 = Fixo, 3 = Comercial
        });
      }
      
      const clienteData = {
        nome: pedido.cliente.nome,
        tipo: tipo, // F = Pessoa Física, J = Pessoa Jurídica
        numeroDocumento: documento, // Campo correto na API Bling v3
        situacao: 'A', // A = Ativo
        email: pedido.cliente.email,
        telefones: telefones, // Array de telefones
        endereco: {
          endereco: pedido.cliente.endereco,
          numero: pedido.cliente.numero || 'S/N', // Se vazio, envia "S/N" (Sem Número)
          complemento: pedido.cliente.complemento,
          bairro: pedido.cliente.bairro,
          municipio: pedido.cliente.cidade,
          uf: pedido.cliente.estado,
          cep: pedido.cliente.cep
        }
      };

      // 1️⃣ CONSULTAR CLIENTE NO BLING
      console.log('🔍 Consultando cliente no Bling...');
      
      let consultaCliente = null;
      let contatoId: string | null = null;
      
      try {
        const { data, error } = await supabase.functions.invoke('consultar_cliente_bling', {
          body: { documento: documento }
        });

        if (!error && data) {
          consultaCliente = data;
          console.log('📋 Resultado da consulta cliente:', consultaCliente);
        } else {
          console.log('⚠️ Cliente não encontrado, será criado um novo');
        }
      } catch (err) {
        console.log('⚠️ Erro na consulta cliente (será criado um novo):', err);
      }

      // 2️⃣ CRIAR OU EDITAR CLIENTE
      if (consultaCliente?.existe === true && consultaCliente?.contato_id) {
        // Cliente já existe - EDITAR
        contatoId = consultaCliente.contato_id;
        console.log('✏️ Cliente existe. Atualizando dados...', contatoId);

        try {
          const { error: erroEdicao } = await supabase.functions.invoke('editar_cliente_bling', {
            body: {
              contato_id: contatoId,
              ...clienteData
            }
          });

          if (!erroEdicao) {
            console.log('✅ Cliente atualizado com sucesso');
          } else {
            console.warn('⚠️ Erro ao editar cliente, mas continuando:', erroEdicao);
          }
        } catch (editError) {
          console.warn('⚠️ Erro ao editar cliente, mas continuando:', editError);
        }
      } else {
        // Cliente não existe - CRIAR
        console.log('➕ Cliente não existe. Criando novo...');

        const { data: novoCl, error: erroCriacao } = await supabase.functions.invoke('criar_cliente_bling', {
          body: clienteData
        });

        if (erroCriacao) {
          throw new Error(`Erro ao criar cliente: ${erroCriacao.message}`);
        }

        contatoId = novoCl?.contato_id;
        if (!contatoId) {
          throw new Error('Falha ao obter ID do cliente criado');
        }

        console.log('✅ Cliente criado com sucesso:', contatoId);
      }

      // Validar contatoId antes de prosseguir
      if (!contatoId) {
        throw new Error('Não foi possível obter o ID do cliente no Bling');
      }

      // 📦 Preparar itens do pedido no formato da API Bling v3
      const itensPedido = (pedido.itens || []).map((item: any) => {
        const itemData: any = {
          descricao: item.variacao?.nome 
            ? `${item.produto?.nome} - ${item.variacao.nome}` 
            : (item.produto?.nome || 'Produto'),
          quantidade: Number(item.quantidade || 1),
          valor: Number(item.preco_unitario || item.produto?.preco || 0),
          tipo: 'P', // P = Produto
          unidade: 'UN' // Unidade de medida
        };
        
        // Priorizar bling_id da variação, se não tiver usar do produto
        const blingId = item.variacao?.bling_id || item.produto?.bling_id;
        
        if (blingId) {
          itemData.produto = { id: blingId };
        }
        
        return itemData;
      });

      // Validar se há itens
      if (itensPedido.length === 0) {
        throw new Error('Pedido não possui itens');
      }

      // 📋 Preparar dados do pedido no formato da API Bling v3
      const pedidoData = {
        contato: {
          id: contatoId // ID do contato no Bling
        },
        numero: pedido.id_externo || pedido.id.substring(0, 8),
        data: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        itens: itensPedido,
        transporte: {
          frete_por_conta: 1, // 1 = Remetente
          transportadora: {
            nome: pedido.frete_melhor_envio?.transportadora || 'Não especificado'
          },
          valor_frete: Number(pedido.frete_me || 0)
        },
        observacoes: pedido.observacoes || ''
      };

      // 5️⃣ CONSULTAR SE PEDIDO JÁ EXISTE (verificação de duplicidade)
      console.log('🔍 Verificando se pedido já existe no Bling...');
      
      let consultaPedido = null;
      
      try {
        const { data, error } = await supabase.functions.invoke('consultar_pedido_bling', {
          body: { 
            documento: clienteData.numeroDocumento,
            numero_loja: pedidoData.numero
          }
        });

        if (!error && data) {
          consultaPedido = data;
          console.log('📋 Resultado da consulta pedido:', consultaPedido);
        } else {
          console.log('⚠️ Pedido não encontrado, será criado um novo');
        }
      } catch (err) {
        console.log('⚠️ Erro na consulta pedido (será criado um novo):', err);
      }

      if (consultaPedido?.existe === true && consultaPedido?.id_pedido_venda) {
        // 6️⃣ PEDIDO JÁ EXISTE - EDITAR
        console.log('✏️ Pedido já existe. Atualizando...', consultaPedido.id_pedido_venda);

        const { error: erroEdicaoPedido } = await supabase.functions.invoke('editar_pedido_bling', {
          body: {
            id_pedido_venda: consultaPedido.id_pedido_venda,
            ...pedidoData
          }
        });

        if (erroEdicaoPedido) {
          throw new Error(`Erro ao editar pedido: ${erroEdicaoPedido.message}`);
        }

        toast({
          title: '✅ Pedido atualizado no Bling',
          description: `Pedido ${pedidoData.numero} foi atualizado com sucesso`
        });

        console.log('✅ Pedido editado com sucesso');
      } else {
        // 4️⃣ CRIAR NOVO PEDIDO
        console.log('➕ Criando novo pedido no Bling...');

        const { error: erroCriacaoPedido } = await supabase.functions.invoke('criar_pedido_bling', {
          body: pedidoData
        });

        if (erroCriacaoPedido) {
          throw new Error(`Erro ao criar pedido: ${erroCriacaoPedido.message}`);
        }

        toast({
          title: '✅ Pedido enviado ao Bling',
          description: `Pedido ${pedidoData.numero} criado com sucesso`
        });

        console.log('✅ Pedido criado com sucesso');
      }

      // ✅ Sucesso total
      console.log('🎉 Integração com Bling concluída com sucesso!');

    } catch (error: any) {
      console.error('❌ Erro na integração com Bling:', error);
      
      toast({
        title: 'Erro na integração com Bling',
        description: error.message || 'Não foi possível integrar com o Bling. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setIntegrandoBling(false);
    }
  };

  /**
   * 🟢 INTEGRAÇÃO COM BLING + NF-E - Fluxo completo com geração de nota fiscal
   * 
   * Este fluxo segue rigorosamente a ordem:
   * 1. Consultar cliente no Bling
   * 2. Criar ou editar cliente conforme necessário
   * 3. Criar pedido no Bling
   * 4. Consultar pedido para verificar duplicidade
   * 5. Editar pedido se necessário
   * 6. Gerar nota fiscal (função a ser implementada)
   */
  const integrarComBlingNFe = async () => {
    if (!pedido || !pedido.cliente) {
      toast({
        title: 'Erro',
        description: 'Pedido ou cliente não encontrado',
        variant: 'destructive'
      });
      return;
    }

    setIntegrandoBlingNFe(true);

    try {
      // 📋 Preparar dados do cliente
      const documento = pedido.cliente.cpf || pedido.cliente.cnpj;
      
      // Validar documento obrigatório
      if (!documento) {
        throw new Error('Cliente não possui CPF/CNPJ cadastrado');
      }

      // Determinar tipo de pessoa (F = Física, J = Jurídica)
      const tipo = documento.length === 11 ? 'F' : 'J';
      
      // Limpar telefone (remover caracteres especiais e deixar apenas números)
      const telefoneLimpo = (pedido.cliente.telefone || '').replace(/\D/g, '');
      
      // Preparar telefones no formato que o Bling espera (array de objetos)
      const telefones = [];
      if (telefoneLimpo && telefoneLimpo.length >= 10) {
        telefones.push({
          numero: telefoneLimpo,
          tipo: 1 // 1 = Celular, 2 = Fixo, 3 = Comercial
        });
      }
      
      const clienteData = {
        nome: pedido.cliente.nome,
        tipo: tipo, // F = Pessoa Física, J = Pessoa Jurídica
        numeroDocumento: documento, // Campo correto na API Bling v3
        situacao: 'A', // A = Ativo
        email: pedido.cliente.email,
        telefones: telefones, // Array de telefones
        endereco: {
          endereco: pedido.cliente.endereco,
          numero: pedido.cliente.numero || 'S/N', // Se vazio, envia "S/N" (Sem Número)
          complemento: pedido.cliente.complemento,
          bairro: pedido.cliente.bairro,
          municipio: pedido.cliente.cidade,
          uf: pedido.cliente.estado,
          cep: pedido.cliente.cep
        }
      };

      // 1️⃣ CONSULTAR CLIENTE NO BLING
      console.log('🔍 Consultando cliente no Bling...');
      
      let consultaCliente = null;
      let contatoId: string | null = null;
      
      try {
        const { data, error } = await supabase.functions.invoke('consultar_cliente_bling', {
          body: { documento: documento }
        });

        if (!error && data) {
          consultaCliente = data;
          console.log('📋 Resultado da consulta cliente:', consultaCliente);
        } else {
          console.log('⚠️ Cliente não encontrado, será criado um novo');
        }
      } catch (err) {
        console.log('⚠️ Erro na consulta cliente (será criado um novo):', err);
      }

      // 2️⃣ CRIAR OU EDITAR CLIENTE
      if (consultaCliente?.existe === true && consultaCliente?.contato_id) {
        // Cliente já existe - EDITAR
        contatoId = consultaCliente.contato_id;
        console.log('✏️ Cliente existe. Atualizando dados...', contatoId);

        try {
          const { error: erroEdicao } = await supabase.functions.invoke('editar_cliente_bling', {
            body: {
              contato_id: contatoId,
              ...clienteData
            }
          });

          if (!erroEdicao) {
            console.log('✅ Cliente atualizado com sucesso');
          } else {
            console.warn('⚠️ Erro ao editar cliente, mas continuando:', erroEdicao);
          }
        } catch (editError) {
          console.warn('⚠️ Erro ao editar cliente, mas continuando:', editError);
        }
      } else {
        // Cliente não existe - CRIAR
        console.log('➕ Cliente não existe. Criando novo...');

        const { data: novoCl, error: erroCriacao } = await supabase.functions.invoke('criar_cliente_bling', {
          body: clienteData
        });

        if (erroCriacao) {
          throw new Error(`Erro ao criar cliente: ${erroCriacao.message}`);
        }

        contatoId = novoCl?.contato_id;
        if (!contatoId) {
          throw new Error('Falha ao obter ID do cliente criado');
        }

        console.log('✅ Cliente criado com sucesso:', contatoId);
      }

      // Validar contatoId antes de prosseguir
      if (!contatoId) {
        throw new Error('Não foi possível obter o ID do cliente no Bling');
      }

      // 📦 Preparar itens do pedido no formato da API Bling v3
      const itensPedido = (pedido.itens || []).map((item: any) => {
        const itemData: any = {
          descricao: item.variacao?.nome 
            ? `${item.produto?.nome} - ${item.variacao.nome}` 
            : (item.produto?.nome || 'Produto'),
          quantidade: Number(item.quantidade || 1),
          valor: Number(item.preco_unitario || item.produto?.preco || 0),
          tipo: 'P', // P = Produto
          unidade: 'UN' // Unidade de medida
        };
        
        // Priorizar bling_id da variação, se não tiver usar do produto
        const blingId = item.variacao?.bling_id || item.produto?.bling_id;
        
        if (blingId) {
          itemData.produto = { id: blingId };
        }
        
        return itemData;
      });

      // Validar se há itens
      if (itensPedido.length === 0) {
        throw new Error('Pedido não possui itens');
      }

      // 📋 Preparar dados do pedido no formato da API Bling v3
      const pedidoData = {
        contato: {
          id: contatoId // ID do contato no Bling
        },
        numero: pedido.id_externo || pedido.id.substring(0, 8),
        data: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        itens: itensPedido,
        transporte: {
          frete_por_conta: 1, // 1 = Remetente
          transportadora: {
            nome: pedido.frete_melhor_envio?.transportadora || 'Não especificado'
          },
          valor_frete: Number(pedido.frete_me || 0)
        },
        observacoes: pedido.observacoes || ''
      };

      // 5️⃣ CONSULTAR SE PEDIDO JÁ EXISTE (verificação de duplicidade)
      console.log('🔍 Verificando se pedido já existe no Bling...');
      
      let consultaPedido = null;
      
      try {
        const { data, error } = await supabase.functions.invoke('consultar_pedido_bling', {
          body: { 
            documento: clienteData.numeroDocumento,
            numero_loja: pedidoData.numero
          }
        });

        if (!error && data) {
          consultaPedido = data;
          console.log('📋 Resultado da consulta pedido:', consultaPedido);
        } else {
          console.log('⚠️ Pedido não encontrado, será criado um novo');
        }
      } catch (err) {
        console.log('⚠️ Erro na consulta pedido (será criado um novo):', err);
      }

      if (consultaPedido?.existe === true && consultaPedido?.id_pedido_venda) {
        // 6️⃣ PEDIDO JÁ EXISTE - EDITAR
        console.log('✏️ Pedido já existe. Atualizando...', consultaPedido.id_pedido_venda);

        const { error: erroEdicaoPedido } = await supabase.functions.invoke('editar_pedido_bling', {
          body: {
            id_pedido_venda: consultaPedido.id_pedido_venda,
            ...pedidoData
          }
        });

        if (erroEdicaoPedido) {
          throw new Error(`Erro ao editar pedido: ${erroEdicaoPedido.message}`);
        }

        console.log('✅ Pedido editado com sucesso');
      } else {
        // 4️⃣ CRIAR NOVO PEDIDO
        console.log('➕ Criando novo pedido no Bling...');

        const { error: erroCriacaoPedido } = await supabase.functions.invoke('criar_pedido_bling', {
          body: pedidoData
        });

        if (erroCriacaoPedido) {
          throw new Error(`Erro ao criar pedido: ${erroCriacaoPedido.message}`);
        }

        console.log('✅ Pedido criado com sucesso');
      }

      // 🧾 GERAR NOTA FISCAL
      console.log('📄 Gerando nota fiscal no Bling...');
      
      try {
        // Obter o ID do pedido no Bling (seja da consulta ou do recém criado)
        let idPedidoVenda = consultaPedido?.id_pedido_venda;
        
        // Se não temos o ID do pedido ainda, precisamos consultar novamente
        if (!idPedidoVenda) {
          console.log('🔍 Consultando ID do pedido recém criado...');
          const { data: novaconsulta, error: errorconsulta } = await supabase.functions.invoke('consultar_pedido_bling', {
            body: { 
              documento: documento,
              numero_loja: pedidoData.numero
            }
          });
          
          if (!errorconsulta && novaconsulta?.id_pedido_venda) {
            idPedidoVenda = novaconsulta.id_pedido_venda;
          }
        }
        
        if (!idPedidoVenda) {
          throw new Error('Não foi possível obter o ID do pedido no Bling para gerar a NF-e');
        }
        
        console.log('📋 Gerando NF-e para pedido Bling ID:', idPedidoVenda);
        
        // Chamar a API de geração de NF-e
        const response = await fetch('https://rllypkctvckeaczjesht.supabase.co/functions/v1/gerar_nfe_bling', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            pedido_id: idPedidoVenda 
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao gerar nota fiscal');
        }

        const nfeData = await response.json();
        console.log('✅ NF-e gerada com sucesso:', nfeData);
        
        toast({
          title: '✅ Pedido e NF-e criados!',
          description: 'Pedido integrado ao Bling e nota fiscal gerada com sucesso.',
        });
      } catch (nfeError: any) {
        console.error('❌ Erro ao gerar nota fiscal:', nfeError);
        toast({
          title: '⚠️ Pedido criado, erro na NF-e',
          description: nfeError.message || 'Pedido foi criado no Bling, mas houve erro ao gerar a nota fiscal.',
          variant: 'destructive'
        });
      }

      // ✅ Sucesso total
      console.log('🎉 Integração com Bling + NF-e concluída!');

    } catch (error: any) {
      console.error('❌ Erro na integração com Bling NF-e:', error);
      
      toast({
        title: 'Erro na integração com Bling NF-e',
        description: error.message || 'Não foi possível integrar com o Bling. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setIntegrandoBlingNFe(false);
    }
  };

  if (!id) return <div className="p-6">Pedido inválido</div>;

  return (
    <>
      <AppHeader activeModule="contabilidade" onModuleChange={(m) => navigate('/?module=' + m)} />
      <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar of responsible user */}
          {pedido?.responsavel?.img_url ? (
            <img src={pedido.responsavel.img_url} alt={pedido?.responsavel?.nome || 'Responsável'} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-700">
              {pedido?.responsavel?.nome ? pedido.responsavel.nome.split(' ').map((n: string) => n[0]).slice(0,2).join('') : '—'}
            </div>
          )}

          <div>
            <button onClick={() => {
              // Sempre redirecionar para Comercial
              navigate('/?module=comercial');
            }} className="text-sm text-muted-foreground hover:underline">&lt; Ver todos os pedidos</button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Pedido: {pedido?.id_externo || '—'}</h1>
              {pedido?.tempo_ganho && pedido?.criado_em && (() => {
                const criadoEm = new Date(pedido.criado_em);
                const tempoGanho = new Date(pedido.tempo_ganho);
                const hoje = new Date();
                
                // Resetar horas para comparação apenas de datas
                criadoEm.setHours(0, 0, 0, 0);
                tempoGanho.setHours(0, 0, 0, 0);
                hoje.setHours(0, 0, 0, 0);
                
                // Calcular dias restantes
                const diasRestantes = Math.ceil((tempoGanho.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <span className="text-red-600 font-semibold text-lg">
                    {diasRestantes > 0 ? `${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'} para o envio` : 'Prazo vencido'}
                  </span>
                );
              })()}
            </div>
            <p className="text-sm text-muted-foreground">em {pedido?.criado_em ? new Date(pedido.criado_em).toLocaleString('pt-BR') : '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge style={{ backgroundColor: pedido?.status?.corHex }}>
            {pedido?.status?.nome}
          </Badge>
          {/* Liberar Pedido button: visible only when pedido_liberado is falsy AND there's at least 1 product without up_cell */}
          {!readonly && pedido && !pedido?.pedido_liberado && (() => {
            // Check if there's at least one product that is NOT up_cell
            const hasNonUpCellProduct = (pedido.itens || []).some((it: any) => {
              const isUpCell = it.produto?.up_cell === true;
              return !isUpCell;
            });
            // Only show button if there's at least one non-up_cell product
            return hasNonUpCellProduct;
          })() && (
            <Button
              onClick={async () => {
                if (!pedido) return;
                
                // Check for pending up-sell products (status_up_sell === 1 or null for up_cell products)
                const pendingProducts = (pedido.itens || []).filter((it: any) => {
                  if (!it.produto?.up_cell) return false;
                  return !it.status_up_sell || it.status_up_sell === 1;
                });
                
                if (pendingProducts.length > 0) {
                  setPendingUpSellProducts(pendingProducts);
                  setPendingUpSellAlertOpen(true);
                  return;
                }
                
                try {
                  setLiberando(true);
                  const { error } = await supabase
                    .from('pedidos')
                    .update({ pedido_liberado: true, atualizado_em: new Date().toISOString() } as any)
                    .eq('id', pedido.id);
                  if (error) throw error;
                  // update local state so button disappears
                  setPedido((p: any) => ({ ...p, pedido_liberado: true }));
                  toast({ title: 'Pedido liberado', description: 'Pedido liberado com sucesso' });
                } catch (err: any) {
                  console.error('Erro ao liberar pedido:', err);
                  toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
                } finally {
                  setLiberando(false);
                }
              }}
              className="inline-flex items-center gap-2"
              style={{ backgroundColor: '#00C853', color: '#fff' }}
            >
              {liberando ? (
                <div className="animate-spin h-4 w-4 border-2 border-b-transparent rounded-full" />
              ) : (
                <span>🔓</span>
              )}
              <span>Liberar Pedido</span>
            </Button>
          )}
          {!readonly && pedido && (
            <>
              <Button 
                variant="outline" 
                className="bg-green-600 hover:bg-green-700 text-white border-green-600 h-full"
                onClick={integrarComBling}
                disabled={integrandoBling}
              >
                {integrandoBling ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-b-transparent rounded-full mr-2" />
                    Integrando...
                  </>
                ) : (
                    <>
                      <img src="/bling-vindi.png" alt="Bling Vindi" className="h-5" />
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 h-full"
                onClick={integrarComBlingNFe}
                disabled={integrandoBlingNFe}
              >
                {integrandoBlingNFe ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-b-transparent rounded-full mr-2" />
                    Gerando NF-e...
                  </>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3">
                      <img src="/bling-vindi.png" alt="Bling Vindi" className="h-5" />
                      <span className="text-sm font-thin">Gerar NF-e</span>
                  </div>
                )}
              </Button>
              <Button variant="ghost" className="text-red-600" onClick={() => setDeleteConfirmOpen(true)}>
                <Trash className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div>
        <Card>
          <CardContent className="flex flex-col lg:flex-row gap-6 items-stretch pt-6">
            <div className="flex-1 flex gap-8 items-start h-full">
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">CLIENTE</div>
                  <div className="font-medium text-lg flex items-center gap-2">
                        {pedido?.cliente ? (
                      <>
                        <a className="text-blue-600 hover:underline">{pedido.cliente.nome}</a>
                        {!readonly && (
                          <button onClick={() => setClientEditOpen(true)} className="inline-flex items-center justify-center rounded p-1 hover:bg-gray-100">
                            <Edit className="h-4 w-4 text-gray-600" />
                          </button>
                        )}
                      </>
                    ) : '—'}
                  </div>
                <div className="text-sm text-muted-foreground">{pedido?.cliente?.email}</div>
                <div className="mt-2 text-sm">{pedido?.cliente?.telefone && (<span className="text-blue-600">{pedido.cliente.telefone}</span>)}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {pedido?.cliente?.cpf ? (<div>CPF: {pedido.cliente.cpf}</div>) : pedido?.cliente?.cnpj ? (<div>CNPJ: {pedido.cliente.cnpj}</div>) : null}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">IP da compra: {pedido?.ip || '—'}</div>
              </div>

              <div className="w-48">
                <div className="text-sm text-muted-foreground">PAGAMENTO</div>
                  <div className="mt-2">{
                    // prefer text field 'pagamento', then lookup by id_pagamento, then fallback
                    pedido?.pagamento || (pedido?.id_pagamento && (paymentMethods ? paymentMethods[pedido.id_pagamento] : ( {
                      1: 'Pix',
                      2: 'Boleto',
                      3: 'Cartão'
                    }[pedido.id_pagamento] )) ) || '—'
                  }</div>
              </div>

              <div className="w-56">
                <div className="text-sm text-muted-foreground">ENTREGA</div>
                <div className="font-medium">{pedido?.cliente?.nome || pedido?.cliente_nome}</div>
                <div className="text-sm">{formatAddress(pedido?.cliente)}</div>
                <div className="mt-2 text-sm text-muted-foreground">Prazo: 0 dias</div>
                <div className="text-sm text-muted-foreground">Data prevista: {pedido?.data_prevista || '—'}</div>
                {/* Link do formulário de entrega: botão de copiar antes do texto, sem input auxiliar */}
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const clientId = pedido?.cliente?.id || (pedido as any)?.cliente_id || null;
                      if (!clientId) {
                        toast({ title: 'Erro', description: 'Cliente sem ID para gerar link', variant: 'destructive' });
                        return;
                      }
                      const url = `${window.location.origin}/informacoes-entrega/${clientId}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast({ title: 'Link copiado', description: 'Rota de informações de entrega copiada para a área de transferência' });
                      } catch (err) {
                        console.error('Erro ao copiar link:', err);
                        toast({ title: 'Erro', description: 'Não foi possível copiar o link', variant: 'destructive' });
                      }
                    }}
                    className="inline-flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <div className="text-sm text-muted-foreground">Link formulário de entrega</div>
                </div>
              </div>
            </div>

            <div className="border-l pl-6 flex-shrink-0 w-full lg:w-64 h-full">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">VALOR TOTAL</div>
                  {!readonly && (
                    <button
                      onClick={() => {
                        setTempValorTotal(((pedido?.valor_total ?? pedido?.total) || 0).toFixed(2));
                        setEditValorTotalOpen(true);
                      }}
                      className="text-gray-500 hover:text-purple-700 transition-colors"
                      title="Editar valor total"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="text-2xl font-bold">R$ {((pedido?.valor_total ?? pedido?.total) ? Number(pedido?.valor_total ?? pedido?.total).toFixed(2) : '0,00')}</div>

              <div className="mt-4">
                <div className="text-sm text-muted-foreground">Frete: Venda</div>
                {
                  (() => {
                    // Prefer valor_frete_yampi when populated, then frete_venda, otherwise zero
                    const raw = pedido?.valor_frete_yampi ?? pedido?.frete_venda ?? 0;
                    const num = Number(raw) || 0;
                    return <Input value={num.toFixed(2)} readOnly />;
                  })()
                }
              </div>

              <div className="mt-3">
                <div className="text-sm text-muted-foreground">Frete: Melhor Envio</div>
                <Input value={pedido?.frete_me ? String(pedido.frete_me) : '0,00'} readOnly />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Produtos</CardTitle>
                <Button className="bg-purple-700 text-white" onClick={() => { if (!readonly) setAddProductsVisible(true); }} disabled={readonly}>Adicionar Produto</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Valor unit.</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead className="text-center">Up-Sell</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedido?.itens?.length ? (() => {
                    // group items by produto id + variacao id + preco_unitario to combine equal items
                    // BUT DO NOT group items with up_cell=true (they must remain separate for individual up-sell)
                    const grouped: Record<string, any> = {};
                    const ungrouped: any[] = [];
                    
                    (pedido.itens || []).forEach((it: any) => {
                      // If product has up_cell, don't group it
                      if (it.produto?.up_cell) {
                        ungrouped.push({ ...it, quantidade: Number(it.quantidade || 1), _sourceIds: [it.id] });
                        return;
                      }
                      
                      const prodId = it.produto?.id || it.produto_id || '';
                      const varId = it.variacao?.id || it.variacao_id || '';
                      const price = String(it.preco_unitario ?? it.preco ?? 0);
                      const key = `${prodId}::${varId}::${price}`;
                      if (!grouped[key]) {
                        grouped[key] = { ...it, quantidade: Number(it.quantidade || 0), _sourceIds: [it.id] };
                      } else {
                        grouped[key].quantidade = Number(grouped[key].quantidade || 0) + Number(it.quantidade || 0);
                        grouped[key]._sourceIds.push(it.id);
                      }
                    });
                    
                    const groupedArray = [...Object.values(grouped), ...ungrouped];
                    return groupedArray.map((item: any) => (
                    <TableRow key={item._sourceIds?.[0] || item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {item.produto?.img_url || item.variacao?.img_url ? (
                            <img src={item.variacao?.img_url || item.produto?.img_url} alt={item.produto?.nome || item.variacao?.nome} className="w-10 h-10 rounded object-cover" />
                          ) : null}
                          <div>
                            <div className="font-medium">{item.produto?.nome || 'Produto'}</div>
                            {item.variacao?.nome && (
                              <div className="text-sm text-muted-foreground">{item.variacao.nome}</div>
                            )}
                            <div className="text-xs text-muted-foreground">SKU: {item.variacao?.sku || item.produto?.sku || '-'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{item.variacao?.sku || item.produto?.sku || ''}</TableCell>
                      <TableCell>{item.quantidade}</TableCell>
                      <TableCell>R$ {Number(item.preco_unitario || item.produto?.preco || 0).toFixed(2)}</TableCell>
                      <TableCell>R$ {(Number(item.preco_unitario || item.produto?.preco || 0) * Number(item.quantidade || 0)).toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        {item.produto?.up_cell ? (
                          <div className="flex items-center justify-center gap-2">
                            {/* Show buttons only if status_up_sell is 1 (Aguardando aumento) or null */}
                            {(!item.status_up_sell || item.status_up_sell === 1) && (
                              <>
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (readonly) return;
                                    setIsNormalFlow(true);
                                    setIsAumentoGratis(false);
                                    setUpSellSourceItem(item);
                                    setUpSellModalOpen(true);
                                  }}
                                >
                                  UpSell
                                </Button>
                                <Button 
                                  size="sm" 
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (readonly) return;
                                    setItemToKeep(item);
                                    setConfirmManterOpen(true);
                                  }}
                                >
                                  Manter
                                </Button>
                              </>
                            )}
                            {/* Show only badge if status is not "Aguardando aumento" */}
                            {item.status_up_sell && item.status_up_sell !== 1 && statusUpSellMap[item.status_up_sell] && (
                              <Badge className="bg-green-100 text-green-700 border-green-300">
                                {statusUpSellMap[item.status_up_sell]}
                              </Badge>
                            )}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" className="text-red-600" onClick={(e) => { e.stopPropagation(); if (readonly) return; /* target first source id for removal modal */ const toRemove = { ...item, id: (item._sourceIds && item._sourceIds[0]) || item.id }; setProductToRemove(toRemove); setRemoveValueStr(formatCurrencyBR((Number(item.preco_unitario || item.produto?.preco || 0) * Number(item.quantidade || 1)) || 0)); setRemoveModalOpen(true); }}>
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    ))
                  })() : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nenhum produto</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modais de gerenciamento */}
  <Dialog open={remetentesVisible} onOpenChange={(open) => { if (!readonly) setRemetentesVisible(open); }}>
        <DialogContent className="max-w-4xl">
          <RemetentesManager />
        </DialogContent>
      </Dialog>

  <Dialog open={deleteConfirmOpen} onOpenChange={(open) => { if (!readonly) setDeleteConfirmOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Pedido</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <h3 className="text-lg font-semibold text-red-600">Você tem certeza?</h3>
            <p className="text-sm text-muted-foreground mt-2">Esta ação não poderá ser desfeita.</p>
          </div>
          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancelar</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleDeletePedido}>Sim, quero excluir</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

  <Dialog open={embalagensVisible} onOpenChange={(open) => { if (!readonly) setEmbalagensVisible(open); }}>
        <DialogContent className="max-w-4xl">
          <EmbalagensManager />
        </DialogContent>
      </Dialog>

      {/* Modal: Visualizar e Imprimir Etiqueta ML */}
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

      {/* Modal: Remover item do pedido (informe valor a ser subtraído) */}
      <Dialog open={removeModalOpen} onOpenChange={(open) => { if (!readonly) setRemoveModalOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remover item</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="text-sm text-muted-foreground mb-2">Você está removendo:</div>
            <div className="mb-4">
              <div className="font-medium">{productToRemove?.produto?.nome || productToRemove?.nome || '—'}</div>
              {productToRemove?.variacao?.nome && (
                <div className="text-sm text-muted-foreground">{productToRemove.variacao.nome}</div>
              )}
            </div>

            <label className="block text-sm text-muted-foreground">Valor a subtrair do pedido</label>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-3 py-2 bg-gray-100 rounded-l">R$</span>
              <Input value={removeValueStr} onChange={(e) => setRemoveValueStr(e.target.value)} />
            </div>
            <div className="text-xs text-muted-foreground mt-2">Informe quanto do valor total deve ser removido ao excluir este item.</div>
          </div>
          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button variant="outline" onClick={() => { setRemoveModalOpen(false); setProductToRemove(null); }}>Cancelar</Button>
              <Button className="bg-red-600 text-white" onClick={async () => {
                if (readonly) return;
                if (!productToRemove || !pedido) return;
                setRemovingItem(true);
                try {
                  // Simply delete the item - no need to reset status
                  // When re-added, it will be a NEW item with "Aguardando aumento"
                  const { error: delErr } = await supabase.from('itens_pedido').delete().eq('id', productToRemove.id);
                  if (delErr) throw delErr;

                  const providedValue = parseCurrencyBR(removeValueStr);
                  const currentTotal = Number(pedido?.valor_total ?? pedido?.total ?? 0) || 0;
                  const newTotal = Number(Math.max(0, currentTotal - providedValue).toFixed(2));

                  const { error: updErr } = await supabase.from('pedidos').update({ valor_total: newTotal, atualizado_em: new Date().toISOString() } as any).eq('id', pedido.id);
                  if (updErr) throw updErr;

                  // update local state
                  setPedido((p: any) => p ? ({ ...p, itens: (p.itens || []).filter((i: any) => i.id !== productToRemove.id), valor_total: newTotal }) : p);
                  toast({ title: 'Item removido', description: 'Item removido e valor do pedido atualizado' });
                  setRemoveModalOpen(false);
                  setProductToRemove(null);
                } catch (err: any) {
                  console.error('Erro ao remover item:', err);
                  toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
                } finally {
                  setRemovingItem(false);
                }
              }} disabled={removingItem}>{removingItem ? 'Removendo...' : 'Confirmar remoção'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Adicionar Produtos (copiado do NovoPedido UI pattern) */}
  <Dialog open={addProductsVisible} onOpenChange={(open) => { if (!readonly) setAddProductsVisible(open); }}>
        <DialogContent className="max-w-6xl w-full h-[90vh] flex flex-col">
          <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden" style={{ minHeight: '600px' }}>
            <div className="flex flex-col h-full">
              <Input placeholder="Buscar produto" value={searchModal} onChange={(e) => { setSearchModal(e.target.value); setModalPage(1); }} />
              <div className="flex-1 flex flex-col mt-4" style={{ minHeight: '500px' }}>
                <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                {loadingProdutosModal && <div className="text-sm text-muted-foreground">Carregando produtos...</div>}
                {produtosErrorModal && <div className="text-sm text-destructive">Erro: {produtosErrorModal}</div>}
                {!loadingProdutosModal && !produtosErrorModal && (() => {
                  const filtered = produtosListModal.filter(p => p.nome.toLowerCase().includes(searchModal.toLowerCase()));
                  const totalPages = Math.max(1, Math.ceil(filtered.length / modalPageSize));
                  const startIdx = (modalPage - 1) * modalPageSize;
                  const endIdx = startIdx + modalPageSize;
                  const paginated = filtered.slice(startIdx, endIdx);
                  return (
                    <>
                      {paginated.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 py-2 min-h-[80px]">
                    <img src={p.imagemUrl} alt={p.nome} className="w-12 h-12 rounded flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-purple-700 truncate" title={p.nome}>{p.nome}</div>
                      <div className="text-sm text-muted-foreground">R$ {Number(p.preco || 0).toFixed(2)}</div>
                    </div>

                    <div className="w-48 flex-shrink-0">
                      {p.variacoes && p.variacoes.length > 0 ? (
                        <select className="w-full border rounded p-2" value={variationSelectionsModal[p.id] || ''} onChange={(e) => setVariationSelectionsModal((s) => ({ ...s, [p.id]: e.target.value }))}>
                          {p.variacoes.map((v: any) => (
                            <option key={v.id} value={v.id}>{v.nome} - R$ {Number(v.valor).toFixed(2)}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-sm text-muted-foreground">Sem variações</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm">
                        <input type="checkbox" checked={brindeSelectionsModal[p.id] || false} onChange={(e) => setBrindeSelectionsModal((s) => ({ ...s, [p.id]: e.target.checked }))} />
                        <span className="ml-2">Brinde</span>
                      </label>
                    </div>

                    <div>
                      <Button className="bg-purple-700 text-white" onClick={() => {
                        // add to modal cart (include codigo_barras)
                        const variacaoId = variationSelectionsModal[p.id] || (p.variacoes && p.variacoes[0]?.id) || null;
                        const quantidade = 1;
                        const unitario = variacaoId ? Number((p.variacoes || []).find((v: any) => v.id === variacaoId)?.valor || p.preco || 0) : Number(p.preco || 0);
                        const itemId = variacaoId ? `${p.id}:${variacaoId}` : p.id;
                        const selectedVar = variacaoId ? (p.variacoes || []).find((v: any) => v.id === variacaoId) : null;
                        const barcode = selectedVar?.codigo_barras_v || p.codigo_barras || null;
                        setModalCart(prev => {
                          const existing = prev.find(i => i.id === itemId && !!i.brinde === !!brindeSelectionsModal[p.id]);
                          if (existing) return prev.map(i => i.id === itemId ? { ...i, quantidade: i.quantidade + 1 } : i);
                          return [...prev, { id: itemId, produtoId: p.id, nome: p.nome, quantidade, preco: unitario, imagemUrl: p.imagemUrl, codigo_barras: barcode, brinde: !!brindeSelectionsModal[p.id], up_cell: p.up_cell || false }];
                        });
                      }}>+</Button>
                    </div>
                  </div>
                      ))}
                    </>
                  );
                })()}
                </div>
                <div className="flex items-center justify-between pt-3 mt-3 border-t flex-shrink-0">
                  {(() => {
                    const filtered = produtosListModal.filter(p => p.nome.toLowerCase().includes(searchModal.toLowerCase()));
                    const totalPages = Math.max(1, Math.ceil(filtered.length / modalPageSize));
                    return (
                      <>
                        <div className="text-sm text-muted-foreground">
                          Página {modalPage} de {totalPages}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setModalPage(p => Math.max(1, p - 1))} 
                            disabled={modalPage <= 1}
                          >
                            Anterior
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setModalPage(p => Math.min(totalPages, p + 1))} 
                            disabled={modalPage >= totalPages}
                          >
                            Próximo
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="flex flex-col h-full">
              <div className="text-lg font-semibold">ITENS DO CARRINHO</div>
              <div className="text-sm text-muted-foreground mb-4">{modalCart.length} R$ {modalCart.reduce((s, it) => s + (Number(it.preco || 0) * Number(it.quantidade || 1)), 0).toFixed(2)}</div>
              <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                {modalCart.map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={item.imagemUrl} className="w-10 h-10 rounded" />
                      <div>
                        <div className="font-medium">{item.nome}</div>
                        <div className="text-sm text-muted-foreground">R$ {Number(item.preco || 0).toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm">{item.quantidade}</div>
                      <Button variant="ghost" onClick={() => setModalCart(prev => prev.filter((_, i) => i !== idx))}>Remover</Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end gap-3 flex-shrink-0">
                <Button variant="outline" onClick={() => setAddProductsVisible(false)}>Cancelar</Button>
                <Button className="bg-purple-700 text-white" onClick={() => {
                  // Open the wizard (date/payment/value) before persisting
                  if (!pedido) {
                    toast({ title: 'Erro', description: 'Pedido não carregado', variant: 'destructive' });
                    return;
                  }
                  if (!modalCart.length) {
                    setAddProductsVisible(false);
                    return;
                  }
                  // default value is current modal cart total
                  const total = modalCart.reduce((s, it) => s + (Number(it.preco || 0) * Number(it.quantidade || 1)), 0);
                  setWizardValueStr(formatCurrencyBR(total));
                  setWizardDate(new Date().toISOString().slice(0,10));
                  setWizardPayment('Pix');
                  setWizardStep(1);
                  setAddProductsVisible(false);
                  setWizardOpen(true);
                }}>Próxima etapa</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wizard: Data -> Forma de Pagamento -> Valor */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{wizardStep === 1 ? 'Selecionar Data' : wizardStep === 2 ? 'Selecionar Forma de Pagamento' : 'Definir Valor'}</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {/* simple step indicator */}
            <div className="flex items-center justify-between mb-4">
              <div className={`flex-1 text-center ${wizardStep >= 1 ? 'font-semibold text-purple-700' : 'text-gray-400'}`}>Data</div>
              <div className={`flex-1 text-center ${wizardStep >= 2 ? 'font-semibold text-purple-700' : 'text-gray-400'}`}>Forma. Pag</div>
              <div className={`flex-1 text-center ${wizardStep >= 3 ? 'font-semibold text-purple-700' : 'text-gray-400'}`}>Valor</div>
            </div>

            {wizardStep === 1 && (
              <div className="text-center">
                <input type="date" className="mx-auto p-2 border rounded" value={wizardDate} onChange={(e) => setWizardDate(e.target.value)} />
                <div className="mt-4 text-sm text-muted-foreground">Você selecionou {wizardDate.split('-').reverse().join('/')}</div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-4">
                  {['Pix','Boleto','Cartão','Outro'].map((m) => (
                    <button key={m} onClick={() => setWizardPayment(m)} className={`px-4 py-2 rounded ${wizardPayment === m ? 'ring-2 ring-purple-500 bg-white' : 'bg-gray-100'}`}>
                      {m}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-sm">Você selecionou <strong>{wizardPayment}</strong></div>
              </div>
            )}

            {wizardStep === 3 && (
              <div>
                <label className="block text-sm text-muted-foreground">Valor da venda</label>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-3 py-2 bg-gray-100 rounded-l">R$</span>
                  <Input value={wizardValueStr} onChange={(e) => setWizardValueStr(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 mt-3"><input type="checkbox" /> Pagamento não integral</label>
              </div>
            )}
          </div>

          <DialogFooter>
            <div className="flex justify-between w-full">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  // Cancel wizard and reopen addProducts modal for editing
                  setWizardOpen(false);
                  setAddProductsVisible(true);
                }}>Cancelar</Button>
                {wizardStep > 1 && <Button variant="ghost" onClick={() => setWizardStep(w => Math.max(1, w-1))}>Voltar</Button>}
              </div>
              <div>
                {wizardStep < 3 ? (
                  <Button className="bg-purple-700 text-white" onClick={() => setWizardStep(s => s + 1)}>Próxima etapa</Button>
                ) : (
                  <Button className="bg-purple-700 text-white" onClick={async () => {
                    // finalize: persist itens_pedido and add value to pedido.valor_total
                    if (!pedido) return;
                    const providedValue = parseCurrencyBR(wizardValueStr);
                    setWizardSaving(true);
                    try {
                      // Get "Aguardando aumento" status ID
                      let aguardandoAumentoId: number | null = null;
                      try {
                        const { data: statusData } = await supabase
                          .from('status_upsell')
                          .select('id')
                          .eq('status', 'Aguardando aumento')
                          .single();
                        
                        if (statusData) {
                          aguardandoAumentoId = statusData.id;
                        }
                      } catch (err) {
                        console.warn('Status "Aguardando aumento" não encontrado:', err);
                      }
                      
                      // Build inserts: expand quantities into individual rows (one per unit)
                      const inserts: any[] = [];
                      for (const it of modalCart) {
                        const [produtoId, variacaoId] = String(it.id).split(':');
                        const qty = Number(it.quantidade || 1);
                        
                        // Buscar dimensões do produto ou variação
                        let dimensoes = { altura: null, largura: null, comprimento: null, peso: null };
                        
                        try {
                          // Se tem variação, buscar da variação primeiro
                          if (variacaoId) {
                            const { data: variacaoData } = await supabase
                              .from('variacoes_produto')
                              .select('altura, largura, comprimento, peso')
                              .eq('id', variacaoId)
                              .maybeSingle();
                            
                            if (variacaoData) {
                              dimensoes = {
                                altura: variacaoData.altura,
                                largura: variacaoData.largura,
                                comprimento: variacaoData.comprimento,
                                peso: variacaoData.peso
                              };
                            }
                          }
                          
                          // Se não tem variação ou a variação não tem dimensões, buscar do produto
                          if (!dimensoes.altura && !dimensoes.peso) {
                            const { data: produtoData } = await supabase
                              .from('produtos')
                              .select('altura, largura, comprimento, peso')
                              .eq('id', it.produtoId || produtoId)
                              .maybeSingle();
                            
                            if (produtoData) {
                              dimensoes = {
                                altura: produtoData.altura,
                                largura: produtoData.largura,
                                comprimento: produtoData.comprimento,
                                peso: produtoData.peso
                              };
                            }
                          }
                        } catch (err) {
                          console.error('Erro ao buscar dimensões:', err);
                        }
                        
                        for (let k = 0; k < qty; k++) {
                          const insertItem: any = {
                            pedido_id: pedido.id,
                            produto_id: it.produtoId || produtoId,
                            variacao_id: variacaoId || null,
                            quantidade: 1,
                            preco_unitario: it.preco || 0,
                            codigo_barras: it.codigo_barras || null,
                            altura: dimensoes.altura,
                            largura: dimensoes.largura,
                            comprimento: dimensoes.comprimento,
                            peso: dimensoes.peso,
                            criado_em: new Date().toISOString(),
                            empresa_id: empresaId || null
                          };
                          
                          // Add "Aguardando aumento" status if product has up_cell
                          if (it.up_cell && aguardandoAumentoId) {
                            insertItem.status_up_sell = aguardandoAumentoId;
                          }
                          
                          inserts.push(insertItem);
                        }
                      }

                      if (inserts.length) {
                        const { error: insErr } = await supabase.from('itens_pedido').insert(inserts as any);
                        if (insErr) throw insErr;
                        
                        // Incrementar contagem dos produtos adicionados
                        const productCounts: Record<string, number> = {};
                        modalCart.forEach(it => {
                          const [produtoId] = String(it.id).split(':');
                          const productId = it.produtoId || produtoId;
                          const qty = Number(it.quantidade || 1);
                          productCounts[productId] = (productCounts[productId] || 0) + qty;
                        });

                        for (const [productId, count] of Object.entries(productCounts)) {
                          const { data: currentProduct } = await supabase
                            .from('produtos')
                            .select('contagem')
                            .eq('id', productId)
                            .single();
                          
                          if (currentProduct) {
                            await supabase
                              .from('produtos')
                              .update({ contagem: (currentProduct.contagem || 0) + count })
                              .eq('id', productId);
                          }
                        }
                      }

                      // update pedido valor_total (add providedValue)
                      const currentTotal = Number(pedido?.valor_total ?? pedido?.total ?? 0) || 0;
                      const newTotal = Number((currentTotal + providedValue).toFixed(2));
                      const { error: updErr } = await supabase.from('pedidos').update({ valor_total: newTotal, atualizado_em: new Date().toISOString() } as any).eq('id', pedido.id);
                      if (updErr) throw updErr;

                      toast({ title: 'Itens adicionados', description: 'Produtos adicionados e valor atualizado no pedido' });
                      setWizardOpen(false);
                      // refresh page
                      navigate(0);
                    } catch (err: any) {
                      console.error('Erro ao persistir itens do modal (wizard):', err);
                      toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
                    } finally {
                      setWizardSaving(false);
                    }
                  }}>Adicionar ({modalCart.length})</Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reusable edit modal for single-field dropdowns */}
      <EditSelectModal
        open={editFieldOpen}
        onOpenChange={(open) => { if (!readonly) setEditFieldOpen(open); }}
        title={editFieldKey === 'status' ? 'Atualizar Status' : editFieldKey === 'plataforma' ? 'Atualizar Plataforma' : editFieldKey === 'responsavel' ? 'Atualizar Responsável' : 'Atualizar Etiqueta'}
        options={editOptions}
        value={editValue}
        onSave={async (selectedId) => {
          if (readonly) {
            toast({ title: 'Somente leitura', description: 'Este pedido é somente leitura e não pode ser alterado.' });
            return;
          }
          if (!pedido) {
            toast({ title: 'Erro', description: 'Pedido não carregado', variant: 'destructive' });
            return;
          }
          try {
            const ENVIADO_STATUS_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';
            const updateData: any = { atualizado_em: new Date().toISOString() };
            if (editFieldKey === 'status') {
              updateData.status_id = selectedId || null;
              // Se o status for alterado para "Enviado", popula data_enviado
              if (selectedId === ENVIADO_STATUS_ID) {
                updateData.data_enviado = new Date().toISOString();
              }
            }
            if (editFieldKey === 'plataforma') updateData.plataforma_id = selectedId || null;
            if (editFieldKey === 'responsavel') updateData.responsavel_id = selectedId || null;
            if (editFieldKey === 'etiqueta') updateData.etiqueta_envio_id = selectedId || null;

            const { error } = await supabase.from('pedidos').update(updateData).eq('id', pedido.id);
            if (error) throw error;

            toast({ title: 'Atualizado', description: 'Campo atualizado com sucesso' });
            setEditFieldOpen(false);
            navigate(0);
          } catch (err: any) {
            console.error('Erro ao atualizar campo do pedido:', err);
            toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
          }
        }}
      />

  {/* Client edit modal (pencil icon) */}
  <ClientEditModal open={clientEditOpen} onOpenChange={(open) => { if (!readonly) setClientEditOpen(open); }} clienteId={pedido?.cliente?.id || (pedido as any)?.cliente_id || null} onSaved={() => navigate(0)} />

      {/* Modal de cotações */}
      <CotacaoFreteModal
        open={cotacaoModal}
        onClose={() => setCotacaoModal(false)}
        onSelect={handleSelectCotacao}
        cotacoes={cotacoes}
        loading={calculandoFrete}
        remetente={selectedRemetente}
        cliente={pedido?.cliente}
        embalagem={selectedEmbalagem}
        insuranceValue={1}
        productName={(pedido?.itens && pedido.itens.length) ? 
          (pedido.itens[0].variacao?.nome ? `${pedido.itens[0].produto?.nome} - ${pedido.itens[0].variacao.nome}` : (pedido.itens[0].produto?.nome || '')) : ''}
        orderProducts={(pedido?.itens || []).map((it: any) => ({
          name: it.variacao?.nome ? `${it.produto?.nome} - ${it.variacao.nome}` : (it.produto?.nome || 'Produto'),
          quantity: Number(it.quantidade || 1),
          unitary_value: Number(it.preco_unitario || it.preco || 0)
        }))}
      />

      {/* Modal para editar valor total */}
      <Dialog open={editValorTotalOpen} onOpenChange={setEditValorTotalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Valor Total</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Valor Total (R$)</label>
              <Input
                type="number"
                step="0.01"
                value={tempValorTotal}
                onChange={(e) => setTempValorTotal(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditValorTotalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                try {
                  const novoValor = parseFloat(tempValorTotal) || 0;
                  const { error } = await supabase
                    .from('pedidos')
                    .update({ 
                      valor_total: novoValor,
                      atualizado_em: new Date().toISOString() 
                    })
                    .eq('id', pedido?.id);

                  if (error) throw error;

                  toast({ 
                    title: 'Sucesso', 
                    description: 'Valor total atualizado com sucesso' 
                  });
                  setEditValorTotalOpen(false);
                  navigate(0); // Recarrega a página
                } catch (err: any) {
                  console.error('Erro ao atualizar valor total:', err);
                  toast({ 
                    title: 'Erro', 
                    description: err?.message || 'Não foi possível atualizar o valor total', 
                    variant: 'destructive' 
                  });
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Up-Sell */}
      <Dialog open={upSellModalOpen} onOpenChange={setUpSellModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">Selecionar Produto Up-Sell</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2">
            {loadingUpSell ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Carregando produtos...</p>
              </div>
            ) : upSellProducts.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Nenhum produto up-sell configurado</p>
              </div>
            ) : (
              upSellProducts.map((prod) => {
                const hasVariations = prod.variacoes_produto && prod.variacoes_produto.length > 0;
                const selectedVarId = selectedVariations[prod.id] || (hasVariations ? prod.variacoes_produto[0].id : null);
                const selectedVar = hasVariations ? prod.variacoes_produto.find((v: any) => v.id === selectedVarId) : null;
                const displayPrice = selectedVar ? selectedVar.valor : prod.preco;
                
                return (
                  <div
                    key={prod.id}
                    className="border rounded-lg p-3 border-gray-300"
                  >
                    <div className="flex items-start gap-3">
                      {(selectedVar?.img_url || prod.img_url) ? (
                        <div className="w-14 h-14 flex-shrink-0">
                          <img
                            src={selectedVar?.img_url || prod.img_url}
                            alt={prod.nome}
                            className="w-full h-full object-cover rounded border"
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 flex-shrink-0 bg-gray-100 rounded border flex items-center justify-center">
                          <span className="text-gray-400 text-[10px]">Sem imagem</span>
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 break-words line-clamp-2 leading-tight">{prod.nome}</div>
                        
                        {hasVariations && (
                          <div className="mt-2">
                            <label className="text-[10px] text-gray-600 mb-1 block">
                              Selecione a variação:
                            </label>
                            <select
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                              value={selectedVarId || ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedVariations(prev => ({
                                  ...prev,
                                  [prod.id]: e.target.value
                                }));
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {prod.variacoes_produto.map((v: any) => (
                                <option key={v.id} value={v.id}>
                                  {v.nome} - R$ {Number(v.valor || 0).toFixed(2)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        <div className="mt-3 flex flex-col gap-2">
                          <Button
                            size="sm"
                            className="w-full bg-green-600 hover:bg-green-700 text-white text-xs py-2"
                            onClick={() => {
                              // Store selected product and open wizard
                              const selectedProduct = {
                                ...prod,
                                selectedVariationId: selectedVarId,
                                selectedVariation: selectedVar,
                                displayPrice: displayPrice
                              };
                              setSelectedUpSellProduct(selectedProduct);
                              
                              // Calculate the price difference for wizard
                              const originalPrice = Number(upSellSourceItem.preco_unitario || upSellSourceItem.produto?.preco || 0);
                              const newPrice = Number(displayPrice || 0);
                              const difference = newPrice - originalPrice;
                              
                              // Set wizard initial values for normal flow
                              setUpSellValueStr(formatCurrencyBR(Math.abs(difference)));
                              setUpSellDate(new Date().toISOString().slice(0,10));
                              setUpSellPayment('Pix');
                              setUpSellWizardStep(1);
                              setIsNormalFlow(true);
                              setIsAumentoGratis(false);
                              
                              // Close product selection modal and open wizard
                              setUpSellModalOpen(false);
                              setUpSellWizardOpen(true);
                            }}
                          >
                            Próxima etapa
                          </Button>
                          
                          <button
                            className="text-xs text-gray-700 underline hover:text-gray-900"
                            onClick={() => {
                              // Store selected product and open wizard
                              const selectedProduct = {
                                ...prod,
                                selectedVariationId: selectedVarId,
                                selectedVariation: selectedVar,
                                displayPrice: displayPrice
                              };
                              setSelectedUpSellProduct(selectedProduct);
                              
                              // Set wizard initial values for aumento grátis
                              setUpSellDate(new Date().toISOString().slice(0,10));
                              setUpSellWizardStep(1);
                              setIsAumentoGratis(true);
                              setIsNormalFlow(false);
                              
                              // Close product selection modal and open wizard
                              setUpSellModalOpen(false);
                              setUpSellWizardOpen(true);
                            }}
                          >
                            upsell gratuito
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setUpSellModalOpen(false);
                setUpSellSourceItem(null);
                setSelectedVariations({});
              }}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Alerta Up-Sell Pendente */}
      <Dialog open={pendingUpSellAlertOpen} onOpenChange={setPendingUpSellAlertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠️ Produtos com Up-Sell Pendente</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              Não é possível liberar o pedido. Os seguintes produtos estão com up-sell pendente:
            </p>
            <ul className="space-y-2">
              {pendingUpSellProducts.map((item: any, index: number) => (
                <li key={index} className="flex items-center gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                  {item.produto?.img_url && (
                    <img src={item.produto.img_url} alt={item.produto?.nome} className="w-8 h-8 rounded object-cover" />
                  )}
                  <div>
                    <span className="font-medium">{item.produto?.nome || 'Produto'}</span>
                    {item.variacao?.nome && (
                      <span className="text-sm text-gray-500 ml-1">({item.variacao.nome})</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-sm text-gray-500 mt-4">
              Por favor, resolva o up-sell de cada produto (UpSell ou Manter) antes de liberar o pedido.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setPendingUpSellAlertOpen(false);
                setPendingUpSellProducts([]);
              }}
            >
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação Manter */}
      <Dialog open={confirmManterOpen} onOpenChange={setConfirmManterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Manter Produto</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Tem certeza que deseja manter o produto <strong>{itemToKeep?.produto?.nome}</strong> sem fazer up-sell?
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmManterOpen(false);
                setItemToKeep(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                try {
                  const itemId = itemToKeep._sourceIds?.[0] || itemToKeep.id;
                  
                  // Set status to "Não aumentado" (ID 2)
                  const { error } = await supabase
                    .from('itens_pedido')
                    .update({ status_up_sell: 2 })
                    .eq('id', itemId);
                  
                  if (error) throw error;
                  
                  // Register metric
                  await supabase.from('metricas_upsell').insert({
                    responsavel_id: user?.id || null,
                    status_upsell: 2,
                    pedido_id: pedido?.id || null,
                    produto_base: itemToKeep.produto?.id || null,
                    produto_upsell: null, // No up-sell, kept original
                    variacao_base: itemToKeep.variacao?.id || null,
                    variacao_upsell: null,
                    produto_base_nome: itemToKeep.produto?.nome || null,
                    produto_upsell_nome: null,
                    variacao_base_nome: itemToKeep.variacao?.nome || null,
                    variacao_upsell_nome: null,
                    empresa_id: empresaId || null,
                  });
                  
                  toast({
                    title: 'Produto mantido',
                    description: 'O produto original foi mantido no pedido',
                  });
                  
                  // Check if all up_cell products are now resolved and auto-liberate
                  await checkAndAutoLiberatePedido(itemId);
                  
                  setConfirmManterOpen(false);
                  setItemToKeep(null);
                  navigate(0);
                } catch (err: any) {
                  console.error('Erro ao manter produto:', err);
                  toast({
                    title: 'Erro',
                    description: err?.message || 'Não foi possível manter o produto',
                    variant: 'destructive',
                  });
                }
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wizard Up-Sell: Data -> Forma de Pagamento -> Valor -> Status Up-Sell */}
      <Dialog open={upSellWizardOpen} onOpenChange={setUpSellWizardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isAumentoGratis ? 'Selecionar Data do Aumento Grátis' :
               isNormalFlow ? (
                 upSellWizardStep === 1 ? 'Selecionar Data' : 
                 upSellWizardStep === 2 ? 'Selecionar Forma de Pagamento' : 
                 'Definir Valor'
               ) :
               upSellWizardStep === 1 ? 'Selecionar Data' : 
               upSellWizardStep === 2 ? 'Selecionar Forma de Pagamento' : 
               upSellWizardStep === 3 ? 'Definir Valor' : 
               'Tipo de Up-Sell'
              }
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {/* Step indicator */}
            {isAumentoGratis ? (
              <div className="flex items-center justify-center mb-4 text-xs">
                <div className="font-semibold text-blue-600 cursor-pointer hover:underline" onClick={() => setUpSellWizardStep(1)}>Data</div>
              </div>
            ) : isNormalFlow ? (
              <div className="flex items-center justify-between mb-4 text-xs">
                <div 
                  className={`flex-1 text-center ${upSellWizardStep >= 1 ? 'font-semibold text-green-600 cursor-pointer hover:underline' : 'text-gray-400'}`}
                  onClick={() => upSellWizardStep > 1 && setUpSellWizardStep(1)}
                >
                  Data
                </div>
                <div 
                  className={`flex-1 text-center ${upSellWizardStep >= 2 ? 'font-semibold text-green-600 cursor-pointer hover:underline' : 'text-gray-400'}`}
                  onClick={() => upSellWizardStep > 2 && setUpSellWizardStep(2)}
                >
                  Forma Pag.
                </div>
                <div className={`flex-1 text-center ${upSellWizardStep >= 3 ? 'font-semibold text-green-600' : 'text-gray-400'}`}>Valor</div>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-4 text-xs">
                <div 
                  className={`flex-1 text-center ${upSellWizardStep >= 1 ? 'font-semibold text-green-600 cursor-pointer hover:underline' : 'text-gray-400'}`}
                  onClick={() => upSellWizardStep > 1 && setUpSellWizardStep(1)}
                >
                  Data
                </div>
                <div 
                  className={`flex-1 text-center ${upSellWizardStep >= 2 ? 'font-semibold text-green-600 cursor-pointer hover:underline' : 'text-gray-400'}`}
                  onClick={() => upSellWizardStep > 2 && setUpSellWizardStep(2)}
                >
                  Forma Pag.
                </div>
                <div 
                  className={`flex-1 text-center ${upSellWizardStep >= 3 ? 'font-semibold text-green-600 cursor-pointer hover:underline' : 'text-gray-400'}`}
                  onClick={() => upSellWizardStep > 3 && setUpSellWizardStep(3)}
                >
                  Valor
                </div>
                <div className={`flex-1 text-center ${upSellWizardStep >= 4 ? 'font-semibold text-green-600' : 'text-gray-400'}`}>Status</div>
              </div>
            )}

            {upSellWizardStep === 1 && (
              <div className="text-center">
                <input 
                  type="date" 
                  className="mx-auto p-2 border rounded" 
                  value={upSellDate} 
                  onChange={(e) => setUpSellDate(e.target.value)} 
                />
                <div className="mt-4 text-sm text-muted-foreground">
                  Você selecionou {upSellDate.split('-').reverse().join('/')}
                </div>
              </div>
            )}

            {upSellWizardStep === 2 && (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-4">
                  {['Pix','Boleto','Cartão','Outro'].map((m) => (
                    <button 
                      key={m} 
                      onClick={() => setUpSellPayment(m)} 
                      className={`px-4 py-2 rounded ${upSellPayment === m ? 'ring-2 ring-green-500 bg-white' : 'bg-gray-100'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-sm">Você selecionou <strong>{upSellPayment}</strong></div>
              </div>
            )}

            {upSellWizardStep === 3 && (
              <div>
                <label className="block text-sm text-muted-foreground">Diferença de valor do up-sell</label>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-3 py-2 bg-gray-100 rounded-l">R$</span>
                  <Input value={upSellValueStr} onChange={(e) => setUpSellValueStr(e.target.value)} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Produto original: R$ {Number(upSellSourceItem?.preco_unitario || 0).toFixed(2)}
                  <br />
                  Novo produto: R$ {Number(selectedUpSellProduct?.displayPrice || 0).toFixed(2)}
                </p>
              </div>
            )}

            {upSellWizardStep === 4 && !isNormalFlow && !isAumentoGratis && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Selecione o tipo de up-sell</label>
                <div className="space-y-2">
                  {statusUpSellOptions.map((status) => (
                    <button
                      key={status.id}
                      onClick={() => setUpSellStatus(String(status.id))}
                      className={`w-full p-3 rounded border-2 text-left transition-all ${
                        upSellStatus === String(status.id) 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium">{status.status}</div>
                    </button>
                  ))}
                </div>
                {statusUpSellOptions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum status de up-sell configurado
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button 
                variant="outline" 
                onClick={() => {
                  setUpSellWizardOpen(false);
                  setUpSellModalOpen(true);
                }}
              >
                Cancelar
              </Button>
              <div>
                {isAumentoGratis ? (
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white" 
                    disabled={savingUpSell}
                    onClick={async () => {
                      if (!pedido || !selectedUpSellProduct) return;
                      
                      setSavingUpSell(true);
                      try {
                        const itemId = upSellSourceItem._sourceIds?.[0] || upSellSourceItem.id;
                        const hasVariations = selectedUpSellProduct.variacoes_produto && selectedUpSellProduct.variacoes_produto.length > 0;
                        
                        // Buscar dimensões do novo produto ou variação
                        let dimensoes = { altura: null, largura: null, comprimento: null, peso: null };
                        try {
                          if (hasVariations && selectedUpSellProduct.selectedVariationId) {
                            const { data: variacaoData } = await supabase
                              .from('variacoes_produto')
                              .select('altura, largura, comprimento, peso')
                              .eq('id', selectedUpSellProduct.selectedVariationId)
                              .maybeSingle();
                            
                            if (variacaoData) {
                              dimensoes = {
                                altura: variacaoData.altura,
                                largura: variacaoData.largura,
                                comprimento: variacaoData.comprimento,
                                peso: variacaoData.peso
                              };
                            }
                          }
                          
                          if (!dimensoes.altura && !dimensoes.peso) {
                            const { data: produtoData } = await supabase
                              .from('produtos')
                              .select('altura, largura, comprimento, peso')
                              .eq('id', selectedUpSellProduct.id)
                              .maybeSingle();
                            
                            if (produtoData) {
                              dimensoes = {
                                altura: produtoData.altura,
                                largura: produtoData.largura,
                                comprimento: produtoData.comprimento,
                                peso: produtoData.peso
                              };
                            }
                          }
                        } catch (err) {
                          console.error('Erro ao buscar dimensões:', err);
                        }
                        
                        // Set status to "Aumento grátis" (ID 4)
                        const updateData: any = {
                          produto_id: selectedUpSellProduct.id,
                          preco_unitario: upSellSourceItem.preco_unitario, // Keep original price
                          status_up_sell: 4,
                          altura: dimensoes.altura,
                          largura: dimensoes.largura,
                          comprimento: dimensoes.comprimento,
                          peso: dimensoes.peso,
                        };
                        
                        if (hasVariations && selectedUpSellProduct.selectedVariationId) {
                          updateData.variacao_id = selectedUpSellProduct.selectedVariationId;
                        } else {
                          updateData.variacao_id = null;
                        }
                        
                        const { error: updateError } = await supabase
                          .from('itens_pedido')
                          .update(updateData)
                          .eq('id', itemId);
                        
                        if (updateError) throw updateError;
                        
                        // Register metric
                        await supabase.from('metricas_upsell').insert({
                          responsavel_id: user?.id || null,
                          status_upsell: 4,
                          pedido_id: pedido?.id || null,
                          produto_base: upSellSourceItem.produto?.id || null,
                          produto_upsell: selectedUpSellProduct.id || null,
                          variacao_base: upSellSourceItem.variacao?.id || null,
                          variacao_upsell: selectedUpSellProduct.selectedVariationId || null,
                          produto_base_nome: upSellSourceItem.produto?.nome || null,
                          produto_upsell_nome: selectedUpSellProduct.nome || null,
                          variacao_base_nome: upSellSourceItem.variacao?.nome || null,
                          variacao_upsell_nome: selectedUpSellProduct.variacoes_produto?.find((v: any) => v.id === selectedUpSellProduct.selectedVariationId)?.nome || null,
                          empresa_id: empresaId || null,
                        });
                        
                        toast({
                          title: 'Aumento grátis realizado!',
                          description: 'Produto substituído sem alteração de valor',
                        });
                        
                        // Check if all up_cell products are now resolved and auto-liberate
                        await checkAndAutoLiberatePedido(itemId);
                        
                        setUpSellWizardOpen(false);
                        setUpSellSourceItem(null);
                        setSelectedUpSellProduct(null);
                        setSelectedVariations({});
                        setIsAumentoGratis(false);
                        navigate(0);
                      } catch (err: any) {
                        console.error('Erro ao realizar aumento grátis:', err);
                        toast({
                          title: 'Erro',
                          description: err?.message || 'Não foi possível realizar o aumento grátis',
                          variant: 'destructive',
                        });
                      } finally {
                        setSavingUpSell(false);
                      }
                    }}
                  >
                    {savingUpSell ? 'Salvando...' : 'Confirmar Aumento Grátis'}
                  </Button>
                ) : isNormalFlow && upSellWizardStep < 3 ? (
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white" 
                    onClick={() => setUpSellWizardStep(s => s + 1)}
                  >
                    Próxima etapa
                  </Button>
                ) : isNormalFlow && upSellWizardStep === 3 ? (
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white" 
                    disabled={savingUpSell}
                    onClick={async () => {
                      if (!pedido || !selectedUpSellProduct) return;
                      
                      setSavingUpSell(true);
                      try {
                        const itemId = upSellSourceItem._sourceIds?.[0] || upSellSourceItem.id;
                        const hasVariations = selectedUpSellProduct.variacoes_produto && selectedUpSellProduct.variacoes_produto.length > 0;
                        
                        // Buscar dimensões do novo produto ou variação
                        let dimensoes = { altura: null, largura: null, comprimento: null, peso: null };
                        try {
                          if (hasVariations && selectedUpSellProduct.selectedVariationId) {
                            const { data: variacaoData } = await supabase
                              .from('variacoes_produto')
                              .select('altura, largura, comprimento, peso')
                              .eq('id', selectedUpSellProduct.selectedVariationId)
                              .maybeSingle();
                            
                            if (variacaoData) {
                              dimensoes = {
                                altura: variacaoData.altura,
                                largura: variacaoData.largura,
                                comprimento: variacaoData.comprimento,
                                peso: variacaoData.peso
                              };
                            }
                          }
                          
                          if (!dimensoes.altura && !dimensoes.peso) {
                            const { data: produtoData } = await supabase
                              .from('produtos')
                              .select('altura, largura, comprimento, peso')
                              .eq('id', selectedUpSellProduct.id)
                              .maybeSingle();
                            
                            if (produtoData) {
                              dimensoes = {
                                altura: produtoData.altura,
                                largura: produtoData.largura,
                                comprimento: produtoData.comprimento,
                                peso: produtoData.peso
                              };
                            }
                          }
                        } catch (err) {
                          console.error('Erro ao buscar dimensões:', err);
                        }
                        
                        // Set status to "Aumentado" (ID 3)
                        const updateData: any = {
                          produto_id: selectedUpSellProduct.id,
                          preco_unitario: selectedUpSellProduct.displayPrice,
                          status_up_sell: 3,
                          altura: dimensoes.altura,
                          largura: dimensoes.largura,
                          comprimento: dimensoes.comprimento,
                          peso: dimensoes.peso,
                        };
                        
                        if (hasVariations && selectedUpSellProduct.selectedVariationId) {
                          updateData.variacao_id = selectedUpSellProduct.selectedVariationId;
                        } else {
                          updateData.variacao_id = null;
                        }
                        
                        const { error: updateError } = await supabase
                          .from('itens_pedido')
                          .update(updateData)
                          .eq('id', itemId);
                        
                        if (updateError) throw updateError;
                        
                        // Update pedido valor_total with the difference
                        const difference = parseCurrencyBR(upSellValueStr);
                        const currentTotal = Number(pedido?.valor_total ?? pedido?.total ?? 0) || 0;
                        const newTotal = Number((currentTotal + difference).toFixed(2));
                        
                        const { error: pedidoError } = await supabase
                          .from('pedidos')
                          .update({ 
                            valor_total: newTotal, 
                            atualizado_em: new Date().toISOString() 
                          })
                          .eq('id', pedido.id);
                        
                        if (pedidoError) throw pedidoError;
                        
                        // Register metric
                        await supabase.from('metricas_upsell').insert({
                          responsavel_id: user?.id || null,
                          status_upsell: 3,
                          pedido_id: pedido?.id || null,
                          produto_base: upSellSourceItem.produto?.id || null,
                          produto_upsell: selectedUpSellProduct.id || null,
                          variacao_base: upSellSourceItem.variacao?.id || null,
                          variacao_upsell: selectedUpSellProduct.selectedVariationId || null,
                          produto_base_nome: upSellSourceItem.produto?.nome || null,
                          produto_upsell_nome: selectedUpSellProduct.nome || null,
                          variacao_base_nome: upSellSourceItem.variacao?.nome || null,
                          variacao_upsell_nome: selectedUpSellProduct.variacoes_produto?.find((v: any) => v.id === selectedUpSellProduct.selectedVariationId)?.nome || null,
                          empresa_id: empresaId || null,
                        });
                        
                        toast({
                          title: 'Up-sell realizado com sucesso!',
                          description: `Produto substituído e valor atualizado`,
                        });
                        
                        // Check if all up_cell products are now resolved and auto-liberate
                        await checkAndAutoLiberatePedido(itemId);
                        
                        setUpSellWizardOpen(false);
                        setUpSellSourceItem(null);
                        setSelectedUpSellProduct(null);
                        setSelectedVariations({});
                        setIsNormalFlow(false);
                        navigate(0);
                      } catch (err: any) {
                        console.error('Erro ao realizar up-sell:', err);
                        toast({
                          title: 'Erro',
                          description: err?.message || 'Não foi possível realizar o up-sell',
                          variant: 'destructive',
                        });
                      } finally {
                        setSavingUpSell(false);
                      }
                    }}
                  >
                    {savingUpSell ? 'Salvando...' : 'Confirmar Up-Sell'}
                  </Button>
                ) : upSellWizardStep < 4 ? (
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white" 
                    onClick={() => setUpSellWizardStep(s => s + 1)}
                  >
                    Próxima etapa
                  </Button>
                ) : (
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white" 
                    disabled={savingUpSell || !upSellStatus}
                    onClick={async () => {
                      if (!pedido || !selectedUpSellProduct) return;
                      
                      if (!upSellStatus) {
                        toast({
                          title: 'Erro',
                          description: 'Selecione um tipo de up-sell para continuar',
                          variant: 'destructive',
                        });
                        return;
                      }
                      
                      setSavingUpSell(true);
                      try {
                        const itemId = upSellSourceItem._sourceIds?.[0] || upSellSourceItem.id;
                        const hasVariations = selectedUpSellProduct.variacoes_produto && selectedUpSellProduct.variacoes_produto.length > 0;
                        
                        // Buscar dimensões do novo produto ou variação
                        let dimensoes = { altura: null, largura: null, comprimento: null, peso: null };
                        try {
                          if (hasVariations && selectedUpSellProduct.selectedVariationId) {
                            const { data: variacaoData } = await supabase
                              .from('variacoes_produto')
                              .select('altura, largura, comprimento, peso')
                              .eq('id', selectedUpSellProduct.selectedVariationId)
                              .maybeSingle();
                            
                            if (variacaoData) {
                              dimensoes = {
                                altura: variacaoData.altura,
                                largura: variacaoData.largura,
                                comprimento: variacaoData.comprimento,
                                peso: variacaoData.peso
                              };
                            }
                          }
                          
                          if (!dimensoes.altura && !dimensoes.peso) {
                            const { data: produtoData } = await supabase
                              .from('produtos')
                              .select('altura, largura, comprimento, peso')
                              .eq('id', selectedUpSellProduct.id)
                              .maybeSingle();
                            
                            if (produtoData) {
                              dimensoes = {
                                altura: produtoData.altura,
                                largura: produtoData.largura,
                                comprimento: produtoData.comprimento,
                                peso: produtoData.peso
                              };
                            }
                          }
                        } catch (err) {
                          console.error('Erro ao buscar dimensões:', err);
                        }
                        
                        // Find "Aumentado" status ID
                        const aumentadoStatus = Object.entries(statusUpSellMap).find(
                          ([_, name]) => name === 'Aumentado'
                        );
                        
                        // Update the item with the new product and status "Aumentado"
                        const updateData: any = {
                          produto_id: selectedUpSellProduct.id,
                          preco_unitario: selectedUpSellProduct.displayPrice,
                          status_up_sell: aumentadoStatus ? parseInt(aumentadoStatus[0]) : (upSellStatus ? parseInt(upSellStatus) : null),
                          altura: dimensoes.altura,
                          largura: dimensoes.largura,
                          comprimento: dimensoes.comprimento,
                          peso: dimensoes.peso,
                        };
                        
                        if (hasVariations && selectedUpSellProduct.selectedVariationId) {
                          updateData.variacao_id = selectedUpSellProduct.selectedVariationId;
                        } else {
                          updateData.variacao_id = null;
                        }
                        
                        const { error: updateError } = await supabase
                          .from('itens_pedido')
                          .update(updateData)
                          .eq('id', itemId);
                        
                        if (updateError) throw updateError;
                        
                        // Update pedido valor_total with the difference
                        const difference = parseCurrencyBR(upSellValueStr);
                        const currentTotal = Number(pedido?.valor_total ?? pedido?.total ?? 0) || 0;
                        const newTotal = Number((currentTotal + difference).toFixed(2));
                        
                        const { error: pedidoError } = await supabase
                          .from('pedidos')
                          .update({ 
                            valor_total: newTotal, 
                            atualizado_em: new Date().toISOString() 
                          })
                          .eq('id', pedido.id);
                        
                        if (pedidoError) throw pedidoError;
                        
                        toast({
                          title: 'Up-sell realizado com sucesso!',
                          description: `Produto substituído e valor atualizado`,
                        });
                        
                        setUpSellWizardOpen(false);
                        setUpSellSourceItem(null);
                        setSelectedUpSellProduct(null);
                        setSelectedVariations({});
                        setIsAumentoGratis(false);
                        setIsNormalFlow(false);
                        navigate(0); // Reload page
                      } catch (err: any) {
                        console.error('Erro ao realizar up-sell:', err);
                        toast({
                          title: 'Erro',
                          description: err?.message || 'Não foi possível realizar o up-sell',
                          variant: 'destructive',
                        });
                      } finally {
                        setSavingUpSell(false);
                      }
                    }}
                  >
                    {savingUpSell ? 'Salvando...' : 'Confirmar Up-Sell'}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
