import { Package, TrendingUp, Users, Truck } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockPedidos, mockStatus, mockPlataformas } from '@/data/mockData';

export function Dashboard() {
  // Calcular métricas
  const totalPedidos = mockPedidos.length;
  const pedidosHoje = mockPedidos.filter(p => {
    const hoje = new Date().toDateString();
    return new Date(p.criadoEm).toDateString() === hoje;
  }).length;
  
  const pedidosSemana = mockPedidos.filter(p => {
    const umaSemanaAtras = new Date();
    umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
    return new Date(p.criadoEm) >= umaSemanaAtras;
  }).length;

  const etiquetasCount = mockPedidos.reduce(
    (acc, pedido) => {
      acc[pedido.etiquetaEnvio]++;
      return acc;
    },
    { NAO_LIBERADO: 0, PENDENTE: 0, DISPONIVEL: 0 }
  );

  const statusCount = mockStatus.map(status => ({
    status,
    count: mockPedidos.filter(p => p.statusId === status.id).length
  }));

  const plataformasCount = mockPlataformas.map(plataforma => ({
    plataforma,
    count: mockPedidos.filter(p => p.plataformaId === plataforma.id).length
  }));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Visão Geral</h1>
        <p className="text-muted-foreground">
          Análise de métricas e resultados em Vendas
        </p>
      </div>

      {/* Métricas principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total de Pedidos"
          value={totalPedidos}
          description="últimos 30 dias"
          trend="up"
          trendValue="+12%"
          icon={Package}
          color="purple"
        />
        <MetricCard
          title="Pedidos Hoje"
          value={pedidosHoje}
          description="hoje"
          icon={TrendingUp}
          color="blue"
        />
        <MetricCard
          title="Pedidos na Semana"
          value={pedidosSemana}
          description="últimos 7 dias"
          trend="up"
          trendValue="+8%"
          icon={Users}
          color="green"
        />
        <MetricCard
          title="Pronto para Envio"
          value={etiquetasCount.DISPONIVEL}
          description="disponível"
          icon={Truck}
          color="orange"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Status dos Pedidos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pedidos por Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusCount.map(({ status, count }) => (
              <div key={status.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: status.corHex }}
                  />
                  <span className="text-sm">{status.nome}</span>
                </div>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Plataformas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vendas por Plataforma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {plataformasCount.map(({ plataforma, count }) => (
              <div key={plataforma.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: plataforma.cor }}
                  />
                  <span className="text-sm">{plataforma.nome}</span>
                </div>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Etiquetas de Envio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status de Envio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-sm">Não Liberado</span>
              </div>
              <Badge variant="secondary">{etiquetasCount.NAO_LIBERADO}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="text-sm">Pendente</span>
              </div>
              <Badge variant="secondary">{etiquetasCount.PENDENTE}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-sm">Disponível</span>
              </div>
              <Badge variant="secondary">{etiquetasCount.DISPONIVEL}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}