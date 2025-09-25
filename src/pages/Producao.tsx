import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/orders/KanbanBoard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockPedidos, mockStatus } from '@/data/mockData';
import { Pedido } from '@/types';
import { useToast } from '@/hooks/use-toast';

const diasSemana = [
  { id: 'segunda', nome: 'Segunda-feira' },
  { id: 'terca', nome: 'Terça-feira' },
  { id: 'quarta', nome: 'Quarta-feira' },
  { id: 'quinta', nome: 'Quinta-feira' },
  { id: 'sexta', nome: 'Sexta-feira' },
  { id: 'sabado', nome: 'Sábado' },
];

export function Producao() {
  const [pedidos, setPedidos] = useState<Pedido[]>(mockPedidos);
  const { toast } = useToast();

  const handleOrderMove = (pedidoId: string, newStatusId: string) => {
    setPedidos(prev => prev.map(pedido => 
      pedido.id === pedidoId 
        ? { 
            ...pedido, 
            statusId: newStatusId,
            status: mockStatus.find(s => s.id === newStatusId),
            atualizadoEm: new Date().toISOString()
          }
        : pedido
    ));

    const pedido = pedidos.find(p => p.id === pedidoId);
    const novoStatus = mockStatus.find(s => s.id === newStatusId);
    
    toast({
      title: "Status atualizado",
      description: `Pedido ${pedido?.idExterno} movido para ${novoStatus?.nome}`,
    });
  };

  const getPedidosPorDia = (diaIndex: number) => {
    return pedidos.filter(pedido => {
      if (!pedido.dataPrevista) return false;
      const data = new Date(pedido.dataPrevista);
      return data.getDay() === diaIndex;
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Produção</h1>
        <p className="text-muted-foreground">
          Gerencie a produção por status ou por dia planejado
        </p>
      </div>

      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">Por Status</TabsTrigger>
          <TabsTrigger value="calendario">Por Dia da Semana</TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <KanbanBoard
            pedidos={pedidos}
            status={mockStatus}
            onOrderMove={handleOrderMove}
          />
        </TabsContent>

        <TabsContent value="calendario">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {diasSemana.map((dia, index) => {
              const pedidosDoDia = getPedidosPorDia(index + 1);
              
              return (
                <Card key={dia.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span>{dia.nome}</span>
                      <Badge variant="secondary">{pedidosDoDia.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pedidosDoDia.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum pedido planejado
                      </p>
                    ) : (
                      pedidosDoDia.map(pedido => (
                        <div key={pedido.id} className="p-3 border rounded-lg bg-card">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{pedido.idExterno}</span>
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
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {pedido.clienteNome}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}