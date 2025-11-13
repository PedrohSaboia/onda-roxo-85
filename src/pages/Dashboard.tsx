import { Package, TrendingUp, Users, Truck, Calendar as CalendarIcon } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function Dashboard() {
  const { acesso, isLoading } = useAuth();
  // default is Hoje
  const [startDate, setStartDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalPedidos, setTotalPedidos] = useState(0);
  const [vendasValor, setVendasValor] = useState(0);
  const [pedidosEnviados, setPedidosEnviados] = useState(0);
  const [pedidosHoje, setPedidosHoje] = useState(0);
  const [plataformasCount, setPlataformasCount] = useState<any[]>([]);
  const [topTransportadoras, setTopTransportadoras] = useState<any[]>([]);
  const [topProdutos, setTopProdutos] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const startISO = new Date(startDate + 'T00:00:00').toISOString();
        const endISO = new Date(endDate + 'T23:59:59').toISOString();

        const { data, error: supaError } = await supabase
          .from('pedidos')
          .select(`id, criado_em, valor_total, carrinho_me, id_melhor_envio, frete_melhor_envio, plataformas(id,nome,cor,img_url), status(id,nome,cor_hex), itens_pedido(quantidade, produto:produtos(id,nome))`)
          .gte('criado_em', startISO)
          .lte('criado_em', endISO)
          .order('criado_em', { ascending: false });

        if (supaError) throw supaError;
        if (!mounted) return;

        const rows = data || [];

        // totals
        setTotalPedidos(rows.length);
        const sumValor = rows.reduce((s: number, r: any) => s + Number(r.valor_total || 0), 0);
        setVendasValor(sumValor);

        const todayStr = new Date().toDateString();
        setPedidosHoje(rows.filter((r: any) => new Date(r.criado_em).toDateString() === todayStr).length);

        // pedidos enviados (carrinho_me true or id_melhor_envio not null)
        setPedidosEnviados(rows.filter((r: any) => r.carrinho_me === true || r.id_melhor_envio).length);

        // plataformas
        const platMap: Record<string, any> = {};
        rows.forEach((r: any) => {
          const p = r.plataformas && r.plataformas[0];
          const key = p ? p.id : 'unknown';
          if (!platMap[key]) platMap[key] = { id: p?.id || 'unknown', nome: p?.nome || '—', cor: p?.cor || '#ddd', count: 0 };
          platMap[key].count++;
        });
        setPlataformasCount(Object.values(platMap));

        // transportadoras top by frete_melhor_envio.transportadora
        const transMap: Record<string, number> = {};
        rows.forEach((r: any) => {
          const name = r.frete_melhor_envio?.transportadora || (r.frete_melhor_envio?.raw_response?.company?.name) || '—';
          transMap[name] = (transMap[name] || 0) + 1;
        });
        const transArr = Object.entries(transMap).map(([nome, count]) => ({ nome, count })).sort((a, b) => b.count - a.count).slice(0, 6);
        setTopTransportadoras(transArr);

        // top produtos
        const prodMap: Record<string, { nome: string; count: number }> = {};
        rows.forEach((r: any) => {
          (r.itens_pedido || []).forEach((it: any) => {
            const nome = it.produto?.nome || 'Produto';
            prodMap[nome] = prodMap[nome] || { nome, count: 0 };
            prodMap[nome].count += Number(it.quantidade || 0);
          });
        });
        const prodArr = Object.values(prodMap).sort((a, b) => b.count - a.count).slice(0, 8);
        setTopProdutos(prodArr);

        // status counts
        const statusMap: Record<string, any> = {};
        rows.forEach((r: any) => {
          const s = r.status && r.status[0];
          const key = s ? s.id : 'unknown';
          if (!statusMap[key]) statusMap[key] = { id: s?.id || 'unknown', nome: s?.nome || '—', corHex: s?.cor_hex || '#ccc', count: 0 };
          statusMap[key].count++;
        });
        setStatusCounts(Object.values(statusMap));

      } catch (err: any) {
        console.error('Erro ao buscar dashboard:', err);
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetch();
    return () => { mounted = false };
  }, [startDate, endDate]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Visão Geral</h1>
          <p className="text-muted-foreground">Análise de métricas e resultados em Vendas</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Período</label>
          <Button variant="outline" onClick={() => setPickerOpen(true)} className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span className="text-sm">{startDate} → {endDate}</span>
          </Button>
        </div>
      </div>

          <>
          <Dialog open={pickerOpen} onOpenChange={(open) => setPickerOpen(open)}>
            <DialogContent className="max-w-4xl w-full">
              <DialogHeader>
                <DialogTitle>Selecionar Período</DialogTitle>
              </DialogHeader>
              <div className="flex">
                <div className="w-1/3 border-r pr-4">
                  <ul className="space-y-2">
                    {[{
                      key: 'hoje', label: 'Hoje', fn: () => { const d = format(new Date(), 'yyyy-MM-dd'); setStartDate(d); setEndDate(d); }
                    },{
                      key: 'ontem', label: 'Ontem', fn: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = format(d, 'yyyy-MM-dd'); setStartDate(s); setEndDate(s); }
                    },{
                      key: '7', label: 'Últimos 7 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 6); setStartDate(format(s,'yyyy-MM-dd')); setEndDate(format(e,'yyyy-MM-dd')); }
                    },{
                      key: '14', label: 'Últimos 14 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 13); setStartDate(format(s,'yyyy-MM-dd')); setEndDate(format(e,'yyyy-MM-dd')); }
                    },{
                      key: '30', label: 'Últimos 30 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 29); setStartDate(format(s,'yyyy-MM-dd')); setEndDate(format(e,'yyyy-MM-dd')); }
                    },{
                      key: 'mes', label: 'Este mês', fn: () => { const e = new Date(); const s = new Date(e.getFullYear(), e.getMonth(), 1); setStartDate(format(s,'yyyy-MM-dd')); setEndDate(format(e,'yyyy-MM-dd')); }
                    },{
                      key: 'mes_passado', label: 'Mês passado', fn: () => { const e = new Date(); const s = new Date(e.getFullYear(), e.getMonth()-1, 1); const f = new Date(e.getFullYear(), e.getMonth(), 0); setStartDate(format(s,'yyyy-MM-dd')); setEndDate(format(f,'yyyy-MM-dd')); }
                    },{
                      key: 'ano', label: 'Ano', fn: () => { const e = new Date(); const s = new Date(e.getFullYear(),0,1); setStartDate(format(s,'yyyy-MM-dd')); setEndDate(format(e,'yyyy-MM-dd')); }
                    },{
                      key: 'max', label: 'Máximo', fn: () => { setStartDate('1970-01-01'); setEndDate(format(new Date(),'yyyy-MM-dd')); }
                    }].map(preset => (
                      <li key={preset.key}>
                        <button onClick={() => preset.fn()} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100">{preset.label}</button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex-1 p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Data início</label>
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded px-2 py-1 mt-1" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Data fim</label>
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded px-2 py-1 mt-1" />
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground">Use os presets à esquerda ou selecione manualmente o intervalo.</div>
                </div>
              </div>
              <DialogFooter>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancelar</Button>
                  <Button onClick={() => setPickerOpen(false)}>Atualizar</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Métricas principais */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Total de Pedidos" value={totalPedidos} description={`${startDate} → ${endDate}`} trend="up" icon={Package} color="purple" />
            <MetricCard title="Vendas (R$)" value={vendasValor.toFixed(2)} description="soma de valor_total" icon={TrendingUp} color="blue" />
            <MetricCard title="Pedidos Enviados" value={pedidosEnviados} description="carrinho / melhor envio" trend="up" icon={Users} color="green" />
            <MetricCard title="Pedidos Hoje" value={pedidosHoje} description="no período" icon={Truck} color="orange" />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Plataformas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {plataformasCount.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.cor }} />
                      <span className="text-sm">{p.nome}</span>
                    </div>
                    <Badge variant="secondary">{p.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Transportadoras</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topTransportadoras.map(t => (
                  <div key={t.nome} className="flex items-center justify-between">
                    <span className="text-sm">{t.nome}</span>
                    <Badge variant="secondary">{t.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Produtos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topProdutos.map(p => (
                  <div key={p.nome} className="flex items-center justify-between">
                    <span className="text-sm">{p.nome}</span>
                    <Badge variant="secondary">{p.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          </>
        {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}