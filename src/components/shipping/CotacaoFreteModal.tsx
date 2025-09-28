import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type CotacaoFrete = {
  service_id: number;
  transportadora: string;
  modalidade: string;
  prazo: string;
  preco: number;
  raw_response: any;
};

type CotacaoFreteModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (cotacao: CotacaoFrete) => void;
  cotacoes: CotacaoFrete[];
  loading?: boolean;
};

export default function CotacaoFreteModal({ open, onClose, onSelect, cotacoes, loading }: CotacaoFreteModalProps) {
  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calculando frete...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Opções de Frete</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {cotacoes.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhuma cotação retornada. Tente outro remetente/embalagem.
            </div>
          ) : (
            cotacoes.map((cotacao, index) => (
              <Card key={index}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="font-medium">{cotacao.transportadora}</div>
                    <div className="text-sm text-muted-foreground">{cotacao.modalidade}</div>
                    <div className="text-sm">Prazo: {cotacao.prazo}</div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-xs text-muted-foreground">Valor</div>
                      <div className="text-lg font-bold">
                        R$ {cotacao.preco.toFixed(2)}
                      </div>
                    </div>

                    <Button 
                      onClick={() => onSelect(cotacao)}
                      className="bg-purple-700 hover:bg-purple-800"
                    >
                      Selecionar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
