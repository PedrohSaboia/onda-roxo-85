import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { /* header provided by AppLayout */ } from '@/components/layout/AppHeader';
import ComercialSidebar from '@/components/layout/ComercialSidebar';
import { Check, X, Pencil, SquarePlus, AlertCircle, Users, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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
  const { empresaId, permissoes, hasPermissao, isLoading } = useAuth();

  const canAccessLeads = hasPermissao ? hasPermissao(27) : ((permissoes || []).includes(27));

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
  const [addFrete, setAddFrete] = useState<string>('');
  const [transportadoras, setTransportadoras] = useState<Array<{ id: string; nome: string }>>([]);
  const [loadingTransportadoras, setLoadingTransportadoras] = useState(false);
  const [formasPagamentos, setFormasPagamentos] = useState<Array<{ id: string; nome: string }>>([]);
  const [loadingFormasPagamentos, setLoadingFormasPagamentos] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [paymentValues, setPaymentValues] = useState<Record<string, string>>({});
  const [showCartaoDropdown, setShowCartaoDropdown] = useState(false);
  const cartaoDropdownRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pix' | 'carrinho' | 'typebot'>('all');
  const [pixCount, setPixCount] = useState<number>(0);
  const [carrinhoCount, setCarrinhoCount] = useState<number>(0);
  const [typebotCount, setTypebotCount] = useState<number>(0);

  // formata input para moeda BR (ex: 1.234,56) enquanto o usuário digita
  const formatCurrencyInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    const padded = digits.padStart(3, '0');
    const intPart = padded.slice(0, padded.length - 2);
    const decPart = padded.slice(-2);
    const intWithThousand = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const intClean = intWithThousand.replace(/^0+(?!$)/, '');
    return `${intClean},${decPart}`;
  };

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
    
    const loadFormas = async () => {
      if (!addOpen) return;
      setLoadingFormasPagamentos(true);
      try {
        const { data, error } = await (supabase as any).from('formas_pagamentos').select('id,nome').order('nome');
        if (error) throw error;
        if (!mounted) return;
        setFormasPagamentos((data || []) as any[]);
      } catch (err) {
        console.error('Erro ao carregar formas de pagamento:', err);
        setFormasPagamentos([]);
      } finally {
        if (mounted) setLoadingFormasPagamentos(false);
      }
    };
    load();
    loadFormas();
    return () => { mounted = false };
  }, [addOpen, addOption]);

  // fechar dropdown de cartão quando clicar fora
  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (cartaoDropdownRef.current && !cartaoDropdownRef.current.contains(ev.target as Node)) {
        setShowCartaoDropdown(false);
      }
    };
    if (showCartaoDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCartaoDropdown]);
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
        } else if (activeFilter === 'typebot') {
          query = query.eq('tipo_de_lead_id', 3).eq('status_lead_id', 1);
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

        // Count Typebot leads (tipo_de_lead_id = 3, status_lead_id = 1, vendido = false or null)
        const { count: typebotTotal, error: typebotError } = await (supabase as any)
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('tipo_de_lead_id', 3)
          .eq('status_lead_id', 1)
          .or('vendido.is.null,vendido.eq.false');
        
        if (typebotError) throw typebotError;

        if (!mounted) return;
        setPixCount(pixTotal || 0);
        setCarrinhoCount(carrinhoTotal || 0);
        setTypebotCount(typebotTotal || 0);
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
      const [pixResp, carrinhoResp, typebotResp] = await Promise.all([
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
          .or('vendido.is.null,vendido.eq.false'),
        (supabase as any)
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('tipo_de_lead_id', 3)
          .eq('status_lead_id', 1)
          .or('vendido.is.null,vendido.eq.false')
      ]);
      
      setPixCount(pixResp.count || 0);
      setCarrinhoCount(carrinhoResp.count || 0);
      setTypebotCount(typebotResp.count || 0);
      
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

    if (!isLoading && !canAccessLeads) {
    return (
      <div className="min-h-screen bg-background">
        <main className="min-h-[calc(100vh-8rem)]">
          <div className="flex items-start gap-6">
            <ComercialSidebar />

            <div className="flex-1 p-6">
              <Card className="w-[500px] justify-center mx-auto">
                <CardContent className="p-8 text-center">
                  <AlertCircle className="mx-auto mb-4 text-red-600" />
                  <h3 className="text-lg font-semibold">Você não tem permissão para ver os leads</h3>
                  <p className="text-sm text-muted-foreground mt-2">Se você acha que deveria ter acesso, contate o administrador.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-shrink-0">
        <ComercialSidebar />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div>
            <Card>
              <CardHeader className="space-y-4">
                <CardTitle>Lista de Leads</CardTitle>
                
                {/* Filter buttons and search in same row */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground mr-2">Filtrar por:</span>
                    <Button
                      variant={activeFilter === 'all' ? 'default' : 'outline'}
                      onClick={() => setActiveFilter('all')}
                      size="sm"
                      className="relative"
                    >
                      Todos
                    </Button>
                    <Button
                      variant={activeFilter === 'pix' ? 'default' : 'outline'}
                      onClick={() => setActiveFilter('pix')}
                      size="sm"
                      className="relative"
                    >
                      Pix
                      {pixCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                          {pixCount}
                        </span>
                      )}
                    </Button>
                    <Button
                      variant={activeFilter === 'carrinho' ? 'default' : 'outline'}
                      onClick={() => setActiveFilter('carrinho')}
                      size="sm"
                      className="relative"
                    >
                      Carrinho Ab.
                      {carrinhoCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                          {carrinhoCount}
                        </span>
                      )}
                    </Button>
                    <Button
                      variant={activeFilter === 'typebot' ? 'default' : 'outline'}
                      onClick={() => setActiveFilter('typebot')}
                      size="sm"
                      className="relative"
                    >
                      Typebot
                      {typebotCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                          {typebotCount}
                        </span>
                      )}
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar lead..." 
                        value={search} 
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-80 pl-9"
                      />
                    </div>
                    {search && (
                      <Button onClick={clearSearch} variant="ghost" size="sm">Limpar</Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className=" w-[56px]">Tipo</TableHead>
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
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-64 text-center">
                          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                            <Users className="h-16 w-16 opacity-20" />
                            <div>
                              <p className="text-lg font-medium">Nenhum lead encontrado</p>
                              <p className="text-sm">
                                {search ? 'Tente ajustar sua busca' : activeFilter === 'pix' ? 'Não há leads Pix pendentes' : activeFilter === 'carrinho' ? 'Não há leads de Carrinho Abandonado pendentes' : activeFilter === 'typebot' ? 'Não há leads Typebot pendentes' : 'Não há leads cadastrados'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((lead) => (
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
                                className="font-medium text-custom-700 hover:underline cursor-pointer"
                                onClick={() => copyContact(lead.nome)}
                                title="Copiar nome"
                                aria-label={`Copiar nome ${lead.nome}`}
                              >
                                {lead.nome}
                              </button>
                            ) : (
                              <div className="font-medium text-custom-700">—</div>
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
                                  setAddFrete('');
                                  setSelectedPaymentIds([]);
                                  setPaymentValues({});
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
                      ))
                    )}
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
                        <label className="block text-sm text-muted-foreground mb-1 ml-1">Data</label>
                        <div className="flex items-center gap-3 border rounded-lg pl-1 pr-2 py-1">
                          <Input className="border-none outline-none" type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
                          <button type="button" className="bg-custom-700 text-white px-3 py-1 rounded-md" onClick={() => setAddDate(new Date().toISOString().slice(0,10))}>Hoje</button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1 ml-1">Frete (R$)</label>
                        <div className="flex items-center gap-3 border rounded-lg p-1">
                          <Input className="border-none outline-none" type="text" inputMode="decimal" placeholder="0,00" value={addFrete} onChange={(e) => setAddFrete(formatCurrencyInput(e.target.value))} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1 ml-1">Formas de Pagamento</label>
                        <div className="mt-2">
                          {loadingFormasPagamentos ? (
                            <div className="text-sm text-muted-foreground">Carregando...</div>
                          ) : formasPagamentos.length === 0 ? (
                            <div className="text-sm text-muted-foreground">Nenhuma forma de pagamento cadastrada</div>
                          ) : (
                            <>
                              <div className="flex gap-2 mt-1 flex-wrap">
                                {formasPagamentos.filter(f => !f.nome?.toLowerCase().includes('cartão') && !f.nome?.toLowerCase().includes('cartao')).map((forma) => {
                                  const isSelected = selectedPaymentIds.includes(forma.id);
                                  return (
                                    <div key={forma.id} className="relative group">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const currently = selectedPaymentIds.includes(forma.id);
                                          setSelectedPaymentIds(prev => currently ? prev.filter(id => id !== forma.id) : [...prev, forma.id]);
                                          if (currently) {
                                            setPaymentValues(prev => { const updated = { ...prev }; delete updated[forma.id]; return updated; });
                                          } else {
                                            setPaymentValues(prev => ({ ...prev, [forma.id]: '0,00' }));
                                          }
                                        }}
                                        className={`relative p-2 rounded-lg transition-all ${isSelected ? 'border-2 border-custom-700 bg-custom-50 shadow-md' : 'border-2 border-gray-200 hover:border-gray-400 hover:shadow-sm'}`}
                                        title={forma.nome}
                                      >
                                        {forma.img_url && (
                                          <img src={forma.img_url} alt={forma.nome} className="w-6 h-6 object-contain" />
                                        )}
                                        {!forma.img_url && (
                                          <span className="text-sm px-2">{forma.nome}</span>
                                        )}
                                        {isSelected && (
                                          <div className="absolute top-0 right-0 transform translate-x-1 -translate-y-1 bg-custom-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">✓</div>
                                        )}
                                      </button>
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{forma.nome}</div>
                                    </div>
                                  );
                                })}

                                {/* Cartão agrupado em dropdown */}
                                {formasPagamentos.find(f => f.nome?.toLowerCase().includes('cartão') || f.nome?.toLowerCase().includes('cartao')) && (
                                  <div ref={cartaoDropdownRef} className="relative group">
                                    <button
                                      type="button"
                                      onClick={() => setShowCartaoDropdown(!showCartaoDropdown)}
                                      className={`relative p-2 rounded-lg transition-all ${selectedPaymentIds.some(id => {
                                        const p = formasPagamentos.find(f => f.id === id);
                                        return p && (p.nome?.toLowerCase().includes('cartão') || p.nome?.toLowerCase().includes('cartao'));
                                      }) ? 'border-2 border-custom-700 bg-custom-50 shadow-md' : 'border-2 border-gray-200 hover:border-gray-400 hover:shadow-sm'}`}
                                      title="Cartão"
                                    >
                                      {(() => {
                                        const cartaoGenerico = formasPagamentos.find(f => f.nome?.toLowerCase().includes('cartão') || f.nome?.toLowerCase().includes('cartao'));
                                        return cartaoGenerico?.img_url ? (
                                          <img src={cartaoGenerico.img_url} alt="Cartão" className="w-6 h-6 object-contain" />
                                        ) : (
                                          <span className="text-sm">Cartão</span>
                                        );
                                      })()}
                                      {selectedPaymentIds.some(id => {
                                        const p = formasPagamentos.find(f => f.id === id);
                                        return p && (p.nome?.toLowerCase().includes('cartão') || p.nome?.toLowerCase().includes('cartao'));
                                      }) && (
                                        <div className="absolute top-0 right-0 transform translate-x-1 -translate-y-1 bg-custom-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">✓</div>
                                      )}
                                    </button>

                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Cartão</div>

                                    {showCartaoDropdown && (
                                      <div className="absolute top-full left-0 mt-2 bg-white border-2 rounded-lg shadow-lg z-10 min-w-max">
                                        <div className="p-2 max-h-80 overflow-y-auto">
                                          {formasPagamentos.filter(f => f.nome?.toLowerCase().includes('cartão') || f.nome?.toLowerCase().includes('cartao')).map((forma) => {
                                            const isSelected = selectedPaymentIds.includes(forma.id);
                                            return (
                                              <button
                                                key={forma.id}
                                                type="button"
                                                onClick={() => {
                                                  if (isSelected) {
                                                    setSelectedPaymentIds(prev => prev.filter(id => id !== forma.id));
                                                    setPaymentValues(prev => { const up = { ...prev }; delete up[forma.id]; return up; });
                                                  } else {
                                                    // keep non-card payments
                                                    const nonCard = selectedPaymentIds.filter(id => {
                                                      const p = formasPagamentos.find(f => f.id === id);
                                                      return !(p?.nome?.toLowerCase().includes('cartão') || p?.nome?.toLowerCase().includes('cartao'));
                                                    });
                                                    // remove previous card values
                                                    setPaymentValues(prev => {
                                                      const updated = { ...prev };
                                                      selectedPaymentIds.forEach(id => {
                                                        const p = formasPagamentos.find(f => f.id === id);
                                                        if (p?.nome?.toLowerCase().includes('cartão') || p?.nome?.toLowerCase().includes('cartao')) delete updated[id];
                                                      });
                                                      return updated;
                                                    });
                                                    setSelectedPaymentIds([...nonCard, forma.id]);
                                                    setPaymentValues(prev => ({ ...prev, [forma.id]: '0,00' }));
                                                  }
                                                }}
                                                className={`w-full text-left rounded-lg flex items-center gap-3 transition-colors px-3 py-2 ${isSelected ? 'bg-custom-100 border-2 border-custom-500' : 'border-2 border-transparent hover:bg-gray-50'}`}
                                              >
                                                {forma.img_url && <img src={forma.img_url} alt={forma.nome} className="w-8 h-8 object-contain" />}
                                                <span className="font-medium text-sm">{forma.nome}</span>
                                                {isSelected && <span className="ml-auto text-custom-600">✓</span>}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Inputs para valores de cada forma de pagamento selecionada */}
                              {selectedPaymentIds.length > 0 && (
                                <div className={`flex gap-4 mt-3 ${selectedPaymentIds.length === 1 ? 'flex-[3]' : 'flex-[4]'} transition-all duration-300`}>
                                  {selectedPaymentIds.map(paymentId => {
                                    const payment = formasPagamentos.find(f => f.id === paymentId);
                                    if (!payment) return null;
                                    return (
                                      <div key={paymentId} className="flex-1">
                                        <label className="text-sm font-medium">{payment.nome}</label>
                                        <Input
                                          className="w-full text-base h-11"
                                          value={paymentValues[paymentId] ?? '0,00'}
                                          onChange={(e) => setPaymentValues((p) => ({ ...p, [paymentId]: formatCurrencyInput(e.target.value) }))}
                                          placeholder="0,00"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <div className="flex justify-end gap-3 w-full">
                        <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
                        <Button className="bg-custom-700 text-white" onClick={async () => {
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
                              frete_venda: addFrete ? parseFloat(String(addFrete).replace(/\./g, '').replace(',', '.')) : null,
                              data_prevista: addDate || null,
                              empresa_id: empresaId || null
                            };

                            const { data: pedidoData, error: pedidoError } = await (supabase as any)
                              .from('pedidos')
                              .insert([payload])
                              .select()
                              .single();

                            if (pedidoError) throw pedidoError;

                            const pedidoId = (pedidoData as any)?.id;

                            // registrar formas de pagamento em lista_pagamentos (se houver)
                            if (pedidoId && selectedPaymentIds.length > 0) {
                              try {
                                const pagamentoRecords = selectedPaymentIds.map((id) => ({
                                  pedido_id: pedidoId,
                                  formas_pagamentos_id: id,
                                  valor: parseFloat(String(paymentValues[id] || '0,00').replace(/\./g, '').replace(',', '.'))
                                }));
                                const { error: pagamentoError } = await (supabase as any).from('lista_pagamentos').insert(pagamentoRecords);
                                if (pagamentoError) {
                                  console.error('Erro ao inserir formas de pagamento:', pagamentoError);
                                  toast({ title: 'Aviso', description: 'Pedido criado, mas falha ao registrar as formas de pagamento.', variant: 'destructive' });
                                }
                              } catch (errPag) {
                                console.error('Exceção ao inserir formas de pagamento:', errPag);
                                toast({ title: 'Aviso', description: 'Pedido criado, mas ocorreu um erro ao registrar as formas de pagamento.', variant: 'destructive' });
                              }
                            }

                            // tentar criar cliente vinculado ao pedido recém-criado
                            if (pedidoId) {
                              try {
                                const clientePayload = {
                                  nome: payload.cliente_nome || payload.id_externo,
                                  telefone: payload.contato || null,
                                  email: null,
                                  pedido_id: pedidoId,
                                  empresa_id: empresaId || null
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
    </div>
  );
}
