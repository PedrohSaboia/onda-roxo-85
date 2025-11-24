import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/layout/AppHeader';
import ComercialSidebar from '@/components/layout/ComercialSidebar';
import { Check, X, Pencil, SquarePlus } from 'lucide-react';

type LeadRow = {
  id: string;
  created_at?: string;
  valor_total?: number | null;
  frete_yampi?: number | null;
  tag_utm?: string | null;
  tipo_pessoa?: string | null;
  tipo_de_lead_id?: number | null;
  vendido?: boolean | null;
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
  const [tipoDeLeadsMap, setTipoDeLeadsMap] = useState<Record<string, any>>({});
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [addOpen, setAddOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<LeadRow | null>(null);
  const [addOption, setAddOption] = useState<string | null>(null);
  const [addValue1, setAddValue1] = useState<string>('');
  const [addValue2, setAddValue2] = useState<string>('');
  const [addDate, setAddDate] = useState<string>('');
  const [transportadoras, setTransportadoras] = useState<Array<{ id: string; nome: string }>>([]);
  const [loadingTransportadoras, setLoadingTransportadoras] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pix' | 'carrinho'>('all');
  const [pixCount, setPixCount] = useState<number>(0);
  const [carrinhoCount, setCarrinhoCount] = useState<number>(0);

  // carregar transportadoras quando o modal abrir
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!addOpen) return;
      setLoadingTransportadoras(true);
      try {
        const { data, error } = await (supabase as any).from('transportadoras').select('id,nome');
        if (error) throw error;
        if (!mounted) return;
        const list = (data || []).map((r: any) => ({ id: r.id, nome: r.nome }));
        setTransportadoras(list);
        if (list.length && !addOption) setAddOption(list[0].id);
      } catch (err) {
        console.error('Erro ao carregar transportadoras:', err);
        setTransportadoras([]);
      } finally {
        if (mounted) setLoadingTransportadoras(false);
      }
    };
    load();
    return () => { mounted = false };
  }, [addOpen, addOption]);
  const pageSizeOptions = [10, 20, 30, 50];
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const from = (page - 1) * pageSize;
        const to = page * pageSize - 1;

        // Build query with filters
        let query = (supabase as any)
          .from('leads')
          .select('*', { count: 'exact' })
          .or('vendido.is.null,vendido.eq.false')
          .order('created_at', { ascending: false });

        // Apply filter based on activeFilter
        if (activeFilter === 'pix') {
          query = query.eq('tipo_de_lead_id', 1).eq('status_lead_id', 1);
        } else if (activeFilter === 'carrinho') {
          query = query.eq('tipo_de_lead_id', 2).eq('status_lead_id', 1);
        }

        // Apply search filter in database query
        if (search) {
          query = query.or(`nome.ilike.%${search}%,contato.ilike.%${search}%`);
        }

        const { data: leadsData, error: leadsError, count } = await query.range(from, to);
        if (leadsError) throw leadsError;

        // collect product ids and user ids to fetch related names
        const productIds = Array.from(new Set((leadsData || []).map((l: any) => l.produto_id).filter(Boolean)));
        const userIds = Array.from(new Set((leadsData || []).map((l: any) => l.responsavel).filter(Boolean)));
        const tipoIds = Array.from(new Set((leadsData || []).map((l: any) => l.tipo_de_lead_id).filter(Boolean)));

        const [productsResp, usersResp, tiposResp] = await Promise.all([
          productIds.length ? supabase.from('produtos').select('id,nome') : Promise.resolve({ data: [] }),
          userIds.length ? supabase.from('usuarios').select('id,nome,img_url') : Promise.resolve({ data: [] }),
          tipoIds.length ? (supabase as any).from('tipo_de_lead').select('id,nome,img_url') : Promise.resolve({ data: [] })
        ] as const);

        const products = (productsResp as any).data || [];
        const users = (usersResp as any).data || [];
  const tipos = (tiposResp as any).data || [];

        const pMap: Record<string, any> = {};
        products.forEach((p: any) => { pMap[p.id] = p; });
        const uMap: Record<string, any> = {};
        users.forEach((u: any) => { uMap[u.id] = u; });
  const tMap: Record<string, any> = {};
  tipos.forEach((t: any) => { tMap[String(t.id)] = t; });

        if (!mounted) return;
        setProductsMap(pMap);
        setUsersMap(uMap);
  setTipoDeLeadsMap(tMap);
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
  }, [page, pageSize, activeFilter, search]);

  // Calculate counts for Pix and Carrinho filters from database (all records, not just current page)
  useEffect(() => {
    let mounted = true;
    const loadCounts = async () => {
      try {
        // Count Pix leads (tipo_de_lead_id = 1, status_lead_id = 1, vendido = false or null)
        const { count: pixTotal, error: pixError } = await (supabase as any)
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('tipo_de_lead_id', 1)
          .eq('status_lead_id', 1)
          .or('vendido.is.null,vendido.eq.false');
        
        if (pixError) throw pixError;

        // Count Carrinho leads (tipo_de_lead_id = 2, status_lead_id = 1, vendido = false or null)
        const { count: carrinhoTotal, error: carrinhoError } = await (supabase as any)
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('tipo_de_lead_id', 2)
          .eq('status_lead_id', 1)
          .or('vendido.is.null,vendido.eq.false');
        
        if (carrinhoError) throw carrinhoError;

        if (!mounted) return;
        setPixCount(pixTotal || 0);
        setCarrinhoCount(carrinhoTotal || 0);
      } catch (err: any) {
        console.error('Erro ao carregar contagens:', err);
      }
    };
    
    loadCounts();
    return () => { mounted = false };
  }, [page, pageSize]); // Recarregar quando mudar de página para atualizar após mudanças de status

    const updateStatus = async (leadId: string, newStatus: number) => {
    try {
      const { error } = await (supabase as any).from('leads').update({ status_lead_id: newStatus }).eq('id', leadId);
      if (error) throw error;
      
      // Remove lead from list immediately if it no longer matches the filter
      if (activeFilter === 'pix' || activeFilter === 'carrinho') {
        // Lead with status !== 1 should be removed from filtered views
        if (newStatus !== 1) {
          setLeads(prev => prev.filter(l => l.id !== leadId));
        }
      } else {
        // Update status in "all" view
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status_lead_id: newStatus } : l));
      }
      
      // Reload counts to update badges in real-time
      const [pixResp, carrinhoResp] = await Promise.all([
        (supabase as any)
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('tipo_de_lead_id', 1)
          .eq('status_lead_id', 1)
          .or('vendido.is.null,vendido.eq.false'),
        (supabase as any)
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('tipo_de_lead_id', 2)
          .eq('status_lead_id', 1)
          .or('vendido.is.null,vendido.eq.false')
      ]);
      
      setPixCount(pixResp.count || 0);
      setCarrinhoCount(carrinhoResp.count || 0);
      
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

    // No frontend filtering needed - search is handled by database query
    const filtered = leads;

  const clearSearch = () => {
    setSearch('');
    setPage(1); // Reset to first page when clearing search
  };

  const totalPages = Math.max(1, Math.ceil((total || leads.length) / pageSize));
  const handlePrev = () => setPage(p => Math.max(1, p - 1));
  const handleNext = () => setPage(p => Math.min(totalPages, p + 1));

  const renderTypeIcon = (lead: LeadRow) => {
    // try tipo_de_lead mapping first (prefer image from DB)
    const tipoKey = String(lead.tipo_de_lead_id ?? '');
    const tipo = tipoDeLeadsMap[tipoKey];
    if (tipo && tipo.img_url) {
      return (
        <img
          src={tipo.img_url}
          alt={tipo.nome || 'tipo'}
          className="h-6 w-6 rounded object-cover"
        />
      );
    }

    // fallback to previous heuristics using tipo_pessoa/tag_utm
    const t = (lead.tipo_pessoa || lead.tag_utm || '').toString().toLowerCase();
    if (t.includes('whatsapp') || t.includes('wa')) return <span className="text-2xl">🟢</span>;
    if (t.includes('loja') || t.includes('shop')) return <span className="text-2xl">🛒</span>;
    if (t.includes('instagram') || t.includes('ig')) return <span className="text-2xl">📸</span>;
    // fallback icon
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
              <div className="flex items-center gap-4">
                {/* Filter buttons with counts */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={activeFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setActiveFilter('all')}
                    className="relative"
                  >
                    Todos
                  </Button>
                  <Button
                    variant={activeFilter === 'pix' ? 'default' : 'outline'}
                    onClick={() => setActiveFilter('pix')}
                    className="relative"
                  >
                    Pix
                    {pixCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {pixCount}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant={activeFilter === 'carrinho' ? 'default' : 'outline'}
                    onClick={() => setActiveFilter('carrinho')}
                    className="relative"
                  >
                    Carrinho Ab.
                    {carrinhoCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {carrinhoCount}
                      </span>
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input placeholder="Buscar lead" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <Button onClick={clearSearch} variant="secondary">Limpar</Button>
                </div>
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
                      <TableHead>Data</TableHead>
                      <TableHead>Nome do Cliente</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead className="text-center">Valor</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Responsável</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>
                          {(() => {
                            const tipo = tipoDeLeadsMap[String(lead.tipo_de_lead_id ?? '')];
                            if (tipo && tipo.img_url) {
                              return (
                                <img
                                  src={tipo.img_url}
                                  alt={tipo.nome || 'tipo'}
                                  className="h-6 w-6 rounded object-cover"
                                />
                              );
                            }
                          })()}
                        </TableCell>
                        <TableCell>
                          {lead.created_at ? new Date(lead.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-between">
                            {lead.nome ? (
                              <button
                                className="font-medium text-purple-700 hover:underline cursor-pointer"
                                onClick={() => copyContact(lead.nome)}
                                title="Copiar nome"
                                aria-label={`Copiar nome ${lead.nome}`}
                              >
                                {lead.nome}
                              </button>
                            ) : (
                              <div className="font-medium text-purple-700">—</div>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-muted/50"
                                title="Editar"
                                aria-label={`Editar ${lead.nome || 'lead'}`}
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-muted/50"
                                title="Novo"
                                aria-label={`Adicionar novo para ${lead.nome || 'lead'}`}
                                onClick={() => {
                                  setActiveLead(lead);
                                  // default option will be set after transportadoras are carregadas
                                  setAddOption(null);
                                  setAddValue1('');
                                  setAddValue2('');
                                  setAddDate('');
                                  setAddOpen(true);
                                }}
                              >
                                <SquarePlus className="h-4 w-4 text-emerald-700" />
                              </button>
                            </div>
                          </div>
                        </TableCell>
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
                        <TableCell className="text-center">R$ {Number(lead.valor_total || 0).toFixed(2)}</TableCell>
                        <TableCell>{lead.produto_id ? (productsMap[lead.produto_id]?.nome || '—') : '—'}</TableCell>
                        <TableCell className="text-center">{lead.responsavel ? (usersMap[lead.responsavel]?.nome || '—') : '—'}</TableCell>
                        <TableCell className="text-center">
                          {lead.status_lead_id === 1 ? (
                            <div className="flex items-center justify-center gap-2">
                              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => updateStatus(lead.id, 2)} title="Marcar como contatado">
                                <Check className="h-4 w-4 text-white" />
                              </Button>
                              <Button className="bg-red-600 hover:bg-red-700" onClick={() => updateStatus(lead.id, 3)} title="Marcar como contestado">
                                <X className="h-4 w-4 text-white" />
                              </Button>
                            </div>
                          ) : (
                            lead.status_lead_id === 2 ? (
                              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <Check className="h-4 w-4 text-emerald-600" />
                                <span>Contatado</span>
                              </div>
                            ) : lead.status_lead_id === 3 ? (
                              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <X className="h-4 w-4 text-red-600" />
                                <span>Contestado</span>
                              </div>
                            ) : '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Popup para adicionar — usa Dialog reutilizando o padrão do projeto */}
                <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) setActiveLead(null); }}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Criar pedido: {activeLead?.nome || 'lead'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                      <div>
                        <label className="block text-sm text-muted-foreground">Data</label>
                        <div className="flex items-center gap-3 border rounded-lg px-3 py-2">
                          <Input className="border-none outline-none" type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
                          <button type="button" className="bg-purple-700 text-white px-3 py-1 rounded-md" onClick={() => setAddDate(new Date().toISOString().slice(0,10))}>Hoje</button>
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <div className="flex justify-end gap-3 w-full">
                        <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
                        <Button className="bg-purple-700 text-white" onClick={async () => {
                          if (!activeLead) {
                            toast({ title: 'Erro', description: 'Lead inválido', variant: 'destructive' });
                            return;
                          }
                          try {
                            // determinar plataforma a partir do tipo do lead (tipo_pessoa ou tag_utm)
                            let plataformaId = 'd83fff08-7ac4-4a15-9e6d-0a9247b24fe4'; // fallback
                            try {
                              // If tipo_de_lead_id is set, use explicit mapping requested by product owner
                              if (activeLead.tipo_de_lead_id === 1) {
                                plataformaId = '0e27f292-924c-4ffc-a141-bbe00ec00428';
                              } else if (activeLead.tipo_de_lead_id === 2) {
                                plataformaId = 'c85e1fc7-b03e-48a2-92ec-9123dcb3dd4f';
                              } else {
                                const leadType = ((activeLead.tipo_pessoa || activeLead.tag_utm) || '').toString().toLowerCase();
                                let searchName: string | null = null;
                                if (leadType.includes('pix')) searchName = 'pix';
                                else if (leadType.includes('carrinho') || leadType.includes('cart') || leadType.includes('checkout')) searchName = 'carrinho';

                                if (searchName) {
                                  const { data: plats, error: platsError } = await (supabase as any)
                                    .from('plataformas')
                                    .select('id,nome')
                                    .ilike('nome', `%${searchName}%`)
                                    .limit(1);
                                  if (!platsError && (plats || []).length > 0) {
                                    plataformaId = plats[0].id;
                                  }
                                }
                              }
                            } catch (errPlat: any) {
                              console.error('Erro ao determinar plataforma do lead:', errPlat);
                            }

                            const payload: any = {
                              id_externo: activeLead.nome || activeLead.id,
                              cliente_nome: activeLead.nome || '',
                              contato: activeLead.contato || null,
                              responsavel_id: activeLead.responsavel || null,
                              plataforma_id: plataformaId,
                              status_id: '3ca23a64-cb1e-480c-8efa-0468ebc18097',
                              data_prevista: addDate || null
                            };

                            const { data: pedidoData, error: pedidoError } = await (supabase as any)
                              .from('pedidos')
                              .insert([payload])
                              .select()
                              .single();

                            if (pedidoError) throw pedidoError;

                            const pedidoId = (pedidoData as any)?.id;

                            // tentar criar cliente vinculado ao pedido recém-criado
                            if (pedidoId) {
                              try {
                                const clientePayload = {
                                  nome: payload.cliente_nome || payload.id_externo,
                                  telefone: payload.contato || null,
                                  email: null,
                                  pedido_id: pedidoId
                                };

                                const { error: clienteError } = await (supabase as any)
                                  .from('clientes')
                                  .insert([clientePayload]);

                                if (clienteError) {
                                  // não falhar todo o fluxo apenas por um erro ao criar cliente
                                  console.error('Erro ao criar cliente:', clienteError);
                                  toast({ title: 'Atenção', description: 'Pedido criado, mas não foi possível criar o cliente', variant: 'destructive' });
                                }
                              } catch (errCliente: any) {
                                console.error('Erro ao criar cliente:', errCliente);
                                toast({ title: 'Atenção', description: 'Pedido criado, mas ocorreu um erro ao criar o cliente', variant: 'destructive' });
                              }
                            }

                            // marcar lead como vendido
                            try {
                              if (activeLead?.id) {
                                const { error: markErr } = await (supabase as any)
                                  .from('leads')
                                  .update({ vendido: true })
                                  .eq('id', activeLead.id);
                                if (markErr) {
                                  console.error('Erro ao marcar lead como vendido:', markErr);
                                } else {
                                  // update local state to reflect sold status (will be filtered out)
                                  setLeads(prev => prev.map(l => l.id === activeLead.id ? { ...l, vendido: true } : l));
                                }
                              }
                            } catch (errMark: any) {
                              console.error('Erro ao marcar lead como vendido:', errMark);
                            }

                            toast({ title: 'Pedido criado', description: `Pedido criado para ${activeLead.nome}` });
                            setAddOpen(false);
                            setActiveLead(null);

                            if (pedidoId) navigate(`/pedido/${pedidoId}`);
                          } catch (err: any) {
                            console.error('Erro ao criar pedido:', err);
                            toast({ title: 'Erro', description: 'Não foi possível criar o pedido', variant: 'destructive' });
                          }
                        }}>Salvar</Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
