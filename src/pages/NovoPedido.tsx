import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
  const { user, empresaId } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // currency strings for inputs (pt-BR), store as strings to allow comma typing
  const [valorInvestidoStr, setValorInvestidoStr] = useState<string>('0,00');
  const [freteVendaStr, setFreteVendaStr] = useState<string>('0,00');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [formaPagamento, setFormaPagamento] = useState<string>('Pix');
  const [formasPagamentos, setFormasPagamentos] = useState<any[]>([]);
  const [loadingFormasPagamentos, setLoadingFormasPagamentos] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [paymentValues, setPaymentValues] = useState<Record<string, string>>({});
  const [showCartaoDropdown, setShowCartaoDropdown] = useState(false);
  const cartaoDropdownRef = useRef<HTMLDivElement>(null);
  const [remetentes, setRemetentes] = useState<any[]>([]);
  const [selectedRemetente, setSelectedRemetente] = useState<string>('');
  const [loadingRemetentes, setLoadingRemetentes] = useState(false);

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
  
  // Close cartao dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cartaoDropdownRef.current && !cartaoDropdownRef.current.contains(event.target as Node)) {
        setShowCartaoDropdown(false);
      }
    };

    if (showCartaoDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCartaoDropdown]);

  // Atualizar total investido quando valores de pagamento mudarem
  useEffect(() => {
    const total = Object.values(paymentValues).reduce((sum, val) => {
      return sum + parsePtBR(val);
    }, 0);
    setValorInvestidoStr(formatPtBR(total));
  }, [paymentValues]);

  const filteredProdutos = produtosList.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filteredProdutos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const produtos = filteredProdutos.slice(startIndex, endIndex);

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
    // load formas de pagamento
    (async () => {
      setLoadingFormasPagamentos(true);
      try {
        const { data, error } = await (supabase as any).from('formas_pagamentos').select('*').order('id');
        if (error) throw error;
        if (!mounted) return;
        setFormasPagamentos(data || []);
      } catch (err: any) {
        console.error('Erro ao carregar formas de pagamento:', err);
      } finally {
        setLoadingFormasPagamentos(false);
      }
    })();
    // load remetentes
    (async () => {
      setLoadingRemetentes(true);
      try {
        const { data, error } = await supabase.from('remetentes').select('*').order('nome');
        if (error) throw error;
        if (!mounted) return;
        setRemetentes(data || []);
      } catch (err: any) {
        console.error('Erro ao carregar remetentes:', err);
      } finally {
        setLoadingRemetentes(false);
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
        id_externo: idExterno || `PED-${Date.now()}`,
        cliente_nome: nome || null,
        // send only digits for contato to the backend
        contato: contato ? String(contato).replace(/\D/g, '') : null,
        plataforma_id: plataforma,
        status_id: status || null,
        responsavel_id: user?.id || null,
        // valor_total é o valor investido (já inclui o frete)
        valor_total: parsePtBR(valorInvestidoStr),
        // frete_venda column (parsed from pt-BR input)
        frete_venda: parsePtBR(freteVendaStr),
        pagamento: formaPagamento || null,
        criado_em: criadoEm,
        empresa_id: empresaId || null,
        remetente_id: selectedRemetente || null
      };

      const { data: pedidoData, error: pedidoError } = await supabase.from('pedidos').insert(pedidoPayload).select('id').single();
      if (pedidoError) throw pedidoError;

      const pedidoId = (pedidoData as any).id;

      // Insert payment methods into lista_pagamentos for each selected forma de pagamento
      if (selectedPaymentIds.length > 0) {
        try {
          const pagementRecords = selectedPaymentIds.map(id => ({
            pedido_id: pedidoId,
            formas_pagamentos_id: id,
            valor: parsePtBR(paymentValues[id] || '0,00')
          }));
          const { error: pagamentoError } = await (supabase as any).from('lista_pagamentos').insert(pagementRecords);
          if (pagamentoError) {
            console.error('Erro ao inserir formas de pagamento:', pagamentoError);
            toast({ title: 'Aviso', description: 'Pedido criado, mas falha ao registrar as formas de pagamento.', variant: 'destructive' });
          }
        } catch (err) {
          console.error('Exceção ao inserir formas de pagamento:', err);
          toast({ title: 'Aviso', description: 'Pedido criado, mas ocorreu um erro ao registrar as formas de pagamento.', variant: 'destructive' });
        }
      }

      // create a cliente record linked to this pedido
      try {
        const clientePayload: any = {
          nome: nome || null,
          telefone: contato ? String(contato).replace(/\D/g, '') : null,
          link_formulario: `/${pedidoId}`,
          pedido_id: pedidoId,
          criado_em: new Date().toISOString(),
          empresa_id: empresaId || null
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
      const itens = [];
      for (const it of cart) {
        const [produtoId, variacaoId] = String(it.id).split(':');
        const qty = Number(it.quantidade || 1);
        
        // Buscar dimensões do produto ou variação
        let dimensoes = { altura: null, largura: null, comprimento: null, peso: null };
        
        try {
          // Se tem variação, buscar da variação primeiro
          if (variacaoId) {
            const { data: variacaoData } = await supabase
              .from('variacoes_produto')
              .select('altura, largura, comprimento, peso')
              .eq('id', variacaoId)
              .maybeSingle();
            
            if (variacaoData) {
              dimensoes = {
                altura: variacaoData.altura,
                largura: variacaoData.largura,
                comprimento: variacaoData.comprimento,
                peso: variacaoData.peso
              };
            }
          }
          
          // Se não tem variação ou a variação não tem dimensões, buscar do produto
          if (!dimensoes.altura && !dimensoes.peso) {
            const { data: produtoData } = await supabase
              .from('produtos')
              .select('altura, largura, comprimento, peso')
              .eq('id', it.produtoId || produtoId)
              .maybeSingle();
            
            if (produtoData) {
              dimensoes = {
                altura: produtoData.altura,
                largura: produtoData.largura,
                comprimento: produtoData.comprimento,
                peso: produtoData.peso
              };
            }
          }
        } catch (err) {
          console.error('Erro ao buscar dimensões:', err);
        }
        
        for (let i = 0; i < qty; i++) {
          itens.push({
            pedido_id: pedidoId,
            produto_id: it.produtoId || produtoId,
            variacao_id: variacaoId || null,
            quantidade: 1,
            preco_unitario: it.preco || 0,
            codigo_barras: it.codigo_barras || null,
            altura: dimensoes.altura,
            largura: dimensoes.largura,
            comprimento: dimensoes.comprimento,
            peso: dimensoes.peso,
            criado_em: new Date().toISOString(),
            empresa_id: empresaId || null
          });
        }
      }

      const { error: itensError } = await supabase.from('itens_pedido').insert(itens as any);
      if (itensError) throw itensError;

      // Incrementar contagem dos produtos adicionados
      const productCounts: Record<string, number> = {};
      cart.forEach(it => {
        const [produtoId] = String(it.id).split(':');
        const productId = it.produtoId || produtoId;
        const qty = Number(it.quantidade || 1);
        productCounts[productId] = (productCounts[productId] || 0) + qty;
      });

      for (const [productId, count] of Object.entries(productCounts)) {
        await (supabase as any).rpc('increment', {
          row_id: productId,
          x: count
        }).eq('id', productId);
        
        // Fallback: se a função RPC não existir, usar update direto
        const { data: currentProduct } = await supabase
          .from('produtos')
          .select('contagem')
          .eq('id', productId)
          .single();
        
        if (currentProduct) {
          await supabase
            .from('produtos')
            .update({ contagem: (currentProduct.contagem || 0) + count })
            .eq('id', productId);
        }
      }

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
          .select('id,nome,sku,preco,unidade,categoria,img_url,qntd,nome_variacao,codigo_barras,criado_em,atualizado_em,contagem, variacoes_produto(id,nome,sku,valor,qntd,img_url,codigo_barras_v,ordem)')
          .order('contagem', { ascending: false, nullsFirst: false })
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
          variacoes: (p.variacoes_produto || [])
            .map((v: any) => ({ id: v.id, nome: v.nome, sku: v.sku, valor: Number(v.valor || 0), qntd: v.qntd ?? 0, img_url: v.img_url || null, codigo_barras_v: v.codigo_barras_v || null, ordem: v.ordem ?? 999 }))
            .sort((a: any, b: any) => a.ordem - b.ordem),
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
      <main className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
              <button onClick={() => navigate('/comercial')} className="text-sm text-muted-foreground hover:underline">&lt; Ver todos os pedidos</button>
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
              <button type="button" className="bg-custom-700 text-white px-3 py-1 rounded-md" onClick={() => setSelectedDate(new Date().toISOString().slice(0,10))}>Hoje</button>
            </div>
            <Button variant="outline" onClick={() => navigate('/comercial')}>Cancelar</Button>
            <Button className="bg-custom-700 text-white" onClick={async () => await handleCreatePedido()} disabled={saving}>{saving ? 'Criando...' : '+ Criar Pedido'}</Button>
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

              <div>
                <label className="text-sm">Remetente</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={selectedRemetente}
                  onChange={(e) => setSelectedRemetente(e.target.value)}
                >
                  <option value="">Selecione um remetente</option>
                  {loadingRemetentes ? (
                    <option disabled>Carregando...</option>
                  ) : (
                    remetentes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome}{r.cidade ? ` - ${r.cidade}` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Currency inputs e formas de pagamento na mesma linha */}
              <div className="col-span-3 flex gap-4 items-start">
                {/* Coluna 1: Forma de Pagamento - tamanho dinâmico */}
                <div className={`${selectedPaymentIds.length === 0 ? 'flex-[2]' : 'flex-1'} min-w-[200px] transition-all duration-300`}>
                  <label className="text-sm">Forma de Pagamento</label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {loadingFormasPagamentos ? (
                      <div className="text-xs text-gray-500">Carregando...</div>
                    ) : formasPagamentos.length === 0 ? (
                      <div className="text-xs text-gray-500">Nenhuma disponível</div>
                    ) : (
                      <>
                        {/* Mostrar formas de pagamento que NÃO são cartão */}
                        {formasPagamentos.filter(f => !f.nome?.toLowerCase().includes('cartão') && !f.nome?.toLowerCase().includes('cartao')).map((forma) => {
                          const isSelected = selectedPaymentIds.includes(String(forma.id));
                          return (
                            <div key={forma.id} className="relative group">
                              <button
                                type="button"
                                onClick={() => {
                                  const isCurrentlySelected = selectedPaymentIds.includes(String(forma.id));
                                  setSelectedPaymentIds(prev =>
                                    isCurrentlySelected
                                      ? prev.filter(id => id !== String(forma.id))
                                      : [...prev, String(forma.id)]
                                  );
                                  // Remover valor se desmarcar
                                  if (isCurrentlySelected) {
                                    setPaymentValues(prev => {
                                      const updated = { ...prev };
                                      delete updated[String(forma.id)];
                                      return updated;
                                    });
                                  }
                                }}
                                className={`relative p-2 rounded-lg transition-all ${
                                  isSelected
                                    ? 'border-2 border-custom-700 bg-custom-50 shadow-md'
                                    : 'border-2 border-gray-200 hover:border-gray-400 hover:shadow-sm'
                                }`}
                                title={forma.nome}
                              >
                                {forma.img_url && (
                                  <img
                                    src={forma.img_url}
                                    alt={forma.nome}
                                    className="w-6 h-6 object-contain"
                                  />
                                )}
                                {isSelected && (
                                  <div className="absolute top-0 right-0 transform translate-x-1 -translate-y-1 bg-custom-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">
                                    ✓
                                  </div>
                                )}
                              </button>
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                {forma.nome}
                              </div>
                            </div>
                          );
                        })}

                        {/* Card especial para Cartão com dropdown */}
                        {formasPagamentos.find(f => f.nome?.toLowerCase().includes('cartão') || f.nome?.toLowerCase().includes('cartao')) && (
                          <div ref={cartaoDropdownRef} className="relative group">
                            <button
                              type="button"
                              onClick={() => setShowCartaoDropdown(!showCartaoDropdown)}
                              className={`relative p-2 rounded-lg transition-all ${
                                selectedPaymentIds.some(id => formasPagamentos.find(f => String(f.id) === id && (f.nome?.toLowerCase().includes('cartão') || f.nome?.toLowerCase().includes('cartao'))))
                                  ? 'border-2 border-custom-700 bg-custom-50 shadow-md'
                                  : 'border-2 border-gray-200 hover:border-gray-400 hover:shadow-sm'
                              }`}
                              title="Cartão"
                            >
                              {(() => {
                                const cartaoGenerico = formasPagamentos.find(f => f.nome?.toLowerCase().includes('cartão') || f.nome?.toLowerCase().includes('cartao'));
                                return cartaoGenerico?.img_url ? (
                                  <img
                                    src={cartaoGenerico.img_url}
                                    alt="Cartão"
                                    className="w-6 h-6 object-contain"
                                  />
                                ) : null;
                              })()}
                              {selectedPaymentIds.some(id => formasPagamentos.find(f => String(f.id) === id && (f.nome?.toLowerCase().includes('cartão') || f.nome?.toLowerCase().includes('cartao')))) && (
                                <div className="absolute top-0 right-0 transform translate-x-1 -translate-y-1 bg-custom-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">
                                  ✓
                                </div>
                              )}
                            </button>

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              Cartão
                            </div>

                            {/* Dropdown de tipos de cartão */}
                            {showCartaoDropdown && (
                              <div className="absolute top-full left-0 mt-2 bg-white border-2 rounded-lg shadow-lg z-10 min-w-max">
                                <div className="p-2 max-h-80 overflow-y-auto">
                                  {formasPagamentos.filter(f => f.nome?.toLowerCase().includes('cartão') || f.nome?.toLowerCase().includes('cartao')).map((forma) => {
                                    const isSelected = selectedPaymentIds.includes(String(forma.id));
                                    return (
                                      <button
                                        key={forma.id}
                                        type="button"
                                        onClick={() => {
                                          if (isSelected) {
                                            setSelectedPaymentIds(prev => prev.filter(id => id !== String(forma.id)));
                                            // Remover valor se desmarcar
                                            setPaymentValues(prev => {
                                              const updated = { ...prev };
                                              delete updated[String(forma.id)];
                                              return updated;
                                            });
                                          } else {
                                            // Remove outros cartões mas mantém não-cartão
                                            const nonCardPayments = selectedPaymentIds.filter(id => {
                                              const payment = formasPagamentos.find(f => String(f.id) === id);
                                              return !payment?.nome?.toLowerCase().includes('cartão') && !payment?.nome?.toLowerCase().includes('cartao');
                                            });
                                            // Remover valores dos cartões removidos
                                            setPaymentValues(prev => {
                                              const updated = { ...prev };
                                              selectedPaymentIds.forEach(id => {
                                                const payment = formasPagamentos.find(f => String(f.id) === id);
                                                if (payment?.nome?.toLowerCase().includes('cartão') || payment?.nome?.toLowerCase().includes('cartao')) {
                                                  delete updated[id];
                                                }
                                              });
                                              return updated;
                                            });
                                            setSelectedPaymentIds([...nonCardPayments, String(forma.id)]);
                                          }
                                        }}
                                        className={`w-full text-left rounded-lg flex items-center gap-3 transition-colors px-3 py-2 ${
                                          isSelected
                                            ? 'bg-custom-100 border-2 border-custom-500'
                                            : 'border-2 border-transparent hover:bg-gray-50'
                                        }`}
                                      >
                                        {forma.img_url && (
                                          <img
                                            src={forma.img_url}
                                            alt={forma.nome}
                                            className="w-8 h-8 object-contain"
                                          />
                                        )}
                                        <span className="font-medium text-sm">{forma.nome}</span>
                                        {isSelected && (
                                          <span className="ml-auto text-custom-600">✓</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Inputs para valores de cada forma de pagamento selecionada */}
                {selectedPaymentIds.length > 0 && (
                  <div className={`flex gap-4 ${selectedPaymentIds.length === 1 ? 'flex-[3]' : 'flex-[4]'} transition-all duration-300`}>
                    {selectedPaymentIds.map(paymentId => {
                      const payment = formasPagamentos.find(f => String(f.id) === paymentId);
                      if (!payment) return null;
                      return (
                        <div key={paymentId} className="flex-1">
                          <label className="text-sm font-medium">{payment.nome}</label>
                          <Input
                            className="w-full text-base h-11"
                            value={paymentValues[paymentId] || '0,00'}
                            onChange={(e) => {
                              const normalized = normalizeAndFormatCurrencyInput(e.target.value);
                              setPaymentValues(prev => ({
                                ...prev,
                                [paymentId]: normalized
                              }));
                            }}
                            placeholder="0,00"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Coluna 2: Total investido - dinâmico */}
                <div className={`${selectedPaymentIds.length === 0 ? 'flex-[2]' : 'flex-[1.2]'} transition-all duration-300`}>
                  <label className="text-sm font-medium">Total investido</label>
                  <Input
                    className="w-full bg-gray-50 text-base font-semibold h-11"
                    value={valorInvestidoStr}
                    readOnly
                    disabled
                  />
                </div>

                {/* Coluna 3: Frete Venda - dinâmico */}
                <div className={`${selectedPaymentIds.length === 0 ? 'flex-[2]' : 'flex-1'} transition-all duration-300`}>
                  <label className="text-sm font-medium">Frete: Venda</label>
                  <Input
                    className="w-full text-base h-11"
                    value={freteVendaStr}
                    onChange={(e) => setFreteVendaStr(normalizeAndFormatCurrencyInput(e.target.value))}
                    onBlur={() => setFreteVendaStr(formatPtBR(parsePtBR(freteVendaStr)))}
                  />
                </div>

                {/* Coluna 4: Valor sem frete - dinâmico */}
                <div className={`${selectedPaymentIds.length === 0 ? 'flex-[2]' : 'flex-1'} transition-all duration-300`}>
                  <label className="text-sm font-medium">Valor sem frete</label>
                  <Input
                    className="w-full bg-gray-50 text-base h-11"
                    value={formatPtBR(Math.max(0, parsePtBR(valorInvestidoStr) - parsePtBR(freteVendaStr)))}
                    readOnly
                  />
                </div>
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
              <Input placeholder="Buscar produto" value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} />
            </div>

            <div className="space-y-4">
              {loadingProdutos && <div className="text-sm text-muted-foreground">Carregando produtos...</div>}
              {produtosError && <div className="text-sm text-destructive">Erro: {produtosError}</div>}
              {!loadingProdutos && !produtosError && produtos.map((p) => (
                <div key={p.id} className="flex items-center gap-4">
                  <img src={p.imagemUrl} alt={p.nome} className="w-12 h-12 rounded" />
                  <div className="flex-1">
                    <div className="font-medium text-custom-700">{p.nome}</div>
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
                    <Button onClick={() => addToCart(p, variationSelections[p.id], brindeSelections[p.id])} className="bg-custom-600 text-white">+</Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination controls */}
            {!loadingProdutos && !produtosError && filteredProdutos.length > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages} ({filteredProdutos.length} produtos)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            )}
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
