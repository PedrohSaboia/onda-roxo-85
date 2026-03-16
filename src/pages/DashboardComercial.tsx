import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, Zap, CreditCard, RefreshCw, CheckCircle2, ShoppingCart, Mail, MessageCircle, Users, TrendingUp, DollarSign } from 'lucide-react';
import { FaCalendarAlt } from 'react-icons/fa';
import { format, parseISO, startOfMonth, subMonths, isSameDay, isWithinInterval, differenceInDays, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ComercialSidebar from '@/components/layout/ComercialSidebar';
import IconDashboard from '@/components/icons/IconDashboard';
import IconYampi from '@/components/icons/IconYampi';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip as UITooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ResponsiveContainer, AreaChart, Area, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';

type PixMetricsRow = {
  tipo_de_lead_id: number;
  tipo_de_lead_nome: string;
  total_periodo: number;
  total_hoje: number;
  total_ontem: number;
  total_7_dias: number;
  total_30_dias: number;
  total_mes_atual: number;
  total_vendidos_periodo: number;
  taxa_conversao_periodo: number;
  valor_total_periodo: number;
  ticket_medio_periodo: number;
};

type TypeBotMetricsRow = {
  tipo_de_lead_id: number;
  tipo_de_lead_nome: string;
  id_type: number;
  total_periodo: number;
  total_hoje: number;
  total_ontem: number;
  total_7_dias: number;
  total_30_dias: number;
  total_mes_atual: number;
  total_vendidos_periodo: number;
  taxa_conversao_periodo: number;
  valor_total_periodo: number;
  ticket_medio_periodo: number;
};

type PixDailyRow = {
  dia: string;
  total_entradas: number;
  total_vendidos: number;
  valor_total: number;
};

type PixConvertedByResponsavelRow = {
  responsavel_id: string | null;
  responsavel_nome: string;
  total_convertidos: number;
  valor_total_convertido: number;
  ticket_medio_convertido: number;
};

type YampiUpsellMetricsRow = {
  total_pedidos_yampi: number;
  pedidos_com_inclusao_itens: number;
  pedidos_sem_inclusao_itens: number;
  taxa_inclusao_itens_pct: number;
  ticket_medio_geral: number;
  ticket_medio_sem_inclusao: number;
  ticket_medio_com_inclusao: number;
  aumento_ticket_medio_valor: number;
  aumento_ticket_medio_pct: number;
  itens_medios_por_pedido: number;
  unidades_medias_por_pedido: number;
  faturamento_total_yampi: number;
  faturamento_site_yampi: number;
};

type YampiUpsellIncrementoRow = {
  total_pedidos_yampi: number;
  pedidos_com_incremento: number;
  taxa_incremento_pct: number;
  ticket_medio_com_incremento: number;
  faturamento_com_incremento: number;
  pedidos_com_upsell: number;
  taxa_upsell_pct: number;
  ticket_medio_com_upsell: number;
  faturamento_com_upsell: number;
  pedidos_com_ambos: number;
  taxa_ambos_pct: number;
  pedidos_sem_alteracao: number;
  taxa_sem_alteracao_pct: number;
  ticket_medio_sem_alteracao: number;
  faturamento_sem_alteracao: number;
  faturamento_total_yampi: number;
};

type EntradaValoresUpsellMetricsRow = {
  total_upsells: number;
  faturamento_acrescido: number;
  media_valor_acrescido: number;
  ticket_medio_antes: number;
  ticket_medio_depois: number;
  maior_upsell: number;
  menor_upsell: number;
};

type TopProdutosUpsellRow = {
  produto_id: string;
  produto_nome: string;
  total_inclusoes: number;
  quantidade_total: number;
  valor_total: number;
  ticket_medio: number;
};

type DailyChartStyle = 'linha' | 'barras' | 'pizza';

export function DashboardComercial() {
  const navigate = useNavigate();
  const { empresaId } = useAuth();

  const [pixMetrics, setPixMetrics] = useState<PixMetricsRow | null>(null);
  const [carrinhoMetrics, setCarrinhoMetrics] = useState<PixMetricsRow | null>(null);
  const [whatsappMetrics, setWhatsappMetrics] = useState<PixMetricsRow | null>(null);
  const [typebotsMetrics, setTypebotsMetrics] = useState<TypeBotMetricsRow[]>([]);
  const [pixDailySeries, setPixDailySeries] = useState<PixDailyRow[]>([]);
  const [carrinhoDailySeries, setCarrinhoDailySeries] = useState<PixDailyRow[]>([]);
  const [whatsappDailySeries, setWhatsappDailySeries] = useState<PixDailyRow[]>([]);
  const [pixConvertedByResponsavel, setPixConvertedByResponsavel] = useState<PixConvertedByResponsavelRow[]>([]);
  const [carrinhoConvertedByResponsavel, setCarrinhoConvertedByResponsavel] = useState<PixConvertedByResponsavelRow[]>([]);
  const [yampiUpsellMetrics, setYampiUpsellMetrics] = useState<YampiUpsellMetricsRow | null>(null);
  const [yampiUpsellIncrementoMetrics, setYampiUpsellIncrementoMetrics] = useState<YampiUpsellIncrementoRow | null>(null);
  const [entradaValoresUpsellMetrics, setEntradaValoresUpsellMetrics] = useState<EntradaValoresUpsellMetricsRow | null>(null);
  const [topProdutosUpsell, setTopProdutosUpsell] = useState<TopProdutosUpsellRow[]>([]);
  const [custoComercial, setCustoComercial] = useState<number>(0);
  const [loadingPixDashboard, setLoadingPixDashboard] = useState(false);
  const [pixDashboardError, setPixDashboardError] = useState<string | null>(null);
  const [pixDailyChartStyle, setPixDailyChartStyle] = useState<DailyChartStyle>('linha');
  const [carrinhoDailyChartStyle, setCarrinhoDailyChartStyle] = useState<DailyChartStyle>('linha');
  const [whatsappDailyChartStyle, setWhatsappDailyChartStyle] = useState<DailyChartStyle>('linha');
  const [dashboardDateStart, setDashboardDateStart] = useState<string>(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dashboardDateEnd, setDashboardDateEnd] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [dashboardPickerOpen, setDashboardPickerOpen] = useState(false);
  const [dashboardTempStartDate, setDashboardTempStartDate] = useState<Date | null>(() => startOfMonth(new Date()));
  const [dashboardTempEndDate, setDashboardTempEndDate] = useState<Date | null>(() => new Date());
  const [dashboardHoverDate, setDashboardHoverDate] = useState<Date | null>(null);
  const [dashboardCalendarMonth, setDashboardCalendarMonth] = useState<number>(() => new Date().getMonth());
  const [dashboardCalendarYear, setDashboardCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [dashboardRangeApplied, setDashboardRangeApplied] = useState<{ start: string; end: string }>(() => ({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  }));

  useEffect(() => {
    let mounted = true;

    const loadPixDashboard = async () => {
      setLoadingPixDashboard(true);
      setPixDashboardError(null);
      try {
        const startDate = new Date(`${dashboardRangeApplied.start}T00:00:00`);
        const endDate = new Date(`${dashboardRangeApplied.end}T23:59:59.999`);
        const intervaloDias = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        const [
          { data: metricasData, error: metricasError },
          { data: metricasWhatsappData, error: metricasWhatsappError },
          { data: metricasTypebotsData, error: metricasTypebotsError },
          { data: seriePixData, error: seriePixError },
          { data: serieCarrinhoData, error: serieCarrinhoError },
          { data: serieWhatsappData, error: serieWhatsappError },
          { data: convertidosData, error: convertidosError },
          { data: convertidosCarrinhoData, error: convertidosCarrinhoError },
          { data: yampiUpsellData, error: yampiUpsellError },
          { data: custoData, error: custoError },
          { data: upsellIncrementoData, error: upsellIncrementoError },
          { data: entradaValoresUpsellData, error: entradaValoresUpsellError },
          { data: topProdutosData, error: topProdutosError },
          { data: metricasCarrinhoData, error: metricasCarrinhoError },
        ] = await Promise.all([
          (supabase as any).rpc('comercial_get_metricas_leads_pix', {
            p_empresa_id: empresaId ?? null,
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
            p_timezone: 'America/Sao_Paulo',
          }),
          (supabase as any).rpc('comercial_get_metricas_leads_whatsapp', {
            p_empresa_id: empresaId ?? null,
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
            p_timezone: 'America/Sao_Paulo',
          }),
          (supabase as any).rpc('comercial_get_metricas_leads_typebots', {
            p_empresa_id: empresaId ?? null,
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
            p_timezone: 'America/Sao_Paulo',
          }),
          (supabase as any).rpc('comercial_get_entradas_leads_pix_por_dia', {
            p_empresa_id: empresaId ?? null,
            p_dias: intervaloDias,
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
            p_timezone: 'America/Sao_Paulo',
          }),
          (supabase as any).rpc('comercial_get_entradas_leads_carrinho_ab_por_dia', {
            p_empresa_id: empresaId ?? null,
            p_dias: intervaloDias,
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
            p_timezone: 'America/Sao_Paulo',
          }),
          (supabase as any).rpc('comercial_get_entradas_leads_whatsapp_por_dia', {
            p_empresa_id: empresaId ?? null,
            p_dias: intervaloDias,
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
            p_timezone: 'America/Sao_Paulo',
          }),
          (supabase as any).rpc('comercial_get_leads_convertidos_pix_por_responsavel', {
            p_empresa_id: empresaId ?? null,
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
            p_limit: 8,
            p_timezone: 'America/Sao_Paulo',
          }),
          (supabase as any).rpc('comercial_get_leads_convertidos_carrinho_ab_por_responsavel', {
            p_empresa_id: empresaId ?? null,
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
            p_limit: 8,
            p_timezone: 'America/Sao_Paulo',
          }),
          (supabase as any).rpc('comercial_get_metricas_upsell_yampi', {
            p_empresa_id: empresaId ?? null,
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
            p_timezone: 'America/Sao_Paulo',
          }),
          (supabase as any).rpc('comercial_get_custo_total'),
          (supabase as any).rpc('comercial_get_metricas_yampi_upsell_incremento', {
            p_empresa_id: empresaId ?? null,
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
            p_timezone: 'America/Sao_Paulo',
          }),
          (supabase as any).rpc('comercial_get_metricas_entrada_valores_upsell', {
            p_empresa_id: empresaId ?? null,
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
            p_timezone: 'America/Sao_Paulo',
          }),
          (supabase as any).rpc('comercial_get_top_produtos_upsell', {
            p_empresa_id: empresaId ?? null,
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
            p_timezone: 'America/Sao_Paulo',
            p_limit: 3,
          }),
          (supabase as any).rpc('comercial_get_metricas_leads_carrinho_ab', {
            p_empresa_id: empresaId ?? null,
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
            p_timezone: 'America/Sao_Paulo',
          }),
        ]);

        if (metricasError) throw metricasError;
        if (metricasWhatsappError) throw metricasWhatsappError;
        if (metricasTypebotsError) throw metricasTypebotsError;
        if (seriePixError) throw seriePixError;
        if (serieCarrinhoError) throw serieCarrinhoError;
        if (serieWhatsappError) throw serieWhatsappError;
        if (convertidosError) throw convertidosError;
        if (convertidosCarrinhoError) throw convertidosCarrinhoError;
        if (yampiUpsellError) throw yampiUpsellError;
        if (custoError) throw custoError;
        if (upsellIncrementoError) throw upsellIncrementoError;
        if (entradaValoresUpsellError) console.warn('[EntradaValores] RPC error:', entradaValoresUpsellError);
        if (topProdutosError) console.warn('[TopProdutos] RPC error:', topProdutosError);
        if (metricasCarrinhoError) throw metricasCarrinhoError;
        if (!mounted) return;

        setPixMetrics((metricasData?.[0] || null) as PixMetricsRow | null);
        setWhatsappMetrics((metricasWhatsappData?.[0] || null) as PixMetricsRow | null);
        setTypebotsMetrics((metricasTypebotsData || []) as TypeBotMetricsRow[]);
        setPixDailySeries((seriePixData || []) as PixDailyRow[]);
        setCarrinhoDailySeries((serieCarrinhoData || []) as PixDailyRow[]);
        setWhatsappDailySeries((serieWhatsappData || []) as PixDailyRow[]);
        setPixConvertedByResponsavel((convertidosData || []) as PixConvertedByResponsavelRow[]);
        setCarrinhoConvertedByResponsavel((convertidosCarrinhoData || []) as PixConvertedByResponsavelRow[]);
        setYampiUpsellMetrics((yampiUpsellData?.[0] || null) as YampiUpsellMetricsRow | null);
        setCustoComercial(Number(custoData?.[0]?.custo_total ?? 0));
        setYampiUpsellIncrementoMetrics((upsellIncrementoData?.[0] || null) as YampiUpsellIncrementoRow | null);
        setEntradaValoresUpsellMetrics((entradaValoresUpsellData?.[0] || null) as EntradaValoresUpsellMetricsRow | null);
        setTopProdutosUpsell((topProdutosData || []) as TopProdutosUpsellRow[]);
        setCarrinhoMetrics((metricasCarrinhoData?.[0] || null) as PixMetricsRow | null);
      } catch (err: any) {
        if (!mounted) return;
        setPixDashboardError(err?.message || String(err));
        setPixMetrics(null);
        setWhatsappMetrics(null);
        setTypebotsMetrics([]);
        setPixDailySeries([]);
        setCarrinhoDailySeries([]);
        setWhatsappDailySeries([]);
        setPixConvertedByResponsavel([]);
        setCarrinhoConvertedByResponsavel([]);
        setYampiUpsellMetrics(null);
        setCustoComercial(0);
        setYampiUpsellIncrementoMetrics(null);
        setEntradaValoresUpsellMetrics(null);
        setTopProdutosUpsell([]);
        setCarrinhoMetrics(null);
      } finally {
        if (mounted) setLoadingPixDashboard(false);
      }
    };

    loadPixDashboard();

    return () => {
      mounted = false;
    };
  }, [empresaId, dashboardRangeApplied]);

  const handleDashboardDateClick = (date: Date) => {
    if (!dashboardTempStartDate || (dashboardTempStartDate && dashboardTempEndDate)) {
      setDashboardTempStartDate(date);
      setDashboardTempEndDate(null);
    } else {
      if (date < dashboardTempStartDate) {
        setDashboardTempEndDate(dashboardTempStartDate);
        setDashboardTempStartDate(date);
      } else {
        setDashboardTempEndDate(date);
      }
    }
  };

  const applyDashboardCustomDates = () => {
    if (dashboardTempStartDate) {
      const start = format(dashboardTempStartDate, 'yyyy-MM-dd');
      const end = dashboardTempEndDate ? format(dashboardTempEndDate, 'yyyy-MM-dd') : start;
      setDashboardDateStart(start);
      setDashboardDateEnd(end);
      setDashboardRangeApplied({ start, end });
    }
    setDashboardPickerOpen(false);
  };

  const handleDashboardPreset = (presetFn: () => void) => {
    presetFn();
  };

  const navigateDashboardMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (dashboardCalendarMonth === 0) {
        setDashboardCalendarMonth(11);
        setDashboardCalendarYear(dashboardCalendarYear - 1);
      } else {
        setDashboardCalendarMonth(dashboardCalendarMonth - 1);
      }
    } else {
      if (dashboardCalendarMonth === 11) {
        setDashboardCalendarMonth(0);
        setDashboardCalendarYear(dashboardCalendarYear + 1);
      } else {
        setDashboardCalendarMonth(dashboardCalendarMonth + 1);
      }
    }
  };

  const renderDashboardCalendar = (monthOffset: number = 0) => {
    const today = new Date();

    const displayYear = monthOffset === 0 ? dashboardCalendarYear : (dashboardCalendarMonth === 11 ? dashboardCalendarYear + 1 : dashboardCalendarYear);
    const displayMonth = monthOffset === 0 ? dashboardCalendarMonth : (dashboardCalendarMonth === 11 ? 0 : dashboardCalendarMonth + 1);

    const firstDay = new Date(displayYear, displayMonth, 1);
    const lastDay = new Date(displayYear, displayMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-8" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(displayYear, displayMonth, day);
      const isToday = isSameDay(date, today);
      const isStart = dashboardTempStartDate && isSameDay(date, dashboardTempStartDate);
      const isEnd = dashboardTempEndDate && isSameDay(date, dashboardTempEndDate);
      const isInRange = dashboardTempStartDate && dashboardTempEndDate && isWithinInterval(date, { start: dashboardTempStartDate, end: dashboardTempEndDate });
      const isHoverInRange = dashboardTempStartDate && !dashboardTempEndDate && dashboardHoverDate && date > dashboardTempStartDate && date <= dashboardHoverDate;

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDashboardDateClick(date)}
          onMouseEnter={() => setDashboardHoverDate(date)}
          className={`h-8 text-sm rounded transition-colors ${
            isStart || isEnd
              ? 'bg-custom-600 text-white font-bold'
              : isInRange || isHoverInRange
              ? 'bg-custom-100'
              : isToday
              ? 'border border-custom-600 text-custom-600 font-semibold'
              : 'hover:bg-gray-100'
          }`}
        >
          {day}
        </button>
      );
    }

    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          {monthOffset === 0 && (
            <button type="button" onClick={() => navigateDashboardMonth('prev')} className="p-1 hover:bg-gray-100 rounded">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <span className="text-sm font-semibold flex-1 text-center">
            {format(new Date(displayYear, displayMonth), 'MMMM yyyy', { locale: ptBR })}
          </span>
          {monthOffset === 1 && (
            <button type="button" onClick={() => navigateDashboardMonth('next')} className="p-1 hover:bg-gray-100 rounded">
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {monthOffset === 0 && <div className="w-6" />}
        </div>
        <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
            <div key={d} className="text-center font-medium">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">{days}</div>
      </div>
    );
  };

  const formatCurrency = (value?: number | null) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

  const formatPercent = (value?: number | null) => `${Number(value || 0).toFixed(2)}%`;

  const pixDailyChartData = pixDailySeries.map((row) => ({
    ...row,
    dia_label: format(parseISO(`${row.dia}T00:00:00`), 'dd/MM'),
  }));

  const carrinhoDailyChartData = carrinhoDailySeries.map((row) => ({
    ...row,
    dia_label: format(parseISO(`${row.dia}T00:00:00`), 'dd/MM'),
  }));

  const whatsappDailyChartData = whatsappDailySeries.map((row) => ({
    ...row,
    dia_label: format(parseISO(`${row.dia}T00:00:00`), 'dd/MM'),
  }));

  const pixPieChartData = [
    { name: 'Entradas', value: pixDailySeries.reduce((acc, row) => acc + Number(row.total_entradas || 0), 0), color: '#2563eb' },
    { name: 'Vendidos', value: pixDailySeries.reduce((acc, row) => acc + Number(row.total_vendidos || 0), 0), color: '#16a34a' },
  ];

  const carrinhoPieChartData = [
    { name: 'Entradas', value: carrinhoDailySeries.reduce((acc, row) => acc + Number(row.total_entradas || 0), 0), color: '#2563eb' },
    { name: 'Vendidos', value: carrinhoDailySeries.reduce((acc, row) => acc + Number(row.total_vendidos || 0), 0), color: '#16a34a' },
  ];

  const whatsappPieChartData = [
    { name: 'Entradas', value: whatsappDailySeries.reduce((acc, row) => acc + Number(row.total_entradas || 0), 0), color: '#2563eb' },
    { name: 'Vendidos', value: whatsappDailySeries.reduce((acc, row) => acc + Number(row.total_vendidos || 0), 0), color: '#16a34a' },
  ];

  const mediaEntradasDia = pixDailySeries.length
    ? Number((pixDailySeries.reduce((acc, row) => acc + Number(row.total_entradas || 0), 0) / pixDailySeries.length).toFixed(1))
    : 0;

  const renderPixDailyTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload;
    if (!row) return null;

    const entradas = Number(row.total_entradas || 0);
    const vendidos = Number(row.total_vendidos || 0);
    const taxaDia = entradas > 0 ? (vendidos / entradas) * 100 : 0;
    const diaLabel = row?.dia ? format(parseISO(`${row.dia}T00:00:00`), "dd/MM/yyyy", { locale: ptBR }) : row?.dia_label;

    return (
      <div className="bg-custom-800 border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
        <p className="font-semibold mb-1">{diaLabel}</p>
        <p><span className="text-blue-600">●</span> Entradas: <strong>{entradas}</strong></p>
        <p><span className="text-green-600">●</span> Vendidos: <strong>{vendidos}</strong></p>
        <p className="mt-1">Taxa: <strong>{taxaDia.toFixed(1)}%</strong></p>
      </div>
    );
  };

  return (
    <div className="flex h-full">
      <div className="flex-shrink-0">
        <ComercialSidebar />
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar bg-custom-900">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <IconDashboard className="h-6 w-6" />
              Dashboard Comercial
            </h1>

            <div className="flex flex-col items-end gap-1">
                <Popover open={dashboardPickerOpen} onOpenChange={setDashboardPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button className="w-fit flex items-center justify-center gap-2 bg-white text-custom-800 hover:bg-white/90">
                      <FaCalendarAlt className="h-4 w-4" />
                      <span className="text-sm font-bold">{format(parseISO(dashboardDateStart), 'dd/MM/yy', { locale: ptBR })} → {format(parseISO(dashboardDateEnd), 'dd/MM/yy', { locale: ptBR })}</span>
                      <ChevronDown className="h-4 w-4 opacity-100" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="px-4 py-3 border-b">
                      <h3 className="font-semibold text-base">Selecionar Período</h3>
                    </div>

                    <div className="flex">
                      <div className="w-48 border-r">
                        <div className="py-2">
                          {[
                            { label: 'Hoje', fn: () => { const d = new Date(); const ds = format(d, 'yyyy-MM-dd'); setDashboardDateStart(ds); setDashboardDateEnd(ds); setDashboardRangeApplied({ start: ds, end: ds }); setDashboardTempStartDate(d); setDashboardTempEndDate(d); } },
                            { label: 'Ontem', fn: () => { const d = new Date(); d.setDate(d.getDate() - 1); const ds = format(d, 'yyyy-MM-dd'); setDashboardDateStart(ds); setDashboardDateEnd(ds); setDashboardRangeApplied({ start: ds, end: ds }); setDashboardTempStartDate(d); setDashboardTempEndDate(d); } },
                            { label: 'Últimos 7 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 6); const start = format(s, 'yyyy-MM-dd'); const end = format(e, 'yyyy-MM-dd'); setDashboardDateStart(start); setDashboardDateEnd(end); setDashboardRangeApplied({ start, end }); setDashboardTempStartDate(s); setDashboardTempEndDate(e); } },
                            { label: 'Últimos 14 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 13); const start = format(s, 'yyyy-MM-dd'); const end = format(e, 'yyyy-MM-dd'); setDashboardDateStart(start); setDashboardDateEnd(end); setDashboardRangeApplied({ start, end }); setDashboardTempStartDate(s); setDashboardTempEndDate(e); } },
                            { label: 'Últimos 30 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 29); const start = format(s, 'yyyy-MM-dd'); const end = format(e, 'yyyy-MM-dd'); setDashboardDateStart(start); setDashboardDateEnd(end); setDashboardRangeApplied({ start, end }); setDashboardTempStartDate(s); setDashboardTempEndDate(e); } },
                            { label: 'Este mês', fn: () => { const e = new Date(); const s = startOfMonth(e); const start = format(s, 'yyyy-MM-dd'); const end = format(e, 'yyyy-MM-dd'); setDashboardDateStart(start); setDashboardDateEnd(end); setDashboardRangeApplied({ start, end }); setDashboardTempStartDate(s); setDashboardTempEndDate(e); } },
                            { label: 'Mês passado', fn: () => { const hoje = new Date(); const mesPassado = subMonths(hoje, 1); const s = startOfMonth(mesPassado); const e = new Date(mesPassado.getFullYear(), mesPassado.getMonth() + 1, 0); const start = format(s, 'yyyy-MM-dd'); const end = format(e, 'yyyy-MM-dd'); setDashboardDateStart(start); setDashboardDateEnd(end); setDashboardRangeApplied({ start, end }); setDashboardTempStartDate(s); setDashboardTempEndDate(e); } },
                            { label: 'Ano', fn: () => { const e = new Date(); const s = new Date(e.getFullYear(), 0, 1); const start = format(s, 'yyyy-MM-dd'); const end = format(e, 'yyyy-MM-dd'); setDashboardDateStart(start); setDashboardDateEnd(end); setDashboardRangeApplied({ start, end }); setDashboardTempStartDate(s); setDashboardTempEndDate(e); } },
                            { label: 'Máximo', fn: () => { const e = new Date(); const s = new Date(2020, 0, 1); const start = format(s, 'yyyy-MM-dd'); const end = format(e, 'yyyy-MM-dd'); setDashboardDateStart(start); setDashboardDateEnd(end); setDashboardRangeApplied({ start, end }); setDashboardTempStartDate(s); setDashboardTempEndDate(e); } },
                          ].map((preset, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleDashboardPreset(preset.fn)}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <div className="flex">
                          {renderDashboardCalendar(0)}
                          {renderDashboardCalendar(1)}
                        </div>

                        <div className="flex gap-2 px-4 py-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setDashboardTempStartDate(null);
                              setDashboardTempEndDate(null);
                              setDashboardPickerOpen(false);
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 bg-custom-600 hover:bg-custom-700"
                            onClick={applyDashboardCustomDates}
                            disabled={!dashboardTempStartDate}
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

          {loadingPixDashboard ? (
            <Card>
              <CardContent className="py-10 bg-custom-800 border-0 text-sm text-muted-foreground">Carregando métricas...</CardContent>
            </Card>
          ) : pixDashboardError ? (
            <Card>
              <CardContent className="py-10 bg-custom-800 text-sm text-red-500">Erro ao carregar dashboard: {pixDashboardError}</CardContent>
            </Card>
          ) : (
            <>
              {/* Conteúdo do dashboard - continuarei na próxima parte */}
              {(() => {
                // ── Derivações base ───────────────────────────────────────────────
                const faturamentoSite      = Number(yampiUpsellMetrics?.faturamento_total_yampi ?? 0);
                const faturamentoPix       = Number(pixMetrics?.valor_total_periodo ?? 0);
                const taxaPix              = Number(pixMetrics?.taxa_conversao_periodo ?? 0);
                const ticketPix            = Number(pixMetrics?.ticket_medio_periodo ?? 0);

                const totalEntCarrinho     = Number(carrinhoMetrics?.total_periodo ?? 0);
                const totalVendCarrinho    = Number(carrinhoMetrics?.total_vendidos_periodo ?? 0);
                const faturamentoCarrinho  = Number(carrinhoMetrics?.valor_total_periodo ?? 0);
                const taxaCarrinho         = Number(carrinhoMetrics?.taxa_conversao_periodo ?? 0);
                const ticketCarrinho       = Number(carrinhoMetrics?.ticket_medio_periodo ?? 0);

                const faturamentoSocial    = Number(whatsappMetrics?.valor_total_periodo ?? 0);
                const taxaSocial           = Number(whatsappMetrics?.taxa_conversao_periodo ?? 0);
                const ticketSocial         = Number(whatsappMetrics?.ticket_medio_periodo ?? 0);
                const leadsSocial          = Number(whatsappMetrics?.total_periodo ?? 0);

                const taxaUpsell           = Number(yampiUpsellMetrics?.taxa_inclusao_itens_pct ?? 0);
                const totalPedidosYampi    = Number(yampiUpsellMetrics?.total_pedidos_yampi ?? 0);
                // Financeiro de up-sell: apenas quando há upsell real (taxa > 0)
                const _faturamentoUpsellRaw = Number(entradaValoresUpsellMetrics?.faturamento_acrescido ?? 0);
                const faturamentoUpsell    = taxaUpsell > 0 ? _faturamentoUpsellRaw : 0;
                const ticketUpsell         = Number(entradaValoresUpsellMetrics?.ticket_medio_depois ?? 0);

                const faturamentoComercial = faturamentoUpsell + faturamentoPix + faturamentoCarrinho + faturamentoSocial;
                const faturamentoTotal     = faturamentoSite + faturamentoComercial;
                const participacao         = faturamentoTotal > 0 ? (faturamentoComercial / faturamentoTotal) * 100 : 0;
                const receitaIncremental   = faturamentoUpsell + faturamentoPix + faturamentoCarrinho + faturamentoSocial;

                const origemData = [
                  { name: 'Upsell',   value: faturamentoUpsell,   color: '#7c3aed' },
                  { name: 'PIX',      value: faturamentoPix,       color: '#2563eb' },
                  { name: 'Carrinho', value: faturamentoCarrinho,  color: '#ea580c' },
                  { name: 'Social',   value: faturamentoSocial,    color: '#16a34a' },
                ].filter(d => d.value > 0);

                return (
                  <>
                    {/* ══ PAINEL HERO ═══════════════════════════════════════════ */}
                    {(() => {
                      // ROI real: receita incremental ÷ custo proporcional ao período
                      // Rateio: custo mensal / dias do mês * dias do intervalo aplicado
                      const _inicio = parseISO(`${dashboardRangeApplied.start}T00:00:00`);
                      const _fim = parseISO(`${dashboardRangeApplied.end}T00:00:00`);
                      const diasPeriodo = Math.max(differenceInDays(_fim, _inicio) + 1, 1);
                      let custoAjustado = 0;
                      for (let i = 0; i < diasPeriodo; i += 1) {
                        const dataAtual = new Date(_inicio);
                        dataAtual.setDate(_inicio.getDate() + i);
                        custoAjustado += custoComercial / getDaysInMonth(dataAtual);
                      }
                      const roi = custoAjustado > 0 ? receitaIncremental / custoAjustado : 0;
                      const heroItems = [
                        { label: 'Upsell',   value: faturamentoUpsell,   pct: receitaIncremental > 0 ? (faturamentoUpsell  / receitaIncremental) * 100 : 0, color: '#a78bfa' },
                        { label: 'Rec PIX',  value: faturamentoPix,       pct: receitaIncremental > 0 ? (faturamentoPix     / receitaIncremental) * 100 : 0, color: '#34d399' },
                        { label: 'Rec Carrinho', value: faturamentoCarrinho, pct: receitaIncremental > 0 ? (faturamentoCarrinho / receitaIncremental) * 100 : 0, color: '#22d3ee' },
                        { label: 'Redes Sociais', value: faturamentoSocial, pct: receitaIncremental > 0 ? (faturamentoSocial  / receitaIncremental) * 100 : 0, color: '#4ade80' },
                      ].filter(i => i.value > 0);
                      const pctSite      = faturamentoTotal > 0 ? (faturamentoSite      / faturamentoTotal) * 100 : 0;
                      const pctComercial = faturamentoTotal > 0 ? (faturamentoComercial / faturamentoTotal) * 100 : 0;
                      return (
                        <div className="rounded-xl bg-custom-800 border-2 border-custom-500 p-5 flex flex-col xl:flex-row gap-6 shadow-lg">

                          {/* ── col esquerdo+central: cresce ── */}
                          <div className="flex-1 min-w-0 flex flex-col gap-5">

                            {/* Barra dividida */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-semibold">
                                <span className="text-white">
                                  Site {formatCurrency(faturamentoSite)} — {formatPercent(pctSite)}
                                </span>
                                <span className="text-white">
                                  Comercial {formatCurrency(faturamentoComercial)} — {formatPercent(pctComercial)}
                                </span>
                              </div>
                              <div className="h-5 w-full rounded-full bg-custom-700 overflow-hidden flex border border-white">
                                <div
                                  className="h-full transition-all duration-500 rounded-l-full"
                                  style={{ backgroundColor: '#7c3aed', width: `${pctSite}%` }}
                                />
                                <div
                                  className="h-full transition-all duration-500 rounded-r-full"
                                  style={{ backgroundColor: '#059669', width: `${pctComercial}%` }}
                                />
                              </div>
                            </div>

                            {/* Sub-grid: esquerda + central */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                          {/* ── Coluna esquerda: faturamentos ── */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 mb-3">
                              <p className="text-xs font-bold uppercase tracking-widest text-white">Marketing + Comercial</p>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-700/30 border border-amber-600/40 text-amber-400">
                                {formatPercent(participacao)} comercial
                              </span>
                            </div>

                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-custom-200">Faturamento Site</span>
                                <span className="font-bold" style={{ color: '#7c3aed' }}>{formatCurrency(faturamentoSite)}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-custom-200">Faturamento Comercial</span>
                                <span className="font-bold" style={{ color: '#059669' }}>{formatCurrency(faturamentoComercial)}</span>
                              </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-custom-600 flex items-center justify-between">
                              <span className="text-xs text-custom-200">Faturamento Total</span>
                              <span className="text-lg font-bold text-white">{formatCurrency(faturamentoTotal)}</span>
                            </div>
                          </div>

                          {/* ── Coluna central: receita incremental ── */}
                          <div className="space-y-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-custom-200">Receita Incremental Comercial</p>
                            <div className="flex items-end gap-4 flex-wrap">
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-4xl font-extrabold text-white leading-none cursor-help">{formatCurrency(receitaIncremental)}</span>
                                </TooltipTrigger>
                                <TooltipContent className="bg-gray-900 border-gray-700 text-xs max-w-xs">
                                  <div className="space-y-1">
                                    <p className="font-semibold text-violet-400">Receita Incremental Comercial</p>
                                    <p className="text-gray-300">Upsell + Rec PIX + Rec Carrinho + Social</p>
                                    <p className="text-gray-400 text-[10px] mt-1">
                                      {formatCurrency(faturamentoUpsell)} + {formatCurrency(faturamentoPix)} + {formatCurrency(faturamentoCarrinho)} + {formatCurrency(faturamentoSocial)}
                                    </p>
                                  </div>
                                </TooltipContent>
                              </UITooltip>
                              {roi > 0 && (
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help flex items-center gap-1 rounded-full bg-primary/20 border border-primary/40 px-3 py-1 text-sm font-bold text-white">
                                      ROI {roi.toFixed(1)}x
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-gray-900 border-gray-700 text-xs max-w-xs">
                                    <div className="space-y-1">
                                      <p className="font-semibold text-violet-400">ROI do Comercial</p>
                                      <p className="text-gray-300">Receita Incremental ÷ Custo Proporcional ao Período</p>
                                      <p className="text-gray-400 text-[10px] mt-1">{formatCurrency(receitaIncremental)} ÷ {formatCurrency(custoAjustado)} = {roi.toFixed(2)}x</p>
                                      <p className="text-gray-500 text-[10px]">Custo rateado: {custoComercial > 0 ? `R$${custoComercial.toFixed(0)}/mês ÷ dias do mês × ${diasPeriodo} dias` : 'sem custo cadastrado'}</p>
                                    </div>
                                  </TooltipContent>
                                </UITooltip>
                              )}
                            </div>
                            <div className="space-y-2 pt-1">
                              {heroItems.map((item) => (
                                <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                    <span className="text-custom-200 truncate">{item.label}</span>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <UITooltip>
                                      <TooltipTrigger asChild>
                                        <span className="font-bold cursor-help" style={{ color: item.color }}>{formatPercent(item.pct)}</span>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-gray-900 border-gray-700 text-xs max-w-xs">
                                        <div className="space-y-1">
                                          <p className="font-semibold" style={{ color: item.color }}>Participação — {item.label}</p>
                                          <p className="text-gray-300">Faturamento {item.label} ÷ Receita Incremental × 100</p>
                                          <p className="text-gray-400 text-[10px] mt-1">{formatCurrency(item.value)} ÷ {formatCurrency(receitaIncremental)} × 100 = {formatPercent(item.pct)}</p>
                                        </div>
                                      </TooltipContent>
                                    </UITooltip>
                                    <span className="text-custom-200 text-xs w-24 text-right">{formatCurrency(item.value)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                            </div>{/* fecha sub-grid */}
                          </div>{/* fecha col-span-2 */}

                          {/* ── Coluna direita: donut ── */}
                          <div className="flex-shrink-0 flex flex-col items-center w-[250px] justify-center">
                            <div className="relative h-[240px] w-[240px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <defs>
                                    <filter id="pie-shadow-hero" x="-20%" y="-20%" width="140%" height="140%">
                                      <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(0,0,0,0.28)" />
                                    </filter>
                                    {origemData.map((entry, i) => {
                                      const color = heroItems[i]?.color ?? entry.color;
                                      return (
                                        <linearGradient key={i} id={`hero-pie-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="0%" stopColor={color} stopOpacity={0.62} />
                                          <stop offset="100%" stopColor={color} stopOpacity={1} />
                                        </linearGradient>
                                      );
                                    })}
                                  </defs>
                                  <Pie
                                    data={origemData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%" cy="50%"
                                    innerRadius={80} outerRadius={118}
                                    paddingAngle={3}
                                    stroke="white" strokeWidth={2}
                                    startAngle={90} endAngle={-270}
                                    filter="url(#pie-shadow-hero)"
                                  >
                                    {origemData.map((_, i) => (
                                      <Cell key={`hero-pie-${i}`} fill={`url(#hero-pie-grad-${i})`} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    wrapperStyle={{ zIndex: 50 }}
                                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: 12 }}
                                    formatter={(value: any) => [formatCurrency(Number(value)), '']}
                                    labelFormatter={() => ''}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[10px] text-custom-200 uppercase tracking-wider">Total</span>
                                <span className="text-base font-extrabold text-white leading-tight text-center px-2">{formatCurrency(receitaIncremental)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── RESUMO RECUPERAÇÃO: removido – mantido apenas o formato compacto abaixo ── */}
                    {false && (() => {
                      const _pixTotal    = Number(pixMetrics?.total_periodo ?? 0);
                      const _pixRec      = Number(pixMetrics?.total_vendidos_periodo ?? 0);
                      return (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {/* Comercial Rec PIX */}
                          <div className="rounded-xl bg-custom-800 border-2 border-custom-600 border p-0 space-y-3">
                            <p className="text-[15px] font-bold px-4 pt-4 uppercase tracking-widest text-white">Comercial Rec PIX</p>
                            <div className="border-t border-custom-600 bg-custom-800/60 p-3 grid grid-cols-2 gap-3 divide-x divide-custom-600/40">
                              {/* Coluna esquerda */}
                              <div className="space-y-3 pr-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <Zap className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white leading-tight">PIX Cancelados</span>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <span className="text-sm font-bold text-white">{_pixTotal}</span>
                                    <span className="text-[10px] text-custom-200 ml-0.5">QTD</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <CreditCard className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white leading-tight">PIX Recuperados</span>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <span className="text-sm font-bold text-white">{_pixRec}</span>
                                    <span className="text-[10px] text-custom-200 ml-0.5">QTD</span>
                                  </div>
                                </div>
                              </div>
                              {/* Coluna direita */}
                              <div className="space-y-3 pl-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <RefreshCw className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white leading-tight">Taxa Rec PIX</span>
                                  </div>
                                  <span className="text-sm font-bold text-white flex-shrink-0">{formatPercent(taxaPix)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white leading-tight">Ticket Médio</span>
                                  </div>
                                  <span className="text-sm font-bold text-white flex-shrink-0">{formatCurrency(ticketPix)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Comercial Rec Carrinho */}
                          <div className="rounded-xl bg-custom-800 border-2 border-custom-600 space-y-3">
                            <p className="text-[15px] font-bold px-4 pt-4 uppercase tracking-widest text-white">Comercial Rec Carrinho</p>
                            <div className="border-t border-custom-600 bg-custom-800/60 p-3 grid grid-cols-2 gap-3 divide-x divide-custom-600/40">
                              {/* Coluna esquerda */}
                              <div className="space-y-3 pr-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <ShoppingCart className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white leading-tight">Carrinhos Abandonados</span>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <span className="text-sm font-bold text-white">{totalEntCarrinho}</span>
                                    <span className="text-[10px] text-custom-200 ml-0.5">QTD</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <CreditCard className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white leading-tight">Carrinhos Recuperados</span>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <span className="text-sm font-bold text-white">{totalVendCarrinho}</span>
                                    <span className="text-[10px] text-custom-200 ml-0.5">QTD</span>
                                  </div>
                                </div>
                              </div>
                              {/* Coluna direita */}
                              <div className="space-y-3 pl-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <RefreshCw className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white leading-tight">Taxa Rec Carrinho</span>
                                  </div>
                                  <span className="text-sm font-bold text-white flex-shrink-0">{formatPercent(taxaCarrinho)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <Mail className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white font-semibold leading-tight">{formatCurrency(faturamentoCarrinho)}</span>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <span className="text-sm font-bold text-white">{totalVendCarrinho}</span>
                                    <span className="text-[10px] text-custom-200 ml-0.5">QTD</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}




                    {/* == LINHA 2: PIX detalhado + WhatsApp — removido, substituído pelo formato compacto == */}
                    {false && (() => {
                      const _leadsS   = Number(whatsappMetrics?.total_periodo ?? 0);
                      const _vendS    = Number(whatsappMetrics?.total_vendidos_periodo ?? 0);
                      const _naoConvS = _leadsS - _vendS;
                      const _pctConv  = _leadsS > 0 ? (_vendS / _leadsS) * 100 : 0;
                      const _pctNao   = _leadsS > 0 ? (_naoConvS / _leadsS) * 100 : 0;
                      const _pixRec   = Number(pixMetrics?.total_vendidos_periodo ?? 0);
                      return (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

                          {/* ── Comercial Rec PIX (detalhado) ── */}
                          <div className="rounded-xl bg-custom-800 border-2 border-custom-600 space-y-0">
                            <p className="text-[15px] font-bold px-4 pt-4 pb-3 uppercase tracking-widest text-white">Comercial Rec PIX</p>
                            {/* Linha topo: 2 stats inline */}
                            <div className="border-t border-custom-600 bg-custom-800/60 px-3 pt-3 pb-2 grid grid-cols-2 gap-3 divide-x divide-custom-600/40">
                              <div className="flex items-center justify-between gap-2 pr-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                    <Zap className="h-3.5 w-3.5 text-white" />
                                  </span>
                                  <span className="text-[14px] text-white leading-tight">PIX Recuperados</span>
                                </div>
                                <div className="flex-shrink-0 text-right">
                                  <span className="text-sm font-bold text-white">{_pixRec}</span>
                                  <span className="text-[10px] text-custom-200 ml-0.5">QTD</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 pl-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                    <CreditCard className="h-3.5 w-3.5 text-white" />
                                  </span>
                                  <span className="text-[14px] text-white leading-tight">Ticket Médio</span>
                                </div>
                                <span className="text-sm font-bold text-white flex-shrink-0">{formatCurrency(ticketPix)}</span>
                              </div>
                            </div>
                            {/* Corpo: métricas + barra */}
                            <div className="px-3 pb-3 grid grid-cols-2 gap-3 divide-x divide-custom-600/40">
                              {/* Coluna esquerda */}
                              <div className="space-y-2 pr-2 pt-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/70 flex-shrink-0">
                                      <TrendingUp className="h-3 w-3 text-white" />
                                    </span>
                                    <span className="text-[13px] text-custom-200 leading-tight">Ticket Médio Rec PIX</span>
                                  </div>
                                  <span className="text-sm font-bold text-white flex-shrink-0">{formatCurrency(ticketPix)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/70 flex-shrink-0">
                                      <DollarSign className="h-3 w-3 text-white" />
                                    </span>
                                    <span className="text-[13px] text-custom-200 leading-tight">Faturamento Total Rec PIX</span>
                                  </div>
                                  <span className="text-sm font-bold text-white flex-shrink-0">{formatCurrency(faturamentoPix)}</span>
                                </div>
                              </div>
                              {/* Coluna direita */}
                              <div className="space-y-2 pl-2 pt-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[13px] text-custom-200">Faturamento Total</span>
                                  <span className="text-sm font-bold text-white">{formatCurrency(faturamentoPix)}</span>
                                </div>
                                <div className="space-y-1">
                                  <div className="h-1.5 w-full rounded-full bg-custom-700 overflow-hidden">
                                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, taxaPix)}%` }} />
                                  </div>
                                  <span className="text-[12px] text-custom-200">{formatPercent(taxaPix)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* ── WhatsApp / Rede Social ── */}
                          <div className="rounded-xl bg-custom-800 border-2 border-custom-600 space-y-3">
                            <p className="text-[15px] font-bold px-4 pt-4 uppercase tracking-widest text-white">WhatsApp - Rede Social</p>
                            <div className="border-t border-custom-600 bg-custom-800/60 p-3 grid grid-cols-2 gap-3 divide-x divide-custom-600/40">
                              {/* Coluna esquerda */}
                              <div className="space-y-3 pr-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <Users className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white leading-tight">Leads Captados</span>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <span className="text-sm font-bold text-white">{_leadsS}</span>
                                    <span className="text-[10px] text-custom-200 ml-0.5">QTD</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <MessageCircle className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white leading-tight">
                                      Convertidos{' '}
                                      <span className="text-custom-200 text-[12px]">({_pctConv.toFixed(1)}%)</span>
                                    </span>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <span className="text-sm font-bold text-white">{_vendS}</span>
                                    <span className="text-[10px] text-custom-200 ml-0.5">QTD</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <RefreshCw className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white leading-tight">
                                      Não Conv.{' '}
                                      <span className="text-custom-200 text-[12px]">({_pctNao.toFixed(1)}%)</span>
                                    </span>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <span className="text-sm font-bold text-white">{_naoConvS}</span>
                                    <span className="text-[10px] text-custom-200 ml-0.5">QTD</span>
                                  </div>
                                </div>
                                <div className="pt-1">
                                  <div className="h-1.5 w-full rounded-full bg-custom-700 overflow-hidden">
                                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, _pctConv)}%` }} />
                                  </div>
                                  <span className="text-[12px] text-custom-200 mt-0.5 block">{formatCurrency(faturamentoSocial)}</span>
                                </div>
                              </div>
                              {/* Coluna direita */}
                              <div className="space-y-3 pl-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <TrendingUp className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white leading-tight">Taxa Conversão</span>
                                  </div>
                                  <span className="text-sm font-bold text-white flex-shrink-0">{formatPercent(taxaSocial)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <CreditCard className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white leading-tight">Ticket Médio</span>
                                  </div>
                                  <span className="text-sm font-bold text-white flex-shrink-0">{formatCurrency(ticketSocial)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary flex-shrink-0">
                                      <DollarSign className="h-3.5 w-3.5 text-white" />
                                    </span>
                                    <span className="text-[14px] text-white leading-tight">Faturamento Total</span>
                                  </div>
                                  <span className="text-sm font-bold text-white flex-shrink-0">{formatCurrency(faturamentoSocial)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>
                      );
                    })()}

                    {/* ── UPSELL YAMPI ─────────────────────────────────────────── */}
                    <div className="rounded-xl bg-custom-800 border-2 border-custom-600 p-5">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-custom-200 mb-4">Upsell Yampi</p>

                      <div className="flex gap-4 items-stretch">

                        {/* ── Esquerda: métricas + detalhamento ── */}
                        <div className="flex-1 min-w-0 space-y-4">

                          {/* Linha 1: métricas gerais */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-xl bg-custom-700/40 border border-custom-600 px-4 py-3">
                              <p className="text-[11px] text-custom-200 uppercase tracking-wide">Taxa Upsell</p>
                              <p className="text-2xl font-bold text-white">{formatPercent(taxaUpsell)}</p>
                              <p className="text-[12px] text-custom-200 mt-0.5">{yampiUpsellMetrics?.pedidos_com_inclusao_itens ?? 0} de {totalPedidosYampi} pedidos</p>
                            </div>
                            <div className="rounded-xl bg-custom-700/40 border border-custom-600 px-4 py-3">
                              <p className="text-[11px] text-custom-200 uppercase tracking-wide">Ticket Médio Upsell</p>
                              <p className="text-2xl font-bold text-white">{formatCurrency(ticketUpsell)}</p>
                              <p className="text-[12px] text-custom-200 mt-0.5">Sem upsell: {formatCurrency(yampiUpsellMetrics?.ticket_medio_sem_inclusao)}</p>
                            </div>
                            <div className="rounded-xl bg-custom-700/40 border border-custom-600 px-4 py-3">
                              <p className="text-[11px] text-custom-200 uppercase tracking-wide">Faturamento Upsell</p>
                              <p className="text-2xl font-bold text-white">{formatCurrency(faturamentoUpsell)}</p>
                              <p className="text-[12px] text-custom-200 mt-0.5">{totalPedidosYampi} × {formatPercent(taxaUpsell)} × {formatCurrency(ticketUpsell)}</p>
                            </div>
                          </div>

                          {/* Separador */}
                          <div className="flex items-center gap-2">
                            <div className="h-px flex-1 bg-custom-600" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-custom-200/60 px-2">Detalhamento por tipo</span>
                            <div className="h-px flex-1 bg-custom-600" />
                          </div>

                          {/* Linha 2: Upsell puro vs Incremento puro vs Ambos vs Sem alteração */}
                          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                            <div className="rounded-xl bg-custom-700/40 border border-custom-600 px-4 py-3">
                              <p className="text-[11px] text-custom-200 uppercase tracking-wide">Up-sell (upgrade)</p>
                              <p className="text-2xl font-bold text-white">{yampiUpsellIncrementoMetrics?.pedidos_com_upsell ?? 0}</p>
                              <p className="text-[12px] text-custom-200 mt-0.5">{formatPercent(yampiUpsellIncrementoMetrics?.taxa_upsell_pct ?? 0)} dos pedidos</p>
                              <p className="text-[13px] text-primary font-semibold mt-1">{formatCurrency(entradaValoresUpsellMetrics?.faturamento_acrescido ?? 0)}</p>
                              <p className="text-[11px] text-custom-200">Ticket após: {formatCurrency(entradaValoresUpsellMetrics?.ticket_medio_depois ?? 0)}</p>
                            </div>
                            <div className="rounded-xl bg-custom-700/40 border border-custom-600 px-4 py-3">
                              <p className="text-[11px] text-custom-200 uppercase tracking-wide">Incremento (novo item)</p>
                              <p className="text-2xl font-bold text-white">{yampiUpsellIncrementoMetrics?.pedidos_com_incremento ?? 0}</p>
                              <p className="text-[12px] text-custom-200 mt-0.5">{formatPercent(yampiUpsellIncrementoMetrics?.taxa_incremento_pct ?? 0)} dos pedidos</p>
                              <p className="text-[13px] text-primary font-semibold mt-1">{formatCurrency(yampiUpsellIncrementoMetrics?.faturamento_com_incremento ?? 0)}</p>
                              <p className="text-[11px] text-custom-200">Ticket: {formatCurrency(yampiUpsellIncrementoMetrics?.ticket_medio_com_incremento ?? 0)}</p>
                            </div>
                            <div className="rounded-xl bg-custom-700/40 border border-custom-600 px-4 py-3">
                              <p className="text-[11px] text-custom-200 uppercase tracking-wide">Ambos</p>
                              <p className="text-2xl font-bold text-white">{yampiUpsellIncrementoMetrics?.pedidos_com_ambos ?? 0}</p>
                              <p className="text-[12px] text-custom-200 mt-0.5">{formatPercent(yampiUpsellIncrementoMetrics?.taxa_ambos_pct ?? 0)} dos pedidos</p>
                              <p className="text-[11px] text-custom-200 mt-1">Upsell + novo item</p>
                            </div>
                            <div className="rounded-xl bg-custom-700/40 border border-custom-600 px-4 py-3">
                              <p className="text-[11px] text-custom-200 uppercase tracking-wide">Sem alteração</p>
                              <p className="text-2xl font-bold text-white">{yampiUpsellIncrementoMetrics?.pedidos_sem_alteracao ?? 0}</p>
                              <p className="text-[12px] text-custom-200 mt-0.5">{formatPercent(yampiUpsellIncrementoMetrics?.taxa_sem_alteracao_pct ?? 0)} dos pedidos</p>
                              <p className="text-[13px] text-primary font-semibold mt-1">{formatCurrency(yampiUpsellIncrementoMetrics?.faturamento_sem_alteracao ?? 0)}</p>
                              <p className="text-[11px] text-custom-200">Ticket: {formatCurrency(yampiUpsellIncrementoMetrics?.ticket_medio_sem_alteracao ?? 0)}</p>
                            </div>
                          </div>
                        </div>

                        {/* ── Direita: Top 3 Produtos (ranking destacado) ── */}
                        <div className="flex-shrink-0 w-80 rounded-xl bg-custom-700/40 border-2 border-primary px-5 py-5 flex flex-col gap-4">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/30">
                              <TrendingUp className="h-4.5 w-4.5 text-primary" />
                            </span>
                            <p className="text-[13px] font-bold uppercase tracking-widest text-white">Top 3 Produtos</p>
                          </div>
                          <div className="h-px bg-custom-600" />
                          {topProdutosUpsell.length > 0 ? (
                            <div className="flex flex-col gap-4 flex-1">
                              {topProdutosUpsell.map((produto, idx) => (
                                <div key={produto.produto_id} className="flex gap-3 items-start">
                                  <span className={`flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-full text-[14px] font-extrabold ${
                                    idx === 0 ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40' :
                                    idx === 1 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/40' :
                                                'bg-orange-700/20 text-orange-400 border border-orange-700/40'
                                  }`}>
                                    {idx + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold text-white leading-tight line-clamp-2 truncate">{produto.produto_nome}</p>
                                    <p className="text-[14px] text-primary font-bold mt-1.5">{formatCurrency(produto.valor_total)}</p>
                                    <p className="text-[11px] text-custom-200 mt-0.5">{produto.total_inclusoes}x · {formatCurrency(produto.ticket_medio)}/un</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center justify-center">
                              <p className="text-sm text-custom-200/60 text-center">Sem dados<br/>no período</p>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>

                    {/* ── REC PIX: linha 5 cards ───────────────────────────────── */}
                    {(() => {
                      const _pixTotal = Number(pixMetrics?.total_periodo ?? 0);
                      const _pixRec2  = Number(pixMetrics?.total_vendidos_periodo ?? 0);
                      return (
                        <div className="rounded-xl bg-custom-800 border-2 border-custom-600 p-4 space-y-3">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-custom-200">REC PIX</p>
                          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
                            {/* Pix Cancelados */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <Zap className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Pix Cancelados</p>
                                <p className="text-2xl font-bold text-white leading-tight">{_pixTotal}</p>
                              </div>
                            </div>
                            {/* Pix Recuperados */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Pix Recuperados</p>
                                <p className="text-2xl font-bold text-white leading-tight">{_pixRec2}</p>
                              </div>
                            </div>
                            {/* Taxa Rec Pix */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <TrendingUp className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Taxa Rec Pix</p>
                                <p className="text-2xl font-bold text-white leading-tight">{formatPercent(taxaPix)}</p>
                              </div>
                            </div>
                            {/* Ticket Médio */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <CreditCard className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Ticket Médio</p>
                                <p className="text-xl font-bold text-white leading-tight">{formatCurrency(ticketPix)}</p>
                              </div>
                            </div>
                            {/* Faturamento Rec Pix */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <DollarSign className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Faturamento Rec Pix</p>
                                <p className="text-xl font-bold text-white leading-tight">{formatCurrency(faturamentoPix)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── REC CARRINHO: linha 5 cards ──────────────────────────── */}
                    <div className="rounded-xl bg-custom-800 border-2 border-custom-600 p-4 space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-custom-200">REC CARRINHO</p>
                      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
                        {/* Carrinhos Abandonados */}
                        <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                          <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                            <ShoppingCart className="h-4 w-4 text-primary" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12px] text-custom-200 leading-tight">Carrinhos Abandonados</p>
                            <p className="text-2xl font-bold text-white leading-tight">{totalEntCarrinho}</p>
                          </div>
                        </div>
                        {/* Carrinhos Recuperados */}
                        <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                          <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12px] text-custom-200 leading-tight">Carrinhos Recuperados</p>
                            <p className="text-2xl font-bold text-white leading-tight">{totalVendCarrinho}</p>
                          </div>
                        </div>
                        {/* Taxa Rec Carrinho */}
                        <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                          <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                            <TrendingUp className="h-4 w-4 text-primary" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12px] text-custom-200 leading-tight">Taxa Rec Carrinho</p>
                            <p className="text-2xl font-bold text-white leading-tight">{formatPercent(taxaCarrinho)}</p>
                          </div>
                        </div>
                        {/* Ticket Médio */}
                        <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                          <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                            <CreditCard className="h-4 w-4 text-primary" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12px] text-custom-200 leading-tight">Ticket Médio</p>
                            <p className="text-xl font-bold text-white leading-tight">{formatCurrency(ticketCarrinho)}</p>
                          </div>
                        </div>
                        {/* Faturamento Rec Carrinho */}
                        <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                          <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                            <DollarSign className="h-4 w-4 text-primary" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12px] text-custom-200 leading-tight">Faturamento Rec Carrinho</p>
                            <p className="text-xl font-bold text-white leading-tight">{formatCurrency(faturamentoCarrinho)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── WHATSAPP + REDES SOCIAIS: linha 5 cards ──────────────── */}
                    {(() => {
                      const _leadsS2   = Number(whatsappMetrics?.total_periodo ?? 0);
                      const _vendS2    = Number(whatsappMetrics?.total_vendidos_periodo ?? 0);
                      const recPorLead = _leadsS2 > 0 ? faturamentoSocial / _leadsS2 : 0;
                      return (
                        <div className="rounded-xl bg-custom-800 border-2 border-custom-600 p-4 space-y-3">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-custom-200">WHATSAPP + REDES SOCIAIS</p>
                          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
                            {/* Leads Captados */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <Users className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Leads Captados</p>
                                <p className="text-2xl font-bold text-white leading-tight">{_leadsS2}</p>
                              </div>
                            </div>
                            {/* Taxa Conversão */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <TrendingUp className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Taxa Conversão</p>
                                <p className="text-2xl font-bold text-white leading-tight">{formatPercent(taxaSocial)}</p>
                              </div>
                            </div>
                            {/* Ticket Médio */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <CreditCard className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Ticket Médio</p>
                                <p className="text-xl font-bold text-white leading-tight">{formatCurrency(ticketSocial)}</p>
                              </div>
                            </div>
                            {/* Faturamento Total */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <DollarSign className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Faturamento Total</p>
                                <p className="text-xl font-bold text-white leading-tight">{formatCurrency(faturamentoSocial)}</p>
                              </div>
                            </div>
                            {/* Receita por Lead — destaque roxo */}
                            <div className="rounded-xl bg-primary border border-primary px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-white/15 flex-shrink-0 mt-0.5">
                                <TrendingUp className="h-4 w-4 text-white" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-white/80 leading-tight">Receita por Lead</p>
                                <p className="text-xl font-bold text-white leading-tight">{formatCurrency(recPorLead)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── TYPEBOTS (dinâmico) ───────────────────────────────────── */}
                    {typebotsMetrics.length > 0 && typebotsMetrics.map((tbMetric) => {
                      const leadsTypeBot = Number(tbMetric.total_periodo ?? 0);
                      const vendidosTypeBot = Number(tbMetric.total_vendidos_periodo ?? 0);
                      const taxaTypeBot = Number(tbMetric.taxa_conversao_periodo ?? 0);
                      const ticketTypeBot = Number(tbMetric.ticket_medio_periodo ?? 0);
                      const faturamentoTypeBot = Number(tbMetric.valor_total_periodo ?? 0);
                      const naoConvTypeBot = leadsTypeBot - vendidosTypeBot;
                      const recPorLeadTypeBot = leadsTypeBot > 0 ? faturamentoTypeBot / leadsTypeBot : 0;

                      return (
                        <div key={tbMetric.tipo_de_lead_id} className="rounded-xl bg-custom-800 border-2 border-custom-600 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-custom-200">
                              {tbMetric.tipo_de_lead_nome} (TypeBot {tbMetric.id_type})
                            </p>
                            <Badge variant="secondary" className="text-[10px] bg-custom-700 text-white border-custom-600">Type ID: {tbMetric.id_type}</Badge>
                          </div>
                          <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
                            {/* Leads Captados */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <Users className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Leads Captados</p>
                                <p className="text-2xl font-bold text-white leading-tight">{leadsTypeBot}</p>
                              </div>
                            </div>
                            {/* Taxa Conversão */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <TrendingUp className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Taxa Conversão</p>
                                <p className="text-2xl font-bold text-white leading-tight">{formatPercent(taxaTypeBot)}</p>
                              </div>
                            </div>
                            {/* Ticket Médio */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <CreditCard className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Ticket Médio</p>
                                <p className="text-xl font-bold text-white leading-tight">{formatCurrency(ticketTypeBot)}</p>
                              </div>
                            </div>
                            {/* Faturamento Total */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <DollarSign className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Faturamento Total</p>
                                <p className="text-xl font-bold text-white leading-tight">{formatCurrency(faturamentoTypeBot)}</p>
                              </div>
                            </div>
                            {/* Receita por Lead — destaque roxo */}
                            <div className="rounded-xl bg-primary border border-primary px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-white/15 flex-shrink-0 mt-0.5">
                                <TrendingUp className="h-4 w-4 text-white" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-white/80 leading-tight">Receita por Lead</p>
                                <p className="text-xl font-bold text-white leading-tight">{formatCurrency(recPorLeadTypeBot)}</p>
                              </div>
                            </div>
                            {/* Não Convertidos */}
                            <div className="rounded-xl bg-custom-800 border border-custom-600 px-4 py-3 flex items-start gap-3">
                              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                                <MessageCircle className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-custom-200 leading-tight">Não Convertidos</p>
                                <p className="text-2xl font-bold text-white leading-tight">{naoConvTypeBot}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

