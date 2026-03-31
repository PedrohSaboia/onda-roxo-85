import { Package, TrendingUp, Users, Truck, Calendar as CalendarIcon, DollarSign, ShoppingCart, TrendingDown, BarChart3, AlertCircle, ChevronDown, ChevronLeft, ChevronRight, List, BookOpen, Loader2, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, subMonths, parseISO, eachDayOfInterval, isSameDay, isWithinInterval, startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LineChart, Line, Area, PieChart, Pie } from 'recharts';
import { MdRequestQuote } from "react-icons/md";
import { BiSolidPurchaseTag } from "react-icons/bi";
import { BsSendCheckFill } from 'react-icons/bs'
import { FaBalanceScale } from "react-icons/fa";
import { FaCalendarAlt } from "react-icons/fa";


interface DashboardMetrics {
  totalPedidos: number;
  vendasTotal: number;
  ticketMedio: number;
  pedidosHoje: number;
  pedidosMesAtual: number;
  pedidosEnviados: number;
  pedidosEnviadosHoje: number;
  pedidosEnviadosMesAtual: number;
  topProdutos: { nome: string; quantidade: number; receita: number; img_url: string | null }[];
  produtosMaiorTicket: { nome: string; quantidade: number; ticketMedio: number; receita: number; img_url: string | null }[];
  vendasPorPlataforma: { nome: string; total: number; pedidos: number; cor: string }[];
  vendasPorPlataformaPorPeriodo: { periodo: string; plataformas: { nome: string; valor: number; cor: string }[] }[];
  vendasPorStatus: { nome: string; pedidos: number; cor: string }[];
  vendasTotaisPorDia: { data: string; valor: number }[];
  enviosPorPlataforma: { nome: string; quantidade: number; cor: string }[];
  enviosPorDia: { data: string; quantidade: number }[];
  isPeriodoCurto: boolean;
  spreadFrete: { receitaFrete: number; custoFrete: number; spreadValor: number; spreadPercentual: number; totalPedidosComFrete: number; totalPedidosComCusto: number; idsReceitaFrete: string[]; idsCustoFrete: string[] } | null;
}

