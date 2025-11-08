import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '@/components/layout/AppHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// statuses will be loaded from the database
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

export default function NovoPedido() {
  const navigate = useNavigate();
  const [idExterno, setIdExterno] = useState('');
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [plataforma, setPlataforma] = useState('');
  const [status, setStatus] = useState('');
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const COMERCIAL_STATUS_ID = '3ca23a64-cb1e-480c-8efa-0468ebc18097';
  const [plataformas, setPlataformas] = useState<any[]>([]);
  const [loadingPlataformas, setLoadingPlataformas] = useState(false);
  const [plataformasError, setPlataformasError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [produtosList, setProdutosList] = useState<any[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [produtosError, setProdutosError] = useState<string | null>(null);
  const [variationSelections, setVariationSelections] = useState<Record<string, string>>({});
  const [brindeSelections, setBrindeSelections] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // currency strings for inputs (pt-BR), store as strings to allow comma typing
  const [valorInvestidoStr, setValorInvestidoStr] = useState<string>('0,00');
  const [freteVendaStr, setFreteVendaStr] = useState<string>('0,00');

  const parsePtBR = (v: string) => {
    if (!v) return 0;
    const cleaned = String(v).trim().replace(/\./g, '').replace(/,/g, '.');
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
  };

  const formatPtBR = (n: number) => {
    return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const normalizeAndFormatCurrencyInput = (raw: string) => {
    // keep only digits
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '0,00';
    // cents are last 2 digits
    const cents = digits.slice(-2).padStart(2, '0');
    const intPart = digits.slice(0, -2) || '0';
    // format integer part with thousand separators
    const intFormatted = Number(intPart).toLocaleString('pt-BR');
    return `${intFormatted},${cents}`;
  };
  
  // Phone/Contato formatting (pt-BR)
  const formatPhonePtBR = (digitsOrRaw: string) => {
    if (!digitsOrRaw) return '';
    const digits = String(digitsOrRaw).replace(/\D/g, '');
    if (!digits) return '';
    // limit to 11 digits (DDD + 9) maximum
    const d = digits.slice(0, 11);
    const ddd = d.slice(0, 2);
    const rest = d.slice(2);
    if (!rest) return `(${ddd}) `;
    if (rest.length <= 4) return `(${ddd}) ${rest}`;
    if (rest.length <= 8) {
      const part1 = rest.slice(0, rest.length - 4);
      const part2 = rest.slice(-4);
      return `(${ddd}) ${part1}-${part2}`;
    }
    // mobile 9-digit
    const part1 = rest.slice(0, 5);
    const part2 = rest.slice(5, 9);
    return `(${ddd}) ${part1}-${part2}`;
  };

  const normalizePhoneInput = (raw: string) => {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
    return formatPhonePtBR(digits);
  };
  

  const produtos = produtosList.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase()));

  const addToCart = (produto: any, variacaoId?: string, brinde?: boolean) => {
    const variacoes = produto.variacoes || [];
    const variacao = variacaoId ? variacoes.find((v: any) => v.id === variacaoId) : variacoes[0];
    const itemId = variacao ? `${produto.id}:${variacao.id}` : produto.id;
    const name = variacao ? `${produto.nome} ${variacao.nome ? `- ${variacao.nome}` : ''}` : produto.nome;
    const unitary = variacao ? Number(variacao.valor || produto.preco) : Number(produto.preco || 0);

    setCart((prev) => {
      // Use `id` and `preco` fields expected by the UI
      const existing = prev.find((i) => i.id === itemId && !!i.brinde === !!brinde);
      if (existing) return prev.map((i) => i.id === itemId ? { ...i, quantidade: i.quantidade + 1 } : i);
  return [...prev, { id: itemId, produtoId: produto.id, nome: name, quantidade: 1, preco: unitary, imagemUrl: variacao?.img_url || produto.imagemUrl || produto.img_url, codigo_barras: variacao?.codigo_barras_v || produto.codigo_barras || null, brinde: !!brinde }];
    });
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));

  const total = cart.reduce((s, it) => s + (Number(it.preco || it.unitary_value || 0) * Number(it.quantidade || 0)), 0);

  useEffect(() => {
    let mounted = true;
    const loadPlataformas = async () => {
      setLoadingPlataformas(true);
      setPlataformasError(null);
      try {
        const { data, error } = await supabase.from('plataformas').select('*').order('nome');
        if (error) throw error;
        if (!mounted) return;
        setPlataformas(data || []);
        if (!plataforma && data && data.length) setPlataforma(data[0].id);
      } catch (err: any) {
        console.error('Erro ao carregar plataformas:', err);
        setPlataformasError(err?.message || String(err));
      } finally {
        setLoadingPlataformas(false);
      }
    };

    loadPlataformas();
    // load statuses
    (async () => {
      setLoadingStatuses(true);
      try {
        const { data, error } = await supabase.from('status').select('*').order('ordem', { ascending: true });
        if (error) throw error;
        if (!mounted) return;
        setStatuses(data || []);
        // default to COMERCIAL if present, otherwise first
        const hasComercial = (data || []).some((s: any) => s.id === COMERCIAL_STATUS_ID);
        if (hasComercial) setStatus(COMERCIAL_STATUS_ID);
        else if (!status && data && data.length) setStatus(data[0].id);
      } catch (err: any) {
        console.error('Erro ao carregar status:', err);
      } finally {
        setLoadingStatuses(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  const handleCreatePedido = async () => {
    if (!plataforma) {
      toast({ title: 'Erro', description: 'Selecione uma plataforma', variant: 'destructive' });
      return;
    }
    if (!cart.length) {
      toast({ title: 'Erro', description: 'Adicione ao menos um item ao carrinho', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // insert pedido
      const now = new Date();
      let criadoEm: string;
      if (selectedDate) {
        // selectedDate is YYYY-MM-DD from input[type=date]
        const [y, m, d] = selectedDate.split('-').map((v) => Number(v));
        // create a new Date with today's time but date from selectedDate
        const withTime = new Date(now);
        withTime.setFullYear(y, (m || 1) - 1, d || 1);
        criadoEm = withTime.toISOString();
      } else {
        criadoEm = now.toISOString();
      }
      const pedidoPayload: any = {
        id_externo: idExterno || null,
        cliente_nome: nome || null,
        // send only digits for contato to the backend
        contato: contato ? String(contato).replace(/\D/g, '') : null,
        plataforma_id: plataforma,
        status_id: status || null,
        responsavel_id: user?.id || null,
        // valor_total column (sum of cart items)
        valor_total: total,
        // frete_venda column (parsed from pt-BR input)
        frete_venda: parsePtBR(freteVendaStr),
        criado_em: criadoEm
      };

      const { data: pedidoData, error: pedidoError } = await supabase.from('pedidos').insert(pedidoPayload).select('id').single();
      if (pedidoError) throw pedidoError;

      const pedidoId = (pedidoData as any).id;

      // create a cliente record linked to this pedido
      try {
        const clientePayload: any = {
          nome: nome || null,
          telefone: contato ? String(contato).replace(/\D/g, '') : null,
          link_formulario: `/${pedidoId}`,
          pedido_id: pedidoId,
          criado_em: new Date().toISOString()
        };
        const { error: clienteError } = await supabase.from('clientes').insert(clientePayload as any);
        if (clienteError) {
          console.error('Erro ao criar cliente vinculado ao pedido:', clienteError);
          toast({ title: 'Aviso', description: 'Pedido criado, mas falha ao criar cliente vinculado.', variant: 'destructive' });
        }
      } catch (cliErr) {
        console.error('Exceção ao criar cliente:', cliErr);
        toast({ title: 'Aviso', description: 'Pedido criado, mas ocorreu um erro ao criar cliente.', variant: 'destructive' });
      }

      // prepare itens_pedido: expand each cart item into N rows (one per unit)
      const itens = cart.reduce((acc: any[], it) => {
        const [produtoId, variacaoId] = String(it.id).split(':');
        const qty = Number(it.quantidade || 1);
        for (let i = 0; i < qty; i++) {
          acc.push({
            pedido_id: pedidoId,
            produto_id: it.produtoId || produtoId,
            variacao_id: variacaoId || null,
            quantidade: 1,
            preco_unitario: it.preco || 0,
            codigo_barras: it.codigo_barras || null,
            criado_em: new Date().toISOString()
          });
        }
        return acc;
      }, [] as any[]);

      const { error: itensError } = await supabase.from('itens_pedido').insert(itens as any);
      if (itensError) throw itensError;

      toast({ title: 'Pedido criado', description: 'Pedido e itens salvos com sucesso' });
      navigate(`/pedido/${pedidoId}`);
    } catch (err: any) {
      console.error('Erro ao criar pedido:', err);
      toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // load produtos and variations
  useEffect(() => {
    let mounted = true;
    const loadProdutos = async () => {
      setLoadingProdutos(true);
      setProdutosError(null);
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select('id,nome,sku,preco,unidade,categoria,img_url,qntd,nome_variacao,codigo_barras,criado_em,atualizado_em, variacoes_produto(id,nome,sku,valor,qntd,img_url,codigo_barras_v)')
          .order('criado_em', { ascending: false });

        if (error) throw error;
        if (!mounted) return;

        const mapped = (data || []).map((p: any) => ({
          id: p.id,
          nome: p.nome,
          sku: p.sku,
          preco: Number(p.preco || 0),
          unidade: p.unidade || 'un',
          categoria: p.categoria || '',
          imagemUrl: p.img_url || undefined,
          codigo_barras: p.codigo_barras || null,
          variacoes: (p.variacoes_produto || []).map((v: any) => ({ id: v.id, nome: v.nome, sku: v.sku, valor: Number(v.valor || 0), qntd: v.qntd ?? 0, img_url: v.img_url || null, codigo_barras_v: v.codigo_barras_v || null })),
          nomeVariacao: p.nome_variacao || null,
          qntd: p.qntd ?? 0,
          criadoEm: p.criado_em,
          atualizadoEm: p.atualizado_em,
        }));

        setProdutosList(mapped);
        // set default variation selections
        const defaults: Record<string, string> = {};
        const brindeDefaults: Record<string, boolean> = {};
        mapped.forEach((pr) => {
          if (pr.variacoes && pr.variacoes.length) defaults[pr.id] = pr.variacoes[0].id;
          brindeDefaults[pr.id] = false;
        });
        setVariationSelections(defaults);
        setBrindeSelections(brindeDefaults);
      } catch (err: any) {
        console.error('Erro ao carregar produtos:', err);
        setProdutosError(err?.message || String(err));
      } finally {
        setLoadingProdutos(false);
      }
    };

    loadProdutos();
    return () => { mounted = false };
  }, []);

  return (
    <>
      <AppHeader activeModule="comercial" onModuleChange={(m) => navigate('/?module=' + m)} />

      <main className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
              <button onClick={() => navigate('/?module=comercial')} className="text-sm text-muted-foreground hover:underline">&lt; Ver todos os pedidos</button>
              <h1 className="text-2xl font-bold">Novo Pedido</h1>
            </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 border rounded-lg px-3 py-2">
              <input
                type="date"
                className="border-none outline-none"
                value={selectedDate || ''}
                onChange={(e) => setSelectedDate(e.target.value || null)}
              />
              <button type="button" className="bg-purple-700 text-white px-3 py-1 rounded-md" onClick={() => setSelectedDate(new Date().toISOString().slice(0,10))}>Hoje</button>
            </div>
            <Button variant="outline" onClick={() => navigate('/?module=comercial')}>Cancelar</Button>
            <Button className="bg-purple-700 text-white" onClick={async () => await handleCreatePedido()} disabled={saving}>{saving ? 'Criando...' : '+ Criar Pedido'}</Button>
          </div>
        </div>

        <Card>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="text-sm">ID do Pedido</label>
                <Input value={idExterno} onChange={(e) => setIdExterno(e.target.value)} />
              </div>

              <div>
                <label className="text-sm">Nome</label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>

              <div>
                <label className="text-sm">Contato</label>
                <Input
                  value={contato}
                  onChange={(e) => setContato(normalizePhoneInput(e.target.value))}
                  onBlur={() => setContato(formatPhonePtBR(contato))}
                />
              </div>

              {/* Currency inputs similar to Editar Pedido (pt-BR) - placed as three columns to match other inputs */}
              <div>
                <label className="text-sm">Total investido</label>
                <Input
                  className="w-full"
                  value={valorInvestidoStr}
                  onChange={(e) => setValorInvestidoStr(normalizeAndFormatCurrencyInput(e.target.value))}
                  onBlur={() => setValorInvestidoStr(formatPtBR(parsePtBR(valorInvestidoStr)))}
                />
              </div>

              <div>
                <label className="text-sm">Frete: Venda</label>
                <Input
                  className="w-full"
                  value={freteVendaStr}
                  onChange={(e) => setFreteVendaStr(normalizeAndFormatCurrencyInput(e.target.value))}
                  onBlur={() => setFreteVendaStr(formatPtBR(parsePtBR(freteVendaStr)))}
                />
              </div>

              <div>
                <label className="text-sm">Valor sem frete</label>
                <Input
                  className="w-full"
                  value={formatPtBR(Math.max(0, parsePtBR(valorInvestidoStr) - parsePtBR(freteVendaStr)))}
                  readOnly
                />
              </div>

              

              <div>
                <label className="text-sm">Plataforma de venda</label>
                <select className="w-full border rounded p-2" value={plataforma} onChange={(e) => setPlataforma(e.target.value)}>
                  {loadingPlataformas ? (
                    <option>Carregando...</option>
                  ) : plataformasError ? (
                    <option>Erro ao carregar</option>
                  ) : (
                    plataformas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm">Transportadora</label>
                <select className="w-full border rounded p-2">
                  <option>Não definido</option>
                </select>
              </div>

              <div>
                <label className="text-sm">Status do pedido</label>
                <select className="w-full border rounded p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {loadingStatuses ? (
                    <option>Carregando...</option>
                  ) : (
                    statuses.map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="mb-4">
              <Input placeholder="Buscar produto" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="space-y-4">
              {loadingProdutos && <div className="text-sm text-muted-foreground">Carregando produtos...</div>}
              {produtosError && <div className="text-sm text-destructive">Erro: {produtosError}</div>}
              {!loadingProdutos && !produtosError && produtos.map((p) => (
                <div key={p.id} className="flex items-center gap-4">
                  <img src={p.imagemUrl} alt={p.nome} className="w-12 h-12 rounded" />
                  <div className="flex-1">
                    <div className="font-medium text-purple-700">{p.nome}</div>
                    <div className="text-sm text-muted-foreground">R$ {p.preco.toFixed(2)}</div>
                  </div>

                  <div className="w-48">
                    {p.variacoes && p.variacoes.length > 0 ? (
                      <select className="w-full border rounded p-2" value={variationSelections[p.id] || ''} onChange={(e) => setVariationSelections((s) => ({ ...s, [p.id]: e.target.value }))}>
                        {p.variacoes.map((v: any) => (
                          <option key={v.id} value={v.id}>{v.nome} - R$ {Number(v.valor).toFixed(2)}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-sm text-muted-foreground">Sem variações</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm">
                      <input type="checkbox" checked={brindeSelections[p.id] || false} onChange={(e) => setBrindeSelections((s) => ({ ...s, [p.id]: e.target.checked }))} />
                      <span className="ml-2">Brinde</span>
                    </label>
                  </div>

                  <div>
                    <Button onClick={() => addToCart(p, variationSelections[p.id], brindeSelections[p.id])} className="bg-purple-600 text-white">+</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>
                  ITENS DO CARRINHO <span className="text-sm text-muted-foreground">{cart.length} <span>R$ {total.toFixed(2)}</span></span>
                </CardTitle>
              </CardHeader>

              <CardContent>
                <Table>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img src={item.imagemUrl} className="w-10 h-10 rounded" />
                            <div>
                              <div className="font-medium">{item.nome}</div>
                              <div className="text-sm text-muted-foreground">R$ {item.preco.toFixed(2)}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{item.quantidade}</TableCell>
                        <TableCell>R$ {(item.preco * item.quantidade).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" onClick={() => removeFromCart(item.id)}>
                            🗑️
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
