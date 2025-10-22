import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import EmbalagensManager from '@/components/shipping/EmbalagensManager';
import RemetentesManager from '@/components/shipping/RemetentesManager';
import CotacaoFreteModal from '@/components/shipping/CotacaoFreteModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

function formatAddress(cliente: any) {
  if (!cliente) return '-';
  const parts = [] as string[];
  if (cliente.endereco) parts.push(cliente.endereco + (cliente.numero ? `, ${cliente.numero}` : ''));
  if (cliente.complemento) parts.push(cliente.complemento);
  const cityParts = [] as string[];
  if (cliente.bairro) cityParts.push(cliente.bairro);
  if (cliente.cidade) cityParts.push(cliente.cidade);
  if (cliente.estado) cityParts.push(cliente.estado);
  if (cityParts.length) parts.push(cityParts.join(' / '));
  if (cliente.cep) parts.push(`CEP: ${cliente.cep}`);
  return parts.join(' • ');
}

export default function Pedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [etiquetas, setEtiquetas] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [etiquetaText, setEtiquetaText] = useState('');
  const [linkEtiqueta, setLinkEtiqueta] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [calculandoFrete, setCalculandoFrete] = useState(false);
  const [cotacaoModal, setCotacaoModal] = useState(false);
  const [cotacoes, setCotacoes] = useState<CotacaoFrete[]>([]);
  const [processingLabel, setProcessingLabel] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<Record<number, string> | null>(null);
  
  // Estados para gerenciar embalagem/remetente selecionados
  const [embalagens, setEmbalagens] = useState<Embalagem[]>([]);
  const [remetentes, setRemetentes] = useState<Remetente[]>([]);
  const [embalagensVisible, setEmbalagensVisible] = useState(false);
  const [remetentesVisible, setRemetentesVisible] = useState(false);
  const [selectedEmbalagem, setSelectedEmbalagem] = useState<Embalagem | null>(null);
  const [selectedRemetente, setSelectedRemetente] = useState<Remetente | null>(null);

  const { toast } = useToast();

  // Modal: adicionar produtos
  const [addProductsVisible, setAddProductsVisible] = useState(false);
  const [produtosListModal, setProdutosListModal] = useState<any[]>([]);
  const [loadingProdutosModal, setLoadingProdutosModal] = useState(false);
  const [produtosErrorModal, setProdutosErrorModal] = useState<string | null>(null);
  const [searchModal, setSearchModal] = useState('');
  const [variationSelectionsModal, setVariationSelectionsModal] = useState<Record<string, string>>({});
  const [brindeSelectionsModal, setBrindeSelectionsModal] = useState<Record<string, boolean>>({});
  const [modalCart, setModalCart] = useState<any[]>([]);
  const [savingModal, setSavingModal] = useState(false);

  // Load produtos for modal when opened
  useEffect(() => {
    if (!addProductsVisible) return;
    let mounted = true;
    const loadProdutosModal = async () => {
      setLoadingProdutosModal(true);
      setProdutosErrorModal(null);
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select('id,nome,sku,preco,unidade,categoria,img_url,qntd,nome_variacao,criado_em,atualizado_em, variacoes_produto(id,nome,sku,valor,qntd,img_url)')
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
          variacoes: (p.variacoes_produto || []).map((v: any) => ({ id: v.id, nome: v.nome, sku: v.sku, valor: Number(v.valor || 0), qntd: v.qntd ?? 0, img_url: v.img_url || null })),
          nomeVariacao: p.nome_variacao || null,
          qntd: p.qntd ?? 0,
          criadoEm: p.criado_em,
          atualizadoEm: p.atualizado_em,
        }));

        setProdutosListModal(mapped);

        // set default selections for variations and brinde
        const defaults: Record<string, string> = {};
        const brindeDefaults: Record<string, boolean> = {};
        mapped.forEach((pr) => {
          if (pr.variacoes && pr.variacoes.length) defaults[pr.id] = pr.variacoes[0].id;
          brindeDefaults[pr.id] = false;
        });
        setVariationSelectionsModal(defaults);
        setBrindeSelectionsModal(brindeDefaults);
      } catch (err: any) {
        console.error('Erro ao carregar produtos para modal:', err);
        setProdutosErrorModal(err?.message || String(err));
      } finally {
        setLoadingProdutosModal(false);
      }
    };

    loadProdutosModal();
    return () => { mounted = false };
  }, [addProductsVisible]);

  // Tipos
  type Embalagem = {
    id: string;
    nome: string;
    altura: number;
    largura: number;
    comprimento: number;
    peso: number;
  };

  type Remetente = {
    id: string;
    nome: string;
    cep: string;
    endereco: string;
    cidade: string;
    estado: string;
    contato?: string;
    email?: string;
  };

  type CotacaoFrete = {
    service_id: number;
    transportadora: string;
    modalidade: string;
    prazo: string;
    preco: number;
    raw_response: any;
    melhorEnvioId?: string;
  };

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    
    // Carregar dados de embalagens e remetentes
    const loadData = async () => {
      try {
        const [
          { data: embalagensData, error: embalagensError },
          { data: remetentesData, error: remetentesError }
        ] = await Promise.all([
          supabase.from('embalagens').select('*').order('nome'),
          supabase.from('remetentes').select('*').order('nome')
        ]);

        if (embalagensError) throw embalagensError;
        if (remetentesError) throw remetentesError;

        setEmbalagens(embalagensData || []);
        setRemetentes(remetentesData || []);

        // Auto-selecionar primeiro remetente e embalagem
        if (embalagensData?.length) setSelectedEmbalagem(embalagensData[0]);
        if (remetentesData?.length) setSelectedRemetente(remetentesData[0]);
        // try to load payment methods table if exists
        (async () => {
          try {
            const { data: pmData, error: pmError } = await (supabase as any).from('formas_pagamento').select('id,nome');
            if (!pmError && pmData) {
              const map: Record<number, string> = {};
              pmData.forEach((r: any) => { map[r.id] = r.nome; });
              setPaymentMethods(map);
            }
          } catch (e) {
            // ignore if table doesn't exist
          }
        })();
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        toast({ 
          title: 'Erro', 
          description: 'Não foi possível carregar alguns dados',
          variant: 'destructive'
        });
      }
    };

    loadData();

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

    // init etiqueta input
  setEtiquetaText(etiquetaRow?.nome || '');
    // init link etiqueta input from pedido row (link_etiqueta is the field on pedidos)
    setLinkEtiqueta((pedidoRow as any)?.link_etiqueta ?? (pedidoRow as any)?.link_formulario ?? '');

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
          link_etiqueta: linkEtiqueta || null,
          atualizado_em: new Date().toISOString(),
        } as any)
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

  const saveLinkEtiqueta = async () => {
    if (!id) return;
    setSavingLink(true);
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ link_etiqueta: linkEtiqueta || null } as any)
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Link salvo', description: 'Link da etiqueta salvo com sucesso' });
      // refresh to show updated value if needed
      navigate(0);
    } catch (err) {
      console.error('Erro ao salvar link_etiqueta:', err);
      toast({ title: 'Erro', description: 'Não foi possível salvar o link da etiqueta', variant: 'destructive' });
    } finally {
      setSavingLink(false);
    }
  };

  const handleCalcularFrete = async () => {
    // Validar CEP do cliente
    if (!pedido?.cliente?.cep) {
      toast({ 
        title: 'Erro', 
        description: 'O CEP do cliente não está preenchido',
        variant: 'destructive'
      });
      return;
    }

    const cepLimpo = pedido.cliente.cep.replace(/\D/g, '');
    if (!/^\d{8}$/.test(cepLimpo)) {
      toast({ 
        title: 'Erro', 
        description: 'O CEP do cliente é inválido. Atualize os dados antes de prosseguir.',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedRemetente || !selectedEmbalagem) {
      toast({ 
        title: 'Erro', 
        description: 'Selecione um remetente e uma embalagem',
        variant: 'destructive'
      });
      return;
    }

  setCalculandoFrete(true);
  setCotacaoModal(true);

    console.log('Dados do remetente sendo enviados:', selectedRemetente);

    try {
      // calcular valor dos itens como seguro
      const itemsValue = (pedido?.itens || []).reduce((s: number, it: any) => s + (Number(it.preco_unitario || it.preco || 0) * Number(it.quantidade || 1)), 0);

      const payload = {
        origem: { 
          postal_code: selectedRemetente.cep.replace(/\D/g,''),
          contact: selectedRemetente.contato || selectedRemetente.nome,
          email: selectedRemetente.email || 'contato@empresa.com'
        },
        destino: { postal_code: cepLimpo },
        pacote: [{
          weight: selectedEmbalagem.peso,
          insurance_value: itemsValue || 1,
          length: selectedEmbalagem.comprimento,
          height: selectedEmbalagem.altura,
          width: selectedEmbalagem.largura,
          id: "1",
          quantity: 1
        }]
        // Opcionalmente incluir services se houver seleção
      };

      const { data: resp, error: functionError } = await supabase.functions.invoke('calculo-frete-melhorenvio', {
        body: payload
      });

      if (functionError) {
        throw new Error(functionError.message || 'Erro ao calcular frete');
      }

      if (!resp?.cotacoes) {
        throw new Error('Resposta inválida do serviço de frete');
      }
      // Filtra cotações com erro e mapeia apenas as válidas
      const cotacoesValidas = resp.cotacoes
        .filter((quote: any) => !quote.error)
        .map((quote: any) => ({
          service_id: quote.id,
          transportadora: quote.company.name,
          modalidade: quote.name,
          prazo: `${quote.delivery_time} dias úteis`,
          preco: Number(quote.price),
          raw_response: quote
        }));

      if (cotacoesValidas.length === 0) {
        throw new Error('Nenhuma opção de frete disponível para este endereço');
      }

      setCotacoes(cotacoesValidas);
    } catch (err) {
      console.error('Erro ao calcular frete:', err);
      toast({ 
        title: 'Erro', 
        description: err instanceof Error ? err.message : 'Não foi possível calcular o frete. Tente novamente.',
        variant: 'destructive'
      });
      setCotacaoModal(false);
    } finally {
      setCalculandoFrete(false);
    }
  };

  const handleSelectCotacao = async (cotacao: CotacaoFrete) => {
    try {
      const updateData: any = {
        frete_melhor_envio: {
          transportadora: cotacao.transportadora,
          modalidade: cotacao.modalidade,
          prazo: cotacao.prazo,
          preco: cotacao.preco,
          service_id: cotacao.service_id,
          raw_response: cotacao.raw_response
        }
      };

      // Se vier o melhorEnvioId, adicionar ao update
      if (cotacao.melhorEnvioId) {
        updateData.id_melhor_envio = cotacao.melhorEnvioId;
        updateData.carrinho_me = true;
      }

      const { error } = await supabase
        .from('pedidos')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Frete selecionado e salvo no pedido' });
      setCotacaoModal(false);
      
      // Recarregar página para atualizar dados
      navigate(0);
    } catch (err) {
      console.error('Erro ao salvar frete:', err);
      toast({ 
        title: 'Erro', 
        description: 'Não foi possível salvar o frete selecionado',
        variant: 'destructive'
      });
    }
  };

  const handleEnviarMaisBarato = async () => {
    setCalculandoFrete(true);
    await handleCalcularFrete();
    // Após calcular, selecionar automaticamente o mais barato
    if (cotacoes.length > 0) {
      const maisBarato = cotacoes.reduce((prev, curr) => 
        prev.preco < curr.preco ? prev : curr
      );
      await handleSelectCotacao(maisBarato);
    }
  };

  const handleDeletePedido = async () => {
    if (!pedido) return;
    try {
      // delete itens_pedido first
      const { error: delItemsErr } = await supabase.from('itens_pedido').delete().eq('pedido_id', pedido.id);
      if (delItemsErr) throw delItemsErr;
      // delete pedido
      const { error: delPedidoErr } = await supabase.from('pedidos').delete().eq('id', pedido.id);
      if (delPedidoErr) throw delPedidoErr;
      toast({ title: 'Pedido excluído', description: 'Pedido e itens removidos com sucesso.' });
      setDeleteConfirmOpen(false);
      navigate('/?module=comercial');
    } catch (err: any) {
      console.error('Erro ao excluir pedido:', err);
      toast({ title: 'Erro ao excluir', description: err?.message || String(err), variant: 'destructive' });
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
          {pedido && (
            <>
              <Button variant="ghost" className="text-red-600" onClick={() => setDeleteConfirmOpen(true)}>
                <Trash className="h-5 w-5" />
              </Button>
            </>
          )}
          <Button onClick={() => navigate(-1)} variant="outline">Voltar</Button>
        </div>
      </div>

      <div>
        <Card>
          <CardContent className="flex flex-col lg:flex-row gap-6 items-stretch pt-6">
            <div className="flex-1 flex gap-8 items-start h-full">
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

              <div className="w-48">
                <div className="text-sm text-muted-foreground">PAGAMENTO</div>
                  <div className="mt-2">{
                    // prefer text field 'pagamento', then lookup by id_pagamento, then fallback
                    pedido?.pagamento || (pedido?.id_pagamento && (paymentMethods ? paymentMethods[pedido.id_pagamento] : ( {
                      1: 'Pix',
                      2: 'Boleto',
                      3: 'Cartão'
                    }[pedido.id_pagamento] )) ) || '—'
                  }</div>
              </div>

              <div className="w-56">
                <div className="text-sm text-muted-foreground">ENTREGA</div>
                <div className="font-medium">{pedido?.cliente?.nome || pedido?.cliente_nome}</div>
                <div className="text-sm">{formatAddress(pedido?.cliente)}</div>
                <div className="mt-2 text-sm text-muted-foreground">Prazo: 0 dias</div>
                <div className="text-sm text-muted-foreground">Data prevista: {pedido?.data_prevista || '—'}</div>
                {/* Link do formulário de entrega: botão de copiar antes do texto, sem input auxiliar */}
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const clientId = pedido?.cliente?.id || (pedido as any)?.cliente_id || null;
                      if (!clientId) {
                        toast({ title: 'Erro', description: 'Cliente sem ID para gerar link', variant: 'destructive' });
                        return;
                      }
                      const url = `${window.location.origin}/informacoes-entrega/${clientId}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast({ title: 'Link copiado', description: 'Rota de informações de entrega copiada para a área de transferência' });
                      } catch (err) {
                        console.error('Erro ao copiar link:', err);
                        toast({ title: 'Erro', description: 'Não foi possível copiar o link', variant: 'destructive' });
                      }
                    }}
                    className="inline-flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <div className="text-sm text-muted-foreground">Link formulário de entrega</div>
                </div>
              </div>
            </div>

            <div className="border-l pl-6 flex-shrink-0 w-full lg:w-64 h-full">
                <div className="text-sm text-muted-foreground">VALOR TOTAL</div>
                <div className="text-2xl font-bold">R$ {((pedido?.valor_total ?? pedido?.total) ? Number(pedido?.valor_total ?? pedido?.total).toFixed(2) : '0,00')}</div>

              <div className="mt-4">
                <div className="text-sm text-muted-foreground">Frete: Venda</div>
                {
                  (() => {
                    // Prefer valor_frete_yampi when populated, then frete_venda, otherwise zero
                    const raw = pedido?.valor_frete_yampi ?? pedido?.frete_venda ?? 0;
                    const num = Number(raw) || 0;
                    return <Input value={num.toFixed(2)} readOnly />;
                  })()
                }
              </div>

              <div className="mt-3">
                <div className="text-sm text-muted-foreground">Frete: Melhor Envio</div>
                <Input value={pedido?.frete_me ? String(pedido.frete_me) : '0,00'} readOnly />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="entrega">Entrega</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Produtos</CardTitle>
                <Button className="bg-purple-700 text-white" onClick={() => setAddProductsVisible(true)}>Adicionar Produto</Button>
              </div>
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

        <TabsContent value="entrega">
          <Card>
            <CardContent>
              {/* Dados do envio atual */}
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div>
                  <div className="text-sm text-muted-foreground">CEP de destino</div>
                  <div className="font-medium mt-1">{pedido?.cliente?.cep || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Transportadora atual</div>
                  <div className="font-medium mt-1">
                    {pedido?.frete_melhor_envio?.transportadora || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Prazo estimado</div>
                  <div className="font-medium mt-1">
                    {pedido?.frete_melhor_envio?.prazo || '—'}
                  </div>
                </div>
              </div>

              {/* Seleção de remetente e embalagem */}
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Remetente</div>
                      <div className="flex items-center gap-2">
                        <select 
                          className="flex-1 border rounded px-3 py-2"
                          value={selectedRemetente?.id || ''}
                          onChange={(e) => setSelectedRemetente(
                            remetentes.find(r => r.id === e.target.value) || null
                          )}
                        >
                          {remetentes.map(r => (
                            <option key={r.id} value={r.id}>{r.nome}</option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRemetentesVisible(true)}
                        >
                          Gerenciar
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Embalagem</div>
                      <div className="flex items-center gap-2">
                        <select
                          className="flex-1 border rounded px-3 py-2"
                          value={selectedEmbalagem?.id || ''}
                          onChange={(e) => setSelectedEmbalagem(
                            embalagens.find(em => em.id === e.target.value) || null
                          )}
                        >
                          {embalagens.map(em => (
                            <option key={em.id} value={em.id}>
                              {em.nome} ({em.altura}×{em.largura}×{em.comprimento}cm - {em.peso}kg)
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEmbalagensVisible(true)}
                        >
                          Gerenciar
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Botões de ação */}
              <div className="flex justify-center gap-3">
                { (pedido?.carrinho_me === true) ? (
                  // Mostra botões de imprimir / cancelar etiqueta quando já foi enviado ao carrinho ME
                  <>
                    <Button
                      onClick={async () => {
                        if (!pedido) return;
                        setProcessingLabel(true);
                        try {
                          const payload = {
                            pedidoId: pedido.id,
                            id_melhor_envio: pedido.id_melhor_envio
                          };

                          const { data, error: fnError } = await supabase.functions.invoke('processar-etiqueta-melhorenvio', {
                            body: payload
                          });

                          if (fnError) throw fnError;

                          // Se a função retornar uma URL absoluta para a etiqueta, abrir
                          console.log('Resposta processar-etiqueta-melhorenvio:', data);
                          const returnedUrl = data?.url || pedido?.etiqueta?.url;
                          if (returnedUrl && /^https?:\/\//i.test(returnedUrl)) {
                            window.open(returnedUrl, '_blank');
                            toast({ title: 'Etiqueta processada', description: 'A etiqueta foi processada e aberta em nova aba' });
                          } else if (data?.id) {
                            // A função retornou um id, mas não uma URL absoluta.
                            // Mostrar mensagem amigável de sucesso para o usuário.
                            toast({ title: 'Etiqueta impressa com sucesso 🎉', description: 'A etiqueta foi gerada no Melhor Envio. Verifique o painel do Melhor Envio para visualizar ou baixar.' });
                            console.warn('Etiqueta processada sem URL pública. Retorno:', data);
                          } else {
                            // Sem id nem URL: ainda assim apresentar mensagem positiva ao usuário
                            toast({ title: 'Etiqueta impressa com sucesso 🎉', description: 'A etiqueta foi processada. Verifique o painel do Melhor Envio para mais detalhes.' });
                            console.warn('Nenhuma URL retornada ao processar etiqueta:', data);
                          }
                        } catch (err) {
                          console.error('Erro ao processar etiqueta:', err);
                          toast({ title: 'Erro', description: 'Não foi possível processar a etiqueta', variant: 'destructive' });
                        } finally {
                          setProcessingLabel(false);
                        }
                      }}
                      disabled={processingLabel}
                      className="border-2 border-sky-400 text-sky-700 bg-white hover:bg-sky-50"
                    >
                      <span className="inline-flex items-center gap-2">
                        {processingLabel ? (
                          <div className="animate-spin h-4 w-4 border-2 border-b-transparent rounded-full" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M6 2a1 1 0 00-1 1v3H3a1 1 0 00-1 1v6a1 1 0 001 1h2v3a1 1 0 001 1h8a1 1 0 001-1v-3h2a1 1 0 001-1V7a1 1 0 00-1-1h-2V3a1 1 0 00-1-1H6zM8 5h4v3H8V5z" />
                          </svg>
                        )}
                        Imprimir Etiqueta
                      </span>
                    </Button>

                    <Button
                      onClick={async () => {
                        // Cancelar etiqueta: limpar id_melhor_envio e carrinho_me no pedido
                        try {
                          const { error } = await supabase
                            .from('pedidos')
                            .update({ id_melhor_envio: null, carrinho_me: false } as any)
                            .eq('id', id);

                          if (error) throw error;
                          toast({ title: 'Sucesso', description: 'Etiqueta cancelada' });
                          navigate(0);
                        } catch (err) {
                          console.error('Erro ao cancelar etiqueta:', err);
                          toast({ title: 'Erro', description: 'Não foi possível cancelar a etiqueta', variant: 'destructive' });
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Cancelar etiqueta
                    </Button>
                  </>
                ) : (
                  // Botões originais para calcular e enviar mais barato
                  <>
                    <Button
                      onClick={handleCalcularFrete}
                      disabled={calculandoFrete}
                      className="bg-amber-500 hover:bg-amber-600"
                    >
                      {calculandoFrete ? (
                        <>
                          <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full" />
                          Calculando...
                        </>
                      ) : (
                        '📦 Calcular Frete'
                      )}
                    </Button>
                    
                    <Button
                      onClick={handleEnviarMaisBarato}
                      disabled={calculandoFrete}
                      className="bg-purple-700 hover:bg-purple-800"
                    >
                      {calculandoFrete ? 'Calculando...' : 'ENVIAR O MAIS BARATO'}
                    </Button>
                  </>
                ) }
              </div>
            </CardContent>
          </Card>

          {/* Cards de gerenciamento */}
          <div className="grid grid-cols-2 gap-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  Etiqueta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-2">
                  Status atual: {pedido?.etiqueta?.nome || 'Não liberado'}
                </div>
                <Input 
                  placeholder="Etiqueta de envio" 
                  value={etiquetaText} 
                  onChange={(e) => setEtiquetaText(e.target.value)} 
                />
              </CardContent>
            </Card>

            {/* Link Etiqueta moved to the top delivery info card as requested */}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modais de gerenciamento */}
      <Dialog open={remetentesVisible} onOpenChange={setRemetentesVisible}>
        <DialogContent className="max-w-4xl">
          <RemetentesManager />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Pedido</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <h3 className="text-lg font-semibold text-red-600">Você tem certeza?</h3>
            <p className="text-sm text-muted-foreground mt-2">Esta ação não poderá ser desfeita.</p>
          </div>
          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancelar</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleDeletePedido}>Sim, quero excluir</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={embalagensVisible} onOpenChange={setEmbalagensVisible}>
        <DialogContent className="max-w-4xl">
          <EmbalagensManager />
        </DialogContent>
      </Dialog>

      {/* Modal de Adicionar Produtos (copiado do NovoPedido UI pattern) */}
      <Dialog open={addProductsVisible} onOpenChange={setAddProductsVisible}>
        <DialogContent className="max-w-6xl w-full">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Input placeholder="Buscar produto" value={searchModal} onChange={(e) => setSearchModal(e.target.value)} />
              <div className="space-y-4 mt-4">
                {loadingProdutosModal && <div className="text-sm text-muted-foreground">Carregando produtos...</div>}
                {produtosErrorModal && <div className="text-sm text-destructive">Erro: {produtosErrorModal}</div>}
                {!loadingProdutosModal && !produtosErrorModal && produtosListModal.filter(p => p.nome.toLowerCase().includes(searchModal.toLowerCase())).map((p) => (
                  <div key={p.id} className="flex items-center gap-4">
                    <img src={p.imagemUrl} alt={p.nome} className="w-12 h-12 rounded" />
                    <div className="flex-1">
                      <div className="font-medium text-purple-700">{p.nome}</div>
                      <div className="text-sm text-muted-foreground">R$ {Number(p.preco || 0).toFixed(2)}</div>
                    </div>

                    <div className="w-48">
                      {p.variacoes && p.variacoes.length > 0 ? (
                        <select className="w-full border rounded p-2" value={variationSelectionsModal[p.id] || ''} onChange={(e) => setVariationSelectionsModal((s) => ({ ...s, [p.id]: e.target.value }))}>
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
                        <input type="checkbox" checked={brindeSelectionsModal[p.id] || false} onChange={(e) => setBrindeSelectionsModal((s) => ({ ...s, [p.id]: e.target.checked }))} />
                        <span className="ml-2">Brinde</span>
                      </label>
                    </div>

                    <div>
                      <Button className="bg-purple-700 text-white" onClick={() => {
                        // add to modal cart
                        const variacaoId = variationSelectionsModal[p.id] || (p.variacoes && p.variacoes[0]?.id) || null;
                        const quantidade = 1;
                        const unitario = variacaoId ? Number((p.variacoes || []).find((v: any) => v.id === variacaoId)?.valor || p.preco || 0) : Number(p.preco || 0);
                        const itemId = variacaoId ? `${p.id}:${variacaoId}` : p.id;
                        setModalCart(prev => {
                          const existing = prev.find(i => i.id === itemId && !!i.brinde === !!brindeSelectionsModal[p.id]);
                          if (existing) return prev.map(i => i.id === itemId ? { ...i, quantidade: i.quantidade + 1 } : i);
                          return [...prev, { id: itemId, produtoId: p.id, nome: p.nome, quantidade, preco: unitario, imagemUrl: p.imagemUrl, brinde: !!brindeSelectionsModal[p.id] }];
                        });
                      }}>+</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-lg font-semibold">ITENS DO CARRINHO</div>
              <div className="text-sm text-muted-foreground mb-4">{modalCart.length} R$ {modalCart.reduce((s, it) => s + (Number(it.preco || 0) * Number(it.quantidade || 1)), 0).toFixed(2)}</div>
              <div className="space-y-3">
                {modalCart.map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={item.imagemUrl} className="w-10 h-10 rounded" />
                      <div>
                        <div className="font-medium">{item.nome}</div>
                        <div className="text-sm text-muted-foreground">R$ {Number(item.preco || 0).toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm">{item.quantidade}</div>
                      <Button variant="ghost" onClick={() => setModalCart(prev => prev.filter((_, i) => i !== idx))}>Remover</Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setAddProductsVisible(false)}>Cancelar</Button>
                <Button className="bg-purple-700 text-white" onClick={async () => {
                  // persist modalCart into itens_pedido for current pedido
                  if (!pedido) {
                    toast({ title: 'Erro', description: 'Pedido não carregado', variant: 'destructive' });
                    return;
                  }
                  if (!modalCart.length) {
                    setAddProductsVisible(false);
                    return;
                  }
                  setSavingModal(true);
                  try {
                    // load existing items for this pedido to merge quantities
                    const { data: existingItems, error: existingError } = await supabase.from('itens_pedido').select('*').eq('pedido_id', pedido.id);
                    if (existingError) throw existingError;

                    // Build arrays of inserts and updates
                    const inserts: any[] = [];
                    const updates: any[] = [];

                    modalCart.forEach((it) => {
                      const [produtoId, variacaoId] = String(it.id).split(':');
                      // try find existing item matching produto_id + variacao_id
                      const match = (existingItems || []).find((e: any) => String(e.produto_id) === String(it.produtoId || produtoId) && String(e.variacao_id || '') === String(variacaoId || ''));
                      if (match) {
                        updates.push({ id: match.id, quantidade: (Number(match.quantidade || 0) + Number(it.quantidade || 1)), preco_unitario: it.preco || match.preco_unitario });
                      } else {
                        inserts.push({ pedido_id: pedido.id, produto_id: it.produtoId || produtoId, variacao_id: variacaoId || null, quantidade: it.quantidade || 1, preco_unitario: it.preco || 0, criado_em: new Date().toISOString() });
                      }
                    });

                    // perform updates (one by one) and bulk insert
                    for (const u of updates) {
                      const { error: upErr } = await supabase.from('itens_pedido').update({ quantidade: u.quantidade, preco_unitario: u.preco_unitario } as any).eq('id', u.id);
                      if (upErr) throw upErr;
                    }

                    if (inserts.length) {
                      const { error: insErr } = await supabase.from('itens_pedido').insert(inserts as any);
                      if (insErr) throw insErr;
                    }

                    toast({ title: 'Itens adicionados', description: 'Produtos adicionados ao pedido com sucesso' });
                    setAddProductsVisible(false);
                    // refresh the page to reflect changes
                    navigate(0);
                  } catch (err: any) {
                    console.error('Erro ao persistir itens do modal:', err);
                    toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
                  } finally {
                    setSavingModal(false);
                  }
                }}>Próxima etapa</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de cotações */}
      <CotacaoFreteModal
        open={cotacaoModal}
        onClose={() => setCotacaoModal(false)}
        onSelect={handleSelectCotacao}
        cotacoes={cotacoes}
        loading={calculandoFrete}
        remetente={selectedRemetente}
        cliente={pedido?.cliente}
        embalagem={selectedEmbalagem}
        insuranceValue={(pedido?.itens || []).reduce((s: number, it: any) => s + (Number(it.preco_unitario || it.preco || 0) * Number(it.quantidade || 1)), 0) || 1}
        productName={(pedido?.itens && pedido.itens.length) ? (pedido.itens[0].variacao?.nome || pedido.itens[0].produto?.nome || '') : ''}
        orderProducts={(pedido?.itens || []).map((it: any) => ({
          name: it.variacao?.nome || it.produto?.nome || 'Produto',
          quantity: Number(it.quantidade || 1),
          unitary_value: Number(it.preco_unitario || it.preco || 0)
        }))}
      />
    </div>
  );
}
