import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, MessageSquare, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const val = pedido.idExterno || pedido.id || '';
      navigator.clipboard.writeText(String(val));
      toast({ title: 'ID copiado', description: String(val) });
    } catch (err) {
      toast({ title: 'Erro', description: 'Não foi possível copiar o ID', variant: 'destructive' });
    }
  };
  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 overflow-hidden max-h-100",
        draggable && "hover:scale-[1.02]"
      )}
      style={{ borderLeftColor: pedido.status?.corHex }}
      onClick={onClick}
    >
      <CardContent className="p-4 flex flex-col h-full min-h-0">
        <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-2">
          {/* Header com ID e urgência */}
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <button onClick={handleCopyId} title="Copiar ID" className="font-semibold text-sm hover:underline text-left">
                  {pedido.idExterno}
                </button>
                {/* click the ID text to copy (icon removed) */}
              </div>
              {pedido.urgente && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Urgente
                </Badge>
              )}
            </div>
            
          </div>

          {/* Cliente (removido conforme solicitado) */}

          {/* Plataforma (exibir imagem quando disponível, fallback para bolinha colorida) */}
          <div className="flex items-center gap-2">
            {pedido.plataforma?.imagemUrl ? (
              <div className="w-5 h-5 rounded overflow-hidden">
                <img src={pedido.plataforma.imagemUrl} alt={pedido.plataforma?.nome || 'Plataforma'} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: pedido.plataforma?.cor }}
              />
            )}
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

          {/* Itens do pedido */}
          {pedido.itens && pedido.itens.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Itens</div>
              <div className="space-y-2 max-h-28 overflow-y-auto pr-2 px-2">
                {pedido.itens.map((it: any) => {
                  const productName = it.produto?.nome || '';
                  const variationName = it.variacao?.nome || '';
                  const name = variationName ? `${productName}: ${variationName}` : (productName || variationName || 'Produto');
                  const image = it.variacao?.imagem || it.produto?.imagem;
                  return (
                    <div key={it.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 flex-shrink-0 rounded overflow-hidden bg-muted">
                        {image ? (
                          <img src={image} alt={name} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">—</div>
                        )}
                      </div>
                      <div className="flex-1 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate">{name}</div>
                          {it.item_faltante && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Faltante</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">Qtd: {it.quantidade}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer com responsável (fora da área rolável para permanecer visível) */}
        <div className="flex items-center justify-between pt-2 border-t mt-2">
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
      </CardContent>
    </Card>
  );
}