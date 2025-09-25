import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OrderCard } from './OrderCard';
import { Pedido, Status } from '@/types';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
  pedidos: Pedido[];
  status: Status[];
  onOrderMove?: (pedidoId: string, newStatusId: string) => void;
  onOrderClick?: (pedido: Pedido) => void;
}

export function KanbanBoard({ pedidos, status, onOrderMove, onOrderClick }: KanbanBoardProps) {
  const [draggedOrder, setDraggedOrder] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, pedidoId: string) => {
    setDraggedOrder(pedidoId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(statusId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    if (draggedOrder && onOrderMove) {
      onOrderMove(draggedOrder, statusId);
    }
    setDraggedOrder(null);
    setDragOverColumn(null);
  };

  const getPedidosPorStatus = (statusId: string) => {
    return pedidos.filter(pedido => pedido.statusId === statusId);
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {status.map((statusItem) => {
        const pedidosDoStatus = getPedidosPorStatus(statusItem.id);
        const isDragOver = dragOverColumn === statusItem.id;
        
        return (
          <div
            key={statusItem.id}
            className={cn(
              "flex-shrink-0 w-80 transition-all duration-200",
              isDragOver && "scale-105"
            )}
            onDragOver={(e) => handleDragOver(e, statusItem.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, statusItem.id)}
          >
            <Card className={cn(
              "h-full transition-all duration-200",
              isDragOver && "ring-2 ring-purple-500 shadow-lg"
            )}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: statusItem.corHex }}
                    />
                    <span>{statusItem.nome}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {pedidosDoStatus.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {pedidosDoStatus.map((pedido) => (
                  <div
                    key={pedido.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, pedido.id)}
                    className={cn(
                      "transition-opacity duration-200",
                      draggedOrder === pedido.id && "opacity-50"
                    )}
                  >
                    <OrderCard
                      pedido={pedido}
                      onClick={() => onOrderClick?.(pedido)}
                      draggable
                    />
                  </div>
                ))}
                {pedidosDoStatus.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Nenhum pedido</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}