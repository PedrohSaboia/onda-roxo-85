import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Filter, Copy, Trash2, X, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { FaCalendarAlt } from 'react-icons/fa';
import { format, parseISO, startOfMonth, subMonths, isSameDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Pedido } from '@/types';
import { registrarHistoricoMovimentacao } from '@/lib/historicoMovimentacoes';
import EditSelectModal from '@/components/modals/EditSelectModal';
import ComercialSidebar from '@/components/layout/ComercialSidebar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HiFilter } from "react-icons/hi";


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
  const { empresaId, permissoes, hasPermissao } = useAuth();
  const { toast } = useToast();
  
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
  const urlPlataforma = params.get('plataforma_id') || '';
  const urlDataInicio = params.get('data_inicio') || '';
  const urlDataFim = params.get('data_fim') || '';
  const urlStatus = params.get('status_id') || '';
  
  // State using URL as source of truth
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(urlPage);
  const [pageSize, setPageSize] = useState(urlPageSize);
  const [pageInputValue, setPageInputValue] = useState(String(urlPage));
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
  const CANCELADO_STATUS_ID = '09ddb68a-cff3-4a69-a120-7459642cca6f';
  const [filterNotLiberado, setFilterNotLiberado] = useState(urlLiberado);
  const [filterResponsavelId, setFilterResponsavelId] = useState(urlResponsavel);
  const [filterPlataformaId, setFilterPlataformaId] = useState(urlPlataforma);
  const [filterStatusId, setFilterStatusId] = useState(urlStatus);
  const [filterDataInicio, setFilterDataInicio] = useState(urlDataInicio);
  const [filterDataFim, setFilterDataFim] = useState(urlDataFim);
  
  // Date picker states
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  
  const [usuariosList, setUsuariosList] = useState<Array<{ id: string; nome: string }>>([]);
  const [plataformasList, setPlataformasList] = useState<Array<{ id: string; nome: string }>>([]);
  const urlEnvioAdiado = params.get('envio_adiado') === 'true';
  const [filterEnvioAdiado, setFilterEnvioAdiado] = useState(urlEnvioAdiado);
  
  // Estado para filtro de duplicados
  const urlDuplicados = params.get('duplicados') === 'true';
  const [filterDuplicados, setFilterDuplicados] = useState(urlDuplicados);
  
  // Estados temporários para o modal de filtros (antes de aplicar)
  const [tempFilterNotLiberado, setTempFilterNotLiberado] = useState(urlLiberado);
  const [tempFilterClienteFormNotSent, setTempFilterClienteFormNotSent] = useState(urlClienteForm);
  const [tempFilterResponsavelId, setTempFilterResponsavelId] = useState(urlResponsavel);
  const [tempFilterPlataformaId, setTempFilterPlataformaId] = useState(urlPlataforma);
  const [tempFilterStatusId, setTempFilterStatusId] = useState(urlStatus);
  const [tempFilterDuplicados, setTempFilterDuplicados] = useState(urlDuplicados);
  
  // Estados para filtro de produtos
  const [produtosList, setProdutosList] = useState<Array<{ id: string; nome: string; sku: string; temVariacoes: boolean }>>([]);
  const [produtoSearchTerm, setProdutoSearchTerm] = useState('');
  const [selectedProdutos, setSelectedProdutos] = useState<Array<{ id: string; nome: string; tipo: 'produto' | 'variacao'; variacaoNome?: string }>>([]);
  const [showVariacoesModal, setShowVariacoesModal] = useState(false);
  const [variacoesList, setVariacoesList] = useState<Array<{ id: string; nome: string; produtoId: string; produtoNome: string }>>([]);
  const [selectedProdutoParaVariacao, setSelectedProdutoParaVariacao] = useState<{ id: string; nome: string } | null>(null);
  
  // Ref para o dropdown de filtros
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // status list for filter dropdown
  const [filterStatusList, setFilterStatusList] = useState<Array<{ id: string; nome: string; cor_hex?: string; ordem?: number }>>([]);
  const [loadingFilterStatusList, setLoadingFilterStatusList] = useState(false);
  
  // Estados para seleção de pedidos
  const [selectedPedidosIds, setSelectedPedidosIds] = useState<Set<string>>(new Set());
  const [selectedMelhorEnvioIds, setSelectedMelhorEnvioIds] = useState<string[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Função para deletar os pedidos selecionados (usada pelo AlertDialog)
  const deleteSelectedPedidos = async () => {
    try {
      const idsArray = Array.from(selectedPedidosIds);
      
      // Registrar no histórico antes de deletar
      for (const pedidoId of idsArray) {
        await registrarHistoricoMovimentacao(
          pedidoId,
          'Pedido excluído'
        );
      }
      
      const { error } = await supabase
        .from('pedidos')
        .delete()
        .in('id', idsArray);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `${idsArray.length} ${idsArray.length === 1 ? 'pedido excluído' : 'pedidos excluídos'} com sucesso`,
      });

      // Remover da lista local
      setPedidos(prev => prev.filter(p => !selectedPedidosIds.has(p.id)));
      setSelectedPedidosIds(new Set());
      setSelectedMelhorEnvioIds([]);

      // Fechar diálogo
      setConfirmDeleteOpen(false);

      // Forçar recarga atualizando o estado de página para re-executar o useEffect
      setPage(p => p);
    } catch (err: any) {
      console.error('Erro ao excluir pedidos:', err);
      toast({
        title: 'Erro',
        description: err?.message || 'Não foi possível excluir os pedidos',
        variant: 'destructive',
      });
    }
  };
  
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
    const newPlataforma = params.get('plataforma_id') || '';
    const newEnvioAdiado = params.get('envio_adiado') === 'true';
    const newEnvioAdiadoDate = params.get('envio_adiado_date') || '';
    const newDuplicados = params.get('duplicados') === 'true';
    const newDataInicio = params.get('data_inicio') || '';
    const newDataFim = params.get('data_fim') || '';
    const newStatus = params.get('status_id') || '';
    
    setPage(newPage);
    setPageSize(newPageSize);
    setPageInputValue(String(newPage));
    setSearchTerm(newSearch);
    setFilterEtiquetaId(newEtiqueta);
    setFilterClienteFormNotSent(newClienteForm);
    setFilterNotLiberado(newLiberado);
    setFilterResponsavelId(newResponsavel);
    setFilterPlataformaId(newPlataforma);
    setFilterEnvioAdiado(newEnvioAdiado);
    setFilterEnvioAdiadoDate(newEnvioAdiadoDate ? new Date(newEnvioAdiadoDate + 'T00:00:00') : undefined);
    setFilterDuplicados(newDuplicados);
    setFilterDataInicio(newDataInicio);
    setFilterDataFim(newDataFim);
    setFilterStatusId(newStatus);
    
    // Sincronizar tempStartDate e tempEndDate para o date picker
    if (newDataInicio) {
      setTempStartDate(new Date(newDataInicio + 'T00:00:00'));
    } else {
      setTempStartDate(null);
    }
    if (newDataFim) {
      setTempEndDate(new Date(newDataFim + 'T00:00:00'));
    } else {
      setTempEndDate(null);
    }
    
    // Sincronizar estados temporários
    setTempFilterNotLiberado(newLiberado);
    setTempFilterClienteFormNotSent(newClienteForm);
    setTempFilterResponsavelId(newResponsavel);
    setTempFilterPlataformaId(newPlataforma);
    setTempFilterStatusId(newStatus);
    setTempFilterDuplicados(newDuplicados);
  }, [location.search]);

  // Fechar dropdown de filtros ao clicar fora
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

        // Exclude pedidos with 'Enviado' and 'Cancelado' status from the main Comercial list
        // (those are shown in the dedicated PedidosEnviados page)
        (query as any).neq('status_id', ENVIADO_STATUS_ID);
        (query as any).neq('status_id', CANCELADO_STATUS_ID);

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

        // apply plataforma_id filter when requested
        if (filterPlataformaId) {
          (query as any).eq('plataforma_id', filterPlataformaId);
        }

        // apply status_id filter when requested
        if (filterStatusId) {
          (query as any).eq('status_id', filterStatusId);
        }

        // apply cliente formulario not sent filter (formulario_enviado = false)
        if (filterClienteFormNotSent) {
          (query as any).eq('formulario_enviado', false);
        }

        // apply duplicados filter
        if (filterDuplicados) {
          (query as any).eq('duplicata', true);
        }

        // apply data_inicio filter
        if (filterDataInicio) {
          const dataInicioISO = new Date(filterDataInicio).toISOString();
          (query as any).gte('pedido_criado_em', dataInicioISO);
        }

        // apply data_fim filter
        if (filterDataFim) {
          const dataFimDate = new Date(filterDataFim);
          dataFimDate.setHours(23, 59, 59, 999);
          const dataFimISO = dataFimDate.toISOString();
          (query as any).lte('pedido_criado_em', dataFimISO);
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
        let melhorEnvioMap: Record<string, string | undefined> = {};
        if (pedidoIds.length) {
          try {
            const { data: pedidosData, error: pedidosErr } = await supabase.from('pedidos').select('id, cor_do_pedido, id_melhor_envio').in('id', pedidoIds as any[]);
            if (!pedidosErr && pedidosData) {
              corMap = (pedidosData as any[]).reduce((acc: any, p: any) => (acc[p.id] = p.cor_do_pedido || undefined, acc), {} as Record<string, string>);
              melhorEnvioMap = (pedidosData as any[]).reduce((acc: any, p: any) => (acc[p.id] = p.id_melhor_envio || undefined, acc), {} as Record<string, string>);
            }
          } catch (fetchErr) {
            console.warn('Não foi possível carregar dados adicionais da tabela pedidos:', fetchErr);
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
            id_melhor_envio: melhorEnvioMap[row.pedido_id] || undefined,
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
  }, [page, pageSize, view, filterNotLiberado, filterEtiquetaId, filterResponsavelId, filterPlataformaId, filterStatusId, filterEnvioAdiado, filterEnvioAdiadoDate, filterClienteFormNotSent, filterDuplicados, filterDataInicio, filterDataFim, searchTerm, selectedProdutos]);

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

  // load list of status for filter dropdown
  useEffect(() => {
    let mounted = true;
    const loadStatusList = async () => {
      setLoadingFilterStatusList(true);
      try {
        const { data, error } = await supabase.from('status').select('id, nome, cor_hex, ordem').order('ordem');
        if (error) throw error;
        if (!mounted) return;
        setFilterStatusList(data || []);
      } catch (err) {
        console.error('Erro ao carregar status:', err);
      } finally {
        setLoadingFilterStatusList(false);
      }
    };
    loadStatusList();
    return () => { mounted = false };
  }, []);

  // load list of plataformas for filter dropdown
  useEffect(() => {
    let mounted = true;
    const loadPlataformas = async () => {
      try {
        const { data, error } = await supabase.from('plataformas').select('id, nome').order('nome');
        if (error) throw error;
        if (!mounted) return;
        setPlataformasList(data || []);
      } catch (err) {
        console.error('Erro ao carregar plataformas:', err);
      }
    };
    loadPlataformas();
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
          .neq('status_id', CANCELADO_STATUS_ID)
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
          .neq('status_id', CANCELADO_STATUS_ID)
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
          .neq('status_id', ENVIADO_STATUS_ID)
          .neq('status_id', CANCELADO_STATUS_ID);
        
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
    const CANCELADO_ID = '09ddb68a-cff3-4a69-a120-7459642cca6f';
    const loadTotal = async () => {
      try {
        const { count, error } = await supabase.from('pedidos').select('id', { count: 'exact' }).neq('status_id', ENVIADO_ID).neq('status_id', CANCELADO_ID).limit(1);
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

  // A busca e todos os filtros são feitos server-side, então não precisamos filtrar client-side
  // O count retornado pelo servidor já reflete todos os filtros aplicados
  const filteredPedidosComProdutos = pedidos;

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
        
        // Registrar no histórico de movimentações
        await registrarHistoricoMovimentacao(
          pedidoId,
          'Frete enviado ao carrinho do Melhor Envio'
        );
        
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
        
        // Registrar no histórico de movimentações
        await registrarHistoricoMovimentacao(
          pedidoId,
          `Frete calculado e enviado ao carrinho - ${maisBarato.transportadora} (R$ ${maisBarato.preco.toFixed(2)})`
        );
        
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
                await registrarHistoricoMovimentacao(pedidoId, 'Etiqueta processada no Melhor Envio');
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
          // Registrar no histórico de movimentações
          await registrarHistoricoMovimentacao(
            pedidoId,
            'Pedido duplicado - marcado como original'
          );

          const idExternoOriginal = (pedidoRow as any).id_externo || '(vazio)';
          const idExternoNovo = newPedidoPayload.id_externo || '(vazio)';
          if (idExternoOriginal !== idExternoNovo) {
            await registrarHistoricoMovimentacao(
              pedidoId,
              `ID externo alterado na duplicação: ${idExternoOriginal} → ${idExternoNovo}`
            );
          }
          
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
          const itensPayload = [];
          for (const it of itens) {
            // Buscar dimensões do produto ou variação
            let dimensoes = { altura: null, largura: null, comprimento: null, peso: null };
            
            try {
              // Se tem variação, buscar da variação primeiro
              if (it.variacao_id) {
                const { data: variacaoData } = await supabase
                  .from('variacoes_produto')
                  .select('altura, largura, comprimento, peso')
                  .eq('id', it.variacao_id)
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
                  .eq('id', it.produto_id)
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
            
            itensPayload.push({
              pedido_id: newPedidoId,
              produto_id: it.produto_id,
              variacao_id: it.variacao_id || null,
              quantidade: it.quantidade || 1,
              preco_unitario: it.preco_unitario || it.preco || 0,
              codigo_barras: it.codigo_barras || null,
              altura: dimensoes.altura,
              largura: dimensoes.largura,
              comprimento: dimensoes.comprimento,
              peso: dimensoes.peso,
              criado_em: new Date().toISOString(),
              empresa_id: empresaId || null
            });
          }
          
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

  // Funções de seleção de pedidos
  const toggleSelectPedido = (pedidoId: string) => {
    setSelectedPedidosIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pedidoId)) {
        newSet.delete(pedidoId);
        // Remover id_melhor_envio correspondente
        const pedido = pedidos.find(p => p.id === pedidoId);
        if (pedido && (pedido as any).id_melhor_envio) {
          setSelectedMelhorEnvioIds(prevIds => prevIds.filter(id => id !== (pedido as any).id_melhor_envio));
        }
      } else {
        newSet.add(pedidoId);
        // Adicionar id_melhor_envio correspondente
        const pedido = pedidos.find(p => p.id === pedidoId);
        console.log('Pedido selecionado:', pedido);
        console.log('id_melhor_envio:', (pedido as any)?.id_melhor_envio);
        if (pedido && (pedido as any).id_melhor_envio) {
          setSelectedMelhorEnvioIds(prevIds => {
            const newIds = [...prevIds, (pedido as any).id_melhor_envio];
            console.log('IDs Melhor Envio atualizados:', newIds);
            return newIds;
          });
        }
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPedidosIds.size === filteredPedidosComProdutos.length && filteredPedidosComProdutos.length > 0) {
      setSelectedPedidosIds(new Set());
      setSelectedMelhorEnvioIds([]);
    } else {
      setSelectedPedidosIds(new Set(filteredPedidosComProdutos.map(p => p.id)));
      // Coletar todos os id_melhor_envio dos pedidos filtrados
      const melhorEnvioIds = filteredPedidosComProdutos
        .filter(p => (p as any).id_melhor_envio)
        .map(p => (p as any).id_melhor_envio);
      setSelectedMelhorEnvioIds(melhorEnvioIds);
    }
  };

  const isAllSelected = filteredPedidosComProdutos.length > 0 && selectedPedidosIds.size === filteredPedidosComProdutos.length;
  const isSomeSelected = selectedPedidosIds.size > 0 && selectedPedidosIds.size < filteredPedidosComProdutos.length;

  // Usar sempre o count do servidor para paginação correta
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
    if (filterStatusId) params.set('status_id', filterStatusId);
    if (filterEnvioAdiado) params.set('envio_adiado', 'true');
    if (filterDataInicio) params.set('data_inicio', filterDataInicio);
    if (filterDataFim) params.set('data_fim', filterDataFim);
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

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const inputPage = parseInt(pageInputValue, 10);
      if (!isNaN(inputPage) && inputPage >= 1 && inputPage <= totalPages) {
        updatePageInUrl(inputPage);
      } else {
        setPageInputValue(String(page));
      }
    }
  };

  const pageSizeOptions = [10, 20, 30, 50];

  // Date picker functions
  const handleDateClick = (date: Date) => {
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      setTempStartDate(date);
      setTempEndDate(null);
    } else {
      if (date < tempStartDate) {
        setTempEndDate(tempStartDate);
        setTempStartDate(date);
      } else {
        setTempEndDate(date);
      }
    }
  };

  const applyCustomDates = () => {
    if (tempStartDate) {
      const newDataInicio = format(tempStartDate, 'yyyy-MM-dd');
      const newDataFim = tempEndDate ? format(tempEndDate, 'yyyy-MM-dd') : newDataInicio;
      
      const next = new URLSearchParams(location.search);
      next.set('data_inicio', newDataInicio);
      next.set('data_fim', newDataFim);
      next.set('page', '1');
      navigate({ pathname: location.pathname, search: next.toString() });
    }
    setPickerOpen(false);
  };

  const clearDateFilter = () => {
    setTempStartDate(null);
    setTempEndDate(null);
    setPickerOpen(false);
    
    const next = new URLSearchParams(location.search);
    next.delete('data_inicio');
    next.delete('data_fim');
    next.set('page', '1');
    navigate({ pathname: location.pathname, search: next.toString() });
  };

  const handlePreset = (presetFn: () => void) => {
    presetFn();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (calendarMonth === 0) {
        setCalendarMonth(11);
        setCalendarYear(calendarYear - 1);
      } else {
        setCalendarMonth(calendarMonth - 1);
      }
    } else {
      if (calendarMonth === 11) {
        setCalendarMonth(0);
        setCalendarYear(calendarYear + 1);
      } else {
        setCalendarMonth(calendarMonth + 1);
      }
    }
  };

  const renderCalendar = (monthOffset: number = 0) => {
    const today = new Date();
    
    const displayYear = monthOffset === 0 ? calendarYear : (calendarMonth === 11 ? calendarYear + 1 : calendarYear);
    const displayMonth = monthOffset === 0 ? calendarMonth : (calendarMonth === 11 ? 0 : calendarMonth + 1);
    
    const firstDay = new Date(displayYear, displayMonth, 1);
    const lastDay = new Date(displayYear, displayMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-9" />);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(displayYear, displayMonth, day);
      const isFirstDay = tempStartDate && isSameDay(date, tempStartDate);
      const isLastDay = tempEndDate && isSameDay(date, tempEndDate);
      const isSelected = isFirstDay || isLastDay;
      const isInRange = tempStartDate && tempEndDate && 
                       isWithinInterval(date, { start: tempStartDate, end: tempEndDate }) &&
                       !isFirstDay && !isLastDay;
      const isHovered = hoverDate && tempStartDate && !tempEndDate &&
                       isWithinInterval(date, { 
                         start: tempStartDate < hoverDate ? tempStartDate : hoverDate,
                         end: tempStartDate < hoverDate ? hoverDate : tempStartDate
                       });
      const isToday = isSameDay(date, today);
      
      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(date)}
          onMouseEnter={() => setHoverDate(date)}
          onMouseLeave={() => setHoverDate(null)}
          className={`
            h-9 w-9 text-sm transition-colors flex items-center justify-center
            ${isFirstDay && !isLastDay ? 'rounded-l-full bg-custom-600 text-white font-semibold' : ''}
            ${isLastDay && !isFirstDay ? 'rounded-r-full bg-custom-600 text-white font-semibold' : ''}
            ${isFirstDay && isLastDay ? 'rounded-full bg-custom-600 text-white font-semibold' : ''}
            ${isInRange || isHovered ? 'bg-custom-600 text-white' : ''}
            ${!isSelected && !isInRange && !isHovered ? 'rounded hover:bg-gray-100' : ''}
            ${isToday && !isSelected ? 'border-2 rounded-full border-custom-600' : ''}
          `}
        >
          {day}
        </button>
      );
    }
    
    return (
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          {monthOffset === 0 && (
            <button
              onClick={() => navigateMonth('prev')}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              type="button"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {monthOffset === 1 && <div className="w-7" />}
          <div className="text-center font-semibold text-base">
            {format(firstDay, 'MMMM yyyy', { locale: ptBR })}
          </div>
          {monthOffset === 1 && (
            <button
              onClick={() => navigateMonth('next')}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              type="button"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
          {monthOffset === 0 && <div className="w-7" />}
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2 text-xs text-gray-500 text-center font-medium">
          <div>DOM</div>
          <div>SEG</div>
          <div>TER</div>
          <div>QUA</div>
          <div>QUI</div>
          <div>SEX</div>
          <div>SÁB</div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>
      </div>
    );
  };

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
                    : `${totalExcludingEnviados} pedidos encontrados`}
              </p>
            </div>
            <Button className="bg-custom-600 hover:bg-custom-700" onClick={() => {
              const canCreate = hasPermissao ? hasPermissao(33) : (permissoes ?? []).includes(33);
              if (!canCreate) {
                toast({ title: 'Você não tem permissão para isso', variant: 'destructive' });
                return;
              }
              navigate('/novo-pedido');
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pedido
            </Button>
          </div>

      {/* Filtros e busca */}
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative" ref={filterDropdownRef}>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  // Sincronizar estados temporários com os filtros atuais ao abrir
                  setTempFilterNotLiberado(filterNotLiberado);
                  setTempFilterClienteFormNotSent(filterClienteFormNotSent);
                  setTempFilterResponsavelId(filterResponsavelId);
                  setTempFilterPlataformaId(filterPlataformaId);
                  setTempFilterStatusId(filterStatusId);
                  setTempFilterDuplicados(filterDuplicados);
                  setShowFilters(s => !s);
                }}>
                  <HiFilter className="h-5 w-5" />
                </Button>

                {showFilters && (
                  <div className="absolute left-0 top-full mt-2 w-64 bg-white border rounded shadow z-50 p-3 overflow-visible">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Filtros</div>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setShowFilters(false)}><X className="h-4 w-4" /></button>
                    </div>
                    <div className="mb-3">
                      <label htmlFor="filter-status" className="text-sm block mb-1">Filtrar por status</label>
                      <select
                        id="filter-status"
                        value={tempFilterStatusId}
                        onChange={(e) => setTempFilterStatusId(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                      >
                        <option value="">Todos</option>
                        {filterStatusList.map(s => (
                          <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <input id="filter-not-liberado" type="checkbox" checked={tempFilterNotLiberado} onChange={(e) => setTempFilterNotLiberado(e.target.checked)} />
                      <label htmlFor="filter-not-liberado" className="text-sm">Somente pedidos não liberados</label>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <input id="filter-cliente-formulario" type="checkbox" checked={tempFilterClienteFormNotSent} onChange={(e) => setTempFilterClienteFormNotSent(e.target.checked)} />
                      <label htmlFor="filter-cliente-formulario" className="text-sm">Somente pedidos com formulário não enviado</label>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <input id="filter-duplicados" type="checkbox" checked={tempFilterDuplicados} onChange={(e) => setTempFilterDuplicados(e.target.checked)} />
                      <label htmlFor="filter-duplicados" className="text-sm">Somente pedidos duplicados</label>
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
                      <label htmlFor="filter-plataforma" className="text-sm block mb-1">Filtrar por plataforma</label>
                      <select 
                        id="filter-plataforma" 
                        value={tempFilterPlataformaId} 
                        onChange={(e) => setTempFilterPlataformaId(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                      >
                        <option value="">Todas</option>
                        {plataformasList.map(plataforma => (
                          <option key={plataforma.id} value={plataforma.id}>{plataforma.nome}</option>
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
                                {produto.temVariacoes && <div className="text-xs text-custom-600">Com variações</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        // clear temporary filters
                        setTempFilterNotLiberado(false);
                        setTempFilterClienteFormNotSent(false);
                        setTempFilterResponsavelId('');
                        setTempFilterPlataformaId('');
                        setTempFilterStatusId('');
                        setTempFilterDuplicados(false);
                        setSelectedProdutos([]);
                        setProdutoSearchTerm('');
                        setProdutosList([]);
                      }}>Limpar</Button>
                      <Button type="button" size="sm" onClick={() => {
                        // apply temporary filters to actual filters via query params
                        const next = new URLSearchParams(location.search);
                        if (tempFilterNotLiberado) next.set('pedido_liberado', 'false'); else next.delete('pedido_liberado');
                        if (tempFilterClienteFormNotSent) next.set('cliente_formulario_enviado', 'false'); else next.delete('cliente_formulario_enviado');
                        if (tempFilterResponsavelId) next.set('responsavel_id', tempFilterResponsavelId); else next.delete('responsavel_id');
                        if (tempFilterPlataformaId) next.set('plataforma_id', tempFilterPlataformaId); else next.delete('plataforma_id');
                        if (tempFilterStatusId) next.set('status_id', tempFilterStatusId); else next.delete('status_id');
                        if (tempFilterDuplicados) next.set('duplicados', 'true'); else next.delete('duplicados');
                        // module query removed — navigation uses pathname now
                        navigate({ pathname: location.pathname, search: next.toString() });
                        setShowFilters(false);
                      }}>Aplicar</Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar pedidos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex items-center gap-2 ">
                {/* Botão de calendário de data */}
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex items-center justify-center gap-2"
                    >
                      <FaCalendarAlt className="h-4 w-4" />
                      <span className="text-sm">
                        {filterDataInicio && filterDataFim 
                          ? `${format(parseISO(filterDataInicio), 'dd/MM/yy', { locale: ptBR })} → ${format(parseISO(filterDataFim), 'dd/MM/yy', { locale: ptBR })}`
                          : 'Filtrar por data'
                        }
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <div className="px-4 py-3 border-b">
                      <h3 className="font-semibold text-base">Selecionar Período</h3>
                    </div>
                    
                    <div className="flex">
                      <div className="w-48 border-r">
                        <div className="py-2">
                          {[
                            { label: 'Hoje', fn: () => { const d = new Date(); const sd = format(d, 'yyyy-MM-dd'); setTempStartDate(d); setTempEndDate(d); const next = new URLSearchParams(location.search); next.set('data_inicio', sd); next.set('data_fim', sd); next.set('page', '1'); navigate({ pathname: location.pathname, search: next.toString() }); setPickerOpen(false); } },
                            { label: 'Ontem', fn: () => { const d = new Date(); d.setDate(d.getDate() - 1); const sd = format(d, 'yyyy-MM-dd'); setTempStartDate(d); setTempEndDate(d); const next = new URLSearchParams(location.search); next.set('data_inicio', sd); next.set('data_fim', sd); next.set('page', '1'); navigate({ pathname: location.pathname, search: next.toString() }); setPickerOpen(false); } },
                            { label: 'Últimos 7 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 6); const sd = format(s, 'yyyy-MM-dd'); const ed = format(e, 'yyyy-MM-dd'); setTempStartDate(s); setTempEndDate(e); const next = new URLSearchParams(location.search); next.set('data_inicio', sd); next.set('data_fim', ed); next.set('page', '1'); navigate({ pathname: location.pathname, search: next.toString() }); setPickerOpen(false); } },
                            { label: 'Últimos 14 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 13); const sd = format(s, 'yyyy-MM-dd'); const ed = format(e, 'yyyy-MM-dd'); setTempStartDate(s); setTempEndDate(e); const next = new URLSearchParams(location.search); next.set('data_inicio', sd); next.set('data_fim', ed); next.set('page', '1'); navigate({ pathname: location.pathname, search: next.toString() }); setPickerOpen(false); } },
                            { label: 'Últimos 30 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 29); const sd = format(s, 'yyyy-MM-dd'); const ed = format(e, 'yyyy-MM-dd'); setTempStartDate(s); setTempEndDate(e); const next = new URLSearchParams(location.search); next.set('data_inicio', sd); next.set('data_fim', ed); next.set('page', '1'); navigate({ pathname: location.pathname, search: next.toString() }); setPickerOpen(false); } },
                            { label: 'Este mês', fn: () => { const e = new Date(); const s = startOfMonth(e); const sd = format(s, 'yyyy-MM-dd'); const ed = format(e, 'yyyy-MM-dd'); setTempStartDate(s); setTempEndDate(e); const next = new URLSearchParams(location.search); next.set('data_inicio', sd); next.set('data_fim', ed); next.set('page', '1'); navigate({ pathname: location.pathname, search: next.toString() }); setPickerOpen(false); } },
                            { label: 'Mês passado', fn: () => { const hoje = new Date(); const mesPassado = subMonths(hoje, 1); const s = startOfMonth(mesPassado); const e = new Date(mesPassado.getFullYear(), mesPassado.getMonth() + 1, 0); const sd = format(s, 'yyyy-MM-dd'); const ed = format(e, 'yyyy-MM-dd'); setTempStartDate(s); setTempEndDate(e); const next = new URLSearchParams(location.search); next.set('data_inicio', sd); next.set('data_fim', ed); next.set('page', '1'); navigate({ pathname: location.pathname, search: next.toString() }); setPickerOpen(false); } },
                            { label: 'Limpar filtro', fn: () => { clearDateFilter(); } },
                          ].map((preset, idx) => (
                            <button
                              key={idx}
                              onClick={() => handlePreset(preset.fn)}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex flex-col">
                        <div className="flex">
                          {renderCalendar(0)}
                          {renderCalendar(1)}
                        </div>
                        
                        <div className="flex gap-2 px-4 py-3 border-t">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => {
                              setTempStartDate(filterDataInicio ? new Date(filterDataInicio + 'T00:00:00') : null);
                              setTempEndDate(filterDataFim ? new Date(filterDataFim + 'T00:00:00') : null);
                              setPickerOpen(false);
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button 
                            size="sm" 
                            className="flex-1 bg-custom-600 hover:bg-custom-700"
                            onClick={applyCustomDates}
                            disabled={!tempStartDate}
                          >
                            Atualizar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                
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
                    // module query removed — navigation uses pathname now
                    setPage(1);
                    navigate({ pathname: location.pathname, search: next.toString() });
                  }}
                  className="flex items-center gap-2 border border-gray-200 shadow-sm"
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
                      next.delete('envio_adiado_date');
                    } else {
                      setFilterEnvioAdiado(true);
                      next.set('envio_adiado', 'true');
                    }
                    // module query removed — navigation uses pathname now
                    setPage(1);
                    navigate({ pathname: location.pathname, search: next.toString() });
                  }}
                  className="flex items-center gap-2 border border-gray-200 shadow-sm"
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
                    <PopoverContent className="w-auto p-0 mr-5" align="start">
                      <Calendar
                        mode="single"
                        selected={filterEnvioAdiadoDate}
                        onSelect={(date) => {
                          // persist selection into URL so it survives navigation
                          const next = new URLSearchParams(location.search);
                          next.set('envio_adiado', 'true');
                          // store as yyyy-MM-dd
                          const dateStr = format(date, 'yyyy-MM-dd');
                          next.set('envio_adiado_date', dateStr);
                          navigate({ pathname: location.pathname, search: next.toString() });
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
            </div>

            {/* Barra de ações em lote */}
            {selectedPedidosIds.size > 0 && (
              <div className="mt-4 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-custom-900">
                      {selectedPedidosIds.size} {selectedPedidosIds.size === 1 ? 'pedido selecionado' : 'pedidos selecionados'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedPedidosIds(new Set());
                        setSelectedMelhorEnvioIds([]);
                      }}
                      className="text-custom-600 hover:text-custom-800 hover:bg-custom-100 h-7"
                    >
                      Limpar seleção
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          toast({
                            title: 'Processando',
                            description: 'Gerando etiquetas em lote...',
                          });

                          console.log('Enviando IDs para impressão:', selectedMelhorEnvioIds);

                          const { data, error } = await supabase.functions.invoke('impressao_em_lote_melhor_envio', {
                            body: { shipment_ids: selectedMelhorEnvioIds }
                          });

                          if (error) {
                            throw new Error(error.message || 'Erro ao gerar etiquetas em lote');
                          }

                          console.log('Resposta da impressão em lote:', data);
                          console.log('Tipo de data:', typeof data);
                          console.log('Keys de data:', Object.keys(data || {}));
                          console.log('data.url:', data?.url);

                          // Tentar pegar a URL de diferentes estruturas possíveis
                          const url = data?.url || (typeof data === 'string' ? JSON.parse(data).url : null);
                          
                          console.log('URL extraída:', url);

                          // Abrir o link da etiqueta em nova guia
                          if (url) {
                            console.log('Abrindo URL:', url);
                            const janela = window.open(url, '_blank', 'noopener,noreferrer');
                            
                            if (janela) {
                              toast({
                                title: 'Sucesso',
                                description: `${selectedMelhorEnvioIds.length} etiqueta(s) gerada(s) e abrindo em nova guia`,
                              });
                            } else {
                              toast({
                                title: 'Aviso',
                                description: 'Etiquetas geradas! Por favor, permita pop-ups no navegador.',
                                variant: 'destructive',
                              });
                            }
                          } else {
                            console.warn('Nenhuma URL retornada na resposta:', data);
                            toast({
                              title: 'Aviso',
                              description: 'Etiquetas geradas, mas nenhum link foi retornado',
                              variant: 'destructive',
                            });
                          }
                        } catch (err: any) {
                          console.error('Erro ao imprimir etiquetas em lote:', err);
                          toast({
                            title: 'Erro',
                            description: err?.message || 'Não foi possível gerar as etiquetas',
                            variant: 'destructive',
                          });
                        }
                      }}
                      className="flex items-center gap-2 h-8 bg-custom-600 text-white hover:bg-custom-700 hover:text-white"
                      disabled={selectedMelhorEnvioIds.length === 0}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Imprimir etiquetas em lote ({selectedMelhorEnvioIds.length})
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        const canBulkDelete = (hasPermissao ? hasPermissao(35) : false) || ((permissoes ?? []).includes(35));
                        if (!canBulkDelete) {
                          toast({ title: 'Sem permissão', description: 'Você não tem permissão para excluir pedidos.', variant: 'destructive' });
                          return;
                        }

                        if (!confirm(`Tem certeza que deseja excluir ${selectedPedidosIds.size} ${selectedPedidosIds.size === 1 ? 'pedido' : 'pedidos'}?`)) {
                          return;
                        }

                        try {
                          const idsArray = Array.from(selectedPedidosIds);
                          // Registrar histórico antes de deletar
                          for (const pid of idsArray) {
                            await registrarHistoricoMovimentacao(pid, 'Pedido excluído em massa');
                          }
                          const { error } = await supabase
                            .from('pedidos')
                            .delete()
                            .in('id', idsArray);

                          if (error) throw error;

                          toast({
                            title: 'Sucesso',
                            description: `${idsArray.length} ${idsArray.length === 1 ? 'pedido excluído' : 'pedidos excluídos'} com sucesso`,
                          });

                          // Remover da lista local
                          setPedidos(prev => prev.filter(p => !selectedPedidosIds.has(p.id)));
                          setSelectedPedidosIds(new Set());
                          setSelectedMelhorEnvioIds([]);

                          // Forçar recarga atualizando o estado de página para re-executar o useEffect
                          setPage(p => p);
                        } catch (err: any) {
                          console.error('Erro ao excluir pedidos:', err);
                          toast({
                            title: 'Erro',
                            description: err?.message || 'Não foi possível excluir os pedidos',
                            variant: 'destructive',
                          });
                        }
                      }}
                      className="flex items-center gap-2 h-8"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir {selectedPedidosIds.size === 1 ? 'pedido' : 'pedidos'}
                    </Button>
                    {/* Dialogo de confirmação customizado (substitui window.confirm) */}
                    <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir {selectedPedidosIds.size === 1 ? 'Pedido' : 'Pedidos'}</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir {selectedPedidosIds.size} {selectedPedidosIds.size === 1 ? 'pedido' : 'pedidos'}? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setConfirmDeleteOpen(false)}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={deleteSelectedPedidos}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            )}

            {/* Active filter tags */}
            {(filterNotLiberado || filterClienteFormNotSent || !!filterEtiquetaId || !!filterResponsavelId || !!filterPlataformaId || filterEnvioAdiado || selectedProdutos.length > 0) && (
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
                        // module query removed — navigation uses pathname now
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
                        // module query removed — navigation uses pathname now
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
                        // module query removed — navigation uses pathname now
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
                          const next = new URLSearchParams(location.search);
                          next.delete('envio_adiado_date');
                          navigate({ pathname: location.pathname, search: next.toString() });
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
                        next.delete('envio_adiado_date');
                        // module query removed — navigation uses pathname now
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
                        // module query removed — navigation uses pathname now
                        navigate({ pathname: location.pathname, search: next.toString() });
                      }}
                      aria-label="Remover filtro responsável"
                    >
                      ×
                    </button>
                  </div>
                )}

                {filterPlataformaId && (
                  <div className="flex items-center gap-2 bg-gray-100 text-gray-800 px-3 py-1 rounded">
                    <span className="text-sm">Plataforma: {plataformasList.find(p => p.id === filterPlataformaId)?.nome || 'Selecionada'}</span>
                    <button
                      className="text-gray-500 hover:text-gray-700"
                      onClick={() => {
                        setFilterPlataformaId('');
                        setPage(1);
                        const next = new URLSearchParams(location.search);
                        next.delete('plataforma_id');
                        if (!next.get('module')) next.set('module', 'comercial');
                        navigate({ pathname: location.pathname, search: next.toString() });
                      }}
                      aria-label="Remover filtro plataforma"
                    >
                      ×
                    </button>
                  </div>
                )}

                {selectedProdutos.map((produto) => (
                  <div key={`${produto.tipo}-${produto.id}`} className="flex items-center gap-2 bg-custom-100 text-custom-800 px-3 py-1 rounded">
                    <span className="text-sm">
                      {produto.tipo === 'variacao' 
                        ? `${produto.nome} - ${produto.variacaoNome}` 
                        : produto.nome}
                    </span>
                    <button
                      className="text-custom-600 hover:text-custom-800"
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
        </CardHeader>
      </Card>

      {/* Tabela de pedidos */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Selecionar todos"
                    className={isSomeSelected ? "data-[state=checked]:bg-custom-600" : ""}
                  />
                </TableHead>
                <TableHead>ID do Pedido</TableHead>
                <TableHead className="text-center">Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Plataforma</TableHead>
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
                  <TableCell colSpan={11} className="text-center text-red-600">
                    {error}
                  </TableCell>
                </TableRow>
              )}

              {filteredPedidosComProdutos.map((pedido) => (
                <TableRow key={pedido.id} className="hover:bg-muted/50">
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={selectedPedidosIds.has(pedido.id)}
                      onCheckedChange={() => toggleSelectPedido(pedido.id)}
                      aria-label={`Selecionar pedido ${pedido.idExterno}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium cursor-pointer" onClick={() => {
                    const currentParams = new URLSearchParams(location.search);
                    if (view === 'enviados') currentParams.set('readonly', '1');
                    currentParams.set('returnTo', location.pathname + location.search);
                    navigate(`/pedido/${pedido.id}?${currentParams.toString()}`);
                  }}>
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
                  <TableCell 
                    className="text-center cursor-pointer"
                    onClick={() => {
                      const currentParams = new URLSearchParams(location.search);
                      if (view === 'enviados') currentParams.set('readonly', '1');
                      currentParams.set('returnTo', location.pathname + location.search);
                      navigate(`/pedido/${pedido.id}?${currentParams.toString()}`);
                    }}
                  >
                    {new Date(pedido.criadoEm).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell
                    className="cursor-pointer"
                    onClick={() => {
                      const currentParams = new URLSearchParams(location.search);
                      if (view === 'enviados') currentParams.set('readonly', '1');
                      currentParams.set('returnTo', location.pathname + location.search);
                      navigate(`/pedido/${pedido.id}?${currentParams.toString()}`);
                    }}
                  >
                    <div>
                      <div className="font-medium max-w-[260px] truncate overflow-hidden whitespace-nowrap">
                        <span
                          className="cursor-pointer hover:underline"
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
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground max-w-[260px] truncate overflow-hidden whitespace-nowrap">
                        <span
                          className="cursor-pointer hover:underline"
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
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                      <div 
                        className="flex items-center justify-center gap-2 cursor-pointer hover:opacity-80"
                        title={pedido.plataforma?.nome}
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
                          <img src={pedido.plataforma.imagemUrl} alt={pedido.plataforma.nome} className="w-8 h-8 rounded" />
                        ) : (
                          <div 
                            className="w-6 h-6 rounded-full"
                            style={{ backgroundColor: pedido.plataforma?.cor }}
                          />
                        )}
                      </div>
                  </TableCell>

                  {/* Transportadora column removed per request */}

                  <TableCell className="p-3">
                    <div 
                      className="flex items-center justify-center cursor-pointer hover:opacity-80"
                      title={pedido.responsavel?.nome}
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
                      <Avatar className="h-12 w-12 border-4 border-custom-600 rounded-full">
                        <AvatarImage src={pedido.responsavel?.avatar} />
                        <AvatarFallback className="text-sm">
                          {pedido.responsavel?.nome?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
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
                          className="mb-1 bg-custom-600 text-white hover:bg-custom-700 px-2 py-0 h-6 rounded text-xs"
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!hasPermissao?.(58)) {
                          toast({ title: 'Sem permissão', description: 'Você não tem permissão para duplicar pedidos.', variant: 'destructive' });
                          return;
                        }
                        duplicatePedido(pedido.id);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
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

                  // Registrar no histórico de movimentações
                  const selectedStatus = statusOptions.find(s => s.id === selectedId);
                  const statusNome = selectedStatus?.nome || 'Status removido';
                  await registrarHistoricoMovimentacao(
                    statusEditPedidoId,
                    `Status alterado para: ${statusNome}`
                  );

                  // update local state: replace statusId and status object (if we have details)
                  const statusObj = statusOptions.find(s => s.id === selectedId) || null;
                  setPedidos(prev => prev.map(p => p.id === statusEditPedidoId ? { ...p, statusId: selectedId || '', status: statusObj ? { id: statusObj.id, nome: statusObj.nome, corHex: statusObj.cor_hex, ordem: statusObj.ordem ?? 0, criadoEm: '', atualizadoEm: '' } : p.status } : p));

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

                  // Registrar no histórico de movimentações
                  const selectedEtiqueta = etiquetaOptions.find(e => e.id === selectedId);
                  const etiquetaNome = selectedEtiqueta?.nome || 'Etiqueta removida';
                  await registrarHistoricoMovimentacao(
                    etiquetaEditPedidoId,
                    `Etiqueta de envio alterada para: ${etiquetaNome}`
                  );

                  // update local state: replace etiquetaEnvioId and etiqueta object
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

                  // Registrar no histórico de movimentações
                  const selectedPlataforma = plataformaOptions.find(p => p.id === selectedId);
                  const plataformaNome = selectedPlataforma?.nome || 'Plataforma removida';
                  await registrarHistoricoMovimentacao(
                    plataformaEditPedidoId,
                    `Plataforma alterada para: ${plataformaNome}`
                  );

                  // update local state: replace plataformaId and plataforma object
                  const selectedPlataformaObj = plataformaOptions.find(p => p.id === selectedId) || null;
                  setPedidos(prev => prev.map(p => {
                    if (p.id === plataformaEditPedidoId) {
                      const newPlataforma = selectedPlataformaObj ? {
                        id: selectedPlataformaObj.id,
                        nome: selectedPlataformaObj.nome,
                        cor: selectedPlataformaObj.cor,
                        imagemUrl: selectedPlataformaObj.img_url || undefined,
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

                  // Registrar no histórico de movimentações
                  const selectedResponsavel = responsavelOptions.find(u => u.id === selectedId);
                  const responsavelNome = selectedResponsavel?.nome || 'Responsável removido';
                  await registrarHistoricoMovimentacao(
                    responsavelEditPedidoId,
                    `Responsável alterado para: ${responsavelNome}`
                  );

                  // update local state: replace responsavelId and responsavel object
                  const selectedResponsavelObj = responsavelOptions.find(u => u.id === selectedId) || null;
                  setPedidos(prev => prev.map(p => {
                    if (p.id === responsavelEditPedidoId) {
                      const newResponsavel = selectedResponsavelObj ? {
                        id: selectedResponsavelObj.id,
                        nome: selectedResponsavelObj.nome,
                        email: '',
                        papel: 'operador' as const,
                        avatar: selectedResponsavelObj.img_url || undefined,
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
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={pageInputValue}
                onChange={handlePageInputChange}
                onKeyDown={handlePageInputSubmit}
                onFocus={(e) => e.target.select()}
                onBlur={() => setPageInputValue(String(page))}
                className="w-12 text-center text-sm border rounded px-1 py-0.5"
                aria-label="Número da página"
              />
              <span className="text-sm">/ {totalPages}</span>
            </div>
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
                  className="p-3 border rounded hover:bg-custom-50 cursor-pointer transition-colors"
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