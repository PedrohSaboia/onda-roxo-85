import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Truck, Package, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockPedidos } from '@/data/mockData';
import { Pedido, EtiquetaEnvio } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Avatar } from '@/components/ui/avatar';

export function Logistica() {
  const [barcode, setBarcode] = useState('');
  const barcodeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // focus on mount
    setTimeout(() => barcodeRef.current?.focus(), 50);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // call RPC to find best matching item for this barcode
      handleScan(barcode.trim());
    }
  };

  

  const { toast } = useToast();
  const [loadingScan, setLoadingScan] = useState(false);
  const [foundPedido, setFoundPedido] = useState<any | null>(null);
  const [foundItemIds, setFoundItemIds] = useState<string[]>([]);
  const [itemInputs, setItemInputs] = useState<Record<string, string>>({});
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [itemStatus, setItemStatus] = useState<Record<string, 'idle' | 'success' | 'error'>>({});

  // logística view items (cards)
  type LogItem = { produto_id: string | null; variacao_id: string | null; quantidade_total: number; produto?: any; variacao?: any };
  const [logItems, setLogItems] = useState<LogItem[]>([]);
  const [loadingLogItems, setLoadingLogItems] = useState(false);
  const [logItemsError, setLogItemsError] = useState<string | null>(null);

  const fetchLogItems = async () => {
    setLoadingLogItems(true);
    setLogItemsError(null);
    try {
  const { data, error } = await (supabase as any).from('vw_itens_logistica').select('produto_id, variacao_id, quantidade_total');
      if (error) throw error;
      const rows = (data ?? []) as Array<{ produto_id: string | null; variacao_id: string | null; quantidade_total: number }>;

      // collect ids
      const produtoIds = Array.from(new Set(rows.map(r => r.produto_id).filter(Boolean))) as string[];
      const variacaoIds = Array.from(new Set(rows.map(r => r.variacao_id).filter(Boolean))) as string[];

      // fetch products and variations in parallel
      const [prodRes, varRes] = await Promise.all([
        produtoIds.length ? (supabase as any).from('produtos').select('id, nome, sku, img_url').in('id', produtoIds) : Promise.resolve({ data: [], error: null }),
        variacaoIds.length ? (supabase as any).from('variacoes_produto').select('id, nome, sku, img_url, produto_id').in('id', variacaoIds) : Promise.resolve({ data: [], error: null })
      ] as const);

      if (prodRes?.error) throw prodRes.error;
      if (varRes?.error) throw varRes.error;

      const prodMap = new Map<string, any>((prodRes?.data ?? []).map((p: any) => [p.id, p]));
      const varMap = new Map<string, any>((varRes?.data ?? []).map((v: any) => [v.id, v]));

      const enriched = rows.map(r => ({ ...r, produto: r.produto_id ? prodMap.get(r.produto_id) : undefined, variacao: r.variacao_id ? varMap.get(r.variacao_id) : undefined }));
      setLogItems(enriched);
    } catch (err) {
      console.error('Erro ao buscar itens de logística:', err);
      setLogItemsError(String(err));
      setLogItems([]);
    } finally {
      setLoadingLogItems(false);
    }
  };

  useEffect(() => {
    fetchLogItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // derived helpers for UI
  const items = foundPedido?.itens_pedido || [];
  const allItemsBipado = items.length > 0 && items.every((it: any) => (foundItemIds || []).includes(it.id) || it.bipado === true);

  const handleScan = async (code: string) => {
    if (!code) return;
    setLoadingScan(true);
    try {
      // Try atomic find-and-mark RPC first, fall back to find-only if not available
      let rpcRes: any = await (supabase as any).rpc('achar_e_marcar_item_por_codigo_bipado', { codigo_bipado: code });
      let data: any = rpcRes?.data ?? rpcRes;
      let error: any = rpcRes?.error ?? null;

      if (error && (error.code === 'PGRST202' || String(error.message || '').includes('achar_e_marcar_item_por_codigo_bipado'))) {
        const fallback: any = await (supabase as any).rpc('achar_item_por_codigo_bipado', { codigo_bipado: code });
        data = fallback?.data ?? fallback;
        error = fallback?.error ?? null;
      }

      if (error) throw error;

      if (!data || (Array.isArray(data) && data.length === 0)) {
        toast({ title: 'Não encontrado', description: 'Nenhum item encontrado para esse código', variant: 'destructive' });
        setFoundPedido(null);
        setFoundItemIds([]);
        return;
      }

      const row: any = Array.isArray(data) ? data[0] : data;

      // fetch pedido details (responsável, plataforma, itens)
      // Try including `bipado` column; if the DB doesn't have that column yet
      // (SQLSTATE 42703) retry without it so the UI still works.
      let pedidoRow: any = null;
      let pedErr: any = null;

  const selectWithBipado = `id,id_externo,link_etiqueta,responsavel:usuarios(id,nome,img_url),plataformas(id,nome,img_url), itens_pedido(id,quantidade,preco_unitario,codigo_barras,bipado, produto:produtos(id,nome,sku,img_url), variacao:variacoes_produto(id,nome,sku,img_url))`;
  const selectWithoutBipado = `id,id_externo,link_etiqueta,responsavel:usuarios(id,nome,img_url),plataformas(id,nome,img_url), itens_pedido(id,quantidade,preco_unitario,codigo_barras, produto:produtos(id,nome,sku,img_url), variacao:variacoes_produto(id,nome,sku,img_url))`;

      // first attempt including bipado
      const res1: any = await supabase
        .from('pedidos')
        .select(selectWithBipado)
        .eq('id', row.pedido_id)
        .single();

      pedidoRow = res1.data;
      pedErr = res1.error;

      // if bipado column is missing, retry without it
      if (pedErr && (pedErr?.code === '42703' || String(pedErr?.message || '').includes('bipado'))) {
        const res2: any = await supabase
          .from('pedidos')
          .select(selectWithoutBipado)
          .eq('id', row.pedido_id)
          .single();
        pedidoRow = res2.data;
        pedErr = res2.error;
      }

      if (pedErr) throw pedErr;

      setFoundPedido(pedidoRow);
      // merge the newly found id into existing state and focus next missing item based on the merged list
      setFoundItemIds((prev) => {
        const merged = Array.from(new Set([...(prev || []), row.item_pedido_id]));
        // clear input for next scan
        setBarcode('');

        // decide next focus using the merged ids
        const itemsForFocus: any[] = pedidoRow?.itens_pedido || [];
        const next = itemsForFocus.find((it: any) => !merged.includes(it.id) && !(it.bipado === true));
        if (next) {
          const start = Date.now();
          const tryFocus = () => {
            const el = itemRefs.current[next.id];
            if (el) {
              el.focus();
              return;
            }
            if (Date.now() - start < 2000) {
              setTimeout(tryFocus, 30);
            } else {
              barcodeRef.current?.focus();
            }
          };
          setTimeout(tryFocus, 30);
        } else {
          setTimeout(() => barcodeRef.current?.focus(), 0);
        }

        return merged;
      });
      // refresh cards after marking an item on the server
      try {
        await fetchLogItems();
      } catch (e) {
        // ignore — fetchLogItems logs its own errors
      }
    } catch (err: any) {
      console.error('Erro ao buscar item por código:', err);
      toast({ title: 'Erro', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setLoadingScan(false);
    }
  };

 return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Logística</h1>
        <p className="text-muted-foreground">
          Gerencie etiquetas de envio e conferência de pedidos
        </p>

        <div className="mt-6">
          <div className="flex items-center gap-4">
            <input
              ref={barcodeRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => {
                // if there's an active pedido with remaining un-bipado items, don't force focus back to main input
                const items = foundPedido?.itens_pedido || [];
                const hasMissing = items.some((it: any) => !foundItemIds.includes(it.id) && !it.bipado);
                if (!hasMissing) barcodeRef.current?.focus();
              }, 0)}
              className="flex-1 text-2xl p-2 border rounded bg-white"
              placeholder="Escaneie o código do produto aqui"
              aria-label="Leitor de código"
            />
            <Button variant="ghost" onClick={() => { setFoundPedido(null); setFoundItemIds([]); setItemInputs({}); setItemStatus({}); setBarcode(''); }}>Limpar</Button>
          </div>
        </div>

        {/* Cards: itens a enviar (view vw_itens_logistica) */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium">Itens a enviar</h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => fetchLogItems()}>Atualizar</Button>
            </div>
          </div>

          {loadingLogItems ? (
            <div className="text-sm text-muted-foreground">Carregando itens de logística...</div>
          ) : logItemsError ? (
            <div className="text-sm text-destructive">Erro: {logItemsError}</div>
          ) : logItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum item pendente para logística.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {logItems.map((it) => (
                <Card key={`${it.produto_id ?? 'p'}-${it.variacao_id ?? 'v'}`} className="h-28">
                  <CardContent className="flex items-center p-4 gap-3 h-full">
                    <div className="flex items-center h-full">
                      {it.variacao?.img_url || it.produto?.img_url ? (
                        <img src={it.variacao?.img_url || it.produto?.img_url} className="w-16 h-16 rounded object-cover" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded" />
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-center h-full">
                      <div className="font-medium">{it.variacao?.nome || it.produto?.nome || '—'}</div>
                      <div className="text-sm text-muted-foreground">SKU: {it.variacao?.sku || it.produto?.sku || '-'}</div>
                    </div>
                    <div className="text-right flex flex-col justify-center h-full">
                      <div className="text-sm text-muted-foreground">Qtd a enviar</div>
                      <div className="text-xl font-semibold">{it.quantidade_total}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

          {/* If a pedido was found, show a single pedido card with its items */}
          {foundPedido && (
            <div className="mt-6">
              <Card>
                {/* make the header area itself use the app header color (inline style for gradient) */}
                <CardHeader className="!p-4 text-white rounded-t" style={{ background: 'var(--gradient-primary)' }}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center">
                          <Avatar>
                            {foundPedido.responsavel?.img_url ? (
                              <img src={foundPedido.responsavel.img_url} alt={foundPedido.responsavel?.nome} />
                            ) : (
                              <div className="w-8 h-8 flex items-center justify-center bg-white/20 rounded text-sm font-medium text-white">{(foundPedido.responsavel?.nome || '—').split(' ').map((n: string) => n[0]).slice(0,2).join('')}</div>
                            )}
                          </Avatar>
                        </div>
                      <div className="flex items-center gap-2">
                        {foundPedido.plataformas?.img_url && (
                          <img src={foundPedido.plataformas.img_url} alt={foundPedido.plataformas.nome} className="w-8 h-8 rounded" />
                        )}
                        <div className="text-sm font-medium text-white/90">{foundPedido.id_externo || foundPedido.id || '—'}</div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="mt-3">
                  <div className="space-y-3">
                    {(foundPedido.itens_pedido || []).map((it: any) => (
                      <div key={it.id} className={`border rounded p-3 flex items-center justify-between ${foundItemIds.includes(it.id) ? 'border-red-500' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-3">
                          {it.produto?.img_url || it.variacao?.img_url ? (
                            <img src={it.variacao?.img_url || it.produto?.img_url} className="w-12 h-12 rounded" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded" />
                          )}
                          <div>
                            <div className="font-medium">{it.variacao?.nome || it.produto?.nome}</div>
                            <div className="text-sm text-muted-foreground">SKU: {it.variacao?.sku || it.produto?.sku || '-'}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-sm">Qtd: {it.quantidade}</div>
                          {foundItemIds.includes(it.id) ? (
                            <div className="px-3 py-1 border border-red-500 rounded text-sm font-medium text-red-700">{it.codigo_barras}</div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                ref={(el) => (itemRefs.current[it.id] = el)}
                                className={`border rounded px-2 py-1 text-sm ${itemStatus[it.id] === 'success' ? 'border-green-600' : ''} ${itemStatus[it.id] === 'error' ? 'border-red-600' : ''}`}
                                placeholder="Código"
                                value={itemInputs[it.id] || ''}
                                onChange={(e) => setItemInputs(prev => ({ ...prev, [it.id]: e.target.value }))}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = (itemInputs[it.id] || '').trim();
                                    if (!val) return;

                                    // immediate local comparison
                                    if (val === it.codigo_barras) {
                                      // success UI
                                      setItemStatus(prev => ({ ...prev, [it.id]: 'success' }));
                                      setFoundItemIds(prev => Array.from(new Set([...(prev || []), it.id])));
                                      setItemInputs(prev => ({ ...prev, [it.id]: '' }));

                                      // focus next missing item if present
                                      const items = foundPedido?.itens_pedido || [];
                                      const next = items.find((x: any) => x.id !== it.id && !((x.bipado === true) || (foundItemIds || []).includes(x.id)));
                                      if (next) {
                                        setTimeout(() => itemRefs.current[next.id]?.focus(), 0);
                                      } else {
                                        setTimeout(() => barcodeRef.current?.focus(), 0);
                                      }

                      // call server RPC to persist the bipagem and refresh cards
                      await handleScan(val);
                                    } else {
                                      // error UI: clear the input but keep focus so the user can bip again
                                      setItemStatus(prev => ({ ...prev, [it.id]: 'error' }));
                                      setItemInputs(prev => ({ ...prev, [it.id]: '' }));
                                      // ensure focus stays on this input for immediate re-scan
                                      setTimeout(() => itemRefs.current[it.id]?.focus(), 0);
                                      setTimeout(() => setItemStatus(prev => ({ ...prev, [it.id]: 'idle' })), 2000);
                                    }
                                  }
                                }}
                              />
                              {itemStatus[it.id] === 'success' && (
                                <CheckCircle className="text-green-600" />
                              )}
                              {itemStatus[it.id] === 'error' && (
                                <XCircle className="text-red-600" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                {allItemsBipado && (
                  <div className="p-4 flex justify-center">
                    <Button
                      onClick={async () => {
                        const link = foundPedido?.link_etiqueta;
                        if (link) {
                          // open etiqueta in new tab immediately
                          window.open(link, '_blank');
                        }

                        // attempt to conclude the pedido by updating status_id
                        try {
                          setLoadingScan(true);
                          const { data, error } = await supabase
                            .from('pedidos')
                            .update({ status_id: 'fa6b38ba-1d67-4bc3-821e-ab089d641a25' })
                            .eq('id', foundPedido?.id)
                            .select()
                            .single();

                          if (error) throw error;

                          toast({ title: 'Pedido concluído', description: 'Status atualizado com sucesso', variant: 'default' });

                          // hide everything and reset state
                          setFoundPedido(null);
                          setFoundItemIds([]);
                          setItemInputs({});
                          setItemStatus({});

                                  // refresh logistics cards after concluding pedido
                                  try {
                                    await fetchLogItems();
                                  } catch (e) {
                                    // ignore — fetchLogItems logs its own errors
                                  }

                          // focus main input for next scan
                          setTimeout(() => barcodeRef.current?.focus(), 0);
                        } catch (err: any) {
                          console.error('Erro ao concluir pedido:', err);
                          toast({ title: 'Erro ao concluir pedido', description: err.message || String(err), variant: 'destructive' });
                        } finally {
                          setLoadingScan(false);
                        }
                      }}
                    >
                      IMPRIMIR ETIQUETA
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          )}
      </div>
    </div>
  );
}