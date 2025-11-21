import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type CotacaoFrete = {
  service_id: number;
  transportadora: string;
  modalidade: string;
  prazo: string;
  preco: number;
  raw_response: any;
  melhorEnvioId?: string;
};

type CotacaoFreteModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (cotacao: CotacaoFrete) => void;
  cotacoes: CotacaoFrete[];
  loading?: boolean;
  remetente?: any;
  cliente?: any;
  embalagem?: any;
  insuranceValue?: number;
  productName?: string;
  orderProducts?: Array<{ name: string; quantity: number; unitary_value: number }>;
};

export default function CotacaoFreteModal({ open, onClose, onSelect, cotacoes, loading, remetente, cliente, embalagem, insuranceValue, productName, orderProducts }: CotacaoFreteModalProps) {
  const [sendingToCart, setSendingToCart] = useState<number | null>(null);
  const { toast } = useToast();

  const handleSelectCotacao = async (cotacao: CotacaoFrete) => {
    setSendingToCart(cotacao.service_id);
    
    try {
      // Preparar payload para adicionar ao carrinho
      const payload = {
        from: {
          name: remetente?.nome || '',
          phone: remetente?.contato || remetente?.telefone || '',
          email: remetente?.email || 'contato@empresa.com',
          document: remetente?.cpf || remetente?.document || '',
          state_register: remetente?.inscricao_estadual || remetente?.state_register || '',
          address: remetente?.endereco || remetente?.address || '',
          number: remetente?.numero || remetente?.number || '',
          complement: remetente?.complemento || remetente?.complement || '',
          district: remetente?.bairro || remetente?.district || '',
          city: remetente?.cidade || remetente?.city || '',
          state_abbr: remetente?.estado || remetente?.state_abbr || '',
          country_id: remetente?.country_id || 'BR',
          postal_code: (remetente?.cep || remetente?.postal_code || '').replace(/\D/g, '')
        },
        to: {
          name: cliente?.nome || cliente?.name || '',
          phone: cliente?.telefone || cliente?.contato || cliente?.phone || '',
          email: cliente?.email || 'cliente@email.com',
          document: cliente?.cpf || cliente?.document || '',
          address: cliente?.endereco || cliente?.address || '',
          number: cliente?.numero || cliente?.number || '',
          complement: cliente?.complemento || cliente?.complement || '',
          district: cliente?.bairro || cliente?.district || '',
          city: cliente?.cidade || cliente?.city || '',
          state_abbr: cliente?.estado || cliente?.state_abbr || '',
          country_id: cliente?.country_id || 'BR',
          postal_code: (cliente?.cep || cliente?.postal_code || '').replace(/\D/g, '')
        },
        options: {
          insurance_value: insuranceValue ?? 1,
          receipt: false,
          own_hand: false,
          reverse: false,
          non_commercial: true
        },
        // products array requested: include dynamic product info (name, quantity, unitary_value)
        products: (orderProducts && orderProducts.length) ? orderProducts.map(p => ({
          name: p.name,
          quantity: String(p.quantity),
          unitary_value: String(Number(p.unitary_value).toFixed(2))
        })) : [
          {
            name: productName || (cliente?.nome || 'Produto'),
            quantity: '1',
            unitary_value: String((insuranceValue ?? 1).toFixed(2))
          }
        ],
        service: cotacao.service_id,
        volumes: [{
          height: embalagem?.altura || 5,
          width: embalagem?.largura || 20,
          length: embalagem?.comprimento || 20,
          weight: embalagem?.peso || 1,
          insurance_value: insuranceValue ?? 1
        }]
      };

      console.log('Enviando para carrinho Melhor Envio:', payload);

      // Chamar edge function para adicionar ao carrinho
      const { data: carrinhoResp, error: carrinhoError } = await supabase.functions.invoke('adic-carrinho-melhorenvio', {
        body: payload,
        headers: {
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsbHlwa2N0dmNrZWFjemplc2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MzYwOTgsImV4cCI6MjA3NDQxMjA5OH0.Gc4WWo0YBE3eiB85lYh_1IjheXdFzPD7KwgcLiVV70s`
        }
      });

      if (carrinhoError) {
        throw new Error(carrinhoError.message || 'Erro ao adicionar ao carrinho');
      }

      console.log('Resposta do carrinho:', carrinhoResp);

      // Extrair o ID retornado pelo Melhor Envio
      const melhorEnvioId = carrinhoResp?.id;
      
      toast({ 
        title: 'Sucesso', 
        description: 'Frete adicionado ao carrinho do Melhor Envio' 
      });

      // Passar o melhorEnvioId junto com a cotação
      onSelect({ ...cotacao, melhorEnvioId });
    } catch (err) {
      console.error('Erro ao adicionar ao carrinho:', err);
      toast({ 
        title: 'Erro', 
        description: err instanceof Error ? err.message : 'Não foi possível adicionar ao carrinho',
        variant: 'destructive'
      });
    } finally {
      setSendingToCart(null);
    }
  };
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Opções de Frete</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto pr-2 flex-1">
          {cotacoes.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhuma cotação retornada. Tente outro remetente/embalagem.
            </div>
          ) : (
            [...cotacoes].sort((a, b) => a.preco - b.preco).map((cotacao, index) => (
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
                      onClick={() => handleSelectCotacao(cotacao)}
                      className="bg-purple-700 hover:bg-purple-800"
                      disabled={sendingToCart === cotacao.service_id}
                    >
                      {sendingToCart === cotacao.service_id ? (
                        <>
                          <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full" />
                          Enviando...
                        </>
                      ) : (
                        'Selecionar'
                      )}
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
