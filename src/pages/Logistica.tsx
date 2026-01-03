import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Truck, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react';
import { FaBoxesStacked } from 'react-icons/fa6';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockPedidos } from '@/data/mockData';
import { Pedido, EtiquetaEnvio } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function Logistica() {
  const [barcode, setBarcode] = useState('');
  const barcodeRef = useRef<HTMLInputElement | null>(null);
  const { user, empresaId } = useAuth();
  
  // Estados para a etiqueta ML
  const [gerandoEtiquetaML, setGerandoEtiquetaML] = useState(false);
  const [etiquetaMLModalOpen, setEtiquetaMLModalOpen] = useState(false);
  const [etiquetaMLPdfUrl, setEtiquetaMLPdfUrl] = useState<string | null>(null);

  // Estados para o modal de etiqueta padrão
  const [etiquetaModalOpen, setEtiquetaModalOpen] = useState(false);
  const [etiquetaUrl, setEtiquetaUrl] = useState<string | null>(null);

  // Estados para saldo Melhor Envio
  const [saldoMelhorEnvio, setSaldoMelhorEnvio] = useState<number | null>(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);

  // Buscar saldo do Melhor Envio
  const fetchSaldoMelhorEnvio = async () => {
    setLoadingSaldo(true);
    try {
      // Obter token de sessão do usuário autenticado
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('Usuário não autenticado');
        return;
      }
      
      const response = await fetch('https://rllypkctvckeaczjesht.supabase.co/functions/v1/buscar_saldo_melhor_envio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(errorData.message || 'Erro ao buscar saldo');
      }

      const data = await response.json();
      console.log('Saldo Melhor Envio:', data);
      
      if (data?.balance !== undefined) {
        setSaldoMelhorEnvio(data.balance);
      }
    } catch (error) {
      console.error('Erro ao buscar saldo do Melhor Envio:', error);
    } finally {
      setLoadingSaldo(false);
    }
  };

  useEffect(() => {
    // focus on mount
    setTimeout(() => barcodeRef.current?.focus(), 50);
    // buscar saldo ao carregar a página
    fetchSaldoMelhorEnvio();
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
  
  // Verifica se deve mostrar o botão da etiqueta ML
  // Prioridade: shipping_id deve ter valor (não null, não vazio)
  // Secundário: deve ser da plataforma Mercado Livre
  const shouldShowMLButton = foundPedido?.plataforma_id === '3e5a2b44-245a-4be9-a0b1-ef67d83fd8ec' 
                            && foundPedido?.shipping_id 
                            && String(foundPedido.shipping_id).trim() !== '';

  const handleGerarEtiquetaML = async () => {
    if (!foundPedido?.id_externo) {
      toast({ 
        title: 'Erro', 
        description: 'O pedido não possui ID externo (id_externo) definido',
        variant: 'destructive'
      });
      return;
    }

    setGerandoEtiquetaML(true);

    try {
      const EDGE_FUNCTION_URL = 'https://rllypkctvckeaczjesht.supabase.co/functions/v1/gerar-etiqueta-ml';

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id_externo: foundPedido.id_externo }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro desconhecido ao gerar etiqueta');
      }

      const data = await response.json();
      const pdfBase64 = data.pdf_base64;

      if (!pdfBase64) {
        throw new Error('O Base64 do PDF não foi retornado.');
      }

      // Converte Base64 para Blob
      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // Cria URL do Blob e abre o modal
      const blobUrl = URL.createObjectURL(blob);
      setEtiquetaMLPdfUrl(blobUrl);
      setEtiquetaMLModalOpen(true);

      toast({ title: 'Sucesso', description: 'Etiqueta gerada! Visualize e imprima.' });
    } catch (error: any) {
      console.error('Erro ao processar a etiqueta:', error);
      toast({ 
        title: 'Erro', 
        description: `Erro ao processar a etiqueta: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setGerandoEtiquetaML(false);
    }
  };

  const handleFecharModalEtiquetaML = () => {
    setEtiquetaMLModalOpen(false);
    if (etiquetaMLPdfUrl) {
      URL.revokeObjectURL(etiquetaMLPdfUrl);
      setEtiquetaMLPdfUrl(null);
    }
  };

  const handleScan = async (code: string) => {
    if (!code) return;
    setLoadingScan(true);
    try {

      // Call RPC to find item by barcode (server function `achar_item_por_codigo_bipado`)
      let data: any = null;
      let error: any = null;
      try {
        const rpcRes: any = await (supabase as any).rpc('achar_item_por_codigo_bipado', { codigo_bipado: code });
        data = rpcRes?.data ?? rpcRes;
        error = rpcRes?.error ?? null;
      } catch (e: any) {
        error = e;
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

  const selectWithBipado = `id,id_externo,plataforma_id,shipping_id,responsavel:usuarios(id,nome,img_url),plataformas(id,nome,img_url), itens_pedido(id,quantidade,preco_unitario,codigo_barras,bipado, produto:produtos(id,nome,sku,img_url), variacao:variacoes_produto(id,nome,sku,img_url))`;
  const selectWithoutBipado = `id,id_externo,plataforma_id,shipping_id,responsavel:usuarios(id,nome,img_url),plataformas(id,nome,img_url), itens_pedido(id,quantidade,preco_unitario,codigo_barras, produto:produtos(id,nome,sku,img_url), variacao:variacoes_produto(id,nome,sku,img_url))`;

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

      console.log('Pedido encontrado:', pedidoRow);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Logística</h1>
            <p className="text-muted-foreground">
              Envio de pedidos
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Saldo Melhor Envio</div>
            <div className="text-2xl font-bold text-green-600">
              {loadingSaldo ? (
                <span className="text-base">Carregando...</span>
              ) : saldoMelhorEnvio !== null ? (
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoMelhorEnvio)
              ) : (
                <span className="text-base text-muted-foreground">--</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
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
                className="w-full text-2xl py-2 pl-3 pr-24 border-2 rounded-[16px] bg-white focus:outline-none focus:ring-0 focus:border-custom-600 transition-colors"
                placeholder="Escaneie o código do produto aqui"
                aria-label="Leitor de código"
              />
              <Button
                variant="ghost"
                onClick={() => { setFoundPedido(null); setFoundItemIds([]); setItemInputs({}); setItemStatus({}); setBarcode(''); }}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3 text-sm"
              >
                Limpar
              </Button>
            </div>
          </div>
        </div>

        {/* Cards: itens a enviar (view vw_itens_logistica) - only show when no pedido is active */}
        {!foundPedido && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-medium" style={{ fontSize: '18px', fontWeight: 600 }}>ITENS A ENVIAR</h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => fetchLogItems()} className="border border-gray-200 rounded-md px-2 py-1 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </Button>
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
                        <img src={it.variacao?.img_url || it.produto?.img_url} className="w-12 h-12 rounded-full object-cover border-2 border-gray-200" />
                      ) : (
                        <div className="w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center text-custom-700">
                          <FaBoxesStacked className="w-6 h-6" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-center h-full">
                      <div className="font-medium">{it.produto?.nome || it.variacao?.nome || '—'}</div>
                      {it.variacao?.nome ? (
                        <div className="text-sm text-muted-foreground">{it.variacao.nome}</div>
                      ) : null}
                    </div>
                    <div className="text-right flex flex-col justify-center h-full">
                      <div className="text-sm text-muted-foreground">A enviar</div>
                      <div className="text-xl font-semibold">{it.quantidade_total}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          </div>
        )}

          {/* If a pedido was found, show a single pedido card with its items */}
          {foundPedido && (
            <div className="mt-6">
              <Card>
                {/* make the header area itself use the app header color (inline style for gradient) */}
                <CardHeader className="!p-4 text-white rounded-t" style={{ background: 'var(--gradient-primary)' }}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center">
                          <Avatar className="h-10 w-10">
                            {foundPedido.responsavel?.img_url ? (
                              <img src={foundPedido.responsavel.img_url} alt={foundPedido.responsavel?.nome} className="h-full w-full object-cover rounded-full" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-white/20 rounded-full text-sm font-medium text-white">{(foundPedido.responsavel?.nome || '—').split(' ').map((n: string) => n[0]).slice(0,2).join('')}</div>
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
                            <img src={it.variacao?.img_url || it.produto?.img_url} className="w-12 h-12 rounded-full border-2 border-gray-200" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400">
                              <FaBoxesStacked className="w-6 h-6" aria-hidden />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{it.produto?.nome || it.variacao?.nome}</div>
                            {it.variacao?.nome ? (
                              <div className="text-sm text-muted-foreground">{it.variacao.nome}</div>
                            ) : null}
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
                                        // Todos os itens foram bipados - não foca no input principal
                                        // O botão de imprimir etiqueta será habilitado automaticamente
                                      }
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
                    {shouldShowMLButton ? (
                      // Botão Etiqueta Mercado Livre
                      <Button
                        onClick={handleGerarEtiquetaML}
                        disabled={gerandoEtiquetaML}
                        className="bg-yellow-500 hover:bg-yellow-600"
                      >
                        {gerandoEtiquetaML ? (
                          <>
                            <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full" />
                            Gerando...
                          </>
                        ) : (
                          '📦 Etiqueta Mercado Livre'
                        )}
                      </Button>
                    ) : (
                      // Botão Imprimir Etiqueta original
                      <Button
                        disabled={loadingScan}
                        onClick={async () => {
                          try {
                            setLoadingScan(true);

                            // Buscar empresa_id do usuário logado
                            if (!empresaId) {
                              throw new Error('Empresa do usuário não encontrada');
                            }

                            // Chamar Edge Function para processar etiqueta
                            const edgeFunctionUrl = 'https://rllypkctvckeaczjesht.supabase.co/functions/v1/processar_etiqueta_em_envio_de_pedido';
                            const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

                            console.log('Chamando Edge Function para processar etiqueta...');
                            const edgeResponse = await fetch(edgeFunctionUrl, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${supabaseKey}`,
                              },
                              body: JSON.stringify({
                                pedido_id: foundPedido?.id,
                                empresa_id: empresaId,
                              }),
                            });

                            if (!edgeResponse.ok) {
                              const errorData = await edgeResponse.json().catch(() => ({ error: 'Erro desconhecido' }));
                              throw new Error(errorData.error || `Erro ao processar etiqueta: ${edgeResponse.status}`);
                            }

                            const etiquetaData = await edgeResponse.json();
                            console.log('Etiqueta processada com sucesso:', etiquetaData);

                            // Atualizar status do pedido
                            const { data, error } = await supabase
                              .from('pedidos')
                              .update({ 
                                status_id: 'fa6b38ba-1d67-4bc3-821e-ab089d641a25',
                                data_enviado: new Date().toISOString()
                              })
                              .eq('id', foundPedido?.id)
                              .select('id, id_externo')
                              .single();

                            if (error) throw error;

                            console.log('=== APÓS ATUALIZAÇÃO DO PEDIDO ===');
                            console.log('Pedido atualizado (data):', data);
                            
                            // Usar link da etiqueta retornado pela Edge Function
                            const link = etiquetaData?.etiqueta?.link_etiqueta;
                            console.log('Link extraído da Edge Function:', link);
                            console.log('Tipo do link:', typeof link);
                            console.log('Link é truthy?', !!link);
                            
                            if (link) {
                              console.log('Tentando abrir link:', link);
                              window.open(link, '_blank');
                              console.log('window.open executado');
                            } else {
                              console.log('Link não encontrado na resposta da Edge Function');
                            }

                            toast({ 
                              title: 'Pedido concluído', 
                              description: 'Etiqueta processada e status atualizado com sucesso', 
                              variant: 'default' 
                            });

                            // Limpar estado e resetar
                            setFoundPedido(null);
                            setFoundItemIds([]);
                            setItemInputs({});
                            setItemStatus({});

                            // Atualizar cards de logística
                            try {
                              await fetchLogItems();
                            } catch (e) {
                              // ignore — fetchLogItems logs its own errors
                            }

                            // Focar no input principal
                            setTimeout(() => barcodeRef.current?.focus(), 0);
                          } catch (err: any) {
                            console.error('Erro ao processar pedido:', err);
                            toast({ 
                              title: 'Erro ao processar pedido', 
                              description: err.message || String(err), 
                              variant: 'destructive' 
                            });
                          } finally {
                            setLoadingScan(false);
                          }
                        }}
                      >
                        {loadingScan ? 'PROCESSANDO...' : 'IMPRIMIR ETIQUETA'}
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}
      </div>
      
      {/* Modal: Etiqueta Mercado Livre */}
      <Dialog open={etiquetaMLModalOpen} onOpenChange={(open) => { if (!open) handleFecharModalEtiquetaML(); }}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>📦 Etiqueta Mercado Livre</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {etiquetaMLPdfUrl && (
              <iframe
                src={etiquetaMLPdfUrl}
                className="w-full h-full border rounded-lg"
                title="Etiqueta ML PDF"
              />
            )}
          </div>
          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button variant="outline" onClick={handleFecharModalEtiquetaML}>
                Fechar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Etiqueta Padrão */}
      <Dialog open={etiquetaModalOpen} onOpenChange={setEtiquetaModalOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>📄 Etiqueta de Envio</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {etiquetaUrl && (
              <iframe
                src={etiquetaUrl}
                className="w-full h-full border rounded-lg"
                title="Etiqueta de Envio"
              />
            )}
          </div>
          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button variant="outline" onClick={() => setEtiquetaModalOpen(false)}>
                Fechar
              </Button>
              <Button onClick={() => {
                if (etiquetaUrl) {
                  window.open(etiquetaUrl, '_blank');
                }
              }}>
                Abrir em Nova Guia
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}