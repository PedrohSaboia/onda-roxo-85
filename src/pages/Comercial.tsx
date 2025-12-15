import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Filter, Eye, Edit, Copy, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Pedido } from '@/types';
import EditSelectModal from '@/components/modals/EditSelectModal';
import ComercialSidebar from '@/components/layout/ComercialSidebar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

const etiquetaLabels = {
  NAO_LIBERADO: 'Não Liberado',
  PENDENTE: 'Pendente',
  DISPONIVEL: 'Disponível',
};

const etiquetaColors = {
  NAO_LIBERADO: 'bg-gray-100 text-gray-700',
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  DISPONIVEL: 'bg-green-100 text-green-700',
} as const;

export function Comercial() {
  const navigate = useNavigate();
  const location = useLocation();
  const { empresaId } = useAuth();
  const { toast } = useToast();
  const { empresaId } = useAuth();
  
  // Read current values from URL
  const params = new URLSearchParams(location.search);
  const view = params.get('view') || 'pedidos';
  const urlPage = parseInt(params.get('page') || '1', 10);
  const urlPageSize = parseInt(params.get('pageSize') || '10', 10);
  const urlSearch = params.get('search') || '';
  const urlEtiqueta = params.get('etiqueta_envio_id') || '';
  const urlClienteForm = params.get('cliente_formulario_enviado') === 'false';
  const urlLiberado = params.get('pedido_liberado') === 'false';
  const urlResponsavel = params.get('responsavel_id') || '';
  
  // State using URL as source of truth
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(urlPage);
  const [pageSize, setPageSize] = useState(urlPageSize);
  const [total, setTotal] = useState<number>(0);
  const [totalExcludingEnviados, setTotalExcludingEnviados] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(false);
  const ETIQUETA_FILTER_ID = '0c0ff1fc-1c3b-4eff-9dec-a505d33f3e18';
  const PROCESSED_ETIQUETA_ID = '466958dd-e525-4e8d-95f1-067124a5ea7f';
  const [filterEtiquetaId, setFilterEtiquetaId] = useState(urlEtiqueta);
  const [filterClienteFormNotSent, setFilterClienteFormNotSent] = useState(urlClienteForm);
  const [etiquetaCount, setEtiquetaCount] = useState<number>(0);
  const [envioAdiadoCount, setEnvioAdiadoCount] = useState<number>(0);
  const [filterEnvioAdiadoDate, setFilterEnvioAdiadoDate] = useState<Date | undefined>(undefined);
  const [showEnvioAdiadoCalendar, setShowEnvioAdiadoCalendar] = useState(false);
  const [diasComPedidos, setDiasComPedidos] = useState<Set<string>>(new Set());
  const [processingRapid, setProcessingRapid] = useState<Record<string, boolean>>({});
  const COMERCIAL_STATUS_ID = '3ca23a64-cb1e-480c-8efa-0468ebc18097';
  const ENVIADO_STATUS_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';
  const [filterNotLiberado, setFilterNotLiberado] = useState(urlLiberado);
  const [filterResponsavelId, setFilterResponsavelId] = useState(urlResponsavel);
  const [usuariosList, setUsuariosList] = useState<Array<{ id: string; nome: string }>>([]);
  const urlEnvioAdiado = params.get('envio_adiado') === 'true';
  const [filterEnvioAdiado, setFilterEnvioAdiado] = useState(urlEnvioAdiado);
  
  // Estados temporários para o modal de filtros (antes de aplicar)
  const [tempFilterNotLiberado, setTempFilterNotLiberado] = useState(urlLiberado);
  const [tempFilterClienteFormNotSent, setTempFilterClienteFormNotSent] = useState(urlClienteForm);
  const [tempFilterResponsavelId, setTempFilterResponsavelId] = useState(urlResponsavel);
  
  // Estados para filtro de produtos
  const [produtosList, setProdutosList] = useState<Array<{ id: string; nome: string; sku: string; temVariacoes: boolean }>>([]);
  const [produtoSearchTerm, setProdutoSearchTerm] = useState('');
  const [selectedProdutos, setSelectedProdutos] = useState<Array<{ id: string; nome: string; tipo: 'produto' | 'variacao'; variacaoNome?: string }>>([]);
  const [showVariacoesModal, setShowVariacoesModal] = useState(false);
  const [variacoesList, setVariacoesList] = useState<Array<{ id: string; nome: string; produtoId: string; produtoNome: string }>>([]);
  const [selectedProdutoParaVariacao, setSelectedProdutoParaVariacao] = useState<{ id: string; nome: string } | null>(null);
  
  // Sync state from URL when location changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const newPage = parseInt(params.get('page') || '1', 10);
    const newPageSize = parseInt(params.get('pageSize') || '10', 10);
    const newSearch = params.get('search') || '';
    const newEtiqueta = params.get('etiqueta_envio_id') || '';
    const newClienteForm = params.get('cliente_formulario_enviado') === 'false';
    const newLiberado = params.get('pedido_liberado') === 'false';
    const newResponsavel = params.get('responsavel_id') || '';
    const newEnvioAdiado = params.get('envio_adiado') === 'true';
    
    setPage(newPage);
    setPageSize(newPageSize);
    setSearchTerm(newSearch);
    setFilterEtiquetaId(newEtiqueta);
    setFilterClienteFormNotSent(newClienteForm);
    setFilterNotLiberado(newLiberado);
    setFilterResponsavelId(newResponsavel);
    setFilterEnvioAdiado(newEnvioAdiado);
    
    // Sincronizar estados temporários
    setTempFilterNotLiberado(newLiberado);
    setTempFilterClienteFormNotSent(newClienteForm);
    setTempFilterResponsavelId(newResponsavel);
  }, [location.search]);

  useEffect(() => {
    let mounted = true;
    const fetchPedidos = async () => {
      setLoading(true);
      setError(null);
      try {
  // Select pedidos with related plataforma, responsavel (usuarios), status and etiqueta (tipos_etiqueta)
  // use range for pagination and request exact count
  const searchTrim = (searchTerm || '').trim();
  const actualPage = searchTrim.length > 0 ? 1 : page;
  const from = (actualPage - 1) * pageSize;
  const to = actualPage * pageSize - 1;

        // If the ComercialSidebar requested a specific view (ex: enviados), apply extra filters
        const view = new URLSearchParams(location.search).get('view') || 'pedidos';

        // Query the vw_clientes_pedidos view which flattens cliente+pedido fields
        const query = (supabase as any)
          .from('vw_clientes_pedidos')
          .select(`*, cliente_id, cliente_nome, cliente_criado_em, cliente_atualizado_em, pedido_id, id_externo, pedido_cliente_nome, contato, responsavel_id, plataforma_id, status_id, etiqueta_envio_id, urgente, pedido_criado_em, pedido_atualizado_em, frete_melhor_envio, tempo_ganho`, { count: 'exact' })
          .order('pedido_criado_em', { ascending: false });

        // apply search term server-side so pagination is based on the query
          if (searchTrim.length > 0) {
          // use ilike (case-insensitive) for id_externo, cliente_nome and contato
          // PostgREST OR syntax: "col.ilike.%term%,othercol.ilike.%term%"
          const pattern = `%${searchTrim}%`;
          try {
            (query as any).or(`id_externo.ilike.${pattern},cliente_nome.ilike.${pattern},contato.ilike.${pattern},email.ilike.${pattern},cpf.ilike.${pattern},cnpj.ilike.${pattern}`);
          } catch (e) {
            // fallback: if .or fails, attempt adding single ilike on cliente_nome
            (query as any).ilike('cliente_nome', pattern);
          }
        }

        // Exclude pedidos with 'Enviado' status from the main Comercial list
        // (those are shown in the dedicated PedidosEnviados page)
        (query as any).neq('status_id', ENVIADO_STATUS_ID);

        // apply pedido_liberado = FALSE filter when requested
        if (filterNotLiberado) {
          // only include pedidos where pedido_liberado is false
          // cast to any to avoid TypeScript deep-instantiation error from the Postgrest query typings
          (query as any).eq('pedido_liberado', false);
        }

        // apply etiqueta_envio_id filter when requested
        if (filterEtiquetaId) {
          (query as any).eq('etiqueta_envio_id', filterEtiquetaId);
        }

        // apply responsavel_id filter when requested
        if (filterResponsavelId) {
          (query as any).eq('responsavel_id', filterResponsavelId);
        }

        // apply envio_adiado filter (pedidos com tempo_ganho preenchido)
        if (filterEnvioAdiado) {
          if (filterEnvioAdiadoDate) {
            // Filtrar pela data específica selecionada
            const startOfDay = new Date(filterEnvioAdiadoDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(filterEnvioAdiadoDate);
            endOfDay.setHours(23, 59, 59, 999);
            (query as any).gte('tempo_ganho', startOfDay.toISOString());
            (query as any).lte('tempo_ganho', endOfDay.toISOString());
          } else {
            // Filtrar apenas por tempo_ganho preenchido (qualquer data)
            (query as any).not('tempo_ganho', 'is', null);
          }
        }

        // apply produtos filter: buscar pedidos que contêm os produtos/variações selecionados
        if (selectedProdutos.length > 0) {
          const produtoIds = selectedProdutos.filter(p => p.tipo === 'produto').map(p => p.id);
          const variacaoIds = selectedProdutos.filter(p => p.tipo === 'variacao').map(p => p.id);

          let itemsQuery = supabase.from('itens_pedido').select('pedido_id');
          
          if (produtoIds.length > 0 && variacaoIds.length > 0) {
            itemsQuery = itemsQuery.or(`produto_id.in.(${produtoIds.join(',')}),variacao_id.in.(${variacaoIds.join(',')})`);
          } else if (produtoIds.length > 0) {
            itemsQuery = itemsQuery.in('produto_id', produtoIds);
          } else if (variacaoIds.length > 0) {
            itemsQuery = itemsQuery.in('variacao_id', variacaoIds);
          }

          const { data: itemsData, error: itemsError } = await itemsQuery;
          if (itemsError) throw itemsError;

          const pedidoIds = [...new Set((itemsData || []).map((item: any) => item.pedido_id))];
          
          if (pedidoIds.length === 0) {
            // Nenhum pedido encontrado com esses produtos
            if (!mounted) return;
            setPedidos([]);
            setTotal(0);
            setLoading(false);
            return;
          }

          (query as any).in('pedido_id', pedidoIds);
        }

        // fetch small lookup tables in parallel so we can map ids to display rows
        const [resLookup, resData] = await Promise.all([
          Promise.all([
            supabase.from('plataformas').select('*'),
            supabase.from('usuarios').select('id,nome,img_url'),
            supabase.from('status').select('*'),
            supabase.from('tipos_etiqueta').select('*')
          ]),
          query.range(from, to)
        ]);

        const [[platResp, userResp, statusResp, etiquetaResp], { data, error: supaError, count }] = resLookup.concat([]).length ? [resLookup, resData] : [resLookup, resData];

        if (supaError) throw supaError;
        if (!mounted) return;

        const plataformasMap = (platResp?.data || (platResp as any)) ? ((platResp as any).data || (platResp as any)).reduce((acc: any, p: any) => (acc[p.id] = p, acc), {}) : {};
        const usuariosMap = (userResp?.data || (userResp as any)) ? ((userResp as any).data || (userResp as any)).reduce((acc: any, u: any) => (acc[u.id] = u, acc), {}) : {};
        const statusMap = (statusResp?.data || (statusResp as any)) ? ((statusResp as any).data || (statusResp as any)).reduce((acc: any, s: any) => (acc[s.id] = s, acc), {}) : {};
        const etiquetaMap = (etiquetaResp?.data || (etiquetaResp as any)) ? ((etiquetaResp as any).data || (etiquetaResp as any)).reduce((acc: any, t: any) => (acc[t.id] = t, acc), {}) : {};

        // If the view doesn't expose cor_do_pedido, fetch it directly from pedidos table
        const pedidoIds = (data || []).map((r: any) => r.pedido_id).filter(Boolean);
        let corMap: Record<string, string | undefined> = {};
        if (pedidoIds.length) {
          try {
            const { data: corData, error: corErr } = await supabase.from('pedidos').select('id, cor_do_pedido').in('id', pedidoIds as any[]);
            if (!corErr && corData) {
              corMap = (corData as any[]).reduce((acc: any, p: any) => (acc[p.id] = p.cor_do_pedido || undefined, acc), {} as Record<string, string>);
            }
          } catch (fetchCorErr) {
            console.warn('Não foi possível carregar cor_do_pedido separadamente:', fetchCorErr);
          }
        }

        const mapped: Pedido[] = (data || []).map((row: any) => {
          // row corresponds to view columns: cliente_*, pedido_*
          const freteMe = row.frete_melhor_envio || null;

          const normalizeEtiqueta = (nome?: string) => {
            if (!nome) return 'NAO_LIBERADO' as const;
            const key = nome.toUpperCase();
            if (key.includes('PEND')) return 'PENDENTE' as const;
            if (key.includes('DISP')) return 'DISPONIVEL' as const;
            return 'NAO_LIBERADO' as const;
          }

          const plataformaRow = plataformasMap[row.plataforma_id];
          const usuarioRow = usuariosMap[row.responsavel_id];
          const statusRow = statusMap[row.status_id];
          const etiquetaRow = etiquetaMap[row.etiqueta_envio_id];

          return {
            id: row.pedido_id,
            idExterno: row.id_externo,
            clienteNome: row.cliente_nome || row.pedido_cliente_nome,
            clienteEmail: row.email || undefined,
            clienteCpf: row.cpf || undefined,
            clienteCnpj: row.cnpj || undefined,
            contato: row.contato || '',
            formularioEnviado: !!row.formulario_enviado,
            etiquetaEnvioId: row.etiqueta_envio_id || '',
            responsavelId: row.responsavel_id,
            plataformaId: row.plataforma_id,
            statusId: row.status_id,
            etiquetaEnvio: normalizeEtiqueta(etiquetaRow?.nome) || (row.etiqueta_envio_id ? 'PENDENTE' : 'NAO_LIBERADO'),
            urgente: !!row.urgente,
            dataPrevista: row.data_prevista || undefined,
            observacoes: row.observacoes || '',
            itens: [],
            responsavel: usuarioRow
              ? {
                  id: usuarioRow.id,
                  nome: usuarioRow.nome,
                  email: '',
                  papel: 'operador',
                  avatar: usuarioRow.img_url || undefined,
                  ativo: true,
                  criadoEm: '',
                  atualizadoEm: '',
                }
              : undefined,
            plataforma: plataformaRow
              ? {
                  id: plataformaRow.id,
                  nome: plataformaRow.nome,
                  cor: plataformaRow.cor,
                  imagemUrl: plataformaRow.img_url || undefined,
                  criadoEm: '',
                  atualizadoEm: '',
                }
              : undefined,
            transportadora: freteMe ? (() => {
              const raw = (freteMe.raw_response || freteMe.raw || freteMe);
              const company = raw?.company || freteMe.company || null;
              const nome = freteMe.transportadora || company?.name || raw?.company?.name || undefined;
              const imagem = company?.picture || company?.logo || company?.icon || undefined;
              return { id: undefined, nome, imagemUrl: imagem, raw };
            })() : undefined,
            status: statusRow
              ? {
                  id: statusRow.id,
                  nome: statusRow.nome,
                  corHex: statusRow.cor_hex,
                  ordem: statusRow.ordem ?? 0,
                  criadoEm: '',
                  atualizadoEm: '',
                }
              : undefined,
            etiqueta: etiquetaRow
              ? {
                  id: etiquetaRow.id,
                  nome: etiquetaRow.nome,
                  corHex: etiquetaRow.cor_hex,
                  ordem: etiquetaRow.ordem ?? 0,
                  criadoEm: etiquetaRow.criado_em || '',
                  atualizadoEm: etiquetaRow.atualizado_em || '',
                }
              : undefined,
            corDoPedido: (row.cor_do_pedido !== undefined ? row.cor_do_pedido : corMap[row.pedido_id]) || undefined,
            foiDuplicado: !!row.foi_duplicado,
            criadoEm: row.pedido_criado_em,
            atualizadoEm: row.pedido_atualizado_em,
          };
        });

        setPedidos(mapped);
        setTotal(count || 0);
      } catch (err: any) {
        console.error('Erro ao buscar pedidos', err);
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();

    return () => { mounted = false };
  }, [page, pageSize, view, filterNotLiberado, filterEtiquetaId, filterResponsavelId, filterEnvioAdiado, filterEnvioAdiadoDate, filterClienteFormNotSent, searchTerm, selectedProdutos]);

  // load list of usuarios for filter dropdown
  useEffect(() => {
    let mounted = true;
    const loadUsuarios = async () => {
      try {
        const { data, error } = await supabase.from('usuarios').select('id, nome').order('nome');
        if (error) throw error;
        if (!mounted) return;
        setUsuariosList(data || []);
      } catch (err) {
        console.error('Erro ao carregar usuários:', err);
      }
    };
    loadUsuarios();
    return () => { mounted = false };
  }, []);

  // load count of pedidos with the specific etiqueta id (to show next to filter)
  useEffect(() => {
    let mounted = true;
    const loadEtiquetaCount = async () => {
      try {
        const { count, error } = await supabase
          .from('pedidos')
          .select('id', { count: 'exact' })
          .eq('etiqueta_envio_id', ETIQUETA_FILTER_ID)
          .neq('status_id', ENVIADO_STATUS_ID)
          .limit(1);
        if (error) throw error;
        if (!mounted) return;
        setEtiquetaCount(count || 0);
      } catch (err) {
        console.error('Erro ao buscar contagem de etiqueta:', err);
      }
    };
    loadEtiquetaCount();
    return () => { mounted = false };
  }, []);

  // load count of pedidos with tempo_ganho filled
  useEffect(() => {
    let mounted = true;
    const loadEnvioAdiadoCount = async () => {
      try {
        const { count, error } = await supabase
          .from('pedidos')
          .select('id', { count: 'exact' })
          .not('tempo_ganho', 'is', null)
          .neq('status_id', ENVIADO_STATUS_ID)
          .limit(1);
        if (error) throw error;
        if (!mounted) return;
        setEnvioAdiadoCount(count || 0);
      } catch (err) {
        console.error('Erro ao buscar contagem de envio adiado:', err);
      }
    };
    loadEnvioAdiadoCount();
    return () => { mounted = false };
  }, []);

  // load dates with tempo_ganho pedidos
  useEffect(() => {
    let mounted = true;
    const loadDiasComPedidos = async () => {
      try {
        const { data, error } = await supabase
          .from('pedidos')
          .select('tempo_ganho')
          .not('tempo_ganho', 'is', null)
          .neq('status_id', ENVIADO_STATUS_ID);
        
        if (error) throw error;
        if (!mounted) return;
        
        const datas = new Set<string>();
        data?.forEach((pedido: any) => {
          if (pedido.tempo_ganho) {
            const date = new Date(pedido.tempo_ganho);
            datas.add(format(date, 'yyyy-MM-dd'));
          }
        });
        
        setDiasComPedidos(datas);
      } catch (err) {
        console.error('Erro ao buscar dias com pedidos:', err);
      }
    };
    loadDiasComPedidos();
    return () => { mounted = false };
  }, []);

  // fetch total count excluding 'Enviado' status
  useEffect(() => {
    let mounted = true;
    const ENVIADO_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';
    const loadTotal = async () => {
      try {
        const { count, error } = await supabase.from('pedidos').select('id', { count: 'exact' }).neq('status_id', ENVIADO_ID).limit(1);
        if (error) throw error;
        if (!mounted) return;
        setTotalExcludingEnviados(count || 0);
      } catch (err) {
        console.error('Erro ao buscar total excluindo enviados:', err);
      }
    };
    loadTotal();
    return () => { mounted = false };
  }, [/* run on mount and when relevant filters change in future */]);

  // normalize helper: remove diacritics and lower-case
  const normalize = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  const digitsOnly = (s?: string) => (s || '').replace(/\D/g, '').trim();

  const normalizedSearch = normalize(searchTerm);
  const normalizedDigits = digitsOnly(searchTerm);

  const filteredPedidos = pedidos.filter(pedido => {
    const idExterno = normalize(pedido.idExterno);
    const cliente = normalize(pedido.clienteNome);
    const contatoText = normalize(pedido.contato);
    const contatoDigits = digitsOnly(pedido.contato);
    const clienteEmail = normalize((pedido as any).clienteEmail);
    const clienteCpfDigits = digitsOnly((pedido as any).clienteCpf || '');
    const clienteCnpjDigits = digitsOnly((pedido as any).clienteCnpj || '');

    // match by id_externo, cliente_nome or contato (text)
    if (idExterno.includes(normalizedSearch) || cliente.includes(normalizedSearch) || contatoText.includes(normalizedSearch) || clienteEmail.includes(normalizedSearch)) return true;

    // if user typed digits (or phone with formatting), match contato ignoring formatting (numbers-only)
    if (normalizedDigits.length > 0 && (contatoDigits.includes(normalizedDigits) || clienteCpfDigits.includes(normalizedDigits) || clienteCnpjDigits.includes(normalizedDigits))) return true;

    return false;
  });

  // apply client-formulario filter client-side: only include pedidos whose cliente.formulario_enviado === false
  const filteredPedidosWithClienteFilter = filterClienteFormNotSent ? filteredPedidos.filter(p => !(p as any).formularioEnviado) : filteredPedidos;

  // O filtro de produtos agora é feito no backend, então não precisamos mais fazer client-side
  const filteredPedidosComProdutos = filteredPedidosWithClienteFilter;

  // Status edit modal state
  const [statusEditOpen, setStatusEditOpen] = useState(false);
  const [statusEditPedidoId, setStatusEditPedidoId] = useState<string | null>(null);
  const [statusEditValue, setStatusEditValue] = useState<string | null>(null);
  const [statusOptions, setStatusOptions] = useState<Array<{ id: string; nome: string; cor_hex?: string; ordem?: number }>>([]);
  const [loadingStatusOptions, setLoadingStatusOptions] = useState(false);

  // Etiqueta edit modal state
  const [etiquetaEditOpen, setEtiquetaEditOpen] = useState(false);
  const [etiquetaEditPedidoId, setEtiquetaEditPedidoId] = useState<string | null>(null);
  const [etiquetaEditValue, setEtiquetaEditValue] = useState<string | null>(null);
  const [etiquetaOptions, setEtiquetaOptions] = useState<Array<{ id: string; nome: string; cor_hex?: string; ordem?: number }>>([]);
  const [loadingEtiquetaOptions, setLoadingEtiquetaOptions] = useState(false);

  // Plataforma edit modal state
  const [plataformaEditOpen, setPlataformaEditOpen] = useState(false);
  const [plataformaEditPedidoId, setPlataformaEditPedidoId] = useState<string | null>(null);
  const [plataformaEditValue, setPlataformaEditValue] = useState<string | null>(null);
  const [plataformaOptions, setPlataformaOptions] = useState<Array<{ id: string; nome: string; cor?: string; img_url?: string }>>([]);
  const [loadingPlataformaOptions, setLoadingPlataformaOptions] = useState(false);

  // Responsavel edit modal state
  const [responsavelEditOpen, setResponsavelEditOpen] = useState(false);
  const [responsavelEditPedidoId, setResponsavelEditPedidoId] = useState<string | null>(null);
  const [responsavelEditValue, setResponsavelEditValue] = useState<string | null>(null);
  const [responsavelOptions, setResponsavelOptions] = useState<Array<{ id: string; nome: string; img_url?: string }>>([]);
  const [loadingResponsavelOptions, setLoadingResponsavelOptions] = useState(false);

  // Função para buscar produtos
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
        temVariacoes: (p.variacoes_produto && p.variacoes_produto.length > 0)
      }));

      setProdutosList(produtos);
    } catch (err) {
      console.error('Erro ao buscar produtos:', err);
      toast({ title: 'Erro', description: 'Não foi possível buscar produtos', variant: 'destructive' });
    }
  };

  // Função para carregar variações de um produto
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
        produtoNome
      }));

      setVariacoesList(variacoes);
      setSelectedProdutoParaVariacao({ id: produtoId, nome: produtoNome });
      setShowVariacoesModal(true);
    } catch (err) {
      console.error('Erro ao carregar variações:', err);
      toast({ title: 'Erro', description: 'Não foi possível carregar variações', variant: 'destructive' });
    }
  };

  // Função para selecionar produto
  const selecionarProduto = async (produto: { id: string; nome: string; temVariacoes: boolean }) => {
    if (produto.temVariacoes) {
      // Abrir modal de variações
      await carregarVariacoes(produto.id, produto.nome);
    } else {
      // Adicionar produto direto
      if (!selectedProdutos.find(p => p.id === produto.id && p.tipo === 'produto')) {
        setSelectedProdutos(prev => [...prev, { id: produto.id, nome: produto.nome, tipo: 'produto' }]);
      }
      setProdutoSearchTerm('');
      setProdutosList([]);
    }
  };

  // Função para selecionar variação
  const selecionarVariacao = (variacao: { id: string; nome: string; produtoId: string; produtoNome: string }) => {
    if (!selectedProdutos.find(p => p.id === variacao.id && p.tipo === 'variacao')) {
      setSelectedProdutos(prev => [...prev, { 
        id: variacao.id, 
        nome: variacao.produtoNome, 
        tipo: 'variacao',
        variacaoNome: variacao.nome
      }]);
    }
    setShowVariacoesModal(false);
    setProdutoSearchTerm('');
    setProdutosList([]);
  };

  // Função para remover produto/variação do filtro
  const removerProdutoFiltro = (id: string, tipo: 'produto' | 'variacao') => {
    setSelectedProdutos(prev => prev.filter(p => !(p.id === id && p.tipo === tipo)));
  };

  const handleEnvioRapido = async (pedidoId: string) => {
    if (!pedidoId) return;
    setProcessingRapid(prev => ({ ...prev, [pedidoId]: true }));
    try {
      // Buscar transportadoras bloqueadas
      let fretesOcultos: number[] = [];
      if (empresaId) {
        try {
          const { data: fretesData, error: fretesError } = await supabase
            .from('fretes_nao_disponiveis' as any)
            .select('id_frete')
            .eq('empresa_id', empresaId);

          if (!fretesError && fretesData) {
            fretesOcultos = fretesData.map((f: any) => f.id_frete).filter((id: any) => id !== null);
          }
        } catch (err) {
          console.warn('Erro ao buscar fretes ocultos:', err);
          // Continua o fluxo mesmo com erro na busca
        }
      }

      // load full pedido with cliente and itens
      const { data: pedidoRow, error: pedidoError } = await supabase
        .from('pedidos')
        .select(`*, clientes(*), itens_pedido(id,quantidade,preco_unitario, produto:produtos(id,nome,sku,preco,up_cell,lista_id_upsell), variacao:variacoes_produto(id,nome,sku,ordem))`)
        .eq('id', pedidoId)
        .single();

      if (pedidoError) throw pedidoError;

      // normalize cliente shape: PostgREST may return arrays for relations
      const pick = (val: any) => Array.isArray(val) ? val[0] : val;
      const cliente = pick((pedidoRow as any).clientes) || null;

      // load default remetente and embalagem (use first available)
      const [{ data: remetentesData, error: remErr }, { data: embalagensData, error: embErr }] = await Promise.all([
        supabase.from('remetentes').select('*').order('nome'),
        supabase.from('embalagens').select('*').order('nome')
      ]);
      if (remErr) throw remErr;
      if (embErr) throw embErr;

      const selectedRemetente = (remetentesData && remetentesData[0]) || null;
      const selectedEmbalagem = (embalagensData && embalagensData[0]) || null;

      const stored = (pedidoRow as any).frete_melhor_envio;
      let melhorEnvioId: any = null;

      const buildProducts = (pedidoRow?.itens_pedido || []).map((it: any) => ({
        name: it.variacao?.nome || it.produto?.nome || 'Produto',
        quantity: String(it.quantidade || 1),
        unitary_value: String(Number(it.preco_unitario || it.preco || 0).toFixed(2))
      }));

      if (stored) {
        // Verificar se a transportadora está bloqueada
        const serviceId = stored.service || stored.service_id || stored.raw_response?.service || stored.raw_response?.service_id;
        if (fretesOcultos.includes(serviceId)) {
          throw new Error(`A transportadora ${stored.transportadora || 'selecionada'} está bloqueada para sua empresa. Por favor, selecione outra opção de frete.`);
        }

        // reuse stored payload when available
  const insuranceValue = (pedidoRow?.itens_pedido || []).reduce((s: number, it: any) => s + (Number(it.preco_unitario || it.preco || 0) * Number(it.quantidade || 1)), 0) || 1;
        const payload: any = {
          from: {
            name: selectedRemetente?.nome || stored.from?.name || '' ,
            phone: (selectedRemetente as any)?.contato || (selectedRemetente as any)?.telefone || stored.from?.phone || '',
            email: (selectedRemetente as any)?.email || stored.from?.email || 'contato@empresa.com',
            document: (selectedRemetente as any)?.cpf || stored.from?.document || '',
            address: (selectedRemetente as any)?.endereco || stored.from?.address || '',
            number: (selectedRemetente as any)?.numero || stored.from?.number || '',
            complement: (selectedRemetente as any)?.complemento || stored.from?.complement || '',
            district: (selectedRemetente as any)?.bairro || stored.from?.district || '',
            city: (selectedRemetente as any)?.cidade || stored.from?.city || '',
            state_abbr: (selectedRemetente as any)?.estado || stored.from?.state_abbr || '',
            country_id: stored.from?.country_id || 'BR',
            postal_code: ((selectedRemetente as any)?.cep || stored.from?.postal_code || '').replace(/\D/g, '')
          },
          to: {
            name: cliente?.nome || (stored.to?.name && stored.to.name !== pedidoRow?.id_externo ? stored.to.name : 'Cliente') || '' ,
            phone: (cliente as any)?.telefone || (cliente as any)?.contato || stored.to?.phone || '',
            email: (cliente as any)?.email || stored.to?.email || 'cliente@email.com',
            document: (cliente as any)?.cpf || stored.to?.document || '',
            address: (cliente as any)?.endereco || stored.to?.address || '',
            number: (cliente as any)?.numero || stored.to?.number || '',
            complement: (cliente as any)?.complemento || stored.to?.complement || '',
            district: (cliente as any)?.bairro || stored.to?.district || '',
            city: (cliente as any)?.cidade || stored.to?.city || '',
            state_abbr: (cliente as any)?.estado || stored.to?.state_abbr || '',
            country_id: stored.to?.country_id || 'BR',
            postal_code: (((cliente as any)?.cep) || stored.to?.postal_code || '').replace(/\D/g, '')
          },
          options: stored.options || { insurance_value: insuranceValue, receipt: false, own_hand: false, reverse: false, non_commercial: true },
          products: buildProducts,
          service: stored.service || stored.service_id || stored.raw_response?.service || stored.raw_response?.service_id,
          volumes: stored.volumes || (selectedEmbalagem ? [{ height: selectedEmbalagem.altura, width: selectedEmbalagem.largura, length: selectedEmbalagem.comprimento, weight: selectedEmbalagem.peso, insurance_value: insuranceValue }] : [{ height: 5, width: 20, length: 20, weight: 1, insurance_value: insuranceValue }])
        };

        // send to cart function
        const { data: carrinhoResp, error: carrinhoError } = await supabase.functions.invoke('adic-carrinho-melhorenvio', { body: payload });
        if (carrinhoError) throw carrinhoError;

        melhorEnvioId = carrinhoResp?.id || carrinhoResp?.data?.id || carrinhoResp?.shipment?.id;

        const { error: updateErr } = await supabase.from('pedidos').update({ id_melhor_envio: melhorEnvioId || null, carrinho_me: true, atualizado_em: new Date().toISOString() } as any).eq('id', pedidoId);
        if (updateErr) throw updateErr;
        toast({ title: 'Sucesso', description: 'Frete enviado ao carrinho do Melhor Envio' });
      } else {
        // calculate frete, pick cheapest and send it
  if (!cliente?.cep) throw new Error('CEP do cliente ausente');
  const cepLimpo = String((cliente as any).cep).replace(/\D/g, '');
        if (!/^[0-9]{8}$/.test(cepLimpo)) throw new Error('CEP do cliente inválido');

        if (!selectedRemetente || !selectedEmbalagem) throw new Error('Remetente ou embalagem não configurados');

        // build calc payload
  const itemsValue = (pedidoRow?.itens_pedido || []).reduce((s: number, it: any) => s + (Number(it.preco_unitario || it.preco || 0) * Number(it.quantidade || 1)), 0);
        const calcPayload = {
          origem: { postal_code: ((selectedRemetente as any)?.cep || '').replace(/\D/g,''), contact: (selectedRemetente as any)?.contato || (selectedRemetente as any)?.nome, email: (selectedRemetente as any)?.email || 'contato@empresa.com' },
          destino: { postal_code: cepLimpo },
          pacote: [{ weight: selectedEmbalagem.peso, insurance_value: itemsValue || 1, length: selectedEmbalagem.comprimento, height: selectedEmbalagem.altura, width: selectedEmbalagem.largura, id: '1', quantity: 1 }]
        };

        const { data: calcResp, error: calcErr } = await supabase.functions.invoke('calculo-frete-melhorenvio', { body: calcPayload });
        if (calcErr) throw calcErr;
        
        // Filtrar cotações válidas E não bloqueadas
        const cotacoesValidas = (calcResp?.cotacoes || [])
          .filter((q: any) => !q.error)
          .filter((q: any) => !fretesOcultos.includes(q.id))
          .map((quote: any) => ({ 
            service_id: quote.id, 
            transportadora: quote.company.name, 
            modalidade: quote.name, 
            prazo: `${quote.delivery_time} dias úteis`, 
            preco: Number(quote.price), 
            raw_response: quote 
          }));
        
        if (!cotacoesValidas.length) {
          if (fretesOcultos.length > 0) {
            throw new Error('Nenhuma opção de frete disponível. Todas as transportadoras disponíveis estão bloqueadas para sua empresa.');
          }
          throw new Error('Nenhuma opção de frete disponível');
        }
        
        const maisBarato = cotacoesValidas.reduce((prev: any, curr: any) => prev.preco < curr.preco ? prev : curr);

        // build payload to add to cart using cheapest quote
        const insuranceValue = itemsValue || 1;
        const payload: any = {
          from: {
            name: selectedRemetente?.nome || '',
            phone: (selectedRemetente as any)?.contato || (selectedRemetente as any)?.telefone || '',
            email: (selectedRemetente as any)?.email || 'contato@empresa.com',
            document: (selectedRemetente as any)?.cpf || '',
            address: (selectedRemetente as any)?.endereco || '',
            number: (selectedRemetente as any)?.numero || '',
            complement: (selectedRemetente as any)?.complemento || '',
            district: (selectedRemetente as any)?.bairro || '',
            city: (selectedRemetente as any)?.cidade || '',
            state_abbr: (selectedRemetente as any)?.estado || '',
            country_id: 'BR',
            postal_code: ((selectedRemetente as any)?.cep || '').replace(/\D/g, '')
          },
          to: {
            name: cliente?.nome || 'Cliente',
            phone: (cliente as any)?.telefone || (cliente as any)?.contato || '',
            email: (cliente as any)?.email || 'cliente@email.com',
            document: (cliente as any)?.cpf || '',
            address: (cliente as any)?.endereco || '',
            number: (cliente as any)?.numero || '',
            complement: (cliente as any)?.complemento || '',
            district: (cliente as any)?.bairro || '',
            city: (cliente as any)?.cidade || '',
            state_abbr: (cliente as any)?.estado || '',
            country_id: 'BR',
            postal_code: cepLimpo
          },
          options: { insurance_value: insuranceValue, receipt: false, own_hand: false, reverse: false, non_commercial: true },
          products: buildProducts,
          service: maisBarato.service_id || maisBarato.raw_response?.service_id || maisBarato.raw_response?.service,
          volumes: selectedEmbalagem ? [{ height: selectedEmbalagem.altura, width: selectedEmbalagem.largura, length: selectedEmbalagem.comprimento, weight: selectedEmbalagem.peso, insurance_value: insuranceValue }] : [{ height: 5, width: 20, length: 20, weight: 1, insurance_value: insuranceValue }]
        };

        const { data: carrinhoResp, error: carrinhoError } = await supabase.functions.invoke('adic-carrinho-melhorenvio', { body: payload });
        if (carrinhoError) throw carrinhoError;
        melhorEnvioId = carrinhoResp?.id || carrinhoResp?.data?.id || carrinhoResp?.shipment?.id;

        const { error: updateErr } = await supabase.from('pedidos').update({ id_melhor_envio: melhorEnvioId || null, carrinho_me: true, frete_melhor_envio: { transportadora: maisBarato.transportadora, modalidade: maisBarato.modalidade, prazo: maisBarato.prazo, preco: maisBarato.preco, service_id: maisBarato.service_id, raw_response: maisBarato.raw_response }, atualizado_em: new Date().toISOString() } as any).eq('id', pedidoId);
        if (updateErr) throw updateErr;
        toast({ title: 'Sucesso', description: 'Frete calculado e enviado ao carrinho do Melhor Envio' });
      }

      // After sending to cart, process label
      try {
        const payloadLabel = { pedidoId, id_melhor_envio: melhorEnvioId };
        console.log('processar-etiqueta-melhorenvio payload:', payloadLabel);

        // first attempt
        const { data: labelResp, error: labelErr } = await supabase.functions.invoke('processar-etiqueta-melhorenvio', { body: payloadLabel });
        console.log('processar-etiqueta-melhorenvio response:', { labelResp, labelErr });

        // if the function returned an error or an unexpected response, try once more (transient network issues)
        let finalResp = labelResp;
        let finalErr = labelErr;
        if (finalErr || (!finalResp || (typeof finalResp === 'object' && Object.keys(finalResp).length === 0))) {
          console.warn('Etiqueta: resposta inicial inválida, tentando novamente...');
          try {
            await new Promise(r => setTimeout(r, 800));
            const retry = await supabase.functions.invoke('processar-etiqueta-melhorenvio', { body: payloadLabel });
            console.log('processar-etiqueta-melhorenvio retry response:', retry);
            finalResp = (retry as any).data || finalResp;
            finalErr = (retry as any).error || finalErr;
          } catch (retryErr) {
            console.error('Retry falhou:', retryErr);
          }
        }

        if (finalErr) {
          console.error('Erro da função processar-etiqueta-melhorenvio:', finalErr, finalResp);
          // show detailed message to user so they can report it
          const detail = (finalErr && (finalErr.message || finalErr.name)) || JSON.stringify(finalResp || finalErr);
          toast({ title: 'Erro ao processar etiqueta', description: String(detail).slice(0, 200), variant: 'destructive' });
          } else {
            const returnedUrl = finalResp?.url || null;
            if (returnedUrl && /^https?:\/\//i.test(returnedUrl)) {
              window.open(returnedUrl, '_blank');
              toast({ title: 'Etiqueta processada', description: 'A etiqueta foi processada e aberta em nova aba' });
            } else if (finalResp?.id) {
              toast({ title: 'Etiqueta processada', description: 'Etiqueta gerada no Melhor Envio. Verifique o painel.' });
            } else {
              // If response is unexpected, surface its JSON (truncated)
              console.warn('Resposta inesperada ao processar etiqueta:', finalResp);
              toast({ title: 'Etiqueta processada', description: 'Etiqueta processada. Verifique o painel do Melhor Envio.' });
            }

            // Marcar o pedido como com etiqueta processada para que saia do filtro "Etiqueta Pendente"
            try {
              const { error: updateEtiquetaErr } = await supabase
                .from('pedidos')
                .update({ etiqueta_envio_id: PROCESSED_ETIQUETA_ID, atualizado_em: new Date().toISOString() } as any)
                .eq('id', pedidoId);
              if (updateEtiquetaErr) {
                console.error('Erro ao atualizar etiqueta_envio_id no pedido:', updateEtiquetaErr);
                // não interrompe o fluxo principal — só avisa o usuário
                toast({ title: 'Aviso', description: 'Etiqueta processada, mas não foi possível atualizar o pedido no servidor.', variant: 'destructive' });
              } else {
                // Atualiza o estado local imediatamente para remover o pedido do filtro "Etiqueta Pendente"
                setPedidos(prev => {
                  // se o filtro de etiqueta pendente estiver ativo, remova o pedido da lista
                  if (filterEtiquetaId === ETIQUETA_FILTER_ID) {
                    return prev.filter(p => p.id !== pedidoId);
                  }
                  // caso contrário apenas atualize o campo da etiqueta no pedido
                  return prev.map(p => p.id === pedidoId ? { ...p, etiquetaEnvioId: PROCESSED_ETIQUETA_ID, etiquetaEnvio: 'DISPONIVEL' } : p);
                });

                // decrementa contagem local de etiquetas pendentes se aplicável
                setEtiquetaCount(c => Math.max(0, (c || 0) - (filterEtiquetaId === ETIQUETA_FILTER_ID ? 1 : 0)));
              }
            } catch (updErr) {
              console.error('Exceção ao atualizar etiqueta_envio_id:', updErr);
            }
        }
      } catch (err: any) {
        console.error('Erro ao processar etiqueta após envio ao carrinho:', err);
        toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
      }
  // Note: we no longer refresh the entire route here — local state is updated to reflect
  // the etiqueta change in real time (see setPedidos above). This avoids a full reload.
    } catch (err: any) {
      console.error('Erro no Envio Rápido:', err);
      toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setProcessingRapid(prev => ({ ...prev, [pedidoId]: false }));
    }
  };

  const duplicatePedido = async (pedidoId: string) => {
    if (!pedidoId) return;
    try {
      const { data: pedidoRow, error: pedidoError } = await supabase
        .from('pedidos')
        .select(`*, clientes(*), itens_pedido(*)`)
        .eq('id', pedidoId)
        .single();

      if (pedidoError) throw pedidoError;

      const pick = (val: any) => Array.isArray(val) ? val[0] : val;
      const cliente = pick((pedidoRow as any).clientes) || null;

      // build new pedido payload copying relevant fields
      const now = new Date().toISOString();
      const computeNewIdExterno = (orig: any) => {
        const idExt = orig || '';
        if (!idExt) return null;
        const m = idExt.match(/^(.*)\/(\d+)$/);
        if (m) {
          // increment suffix
          const base = m[1];
          const num = Number(m[2] || 0) + 1;
          return `${base}/${num}`;
        }
        return `${idExt}/1`;
      };

      const newPedidoPayload: any = {
        id_externo: computeNewIdExterno((pedidoRow as any).id_externo) ,
        cliente_nome: (pedidoRow as any).cliente_nome || (cliente && cliente.nome) || null,
        contato: (pedidoRow as any).contato ? String((pedidoRow as any).contato).replace(/\D/g, '') : (cliente ? String(cliente.telefone || cliente.contato || '').replace(/\D/g, '') : null),
        plataforma_id: (pedidoRow as any).plataforma_id || null,
        status_id: COMERCIAL_STATUS_ID,
        responsavel_id: (pedidoRow as any).responsavel_id || null,
        valor_total: (pedidoRow as any).valor_total || null,
        frete_venda: (pedidoRow as any).frete_venda || null,
        cor_do_pedido: '#FF0000',
        criado_em: now,
        empresa_id: empresaId || null
      };

  // mark the inserted record as a duplicata
  newPedidoPayload.duplicata = true;

  const { data: newPedidoData, error: newPedidoError } = await supabase.from('pedidos').insert(newPedidoPayload).select('id').single();
      if (newPedidoError) throw newPedidoError;   

      const newPedidoId = (newPedidoData as any).id;

      // mark original pedido as foi_duplicado = true
      try {
        const { error: markErr } = await supabase.from('pedidos').update({ foi_duplicado: true, atualizado_em: new Date().toISOString() } as any).eq('id', pedidoId);
        if (markErr) console.error('Erro ao marcar pedido original como duplicado:', markErr);
        else {
          // update local state to reflect original foiDuplicado
          setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, foiDuplicado: true } : p));
        }
      } catch (markEx) {
        console.error('Exceção ao marcar pedido original como duplicado:', markEx);
      }

      // create a cliente record linked to the new pedido (if original cliente exists)
      if (cliente) {
        try {
          const clientePayload: any = {
            nome: cliente.nome || (pedidoRow as any).cliente_nome || null,
            telefone: cliente.telefone ? String(cliente.telefone).replace(/\D/g, '') : (cliente.contato ? String(cliente.contato).replace(/\D/g, '') : null),
            email: cliente.email || null,
            cpf: cliente.cpf || null,
            cnpj: cliente.cnpj || null,
            endereco: cliente.endereco || null,
            numero: cliente.numero || null,
            complemento: cliente.complemento || null,
            bairro: cliente.bairro || null,
            cidade: cliente.cidade || null,
            estado: cliente.estado || null,
            cep: cliente.cep || null,
            link_formulario: `/${newPedidoId}`,
            formulario_enviado: false,
            pedido_id: newPedidoId,
            criado_em: new Date().toISOString(),
            empresa_id: empresaId || null
          };
          const { error: clienteError } = await supabase.from('clientes').insert(clientePayload as any);
          if (clienteError) console.error('Erro ao duplicar cliente:', clienteError);
        } catch (cliErr) {
          console.error('Exceção ao criar cliente duplicado:', cliErr);
        }
      }

      // duplicate itens_pedido if present
      const itens = (pedidoRow as any).itens_pedido || [];
      if (itens && itens.length) {
        try {
          const itensPayload = itens.map((it: any) => ({
            pedido_id: newPedidoId,
            produto_id: it.produto_id,
            variacao_id: it.variacao_id || null,
            quantidade: it.quantidade || 1,
            preco_unitario: it.preco_unitario || it.preco || 0,
            codigo_barras: it.codigo_barras || null,
            criado_em: new Date().toISOString(),
            empresa_id: empresaId || null
          }));
          const { error: itensError } = await supabase.from('itens_pedido').insert(itensPayload as any);
          if (itensError) console.error('Erro ao duplicar itens do pedido:', itensError);
        } catch (itErr) {
          console.error('Exceção ao duplicar itens:', itErr);
        }
      }

      toast({ title: 'Duplicado', description: 'Pedido duplicado com sucesso' });

      // optional: append duplicated pedido to local state so it appears in list
      setPedidos(prev => {
        const copyPedido = (pedidoRow: any) => ({
          id: newPedidoId,
          idExterno: newPedidoPayload.id_externo,
          clienteNome: newPedidoPayload.cliente_nome,
          contato: newPedidoPayload.contato,
          etiquetaEnvioId: (pedidoRow as any).etiqueta_envio_id || '',
          responsavelId: newPedidoPayload.responsavel_id,
          plataformaId: newPedidoPayload.plataforma_id,
          statusId: COMERCIAL_STATUS_ID,
          etiquetaEnvio: (pedidoRow as any).etiqueta_envio_id ? 'PENDENTE' : 'NAO_LIBERADO',
          urgente: !!(pedidoRow as any).urgente,
          dataPrevista: (pedidoRow as any).data_prevista || undefined,
          observacoes: (pedidoRow as any).observacoes || '',
          itens: itens || [],
          responsavel: (pedidoRow as any).responsavel || undefined,
          plataforma: (pedidoRow as any).plataforma || undefined,
          transportadora: (pedidoRow as any).transportadora || undefined,
          status: { id: COMERCIAL_STATUS_ID, nome: 'Comercial', corHex: '#FF0000', ordem: 0 },
          etiqueta: (pedidoRow as any).etiqueta || undefined,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        });

        // cast to Pedido to satisfy the local state typing
        return [copyPedido(pedidoRow) as unknown as Pedido, ...prev];
      });
    } catch (err: any) {
      console.error('Erro ao duplicar pedido:', err);
      toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  const totalPages = Math.max(1, Math.ceil((total || filteredPedidosComProdutos.length) / pageSize));

  const updatePageInUrl = (newPage: number) => {
    const params = new URLSearchParams(location.search);
    if (!params.get('module')) params.set('module', 'comercial');
    params.set('view', view);
    params.set('page', String(newPage));
    params.set('pageSize', String(pageSize));
    if (searchTerm) params.set('search', searchTerm);
    if (filterEtiquetaId) params.set('etiqueta_envio_id', filterEtiquetaId);
    if (filterClienteFormNotSent) params.set('cliente_formulario_enviado', 'false');
    if (filterNotLiberado) params.set('pedido_liberado', 'false');
    if (filterEnvioAdiado) params.set('envio_adiado', 'true');
    navigate({ pathname: location.pathname, search: params.toString() });
  };

  const handlePrev = () => {
    const newPage = Math.max(1, page - 1);
    updatePageInUrl(newPage);
  };
  
  const handleNext = () => {
    const newPage = Math.min(totalPages, page + 1);
    updatePageInUrl(newPage);
  };

  const pageSizeOptions = [10, 20, 30, 50];

  // helper to get status options formatted for EditSelectModal
  const statusModalOptions = statusOptions.map(o => ({ id: o.id, nome: o.nome }));

  return (
    <div className="flex h-full">
      <div className="flex-shrink-0">
        <ComercialSidebar />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{view === 'enviados' ? 'Pedidos Enviados' : 'Pedidos'}</h1>
              <p className="text-muted-foreground">
                {view === 'enviados'
                  ? `${filteredPedidosComProdutos.length} pedidos enviados`
                  : filterNotLiberado
                    ? `${total} pedidos encontrados`
                    : `${totalExcludingEnviados} pedidos encont rados`}
              </p>
            </div>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => navigate('/novo-pedido')}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pedido
            </Button>
          </div>

      {/* Filtros e busca */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar pedidos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Active filter tags (appear directly below the search input) */}
              <div className="mt-2">
                {(filterNotLiberado || filterClienteFormNotSent || !!filterEtiquetaId || !!filterResponsavelId || filterEnvioAdiado || selectedProdutos.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {filterNotLiberado && (
                      <div className="flex items-center gap-2 bg-gray-100 text-gray-800 px-3 py-1 rounded">
                        <span className="text-sm">Somente não liberados</span>
                        <button
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => {
                            setFilterNotLiberado(false);
                            setPage(1);
                            const next = new URLSearchParams(location.search);
                            next.delete('pedido_liberado');
                            if (!next.get('module')) next.set('module', 'comercial');
                            navigate({ pathname: location.pathname, search: next.toString() });
                          }}
                          aria-label="Remover filtro não liberado"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {filterClienteFormNotSent && (
                      <div className="flex items-center gap-2 bg-gray-100 text-gray-800 px-3 py-1 rounded">
                        <span className="text-sm">Formulário não enviado</span>
                        <button
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => {
                            setFilterClienteFormNotSent(false);
                            setPage(1);
                            const next = new URLSearchParams(location.search);
                            next.delete('cliente_formulario_enviado');
                            if (!next.get('module')) next.set('module', 'comercial');
                            navigate({ pathname: location.pathname, search: next.toString() });
                          }}
                          aria-label="Remover filtro formulário não enviado"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {filterEtiquetaId === ETIQUETA_FILTER_ID && (
                      <div className="flex items-center gap-2 bg-gray-100 text-gray-800 px-3 py-1 rounded">
                        <span className="text-sm">Etiqueta Pendente</span>
                        <button
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => {
                            setFilterEtiquetaId('');
                            setPage(1);
                            const next = new URLSearchParams(location.search);
                            next.delete('etiqueta_envio_id');
                            if (!next.get('module')) next.set('module', 'comercial');
                            navigate({ pathname: location.pathname, search: next.toString() });
                          }}
                          aria-label="Remover filtro etiqueta pendente"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {filterEnvioAdiado && (
                      <div className="flex items-center gap-2 bg-gray-100 text-gray-800 px-3 py-1 rounded">
                        <span className="text-sm">
                          Envio Adiado
                          {filterEnvioAdiadoDate && ` - ${format(filterEnvioAdiadoDate, "dd/MM/yyyy", { locale: ptBR })}`}
                        </span>
                        {filterEnvioAdiadoDate && (
                          <button
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() => {
                              setFilterEnvioAdiadoDate(undefined);
                              setPage(1);
                            }}
                            aria-label="Remover filtro de data"
                          >
                            ⊗
                          </button>
                        )}
                        <button
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => {
                            setFilterEnvioAdiado(false);
                            setFilterEnvioAdiadoDate(undefined);
                            setPage(1);
                            const next = new URLSearchParams(location.search);
                            next.delete('envio_adiado');
                            if (!next.get('module')) next.set('module', 'comercial');
                            navigate({ pathname: location.pathname, search: next.toString() });
                          }}
                          aria-label="Remover filtro envio adiado"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {filterResponsavelId && (
                      <div className="flex items-center gap-2 bg-gray-100 text-gray-800 px-3 py-1 rounded">
                        <span className="text-sm">Responsável: {usuariosList.find(u => u.id === filterResponsavelId)?.nome || 'Selecionado'}</span>
                        <button
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => {
                            setFilterResponsavelId('');
                            setPage(1);
                            const next = new URLSearchParams(location.search);
                            next.delete('responsavel_id');
                            if (!next.get('module')) next.set('module', 'comercial');
                            navigate({ pathname: location.pathname, search: next.toString() });
                          }}
                          aria-label="Remover filtro responsável"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {selectedProdutos.map((produto) => (
                      <div key={`${produto.tipo}-${produto.id}`} className="flex items-center gap-2 bg-purple-100 text-purple-800 px-3 py-1 rounded">
                        <span className="text-sm">
                          {produto.tipo === 'variacao' 
                            ? `${produto.nome} - ${produto.variacaoNome}` 
                            : produto.nome}
                        </span>
                        <button
                          className="text-purple-600 hover:text-purple-800"
                          onClick={() => removerProdutoFiltro(produto.id, produto.tipo)}
                          aria-label="Remover filtro de produto"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
              <div className="flex items-center gap-2 relative">
                <div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      // Sincronizar estados temporários com os filtros atuais ao abrir
                      setTempFilterNotLiberado(filterNotLiberado);
                      setTempFilterClienteFormNotSent(filterClienteFormNotSent);
                      setTempFilterResponsavelId(filterResponsavelId);
                      setShowFilters(s => !s);
                    }}>
                      <Filter className="h-4 w-4 mr-2" />
                      Filtrar
                    </Button>
                    <Button
                      size="sm"
                      variant={filterEtiquetaId === ETIQUETA_FILTER_ID ? 'outline' : 'ghost'}
                      onClick={() => {
                        // toggle etiqueta filter and reset to page 1
                        const next = new URLSearchParams(location.search);
                        if (filterEtiquetaId === ETIQUETA_FILTER_ID) {
                          setFilterEtiquetaId('');
                          next.delete('etiqueta_envio_id');
                        } else {
                          setFilterEtiquetaId(ETIQUETA_FILTER_ID);
                          next.set('etiqueta_envio_id', ETIQUETA_FILTER_ID);
                        }
                        // Ensure the module query is preserved so we don't unintentionally return to Dashboard
                        if (!next.get('module')) next.set('module', 'comercial');
                        setPage(1);
                        navigate({ pathname: location.pathname, search: next.toString() });
                      }}
                      className="ml-2 flex items-center gap-2"
                    >
                      <span className="text-sm">Etiqueta Pendente</span>
                      <span className="inline-block bg-red-50 text-red-700 px-2 py-0.5 rounded text-sm">{etiquetaCount}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant={filterEnvioAdiado ? 'outline' : 'ghost'}
                      onClick={() => {
                        // toggle envio adiado filter and reset to page 1
                        const next = new URLSearchParams(location.search);
                        if (filterEnvioAdiado) {
                          setFilterEnvioAdiado(false);
                          setFilterEnvioAdiadoDate(undefined);
                          next.delete('envio_adiado');
                        } else {
                          setFilterEnvioAdiado(true);
                          next.set('envio_adiado', 'true');
                        }
                        // Ensure the module query is preserved
                        if (!next.get('module')) next.set('module', 'comercial');
                        setPage(1);
                        navigate({ pathname: location.pathname, search: next.toString() });
                      }}
                      className="ml-2 flex items-center gap-2"
                    >
                      <span className="text-sm">Envio Adiado</span>
                      <span className="inline-block bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-sm">{envioAdiadoCount}</span>
                    </Button>
                    {filterEnvioAdiado && (
                      <Popover open={showEnvioAdiadoCalendar} onOpenChange={setShowEnvioAdiadoCalendar}>
                        <PopoverTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-2"
                          >
                            {filterEnvioAdiadoDate ? format(filterEnvioAdiadoDate, "dd/MM/yyyy", { locale: ptBR }) : "Filtrar por data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filterEnvioAdiadoDate}
                            onSelect={(date) => {
                              setFilterEnvioAdiadoDate(date);
                              setShowEnvioAdiadoCalendar(false);
                              setPage(1);
                            }}
                            locale={ptBR}
                            modifiers={{
                              comPedidos: (date) => {
                                const dateStr = format(date, 'yyyy-MM-dd');
                                return diasComPedidos.has(dateStr);
                              }
                            }}
                            modifiersStyles={{
                              comPedidos: {
                                position: 'relative',
                              }
                            }}
                            modifiersClassNames={{
                              comPedidos: 'has-pedidos'
                            }}
                            initialFocus
                          />
                          <style>{`
                            .has-pedidos::after {
                              content: '';
                              position: absolute;
                              bottom: 2px;
                              left: 50%;
                              transform: translateX(-50%);
                              width: 6px;
                              height: 6px;
                              background-color: #ef4444;
                              border-radius: 50%;
                            }
                          `}</style>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  {showFilters && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border rounded shadow z-50 p-3 overflow-visible">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium">Filtros</div>
                        <button className="text-sm text-muted-foreground" onClick={() => setShowFilters(false)}>Fechar</button>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <input id="filter-not-liberado" type="checkbox" checked={tempFilterNotLiberado} onChange={(e) => setTempFilterNotLiberado(e.target.checked)} />
                        <label htmlFor="filter-not-liberado" className="text-sm">Somente pedidos não liberados</label>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <input id="filter-cliente-formulario" type="checkbox" checked={tempFilterClienteFormNotSent} onChange={(e) => setTempFilterClienteFormNotSent(e.target.checked)} />
                        <label htmlFor="filter-cliente-formulario" className="text-sm">Somente pedidos com formulário não enviado</label>
                      </div>
                      <div className="mb-3">
                        <label htmlFor="filter-responsavel" className="text-sm block mb-1">Filtrar por responsável</label>
                        <select 
                          id="filter-responsavel" 
                          value={tempFilterResponsavelId} 
                          onChange={(e) => setTempFilterResponsavelId(e.target.value)}
                          className="w-full border rounded px-2 py-1 text-sm"
                        >
                          <option value="">Todos</option>
                          {usuariosList.map(user => (
                            <option key={user.id} value={user.id}>{user.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div className="mb-3">
                        <label htmlFor="filter-produto" className="text-sm block mb-1">Filtrar por produto</label>
                        <div className="relative">
                          <Input
                            id="filter-produto"
                            type="text"
                            placeholder="Digite o nome do produto..."
                            value={produtoSearchTerm}
                            onChange={(e) => {
                              setProdutoSearchTerm(e.target.value);
                              buscarProdutos(e.target.value);
                            }}
                            className="w-full text-sm"
                          />
                          {produtosList.length > 0 && (
                            <div className="absolute z-[100] w-full bg-white border rounded shadow-lg mt-1 max-h-48 overflow-y-auto">
                              {produtosList.map(produto => (
                                <div
                                  key={produto.id}
                                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                  onClick={() => selecionarProduto(produto)}
                                >
                                  <div className="font-medium">{produto.nome}</div>
                                  {produto.sku && <div className="text-xs text-gray-500">{produto.sku}</div>}
                                  {produto.temVariacoes && <div className="text-xs text-purple-600">Com variações</div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          // clear temporary filters
                          setTempFilterNotLiberado(false);
                          setTempFilterClienteFormNotSent(false);
                          setTempFilterResponsavelId('');
                          setSelectedProdutos([]);
                          setProdutoSearchTerm('');
                          setProdutosList([]);
                        }}>Limpar</Button>
                        <Button size="sm" onClick={() => {
                          // apply temporary filters to actual filters via query params
                          const next = new URLSearchParams(location.search);
                          if (tempFilterNotLiberado) next.set('pedido_liberado', 'false'); else next.delete('pedido_liberado');
                          if (tempFilterClienteFormNotSent) next.set('cliente_formulario_enviado', 'false'); else next.delete('cliente_formulario_enviado');
                          if (tempFilterResponsavelId) next.set('responsavel_id', tempFilterResponsavelId); else next.delete('responsavel_id');
                          // ensure module param remains
                          if (!next.get('module')) next.set('module', 'comercial');
                          navigate({ pathname: location.pathname, search: next.toString() });
                          setShowFilters(false);
                        }}>Aplicar</Button>
                      </div>
                    </div>
                  )}

                  
                  </div>
                </div>
              </div>
                </CardHeader>
              </Card>

      {/* Tabela de pedidos */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID do Pedido</TableHead>
                <TableHead className="text-center">Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Plataforma</TableHead>
                <TableHead className="text-center">Transportadora</TableHead>
                <TableHead className="text-center">Responsável</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Etiqueta</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* loading row intentionally removed per request */}
              {error && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-red-600">
                    {error}
                  </TableCell>
                </TableRow>
              )}

              {filteredPedidosComProdutos.map((pedido) => (
                <TableRow key={pedido.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => {
                  const currentParams = new URLSearchParams(location.search);
                  if (view === 'enviados') currentParams.set('readonly', '1');
                  currentParams.set('returnTo', location.pathname + location.search);
                  navigate(`/pedido/${pedido.id}?${currentParams.toString()}`);
                }}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {pedido.urgente && (
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                      )}
                          <div
                            className="max-w-[220px] truncate overflow-hidden whitespace-nowrap cursor-pointer"
                            title="Clique para copiar"
                            onClick={(e) => {
                              e.stopPropagation();
                              const text = String(pedido.idExterno || '');
                              try {
                                if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                                  navigator.clipboard.writeText(text).then(() => {
                                    toast({ title: 'Copiado', description: 'ID do pedido copiado para a área de transferência.' });
                                  }).catch((err) => {
                                    console.error('Erro ao copiar:', err);
                                    toast({ title: 'Erro', description: 'Não foi possível copiar o ID.' , variant: 'destructive'});
                                  });
                                } else {
                                  // fallback: select and execCommand (may be deprecated)
                                  const ta = document.createElement('textarea');
                                  ta.value = text;
                                  document.body.appendChild(ta);
                                  ta.select();
                                  try { document.execCommand('copy'); toast({ title: 'Copiado', description: 'ID do pedido copiado para a área de transferência.' }); }
                                  catch (ex) { console.error('Fallback copy failed', ex); toast({ title: 'Erro', description: 'Não foi possível copiar o ID.' , variant: 'destructive'}); }
                                  document.body.removeChild(ta);
                                }
                              } catch (err) {
                                console.error('Copy exception', err);
                                toast({ title: 'Erro', description: 'Não foi possível copiar o ID.' , variant: 'destructive'});
                              }
                            }}
                            style={{ color: pedido.corDoPedido || '#8B5E3C' }}
                          >
                            {pedido.idExterno}
                          </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {new Date(pedido.criadoEm).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div
                        className="font-medium max-w-[260px] truncate overflow-hidden whitespace-nowrap cursor-pointer"
                        title="Clique para copiar"
                        onClick={(e) => {
                          e.stopPropagation();
                          const text = String(pedido.clienteNome || '');
                          try {
                            if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                              navigator.clipboard.writeText(text).then(() => {
                                toast({ title: 'Copiado', description: 'Nome do cliente copiado para a área de transferência.' });
                              }).catch((err) => {
                                console.error('Erro ao copiar:', err);
                                toast({ title: 'Erro', description: 'Não foi possível copiar o nome.' , variant: 'destructive'});
                              });
                            } else {
                              const ta = document.createElement('textarea');
                              ta.value = text;
                              document.body.appendChild(ta);
                              ta.select();
                              try { document.execCommand('copy'); toast({ title: 'Copiado', description: 'Nome do cliente copiado para a área de transferência.' }); }
                              catch (ex) { console.error('Fallback copy failed', ex); toast({ title: 'Erro', description: 'Não foi possível copiar o nome.' , variant: 'destructive'}); }
                              document.body.removeChild(ta);
                            }
                          } catch (err) {
                            console.error('Copy exception', err);
                            toast({ title: 'Erro', description: 'Não foi possível copiar o nome.' , variant: 'destructive'});
                          }
                        }}
                      >
                        {pedido.clienteNome}
                      </div>
                      <div
                        className="text-sm text-muted-foreground max-w-[260px] truncate overflow-hidden whitespace-nowrap cursor-pointer"
                        title="Clique para copiar"
                        onClick={(e) => {
                          e.stopPropagation();
                          const text = String(pedido.contato || '');
                          try {
                            if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                              navigator.clipboard.writeText(text).then(() => {
                                toast({ title: 'Copiado', description: 'Contato copiado para a área de transferência.' });
                              }).catch((err) => {
                                console.error('Erro ao copiar:', err);
                                toast({ title: 'Erro', description: 'Não foi possível copiar o contato.' , variant: 'destructive'});
                              });
                            } else {
                              const ta = document.createElement('textarea');
                              ta.value = text;
                              document.body.appendChild(ta);
                              ta.select();
                              try { document.execCommand('copy'); toast({ title: 'Copiado', description: 'Contato copiado para a área de transferência.' }); }
                              catch (ex) { console.error('Fallback copy failed', ex); toast({ title: 'Erro', description: 'Não foi possível copiar o contato.' , variant: 'destructive'}); }
                              document.body.removeChild(ta);
                            }
                          } catch (err) {
                            console.error('Copy exception', err);
                            toast({ title: 'Erro', description: 'Não foi possível copiar o contato.' , variant: 'destructive'});
                          }
                        }}
                      >
                        {pedido.contato}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                      <div 
                        className="flex items-center justify-center gap-2 cursor-pointer hover:opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlataformaEditPedidoId(pedido.id);
                          setPlataformaEditValue(pedido.plataformaId || null);
                          setPlataformaEditOpen(true);
                          // load options if not loaded
                          if (!plataformaOptions.length) {
                            (async () => {
                              setLoadingPlataformaOptions(true);
                              try {
                                const { data, error } = await supabase.from('plataformas').select('*').order('nome');
                                if (error) throw error;
                                setPlataformaOptions((data || []).map((p: any) => ({ id: p.id, nome: p.nome, cor: p.cor, img_url: p.img_url })));
                              } catch (err: any) {
                                console.error('Erro ao carregar plataformas:', err);
                                toast({ title: 'Erro', description: 'Não foi possível carregar plataformas', variant: 'destructive' });
                              } finally {
                                setLoadingPlataformaOptions(false);
                              }
                            })();
                          }
                        }}
                      >
                        {pedido.plataforma?.imagemUrl ? (
                          <img src={pedido.plataforma.imagemUrl} alt={pedido.plataforma.nome} className="w-6 h-6 rounded" />
                        ) : (
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: pedido.plataforma?.cor }}
                          />
                        )}
                        {pedido.plataforma?.nome}
                      </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                      {pedido.transportadora?.imagemUrl ? (
                        <div className="w-10 h-8 overflow-hidden flex items-center justify-center">
                          <img
                            src={pedido.transportadora.imagemUrl}
                            alt={pedido.transportadora.nome || 'Transportadora'}
                            loading="lazy"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">—</div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div 
                      className="flex items-center gap-2 justify-center cursor-pointer hover:opacity-80"
                      onClick={(e) => {
                        e.stopPropagation();
                        setResponsavelEditPedidoId(pedido.id);
                        setResponsavelEditValue(pedido.responsavelId || null);
                        setResponsavelEditOpen(true);
                        // load options if not loaded
                        if (!responsavelOptions.length) {
                          (async () => {
                            setLoadingResponsavelOptions(true);
                            try {
                              const { data, error } = await supabase.from('usuarios').select('id,nome,img_url').order('nome');
                              if (error) throw error;
                              setResponsavelOptions((data || []).map((u: any) => ({ id: u.id, nome: u.nome, img_url: u.img_url })));
                            } catch (err: any) {
                              console.error('Erro ao carregar usuários:', err);
                              toast({ title: 'Erro', description: 'Não foi possível carregar usuários', variant: 'destructive' });
                            } finally {
                              setLoadingResponsavelOptions(false);
                            }
                          })();
                        }
                      }}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={pedido.responsavel?.avatar} />
                        <AvatarFallback className="text-xs">
                          {pedido.responsavel?.nome?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{pedido.responsavel?.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <div onClick={(e) => { e.stopPropagation();
                        // open status edit modal for this pedido
                        setStatusEditPedidoId(pedido.id);
                        setStatusEditValue(pedido.statusId || null);
                        setStatusEditOpen(true);
                        // load options if not loaded
                        if (!statusOptions.length) {
                          (async () => {
                            setLoadingStatusOptions(true);
                            try {
                              const { data, error } = await supabase.from('status').select('id,nome,cor_hex,ordem').order('ordem', { ascending: true });
                              setLoadingStatusOptions(false);
                              if (error) {
                                console.error('Erro ao carregar status options', error);
                                toast({ title: 'Erro', description: 'Não foi possível carregar opções de status', variant: 'destructive' });
                                return;
                              }
                              setStatusOptions(data || []);
                            } catch (err) {
                              setLoadingStatusOptions(false);
                              console.error('Exception loading status options', err);
                            }
                          })();
                        }
                      }}>
                        <Badge 
                          variant="outline"
                          className="cursor-pointer"
                          style={{ 
                            backgroundColor: `${pedido.status?.corHex}15`,
                            borderColor: pedido.status?.corHex,
                            color: pedido.status?.corHex
                          }}
                        >
                          {pedido.status?.nome}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      {((pedido as any).etiquetaEnvioId === ETIQUETA_FILTER_ID) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mb-1 bg-purple-600 text-white hover:bg-purple-700 px-2 py-0 h-6 rounded text-xs"
                          onClick={(e) => { e.stopPropagation(); handleEnvioRapido(pedido.id); }}
                        >
                          {processingRapid[pedido.id] ? 'Processando...' : 'Envio Rápido'}
                        </Button>
                      )}
                      <div className="flex items-center justify-center">
                        <Badge 
                          variant="outline" 
                          className={`${etiquetaColors[pedido.etiquetaEnvio]} cursor-pointer hover:opacity-80`}
                          onClick={(e) => { 
                            e.stopPropagation();
                            setEtiquetaEditPedidoId(pedido.id);
                            setEtiquetaEditValue((pedido as any).etiquetaEnvioId || null);
                            setEtiquetaEditOpen(true);
                            // load options if not loaded
                            if (!etiquetaOptions.length) {
                              (async () => {
                                setLoadingEtiquetaOptions(true);
                                try {
                                  const { data, error } = await supabase.from('tipos_etiqueta').select('*').order('ordem', { ascending: true });
                                  if (error) throw error;
                                  setEtiquetaOptions((data || []).map((t: any) => ({ id: t.id, nome: t.nome, cor_hex: t.cor_hex, ordem: t.ordem ?? 0 })));
                                } catch (err: any) {
                                  console.error('Erro ao carregar tipos de etiqueta:', err);
                                  toast({ title: 'Erro', description: 'Não foi possível carregar tipos de etiqueta', variant: 'destructive' });
                                } finally {
                                  setLoadingEtiquetaOptions(false);
                                }
                              })();
                            }
                          }}
                        >
                          {etiquetaLabels[pedido.etiquetaEnvio]}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                            •••
                          </Button>
                        </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          const currentParams = new URLSearchParams(location.search);
                          if (view === 'enviados') currentParams.set('readonly', '1');
                          currentParams.set('returnTo', location.pathname + location.search);
                          navigate(`/pedido/${pedido.id}?${currentParams.toString()}`);
                        }}>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          const currentParams = new URLSearchParams(location.search);
                          currentParams.set('returnTo', location.pathname + location.search);
                          navigate(`/pedido/${pedido.id}?${currentParams.toString()}`);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicatePedido(pedido.id); }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
            {/* Status edit modal reused here */}
            <EditSelectModal
              open={statusEditOpen}
              onOpenChange={(open) => setStatusEditOpen(open)}
              title="Atualizar Status"
              options={statusModalOptions}
              value={statusEditValue}
              onSave={async (selectedId) => {
                if (!statusEditPedidoId) {
                  toast({ title: 'Erro', description: 'Pedido não selecionado', variant: 'destructive' });
                  return;
                }
                try {
                  const ENVIADO_STATUS_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';
                  const updateData: any = { atualizado_em: new Date().toISOString(), status_id: selectedId || null };
                  
                  // Se o status for alterado para "Enviado", popula data_enviado
                  if (selectedId === ENVIADO_STATUS_ID) {
                    updateData.data_enviado = new Date().toISOString();
                  }
                  
                  const { error } = await supabase.from('pedidos').update(updateData).eq('id', statusEditPedidoId);
                  if (error) throw error;

                  // update local state: replace statusId and status object (if we have details)
                  const selectedStatus = statusOptions.find(s => s.id === selectedId) || null;
                  setPedidos(prev => prev.map(p => p.id === statusEditPedidoId ? { ...p, statusId: selectedId || '', status: selectedStatus ? { id: selectedStatus.id, nome: selectedStatus.nome, corHex: selectedStatus.cor_hex, ordem: selectedStatus.ordem ?? 0, criadoEm: '', atualizadoEm: '' } : p.status } : p));

                  toast({ title: 'Atualizado', description: 'Status atualizado com sucesso' });
                  setStatusEditOpen(false);
                } catch (err: any) {
                  console.error('Erro ao atualizar status do pedido:', err);
                  toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
                }
              }}
            />
            {/* Etiqueta edit modal */}
            <EditSelectModal
              open={etiquetaEditOpen}
              onOpenChange={(open) => setEtiquetaEditOpen(open)}
              title="Atualizar Etiqueta de Envio"
              options={etiquetaOptions.map(t => ({ id: t.id, nome: t.nome, cor: t.cor_hex }))}
              value={etiquetaEditValue}
              onSave={async (selectedId) => {
                if (!etiquetaEditPedidoId) {
                  toast({ title: 'Erro', description: 'Pedido não selecionado', variant: 'destructive' });
                  return;
                }
                try {
                  const updateData: any = { atualizado_em: new Date().toISOString(), etiqueta_envio_id: selectedId || null };
                  const { error } = await supabase.from('pedidos').update(updateData).eq('id', etiquetaEditPedidoId);
                  if (error) throw error;

                  // update local state: replace etiquetaEnvioId and etiqueta object
                  const selectedEtiqueta = etiquetaOptions.find(t => t.id === selectedId) || null;
                  const normalizeEtiqueta = (nome?: string) => {
                    if (!nome) return 'NAO_LIBERADO' as const;
                    const key = nome.toUpperCase();
                    if (key.includes('PEND')) return 'PENDENTE' as const;
                    if (key.includes('DISP')) return 'DISPONIVEL' as const;
                    return 'NAO_LIBERADO' as const;
                  };
                  setPedidos(prev => prev.map(p => {
                    if (p.id === etiquetaEditPedidoId) {
                      const newEtiqueta = selectedEtiqueta ? { id: selectedEtiqueta.id, nome: selectedEtiqueta.nome, corHex: selectedEtiqueta.cor_hex, ordem: selectedEtiqueta.ordem ?? 0, criadoEm: '', atualizadoEm: '' } : p.etiqueta;
                      return { 
                        ...p, 
                        etiquetaEnvio: normalizeEtiqueta(selectedEtiqueta?.nome),
                        etiqueta: newEtiqueta,
                        ...(p as any).etiquetaEnvioId !== undefined && { etiquetaEnvioId: selectedId || '' }
                      };
                    }
                    return p;
                  }));

                  toast({ title: 'Atualizado', description: 'Etiqueta atualizada com sucesso' });
                  setEtiquetaEditOpen(false);
                } catch (err: any) {
                  console.error('Erro ao atualizar etiqueta do pedido:', err);
                  toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
                }
              }}
            />
            {/* Plataforma edit modal */}
            <EditSelectModal
              open={plataformaEditOpen}
              onOpenChange={(open) => setPlataformaEditOpen(open)}
              title="Atualizar Plataforma"
              options={plataformaOptions.map(p => ({ id: p.id, nome: p.nome, cor: p.cor }))}
              value={plataformaEditValue}
              onSave={async (selectedId) => {
                if (!plataformaEditPedidoId) {
                  toast({ title: 'Erro', description: 'Pedido não selecionado', variant: 'destructive' });
                  return;
                }
                try {
                  const updateData: any = { atualizado_em: new Date().toISOString(), plataforma_id: selectedId || null };
                  const { error } = await supabase.from('pedidos').update(updateData).eq('id', plataformaEditPedidoId);
                  if (error) throw error;

                  // update local state: replace plataformaId and plataforma object
                  const selectedPlataforma = plataformaOptions.find(p => p.id === selectedId) || null;
                  setPedidos(prev => prev.map(p => {
                    if (p.id === plataformaEditPedidoId) {
                      const newPlataforma = selectedPlataforma ? {
                        id: selectedPlataforma.id,
                        nome: selectedPlataforma.nome,
                        cor: selectedPlataforma.cor,
                        imagemUrl: selectedPlataforma.img_url || undefined,
                        criadoEm: '',
                        atualizadoEm: ''
                      } : p.plataforma;
                      return { 
                        ...p, 
                        plataformaId: selectedId || '',
                        plataforma: newPlataforma
                      };
                    }
                    return p;
                  }));

                  toast({ title: 'Atualizado', description: 'Plataforma atualizada com sucesso' });
                  setPlataformaEditOpen(false);
                } catch (err: any) {
                  console.error('Erro ao atualizar plataforma do pedido:', err);
                  toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
                }
              }}
            />
            {/* Responsavel edit modal */}
            <EditSelectModal
              open={responsavelEditOpen}
              onOpenChange={(open) => setResponsavelEditOpen(open)}
              title="Atualizar Responsável"
              options={responsavelOptions.map(u => ({ id: u.id, nome: u.nome }))}
              value={responsavelEditValue}
              onSave={async (selectedId) => {
                if (!responsavelEditPedidoId) {
                  toast({ title: 'Erro', description: 'Pedido não selecionado', variant: 'destructive' });
                  return;
                }
                try {
                  const updateData: any = { atualizado_em: new Date().toISOString(), responsavel_id: selectedId || null };
                  const { error } = await supabase.from('pedidos').update(updateData).eq('id', responsavelEditPedidoId);
                  if (error) throw error;

                  // update local state: replace responsavelId and responsavel object
                  const selectedResponsavel = responsavelOptions.find(u => u.id === selectedId) || null;
                  setPedidos(prev => prev.map(p => {
                    if (p.id === responsavelEditPedidoId) {
                      const newResponsavel = selectedResponsavel ? {
                        id: selectedResponsavel.id,
                        nome: selectedResponsavel.nome,
                        email: '',
                        papel: 'operador' as const,
                        avatar: selectedResponsavel.img_url || undefined,
                        ativo: true,
                        criadoEm: '',
                        atualizadoEm: ''
                      } : p.responsavel;
                      return { 
                        ...p, 
                        responsavelId: selectedId || '',
                        responsavel: newResponsavel
                      };
                    }
                    return p;
                  }));

                  toast({ title: 'Atualizado', description: 'Responsável atualizado com sucesso' });
                  setResponsavelEditOpen(false);
                } catch (err: any) {
                  console.error('Erro ao atualizar responsável do pedido:', err);
                  toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
                }
              }}
            />
        <div className="flex items-center justify-between p-4 border-t">
          <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
              Mostrando <strong>{(page - 1) * pageSize + 1}</strong> - <strong>{Math.min(page * pageSize, total || filteredPedidosComProdutos.length)}</strong> de <strong>{total || filteredPedidosComProdutos.length}</strong>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Mostrar</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  const params = new URLSearchParams(location.search);
                  if (!params.get('module')) params.set('module', 'comercial');
                  params.set('view', view);
                  params.set('page', '1');
                  params.set('pageSize', String(newSize));
                  if (searchTerm) params.set('search', searchTerm);
                  if (filterEtiquetaId) params.set('etiqueta_envio_id', filterEtiquetaId);
                  if (filterClienteFormNotSent) params.set('cliente_formulario_enviado', 'false');
                  if (filterNotLiberado) params.set('pedido_liberado', 'false');
                  if (filterEnvioAdiado) params.set('envio_adiado', 'true');
                  navigate({ pathname: location.pathname, search: params.toString() });
                }}
                className="border rounded px-2 py-1"
              >
                {pageSizeOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">/ página</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrev} disabled={page <= 1}>Anterior</Button>
            <div className="text-sm">{page} / {totalPages}</div>
            <Button size="sm" variant="outline" onClick={handleNext} disabled={page >= totalPages}>Próximo</Button>
          </div>
        </div>
  </Card>
        </div>
      </div>

      {/* Modal de Variações */}
      <Dialog open={showVariacoesModal} onOpenChange={setShowVariacoesModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Variação</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              O produto <strong>{selectedProdutoParaVariacao?.nome}</strong> possui variações. Selecione uma:
            </p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {variacoesList.map(variacao => (
                <div
                  key={variacao.id}
                  className="p-3 border rounded hover:bg-purple-50 cursor-pointer transition-colors"
                  onClick={() => selecionarVariacao(variacao)}
                >
                  <div className="font-medium">{variacao.nome}</div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}