export function Dashboard() {
  const { acesso, isLoading, permissoes, hasPermissao } = useAuth();
  const hasAccess = hasPermissao ? hasPermissao(56) : ((permissoes || []).includes(56));
  const [startDate, setStartDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [pedidosModal, setPedidosModal] = useState<{
    open: boolean;
    loading: boolean;
    data: Array<{
      id: string;
      id_externo: string | null;
      criado_em: string;
      valor_total: number;
      plataforma: string;
      plataformaCor: string;
      status: string;
      statusCor: string;
      itens: Array<{ nome: string; quantidade: number; img_url: string | null }>;
      temLivraria: boolean;
    }>;
  }>({ open: false, loading: false, data: [] });
  const [freteModal, setFreteModal] = useState<{
    open: boolean;
    loading: boolean;
    selectedDate: string;
    currentPage: number;
    summary: {
      receita: number;
      custo: number;
      margem: number;
      margemPct: number;
      totalPedidosComFrete: number;
      totalPedidosComCusto: number;
    } | null;
    data: Array<{
      id_externo: string;
      receita: number;
      custo: number;
      margem: number;
      margemPct: number;
    }>;
  }>({
    open: false,
    loading: false,
    selectedDate: startDate,
    currentPage: 1,
    summary: null,
    data: [],
  });
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  const EXCLUDED_STATUS_ID = '09ddb68a-cff3-4a69-a120-7459642cca6f';

  const fetchMetrics = useCallback(async () => {
    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    //aa
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setLoading(true);
    setError(null);
    try {
      const startISO = new Date(startDate + 'T00:00:00').toISOString();
      const endISO = new Date(endDate + 'T23:59:59').toISOString();

      // Buscar pedidos criados no período
      const { data: pedidos, error: pedidosError } = await supabase
        .from('pedidos')
        .select(`
          criado_em, atualizado_em, valor_total, data_enviado, id_melhor_envio, carrinho_me,
          plataformas(nome, cor),
          status(nome, cor_hex),
          itens_pedido(quantidade, preco_unitario, produto:produtos(nome, img_url))
        `)
        .gte('criado_em', startISO)
        .lte('criado_em', endISO)
        .neq('status_id', EXCLUDED_STATUS_ID)
        .or('duplicata.is.null,duplicata.eq.false')
        .order('criado_em', { ascending: false })
        .abortSignal(signal);

      if (pedidosError) {
        if (pedidosError.message.includes('aborted')) return;
        throw pedidosError;
      }
      
      // Buscar pedidos enviados no período: detalhes (gráficos) + métricas via RPC (paralelo)
      const ENVIADO_STATUS_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';
      const [
        { data: pedidosEnviadosData, error: pedidosEnviadosError },
        { data: metricasEnviadosRpc, error: metricasEnviadosError },
        { data: metricasTotalRpc, error: metricasTotalError },
        { data: vendasPlataformaRpc, error: vendasPlataformaError },
        { data: enviosPlataformaRpc, error: enviosPlataformaError },
        { data: pedidosStatusRpc, error: pedidosStatusError },
        { data: topProdutosRpc, error: topProdutosError },
        { data: maiorTicketRpc, error: maiorTicketError },
        { data: spreadFreteRpc, error: spreadFreteError },
      ] =
        await Promise.all([
          supabase
            .from('pedidos')
            .select('id, atualizado_em, plataformas(nome, cor)')
            .eq('status_id', ENVIADO_STATUS_ID)
            .gte('atualizado_em', startISO)
            .lte('atualizado_em', endISO)
            .or('duplicata.is.null,duplicata.eq.false')
            .abortSignal(signal),
          (supabase as any).rpc('get_metricas_enviados', {
            p_data_inicio: startISO,
            p_data_fim: endISO,
          }),
          (supabase as any).rpc('get_total_pedidos', {
            p_data_inicio: startISO,
            p_data_fim: endISO,
          }),
          (supabase as any).rpc('get_vendas_por_plataforma', {
            p_data_inicio: startISO,
            p_data_fim: endISO,
          }),
          (supabase as any).rpc('get_envios_por_plataforma', {
            p_data_inicio: startISO,
            p_data_fim: endISO,
          }),
          (supabase as any).rpc('get_pedidos_por_status', {
            p_data_inicio: startISO,
            p_data_fim: endISO,
          }),
          (supabase as any).rpc('get_top_produtos_mais_vendidos', {
            p_data_inicio: startISO,
            p_data_fim: endISO,
          }),
          (supabase as any).rpc('get_top_produtos_maior_ticket', {
            p_data_inicio: startISO,
            p_data_fim: endISO,
          }),
          (supabase as any).rpc('get_spread_frete', {
            p_data_inicio: startISO,
            p_data_fim: endISO,
          }),
        ]);

      if (pedidosEnviadosError) {
        if (pedidosEnviadosError.message?.includes('aborted')) return;
        throw pedidosEnviadosError;
      }
      if (metricasEnviadosError) {
        console.warn('[get_metricas_enviados] RPC error:', metricasEnviadosError);
      }
      if (metricasTotalError) {
        console.warn('[get_total_pedidos] RPC error:', metricasTotalError);
      }
      if (vendasPlataformaError) {
        console.warn('[get_vendas_por_plataforma] RPC error:', vendasPlataformaError);
      }
      if (enviosPlataformaError) {
        console.warn('[get_envios_por_plataforma] RPC error:', enviosPlataformaError);
      }
      if (pedidosStatusError) {
        console.warn('[get_pedidos_por_status] RPC error:', pedidosStatusError);
      }
      if (topProdutosError) {
        console.warn('[get_top_produtos_mais_vendidos] RPC error:', topProdutosError);
      }
      if (maiorTicketError) {
        console.warn('[get_top_produtos_maior_ticket] RPC error:', maiorTicketError);
      }
      if (spreadFreteError) {
        console.warn('[get_spread_frete] RPC error:', spreadFreteError);
      }

      if (signal.aborted) return;

        const pedidosData = (pedidos || []) as any[];
        const pedidosEnviadosArray = (pedidosEnviadosData || []) as any[];
        const rpcEnviados = (metricasEnviadosRpc as any[])?.[0] ?? null;
        const rpcTotal = (metricasTotalRpc as any[])?.[0] ?? null;
        const rpcVendasPlataforma = (vendasPlataformaRpc as any[]) ?? null;
        const rpcEnviosPlataforma = (enviosPlataformaRpc as any[]) ?? null;
        // Preferir contagem da RPC (exclui duplicatas no banco); fallback para array local
        const pedidosEnviadosCount = rpcEnviados ? Number(rpcEnviados.total_enviados) : pedidosEnviadosArray.length;

        // Calcular envios por plataforma
        const enviosPlataformaMap: Record<string, { quantidade: number; cor: string }> = {};
        pedidosEnviadosArray.forEach(p => {
          const nome = (p.plataformas as any)?.nome || 'Sem Plataforma';
          const cor = (p.plataformas as any)?.cor || '#cccccc';
          if (!enviosPlataformaMap[nome]) {
            enviosPlataformaMap[nome] = { quantidade: 0, cor };
          }
          enviosPlataformaMap[nome].quantidade += 1;
        });
        const enviosPorPlataforma = rpcEnviosPlataforma
          ? rpcEnviosPlataforma.map((r: any) => ({ nome: r.nome, quantidade: Number(r.quantidade), cor: r.cor || '#cccccc' }))
          : Object.entries(enviosPlataformaMap).map(([nome, data]) => ({ nome, ...data }));

        // Calcular envios por dia
        const enviosPorDiaMap: Record<string, number> = {};
        pedidosEnviadosArray.forEach(p => {
          const dia = format(parseISO(p.atualizado_em), 'yyyy-MM-dd');
          if (!enviosPorDiaMap[dia]) {
            enviosPorDiaMap[dia] = 0;
          }
          enviosPorDiaMap[dia] += 1;
        });
        const enviosPorDia = Object.entries(enviosPorDiaMap)
          .map(([data, quantidade]) => ({ data, quantidade }))
          .sort((a, b) => a.data.localeCompare(b.data));

        // Calcular métricas
        // Preferir RPC para total_pedidos (exclui duplicatas no banco); fallback para array local
        const totalPedidos = rpcTotal ? Number(rpcTotal.total_pedidos) : pedidosData.length;
        const vendasTotal = rpcTotal ? Number(rpcTotal.valor_total) : pedidosData.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0);
        const ticketMedio = rpcTotal ? Number(rpcTotal.ticket_medio) : (totalPedidos > 0 ? vendasTotal / totalPedidos : 0);
        const pedidosHojeRpc = rpcTotal ? Number(rpcTotal.total_hoje) : 0;
        const pedidosMesAtualRpc = rpcTotal ? Number(rpcTotal.total_mes_atual) : 0;

        const hoje = new Date().toDateString();
        const pedidosHoje = pedidosHojeRpc || pedidosData.filter(p => new Date(p.criado_em).toDateString() === hoje).length;

        // Usar contagem da query separada de pedidos enviados no período
        const pedidosEnviados = pedidosEnviadosCount;
        const pedidosEnviadosHoje = rpcEnviados ? Number(rpcEnviados.total_hoje) : 0;
        const pedidosEnviadosMesAtual = rpcEnviados ? Number(rpcEnviados.total_mes_atual) : 0;

        // Determinar se é período curto (dia ou semana - até 7 dias)
        const diffDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)) + 1;
        const isPeriodoCurto = diffDays <= 7;

        // Top produtos e produtos com maior ticket médio
        const rpcTopProdutos = (topProdutosRpc as any[]) ?? null;
        const rpcMaiorTicket = (maiorTicketRpc as any[]) ?? null;
        const rpcSpreadFreteData = (spreadFreteRpc as any[])?.[0] ?? null;
        const spreadFrete = rpcSpreadFreteData ? {
          receitaFrete: Number(rpcSpreadFreteData.receita_frete),
          custoFrete: Number(rpcSpreadFreteData.custo_frete),
          spreadValor: Number(rpcSpreadFreteData.spread_valor),
          spreadPercentual: Number(rpcSpreadFreteData.spread_percentual),
          totalPedidosComFrete: Number(rpcSpreadFreteData.total_pedidos_com_frete),
          totalPedidosComCusto: Number(rpcSpreadFreteData.total_pedidos_com_custo ?? 0),
          idsReceitaFrete: (rpcSpreadFreteData.ids_receita_frete as string[]) ?? [],
          idsCustoFrete: (rpcSpreadFreteData.ids_custo_frete as string[]) ?? [],
        } : null;

        const produtosMap: Record<string, { quantidade: number; receita: number; img_url: string | null }> = {};
        pedidosData.forEach(p => {
          (p.itens_pedido || []).forEach((item: any) => {
            // Ignorar itens sem produto associado
            if (!item.produto?.nome) return;
            
            const nome = item.produto.nome;
            const img_url = item.produto.img_url || null;
            if (!produtosMap[nome]) {
              produtosMap[nome] = { quantidade: 0, receita: 0, img_url };
            }
            produtosMap[nome].quantidade += Number(item.quantidade) || 0;
            produtosMap[nome].receita += (Number(item.quantidade) || 0) * (Number(item.preco_unitario) || 0);
          });
        });

        const produtosArray = Object.entries(produtosMap).map(([nome, data]) => ({ nome, ...data }));
        const topProdutos = rpcTopProdutos
          ? rpcTopProdutos.map((r: any) => ({ nome: r.nome, quantidade: Number(r.quantidade), receita: Number(r.receita), img_url: r.img_url || null }))
          : produtosArray.sort((a, b) => b.quantidade - a.quantidade).slice(0, 5);
        
        // Produtos com maior ticket médio
        const produtosMaiorTicket = rpcMaiorTicket
          ? rpcMaiorTicket.map((r: any) => ({ nome: r.nome, quantidade: Number(r.quantidade), receita: Number(r.receita), ticketMedio: Number(r.ticket_medio), img_url: r.img_url || null }))
          : produtosArray
              .filter(p => p.quantidade > 0)
              .map(p => ({ nome: p.nome, quantidade: p.quantidade, receita: p.receita, ticketMedio: p.receita / p.quantidade, img_url: p.img_url }))
              .sort((a, b) => b.ticketMedio - a.ticketMedio)
              .slice(0, 5);

        // Vendas por plataforma (total)
        const plataformasMap: Record<string, { total: number; pedidos: number; cor: string }> = {};
        pedidosData.forEach(p => {
          const nome = (p.plataformas as any)?.nome || 'Sem Plataforma';
          const cor = (p.plataformas as any)?.cor || '#cccccc';
          if (!plataformasMap[nome]) {
            plataformasMap[nome] = { total: 0, pedidos: 0, cor };
          }
          plataformasMap[nome].total += Number(p.valor_total) || 0;
          plataformasMap[nome].pedidos += 1;
        });
        const vendasPorPlataforma = rpcVendasPlataforma
          ? rpcVendasPlataforma.map((r: any) => ({ nome: r.nome, total: Number(r.valor_total), pedidos: Number(r.total_pedidos), cor: r.cor || '#cccccc' }))
          : Object.entries(plataformasMap).map(([nome, data]) => ({ nome, ...data }));

        // Vendas por plataforma por período (para período curto)
        let vendasPorPlataformaPorPeriodo: { periodo: string; plataformas: { nome: string; valor: number; cor: string }[] }[] = [];
        if (isPeriodoCurto) {
          const periodosMap: Record<string, Record<string, { valor: number; cor: string }>> = {};
          pedidosData.forEach(p => {
            const dia = format(parseISO(p.criado_em), 'yyyy-MM-dd');
            const nome = (p.plataformas as any)?.nome || 'Sem Plataforma';
            const cor = (p.plataformas as any)?.cor || '#cccccc';
            if (!periodosMap[dia]) {
              periodosMap[dia] = {};
            }
            if (!periodosMap[dia][nome]) {
              periodosMap[dia][nome] = { valor: 0, cor };
            }
            periodosMap[dia][nome].valor += Number(p.valor_total) || 0;
          });
          vendasPorPlataformaPorPeriodo = Object.entries(periodosMap)
            .map(([periodo, plats]) => ({
              periodo,
              plataformas: Object.entries(plats).map(([nome, data]) => ({ nome, ...data }))
            }))
            .sort((a, b) => a.periodo.localeCompare(b.periodo));
        }

        // Pedidos por status
        const rpcPedidosStatus = (pedidosStatusRpc as any[]) ?? null;
        const statusMap: Record<string, { pedidos: number; cor: string }> = {};
        pedidosData.forEach(p => {
          const nome = (p.status as any)?.nome || 'Sem Status';
          const cor = (p.status as any)?.cor_hex || '#cccccc';
          if (!statusMap[nome]) {
            statusMap[nome] = { pedidos: 0, cor };
          }
          statusMap[nome].pedidos += 1;
        });
        const vendasPorStatus = rpcPedidosStatus
          ? rpcPedidosStatus.map((r: any) => ({ nome: r.nome, pedidos: Number(r.pedidos), cor: r.cor || '#cccccc' }))
          : Object.entries(statusMap).map(([nome, data]) => ({ nome, ...data }));

        // Vendas totais por dia (para gráfico de linha)
        const vendasPorDiaMap: Record<string, number> = {};
        pedidosData.forEach(p => {
          const dia = format(parseISO(p.criado_em), 'yyyy-MM-dd');
          if (!vendasPorDiaMap[dia]) {
            vendasPorDiaMap[dia] = 0;
          }
          vendasPorDiaMap[dia] += Number(p.valor_total) || 0;
        });
        const vendasTotaisPorDia = Object.entries(vendasPorDiaMap)
          .map(([data, valor]) => ({ data, valor }))
          .sort((a, b) => a.data.localeCompare(b.data));

        setMetrics({
          totalPedidos,
          vendasTotal,
          ticketMedio,
          pedidosHoje,
          pedidosMesAtual: pedidosMesAtualRpc,
          pedidosEnviados,
          pedidosEnviadosHoje,
          pedidosEnviadosMesAtual,
          topProdutos,
          produtosMaiorTicket,
          vendasPorPlataforma,
          vendasPorPlataformaPorPeriodo,
          vendasPorStatus,
          vendasTotaisPorDia,
          enviosPorPlataforma,
          enviosPorDia,
          isPeriodoCurto,
          spreadFrete,
        });

      } catch (err: any) {
        if (err.name === 'AbortError' || err.message?.includes('aborted')) return;
        console.error('Erro ao buscar dashboard:', err);
        setError(err?.message || String(err));
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
  }, [startDate, endDate]);

  useEffect(() => {
    // Se não tem acesso, não carregar métricas
    if (!hasAccess) {
      setMetrics(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Debounce: aguardar 300ms após última mudança de data
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchMetrics();
    }, 300);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [startDate, endDate, fetchMetrics, hasAccess]);

  const fetchPedidosModal = async () => {
    setPedidosModal(prev => ({ ...prev, open: true, loading: true }));
    try {
      const startISO = new Date(startDate + 'T00:00:00').toISOString();
      const endISO = new Date(endDate + 'T23:59:59').toISOString();
      // Use RPC to get pedidos that contain livraria products
      const { data: livrariaIds, error: livrariaErr } = await (supabase as any).rpc('get_pedidos_com_livraria', {
        p_data_inicio: startISO,
        p_data_fim: endISO,
      });

      const livrariaSet = new Set<string>();
      if (!livrariaErr && Array.isArray(livrariaIds)) {
        for (const r of livrariaIds as any[]) {
          if (r && (r.pedido_id || r.id)) livrariaSet.add(String(r.pedido_id || r.id));
        }
      }

      // Also fetch total pedidos count via RPC (keeps same logic as dashboard metrics)
      let totalPedidosRpcCount: number | null = null;
      try {
        const { data: totalRpc, error: totalErr } = await (supabase as any).rpc('get_total_pedidos', {
          p_data_inicio: startISO,
          p_data_fim: endISO,
        });
        if (!totalErr && Array.isArray(totalRpc) && totalRpc[0]) {
          totalPedidosRpcCount = Number((totalRpc as any[])[0].total_pedidos || 0);
        }
      } catch (e) {
        // ignore
      }

      const { data, error } = await (supabase as any)
        .from('pedidos')
        .select('id, id_externo, criado_em, valor_total, plataformas(nome, cor), status(nome, cor_hex), itens_pedido(quantidade, produto:produtos(nome, img_url))')
        .gte('criado_em', startISO)
        .lte('criado_em', endISO)
        .neq('status_id', EXCLUDED_STATUS_ID)
        .or('duplicata.is.null,duplicata.eq.false')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      const rows = (data || []).map((p: any) => {
        const itens = (p.itens_pedido || []).map((it: any) => ({
          nome: it?.produto?.nome || '',
          quantidade: Number(it?.quantidade || 1),
          img_url: it?.produto?.img_url || null,
        }));
        // Prefer RPC result; fallback to name-based detection
        const temLivraria = livrariaSet.size > 0 ? livrariaSet.has(String(p.id)) : itens.some((it: any) =>
          it.nome.toLowerCase().includes('livraria')
        );
        return {
          id: p.id,
          id_externo: p.id_externo,
          criado_em: p.criado_em,
          valor_total: Number(p.valor_total || 0),
          plataforma: (p.plataformas as any)?.nome || '—',
          plataformaCor: (p.plataformas as any)?.cor || '#888',
          status: (p.status as any)?.nome || '—',
          statusCor: (p.status as any)?.cor_hex || '#888',
          itens,
          temLivraria,
        };
      });
      // Ordenar: pedidos com livraria primeiro
      rows.sort((a: any, b: any) => Number(b.temLivraria) - Number(a.temLivraria));
      // calcular receita total (para uso no cálculo de sem livraria)
      const totalRevenue = rows.reduce((s: number, r: any) => s + Number(r.valor_total || 0), 0);
      setPedidosModal({ open: true, loading: false, data: rows, totalCount: totalPedidosRpcCount ?? rows.length, livrariaCount: livrariaSet.size, totalRevenue });
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err);
      setPedidosModal(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchFreteModalByDate = async (targetDate: string) => {
    setFreteModal(prev => ({ ...prev, open: true, loading: true, selectedDate: targetDate }));
    try {
      const startISO = startOfDay(parseISO(targetDate)).toISOString();
      const endISO = endOfDay(parseISO(targetDate)).toISOString();

      const { data: spreadFreteRpc, error: spreadFreteError } = await (supabase as any).rpc('get_spread_frete', {
        p_data_inicio: startISO,
        p_data_fim: endISO,
      });

      if (spreadFreteError) throw spreadFreteError;

      const rpcSpreadFreteData = (spreadFreteRpc as any[])?.[0] ?? null;
      const summary = {
        receita: Number(rpcSpreadFreteData?.receita_frete ?? 0),
        custo: Number(rpcSpreadFreteData?.custo_frete ?? 0),
        margem: Number(rpcSpreadFreteData?.spread_valor ?? 0),
        margemPct: Number(rpcSpreadFreteData?.spread_percentual ?? 0),
        totalPedidosComFrete: Number(rpcSpreadFreteData?.total_pedidos_com_frete ?? 0),
        totalPedidosComCusto: Number(rpcSpreadFreteData?.total_pedidos_com_custo ?? 0),
      };

      const allIds = [...new Set([
        ...((rpcSpreadFreteData?.ids_receita_frete as string[]) || []),
        ...((rpcSpreadFreteData?.ids_custo_frete as string[]) || []),
      ])];

      if (allIds.length === 0) {
        setFreteModal({ open: true, loading: false, selectedDate: targetDate, currentPage: 1, summary, data: [] });
        return;
      }

      const { data, error } = await (supabase as any)
        .from('pedidos')
        .select('id_externo, valor_frete_yampi, frete_venda, frete_melhor_envio')
        .in('id_externo', allIds);

      if (error) throw error;

      const rows = (data || []).map((p: any) => {
        const receita = Number(
          (p.valor_frete_yampi != null && Number(p.valor_frete_yampi) !== 0
            ? p.valor_frete_yampi
            : p.frete_venda) ?? 0
        );
        let freteME = p.frete_melhor_envio;
        if (typeof freteME === 'string') {
          try { freteME = JSON.parse(freteME); } catch { freteME = null; }
        }
        const custo = Number(
          (freteME?.preco && Number(freteME.preco) !== 0 ? freteME.preco : null) ??
          (freteME?.price && Number(freteME.price) !== 0 ? freteME.price : null) ??
          (freteME?.raw_response?.custom_price && Number(freteME.raw_response.custom_price) !== 0 ? freteME.raw_response.custom_price : null) ??
          (freteME?.raw_response?.price && Number(freteME.raw_response.price) !== 0 ? freteME.raw_response.price : null) ??
          0
        );
        const margem = receita - custo;
        const margemPct = custo > 0 ? (margem / custo) * 100 : 0;
        return {
          id_externo: p.id_externo || '—',
          receita,
          custo,
          margem,
          margemPct,
        };
      });

      rows.sort((a: any, b: any) => a.margem - b.margem);
      setFreteModal({ open: true, loading: false, selectedDate: targetDate, currentPage: 1, summary, data: rows });
    } catch (err) {
      console.error('Erro ao buscar detalhes de frete:', err);
      setFreteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchFreteModal = async () => {
    if (!metrics?.spreadFrete) return;
    const initialDate = startDate;
    await fetchFreteModalByDate(initialDate);
  };

  const goFreteModalDay = async (direction: 'prev' | 'next') => {
    const currentDate = parseISO(freteModal.selectedDate);
    const target = direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1);
    const targetDate = format(target, 'yyyy-MM-dd');
    if (targetDate < startDate || targetDate > endDate) return;
    await fetchFreteModalByDate(targetDate);
  };

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }, []);

  if (!isLoading && !hasAccess) {
    return (
      <div className="p-6">
        <Card className="w-[500px] justify-center mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto mb-4 text-red-600" />
            <h3 className="text-lg font-semibold">Você não tem permissão para ver o dashboard</h3>
            <p className="text-sm text-muted-foreground mt-2">Se você acha que deveria ter acesso, contate o administrador.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDateClick = (date: Date) => {
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      // Primeira data ou resetar seleção
      setTempStartDate(date);
      setTempEndDate(null);
    } else {
      // Segunda data
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
    
    // Calcular mês a ser exibido (atual ou próximo)
    const displayYear = monthOffset === 0 ? calendarYear : (calendarMonth === 11 ? calendarYear + 1 : calendarYear);
    const displayMonth = monthOffset === 0 ? calendarMonth : (calendarMonth === 11 ? 0 : calendarMonth + 1);
    
    // Gerar dias do mês selecionado
    const firstDay = new Date(displayYear, displayMonth, 1);
    const lastDay = new Date(displayYear, displayMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Dias vazios antes do primeiro dia
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-9" />);
    }
    
    // Dias do mês
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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Vendas</h1>
          <p className="text-muted-foreground">Análise completa de métricas e performance</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Período</label>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button className="flex items-center justify-center gap-2 bg-custom-600 text-white hover:bg-custom-700">
                <FaCalendarAlt className="h-4 w-4" />
                <span className="text-sm">{format(parseISO(startDate), 'dd/MM/yy', { locale: ptBR })} → {format(parseISO(endDate), 'dd/MM/yy', { locale: ptBR })}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              {/* Título */}
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold text-base">Selecionar Período</h3>
              </div>
              
              <div className="flex">
                {/* Lista de períodos à esquerda */}
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
                      { label: 'Ano', fn: () => { const e = new Date(); const s = new Date(e.getFullYear(), 0, 1); setStartDate(format(s, 'yyyy-MM-dd')); setEndDate(format(e, 'yyyy-MM-dd')); setTempStartDate(s); setTempEndDate(e); } },
                      { label: 'Máximo', fn: () => { const e = new Date(); const s = new Date(2020, 0, 1); setStartDate(format(s, 'yyyy-MM-dd')); setEndDate(format(e, 'yyyy-MM-dd')); setTempStartDate(s); setTempEndDate(e); } },
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
                
                {/* Dois calendários lado a lado */}
                <div className="flex flex-col">
                  <div className="flex">
                    {renderCalendar(0)}
                    {renderCalendar(1)}
                  </div>
                  
                  {/* Botões no final */}
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

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Erro ao carregar dados: {error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      ) : metrics && (
        <>
          {/* Métricas Principais */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative group">
              <MetricCard
                title="Total de Pedidos"
                value={metrics.totalPedidos.toString()}
                description={`${metrics.pedidosHoje} hoje • ${metrics.pedidosMesAtual} no mês`}
                icon={BiSolidPurchaseTag}
                color="custom"
              />
              <button
                onClick={fetchPedidosModal}
                className="absolute bottom-3 right-3 flex items-center gap-1 text-[11px] font-medium text-custom-600 bg-custom-50 hover:bg-custom-100 border border-custom-200 rounded-md px-2 py-1 shadow-sm transition-colors"
                title="Ver relação de pedidos"
              >
                <List className="h-3 w-3" />
                Ver pedidos
              </button>
            </div>
            <MetricCard
              title="Receita Total"
              value={formatCurrency(metrics.vendasTotal)}
              description="Valor total de vendas"
              icon={MdRequestQuote}
              color="green"
            />
            <MetricCard
              title="Ticket Médio"
              value={formatCurrency(metrics.ticketMedio)}
              description="Valor médio por pedido"
              icon={FaBalanceScale }
              color="blue"
            />
            <MetricCard
              title="Pedidos Enviados"
              value={metrics.pedidosEnviados.toString()}
              description={`${metrics.pedidosEnviadosHoje} hoje • ${metrics.pedidosEnviadosMesAtual} no mês`}
              icon={BsSendCheckFill}
              color="orange"
            />
          </div>

          {/* Métricas de Spread de Frete */}
          {metrics.spreadFrete && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Receita de Frete"
                value={formatCurrency(metrics.spreadFrete.receitaFrete)}
                description={`${metrics.spreadFrete.totalPedidosComFrete} pedidos com frete`}
                icon={Truck}
                color="teal"
              />
              <MetricCard
                title="Custo de Frete"
                value={formatCurrency(metrics.spreadFrete.custoFrete)}
                description={`${metrics.spreadFrete.totalPedidosComCusto} pedidos via MelhorEnvio`}
                icon={TrendingDown}
                color="pink"
              />
              <MetricCard
                title="Resultado do Frete"
                value={formatCurrency(metrics.spreadFrete.spreadValor)}
                description="Frete cobrado menos frete pago"
                icon={TrendingUp}
                color="indigo"
              />
              <div className="relative group">
                <MetricCard
                  title="Margem de Frete"
                  value={`${metrics.spreadFrete.spreadPercentual.toFixed(1)}%`}
                  description="Percentual do spread sobre a receita"
                  icon={BarChart3}
                  color="yellow"
                />
                <button
                  onClick={fetchFreteModal}
                  className="absolute bottom-3 right-3 flex items-center gap-1 text-[11px] font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-300 rounded-md px-2 py-1 shadow-sm transition-colors"
                  title="Ver detalhes de frete por pedido"
                >
                  <Eye className="h-3 w-3" />
                  Ver detalhes
                </button>
              </div>
            </div>
          )}

          {/* Gráficos de Vendas por Plataforma, Envios e Pedidos por Status */}
          {/* Layout unificado - gráficos lado a lado */}
          <>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="shadow-lg">
                <Tabs defaultValue="plataformas" className="w-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Vendas por Plataforma</CardTitle>
                        <CardDescription>Total de vendas por plataforma no período</CardDescription>
                      </div>
                      <TabsList>
                        <TabsTrigger value="plataformas">Por Plataforma</TabsTrigger>
                        <TabsTrigger value="total">Total</TabsTrigger>
                      </TabsList>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <TabsContent value="plataformas" className="mt-0">
                      {metrics.vendasPorPlataforma.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-2">
                          <BarChart3 className="h-12 w-12 opacity-20" />
                          <p className="text-sm">Nenhum dado para o período selecionado</p>
                        </div>
                      ) : (
                      <>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart 
                          data={metrics.vendasPorPlataforma.map(p => ({
                            nome: p.nome,
                            valor: p.total,
                            pedidos: p.pedidos,
                            cor: p.cor
                          }))}
                          margin={{ top: 30, right: 30, left: 20, bottom: 0 }}
                        >
                          <defs>
                            {metrics.vendasPorPlataforma.map((entry, index) => (
                              <linearGradient key={`plat-grad-${index}`} id={`platGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={entry.cor} stopOpacity={0.6} />
                                <stop offset="100%" stopColor={entry.cor} stopOpacity={0.9} />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                          <XAxis 
                            dataKey="nome"
                            angle={0}
                            textAnchor="middle"
                            height={30}
                            tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 600 }}
                          />
                          <YAxis 
                            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                            tickFormatter={(value) => formatCurrency(value)}
                          />
                          <Tooltip 
                            formatter={(value: any, name: string, props: any) => {
                              if (name === 'valor') {
                                return [formatCurrency(Number(value)), 'Valor'];
                              }
                              return [value, name];
                            }}
                            labelFormatter={(label) => `${label}`}
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                              padding: '12px 16px'
                            }}
                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                          />
                          <Bar dataKey="valor" radius={[10, 10, 0, 0]}>
                            {metrics.vendasPorPlataforma.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={`url(#platGradient-${index})`} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-4 justify-center mt-6">
                        {metrics.vendasPorPlataforma.map((plat) => (
                          <div key={plat.nome} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plat.cor }} />
                            <span className="text-sm font-medium">{plat.nome}</span>
                            <Badge variant="secondary" className="text-xs">{plat.pedidos} pedidos</Badge>
                          </div>
                        ))}
                      </div>
                      </>
                      )}
                    </TabsContent>
                    <TabsContent value="total" className="mt-0">
                      {metrics.vendasTotaisPorDia.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-2">
                          <BarChart3 className="h-12 w-12 opacity-20" />
                          <p className="text-sm">Nenhum dado para o período selecionado</p>
                        </div>
                      ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart 
                          data={metrics.vendasTotaisPorDia}
                          margin={{ top: 30, right: 30, left: 20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0}/>
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                          <XAxis 
                            dataKey="data"
                            angle={0}
                            textAnchor="middle"
                            height={30}
                            tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 600 }}
                            tickFormatter={(value) => format(parseISO(value), 'dd/MM')}
                          />
                          <YAxis 
                            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                            tickFormatter={(value) => formatCurrency(value)}
                          />
                          <Tooltip 
                            formatter={(value: any) => [formatCurrency(Number(value)), 'Vendas']}
                            labelFormatter={(label) => format(parseISO(label), 'dd/MM/yyyy')}
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                              padding: '12px 16px'
                            }}
                            cursor={{ stroke: '#8b5cf6', strokeWidth: 1, strokeDasharray: '5 5' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="valor"
                            stroke="#8b5cf6"
                            fillOpacity={1}
                            fill="url(#colorVendas)"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="valor" 
                            stroke="#8b5cf6" 
                            strokeWidth={3}
                            dot={{ fill: '#fff', stroke: '#8b5cf6', strokeWidth: 2, r: 5 }}
                            activeDot={{ r: 7, fill: '#8b5cf6' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                      )}
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>

              {/* Gráfico de Envios por Plataforma */}
              <Card className="shadow-lg">
                <Tabs defaultValue="plataformas" className="w-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Envios por Plataforma</CardTitle>
                        <CardDescription>Pedidos enviados por plataforma no período</CardDescription>
                      </div>
                      <TabsList>
                        <TabsTrigger value="plataformas">Por Plataforma</TabsTrigger>
                        <TabsTrigger value="total">Total</TabsTrigger>
                      </TabsList>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <TabsContent value="plataformas" className="mt-0">
                      {metrics.enviosPorPlataforma.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-2">
                          <BarChart3 className="h-12 w-12 opacity-20" />
                          <p className="text-sm">Nenhum dado para o período selecionado</p>
                        </div>
                      ) : (
                      <>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart 
                          data={metrics.enviosPorPlataforma.map(p => ({
                            nome: p.nome,
                            quantidade: p.quantidade,
                            cor: p.cor
                          }))}
                          margin={{ top: 30, right: 30, left: 20, bottom: 0 }}
                        >
                          <defs>
                            {metrics.enviosPorPlataforma.map((entry, index) => (
                              <linearGradient key={`envio-grad-${index}`} id={`envioGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={entry.cor} stopOpacity={0.6} />
                                <stop offset="100%" stopColor={entry.cor} stopOpacity={0.9} />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                          <XAxis 
                            dataKey="nome"
                            angle={0}
                            textAnchor="middle"
                            height={30}
                            tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 600 }}
                          />
                          <YAxis 
                            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                            allowDecimals={false}
                          />
                          <Tooltip 
                            formatter={(value: any) => [value, 'Envios']}
                            labelFormatter={(label) => `${label}`}
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                              padding: '12px 16px'
                            }}
                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                          />
                          <Bar dataKey="quantidade" radius={[10, 10, 0, 0]}>
                            {metrics.enviosPorPlataforma.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={`url(#envioGradient-${index})`} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-4 justify-center mt-6">
                        {metrics.enviosPorPlataforma.map((plat) => (
                          <div key={plat.nome} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plat.cor }} />
                            <span className="text-sm font-medium">{plat.nome}</span>
                            <Badge variant="secondary" className="text-xs">{plat.quantidade} envios</Badge>
                          </div>
                        ))}
                      </div>
                      </>
                      )}
                    </TabsContent>
                    <TabsContent value="total" className="mt-0">
                      {metrics.enviosPorDia.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-2">
                          <BarChart3 className="h-12 w-12 opacity-20" />
                          <p className="text-sm">Nenhum dado para o período selecionado</p>
                        </div>
                      ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart 
                          data={metrics.enviosPorDia}
                          margin={{ top: 30, right: 30, left: 20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorEnvios" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                          <XAxis 
                            dataKey="data"
                            angle={0}
                            textAnchor="middle"
                            height={30}
                            tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 600 }}
                            tickFormatter={(value) => format(parseISO(value), 'dd/MM')}
                          />
                          <YAxis 
                            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                            allowDecimals={false}
                          />
                          <Tooltip 
                            formatter={(value: any) => [value, 'Envios']}
                            labelFormatter={(label) => format(parseISO(label), 'dd/MM/yyyy')}
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                              padding: '12px 16px'
                            }}
                            cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '5 5' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="quantidade"
                            stroke="#10b981"
                            fillOpacity={1}
                            fill="url(#colorEnvios)"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="quantidade" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            dot={{ fill: '#fff', stroke: '#10b981', strokeWidth: 2, r: 5 }}
                            activeDot={{ r: 7, fill: '#10b981' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                      )}
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>
            </div>

            {/* Pedidos por Status - Largura total */}
            <Card className="mt-6 shadow-lg">
              <CardHeader>
                <CardTitle>Pedidos por Status</CardTitle>
                <CardDescription>Distribuição atual dos pedidos criados no período</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {metrics.vendasPorStatus.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[320px] text-muted-foreground gap-2">
                    <BarChart3 className="h-12 w-12 opacity-20" />
                    <p className="text-sm">Nenhum dado para o período selecionado</p>
                  </div>
                ) : (
                <>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart 
                    data={metrics.vendasPorStatus.map(s => ({
                      nome: s.nome,
                      pedidos: s.pedidos,
                      cor: s.cor
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 0 }}
                  >
                    <defs>
                      {metrics.vendasPorStatus.map((entry, index) => (
                        <linearGradient key={`status-grad-${index}`} id={`statusGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={entry.cor} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={entry.cor} stopOpacity={0.9} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                    <XAxis 
                      dataKey="nome"
                      angle={0}
                      textAnchor="middle"
                      height={30}
                      tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 600 }}
                    />
                    <YAxis 
                      tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      formatter={(value: any) => [value, 'Pedidos']}
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        padding: '12px 16px'
                      }}
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    />
                    <Bar dataKey="pedidos" radius={[10, 10, 0, 0]}>
                      {metrics.vendasPorStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#statusGradient-${index})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-4 justify-center mt-6">
                  {metrics.vendasPorStatus.map((status) => (
                    <div key={status.nome} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.cor }} />
                      <span className="text-sm font-medium">{status.nome}</span>
                      <Badge variant="secondary" className="text-xs">{status.pedidos} pedidos</Badge>
                    </div>
                  ))}
                </div>
                </>
                )}
              </CardContent>
            </Card>
            </>

          {/* Top Produtos e Produtos com Maior Ticket Médio */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Top 5 Produtos Mais Vendidos
                </CardTitle>
                <CardDescription>Produtos com melhor performance em quantidade</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.topProdutos.map((produto, idx) => (
                    <div key={produto.nome} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg hover:bg-accent/70 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                          {idx + 1}
                        </div>
                        {produto.img_url ? (
                          <img 
                            src={produto.img_url} 
                            alt={produto.nome}
                            className="w-12 h-12 object-cover rounded-md shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={produto.img_url ? '' : 'ml-0'}>
                          <p className="font-medium text-sm">{produto.nome}</p>
                          <p className="text-xs text-muted-foreground">{produto.quantidade} unidades</p>
                        </div>
                      </div>
                      <span className="font-semibold text-sm">{formatCurrency(produto.receita)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                  Top 5 Produtos com Maior Ticket Médio
                </CardTitle>
                <CardDescription>Produtos com maior valor médio por unidade</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.produtosMaiorTicket.map((produto, idx) => (
                    <div key={produto.nome} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg hover:bg-accent/70 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm shrink-0">
                          {idx + 1}
                        </div>
                        {produto.img_url ? (
                          <img 
                            src={produto.img_url} 
                            alt={produto.nome}
                            className="w-12 h-12 object-cover rounded-md shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={produto.img_url ? '' : 'ml-0'}>
                          <p className="font-medium text-sm">{produto.nome}</p>
                          <p className="text-xs text-muted-foreground">{produto.quantidade} unidades • Ticket: {formatCurrency(produto.ticketMedio)}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-sm">{formatCurrency(produto.receita)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Métricas Adicionais */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Taxa de Envio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-3xl font-bold">{((metrics.pedidosEnviados / metrics.totalPedidos) * 100).toFixed(1)}%</div>
                  <p className="text-sm text-muted-foreground">{metrics.pedidosEnviados} de {metrics.totalPedidos} pedidos enviados</p>
                  <Progress value={(metrics.pedidosEnviados / metrics.totalPedidos) * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Pedidos Pendentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-3xl font-bold">{Math.max(0, metrics.totalPedidos - metrics.pedidosEnviados)}</div>
                  <p className="text-sm text-muted-foreground">Aguardando envio</p>
                </div>
              </CardContent>
            </Card>

          </div>
        </>
      )}

      {/* Modal: detalhes de frete por pedido */}
      <Dialog open={freteModal.open} onOpenChange={(v) => setFreteModal(prev => ({ ...prev, open: v }))}>
        <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-yellow-600" />
              Detalhes de Frete por Pedido
            </DialogTitle>
            <DialogDescription>Receita, custo e margem individual dos pedidos enviados no dia selecionado.</DialogDescription>
          </DialogHeader>

          {(() => {
            const totalReceita = freteModal.summary?.receita ?? freteModal.data.reduce((s, r) => s + r.receita, 0);
            const totalCusto = freteModal.summary?.custo ?? freteModal.data.reduce((s, r) => s + r.custo, 0);
            const totalMargem = freteModal.summary?.margem ?? (totalReceita - totalCusto);
            const totalPct = totalCusto > 0 ? (totalMargem / totalCusto) * 100 : 0;
            const rowsPerPage = 10;
            const totalPages = Math.max(1, Math.ceil(freteModal.data.length / rowsPerPage));
            const startIndex = (freteModal.currentPage - 1) * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            const paginatedData = freteModal.data.slice(startIndex, endIndex);

            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg border border-teal-300 bg-teal-50 text-teal-800 p-3 text-center transition-all duration-200 ease-out hover:shadow-sm">
                    <p className="text-[11px] font-medium opacity-70">Receita total</p>
                    <p className="text-sm font-bold">{formatCurrency(totalReceita)}</p>
                  </div>
                  <div className="rounded-lg border border-pink-300 bg-pink-50 text-pink-800 p-3 text-center transition-all duration-200 ease-out hover:shadow-sm">
                    <p className="text-[11px] font-medium opacity-70">Custo total</p>
                    <p className="text-sm font-bold">{formatCurrency(totalCusto)}</p>
                  </div>
                  <div className={`rounded-lg border p-3 text-center transition-all duration-200 ease-out hover:shadow-sm ${totalMargem >= 0 ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-800'}`}>
                    <p className="text-[11px] font-medium opacity-70">Margem total</p>
                    <p className="text-sm font-bold">{formatCurrency(totalMargem)}</p>
                  </div>
                  <div className={`rounded-lg border p-3 text-center transition-all duration-200 ease-out hover:shadow-sm ${totalPct >= 0 ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-800'}`}>
                    <p className="text-[11px] font-medium opacity-70">% Margem</p>
                    <p className="text-sm font-bold">{totalPct.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => goFreteModalDay('prev')}
                    disabled={freteModal.loading || freteModal.selectedDate <= startDate}
                    className="h-8 transition-all duration-200 ease-out active:scale-95 hover:scale-[1.03]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Dia selecionado</p>
                    <p className="text-sm font-semibold text-foreground">{format(parseISO(freteModal.selectedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => goFreteModalDay('next')}
                    disabled={freteModal.loading || freteModal.selectedDate >= endDate}
                    className="h-8 transition-all duration-200 ease-out active:scale-95 hover:scale-[1.03]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="h-[430px] rounded-md border overflow-hidden transition-all duration-300 ease-out">
                  {freteModal.loading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-yellow-600" />
                    </div>
                  ) : freteModal.data.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                      <Package className="h-10 w-10 text-foreground opacity-50" />
                      <p className="text-sm text-foreground">Nenhum pedido encontrado para esse dia.</p>
                    </div>
                  ) : (
                    <>
                      <ScrollArea className="h-[380px]">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Pedido</th>
                              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Receita</th>
                              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Custo</th>
                              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Margem</th>
                              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedData.map((row, i) => (
                              <tr key={row.id_externo + i} className="border-t hover:bg-muted/30 transition-colors">
                                <td className="px-3 py-2 font-mono text-[11px]">{row.id_externo}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.receita)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.custo)}</td>
                                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${row.margem >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                  {formatCurrency(row.margem)}
                                </td>
                                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${row.margemPct >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                  {row.margemPct.toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollArea>

                      <div className="h-[50px] border-t flex items-center justify-between gap-2 px-2 bg-muted/20">
                        {totalPages > 1 ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setFreteModal(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                              disabled={freteModal.currentPage === 1}
                              className="h-8 transition-all duration-200 ease-out active:scale-95 hover:scale-[1.03]"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium text-muted-foreground">Página</span>
                              <span className="text-sm font-bold">{freteModal.currentPage}</span>
                              <span className="text-xs text-muted-foreground">de</span>
                              <span className="text-sm font-bold">{totalPages}</span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setFreteModal(prev => ({ ...prev, currentPage: Math.min(totalPages, prev.currentPage + 1) }))}
                              disabled={freteModal.currentPage === totalPages}
                              className="h-8 transition-all duration-200 ease-out active:scale-95 hover:scale-[1.03]"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <div className="w-full text-center text-xs text-muted-foreground"> </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal: relação de pedidos com destaque de livrarias */}
      <Dialog open={pedidosModal.open} onOpenChange={(v) => setPedidosModal(prev => ({ ...prev, open: v }))}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <List className="h-5 w-5 text-custom-600" />
              Relação de Pedidos
            </DialogTitle>
            <DialogDescription>Resumo do período selecionado.</DialogDescription>
          </DialogHeader>

          {pedidosModal.loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-custom-600" />
            </div>
          ) : pedidosModal.data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido encontrado no período.</p>
          ) : (() => {
            const comLiv = pedidosModal.data.filter(p => p.temLivraria);
            const comCount = (pedidosModal as any).livrariaCount ?? comLiv.length;
            const totalCount = (pedidosModal as any).totalCount ?? pedidosModal.data.length;
            const semCount = Math.max(0, totalCount - comCount);

            const comRevenue = comLiv.reduce((s, p) => s + p.valor_total, 0);
            const totalRevenue = (pedidosModal as any).totalRevenue ?? pedidosModal.data.reduce((s, p) => s + p.valor_total, 0);
            const semRevenue = Math.max(0, totalRevenue - comRevenue);

            return (
              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex flex-col items-center gap-1">
                  <BookOpen className="h-5 w-5 text-amber-600" />
                  <span className="text-2xl font-bold text-amber-800">{comCount}</span>
                  <span className="text-xs text-amber-700 font-medium text-center">Com livraria</span>
                  <span className="text-xs text-amber-600">{formatCurrency(comRevenue)}</span>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4 flex flex-col items-center gap-1">
                  <List className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold text-foreground">{semCount}</span>
                  <span className="text-xs text-muted-foreground font-medium text-center">Sem livraria</span>
                  <span className="text-xs text-muted-foreground">{formatCurrency(semRevenue)}</span>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
