import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Pedido } from '@/types';
import ComercialSidebar from '@/components/layout/ComercialSidebar';

const ENVIADO_STATUS_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';

export function PedidosEnviados() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const { toast } = useToast();

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

        // Query the vw_clientes_pedidos view which flattens cliente+pedido fields
        const query = supabase
          .from('vw_clientes_pedidos')
          .select(`*, cliente_id, cliente_nome, cliente_criado_em, cliente_atualizado_em, pedido_id, id_externo, pedido_cliente_nome, contato, responsavel_id, plataforma_id, status_id, etiqueta_envio_id, urgente, pedido_criado_em, pedido_atualizado_em, frete_melhor_envio`, { count: 'exact' })
          .eq('status_id', ENVIADO_STATUS_ID)
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

        // Fetch cor_do_pedido separately if needed
        const pedidoIds = (data || []).map((r: any) => r.pedido_id).filter(Boolean);
        let corMap: Record<string, string | undefined> = {};
        if (pedidoIds.length) {
          try {
            const { data: corData, error: corErr } = await supabase.from('pedidos').select('id, cor_do_pedido').in('id', pedidoIds as any[]);
            if (!corErr && corData) {
              corMap = (corData as any[]).reduce((acc: any, p: any) => (acc[p.id] = p.cor_do_pedido || undefined, acc), {} as Record<string, string>);
            }
          } catch (fetchCorErr) {
            console.warn('Não foi possível carregar cor_do_pedido separadamente:', fetchCorErr);
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
          const statusRow = statusMap[row.status_id];
          const etiquetaRow = etiquetaMap[row.etiqueta_envio_id];

          return {
            id: row.pedido_id,
            idExterno: row.id_externo,
            clienteNome: row.cliente_nome || row.pedido_cliente_nome,
            clienteEmail: row.email || undefined,
            clienteCpf: row.cpf || undefined,
            clienteCnpj: row.cnpj || undefined,
            contato: row.contato || '',
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
          };
        });

        setPedidos(mapped);
        setTotal(count || 0);
      } catch (err: any) {
        console.error('Erro ao buscar pedidos enviados', err);
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();

    return () => { mounted = false };
  }, [page, pageSize, searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

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

  const handlePrev = () => setPage(p => Math.max(1, p - 1));
  const handleNext = () => setPage(p => Math.min(totalPages, p + 1));

  const pageSizeOptions = [10, 20, 30, 50];

  return (
    <div className="flex items-start gap-6">
      <ComercialSidebar />

      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pedidos Enviados</h1>
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
                    placeholder="Buscar pedidos enviados..."
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
                  <TableHead>ID do Pedido</TableHead>
                  <TableHead className="text-center">Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-center">Plataforma</TableHead>
                  <TableHead className="text-center">Transportadora</TableHead>
                  <TableHead className="text-center">Responsável</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {error && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-red-600">
                      {error}
                    </TableCell>
                  </TableRow>
                )}

                {filteredPedidos.map((pedido) => (
                  <TableRow key={pedido.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/pedido/${pedido.id}?readonly=1`)}>
                    <TableCell className="font-medium">
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
                    </TableCell>
                    <TableCell className="text-center">
                      {new Date(pedido.criadoEm).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div
                          className="font-medium max-w-[260px] truncate overflow-hidden whitespace-nowrap"
                          title={pedido.clienteNome}
                        >
                          {pedido.clienteNome}
                        </div>
                        <div
                          className="text-sm text-muted-foreground max-w-[260px] truncate overflow-hidden whitespace-nowrap"
                          title={pedido.contato}
                        >
                          {pedido.contato}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {pedido.plataforma?.imagemUrl ? (
                          <img src={pedido.plataforma.imagemUrl} alt={pedido.plataforma.nome} className="w-6 h-6 rounded" />
                        ) : (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: pedido.plataforma?.cor }}
                          />
                        )}
                        {pedido.plataforma?.nome}
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        {pedido.transportadora?.imagemUrl ? (
                          <div className="w-10 h-8 overflow-hidden flex items-center justify-center">
                            <img
                              src={pedido.transportadora.imagemUrl}
                              alt={pedido.transportadora.nome || 'Transportadora'}
                              loading="lazy"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">—</div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2 justify-center">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={pedido.responsavel?.avatar} />
                          <AvatarFallback className="text-xs">
                            {pedido.responsavel?.nome?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{pedido.responsavel?.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Badge
                          variant="outline"
                          style={{
                            backgroundColor: `${pedido.status?.corHex}15`,
                            borderColor: pedido.status?.corHex,
                            color: pedido.status?.corHex
                          }}
                        >
                          {pedido.status?.nome}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/pedido/${pedido.id}?readonly=1`); }}>
                        <Eye className="h-4 w-4 mr-2" />
                        Visualizar
                      </Button>
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
  );
}

export default PedidosEnviados;
