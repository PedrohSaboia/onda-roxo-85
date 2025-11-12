import React, { useEffect, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

type PedidoRow = {
  pedido_id: string;
  id_externo?: string;
  cliente_nome?: string;
  contato?: string;
  cpf?: string | null;
  cnpj?: string | null;
};

type LeadRow = {
  id: number;
  nome?: string | null;
  razao_social?: string | null;
  contato?: string | null;
  email?: string | null;
};

export function SearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<'pedidos' | 'leads'>('pedidos');
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 300);
    return () => clearTimeout(t);
  }, [term]);
  const [pedidos, setPedidos] = useState<PedidoRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);

  useEffect(() => {
    const q = String(debounced || '').trim();
    if (!q) {
      setPedidos([]); setLeads([]); return;
    }
    const run = async () => {
      setLoading(true);
      try {
        if (tab === 'pedidos') {
          // search vw_clientes_pedidos by id_externo, cliente_nome, contato, cpf, cnpj
          const orFilter = `id_externo.ilike.%${q}%,cliente_nome.ilike.%${q}%,contato.ilike.%${q}%,cpf.ilike.%${q}%,cnpj.ilike.%${q}%`;
          const res = await (supabase as any).from('vw_clientes_pedidos').select('pedido_id, id_externo, cliente_nome, contato, cpf, cnpj').or(orFilter).limit(6);
          console.debug('SearchPanel pedidos res:', res);
          if (res?.error) {
            console.error('SearchPanel pedidos error', res.error);
            setPedidos([]);
            return;
          }
          const rows = (res?.data ?? []) as any[];
          // normalize cpf/cnpj/contato matching client-side (digits)
          const qDigits = q.replace(/\D/g, '');
          const filtered = rows.filter(r => {
            if (!qDigits) return true;
            const anyDigits = String(r.cpf || '') + String(r.cnpj || '') + String(r.contato || '');
            return anyDigits.replace(/\D/g, '').includes(qDigits) || String(r.cliente_nome || '').toLowerCase().includes(q.toLowerCase()) || String(r.id_externo || '').toLowerCase().includes(q.toLowerCase());
          }).slice(0,4).map(r => ({ pedido_id: r.pedido_id, id_externo: r.id_externo, cliente_nome: r.cliente_nome, contato: r.contato, cpf: r.cpf, cnpj: r.cnpj }));
          setPedidos(filtered);
        } else {
          // leads: search nome, razao_social, contato, email
          const orFilter = `nome.ilike.%${q}% , razao_social.ilike.%${q}% , contato.ilike.%${q}% , email.ilike.%${q}%`;
          const res = await (supabase as any).from('leads').select('id, nome, razao_social, contato, email').or(orFilter).limit(6);
          console.debug('SearchPanel leads res:', res);
          if (res?.error) {
            console.error('SearchPanel leads error', res.error);
            setLeads([]);
            return;
          }
          const rows = (res?.data ?? []) as any[];
          const qDigits = q.replace(/\D/g, '');
          const filtered = rows.filter(r => {
            if (!qDigits) return true;
            return String(r.contato || '').replace(/\D/g, '').includes(qDigits) || String(r.nome || '').toLowerCase().includes(q.toLowerCase()) || String(r.razao_social || '').toLowerCase().includes(q.toLowerCase()) || String(r.email || '').toLowerCase().includes(q.toLowerCase());
          }).slice(0,4).map(r => ({ id: r.id, nome: r.nome, razao_social: r.razao_social, contato: r.contato, email: r.email }));
          setLeads(filtered);
        }
      } catch (err) {
        console.error('SearchPanel error', err);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [debounced, tab]);

  return open ? (
    <div ref={ref} className="absolute right-4 top-full z-50">
      <Card className="w-[400px]">
        <CardContent className="mt-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'pedidos' | 'leads')}>
            <TabsList>
              <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
            </TabsList>
            <div className="mt-3">
              <Input placeholder={tab === 'pedidos' ? 'Buscar pedido por id_externo, cliente, contato, cpf/cnpj' : 'Buscar lead por nome, razão, contato, email'} value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
            <div className="mt-3">
              {loading ? <div className="text-sm text-muted-foreground">Buscando...</div> : (
                <div className="space-y-2">
                  {tab === 'pedidos' ? (
                    pedidos.map(p => (
                        <div key={p.pedido_id} className="p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={() => { onClose(); navigate(`/pedido/${p.pedido_id}`); }}>
                          <div className="font-medium">{p.id_externo || p.pedido_id}</div>
                          <div className="text-sm text-muted-foreground">{p.cliente_nome} • {p.contato || ''} {p.cpf || p.cnpj ? `• ${p.cpf || p.cnpj}` : ''}</div>
                        </div>
                    ))
                    ) : (
                    leads.map(l => (
                      <div key={l.id} className="p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <div className="font-medium">{l.nome || l.razao_social}</div>
                        <div className="text-sm text-muted-foreground">{l.contato || ''} • {l.email || ''}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  ) : null;
}

export default SearchPanel;
