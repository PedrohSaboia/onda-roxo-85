import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Eye, Copy, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { TbTruckReturn } from 'react-icons/tb';
import { FaUserAltSlash, FaCalendarAlt } from 'react-icons/fa';
import { format, parseISO, startOfMonth, subMonths, isSameDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Pedido } from '@/types';
import ComercialSidebar from '@/components/layout/ComercialSidebar';
import { useAuth } from '@/hooks/useAuth';

const ENVIADO_STATUS_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';
const COMERCIAL_STATUS_ID = '3ca23a64-cb1e-480c-8efa-0468ebc18097';

export function PedidosEnviados() {
  const navigate = useNavigate();
  const location = useLocation();
  const { empresaId } = useAuth();
  
  // Read current values from URL
  const params = new URLSearchParams(location.search);
  const urlPage = parseInt(params.get('page') || '1', 10);
  const urlPageSize = parseInt(params.get('pageSize') || '10', 10);
  const urlSearch = params.get('search') || '';
  
  // State using URL as source of truth
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(urlPage);
  const [pageSize, setPageSize] = useState(urlPageSize);
  const [total, setTotal] = useState<number>(0);
  const { toast } = useToast();
  const [confirmDuplicateOpen, setConfirmDuplicateOpen] = useState(false);
  const [pedidoToDuplicate, setPedidoToDuplicate] = useState<string | null>(null);
  const [confirmRetornadoOpen, setConfirmRetornadoOpen] = useState(false);
  const [pedidoToRetornar, setPedidoToRetornar] = useState<string | null>(null);
  
  // Filter states
  const [filterDuplicados, setFilterDuplicados] = useState(false);
  
  // Date picker states
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  
  // Sync state from URL when location changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const newPage = parseInt(params.get('page') || '1', 10);
    const newPageSize = parseInt(params.get('pageSize') || '10', 10);
    const newSearch = params.get('search') || '';
    
    setPage(newPage);
    setPageSize(newPageSize);
    setSearchTerm(newSearch);
  }, [location.search]);

  useEffect(() => {
    let mounted = true;
    const fetchPedidos = async () => {
      setLoading(true);
      setError(null);
      try {
        const searchTrim = (searchTerm || '').trim();
        const actualPage = searchTrim.length > 0 ? 1 : page;
        const from = (actualPage - 1) * pageSize;
        const to = actualPage * pageSize - 1;

        // Query the vw_clientes_pedidos view which flattens cliente+pedido fields
        const query = (supabase as any)
          .from('vw_clientes_pedidos')
          .select(`*, cliente_id, cliente_nome, cliente_criado_em, cliente_atualizado_em, pedido_id, id_externo, pedido_cliente_nome, contato, responsavel_id, resp_envio, plataforma_id, status_id, etiqueta_envio_id, urgente, pedido_criado_em, pedido_atualizado_em, frete_melhor_envio, data_enviado`, { count: 'exact' })
          .eq('status_id', ENVIADO_STATUS_ID)
          .order('pedido_criado_em', { ascending: false });

        // apply date filter if set
        if (startDate && endDate) {
          const startISO = new Date(startDate + 'T00:00:00').toISOString();
          const endISO = new Date(endDate + 'T23:59:59').toISOString();
          (query as any).gte('data_enviado', startISO).lte('data_enviado', endISO);
        }

        // apply duplicados filter
        if (filterDuplicados) {
          (query as any).eq('duplicata', true);
        }

        // apply search term server-side
        if (searchTrim.length > 0) {
          const pattern = `%${searchTrim}%`;
          try {
            (query as any).or(`id_externo.ilike.${pattern},cliente_nome.ilike.${pattern},contato.ilike.${pattern},email.ilike.${pattern},cpf.ilike.${pattern},cnpj.ilike.${pattern}`);
          } catch (e) {
            (query as any).ilike('cliente_nome', pattern);
          }
        }

        // fetch small lookup tables in parallel
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

        const plataformasMap = (platResp?.data || platResp) ? (platResp.data || platResp).reduce((acc: any, p: any) => (acc[p.id] = p, acc), {}) : {};
        const usuariosMap = (userResp?.data || userResp) ? (userResp.data || userResp).reduce((acc: any, u: any) => (acc[u.id] = u, acc), {}) : {};
        const statusMap = (statusResp?.data || statusResp) ? (statusResp.data || statusResp).reduce((acc: any, s: any) => (acc[s.id] = s, acc), {}) : {};
        const etiquetaMap = (etiquetaResp?.data || etiquetaResp) ? (etiquetaResp.data || etiquetaResp).reduce((acc: any, t: any) => (acc[t.id] = t, acc), {}) : {};

        // Fetch cor_do_pedido and data_enviado separately if needed
        const pedidoIds = (data || []).map((r: any) => r.pedido_id).filter(Boolean);
        let corMap: Record<string, string | undefined> = {};
        let dataEnviadoMap: Record<string, string | undefined> = {};
        if (pedidoIds.length) {
          try {
            const { data: pedidosData, error: pedidosErr } = await supabase.from('pedidos').select('id, cor_do_pedido, data_enviado').in('id', pedidoIds as any[]);
            if (!pedidosErr && pedidosData) {
              corMap = (pedidosData as any[]).reduce((acc: any, p: any) => (acc[p.id] = p.cor_do_pedido || undefined, acc), {} as Record<string, string>);
              dataEnviadoMap = (pedidosData as any[]).reduce((acc: any, p: any) => (acc[p.id] = p.data_enviado || undefined, acc), {} as Record<string, string>);
            }
          } catch (fetchErr) {
            console.warn('Não foi possível carregar dados adicionais dos pedidos:', fetchErr);
          }
        }

        const normalizeEtiqueta = (nome?: string) => {
          if (!nome) return 'NAO_LIBERADO' as const;
          const key = nome.toUpperCase();
          if (key.includes('PEND')) return 'PENDENTE' as const;
          if (key.includes('DISP')) return 'DISPONIVEL' as const;
          return 'NAO_LIBERADO' as const;
        };

        const mapped: Pedido[] = (data || []).map((row: any) => {
          const freteMe = row.frete_melhor_envio || null;
          const plataformaRow = plataformasMap[row.plataforma_id];
          const usuarioRow = usuariosMap[row.responsavel_id];
          const respEnvioRow = row.resp_envio ? usuariosMap[row.resp_envio] : null;
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
            responsavelEnvio: respEnvioRow
              ? {
                  id: respEnvioRow.id,
                  nome: respEnvioRow.nome,
                  email: '',
                  papel: 'operador',
                  avatar: respEnvioRow.img_url || undefined,
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
            dataEnviado: dataEnviadoMap[row.pedido_id] || undefined,
          };
        });

        setPedidos(mapped);
        setTotal(count || 0);
      } catch (err: any) {
        console.error('Erro ao buscar pedidos enviados', err);
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();

    return () => { mounted = false };
  }, [page, pageSize, searchTerm, startDate, endDate, filterDuplicados]);

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

    if (idExterno.includes(normalizedSearch) || cliente.includes(normalizedSearch) || contatoText.includes(normalizedSearch) || clienteEmail.includes(normalizedSearch)) return true;

    if (normalizedDigits.length > 0 && (contatoDigits.includes(normalizedDigits) || clienteCpfDigits.includes(normalizedDigits) || clienteCnpjDigits.includes(normalizedDigits))) return true;

    return false;
  });

  const totalPages = Math.max(1, Math.ceil((total || filteredPedidos.length) / pageSize));

  const updatePageInUrl = (newPage: number) => {
    const params = new URLSearchParams(location.search);
    params.set('page', String(newPage));
    params.set('pageSize', String(pageSize));
    if (searchTerm) params.set('search', searchTerm);
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

  const marcarPedidoRetornado = async () => {
    const pedidoId = pedidoToRetornar;
    if (!pedidoId) return;
    
    setConfirmRetornadoOpen(false);
    setPedidoToRetornar(null);
    
    try {
      // Inserir registro na tabela pedidos_retornados
      const { error: insertError } = await supabase
        .from('pedidos_retornados')
        .insert({
          pedido_id: pedidoId,
          data_retornado: new Date().toISOString()
        });

      if (insertError) throw insertError;

      // Atualizar campo pedido_retornado para true na tabela pedidos
      const { error: updateError } = await supabase
        .from('pedidos')
        .update({ 
          pedido_retornado: true,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', pedidoId);

      if (updateError) throw updateError;

      toast({ 
        title: 'Pedido marcado como retornado', 
        description: 'O pedido foi registrado como retornado com sucesso' 
      });

      // Atualizar lista de pedidos (opcional - pode remover da lista ou recarregar)
      // Para simplificar, vamos apenas mostrar o toast e deixar o usuário atualizar a página
      
    } catch (err: any) {
      console.error('Erro ao marcar pedido como retornado:', err);
      toast({ 
        title: 'Erro', 
        description: err?.message || String(err), 
        variant: 'destructive' 
      });
    }
  };

  const duplicatePedido = async () => {
    const pedidoId = pedidoToDuplicate;
    if (!pedidoId) return;
    
    setConfirmDuplicateOpen(false);
    setPedidoToDuplicate(null);
    
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
        id_externo: computeNewIdExterno((pedidoRow as any).id_externo),
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

      // Navigate to the new order page
      navigate(`/pedido/${newPedidoId}`);
    } catch (err: any) {
      console.error('Erro ao duplicar pedido:', err);
      toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
    }
  };

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
      setStartDate(format(tempStartDate, 'yyyy-MM-dd'));
      if (tempEndDate) {
        setEndDate(format(tempEndDate, 'yyyy-MM-dd'));
      } else {
        setEndDate(format(tempStartDate, 'yyyy-MM-dd'));
      }
    }
    setPickerOpen(false);
  };

  const clearDateFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setTempStartDate(null);
    setTempEndDate(null);
    setPickerOpen(false);
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

  return (
    <div className="flex h-full">
      <div className="flex-shrink-0">
        <ComercialSidebar />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pedidos Enviados</h1>
            <p className="text-muted-foreground">
              {filteredPedidos.length} pedidos encontrados
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Filtrar por Data de Envio</label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button className="flex items-center justify-center gap-2 bg-custom-600 text-white hover:bg-custom-700">
                  <FaCalendarAlt className="h-4 w-4" />
                  <span className="text-sm">
                    {startDate && endDate 
                      ? `${format(parseISO(startDate), 'dd/MM/yy', { locale: ptBR })} → ${format(parseISO(endDate), 'dd/MM/yy', { locale: ptBR })}`
                      : 'Selecionar período'
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
                        { label: 'Hoje', fn: () => { const d = new Date(); setStartDate(format(d, 'yyyy-MM-dd')); setEndDate(format(d, 'yyyy-MM-dd')); setTempStartDate(d); setTempEndDate(d); } },
                        { label: 'Ontem', fn: () => { const d = new Date(); d.setDate(d.getDate() - 1); setStartDate(format(d, 'yyyy-MM-dd')); setEndDate(format(d, 'yyyy-MM-dd')); setTempStartDate(d); setTempEndDate(d); } },
                        { label: 'Últimos 7 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 6); setStartDate(format(s, 'yyyy-MM-dd')); setEndDate(format(e, 'yyyy-MM-dd')); setTempStartDate(s); setTempEndDate(e); } },
                        { label: 'Últimos 14 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 13); setStartDate(format(s, 'yyyy-MM-dd')); setEndDate(format(e, 'yyyy-MM-dd')); setTempStartDate(s); setTempEndDate(e); } },
                        { label: 'Últimos 30 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 29); setStartDate(format(s, 'yyyy-MM-dd')); setEndDate(format(e, 'yyyy-MM-dd')); setTempStartDate(s); setTempEndDate(e); } },
                        { label: 'Este mês', fn: () => { const e = new Date(); const s = startOfMonth(e); setStartDate(format(s, 'yyyy-MM-dd')); setEndDate(format(e, 'yyyy-MM-dd')); setTempStartDate(s); setTempEndDate(e); } },
                        { label: 'Mês passado', fn: () => { const hoje = new Date(); const mesPassado = subMonths(hoje, 1); const s = startOfMonth(mesPassado); const e = new Date(mesPassado.getFullYear(), mesPassado.getMonth() + 1, 0); setStartDate(format(s, 'yyyy-MM-dd')); setEndDate(format(e, 'yyyy-MM-dd')); setTempStartDate(s); setTempEndDate(e); } },
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
                          setTempStartDate(null);
                          setTempEndDate(null);
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
          </div>
        </div>

        {/* Busca */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar pedidos enviados..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  id="filter-duplicados" 
                  type="checkbox" 
                  checked={filterDuplicados} 
                  onChange={(e) => setFilterDuplicados(e.target.checked)} 
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="filter-duplicados" className="text-sm text-muted-foreground whitespace-nowrap">
                  Somente duplicados
                </label>
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
                  <TableHead>Informações do Pedido</TableHead>
                  <TableHead className="text-center">Data Criado</TableHead>
                  <TableHead className="text-center">Data Enviado</TableHead>
                  <TableHead className="text-center">Resp. Pedido</TableHead>
                  <TableHead className="text-center">Resp. Envio</TableHead>
                  <TableHead className="text-center">Transportadora</TableHead>
                  <TableHead className="text-center"></TableHead>
                  <TableHead className="text-center w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {error && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-red-600">
                      {error}
                    </TableCell>
                  </TableRow>
                )}

                {filteredPedidos.map((pedido) => (
                  <TableRow key={pedido.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => {
                    const currentParams = new URLSearchParams();
                    currentParams.set('readonly', '1');
                    currentParams.set('returnTo', location.pathname + location.search);
                    navigate(`/pedido/${pedido.id}?${currentParams.toString()}`);
                  }}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
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
                                    toast({ title: 'Erro', description: 'Não foi possível copiar o ID.', variant: 'destructive' });
                                  });
                                } else {
                                  const ta = document.createElement('textarea');
                                  ta.value = text;
                                  document.body.appendChild(ta);
                                  ta.select();
                                  try {
                                    document.execCommand('copy');
                                    toast({ title: 'Copiado', description: 'ID do pedido copiado para a área de transferência.' });
                                  } catch (ex) {
                                    console.error('Fallback copy failed', ex);
                                    toast({ title: 'Erro', description: 'Não foi possível copiar o ID.', variant: 'destructive' });
                                  }
                                  document.body.removeChild(ta);
                                }
                              } catch (err) {
                                console.error('Copy exception', err);
                                toast({ title: 'Erro', description: 'Não foi possível copiar o ID.', variant: 'destructive' });
                              }
                            }}
                            style={{ color: pedido.corDoPedido || '#8B5E3C' }}
                          >
                            {pedido.idExterno}
                          </div>
                        </div>
                        <div>
                          <div
                            className="text-xs max-w-[260px] truncate overflow-hidden whitespace-nowrap"
                            title={`${pedido.clienteNome} - ${pedido.contato}`}
                          >
                            <span className="text-gray-700">{pedido.clienteNome}</span>
                            <span className="text-gray-400"> - {pedido.contato}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {new Date(pedido.criadoEm).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-center">
                      {(pedido as any).dataEnviado ? new Date((pedido as any).dataEnviado).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center justify-center">
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
                        {pedido.responsavelEnvio ? (
                          <Avatar className="h-12 w-12 border-4 border-custom-600 rounded-full">
                            <AvatarImage src={pedido.responsavelEnvio.avatar} />
                            <AvatarFallback className="text-sm">
                              {pedido.responsavelEnvio.nome?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-12 w-12 border-4 border-custom-600 rounded-full bg-custom-600 flex items-center justify-center">
                            <FaUserAltSlash className="h-5 w-5 text-white" />
                          </div>
                        )}
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
                      {/* TAG QUANTAS VEZES FOI REENVIADO */}
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          setPedidoToDuplicate(pedido.id);
                          setConfirmDuplicateOpen(true);
                        }} title="Duplicar pedido">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          setPedidoToRetornar(pedido.id);
                          setConfirmRetornadoOpen(true);
                        }} title="Pedido retornado">
                          <TbTruckReturn className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>

          <div className="flex items-center justify-between p-4 border-t">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Mostrando <strong>{(page - 1) * pageSize + 1}</strong> - <strong>{Math.min(page * pageSize, total || filteredPedidos.length)}</strong> de <strong>{total || filteredPedidos.length}</strong>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Mostrar</label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    const params = new URLSearchParams(location.search);
                    params.set('page', '1');
                    params.set('pageSize', String(newSize));
                    if (searchTerm) params.set('search', searchTerm);
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

      <AlertDialog open={confirmDuplicateOpen} onOpenChange={setConfirmDuplicateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicar Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja duplicar este pedido? Um novo pedido será criado com status "Comercial" e você será redirecionado para editá-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setConfirmDuplicateOpen(false);
              setPedidoToDuplicate(null);
            }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={duplicatePedido}>Duplicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRetornadoOpen} onOpenChange={setConfirmRetornadoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pedido Retornado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja marcar este pedido como retornado? Esta ação registrará o retorno do pedido no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setConfirmRetornadoOpen(false);
              setPedidoToRetornar(null);
            }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={marcarPedidoRetornado}>Confirmar Retorno</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default PedidosEnviados;
