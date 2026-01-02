import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Trash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import EmballagemModal from '@/components/shipping/EmballagemModal';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Produto } from '@/types';

type Variation = {
  id?: string;
  nome: string;
  sku: string;
  valor: string;
  img_url?: string;
  qntd?: number;
  codigo_barras_v?: string;
  ordem?: number;
  altura?: number;
  largura?: number;
  comprimento?: number;
  peso?: number;
  bling_id?: string;
}

export default function ProductForm({ open, onClose, product }: { open: boolean; onClose: () => void; product?: Produto | null }) {
  const { toast } = useToast();
  const { empresaId } = useAuth();
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState('');
  const [sku, setSku] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [preco, setPreco] = useState('0.00');
  const [unidade, setUnidade] = useState('un');
  const [categoria, setCategoria] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [qntd, setQntd] = useState<number | ''>('');
  const [altura, setAltura] = useState<number | ''>('');
  const [largura, setLargura] = useState<number | ''>('');
  const [comprimento, setComprimento] = useState<number | ''>('');
  const [peso, setPeso] = useState<number | ''>('');

  const [hasVariations, setHasVariations] = useState(false);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [originalVariationIds, setOriginalVariationIds] = useState<string[]>([]);

  // Embalagens
  const [embalagens, setEmbalagens] = useState<any[]>([]);
  const [embalagemModalOpen, setEmbalagemModalOpen] = useState(false);
  const [selectedEmbalagemForModal, setSelectedEmbalagemForModal] = useState<any | undefined>(undefined);
  const [selectedEmbalagemId, setSelectedEmbalagemId] = useState<string | ''>('');
  const [blingId, setBlingId] = useState<string>('');
  const [nomeVariacao, setNomeVariacao] = useState<string>('');
  const [upCell, setUpCell] = useState<boolean>(false);
  const [upSellModalOpen, setUpSellModalOpen] = useState<boolean>(false);
  const [selectedUpSellIds, setSelectedUpSellIds] = useState<string[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [upSellSearchTerm, setUpSellSearchTerm] = useState<string>('');



  const reset = () => {
    setNome(''); setSku(''); setPreco('0.00'); setUnidade('un'); setCategoria(''); setImgUrl(''); setQntd('');
    setCodigoBarras('');
    setAltura(''); setLargura(''); setComprimento(''); setPeso('');
    setHasVariations(false); setVariations([]);
    setSelectedEmbalagemId('');
    setBlingId('');
    setNomeVariacao('');
    setOriginalVariationIds([]);
    setUpCell(false);
    setSelectedUpSellIds([]);
  }

  const addVariation = () => setVariations(v => [...v, { nome: '', sku: '', valor: '0.00', img_url: '', qntd: 0, codigo_barras_v: '', ordem: v.length, altura: undefined, largura: undefined, comprimento: undefined, peso: undefined, bling_id: '' }]);
  const updateVariation = (idx: number, patch: Partial<Variation>) => setVariations(v => v.map((it,i)=> i===idx ? { ...it, ...patch } : it));
  const removeVariation = (idx: number) => setVariations(v => v.filter((_,i)=> i!==idx));

  const handleSubmit = async () => {
    if (!nome.trim()) { toast({ title: 'Nome é obrigatório' }); return; }

    // If the product has variations, require validations on variations instead of product-level SKU/price/qntd
    if (hasVariations) {
      if (!nomeVariacao.trim()) { toast({ title: 'Nome da variação é obrigatório' }); return; }
      if (variations.length === 0) { toast({ title: 'Adicione ao menos uma variação' }); return; }
      for (let i = 0; i < variations.length; i++) {
        const v = variations[i];
        if (!v.nome || !v.nome.trim()) { toast({ title: `Nome da variação ${i + 1} é obrigatório` }); return; }
        if (!v.sku || !v.sku.trim()) { toast({ title: `SKU da variação ${i + 1} é obrigatório` }); return; }
        if (isNaN(Number(v.valor))) { toast({ title: `Valor da variação ${i + 1} inválido` }); return; }
        if (v.qntd === undefined || v.qntd === null || isNaN(Number(v.qntd))) { toast({ title: `Quantidade da variação ${i + 1} inválida` }); return; }
        // Validar campos de volume da variação
        if (!v.altura || v.altura <= 0) { toast({ title: `Altura da variação ${i + 1} é obrigatória`, variant: 'destructive' }); return; }
        if (!v.largura || v.largura <= 0) { toast({ title: `Largura da variação ${i + 1} é obrigatória`, variant: 'destructive' }); return; }
        if (!v.comprimento || v.comprimento <= 0) { toast({ title: `Comprimento da variação ${i + 1} é obrigatório`, variant: 'destructive' }); return; }
        if (!v.peso || v.peso <= 0) { toast({ title: `Peso da variação ${i + 1} é obrigatório`, variant: 'destructive' }); return; }
      }
    } else {
      // No variations: product-level validations apply
      if (!sku.trim()) { toast({ title: 'SKU é obrigatório' }); return; }
      if (isNaN(Number(preco))) { toast({ title: 'Preço inválido' }); return; }
      // Validar campos de volume do produto
      if (!altura || altura <= 0) { toast({ title: 'Altura é obrigatória', description: 'Por favor, preencha a altura do produto.', variant: 'destructive' }); return; }
      if (!largura || largura <= 0) { toast({ title: 'Largura é obrigatória', description: 'Por favor, preencha a largura do produto.', variant: 'destructive' }); return; }
      if (!comprimento || comprimento <= 0) { toast({ title: 'Comprimento é obrigatório', description: 'Por favor, preencha o comprimento do produto.', variant: 'destructive' }); return; }
      if (!peso || peso <= 0) { toast({ title: 'Peso é obrigatório', description: 'Por favor, preencha o peso do produto.', variant: 'destructive' }); return; }
    }

  setSaving(true);
  try {
      // Insert product
      // If product has variations, make product-level sku/preco defaults so DB constraints are satisfied
      const autoSku = (str: string) =>
        (str || 'PROD').replace(/\s+/g, '-').toUpperCase().slice(0, 10) + '-B' + String(Date.now()).slice(-3);

      const prodInsert = {
        nome: nome.trim(),
        sku: (!hasVariations && sku.trim()) ? sku.trim() : (hasVariations ? autoSku(nome) : sku.trim()),
        // If product has variations, barcode lives on variations table
        codigo_barras: hasVariations ? null : (codigoBarras || null),
        preco: !hasVariations ? Number(preco) : 0.00,
        unidade: unidade || 'un',
        categoria: categoria || null,
        img_url: imgUrl || null,
        embalgens_id: selectedEmbalagemId || null,
        nome_variacao: nomeVariacao || null,
        qntd: qntd === '' ? 0 : Number(qntd),
        empresa_id: empresaId || null,
        up_cell: upCell,
        lista_id_upsell: upCell && selectedUpSellIds.length > 0 ? selectedUpSellIds : null,
        altura: hasVariations ? null : (altura || null),
        largura: hasVariations ? null : (largura || null),
        comprimento: hasVariations ? null : (comprimento || null),
        peso: hasVariations ? null : (peso || null),
        bling_id: hasVariations ? null : (blingId || null),
      } as any;

      console.log('Produto a ser inserido:', prodInsert);

      // If product prop exists, perform update; otherwise insert
      let produtoId: string;
      if (product && (product as any).id) {
        produtoId = (product as any).id;
        const { error: updErr } = await supabase.from('produtos').update(prodInsert).eq('id', produtoId);
        if (updErr) throw updErr;

        // Sync variations: delete removed, update existing, insert new
        const currentIds = variations.map(v => v.id).filter(Boolean) as string[];
        const toDelete = originalVariationIds.filter(id => !currentIds.includes(id));
        if (toDelete.length > 0) {
          const { error: delErr } = await supabase.from('variacoes_produto').delete().in('id', toDelete);
          if (delErr) throw delErr;
        }

        const existing = variations.filter(v => v.id);
        for (const v of existing) {
          const { error: vUpdErr } = await supabase.from('variacoes_produto').update({ nome: v.nome, sku: v.sku, valor: Number(v.valor), img_url: v.img_url || null, qntd: v.qntd ?? 0, codigo_barras_v: v.codigo_barras_v || null, ordem: v.ordem ?? 0, altura: v.altura || null, largura: v.largura || null, comprimento: v.comprimento || null, peso: v.peso || null, bling_id: v.bling_id || null }).eq('id', v.id);
          if (vUpdErr) throw vUpdErr;
        }

        const news = variations.filter(v => !v.id).map((v, idx) => ({ produto_id: produtoId, nome: v.nome, sku: v.sku, valor: Number(v.valor), img_url: v.img_url || null, qntd: v.qntd ?? 0, codigo_barras_v: v.codigo_barras_v || null, ordem: v.ordem ?? idx, empresa_id: empresaId || null, altura: v.altura || null, largura: v.largura || null, comprimento: v.comprimento || null, peso: v.peso || null, bling_id: v.bling_id || null }));
        if (news.length > 0) {
          const { error: insErr } = await supabase.from('variacoes_produto').insert(news);
          if (insErr) throw insErr;
        }

        toast({ title: 'Produto atualizado', description: `Produto ${nome} atualizado com sucesso` });
      } else {
        const { data: prodData, error: prodErr } = await supabase
          .from('produtos')
          .insert(prodInsert)
          .select('id')
          .single();

        if (prodErr) throw prodErr;

        produtoId = prodData.id as string;

        if (hasVariations && variations.length > 0) {
          const toInsert = variations.map((v, idx) => ({
            produto_id: produtoId,
            nome: v.nome,
            sku: v.sku,
            valor: Number(v.valor),
            img_url: v.img_url || null,
            qntd: v.qntd ?? 0,
            codigo_barras_v: v.codigo_barras_v || null,
            ordem: v.ordem ?? idx,
            empresa_id: empresaId || null,
            altura: v.altura || null,
            largura: v.largura || null,
            comprimento: v.comprimento || null,
            peso: v.peso || null,
            bling_id: v.bling_id || null,
          }));

          const { error: varErr } = await supabase.from('variacoes_produto').insert(toInsert);
          if (varErr) throw varErr;
        }

        toast({ title: 'Produto criado', description: `Produto ${nome} criado com sucesso` });
      }
      reset();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro', description: err?.message || String(err) });
    } finally {
      setSaving(false);
    }
  }

  // load embalagens when modal opens/closes (refresh after create)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.from('embalagens').select('*').order('nome');
        if (error) throw error;
        if (!mounted) return;
        setEmbalagens(data || []);
      } catch (err: any) {
        console.error('Erro ao carregar embalagens:', err);
      }
    })();
    return () => { mounted = false };
  }, [embalagemModalOpen]);

  // Load available products for up-sell selection
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select('id, nome, sku, img_url')
          .order('nome');
        if (error) throw error;
        if (!mounted) return;
        // Include all products (mesmo produto pode ser upsell com variação diferente)
        setAvailableProducts(data || []);
      } catch (err: any) {
        console.error('Erro ao carregar produtos:', err);
      }
    })();
    return () => { mounted = false };
  }, [open, product]);

  const handleSaveEmbalagem = async (data: any) => {
    try {
      if (selectedEmbalagemForModal && selectedEmbalagemForModal.id) {
        const { error } = await supabase.from('embalagens').update(data).eq('id', selectedEmbalagemForModal.id);
        if (error) throw error;
        setSelectedEmbalagemId(selectedEmbalagemForModal.id);
      } else {
        const insertData = { ...data, empresa_id: empresaId || null };
        const { data: ins, error } = await supabase.from('embalagens').insert(insertData).select('id').single();
        if (error) throw error;
        setSelectedEmbalagemId(ins.id);
      }
    } catch (err: any) {
      throw err;
    } finally {
      setEmbalagemModalOpen(false);
    }
  }

  // initialize when editing a product
  useEffect(() => {
    if (!open) return;
    if (product) {
      const p: any = product;
      setNome(p.nome || '');
      setSku(p.sku || '');
      setPreco(String(p.preco ?? '0.00'));
      setUnidade(p.unidade || 'un');
      setCategoria(p.categoria || '');
      setImgUrl(p.imagemUrl || '');
      setQntd(p.qntd ?? '');
      setAltura(p.altura ?? '');
      setLargura(p.largura ?? '');
      setComprimento(p.comprimento ?? '');
      setPeso(p.peso ?? '');
      setBlingId(p.bling_id || '');
      const hasVar = Boolean((product as any).variacoes && (product as any).variacoes.length > 0);
      setHasVariations(hasVar);
      // If product has variations, barcode should live on variations; clear product-level barcode
      setCodigoBarras(hasVar ? '' : (p.codigo_barras || p.codigoBarras || ''));
      setNomeVariacao((product as any).nomeVariacao || '');
      setSelectedEmbalagemId((product as any).embalgens_id || '');
      setUpCell(Boolean((product as any).up_cell || (product as any).upCell));
      setSelectedUpSellIds((product as any).lista_id_upsell || []);
      // Seed variations from passed product object if present
      const seed = (p.variacoes || []).map((v: any) => ({
        id: v.id,
        nome: v.nome,
        sku: v.sku,
        valor: String(v.valor ?? '0.00'),
        img_url: v.img_url || '',
        qntd: v.qntd ?? 0,
        codigo_barras_v: v.codigo_barras_v || v.codigo_barras || v.codigoBarrasV || v.codigoBarras || v.barcode || '',
        ordem: v.ordem ?? 0,
        altura: v.altura ?? undefined,
        largura: v.largura ?? undefined,
        comprimento: v.comprimento ?? undefined,
        peso: v.peso ?? undefined,
        bling_id: v.bling_id || '',
      }));
      setVariations(seed);
      setOriginalVariationIds(seed.map((v: any) => v.id).filter(Boolean));

      // Also fetch the latest variations directly from the DB to ensure barcode fields are present
      (async () => {
        try {
          const { data: varData, error: varErr } = await supabase.from('variacoes_produto').select('*').eq('produto_id', p.id).order('ordem', { ascending: true });
          if (!varErr && varData && Array.isArray(varData) && varData.length > 0) {
            const mappedDb = varData.map((v: any) => ({
              id: v.id,
              nome: v.nome,
              sku: v.sku,
              valor: String(v.valor ?? '0.00'),
              img_url: v.img_url || '',
              qntd: v.qntd ?? 0,
              codigo_barras_v: v.codigo_barras_v || v.codigo_barras || v.codigoBarrasV || v.codigoBarras || v.barcode || '',
              ordem: v.ordem ?? 0,
              altura: v.altura ?? undefined,
              largura: v.largura ?? undefined,
              comprimento: v.comprimento ?? undefined,
              peso: v.peso ?? undefined,
              bling_id: v.bling_id || '',
            }));
            setVariations(mappedDb);
            setOriginalVariationIds(mappedDb.map((v: any) => v.id).filter(Boolean));
          }
        } catch (err: any) {
          console.error('Erro ao carregar variações do DB:', err);
        }
      })();

      // If product has no variations and barcode/bling_id not present in the passed product object,
      // fetch the product row to obtain `codigo_barras` and `bling_id` (some APIs omit that field in the prop)
      (async () => {
        try {
          if (!hasVar && p.id) {
            const { data: prodRow, error: prodErr } = await supabase.from('produtos').select('codigo_barras, bling_id').eq('id', p.id).single();
            if (!prodErr && prodRow) {
              const row: any = prodRow as any;
              const cb = row.codigo_barras || row.codigoBarras || '';
              const bid = row.bling_id || '';
              setCodigoBarras(cb || '');
              setBlingId(bid || '');
            }
          }
        } catch (err: any) {
          console.error('Erro ao carregar codigo_barras e bling_id do produto do DB:', err);
        }
      })();
    } else {
      reset();
    }
  }, [open, product]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6 overflow-auto">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose()} />

      <Card className="w-full max-w-3xl z-50 max-h-[90vh] overflow-auto">
        <CardHeader>
          <div className="w-full flex items-center">
            <CardTitle className="text-center text-xl">{product && product.id ? 'Editar Produto' : 'Cadastrar Produto'}</CardTitle>
            {product && (product as any).id && (
              <div className="ml-auto">
                <Button variant="ghost" className="text-red-600" onClick={async () => {
                const ok = confirm(`Deseja realmente excluir o produto "${(product as any).nome}" e todas as variações? Esta ação não pode ser desfeita.`);
                if (!ok) return;
                try {
                  // delete variations first
                  const { error: delVarErr } = await supabase.from('variacoes_produto').delete().eq('produto_id', (product as any).id);
                  if (delVarErr) throw delVarErr;
                  const { error: delProdErr } = await supabase.from('produtos').delete().eq('id', (product as any).id);
                  if (delProdErr) throw delProdErr;
                  toast({ title: 'Produto excluído', description: `Produto ${(product as any).nome} e variações foram removidos.` });
                  onClose();
                  reset();
                } catch (err: any) {
                  console.error('Erro ao excluir produto:', err);
                  toast({ title: 'Erro ao excluir', description: err?.message || String(err) });
                }
              }}>
                <Trash className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* (barcode input removed - moved to Logística page) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e)=>setNome(e.target.value)} />
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={sku} onChange={(e)=>setSku(e.target.value)} />
            </div>
            <div>
              <Label>Código de Barras</Label>
              <Input value={codigoBarras} onChange={(e)=>setCodigoBarras(e.target.value)} />
            </div>
            <div>
              <Label>Preço</Label>
              <Input value={preco} onChange={(e)=>setPreco(e.target.value)} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={unidade} onChange={(e)=>setUnidade(e.target.value)} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={categoria} onChange={(e)=>setCategoria(e.target.value)} />
            </div>
            <div>
              <Label>Quantidade (qntd)</Label>
              <Input type="number" value={qntd as any} onChange={(e)=>setQntd(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            {!hasVariations && (
              <div>
                <Label>Bling ID</Label>
                <Input 
                  value={blingId} 
                  onChange={(e)=>setBlingId(e.target.value)} 
                  placeholder="ID do produto no Bling"
                />
              </div>
            )}
            <div className="md:col-span-2">
              <Label>Imagem URL (img_url)</Label>
              <Input value={imgUrl} onChange={(e)=>setImgUrl(e.target.value)} />
            </div>
          </div>

          {/* Dados de Volume - somente quando não tem variações */}
          {!hasVariations && (
            <div className="mt-4 p-4 border rounded-lg bg-blue-50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">!</div>
                <h3 className="font-semibold text-sm">DADOS DO VOLUME</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Altura* <span className="text-xs text-gray-500">(cm)</span></Label>
                  <Input 
                    type="number" 
                    value={altura as any} 
                    onChange={(e)=>setAltura(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="10"
                  />
                </div>
                <div>
                  <Label>Largura* <span className="text-xs text-gray-500">(cm)</span></Label>
                  <Input 
                    type="number" 
                    value={largura as any} 
                    onChange={(e)=>setLargura(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="40"
                  />
                </div>
                <div>
                  <Label>Comprimento* <span className="text-xs text-gray-500">(cm)</span></Label>
                  <Input 
                    type="number" 
                    value={comprimento as any} 
                    onChange={(e)=>setComprimento(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="40"
                  />
                </div>
                <div>
                  <Label>Peso* <span className="text-xs text-gray-500">(kg)</span></Label>
                  <Input 
                    type="number" 
                    value={peso as any} 
                    onChange={(e)=>setPeso(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="6"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={hasVariations} onChange={(e)=>setHasVariations(e.target.checked)} />
              <span>Possui variações</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={upCell} 
                onChange={(e) => setUpCell(e.target.checked)} 
              />
              <span>Produto com Up-Sell</span>
            </label>
            
            {upCell && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setUpSellModalOpen(true)}
                className="ml-auto"
              >
                Editar upseel ({selectedUpSellIds.length} selecionados)
              </Button>
            )}
          </div>

          {hasVariations && (
            <div className="mt-3">
              <Label>Nome da variação (ex: Cor, Tamanho)</Label>
              <Input value={nomeVariacao} onChange={(e)=>setNomeVariacao(e.target.value)} placeholder="Ex: Cor" />
            </div>
          )}

          {hasVariations && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center">
                <div className="font-medium">Variações</div>
                <Button size="sm" onClick={addVariation}>Adicionar Variação</Button>
              </div>
              {variations.map((v, idx) => (
                <div key={idx} className="border rounded p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div>
                          <Label>Nome</Label>
                          <Input value={v.nome} onChange={(e)=>updateVariation(idx, { nome: e.target.value })} />
                        </div>
                        <div>
                          <Label>SKU</Label>
                          <Input value={v.sku} onChange={(e)=>updateVariation(idx, { sku: e.target.value })} />
                        </div>
                        <div>
                          <Label>Valor</Label>
                          <Input value={v.valor} onChange={(e)=>updateVariation(idx, { valor: e.target.value })} />
                        </div>
                        <div>
                          <Label>Quantidade</Label>
                          <Input type="number" value={v.qntd as any} onChange={(e)=>updateVariation(idx, { qntd: Number(e.target.value) })} />
                        </div>
                        <div>
                          <Label>Código de Barras</Label>
                          <Input value={v.codigo_barras_v || ''} onChange={(e)=>updateVariation(idx, { codigo_barras_v: e.target.value })} />
                        </div>
                        <div>
                          <Label>Ordem</Label>
                          <Input type="number" value={v.ordem ?? idx} onChange={(e)=>updateVariation(idx, { ordem: Number(e.target.value) })} />
                        </div>
                        <div>
                          <Label>Bling ID</Label>
                          <Input value={v.bling_id || ''} onChange={(e)=>updateVariation(idx, { bling_id: e.target.value })} placeholder="ID no Bling" />
                        </div>
                        <div>
                          <Label>Imagem URL</Label>
                          <Input value={v.img_url} onChange={(e)=>updateVariation(idx, { img_url: e.target.value })} />
                        </div>
                      </div>
                      
                      {/* Dados de Volume da Variação */}
                      <div className="mt-3 p-3 border rounded bg-blue-50">
                        <div className="text-xs font-semibold mb-2 text-blue-700">DADOS DO VOLUME</div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                          <div>
                            <Label className="text-xs">Altura* <span className="text-gray-500">(cm)</span></Label>
                            <Input 
                              type="number" 
                              value={v.altura as any ?? ''} 
                              onChange={(e)=>updateVariation(idx, { altura: e.target.value === '' ? undefined : Number(e.target.value) })}
                              placeholder="10"
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Largura* <span className="text-gray-500">(cm)</span></Label>
                            <Input 
                              type="number" 
                              value={v.largura as any ?? ''} 
                              onChange={(e)=>updateVariation(idx, { largura: e.target.value === '' ? undefined : Number(e.target.value) })}
                              placeholder="40"
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Comprimento* <span className="text-gray-500">(cm)</span></Label>
                            <Input 
                              type="number" 
                              value={v.comprimento as any ?? ''} 
                              onChange={(e)=>updateVariation(idx, { comprimento: e.target.value === '' ? undefined : Number(e.target.value) })}
                              placeholder="40"
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Peso* <span className="text-gray-500">(kg)</span></Label>
                            <Input 
                              type="number" 
                              value={v.peso as any ?? ''} 
                              onChange={(e)=>updateVariation(idx, { peso: e.target.value === '' ? undefined : Number(e.target.value) })}
                              placeholder="6"
                              className="h-8"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex flex-col gap-2">
                      <Button variant="outline" size="sm" onClick={() => { /* inline edit already available */ }}>{v.id ? 'Editar' : 'Editar'}</Button>
                      <Button variant="destructive" size="sm" onClick={() => {
                        (async () => {
                          try {
                            if (v.id) {
                              const { error } = await supabase.from('variacoes_produto').delete().eq('id', v.id);
                              if (error) throw error;
                              setOriginalVariationIds(prev => prev.filter(id => id !== v.id));
                            }
                            removeVariation(idx);
                            toast({ title: 'Variação removida' });
                          } catch (err: any) {
                            console.error('Erro ao remover variação:', err);
                            toast({ title: 'Erro ao remover variação', description: err?.message || String(err) });
                          }
                        })();
                      }}>Excluir</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={()=> { reset(); onClose(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Salvando...' : (product && product.id ? 'Atualizar' : 'Cadastrar')}</Button>
          </div>
        </CardContent>
      </Card>
      <EmballagemModal open={embalagemModalOpen} onClose={() => setEmbalagemModalOpen(false)} onSave={handleSaveEmbalagem} embalagem={selectedEmbalagemForModal} />
      
      {/* Modal de seleção de produtos Up-Sell */}
      <Dialog open={upSellModalOpen} onOpenChange={(open) => {
        setUpSellModalOpen(open);
        if (!open) setUpSellSearchTerm('');
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-custom-50 to-amber-50">
            <DialogTitle className="text-2xl font-bold text-gray-900">Produtos para Up-Sell</DialogTitle>
            <p className="text-sm text-gray-600 mt-1">Selecione os produtos que serão oferecidos como up-sell aos clientes</p>
          </DialogHeader>
          
          {/* Header com busca e contador */}
          <div className="px-6 py-4 bg-white border-b">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  placeholder="Buscar por nome ou SKU..."
                  value={upSellSearchTerm}
                  onChange={(e) => setUpSellSearchTerm(e.target.value)}
                  className="pl-10 h-10 border-gray-300 focus:border-custom-500 focus:ring-custom-500"
                />
              </div>
              {selectedUpSellIds.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-custom-100 text-custom-700 rounded-lg font-medium">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{selectedUpSellIds.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Lista de produtos */}
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[400px]">
            {(() => {
              const filtered = availableProducts.filter(prod => 
                prod.nome.toLowerCase().includes(upSellSearchTerm.toLowerCase()) ||
                prod.sku.toLowerCase().includes(upSellSearchTerm.toLowerCase())
              );

              if (filtered.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-base font-medium">
                      {upSellSearchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
                    </p>
                    {upSellSearchTerm && (
                      <p className="text-sm mt-1">Tente buscar por outro termo</p>
                    )}
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((prod) => {
                    const isSelected = selectedUpSellIds.includes(prod.id);
                    return (
                      <div
                        key={prod.id}
                        className={`group relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                          isSelected 
                            ? 'border-custom-500 bg-custom-50 shadow-md scale-[1.02]' 
                            : 'border-gray-200 hover:border-custom-300 hover:shadow-sm hover:bg-custom-50/30'
                        }`}
                        onClick={() => {
                          setSelectedUpSellIds(prev => 
                            prev.includes(prod.id) 
                              ? prev.filter(id => id !== prod.id)
                              : [...prev, prod.id]
                          );
                        }}
                      >
                        {/* Badge de seleção */}
                        <div className="absolute -top-2 -right-2 z-10">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shadow-sm ${
                            isSelected 
                              ? 'bg-custom-600 border-custom-600 scale-110' 
                              : 'bg-white border-gray-300 group-hover:border-custom-400'
                          }`}>
                            {isSelected && (
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                        
                        {/* Imagem do produto */}
                        <div className="flex items-center justify-center mb-3">
                          {prod.img_url ? (
                            <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 group-hover:border-custom-300 transition-colors">
                              <img 
                                src={prod.img_url} 
                                alt={prod.nome} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-200 flex items-center justify-center group-hover:from-custom-50 group-hover:to-custom-100 group-hover:border-custom-300 transition-colors">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        
                        {/* Informações do produto */}
                        <div className="text-center">
                          <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-1 leading-snug min-h-[2.5rem]">
                            {prod.nome}
                          </h3>
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 group-hover:bg-custom-100 rounded-md transition-colors">
                            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                            </svg>
                            <span className="text-xs font-mono text-gray-600">{prod.sku}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Footer com ações */}
          <DialogFooter className="border-t bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {selectedUpSellIds.length === 0 
                    ? 'Nenhum produto selecionado' 
                    : `${selectedUpSellIds.length} ${selectedUpSellIds.length === 1 ? 'produto selecionado' : 'produtos selecionados'}`
                  }
                </span>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setUpSellModalOpen(false);
                    setUpSellSearchTerm('');
                  }}
                  className="min-w-[100px]"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    setUpSellModalOpen(false);
                    setUpSellSearchTerm('');
                  }}
                  className="min-w-[100px] bg-gradient-to-r from-custom-600 to-amber-600 hover:from-custom-700 hover:to-amber-700"
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
