import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

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

  if (!open) return null;

  const reset = () => {
    setNome(''); setSku(''); setPreco('0.00'); setUnidade('un'); setCategoria(''); setImgUrl(''); setQntd('');
    setHasVariations(false); setVariations([]);
  }

  const addVariation = () => setVariations(v => [...v, { nome: '', sku: '', valor: '0.00', img_url: '', qntd: 0 }]);
  const updateVariation = (idx: number, patch: Partial<Variation>) => setVariations(v => v.map((it,i)=> i===idx ? { ...it, ...patch } : it));
  const removeVariation = (idx: number) => setVariations(v => v.filter((_,i)=> i!==idx));

  const handleSubmit = async () => {
    if (!nome.trim()) { toast({ title: 'Nome é obrigatório' }); return; }
    if (!sku.trim()) { toast({ title: 'SKU é obrigatório' }); return; }
    if (isNaN(Number(preco))) { toast({ title: 'Preço inválido' }); return; }

    setSaving(true);
    try {
      // Insert product
      const prodInsert = {
        nome: nome.trim(),
        sku: sku.trim(),
        preco: Number(preco),
        unidade: unidade || 'un',
        categoria: categoria || null,
        img_url: imgUrl || null,
        qntd: qntd === '' ? 0 : Number(qntd),
      } as any;

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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose()} />

      <Card className="w-full max-w-3xl z-50">
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
    </div>
  )
}
