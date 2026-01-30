import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Copy, X } from 'lucide-react';
import { TbTruckReturn } from 'react-icons/tb';
import { FaUserAltSlash } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Pedido } from '@/types';
import ComercialSidebar from '@/components/layout/ComercialSidebar';
import { useAuth } from '@/hooks/useAuth';
import { DynamicLottie } from '@/components/ui/DynamicLottie';
import emptyLoadingState from '@/assets/empty loading state.json';

const ENVIADO_STATUS_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';

export function PedidosRetornados() {
  const navigate = useNavigate();
  const location = useLocation();
  const { empresaId } = useAuth();
  
  // Read current values from URL
  const params = new URLSearchParams(location.search);
  const urlPage = parseInt(params.get('page') || '1', 10);
  const urlPageSize = parseInt(params.get('pageSize') || '10', 10);
  const urlSearch = params.get('search') || '';
  
  // State using URL as source of truth
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(urlPage);
  const [pageSize, setPageSize] = useState(urlPageSize);
  const [total, setTotal] = useState<number>(0);
  const { toast } = useToast();
  
  // Sync state from URL when location changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const newPage = parseInt(params.get('page') || '1', 10);
    const newPageSize = parseInt(params.get('pageSize') || '10', 10);
    const newSearch = params.get('search') || '';
    
    setPage(newPage);
    setPageSize(newPageSize);
    setSearchTerm(newSearch);
  }, [location.search]);

  useEffect(() => {
    let mounted = true;
    const fetchPedidos = async () => {
      setLoading(true);
      setError(null);
      try {
        const searchTrim = (searchTerm || '').trim();
        const actualPage = searchTrim.length > 0 ? 1 : page;
        const from = (actualPage - 1) * pageSize;
        const to = actualPage * pageSize - 1;

        // Query pedidos retornados usando a view pedidos_retornados_completos
        const query = (supabase as any)
          .from('pedidos_retornados_completos')
          .select(`*`, { count: 'exact' })
          .order('pedido_criado_em', { ascending: false });

        // apply search term server-side
        if (searchTrim.length > 0) {
          const pattern = `%${searchTrim}%`;
          try {
            (query as any).or(`id_externo.ilike.${pattern},cliente_nome.ilike.${pattern},contato.ilike.${pattern},email.ilike.${pattern},cpf.ilike.${pattern},cnpj.ilike.${pattern}`);
          } catch (e) {
            (query as any).ilike('cliente_nome', pattern);
          }
        }

        // fetch small lookup tables in parallel
        const [resLookup, resData] = await Promise.all([
          Promise.all([
            supabase.from('plataformas').select('*'),
            supabase.from('usuarios').select('id,nome,img_url'),
            supabase.from('status').select('*'),
            supabase.from('tipos_etiqueta').select('*')
          ]),
          query.range(from, to)
        ]);

        const [[platResp, userResp, statusResp, etiquetaResp], { data, error: supaError, count }] = resLookup.concat([]).length ? [resLookup, resData] : [resLookup, resData];

        if (supaError) throw supaError;
        if (!mounted) return;

        const plataformasMap = (platResp?.data || platResp) ? (platResp.data || platResp).reduce((acc: any, p: any) => (acc[p.id] = p, acc), {}) : {};
        const usuariosMap = (userResp?.data || userResp) ? (userResp.data || userResp).reduce((acc: any, u: any) => (acc[u.id] = u, acc), {}) : {};
        const statusMap = (statusResp?.data || statusResp) ? (statusResp.data || statusResp).reduce((acc: any, s: any) => (acc[s.id] = s, acc), {}) : {};
        const etiquetaMap = (etiquetaResp?.data || etiquetaResp) ? (etiquetaResp.data || etiquetaResp).reduce((acc: any, t: any) => (acc[t.id] = t, acc), {}) : {};

        // Fetch cor_do_pedido e data_enviado separately (data_retornado e data_reenvio já vêm da view)
        const pedidoIds = (data || []).map((r: any) => r.pedido_id).filter(Boolean);
        let corMap: Record<string, string | undefined> = {};
        let dataEnviadoMap: Record<string, string | undefined> = {};
        
        if (pedidoIds.length) {
          try {
            const { data: pedidosData, error: pedidosErr } = await supabase.from('pedidos').select('id, cor_do_pedido, data_enviado').in('id', pedidoIds as any[]);
            if (!pedidosErr && pedidosData) {
              corMap = (pedidosData as any[]).reduce((acc: any, p: any) => (acc[p.id] = p.cor_do_pedido || undefined, acc), {} as Record<string, string>);
              dataEnviadoMap = (pedidosData as any[]).reduce((acc: any, p: any) => (acc[p.id] = p.data_enviado || undefined, acc), {} as Record<string, string>);
            }
          } catch (fetchErr) {
            console.warn('Não foi possível carregar dados adicionais dos pedidos:', fetchErr);
          }
        }

        const normalizeEtiqueta = (nome?: string) => {
          if (!nome) return 'NAO_LIBERADO' as const;
          const key = nome.toUpperCase();
          if (key.includes('PEND')) return 'PENDENTE' as const;
          if (key.includes('DISP')) return 'DISPONIVEL' as const;
          return 'NAO_LIBERADO' as const;
        };

        const mapped: Pedido[] = (data || []).map((row: any) => {
          const freteMe = row.frete_melhor_envio || null;
          const plataformaRow = plataformasMap[row.plataforma_id];
          const usuarioRow = usuariosMap[row.responsavel_id];
          const respEnvioRow = row.resp_envio ? usuariosMap[row.resp_envio] : null;
          const statusRow = statusMap[row.status_id];
          const etiquetaRow = etiquetaMap[row.etiqueta_envio_id];

          return {
            id: row.pedido_id,
            idExterno: row.id_externo,
            clienteNome: row.cliente_nome,
            clienteEmail: row.email || undefined,
            clienteCpf: row.cpf || undefined,
            clienteCnpj: row.cnpj || undefined,
            contato: row.contato || row.telefone || '',
            formularioEnviado: !!row.formulario_enviado,
            etiquetaEnvioId: row.etiqueta_envio_id || '',
            responsavelId: row.responsavel_id,
            plataformaId: row.plataforma_id,
            statusId: row.status_id,
            etiquetaEnvio: normalizeEtiqueta(etiquetaRow?.nome) || (row.etiqueta_envio_id ? 'PENDENTE' : 'NAO_LIBERADO'),
            urgente: !!row.urgente,
            dataPrevista: row.data_prevista || undefined,
            observacoes: row.observacoes || '',
            itens: [],
            responsavel: usuarioRow
              ? {
                  id: usuarioRow.id,
                  nome: usuarioRow.nome,
                  email: '',
                  papel: 'operador',
                  avatar: usuarioRow.img_url || undefined,
                  ativo: true,
                  criadoEm: '',
                  atualizadoEm: '',
                }
              : undefined,
            responsavelEnvio: respEnvioRow
              ? {
                  id: respEnvioRow.id,
                  nome: respEnvioRow.nome,
                  email: '',
                  papel: 'operador',
                  avatar: respEnvioRow.img_url || undefined,
                  ativo: true,
                  criadoEm: '',
                  atualizadoEm: '',
                }
              : undefined,
            plataforma: plataformaRow
              ? {
                  id: plataformaRow.id,
                  nome: plataformaRow.nome,
                  cor: plataformaRow.cor,
                  imagemUrl: plataformaRow.img_url || undefined,
                  criadoEm: '',
                  atualizadoEm: '',
                }
              : undefined,
            transportadora: freteMe ? (() => {
              const raw = (freteMe.raw_response || freteMe.raw || freteMe);
              const company = raw?.company || freteMe.company || null;
              const nome = freteMe.transportadora || company?.name || raw?.company?.name || undefined;
              const imagem = company?.picture || company?.logo || company?.icon || undefined;
              return { id: undefined, nome, imagemUrl: imagem, raw };
            })() : undefined,
            status: statusRow
              ? {
                  id: statusRow.id,
                  nome: statusRow.nome,
                  corHex: statusRow.cor_hex,
                  ordem: statusRow.ordem ?? 0,
                  criadoEm: '',
                  atualizadoEm: '',
                }
              : undefined,
            etiqueta: etiquetaRow
              ? {
                  id: etiquetaRow.id,
                  nome: etiquetaRow.nome,
                  corHex: etiquetaRow.cor_hex,
                  ordem: etiquetaRow.ordem ?? 0,
                  criadoEm: etiquetaRow.criado_em || '',
                  atualizadoEm: etiquetaRow.atualizado_em || '',
                }
              : undefined,
            corDoPedido: (row.cor_do_pedido !== undefined ? row.cor_do_pedido : corMap[row.pedido_id]) || undefined,
            foiDuplicado: !!row.foi_duplicado,
            criadoEm: row.pedido_criado_em,
            atualizadoEm: row.pedido_atualizado_em,
            dataEnviado: dataEnviadoMap[row.pedido_id] || undefined,
            dataRetornado: row.data_retornado || undefined,
            dataReenvio: row.data_reenvio || undefined,
          };
        });

        setPedidos(mapped);
        setTotal(count || 0);
      } catch (err: any) {
        console.error('Erro ao buscar pedidos retornados', err);
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();

    return () => { mounted = false };
  }, [page, pageSize, searchTerm, empresaId]);

  const normalize = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  const digitsOnly = (s?: string) => (s || '').replace(/\D/g, '').trim();

  const normalizedSearch = normalize(searchTerm);
  const normalizedDigits = digitsOnly(searchTerm);

  const filteredPedidos = pedidos.filter(pedido => {
    const idExterno = normalize(pedido.idExterno);
    const cliente = normalize(pedido.clienteNome);
    const contatoText = normalize(pedido.contato);
    const contatoDigits = digitsOnly(pedido.contato);
    const clienteEmail = normalize((pedido as any).clienteEmail);
    const clienteCpfDigits = digitsOnly((pedido as any).clienteCpf || '');
    const clienteCnpjDigits = digitsOnly((pedido as any).clienteCnpj || '');

    if (idExterno.includes(normalizedSearch) || cliente.includes(normalizedSearch) || contatoText.includes(normalizedSearch) || clienteEmail.includes(normalizedSearch)) return true;

    if (normalizedDigits.length > 0 && (contatoDigits.includes(normalizedDigits) || clienteCpfDigits.includes(normalizedDigits) || clienteCnpjDigits.includes(normalizedDigits))) return true;

    return false;
  });

  const totalPages = Math.max(1, Math.ceil((total || filteredPedidos.length) / pageSize));

  const updatePageInUrl = (newPage: number) => {
    const params = new URLSearchParams(location.search);
    params.set('page', String(newPage));
    params.set('pageSize', String(pageSize));
    if (searchTerm) params.set('search', searchTerm);
    navigate({ pathname: location.pathname, search: params.toString() });
  };

  const handlePrev = () => {
    const newPage = Math.max(1, page - 1);
    updatePageInUrl(newPage);
  };
  
  const handleNext = () => {
    const newPage = Math.min(totalPages, page + 1);
    updatePageInUrl(newPage);
  };

  const pageSizeOptions = [10, 20, 30, 50];

  return (
    <div className="flex h-full">
      <div className="flex-shrink-0">
        <ComercialSidebar />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pedidos Retornados</h1>
            <p className="text-muted-foreground">
              {filteredPedidos.length} pedidos encontrados
            </p>
          </div>
        </div>

        {/* Busca */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar pedidos retornados..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tabela de pedidos */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Informações</TableHead>
                  <TableHead className="text-center">Data Retornado</TableHead>
                  <TableHead className="text-center">Data Reenvio</TableHead>
                  <TableHead className="text-center">Resp. Pedido</TableHead>
                  <TableHead className="text-center">Resp. Reenvio</TableHead>
                  <TableHead className="text-center w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {error && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-red-600">
                      {error}
                    </TableCell>
                  </TableRow>
                )}

                {!loading && filteredPedidos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      <div className="flex flex-col items-center justify-center py-16 px-4">
                        <p className="text-xl text-muted-foreground mb-6">Sem pedidos retornados no momento</p>
                        <DynamicLottie 
                          animationData={emptyLoadingState}
                          className="w-64 h-64"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {filteredPedidos.map((pedido) => (
                  <TableRow key={pedido.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => {
                    const currentParams = new URLSearchParams();
                    currentParams.set('readonly', '1');
                    currentParams.set('returnTo', location.pathname + location.search);
                    navigate(`/pedido/${pedido.id}?${currentParams.toString()}`);
                  }}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {pedido.urgente && (
                            <div className="w-2 h-2 bg-red-500 rounded-full" />
                          )}
                          <div
                            className="max-w-[220px] truncate overflow-hidden whitespace-nowrap cursor-pointer"
                            title="Clique para copiar"
                            onClick={(e) => {
                              e.stopPropagation();
                              const text = String(pedido.idExterno || '');
                              try {
                                if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                                  navigator.clipboard.writeText(text).then(() => {
                                    toast({ title: 'Copiado', description: 'ID do pedido copiado para a área de transferência.' });
                                  }).catch((err) => {
                                    console.error('Erro ao copiar:', err);
                                    toast({ title: 'Erro', description: 'Não foi possível copiar o ID.', variant: 'destructive' });
                                  });
                                } else {
                                  const ta = document.createElement('textarea');
                                  ta.value = text;
                                  document.body.appendChild(ta);
                                  ta.select();
                                  try {
                                    document.execCommand('copy');
                                    toast({ title: 'Copiado', description: 'ID do pedido copiado para a área de transferência.' });
                                  } catch (ex) {
                                    console.error('Fallback copy failed', ex);
                                    toast({ title: 'Erro', description: 'Não foi possível copiar o ID.', variant: 'destructive' });
                                  }
                                  document.body.removeChild(ta);
                                }
                              } catch (err) {
                                console.error('Copy exception', err);
                                toast({ title: 'Erro', description: 'Não foi possível copiar o ID.', variant: 'destructive' });
                              }
                            }}
                            style={{ color: pedido.corDoPedido || '#8B5E3C' }}
                          >
                            {pedido.idExterno}
                          </div>
                        </div>
                        <div>
                          <div
                            className="text-xs max-w-[260px] truncate overflow-hidden whitespace-nowrap"
                            title={`${pedido.clienteNome} - ${pedido.contato}`}
                          >
                            <span className="text-gray-700">{pedido.clienteNome}</span>
                            <span className="text-gray-400"> - {pedido.contato}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {(pedido as any).dataRetornado ? new Date((pedido as any).dataRetornado).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {(pedido as any).dataReenvio ? new Date((pedido as any).dataReenvio).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Avatar className="h-12 w-12 border-4 border-custom-600 rounded-full">
                          <AvatarImage src={pedido.responsavel?.avatar} />
                          <AvatarFallback className="text-sm">
                            {pedido.responsavel?.nome?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {pedido.responsavelEnvio ? (
                          <Avatar className="h-12 w-12 border-4 border-custom-600 rounded-full">
                            <AvatarImage src={pedido.responsavelEnvio.avatar} />
                            <AvatarFallback className="text-sm">
                              {pedido.responsavelEnvio.nome?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-12 w-12 border-4 border-custom-600 rounded-full bg-muted flex items-center justify-center">
                            <FaUserAltSlash className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Implementar função de cancelar reenvio
                        }} title="Cancelar reenvio">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>

          <div className="flex items-center justify-between p-4 border-t">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Mostrando <strong>{(page - 1) * pageSize + 1}</strong> - <strong>{Math.min(page * pageSize, total || filteredPedidos.length)}</strong> de <strong>{total || filteredPedidos.length}</strong>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Mostrar</label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    const params = new URLSearchParams(location.search);
                    params.set('page', '1');
                    params.set('pageSize', String(newSize));
                    if (searchTerm) params.set('search', searchTerm);
                    navigate({ pathname: location.pathname, search: params.toString() });
                  }}
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

export default PedidosRetornados;
