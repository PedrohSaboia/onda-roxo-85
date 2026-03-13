import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { FaCalendarAlt } from 'react-icons/fa';
import { format, parseISO, startOfMonth, subMonths, isSameDay, isWithinInterval, differenceInDays, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ComercialSidebar from '@/components/layout/ComercialSidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

type DailyChartStyle = 'linha' | 'barras' | 'pizza';

export function DashboardComercial() {
  const navigate = useNavigate();
  const { empresaId } = useAuth();

  const [pixMetrics, setPixMetrics] = useState<PixMetricsRow | null>(null);
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
            p_data_inicio: startDate.toISOString(),
            p_data_fim: endDate.toISOString(),
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
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
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

      <div className="flex-1 overflow-y-auto bg-muted/10">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Dashboard Comercial
            </h1>

            <div className="flex flex-col items-end gap-1">
                <Popover open={dashboardPickerOpen} onOpenChange={setDashboardPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button className="w-fit flex items-center justify-center gap-2 bg-custom-600 text-white hover:bg-custom-700">
                      <FaCalendarAlt className="h-4 w-4" />
                      <span className="text-sm">{format(parseISO(dashboardDateStart), 'dd/MM/yy', { locale: ptBR })} → {format(parseISO(dashboardDateEnd), 'dd/MM/yy', { locale: ptBR })}</span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
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
                <p className="text-xs text-muted-foreground">
                  Período aplicado: {format(parseISO(`${dashboardRangeApplied.start}T00:00:00`), 'dd/MM/yyyy')} até {format(parseISO(`${dashboardRangeApplied.end}T00:00:00`), 'dd/MM/yyyy')}
                </p>
              </div>
          </div>

          {loadingPixDashboard ? (
            <Card>
              <CardContent className="py-10 text-sm text-muted-foreground">Carregando métricas...</CardContent>
            </Card>
          ) : pixDashboardError ? (
            <Card>
              <CardContent className="py-10 text-sm text-red-500">Erro ao carregar dashboard: {pixDashboardError}</CardContent>
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

                const totalEntCarrinho     = carrinhoDailySeries.reduce((a, r) => a + Number(r.total_entradas || 0), 0);
                const totalVendCarrinho    = carrinhoDailySeries.reduce((a, r) => a + Number(r.total_vendidos || 0), 0);
                const faturamentoCarrinho  = carrinhoDailySeries.reduce((a, r) => a + Number(r.valor_total   || 0), 0);
                const taxaCarrinho         = totalEntCarrinho > 0 ? (totalVendCarrinho / totalEntCarrinho) * 100 : 0;
                const ticketCarrinho       = totalVendCarrinho > 0 ? faturamentoCarrinho / totalVendCarrinho : 0;

                const faturamentoSocial    = Number(whatsappMetrics?.valor_total_periodo ?? 0);
                const taxaSocial           = Number(whatsappMetrics?.taxa_conversao_periodo ?? 0);
                const ticketSocial         = Number(whatsappMetrics?.ticket_medio_periodo ?? 0);
                const leadsSocial          = Number(whatsappMetrics?.total_periodo ?? 0);

                const taxaUpsell           = Number(yampiUpsellMetrics?.taxa_inclusao_itens_pct ?? 0);
                const totalPedidosYampi    = Number(yampiUpsellMetrics?.total_pedidos_yampi ?? 0);
                // Financeiro de up-sell: vem exclusivamente de entrada_valores
                const faturamentoUpsell    = Number(entradaValoresUpsellMetrics?.faturamento_acrescido ?? 0);
                const ticketUpsell         = Number(entradaValoresUpsellMetrics?.ticket_medio_depois ?? 0);

                const faturamentoComercial = faturamentoPix + faturamentoCarrinho + faturamentoSocial;
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
                      const barMax = Math.max(faturamentoSite, faturamentoComercial, receitaIncremental, 1);
                      const heroItems = [
                        { label: 'Upsell',   value: faturamentoUpsell,   pct: receitaIncremental > 0 ? (faturamentoUpsell  / receitaIncremental) * 100 : 0, color: '#a78bfa' },
                        { label: 'Rec PIX',  value: faturamentoPix,       pct: receitaIncremental > 0 ? (faturamentoPix     / receitaIncremental) * 100 : 0, color: '#34d399' },
                        { label: 'Rec Carrinho', value: faturamentoCarrinho, pct: receitaIncremental > 0 ? (faturamentoCarrinho / receitaIncremental) * 100 : 0, color: '#22d3ee' },
                        { label: 'Redes Sociais', value: faturamentoSocial, pct: receitaIncremental > 0 ? (faturamentoSocial  / receitaIncremental) * 100 : 0, color: '#4ade80' },
                      ].filter(i => i.value > 0);
                      return (
                        <div className="rounded-xl bg-white border border-slate-200 p-5 grid grid-cols-1 xl:grid-cols-3 gap-6 shadow-lg">

                          {/* ── Coluna esquerda: faturamentos ── */}
                          <div className="space-y-3">
                            <p className="text-xs font-bold uppercase tracking-widest text-purple-600 mb-3">Marketing + Comercial</p>

                            {[
                              { label: 'Faturamento Site',      value: faturamentoSite,      color: '#7c3aed' },
                              { label: 'Faturamento Comercial', value: faturamentoComercial, color: '#059669' },
                              { label: 'Participação Comercial',value: null,                 color: '#b45309', pct: participacao },
                            ].map((row) => (
                              <div key={row.label} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-slate-600">{row.label}</span>
                                  <span className="font-bold" style={{ color: row.color }}>
                                    {row.value !== null ? formatCurrency(row.value) : formatPercent(row.pct)}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      backgroundColor: row.color,
                                      width: row.value !== null
                                        ? `${Math.min(100, (row.value / barMax) * 100)}%`
                                        : `${Math.min(100, row.pct ?? 0)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}

                            <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                              <span className="text-xs text-slate-500">Faturamento Total</span>
                              <span className="text-lg font-bold text-slate-900">{formatCurrency(faturamentoTotal)}</span>
                            </div>
                          </div>

                          {/* ── Coluna central: receita incremental ── */}
                          <div className="space-y-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-purple-600">Receita Incremental Comercial</p>
                            <div className="flex items-end gap-4 flex-wrap">
                              <span className="text-4xl font-extrabold text-slate-900 leading-none">{formatCurrency(receitaIncremental)}</span>
                              {roi > 0 && (
                                <span className="flex items-center gap-1 rounded-full bg-purple-100 border border-purple-300 px-3 py-1 text-sm font-bold text-purple-700">
                                  ROI {roi.toFixed(1)}x
                                </span>
                              )}
                            </div>
                            <div className="space-y-2 pt-1">
                              {heroItems.map((item) => (
                                <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                    <span className="text-slate-600 truncate">{item.label}</span>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="font-bold" style={{ color: item.color }}>{formatPercent(item.pct)}</span>
                                    <span className="text-slate-500 text-xs w-24 text-right">{formatCurrency(item.value)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* ── Coluna direita: donut ── */}
                          <div className="flex flex-col items-center justify-center">
                            <p className="text-xs font-bold uppercase tracking-widest text-purple-600 mb-2 self-start">Distribuição</p>
                            <div className="relative h-[180px] w-[180px]">
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
                                    innerRadius={55} outerRadius={84}
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
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total</span>
                                <span className="text-base font-extrabold text-slate-900 leading-tight text-center px-2">{formatCurrency(receitaIncremental)}</span>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 self-start w-full">
                              {heroItems.map((item) => (
                                <div key={item.label} className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                  <span className="text-[11px] text-slate-500 truncate">{item.label}</span>
                                  <span className="text-[11px] font-bold ml-auto" style={{ color: item.color }}>{item.pct.toFixed(0)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── LINHA 1: Faturamento ─────────────────────────────────── */}
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                      <Card className="border-l-4 border-l-violet-500 shadow-md">
                        <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Faturamento Site</CardTitle></CardHeader>
                        <CardContent className="pt-0">
                          <div className="text-2xl font-bold text-violet-700 dark:text-violet-300">{formatCurrency(faturamentoSite)}</div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Total Yampi no período</p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-sky-500 shadow-md">
                        <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Faturamento Comercial</CardTitle></CardHeader>
                        <CardContent className="pt-0">
                          <div className="text-2xl font-bold text-sky-700 dark:text-sky-300">{formatCurrency(faturamentoComercial)}</div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">PIX + Carrinho + Social</p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-emerald-500 shadow-md">
                        <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Faturamento Total</CardTitle></CardHeader>
                        <CardContent className="pt-0">
                          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(faturamentoTotal)}</div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Site + Comercial</p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-amber-500 shadow-md">
                        <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Participação Comercial</CardTitle></CardHeader>
                        <CardContent className="pt-0">
                          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{formatPercent(participacao)}</div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Comercial ÷ Total</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* ── GRÁFICOS CENTRAIS ─────────────────────────────────────── */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {/* Origem da Receita Comercial */}
                      <Card className="border shadow-xl overflow-hidden flex flex-col">
                        <CardHeader className="pb-1 pt-5 px-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base font-bold">Origem da Receita Comercial</CardTitle>
                              <p className="text-xs text-muted-foreground mt-0.5">Distribuição por canal no período</p>
                            </div>
                            <div className="text-right">
                              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Total</div>
                              <div className="text-lg font-bold">{formatCurrency(receitaIncremental)}</div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="px-6 pb-6 pt-2 flex-1 flex flex-col justify-center">
                          {origemData.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período.</p>
                          ) : (
                            <div className="flex flex-col lg:flex-row items-center gap-6 mt-2">
                              {/* Donut chart */}
                              <div className="relative h-[220px] w-[220px] flex-shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <defs>
                                      <filter id="pie-shadow-origem" x="-20%" y="-20%" width="140%" height="140%">
                                        <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="rgba(0,0,0,0.28)" />
                                      </filter>
                                      {origemData.map((entry, index) => (
                                        <linearGradient key={index} id={`origem-pie-grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="0%" stopColor={entry.color} stopOpacity={0.62} />
                                          <stop offset="100%" stopColor={entry.color} stopOpacity={1} />
                                        </linearGradient>
                                      ))}
                                    </defs>
                                    <Pie
                                      data={origemData}
                                      dataKey="value"
                                      nameKey="name"
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={68}
                                      outerRadius={100}
                                      paddingAngle={3}
                                      stroke="white" strokeWidth={2}
                                      filter="url(#pie-shadow-origem)"
                                    >
                                      {origemData.map((_, index) => (
                                        <Cell key={`origem-${index}`} fill={`url(#origem-pie-grad-${index})`} />
                                      ))}
                                    </Pie>
                                    <Tooltip
                                      wrapperStyle={{ zIndex: 50 }}
                                      contentStyle={{ borderRadius: 8, fontSize: 13 }}
                                      formatter={(value: any) => [formatCurrency(Number(value)), '']}
                                      labelFormatter={() => ''}
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                                {/* Label central */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Fontes</span>
                                </div>
                              </div>

                              {/* Legenda aprimorada */}
                              <div className="flex-1 space-y-3 w-full">
                                {origemData
                                  .slice()
                                  .sort((a, b) => b.value - a.value)
                                  .map((entry) => {
                                    const pct = receitaIncremental > 0 ? (entry.value / receitaIncremental) * 100 : 0;
                                    return (
                                      <div key={entry.name} className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                                            <span className="text-sm font-semibold truncate">{entry.name}</span>
                                          </div>
                                          <div className="flex items-baseline gap-2 flex-shrink-0">
                                            <span className="text-sm font-bold">{formatCurrency(entry.value)}</span>
                                            <span className="text-[11px] text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                                          </div>
                                        </div>
                                        {/* Barra de progresso */}
                                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                          <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${pct}%`, backgroundColor: entry.color }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Receita Incremental Comercial */}
                      <Card className="border shadow-md">
                        <CardHeader>
                          <CardTitle className="text-base">Receita Incremental Comercial</CardTitle>
                          <p className="text-xs text-muted-foreground">Quanto o comercial cria de dinheiro que não existiria sem a intervenção.</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {[
                            { label: 'Upsell',         value: faturamentoUpsell,  color: 'bg-violet-500', desc: `${totalPedidosYampi} ped × ${formatPercent(taxaUpsell)} × ${formatCurrency(ticketUpsell)}` },
                            { label: '+ PIX Rec.',     value: faturamentoPix,     color: 'bg-blue-500',   desc: `${pixMetrics?.total_vendidos_periodo ?? 0} vendidos` },
                            { label: '+ Carrinho Rec.',value: faturamentoCarrinho,color: 'bg-orange-500', desc: `${totalVendCarrinho} vendidos` },
                            { label: '+ Social',       value: faturamentoSocial,  color: 'bg-emerald-500',desc: `${leadsSocial} leads` },
                          ].map((item) => (
                            <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${item.color}`} />
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold">{item.label}</p>
                                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                                </div>
                              </div>
                              <span className="text-sm font-bold text-right">{formatCurrency(item.value)}</span>
                            </div>
                          ))}
                          <div className="rounded-lg border-2 border-green-500 bg-green-500/20 px-4 py-3 flex items-center justify-between">
                            <span className="font-bold text-base">Receita Incremental</span>
                            <span className="text-xl font-bold text-green-500">{formatCurrency(receitaIncremental)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* ── LINHA 2: Upsell ──────────────────────────────────────── */}
                    <div className="rounded-xl bg-white border border-slate-200 shadow-md p-5 space-y-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Upsell Yampi</p>

                      {/* Linha 1: métricas gerais (legado) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Card className="border-l-4 border-l-violet-500 shadow-sm">
                          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Taxa Upsell</CardTitle></CardHeader>
                          <CardContent className="pt-0">
                            <div className="text-2xl font-bold text-violet-700 dark:text-violet-300">{formatPercent(taxaUpsell)}</div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{yampiUpsellMetrics?.pedidos_com_inclusao_itens ?? 0} de {totalPedidosYampi} pedidos</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-fuchsia-500 shadow-sm">
                          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ticket Médio Upsell</CardTitle></CardHeader>
                          <CardContent className="pt-0">
                            <div className="text-2xl font-bold text-fuchsia-700 dark:text-fuchsia-300">{formatCurrency(ticketUpsell)}</div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Sem upsell: {formatCurrency(yampiUpsellMetrics?.ticket_medio_sem_inclusao)}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-rose-500 shadow-sm">
                          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Faturamento Upsell</CardTitle></CardHeader>
                          <CardContent className="pt-0">
                            <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{formatCurrency(faturamentoUpsell)}</div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{totalPedidosYampi} × {formatPercent(taxaUpsell)} × {formatCurrency(ticketUpsell)}</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Separador */}
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2">Detalhamento por tipo</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>

                      {/* Linha 2: Upsell puro vs Incremento puro vs Ambos vs Sem alteração */}
                      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                        {/* Upsell puro */}
                        <Card className="border-l-4 border-l-purple-500 shadow-md bg-purple-50/30">
                          <CardHeader className="pb-1">
                            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Up-sell (upgrade)</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="text-2xl font-bold text-purple-700">{yampiUpsellIncrementoMetrics?.pedidos_com_upsell ?? 0}</div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{formatPercent(yampiUpsellIncrementoMetrics?.taxa_upsell_pct ?? 0)} dos pedidos</p>
                            <p className="text-[11px] text-purple-600 font-semibold mt-1">{formatCurrency(entradaValoresUpsellMetrics?.faturamento_acrescido ?? 0)}</p>
                            <p className="text-[10px] text-muted-foreground">Ticket após: {formatCurrency(entradaValoresUpsellMetrics?.ticket_medio_depois ?? 0)}</p>
                          </CardContent>
                        </Card>

                        {/* Incremento puro */}
                        <Card className="border-l-4 border-l-sky-500 shadow-md bg-sky-50/30">
                          <CardHeader className="pb-1">
                            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Incremento (novo item)</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="text-2xl font-bold text-sky-700">{yampiUpsellIncrementoMetrics?.pedidos_com_incremento ?? 0}</div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{formatPercent(yampiUpsellIncrementoMetrics?.taxa_incremento_pct ?? 0)} dos pedidos</p>
                            <p className="text-[11px] text-sky-600 font-semibold mt-1">{formatCurrency(yampiUpsellIncrementoMetrics?.faturamento_com_incremento ?? 0)}</p>
                            <p className="text-[10px] text-muted-foreground">Ticket: {formatCurrency(yampiUpsellIncrementoMetrics?.ticket_medio_com_incremento ?? 0)}</p>
                          </CardContent>
                        </Card>

                        {/* Ambos */}
                        <Card className="border-l-4 border-l-amber-500 shadow-md bg-amber-50/30">
                          <CardHeader className="pb-1">
                            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ambos</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="text-2xl font-bold text-amber-700">{yampiUpsellIncrementoMetrics?.pedidos_com_ambos ?? 0}</div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{formatPercent(yampiUpsellIncrementoMetrics?.taxa_ambos_pct ?? 0)} dos pedidos</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Upsell + novo item</p>
                          </CardContent>
                        </Card>

                        {/* Sem alteração */}
                        <Card className="border-l-4 border-l-slate-400 shadow-md bg-slate-50/30">
                          <CardHeader className="pb-1">
                            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Sem alteração</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="text-2xl font-bold text-slate-600">{yampiUpsellIncrementoMetrics?.pedidos_sem_alteracao ?? 0}</div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{formatPercent(yampiUpsellIncrementoMetrics?.taxa_sem_alteracao_pct ?? 0)} dos pedidos</p>
                            <p className="text-[11px] text-slate-500 font-semibold mt-1">{formatCurrency(yampiUpsellIncrementoMetrics?.faturamento_sem_alteracao ?? 0)}</p>
                            <p className="text-[10px] text-muted-foreground">Ticket: {formatCurrency(yampiUpsellIncrementoMetrics?.ticket_medio_sem_alteracao ?? 0)}</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* ── PIX ──────────────────────────────────────────────────── */}
                    {(() => {
                      const leadsPix          = Number(pixMetrics?.total_periodo ?? 0);
                      const vendidosPix       = Number(pixMetrics?.total_vendidos_periodo ?? 0);
                      const naoConvPix        = leadsPix - vendidosPix;
                      const recPorLeadPix     = leadsPix > 0 ? faturamentoPix / leadsPix : 0;
                      return (
                        <div className="rounded-xl bg-white border border-slate-200 shadow-md p-5 space-y-4">
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rec PIX</p>
                          <div className="space-y-3">
                          {/* Linha 1 */}
                          <div className="grid grid-cols-3 gap-3">
                            <Card className="border-l-4 border-l-blue-500 shadow-sm">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Leads Captados</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{leadsPix}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Entradas no período</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-cyan-500 shadow-sm">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Taxa Conversão</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{formatPercent(taxaPix)}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{vendidosPix} convertidos</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-indigo-500 shadow-sm">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ticket Médio</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{formatCurrency(ticketPix)}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Por lead convertido</p>
                              </CardContent>
                            </Card>
                          </div>
                          {/* Linha 2 */}
                          <div className="grid grid-cols-3 gap-3">
                            <Card className="border-l-4 border-l-blue-400 shadow-md bg-blue-50/40 dark:bg-blue-950/20">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Faturamento Total</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">{formatCurrency(faturamentoPix)}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Recuperado no período</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-violet-500 shadow-sm bg-violet-50/40 dark:bg-violet-950/20">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Receita por Lead</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-violet-700 dark:text-violet-300">{formatCurrency(recPorLeadPix)}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Faturamento ÷ leads captados</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-rose-400 shadow-sm bg-rose-50/40 dark:bg-rose-950/20">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Não Convertidos</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{naoConvPix}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{leadsPix > 0 ? formatPercent(100 - taxaPix) : '—'} dos leads perdidos</p>
                              </CardContent>
                            </Card>
                          </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── CARRINHO ─────────────────────────────────────────────── */}
                    {(() => {
                      const naoConvCarrinho    = totalEntCarrinho - totalVendCarrinho;
                      const recPorLeadCarrinho = totalEntCarrinho > 0 ? faturamentoCarrinho / totalEntCarrinho : 0;
                      return (
                        <div className="rounded-xl bg-white border border-slate-200 shadow-md p-5 space-y-4">
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rec Carrinho</p>
                          <div className="space-y-3">
                          {/* Linha 1 */}
                          <div className="grid grid-cols-3 gap-3">
                            <Card className="border-l-4 border-l-orange-500 shadow-sm">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Leads Captados</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{totalEntCarrinho}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Carrinhos no período</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-amber-500 shadow-sm">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Taxa Conversão</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{formatPercent(taxaCarrinho)}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{totalVendCarrinho} convertidos</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-yellow-600 shadow-sm">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ticket Médio</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{formatCurrency(ticketCarrinho)}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Por carrinho convertido</p>
                              </CardContent>
                            </Card>
                          </div>
                          {/* Linha 2 */}
                          <div className="grid grid-cols-3 gap-3">
                            <Card className="border-l-4 border-l-orange-400 shadow-md bg-orange-50/40 dark:bg-orange-950/20">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Faturamento Total</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-orange-800 dark:text-orange-200">{formatCurrency(faturamentoCarrinho)}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Recuperado no período</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-violet-500 shadow-sm bg-violet-50/40 dark:bg-violet-950/20">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Receita por Lead</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-violet-700 dark:text-violet-300">{formatCurrency(recPorLeadCarrinho)}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Faturamento ÷ carrinhos captados</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-rose-400 shadow-sm bg-rose-50/40 dark:bg-rose-950/20">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Não Convertidos</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{naoConvCarrinho}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{totalEntCarrinho > 0 ? formatPercent(100 - taxaCarrinho) : '—'} dos carrinhos perdidos</p>
                              </CardContent>
                            </Card>
                          </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── SOCIAL (WHATSAPP) ─────────────────────────────────────── */}
                    {(() => {
                      const vendidosSocial    = Number(whatsappMetrics?.total_vendidos_periodo ?? 0);
                      const naoConvSocial     = leadsSocial - vendidosSocial;
                      const recPorLeadSocial  = leadsSocial > 0 ? faturamentoSocial / leadsSocial : 0;
                      return (
                        <div className="rounded-xl bg-white border border-slate-200 shadow-md p-5 space-y-4">
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Social (WhatsApp)</p>
                          <div className="space-y-3">
                          {/* Linha 1 */}
                          <div className="grid grid-cols-3 gap-3">
                            <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Leads Captados</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{leadsSocial}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Entradas no período</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-green-600 shadow-sm">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Taxa Conversão</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{formatPercent(taxaSocial)}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{vendidosSocial} convertidos</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-teal-500 shadow-sm">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ticket Médio</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-teal-700 dark:text-teal-300">{formatCurrency(ticketSocial)}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Por lead convertido</p>
                              </CardContent>
                            </Card>
                          </div>
                          {/* Linha 2 */}
                          <div className="grid grid-cols-3 gap-3">
                            <Card className="border-l-4 border-l-emerald-400 shadow-md bg-emerald-50/40 dark:bg-emerald-950/20">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Faturamento Total</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{formatCurrency(faturamentoSocial)}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Recuperado no período</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-violet-500 shadow-sm bg-violet-50/40 dark:bg-violet-950/20">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Receita por Lead</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-violet-700 dark:text-violet-300">{formatCurrency(recPorLeadSocial)}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Faturamento ÷ leads captados</p>
                              </CardContent>
                            </Card>
                            <Card className="border-l-4 border-l-rose-400 shadow-sm bg-rose-50/40 dark:bg-rose-950/20">
                              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Não Convertidos</CardTitle></CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{naoConvSocial}</div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{leadsSocial > 0 ? formatPercent(100 - taxaSocial) : '—'} dos leads perdidos</p>
                              </CardContent>
                            </Card>
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
                        <div key={tbMetric.tipo_de_lead_id} className="rounded-xl bg-white border border-slate-200 shadow-md p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                              {tbMetric.tipo_de_lead_nome} (TypeBot {tbMetric.id_type})
                            </p>
                            <Badge variant="secondary" className="text-[10px]">Type ID: {tbMetric.id_type}</Badge>
                          </div>
                          <div className="space-y-3">
                            {/* Linha 1 */}
                            <div className="grid grid-cols-3 gap-3">
                              <Card className="border-l-4 border-l-blue-500 shadow-sm">
                                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Leads Captados</CardTitle></CardHeader>
                                <CardContent className="pt-0">
                                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{leadsTypeBot}</div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">Entradas no período</p>
                                </CardContent>
                              </Card>
                              <Card className="border-l-4 border-l-cyan-600 shadow-sm">
                                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Taxa Conversão</CardTitle></CardHeader>
                                <CardContent className="pt-0">
                                  <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{formatPercent(taxaTypeBot)}</div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{vendidosTypeBot} convertidos</p>
                                </CardContent>
                              </Card>
                              <Card className="border-l-4 border-l-indigo-500 shadow-sm">
                                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ticket Médio</CardTitle></CardHeader>
                                <CardContent className="pt-0">
                                  <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{formatCurrency(ticketTypeBot)}</div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">Por lead convertido</p>
                                </CardContent>
                              </Card>
                            </div>
                            {/* Linha 2 */}
                            <div className="grid grid-cols-3 gap-3">
                              <Card className="border-l-4 border-l-blue-400 shadow-md bg-blue-50/40 dark:bg-blue-950/20">
                                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Faturamento Total</CardTitle></CardHeader>
                                <CardContent className="pt-0">
                                  <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">{formatCurrency(faturamentoTypeBot)}</div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">Recuperado no período</p>
                                </CardContent>
                              </Card>
                              <Card className="border-l-4 border-l-purple-500 shadow-sm bg-purple-50/40 dark:bg-purple-950/20">
                                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Receita por Lead</CardTitle></CardHeader>
                                <CardContent className="pt-0">
                                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{formatCurrency(recPorLeadTypeBot)}</div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">Faturamento ÷ leads captados</p>
                                </CardContent>
                              </Card>
                              <Card className="border-l-4 border-l-rose-400 shadow-sm bg-rose-50/40 dark:bg-rose-950/20">
                                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Não Convertidos</CardTitle></CardHeader>
                                <CardContent className="pt-0">
                                  <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{naoConvTypeBot}</div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{leadsTypeBot > 0 ? formatPercent(100 - taxaTypeBot) : '—'} dos leads perdidos</p>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* ── RANKINGS por responsável ─────────────────────────────── */}
                    <div className="flex items-center gap-2 pt-1">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-2">Rankings</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <Card className="border shadow-md">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Convertidos PIX por responsável</CardTitle>
                          <p className="text-xs text-muted-foreground">Ranking por volume de conversão no período.</p>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {pixConvertedByResponsavel.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhuma conversão encontrada.</p>
                          ) : (
                            pixConvertedByResponsavel.map((row, idx) => (
                              <div key={`${row.responsavel_id || 'sem'}-${idx}`} className="rounded-md border bg-muted/10 px-2.5 py-2 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium truncate">{row.responsavel_nome}</span>
                                  <span className="text-sm font-bold">{row.total_convertidos}</span>
                                </div>
                                <div className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                                  <span>{formatCurrency(row.valor_total_convertido)}</span>
                                  <span>Ticket: {formatCurrency(row.ticket_medio_convertido)}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border shadow-md">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Convertidos Carrinho Ab por responsável</CardTitle>
                          <p className="text-xs text-muted-foreground">Ranking por volume de conversão no período.</p>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {carrinhoConvertedByResponsavel.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhuma conversão de Carrinho Ab encontrada no período.</p>
                          ) : (
                            carrinhoConvertedByResponsavel.map((row, idx) => (
                              <div key={`${row.responsavel_id || 'sem'}-${idx}`} className="rounded-md border bg-muted/10 px-2.5 py-2 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium truncate">{row.responsavel_nome}</span>
                                  <span className="text-sm font-bold">{row.total_convertidos}</span>
                                </div>
                                <div className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                                  <span>{formatCurrency(row.valor_total_convertido)}</span>
                                  <span>Ticket: {formatCurrency(row.ticket_medio_convertido)}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* ── GRÁFICOS DIÁRIOS ─────────────────────────────────────── */}
                    <div className="flex items-center gap-2 pt-1">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-2">Evolução diária</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                      {/* PIX diário */}
                      <Card className="border shadow-md">
                        <CardHeader>
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base">PIX diário</CardTitle>
                            <div className="flex items-center gap-1">
                              <Button type="button" size="sm" variant={pixDailyChartStyle === 'linha' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setPixDailyChartStyle('linha')}>Linha</Button>
                              <Button type="button" size="sm" variant={pixDailyChartStyle === 'barras' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setPixDailyChartStyle('barras')}>Barras</Button>
                              <Button type="button" size="sm" variant={pixDailyChartStyle === 'pizza' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setPixDailyChartStyle('pizza')}>Pizza</Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="mb-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                            <span><strong className="text-foreground">Média/dia:</strong> {mediaEntradasDia}</span>
                            <span><strong className="text-foreground">Pico:</strong> {Math.max(0, ...pixDailySeries.map((r) => Number(r.total_entradas || 0)))}</span>
                          </div>
                          <div className="h-[200px]">
                            {pixDailyChartStyle === 'linha' && (
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={pixDailyChartData}>
                                  <defs>
                                    <linearGradient id="pixAreaEntradas" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.65} />
                                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.08} />
                                    </linearGradient>
                                    <linearGradient id="pixAreaVendidos" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.65} />
                                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.08} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="dia_label" tick={{ fontSize: 10 }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                  <Tooltip content={renderPixDailyTooltip} />
                                  <Area type="monotone" dataKey="total_entradas" name="Entradas" stroke="#2563eb" strokeWidth={2} fill="url(#pixAreaEntradas)" dot={false} />
                                  <Area type="monotone" dataKey="total_vendidos" name="Vendidos" stroke="#16a34a" strokeWidth={2} fill="url(#pixAreaVendidos)" dot={false} />
                                </AreaChart>
                              </ResponsiveContainer>
                            )}
                            {pixDailyChartStyle === 'barras' && (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={pixDailyChartData}>
                                  <defs>
                                    <linearGradient id="pixBarEntradas" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.7} />
                                      <stop offset="100%" stopColor="#2563eb" stopOpacity={1} />
                                    </linearGradient>
                                    <linearGradient id="pixBarVendidos" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.7} />
                                      <stop offset="100%" stopColor="#16a34a" stopOpacity={1} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="dia_label" tick={{ fontSize: 10 }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                  <Tooltip content={renderPixDailyTooltip} />
                                  <Bar dataKey="total_entradas" name="Entradas" fill="url(#pixBarEntradas)" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey="total_vendidos" name="Vendidos" fill="url(#pixBarVendidos)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                            {pixDailyChartStyle === 'pizza' && (
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={pixPieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {pixPieChartData.map((entry, index) => (
                                      <Cell key={`pix-pie-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                                  <Legend />
                                </PieChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Carrinho diário */}
                      <Card className="border shadow-md">
                        <CardHeader>
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base">Carrinho diário</CardTitle>
                            <div className="flex items-center gap-1">
                              <Button type="button" size="sm" variant={carrinhoDailyChartStyle === 'linha' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setCarrinhoDailyChartStyle('linha')}>Linha</Button>
                              <Button type="button" size="sm" variant={carrinhoDailyChartStyle === 'barras' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setCarrinhoDailyChartStyle('barras')}>Barras</Button>
                              <Button type="button" size="sm" variant={carrinhoDailyChartStyle === 'pizza' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setCarrinhoDailyChartStyle('pizza')}>Pizza</Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[244px]">
                            {carrinhoDailyChartStyle === 'linha' && (
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={carrinhoDailyChartData}>
                                  <defs>
                                    <linearGradient id="carrinhoAreaEntradas" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#ea580c" stopOpacity={0.65} />
                                      <stop offset="95%" stopColor="#ea580c" stopOpacity={0.08} />
                                    </linearGradient>
                                    <linearGradient id="carrinhoAreaVendidos" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#eab308" stopOpacity={0.65} />
                                      <stop offset="95%" stopColor="#eab308" stopOpacity={0.08} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="dia_label" tick={{ fontSize: 10 }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                  <Tooltip content={renderPixDailyTooltip} />
                                  <Area type="monotone" dataKey="total_entradas" name="Entradas" stroke="#ea580c" strokeWidth={2} fill="url(#carrinhoAreaEntradas)" dot={false} />
                                  <Area type="monotone" dataKey="total_vendidos" name="Vendidos" stroke="#eab308" strokeWidth={2} fill="url(#carrinhoAreaVendidos)" dot={false} />
                                </AreaChart>
                              </ResponsiveContainer>
                            )}
                            {carrinhoDailyChartStyle === 'barras' && (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={carrinhoDailyChartData}>
                                  <defs>
                                    <linearGradient id="carrinhoBarEntradas" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#ea580c" stopOpacity={0.7} />
                                      <stop offset="100%" stopColor="#ea580c" stopOpacity={1} />
                                    </linearGradient>
                                    <linearGradient id="carrinhoBarVendidos" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#eab308" stopOpacity={0.7} />
                                      <stop offset="100%" stopColor="#eab308" stopOpacity={1} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="dia_label" tick={{ fontSize: 10 }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                  <Tooltip content={renderPixDailyTooltip} />
                                  <Bar dataKey="total_entradas" name="Entradas" fill="url(#carrinhoBarEntradas)" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey="total_vendidos" name="Vendidos" fill="url(#carrinhoBarVendidos)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                            {carrinhoDailyChartStyle === 'pizza' && (
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={carrinhoPieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {carrinhoPieChartData.map((entry, index) => (
                                      <Cell key={`carrinho-pie-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                                  <Legend />
                                </PieChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* WhatsApp diário */}
                      <Card className="border shadow-md">
                        <CardHeader>
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base">WhatsApp/Social diário</CardTitle>
                            <div className="flex items-center gap-1">
                              <Button type="button" size="sm" variant={whatsappDailyChartStyle === 'linha' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setWhatsappDailyChartStyle('linha')}>Linha</Button>
                              <Button type="button" size="sm" variant={whatsappDailyChartStyle === 'barras' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setWhatsappDailyChartStyle('barras')}>Barras</Button>
                              <Button type="button" size="sm" variant={whatsappDailyChartStyle === 'pizza' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setWhatsappDailyChartStyle('pizza')}>Pizza</Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[244px]">
                            {whatsappDailyChartStyle === 'linha' && (
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={whatsappDailyChartData}>
                                  <defs>
                                    <linearGradient id="whatsappAreaEntradas" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.65} />
                                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.08} />
                                    </linearGradient>
                                    <linearGradient id="whatsappAreaVendidos" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.65} />
                                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.08} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="dia_label" tick={{ fontSize: 10 }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                  <Tooltip content={renderPixDailyTooltip} />
                                  <Area type="monotone" dataKey="total_entradas" name="Entradas" stroke="#16a34a" strokeWidth={2} fill="url(#whatsappAreaEntradas)" dot={false} />
                                  <Area type="monotone" dataKey="total_vendidos" name="Vendidos" stroke="#14b8a6" strokeWidth={2} fill="url(#whatsappAreaVendidos)" dot={false} />
                                </AreaChart>
                              </ResponsiveContainer>
                            )}
                            {whatsappDailyChartStyle === 'barras' && (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={whatsappDailyChartData}>
                                  <defs>
                                    <linearGradient id="whatsappBarEntradas" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.7} />
                                      <stop offset="100%" stopColor="#16a34a" stopOpacity={1} />
                                    </linearGradient>
                                    <linearGradient id="whatsappBarVendidos" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.7} />
                                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={1} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="dia_label" tick={{ fontSize: 10 }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                  <Tooltip content={renderPixDailyTooltip} />
                                  <Bar dataKey="total_entradas" name="Entradas" fill="url(#whatsappBarEntradas)" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey="total_vendidos" name="Vendidos" fill="url(#whatsappBarVendidos)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                            {whatsappDailyChartStyle === 'pizza' && (
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={whatsappPieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {whatsappPieChartData.map((entry, index) => (
                                      <Cell key={`whatsapp-pie-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                                  <Legend />
                                </PieChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
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
