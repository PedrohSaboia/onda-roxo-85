import { useState } from 'react';
import { KanbanBoard } from '@/components/orders/KanbanBoard';
import { mockPedidos, mockStatus } from '@/data/mockData';
import { Pedido } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function Design() {
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

  const handleOrderClick = (pedido: Pedido) => {
    toast({
      title: "Pedido selecionado",
      description: `Visualizando pedido ${pedido.idExterno}`,
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Design</h1>
        <p className="text-muted-foreground">
          Quadro Kanban - Arraste os pedidos para alterar o status
        </p>
      </div>

      <KanbanBoard
        pedidos={pedidos}
        status={mockStatus}
        onOrderMove={handleOrderMove}
        onOrderClick={handleOrderClick}
      />
    </div>
  );
}