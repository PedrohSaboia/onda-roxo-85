import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import EmballagemModal from '@/components/shipping/EmballagemModal';

type Variation = {
  id?: string;
  nome: string;
  sku: string;
  valor: string;
  img_url?: string;
  qntd?: number;
}

export default function ProductForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState('');
  const [sku, setSku] = useState('');
  const [preco, setPreco] = useState('0.00');
  const [unidade, setUnidade] = useState('un');
  const [categoria, setCategoria] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [qntd, setQntd] = useState<number | ''>('');

  const [hasVariations, setHasVariations] = useState(false);
  const [variations, setVariations] = useState<Variation[]>([]);

  // Embalagens
  const [embalagens, setEmbalagens] = useState<any[]>([]);
  const [embalagemModalOpen, setEmbalagemModalOpen] = useState(false);
  const [selectedEmbalagemForModal, setSelectedEmbalagemForModal] = useState<any | undefined>(undefined);
  const [selectedEmbalagemId, setSelectedEmbalagemId] = useState<string | ''>('');
  const [nomeVariacao, setNomeVariacao] = useState<string>('');



  const reset = () => {
    setNome(''); setSku(''); setPreco('0.00'); setUnidade('un'); setCategoria(''); setImgUrl(''); setQntd('');
    setHasVariations(false); setVariations([]);
    setSelectedEmbalagemId('');
  }

  const addVariation = () => setVariations(v => [...v, { nome: '', sku: '', valor: '0.00', img_url: '', qntd: 0 }]);
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
      }
    } else {
      // No variations: product-level validations apply
      if (!sku.trim()) { toast({ title: 'SKU é obrigatório' }); return; }
      if (isNaN(Number(preco))) { toast({ title: 'Preço inválido' }); return; }
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
        preco: !hasVariations ? Number(preco) : 0.00,
        unidade: unidade || 'un',
        categoria: categoria || null,
        img_url: imgUrl || null,
        embalgens_id: selectedEmbalagemId || null,
        nome_variacao: nomeVariacao || null,
        qntd: qntd === '' ? 0 : Number(qntd),
      } as any;

      console.log('Produto a ser inserido:', prodInsert);

      const { data: prodData, error: prodErr } = await supabase
        .from('produtos')
        .insert(prodInsert)
        .select('id')
        .single();

      if (prodErr) throw prodErr;

      const produtoId = prodData.id as string;

      if (hasVariations && variations.length > 0) {
        const toInsert = variations.map(v => ({
          produto_id: produtoId,
          nome: v.nome,
          sku: v.sku,
          valor: Number(v.valor),
          img_url: v.img_url || null,
          qntd: v.qntd ?? 0,
        }));

        const { error: varErr } = await supabase.from('variacoes_produto').insert(toInsert);
        if (varErr) throw varErr;
      }

      toast({ title: 'Produto criado', description: `Produto ${nome} criado com sucesso` });
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

  const handleSaveEmbalagem = async (data: any) => {
    try {
      if (selectedEmbalagemForModal && selectedEmbalagemForModal.id) {
        const { error } = await supabase.from('embalagens').update(data).eq('id', selectedEmbalagemForModal.id);
        if (error) throw error;
        setSelectedEmbalagemId(selectedEmbalagemForModal.id);
      } else {
        const { data: ins, error } = await supabase.from('embalagens').insert(data).select('id').single();
        if (error) throw error;
        setSelectedEmbalagemId(ins.id);
      }
    } catch (err: any) {
      throw err;
    } finally {
      setEmbalagemModalOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6 overflow-auto">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose()} />

      <Card className="w-full max-w-3xl z-50 max-h-[90vh] overflow-auto">
        <CardHeader>
          <CardTitle>Cadastrar Produto</CardTitle>
        </CardHeader>
        <CardContent>
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
            <div>
              <Label>Embalagem</Label>
              <div className="flex items-center gap-2">
                <select className="flex-1 border rounded px-2 py-1" value={selectedEmbalagemId} onChange={e => setSelectedEmbalagemId(e.target.value)}>
                  <option value="">-- Selecionar --</option>
                  {embalagens.map(em => (
                    <option key={em.id} value={em.id}>{em.nome} ({em.comprimento}×{em.largura}×{em.altura} cm - {em.peso} kg)</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" onClick={() => { setSelectedEmbalagemForModal(undefined); setEmbalagemModalOpen(true); }}>
                  Nova
                </Button>
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Imagem URL (img_url)</Label>
              <Input value={imgUrl} onChange={(e)=>setImgUrl(e.target.value)} />
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={hasVariations} onChange={(e)=>setHasVariations(e.target.checked)} />
              <span>Possui variações</span>
            </label>
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
                      <Label>Imagem URL</Label>
                      <Input value={v.img_url} onChange={(e)=>updateVariation(idx, { img_url: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button variant="destructive" size="sm" onClick={()=>removeVariation(idx)}>Remover</Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={()=> { reset(); onClose(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar'}</Button>
          </div>
        </CardContent>
      </Card>
      <EmballagemModal open={embalagemModalOpen} onClose={() => setEmbalagemModalOpen(false)} onSave={handleSaveEmbalagem} embalagem={selectedEmbalagemForModal} />
    </div>
  )
}
