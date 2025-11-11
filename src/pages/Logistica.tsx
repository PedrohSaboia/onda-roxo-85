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
      // keep focus after Enter
      setTimeout(() => barcodeRef.current?.focus(), 0);
    }
  };

  const { toast } = useToast();
  const [loadingScan, setLoadingScan] = useState(false);
  const [foundPedido, setFoundPedido] = useState<any | null>(null);
  const [foundItemIds, setFoundItemIds] = useState<string[]>([]);

  const handleScan = async (code: string) => {
    if (!code) return;
    setLoadingScan(true);
    try {
      // Call the DB function to find one matching item (as implemented in Postgres)
      const rpcRes: any = await (supabase as any).rpc('achar_item_por_codigo_bipado', { codigo_bipado: code });
      const data: any = rpcRes?.data ?? rpcRes; // supabase client can return raw row or { data, error }
      const error: any = rpcRes?.error ?? null;
      if (error) throw error;

      if (!data || (Array.isArray(data) && data.length === 0)) {
        toast({ title: 'Não encontrado', description: 'Nenhum item encontrado para esse código', variant: 'destructive' });
        setFoundPedido(null);
        setFoundItemIds([]);
        return;
      }

      // rpc returns a single row or array with one element depending on PostgREST mapping
  const row: any = Array.isArray(data) ? data[0] : data;

      // fetch pedido details (responsável, plataforma, itens)
      const { data: pedidoRow, error: pedErr } = await supabase
        .from('pedidos')
        .select(`id,id_externo,responsavel:usuarios(id,nome,img_url),plataformas(id,nome,img_url), itens_pedido(id,quantidade,preco_unitario,codigo_barras, produto:produtos(id,nome,sku,img_url), variacao:variacoes_produto(id,nome,sku,img_url))`)
        .eq('id', row.pedido_id)
        .single();

      if (pedErr) throw pedErr;

      setFoundPedido(pedidoRow);
      // mark which item id was returned by the search
      setFoundItemIds([row.item_pedido_id]);
      // clear input for next scan
      setBarcode('');
      // keep focus
      setTimeout(() => barcodeRef.current?.focus(), 0);
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
          <input
            ref={barcodeRef}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => barcodeRef.current?.focus(), 0)}
            className="w-full text-2xl p-2 border rounded bg-white"
            placeholder="Escaneie o código do produto aqui"
            aria-label="Leitor de código"
          />
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
                      {foundPedido.plataformas?.img_url && (
                        <img src={foundPedido.plataformas.img_url} alt={foundPedido.plataformas.nome} className="w-8 h-8 rounded ml-4" />
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-sm text-white/90">Pedido</div>
                      <div className="font-semibold text-white">{foundPedido.id_externo || foundPedido.id || '—'}</div>
                      <Button variant="ghost" className="text-white" onClick={() => { setFoundPedido(null); setFoundItemIds([]); }}>Limpar</Button>
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
                            <input className="border rounded px-2 py-1 text-sm" placeholder="Código" readOnly />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
      </div>
    </div>
  );
}