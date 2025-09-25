import { useState } from 'react';
import { Truck, Package, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockPedidos } from '@/data/mockData';
import { Pedido, EtiquetaEnvio } from '@/types';
import { useToast } from '@/hooks/use-toast';

const etiquetaLabels = {
  NAO_LIBERADO: 'Não Liberado',
  PENDENTE: 'Pendente',
  DISPONIVEL: 'Disponível',
};

const etiquetaIcons = {
  NAO_LIBERADO: XCircle,
  PENDENTE: Clock,
  DISPONIVEL: CheckCircle,
};

const etiquetaColors = {
  NAO_LIBERADO: 'bg-gray-100 text-gray-700',
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  DISPONIVEL: 'bg-green-100 text-green-700',
} as const;

export function Logistica() {
  const [pedidos, setPedidos] = useState<Pedido[]>(mockPedidos);
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<EtiquetaEnvio | 'all'>('all');
  const { toast } = useToast();

  const filteredPedidos = pedidos.filter(pedido =>
    filtroEtiqueta === 'all' || pedido.etiquetaEnvio === filtroEtiqueta
  );

  const updateEtiqueta = (pedidoId: string, novaEtiqueta: EtiquetaEnvio) => {
    setPedidos(prev => prev.map(pedido =>
      pedido.id === pedidoId
        ? { ...pedido, etiquetaEnvio: novaEtiqueta, atualizadoEm: new Date().toISOString() }
        : pedido
    ));

    const pedido = pedidos.find(p => p.id === pedidoId);
    toast({
      title: "Etiqueta atualizada",
      description: `Pedido ${pedido?.idExterno} marcado como ${etiquetaLabels[novaEtiqueta]}`,
    });
  };

  const contadores = {
    NAO_LIBERADO: pedidos.filter(p => p.etiquetaEnvio === 'NAO_LIBERADO').length,
    PENDENTE: pedidos.filter(p => p.etiquetaEnvio === 'PENDENTE').length,
    DISPONIVEL: pedidos.filter(p => p.etiquetaEnvio === 'DISPONIVEL').length,
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Logística</h1>
        <p className="text-muted-foreground">
          Gerencie etiquetas de envio e conferência de pedidos
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Não Liberado</CardTitle>
            <XCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contadores.NAO_LIBERADO}</div>
            <p className="text-xs text-muted-foreground">pedidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contadores.PENDENTE}</div>
            <p className="text-xs text-muted-foreground">pedidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponível</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contadores.DISPONIVEL}</div>
            <p className="text-xs text-muted-foreground">pronto para envio</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Select value={filtroEtiqueta} onValueChange={(value) => setFiltroEtiqueta(value as EtiquetaEnvio | 'all')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por etiqueta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as etiquetas</SelectItem>
                <SelectItem value="NAO_LIBERADO">Não Liberado</SelectItem>
                <SelectItem value="PENDENTE">Pendente</SelectItem>
                <SelectItem value="DISPONIVEL">Disponível</SelectItem>
              </SelectContent>
            </Select>
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
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Etiqueta de Envio</TableHead>
                <TableHead>Data Prevista</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPedidos.map((pedido) => {
                const IconeEtiqueta = etiquetaIcons[pedido.etiquetaEnvio];
                
                return (
                  <TableRow key={pedido.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {pedido.idExterno}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{pedido.clienteNome}</div>
                        <div className="text-sm text-muted-foreground">{pedido.contato}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        style={{ 
                          backgroundColor: `${pedido.status?.corHex}15`,
                          borderColor: pedido.status?.corHex,
                          color: pedido.status?.corHex
                        }}
                      >
                        {pedido.status?.nome}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <IconeEtiqueta className="h-4 w-4" />
                        <Badge 
                          variant="outline" 
                          className={etiquetaColors[pedido.etiquetaEnvio]}
                        >
                          {etiquetaLabels[pedido.etiquetaEnvio]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {pedido.dataPrevista 
                        ? new Date(pedido.dataPrevista).toLocaleDateString('pt-BR')
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {pedido.etiquetaEnvio !== 'DISPONIVEL' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateEtiqueta(pedido.id, 'DISPONIVEL')}
                          >
                            <Truck className="h-4 w-4 mr-1" />
                            Pronto p/ Envio
                          </Button>
                        )}
                        <Select
                          value={pedido.etiquetaEnvio}
                          onValueChange={(value) => updateEtiqueta(pedido.id, value as EtiquetaEnvio)}
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <Package className="h-4 w-4 mr-1" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NAO_LIBERADO">Não Liberado</SelectItem>
                            <SelectItem value="PENDENTE">Pendente</SelectItem>
                            <SelectItem value="DISPONIVEL">Disponível</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}