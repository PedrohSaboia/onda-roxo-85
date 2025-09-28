import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function Pedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [etiquetas, setEtiquetas] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [{ data: pedidoData, error: pedidoError }, { data: statusesData, error: statusesError }, { data: usuariosData, error: usuariosError }, { data: etiquetasData, error: etiquetasError }] = await Promise.all([
          supabase
            .from('pedidos')
            .select(`*, clientes(*), usuarios(id,nome,img_url), plataformas(id,nome,cor,img_url), status(id,nome,cor_hex,ordem), tipos_etiqueta(id,nome,cor_hex,ordem), itens_pedido(id,quantidade,preco_unitario, criado_em, produto:produtos(id,nome,sku,img_url,preco), variacao:variacoes_produto(id,nome,sku,img_url,valor))`)
            .eq('id', id)
            .single(),
          supabase.from('status').select('*').order('ordem', { ascending: true }),
          supabase.from('usuarios').select('*'),
          supabase.from('tipos_etiqueta').select('*').order('ordem', { ascending: true }),
        ]);

        if (pedidoError) throw pedidoError;
        if (statusesError) throw statusesError;
        if (usuariosError) throw usuariosError;
        if (etiquetasError) throw etiquetasError;

        if (!mounted) return;

        // normalize related shapes
        const pick = (val: any) => Array.isArray(val) ? val[0] : val;
        const pedidoRow = pedidoData;
        // Prefer explicit cliente linked by pedido_id in clientes table
        let cliente: any = pick(pedidoRow.clientes);
        try {
          const res: any = await (supabase as any)
            .from('clientes')
            .select('*')
            .eq('pedido_id', id)
            .maybeSingle();
          if (!res.error && res.data) cliente = res.data;
        } catch (e) {
          // ignore, keep existing cliente
        }
        const plataforma = pick(pedidoRow.plataformas);
        const responsavel = pick(pedidoRow.usuarios);
        const statusRow = pick(pedidoRow.status);
        const etiquetaRow = pick(pedidoRow.tipos_etiqueta);

        // map itens to include produto and variacao objects when present
        const itens = (pedidoRow.itens_pedido || []).map((it: any) => ({
          id: it.id,
          quantidade: it.quantidade,
          preco_unitario: it.preco_unitario,
          produto: it.produto || null,
          variacao: it.variacao || null,
          criado_em: it.criado_em,
        }));

        setPedido({
          ...pedidoRow,
          cliente,
          plataforma,
          responsavel,
          status: statusRow ? { id: statusRow.id, nome: statusRow.nome, corHex: statusRow.cor_hex } : null,
          etiqueta: etiquetaRow ? { id: etiquetaRow.id, nome: etiquetaRow.nome, corHex: etiquetaRow.cor_hex } : null,
          itens
        });

        setStatuses((statusesData || []).map((s: any) => ({ id: s.id, nome: s.nome, corHex: s.cor_hex })));
        setUsuarios(usuariosData || []);
        setEtiquetas((etiquetasData || []).map((t: any) => ({ id: t.id, nome: t.nome, corHex: t.cor_hex })));
      } catch (err: any) {
        console.error('Erro ao buscar pedido', err);
        toast({ title: 'Erro', description: err.message || String(err), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false };
  }, [id]);

  const handleSave = async () => {
    if (!pedido) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({
          status_id: pedido.status?.id || null,
          responsavel_id: pedido.responsavel?.id || null,
          observacoes: pedido.observacoes || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', pedido.id);

      if (error) throw error;

      toast({ title: 'Pedido atualizado', description: 'Alterações salvas com sucesso' });
      // refresh
      navigate(0);
    } catch (err: any) {
      console.error('Erro ao salvar pedido', err);
      toast({ title: 'Erro', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!id) return <div className="p-6">Pedido inválido</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedido: {pedido?.id_externo || '—'}</h1>
          <p className="text-sm text-muted-foreground">em {pedido?.criado_em ? new Date(pedido.criado_em).toLocaleString('pt-BR') : '—'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge style={{ backgroundColor: pedido?.status?.corHex }}>
            {pedido?.status?.nome}
          </Badge>
          <Button onClick={() => navigate(-1)} variant="outline">Voltar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-2">
          <Card>
            <CardContent className="flex gap-8 items-start">
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">CLIENTE</div>
                <div className="font-medium text-lg">
                  {pedido?.cliente ? (
                    <a className="text-blue-600 hover:underline">{pedido.cliente.nome}</a>
                  ) : '—'}
                </div>
                <div className="text-sm text-muted-foreground">{pedido?.cliente?.email}</div>
                <div className="mt-2 text-sm">{pedido?.cliente?.telefone && (<span className="text-blue-600">{pedido.cliente.telefone}</span>)}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {pedido?.cliente?.cpf ? (<div>CPF: {pedido.cliente.cpf}</div>) : pedido?.cliente?.cnpj ? (<div>CNPJ: {pedido.cliente.cnpj}</div>) : null}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">IP da compra: {pedido?.ip || '—'}</div>
              </div>

              <div className="w-1/3">
                <div className="text-sm text-muted-foreground">PAGAMENTO</div>
                <div className="mt-2">Pix</div>
              </div>

              <div className="w-1/3">
                <div className="text-sm text-muted-foreground">ENTREGA</div>
                <div className="font-medium">{pedido?.cliente?.nome || pedido?.cliente_nome}</div>
                <div className="text-sm">{pedido?.cliente?.endereco || '-'}</div>
                <div className="mt-2 text-sm text-muted-foreground">Prazo: 0 dias</div>
                <div className="text-sm text-muted-foreground">Data prevista: {pedido?.data_prevista || '—'}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardContent>
              <div className="text-sm text-muted-foreground">VALOR TOTAL</div>
              <div className="text-2xl font-bold">R$ {pedido?.total ? Number(pedido.total).toFixed(2) : '0,00'}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <Card>
            <CardHeader>
              <CardTitle>Produtos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Valor unit.</TableHead>
                    <TableHead>Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedido?.itens?.length ? pedido.itens.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {item.produto?.img_url || item.variacao?.img_url ? (
                            <img src={item.variacao?.img_url || item.produto?.img_url} alt={item.produto?.nome || item.variacao?.nome} className="w-10 h-10 rounded" />
                          ) : null}
                          <div>
                            <div className="font-medium">{item.variacao?.nome || item.produto?.nome || item.produto_id}</div>
                            <div className="text-sm text-muted-foreground">SKU: {item.variacao?.sku || item.produto?.sku || '-'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{item.variacao?.sku || item.produto?.sku || ''}</TableCell>
                      <TableCell>{item.quantidade}</TableCell>
                      <TableCell>R$ {Number(item.preco_unitario || item.produto?.preco || 0).toFixed(2)}</TableCell>
                      <TableCell>R$ {(Number(item.preco_unitario || item.produto?.preco || 0) * item.quantidade).toFixed(2)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nenhum produto</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <Card>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="font-medium">{pedido?.status?.nome || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Plataforma</div>
                  <div className="font-medium">{pedido?.plataforma?.nome || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Etiqueta</div>
                  <div className="font-medium">{pedido?.etiqueta?.nome || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Responsável</div>
                  <div className="font-medium">{pedido?.responsavel?.nome || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Urgente</div>
                  <div className="font-medium">{pedido?.urgente ? 'Sim' : 'Não'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Observações</div>
                  <div className="font-medium whitespace-pre-wrap">{pedido?.observacoes || '—'}</div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
