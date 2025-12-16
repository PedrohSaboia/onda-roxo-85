import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { EyeOff, X } from 'lucide-react';

type CotacaoFrete = {
  service_id: number;
  transportadora: string;
  modalidade: string;
  prazo: string;
  preco: number;
  raw_response: any;
  melhorEnvioId?: string;
};

type FreteOculto = {
  id: number;
  nome_frete: string;
  id_frete: number;
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
  const [hidingFrete, setHidingFrete] = useState<number | null>(null);
  const [fretesOcultos, setFretesOcultos] = useState<number[]>([]);
  const [fretesOcultosCompletos, setFretesOcultosCompletos] = useState<FreteOculto[]>([]);
  const [removingFrete, setRemovingFrete] = useState<number | null>(null);
  const { toast } = useToast();
  const { empresaId } = useAuth();

  // Buscar fretes ocultos ao abrir o modal
  useEffect(() => {
    if (open && empresaId) {
      buscarFretesOcultos();
    }
  }, [open, empresaId]);

  const buscarFretesOcultos = async () => {
    try {
      const { data, error } = await supabase
        .from('fretes_nao_disponiveis' as any)
        .select('id, id_frete, nome_frete')
        .eq('empresa_id', empresaId);

      if (error) throw error;

      const idsOcultos = (data?.map((f: any) => f.id_frete).filter((id: any) => id !== null) || []) as number[];
      setFretesOcultos(idsOcultos);
      setFretesOcultosCompletos((data as any) || []);
    } catch (err) {
      console.error('Erro ao buscar fretes ocultos:', err);
    }
  };

  const handleOcultarFrete = async (cotacao: CotacaoFrete) => {
    if (!empresaId) {
      toast({
        title: 'Erro',
        description: 'Empresa não identificada',
        variant: 'destructive'
      });
      return;
    }

    setHidingFrete(cotacao.service_id);

    try {
      const { error } = await supabase
        .from('fretes_nao_disponiveis' as any)
        .insert({
          nome_frete: cotacao.transportadora,
          id_frete: cotacao.service_id,
          empresa_id: empresaId
        });

      if (error) throw error;

      // Atualizar lista de fretes ocultos
      setFretesOcultos(prev => [...prev, cotacao.service_id]);
      
      // Buscar novamente para atualizar a lista completa com o novo registro
      await buscarFretesOcultos();

      toast({
        title: 'Sucesso',
        description: `Transportadora ${cotacao.transportadora} ocultada com sucesso`
      });
    } catch (err) {
      console.error('Erro ao ocultar frete:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível ocultar a transportadora',
        variant: 'destructive'
      });
    } finally {
      setHidingFrete(null);
    }
  };

  const handleReexibirFrete = async (freteOculto: FreteOculto) => {
    setRemovingFrete(freteOculto.id);

    try {
      const { error } = await supabase
        .from('fretes_nao_disponiveis' as any)
        .delete()
        .eq('id', freteOculto.id);

      if (error) throw error;

      // Atualizar lista de fretes ocultos
      setFretesOcultos(prev => prev.filter(id => id !== freteOculto.id_frete));
      setFretesOcultosCompletos(prev => prev.filter(f => f.id !== freteOculto.id));

      toast({
        title: 'Sucesso',
        description: `Transportadora ${freteOculto.nome_frete} reexibida com sucesso`
      });
    } catch (err) {
      console.error('Erro ao reexibir frete:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível reexibir a transportadora',
        variant: 'destructive'
      });
    } finally {
      setRemovingFrete(null);
    }
  };

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
          name: cliente?.nome || cliente?.name || 'Cliente',
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
          note: cliente?.observacao || '',
          postal_code: (cliente?.cep || cliente?.postal_code || '').replace(/\D/g, '')
        },
        options: {
          insurance_value: 1,
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
            unitary_value: '1.00'
          }
        ],
        service: cotacao.service_id,
        volumes: [{
          height: embalagem?.altura || 5,
          width: embalagem?.largura || 20,
          length: embalagem?.comprimento || 20,
          weight: embalagem?.peso || 1,
          insurance_value: 1
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

        {/* Badge com transportadoras ocultas */}
        {fretesOcultosCompletos.length > 0 && (
          <div className="border-b pb-4">
            <div className="text-sm text-muted-foreground mb-2">Transportadoras ocultas:</div>
            <div className="flex flex-wrap gap-2">
              {fretesOcultosCompletos.map((frete) => (
                <Badge 
                  key={frete.id} 
                  variant="secondary" 
                  className="flex items-center gap-1 px-3 py-1"
                >
                  <span>{frete.nome_frete}</span>
                  <button
                    onClick={() => handleReexibirFrete(frete)}
                    disabled={removingFrete === frete.id}
                    className="ml-1 hover:bg-gray-300 rounded-full p-0.5 transition-colors"
                    title="Reexibir transportadora"
                  >
                    {removingFrete === frete.id ? (
                      <div className="animate-spin h-3 w-3 border border-b-transparent rounded-full" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4 py-4 overflow-y-auto pr-2 flex-1">
          {cotacoes.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhuma cotação retornada. Tente outro remetente/embalagem.
            </div>
          ) : (
            [...cotacoes]
              .filter(cotacao => !fretesOcultos.includes(cotacao.service_id))
              .sort((a, b) => a.preco - b.preco)
              .map((cotacao, index) => (
              <Card key={index}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="font-medium">{cotacao.transportadora}</div>
                    <div className="text-sm text-muted-foreground">{cotacao.modalidade}</div>
                    <div className="text-sm">Prazo: {cotacao.prazo}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Valor</div>
                      <div className="text-lg font-bold">
                        R$ {cotacao.preco.toFixed(2)}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleOcultarFrete(cotacao)}
                      disabled={hidingFrete === cotacao.service_id}
                      className="hover:bg-red-50 hover:border-red-300"
                      title="Ocultar esta transportadora"
                    >
                      {hidingFrete === cotacao.service_id ? (
                        <div className="animate-spin h-4 w-4 border-2 border-b-transparent rounded-full" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-600" />
                      )}
                    </Button>

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
