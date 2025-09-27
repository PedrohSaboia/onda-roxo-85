import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/orders/KanbanBoard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockPedidos } from '@/data/mockData';
import { Pedido } from '@/types';
import { supabase } from '@/integrations/supabase/client';
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
  const [statusList, setStatusList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchPedidos = async () => {
      setLoading(true);
      setError(null);
      try {
        // fetch statuses first
        const { data: statusesData, error: statusesError } = await supabase
          .from('status')
          .select('*')
          .order('ordem', { ascending: true });

        if (statusesError) throw statusesError;
        if (!mounted) return;

        // normalize to local Status type shape
        const mappedStatuses = (statusesData || []).map((s: any) => ({
          id: s.id,
          nome: s.nome,
          corHex: s.cor_hex,
          ordem: s.ordem ?? 0,
          criadoEm: s.criado_em,
          atualizadoEm: s.atualizado_em,
        }));

        setStatusList(mappedStatuses);

        const { data, error: supaError } = await supabase
          .from('pedidos')
          .select(`*, usuarios(id,nome,img_url), plataformas(id,nome,cor,img_url), status(id,nome,cor_hex,ordem), tipos_etiqueta(id,nome,cor_hex,ordem)`) 
          .order('criado_em', { ascending: false });

        if (supaError) throw supaError;
        if (!mounted) return;

        const pick = (val: any) => Array.isArray(val) ? val[0] : val;

        const mapped: Pedido[] = (data || []).map((row: any) => {
          const usuarioRow = pick(row.usuarios);
          const plataformaRow = pick(row.plataformas);
          const statusRow = pick(row.status);
          const etiquetaRow = pick(row.tipos_etiqueta);

          return {
            id: row.id,
            idExterno: row.id_externo,
            clienteNome: row.cliente_nome,
            contato: row.contato || '',
            responsavelId: row.responsavel_id,
            plataformaId: row.plataforma_id,
            statusId: row.status_id,
            etiquetaEnvio: etiquetaRow?.nome || (row.etiqueta_envio_id ? 'PENDENTE' : 'NAO_LIBERADO'),
            urgente: !!row.urgente,
            dataPrevista: row.data_prevista || undefined,
            observacoes: row.observacoes || '',
            itens: [],
            responsavel: usuarioRow ? { id: usuarioRow.id, nome: usuarioRow.nome, email: '', papel: 'operador', avatar: usuarioRow.img_url || undefined, ativo: true, criadoEm: '', atualizadoEm: '' } : undefined,
            plataforma: plataformaRow ? { id: plataformaRow.id, nome: plataformaRow.nome, cor: plataformaRow.cor, imagemUrl: plataformaRow.img_url || undefined, criadoEm: '', atualizadoEm: '' } : undefined,
            status: statusRow ? { id: statusRow.id, nome: statusRow.nome, corHex: statusRow.cor_hex, ordem: statusRow.ordem ?? 0, criadoEm: '', atualizadoEm: '' } : undefined,
            criadoEm: row.criado_em,
            atualizadoEm: row.atualizado_em,
            etiqueta: etiquetaRow ? { id: etiquetaRow.id, nome: etiquetaRow.nome, corHex: etiquetaRow.cor_hex, ordem: etiquetaRow.ordem ?? 0, criadoEm: '', atualizadoEm: '' } : undefined,
          }
        });

        setPedidos(mapped);
      } catch (err: any) {
        console.error('Erro ao buscar pedidos produção', err);
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();
    return () => { mounted = false };
  }, []);
  const { toast } = useToast();

  const handleOrderMove = (pedidoId: string, newStatusId: string) => {
    // capture previous state for rollback if needed
    const previousPedidos = pedidos;

    // optimistic update
    setPedidos(prev => prev.map(pedido => 
      pedido.id === pedidoId 
        ? { 
            ...pedido, 
            statusId: newStatusId,
            status: statusList.find((s: any) => s.id === newStatusId) || pedido.status,
            atualizadoEm: new Date().toISOString()
          }
        : pedido
    ));

    // persist change to Supabase
    (async () => {
      try {
        const { data: updated, error: updateError } = await supabase
          .from('pedidos')
          .update({ status_id: newStatusId, atualizado_em: new Date().toISOString() })
          .eq('id', pedidoId)
          .select()
          .single();

        if (updateError) throw updateError;

        const movedPedido = previousPedidos.find(p => p.id === pedidoId);
        const novoStatus = statusList.find((s: any) => s.id === newStatusId);

        toast({
          title: "Status atualizado",
          description: `Pedido ${movedPedido?.idExterno || updated?.id_externo} movido para ${novoStatus?.nome}`,
        });
      } catch (err: any) {
        console.error('Erro ao atualizar status do pedido', err);
        // rollback
        setPedidos(previousPedidos);
        toast({
          title: 'Erro ao atualizar status',
          description: err?.message || String(err),
          variant: 'destructive'
        });
      }
    })();
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
          {loading && <div className="text-sm text-muted-foreground">Carregando pedidos...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          <KanbanBoard
            pedidos={pedidos}
            status={statusList}
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