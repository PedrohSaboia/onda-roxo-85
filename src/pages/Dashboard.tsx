import { Package, TrendingUp, Users, Truck, Calendar as CalendarIcon, DollarSign, ShoppingCart, TrendingDown, BarChart3, AlertCircle, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, subMonths, parseISO, eachDayOfInterval, isSameDay, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
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
  pedidosEnviados: number;
  topProdutos: { nome: string; quantidade: number; receita: number; img_url: string | null }[];
  produtosMaiorTicket: { nome: string; quantidade: number; ticketMedio: number; receita: number; img_url: string | null }[];
  vendasPorPlataforma: { nome: string; total: number; pedidos: number; cor: string }[];
  vendasPorPlataformaPorPeriodo: { periodo: string; plataformas: { nome: string; valor: number; cor: string }[] }[];
  vendasPorStatus: { nome: string; pedidos: number; cor: string }[];
  vendasTotaisPorDia: { data: string; valor: number }[];
  enviosPorPlataforma: { nome: string; quantidade: number; cor: string }[];
  enviosPorDia: { data: string; quantidade: number }[];
  isPeriodoCurto: boolean;
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
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());

  const fetchMetrics = useCallback(async () => {
    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
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
        .order('criado_em', { ascending: false })
        .abortSignal(signal);

      if (pedidosError) {
        if (pedidosError.message.includes('aborted')) return;
        throw pedidosError;
      }
      
      // Buscar pedidos com status "Enviado" atualizados no período
      const ENVIADO_STATUS_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';
      const { data: pedidosEnviadosData, error: pedidosEnviadosError } = await supabase
        .from('pedidos')
        .select('id, atualizado_em, plataformas(nome, cor)')
        .eq('status_id', ENVIADO_STATUS_ID)
        .gte('atualizado_em', startISO)
        .lte('atualizado_em', endISO)
        .abortSignal(signal);

      if (pedidosEnviadosError) {
        if (pedidosEnviadosError.message.includes('aborted')) return;
        throw pedidosEnviadosError;
      }
      
      if (signal.aborted) return;

        const pedidosData = (pedidos || []) as any[];
        const pedidosEnviadosArray = (pedidosEnviadosData || []) as any[];
        const pedidosEnviadosCount = pedidosEnviadosArray.length;

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
        const enviosPorPlataforma = Object.entries(enviosPlataformaMap).map(([nome, data]) => ({ nome, ...data }));

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
        const totalPedidos = pedidosData.length;
        const vendasTotal = pedidosData.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0);
        const ticketMedio = totalPedidos > 0 ? vendasTotal / totalPedidos : 0;

        const hoje = new Date().toDateString();
        const pedidosHoje = pedidosData.filter(p => new Date(p.criado_em).toDateString() === hoje).length;

        // Usar contagem da query separada de pedidos enviados no período
        const pedidosEnviados = pedidosEnviadosCount;

        // Determinar se é período curto (dia ou semana - até 7 dias)
        const diffDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)) + 1;
        const isPeriodoCurto = diffDays <= 7;

        // Top produtos e produtos com maior ticket médio
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
        const topProdutos = produtosArray.sort((a, b) => b.quantidade - a.quantidade).slice(0, 5);
        
        // Produtos com maior ticket médio
        const produtosMaiorTicket = produtosArray
          .filter(p => p.quantidade > 0)
          .map(p => ({
            nome: p.nome,
            quantidade: p.quantidade,
            receita: p.receita,
            ticketMedio: p.receita / p.quantidade,
            img_url: p.img_url
          }))
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
        const vendasPorPlataforma = Object.entries(plataformasMap).map(([nome, data]) => ({ nome, ...data }));

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

        // Vendas por status
        const statusMap: Record<string, { pedidos: number; cor: string }> = {};
        pedidosData.forEach(p => {
          const nome = (p.status as any)?.nome || 'Sem Status';
          const cor = (p.status as any)?.cor_hex || '#cccccc';
          if (!statusMap[nome]) {
            statusMap[nome] = { pedidos: 0, cor };
          }
          statusMap[nome].pedidos += 1;
        });
        const vendasPorStatus = Object.entries(statusMap).map(([nome, data]) => ({ nome, ...data }));

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
          pedidosEnviados,
          topProdutos,
          produtosMaiorTicket,
          vendasPorPlataforma,
          vendasPorPlataformaPorPeriodo,
          vendasPorStatus,
          vendasTotaisPorDia,
          enviosPorPlataforma,
          enviosPorDia,
          isPeriodoCurto,
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
            <MetricCard
              title="Total de Pedidos"
              value={metrics.totalPedidos.toString()}
              description={`${metrics.pedidosHoje} pedidos hoje`}
              icon={BiSolidPurchaseTag }
              color="custom"
            />
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
              description={`${((metrics.pedidosEnviados / metrics.totalPedidos) * 100).toFixed(1)}% dos pedidos`}
              icon={BsSendCheckFill}
              color="orange"
            />
          </div>

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
                    </TabsContent>
                    <TabsContent value="total" className="mt-0">
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
                    </TabsContent>
                    <TabsContent value="total" className="mt-0">
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
                  <div className="text-3xl font-bold">{metrics.totalPedidos - metrics.pedidosEnviados}</div>
                  <p className="text-sm text-muted-foreground">Aguardando envio</p>
                </div>
              </CardContent>
            </Card>

          </div>
        </>
      )}
    </div>
  );
}
