import { Package, TrendingUp, Users, Truck, Calendar as CalendarIcon, DollarSign, ShoppingCart, TrendingDown, BarChart3, AlertCircle } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, subMonths, parseISO, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

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
  isPeriodoCurto: boolean;
}

export function Dashboard() {
  const { acesso, isLoading } = useAuth();
  const [startDate, setStartDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);
      try {
        const startISO = new Date(startDate + 'T00:00:00').toISOString();
        const endISO = new Date(endDate + 'T23:59:59').toISOString();

        // Buscar pedidos com joins
        const { data: pedidos, error: pedidosError } = await supabase
          .from('pedidos')
          .select(`
            id, criado_em, valor_total, data_enviado, id_melhor_envio, carrinho_me,
            plataformas(nome, cor),
            status(nome, cor_hex),
            itens_pedido(quantidade, preco_unitario, produto:produtos(nome, sku, img_url))
          `)
          .gte('criado_em', startISO)
          .lte('criado_em', endISO)
          .order('criado_em', { ascending: false });

        if (pedidosError) throw pedidosError;
        if (!mounted) return;

        const pedidosData = pedidos || [];

        // Calcular métricas
        const totalPedidos = pedidosData.length;
        const vendasTotal = pedidosData.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0);
        const ticketMedio = totalPedidos > 0 ? vendasTotal / totalPedidos : 0;

        const hoje = new Date().toDateString();
        const pedidosHoje = pedidosData.filter(p => new Date(p.criado_em).toDateString() === hoje).length;

        const pedidosEnviados = pedidosData.filter(p => p.data_enviado || p.id_melhor_envio || p.carrinho_me).length;

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
          isPeriodoCurto,
        });

      } catch (err: any) {
        console.error('Erro ao buscar dashboard:', err);
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    return () => { mounted = false };
  }, [startDate, endDate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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
          <Button variant="outline" onClick={() => setPickerOpen(true)} className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span className="text-sm">{format(parseISO(startDate), 'dd/MM/yy', { locale: ptBR })} → {format(parseISO(endDate), 'dd/MM/yy', { locale: ptBR })}</span>
          </Button>
        </div>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Selecionar Período</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4">
            <div className="w-1/3 border-r pr-4">
              <div className="space-y-1">
                {[
                  { label: 'Hoje', fn: () => { const d = format(new Date(), 'yyyy-MM-dd'); setStartDate(d); setEndDate(d); } },
                  { label: 'Ontem', fn: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = format(d, 'yyyy-MM-dd'); setStartDate(s); setEndDate(s); } },
                  { label: 'Últimos 7 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 6); setStartDate(format(s, 'yyyy-MM-dd')); setEndDate(format(e, 'yyyy-MM-dd')); } },
                  { label: 'Últimos 15 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 14); setStartDate(format(s, 'yyyy-MM-dd')); setEndDate(format(e, 'yyyy-MM-dd')); } },
                  { label: 'Últimos 30 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 29); setStartDate(format(s, 'yyyy-MM-dd')); setEndDate(format(e, 'yyyy-MM-dd')); } },
                  { label: 'Este mês', fn: () => { const e = new Date(); const s = startOfMonth(e); setStartDate(format(s, 'yyyy-MM-dd')); setEndDate(format(e, 'yyyy-MM-dd')); } },
                  { label: 'Mês passado', fn: () => { const hoje = new Date(); const mesPassado = subMonths(hoje, 1); const s = startOfMonth(mesPassado); const e = new Date(mesPassado.getFullYear(), mesPassado.getMonth() + 1, 0); setStartDate(format(s, 'yyyy-MM-dd')); setEndDate(format(e, 'yyyy-MM-dd')); } },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => preset.fn()}
                    className="w-full text-left px-3 py-2 rounded hover:bg-accent transition-colors text-sm"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Data início</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border rounded px-3 py-2 mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Data fim</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border rounded px-3 py-2 mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancelar</Button>
            <Button onClick={() => setPickerOpen(false)}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              icon={Package}
              color="purple"
            />
            <MetricCard
              title="Receita Total"
              value={formatCurrency(metrics.vendasTotal)}
              description="Valor total de vendas"
              icon={DollarSign}
              color="green"
            />
            <MetricCard
              title="Ticket Médio"
              value={formatCurrency(metrics.ticketMedio)}
              description="Valor médio por pedido"
              icon={ShoppingCart}
              color="blue"
            />
            <MetricCard
              title="Pedidos Enviados"
              value={metrics.pedidosEnviados.toString()}
              description={`${((metrics.pedidosEnviados / metrics.totalPedidos) * 100).toFixed(1)}% dos pedidos`}
              icon={Truck}
              color="orange"
            />
          </div>

          {/* Gráficos de Vendas por Plataforma e Pedidos por Status */}
          {metrics.isPeriodoCurto ? (
            // Layout para período curto - cada dia em card separado com ambos gráficos
            <div className="space-y-6">
              {metrics.vendasPorPlataformaPorPeriodo.map((periodo) => {
                const chartData = periodo.plataformas.map(p => ({
                  nome: p.nome,
                  valor: p.valor,
                  cor: p.cor
                }));
                return (
                  <div key={periodo.periodo} className="grid gap-6 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Vendas por Plataforma</CardTitle>
                        <CardDescription>
                          {format(parseISO(periodo.periodo), "dd 'de' MMMM", { locale: ptBR })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="nome" 
                              angle={0}
                              textAnchor="middle"
                              height={60}
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                            />
                            <YAxis 
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                              tickFormatter={(value) => formatCurrency(value)}
                            />
                            <Tooltip 
                              formatter={(value: any) => formatCurrency(Number(value))}
                              contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                              }}
                            />
                            <Bar dataKey="valor" radius={[8, 8, 0, 0]}>
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.cor} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap gap-4 justify-center mt-6">
                          {periodo.plataformas.map((plat) => (
                            <div key={plat.nome} className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plat.cor }} />
                              <span className="text-sm font-medium">{plat.nome}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Pedidos por Status</CardTitle>
                        <CardDescription>
                          {format(parseISO(periodo.periodo), "dd 'de' MMMM", { locale: ptBR })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart 
                            data={metrics.vendasPorStatus.map(s => ({
                              nome: s.nome,
                              pedidos: s.pedidos,
                              cor: s.cor
                            }))}
                            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="nome"
                              angle={0}
                              textAnchor="middle"
                              height={60}
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                            />
                            <YAxis 
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                              allowDecimals={false}
                            />
                            <Tooltip 
                              formatter={(value: any) => [value, 'Pedidos']}
                              contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                              }}
                            />
                            <Bar dataKey="pedidos" radius={[8, 8, 0, 0]}>
                              {metrics.vendasPorStatus.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.cor} />
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
                  </div>
                );
              })}
            </div>
          ) : (
            // Layout para período longo - gráficos lado a lado
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Vendas por Plataforma</CardTitle>
                  <CardDescription>Total de vendas por plataforma no período</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart 
                      data={metrics.vendasPorPlataforma.map(p => ({
                        nome: p.nome,
                        valor: p.total,
                        pedidos: p.pedidos,
                        cor: p.cor
                      }))}
                      margin={{ top: 30, right: 30, left: 20, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="nome"
                        angle={0}
                        textAnchor="middle"
                        height={80}
                        tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 500 }}
                      />
                      <YAxis 
                        tick={{ fill: '#6b7280', fontSize: 12 }}
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
                          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Bar dataKey="valor" radius={[8, 8, 0, 0]}>
                        {metrics.vendasPorPlataforma.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.cor} />
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pedidos por Status</CardTitle>
                  <CardDescription>Distribuição atual dos pedidos</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart 
                      data={metrics.vendasPorStatus.map(s => ({
                        nome: s.nome,
                        pedidos: s.pedidos,
                        cor: s.cor
                      }))}
                      margin={{ top: 30, right: 30, left: 20, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="nome"
                        angle={0}
                        textAnchor="middle"
                        height={80}
                        tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 500 }}
                      />
                      <YAxis 
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        formatter={(value: any) => [value, 'Pedidos']}
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Bar dataKey="pedidos" radius={[8, 8, 0, 0]}>
                        {metrics.vendasPorStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.cor} />
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
            </div>
          )}

          {/* Top Produtos e Produtos com Maior Ticket Médio */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
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

            <Card>
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
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
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

            <Card>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Atividade Hoje</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-3xl font-bold">{metrics.pedidosHoje}</div>
                  <p className="text-sm text-muted-foreground">Novos pedidos hoje</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
