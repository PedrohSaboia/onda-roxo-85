import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/layout/AppHeader';
import ComercialSidebar from '@/components/layout/ComercialSidebar';
import { Check, X } from 'lucide-react';

type LeadRow = {
  id: string;
  created_at?: string;
  valor_total?: number | null;
  frete_yampi?: number | null;
  tag_utm?: string | null;
  tipo_pessoa?: string | null;
  nome?: string | null;
  contato?: string | null;
  produto_id?: string | null;
  responsavel?: string | null;
  status_lead_id?: number | null;
  [key: string]: any;
};

export default function Leads() {
  const navigate = useNavigate();
  const location = useLocation();

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [productsMap, setProductsMap] = useState<Record<string, any>>({});
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const pageSizeOptions = [10, 20, 30, 50];
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const from = (page - 1) * pageSize;
        const to = page * pageSize - 1;

        const { data: leadsData, error: leadsError, count } = await (supabase as any)
          .from('leads')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);
        if (leadsError) throw leadsError;

        // collect product ids and user ids to fetch related names
        const productIds = Array.from(new Set((leadsData || []).map((l: any) => l.produto_id).filter(Boolean)));
        const userIds = Array.from(new Set((leadsData || []).map((l: any) => l.responsavel).filter(Boolean)));

        const [productsResp, usersResp] = await Promise.all([
          productIds.length ? supabase.from('produtos').select('id,nome') : Promise.resolve({ data: [] }),
          userIds.length ? supabase.from('usuarios').select('id,nome,img_url') : Promise.resolve({ data: [] })
        ] as const);

        const products = (productsResp as any).data || [];
        const users = (usersResp as any).data || [];

        const pMap: Record<string, any> = {};
        products.forEach((p: any) => { pMap[p.id] = p; });
        const uMap: Record<string, any> = {};
        users.forEach((u: any) => { uMap[u.id] = u; });

        if (!mounted) return;
        setProductsMap(pMap);
        setUsersMap(uMap);
        setLeads(leadsData || []);
        setTotal(count || 0);
      } catch (err: any) {
        console.error('Erro ao carregar leads:', err);
        toast({ title: 'Erro', description: 'Não foi possível carregar leads', variant: 'destructive' });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false };
  }, [page, pageSize]);

    const updateStatus = async (leadId: string, newStatus: number) => {
    try {
      const { error } = await (supabase as any).from('leads').update({ status_lead_id: newStatus, updated_at: new Date().toISOString() }).eq('id', leadId);
      if (error) throw error;
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status_lead_id: newStatus } : l));
      toast({ title: 'Sucesso', description: 'Status atualizado' });
    } catch (err: any) {
      console.error('Erro ao atualizar status do lead:', err);
      toast({ title: 'Erro', description: 'Não foi possível atualizar o status', variant: 'destructive' });
    }
  };

    const copyContact = async (contato?: string | null) => {
      if (!contato) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(contato);
        } else {
          const ta = document.createElement('textarea');
          ta.value = contato;
          document.body.appendChild(ta);
          ta.select();
          (document as any).execCommand('copy');
          document.body.removeChild(ta);
        }
        toast({ title: 'Copiado', description: `Contato ${contato} copiado para a área de transferência.` });
      } catch (err: any) {
        console.error('Erro ao copiar contato:', err);
        toast({ title: 'Erro', description: 'Não foi possível copiar o contato', variant: 'destructive' });
      }
    };

    const filtered = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    const prodName = l.produto_id ? (productsMap[l.produto_id]?.nome || '') : '';
    return String(l.nome || '').toLowerCase().includes(q) || String(l.contato || '').toLowerCase().includes(q) || String(prodName).toLowerCase().includes(q);
  });

  const clearSearch = () => setSearch('');

  const totalPages = Math.max(1, Math.ceil((total || leads.length) / pageSize));
  const handlePrev = () => setPage(p => Math.max(1, p - 1));
  const handleNext = () => setPage(p => Math.min(totalPages, p + 1));

  const renderTypeIcon = (lead: LeadRow) => {
    const t = (lead.tipo_pessoa || lead.tag_utm || '').toString().toLowerCase();
    if (t.includes('whatsapp') || t.includes('wa')) return <span className="text-2xl">🟢</span>;
    if (t.includes('loja') || t.includes('shop')) return <span className="text-2xl">🛒</span>;
    if (t.includes('instagram') || t.includes('ig')) return <span className="text-2xl">📸</span>;
    // fallback
    return <span className="text-2xl">🔖</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader activeModule="comercial" onModuleChange={(m) => {
        // navigate to root with module query so other modules still work
        const next = new URLSearchParams(location.search);
        next.set('module', m);
        navigate({ pathname: '/', search: next.toString() });
      }} />

      <main className="min-h-[calc(100vh-8rem)]">
        <div className="flex items-start gap-6">
          <ComercialSidebar />

          <div className="flex-1 p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Lista de Leads</h1>
              <div className="flex items-center gap-2">
                <Input placeholder="Buscar lead" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button onClick={clearSearch} variant="secondary">Limpar</Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nome do Cliente</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>{renderTypeIcon(lead)}</TableCell>
                        <TableCell className="font-medium text-purple-700">{lead.nome || '—'}</TableCell>
                        <TableCell>
                          {lead.contato ? (
                            <button
                              className="text-green-700 hover:underline"
                              onClick={() => copyContact(lead.contato)}
                              title="Copiar contato"
                              aria-label={`Copiar contato ${lead.contato}`}
                            >
                              {lead.contato}
                            </button>
                          ) : '—'}
                        </TableCell>
                        <TableCell>R$ {Number(lead.valor_total || 0).toFixed(2)}</TableCell>
                        <TableCell>{lead.produto_id ? (productsMap[lead.produto_id]?.nome || '—') : '—'}</TableCell>
                        <TableCell>{lead.responsavel ? (usersMap[lead.responsavel]?.nome || '—') : '—'}</TableCell>
                        <TableCell>
                          {lead.status_lead_id === 1 ? (
                            <div className="flex items-center gap-2">
                              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => updateStatus(lead.id, 2)} title="Aprovar">
                                <Check className="h-4 w-4 text-white" />
                              </Button>
                              <Button className="bg-red-600 hover:bg-red-700" onClick={() => updateStatus(lead.id, 3)} title="Rejeitar">
                                <X className="h-4 w-4 text-white" />
                              </Button>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">{lead.status_lead_id === 2 ? 'Aprovado' : lead.status_lead_id === 3 ? 'Rejeitado' : '—'}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <div className="flex items-center justify-between p-4 border-t">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Mostrando <strong>{(page - 1) * pageSize + 1}</strong> - <strong>{Math.min(page * pageSize, total || filtered.length)}</strong> de <strong>{total || filtered.length}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Mostrar</label>
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                      className="border rounded px-2 py-1"
                    >
                      {pageSizeOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <span className="text-sm text-muted-foreground">/ página</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handlePrev} disabled={page <= 1}>Anterior</Button>
                  <div className="text-sm">{page} / {totalPages}</div>
                  <Button size="sm" variant="outline" onClick={handleNext} disabled={page >= totalPages}>Próximo</Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
