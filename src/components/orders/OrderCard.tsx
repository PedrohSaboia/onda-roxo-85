import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, MessageSquare, AlertTriangle } from 'lucide-react';
import { Pedido } from '@/types';
import { cn } from '@/lib/utils';

interface OrderCardProps {
  pedido: Pedido;
  onClick?: () => void;
  draggable?: boolean;
}

const etiquetaColors = {
  NAO_LIBERADO: 'bg-gray-100 text-gray-700 border-gray-200',
  PENDENTE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  DISPONIVEL: 'bg-green-100 text-green-700 border-green-200',
};

const etiquetaLabels = {
  NAO_LIBERADO: 'Não Liberado',
  PENDENTE: 'Pendente',
  DISPONIVEL: 'Disponível',
};

export function OrderCard({ pedido, onClick, draggable = false }: OrderCardProps) {
  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-md transition-all duration-200 border-l-4",
        draggable && "hover:scale-[1.02]"
      )}
      style={{ borderLeftColor: pedido.status?.corHex }}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header com ID e urgência */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{pedido.idExterno}</span>
              {pedido.urgente && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Urgente
                </Badge>
              )}
            </div>
            <Badge 
              variant="outline" 
              className={etiquetaColors[pedido.etiquetaEnvio]}
            >
              {etiquetaLabels[pedido.etiquetaEnvio]}
            </Badge>
          </div>

          {/* Cliente */}
          <div>
            <p className="font-medium text-sm truncate">{pedido.clienteNome}</p>
            <p className="text-xs text-muted-foreground">{pedido.contato}</p>
          </div>

          {/* Plataforma */}
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: pedido.plataforma?.cor }}
            />
            <span className="text-xs text-muted-foreground">
              {pedido.plataforma?.nome}
            </span>
          </div>

          {/* Data prevista */}
          {pedido.dataPrevista && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{new Date(pedido.dataPrevista).toLocaleDateString('pt-BR')}</span>
            </div>
          )}

          {/* Observações se houver */}
          {pedido.observacoes && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span className="truncate">{pedido.observacoes}</span>
            </div>
          )}

          {/* Footer com responsável */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={pedido.responsavel?.avatar} />
                <AvatarFallback className="text-xs">
                  {pedido.responsavel?.nome?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {pedido.responsavel?.nome}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(pedido.criadoEm).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}