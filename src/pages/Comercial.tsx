import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Filter, Eye, Edit, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { Pedido } from '@/types';
import ComercialSidebar from '@/components/layout/ComercialSidebar';

const etiquetaLabels = {
  NAO_LIBERADO: 'Não Liberado',
  PENDENTE: 'Pendente',
  DISPONIVEL: 'Disponível',
};

const etiquetaColors = {
  NAO_LIBERADO: 'bg-gray-100 text-gray-700',
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  DISPONIVEL: 'bg-green-100 text-green-700',
} as const;

export function Comercial() {
  const navigate = useNavigate();
  const location = useLocation();
  const view = new URLSearchParams(location.search).get('view') || 'pedidos';
  const [searchTerm, setSearchTerm] = useState('');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [totalExcludingEnviados, setTotalExcludingEnviados] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(false);
  // filter: when true, only show pedidos where pedido_liberado = FALSE
  const initialLiberadoParam = new URLSearchParams(location.search).get('pedido_liberado');
  const [filterNotLiberado, setFilterNotLiberado] = useState<boolean>(initialLiberadoParam === 'false');

  useEffect(() => {
    let mounted = true;
    const fetchPedidos = async () => {
      setLoading(true);
      setError(null);
      try {
        // Select pedidos with related plataforma, responsavel (usuarios), status and etiqueta (tipos_etiqueta)
        // use range for pagination and request exact count
        const from = (page - 1) * pageSize;
        const to = page * pageSize - 1;

        // If the ComercialSidebar requested a specific view (ex: enviados), apply extra filters
        const view = new URLSearchParams(location.search).get('view') || 'pedidos';

        const query = supabase
          .from('pedidos')
          .select(
            `*, plataformas(id,nome,cor,img_url), usuarios(id,nome,img_url), status(id,nome,cor_hex,ordem), tipos_etiqueta(id,nome,cor_hex,ordem,criado_em,atualizado_em)`,
            { count: 'exact' }
          )
          .order('criado_em', { ascending: false });

        // when on the "enviados" view, only fetch pedidos with the Enviado status id
        if (view === 'enviados') {
          query.eq('status_id', 'fa6b38ba-1d67-4bc3-821e-ab089d641a25');
        }

        // apply pedido_liberado = FALSE filter when requested
        if (filterNotLiberado) {
          // only include pedidos where pedido_liberado is false or null/false
          query.eq('pedido_liberado', false);
        }

        const { data, error: supaError, count } = await query.range(from, to);

        if (supaError) throw supaError;

        if (!mounted) return;

        const mapped: Pedido[] = (data || []).map((row: any) => {
          const pick = (val: any) => Array.isArray(val) ? val[0] : val;

          const plataformaRow = pick(row.plataformas);
          const usuarioRow = pick(row.usuarios);
          const statusRow = pick(row.status);
          const etiquetaRow = pick(row.tipos_etiqueta);
          // frete_melhor_envio may be saved as JSON on pedidos
          const freteMe = (row as any).frete_melhor_envio || null;

          const normalizeEtiqueta = (nome?: string) => {
            if (!nome) return 'NAO_LIBERADO' as const;
            const key = nome.toUpperCase();
            if (key.includes('PEND')) return 'PENDENTE' as const;
            if (key.includes('DISP')) return 'DISPONIVEL' as const;
            return 'NAO_LIBERADO' as const;
          }

          return {
            id: row.id,
            idExterno: row.id_externo,
            clienteNome: row.cliente_nome,
            contato: row.contato || '',
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
              // prefer nested raw_response.company.picture per sample payload; fallback to company fields
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
            criadoEm: row.criado_em,
            atualizadoEm: row.atualizado_em,
          };
        });

        setPedidos(mapped);
        setTotal(count || 0);
      } catch (err: any) {
        console.error('Erro ao buscar pedidos', err);
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();

    return () => { mounted = false };
  }, [page, pageSize, view, filterNotLiberado]);

  // fetch total count excluding 'Enviado' status
  useEffect(() => {
    let mounted = true;
    const ENVIADO_ID = 'fa6b38ba-1d67-4bc3-821e-ab089d641a25';
    const loadTotal = async () => {
      try {
        const { count, error } = await supabase.from('pedidos').select('id', { count: 'exact' }).neq('status_id', ENVIADO_ID).limit(1);
        if (error) throw error;
        if (!mounted) return;
        setTotalExcludingEnviados(count || 0);
      } catch (err) {
        console.error('Erro ao buscar total excluindo enviados:', err);
      }
    };
    loadTotal();
    return () => { mounted = false };
  }, [/* run on mount and when relevant filters change in future */]);

  const filteredPedidos = pedidos.filter(pedido =>
    pedido.idExterno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pedido.clienteNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pedido.plataforma?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pedido.responsavel?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <h1 className="text-2xl font-bold">{view === 'enviados' ? 'Pedidos Enviados' : 'Pedidos'}</h1>
              <p className="text-muted-foreground">
                {view === 'enviados'
                  ? `${filteredPedidos.length} pedidos encontrados`
                  : filterNotLiberado
                    ? `${total} pedidos encontrados`
                    : `${totalExcludingEnviados} pedidos encontrados`}
              </p>
            </div>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => navigate('/novo-pedido')}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pedido
            </Button>
          </div>

      {/* Filtros e busca */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar pedidos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
              <div className="flex items-center gap-2 relative">
                <div>
                  <Button variant="outline" size="sm" onClick={() => setShowFilters(s => !s)}>
                    <Filter className="h-4 w-4 mr-2" />
                    Filtrar
                  </Button>
                  {showFilters && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border rounded shadow z-20 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium">Filtros</div>
                        <button className="text-sm text-muted-foreground" onClick={() => setShowFilters(false)}>Fechar</button>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <input id="filter-not-liberado" type="checkbox" checked={filterNotLiberado} onChange={(e) => setFilterNotLiberado(e.target.checked)} />
                        <label htmlFor="filter-not-liberado" className="text-sm">Somente pedidos não liberados</label>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          // clear filter
                          setFilterNotLiberado(false);
                          const next = new URLSearchParams(location.search);
                          next.delete('pedido_liberado');
                          navigate({ pathname: location.pathname, search: next.toString() });
                          setShowFilters(false);
                        }}>Limpar</Button>
                        <Button size="sm" onClick={() => {
                          // apply filter via query param so it's shareable
                          const next = new URLSearchParams(location.search);
                          if (filterNotLiberado) next.set('pedido_liberado', 'false'); else next.delete('pedido_liberado');
                          navigate({ pathname: location.pathname, search: next.toString() });
                          setShowFilters(false);
                        }}>Aplicar</Button>
                      </div>
                    </div>
                  )}
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
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Transportadora</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Etiqueta</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Carregando pedidos...
                  </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-red-600">
                    {error}
                  </TableCell>
                </TableRow>
              )}

              {filteredPedidos.map((pedido) => (
                <TableRow key={pedido.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/pedido/${pedido.id}${view === 'enviados' ? '?readonly=1' : ''}`)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {pedido.urgente && (
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                      )}
                      <div
                        className="max-w-[220px] truncate overflow-hidden whitespace-nowrap"
                        title={pedido.idExterno}
                      >
                        {pedido.idExterno}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
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
                  <TableCell>
                      <div className="flex items-center gap-2">
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

                  <TableCell>
                    <div className="flex items-center">
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
                    <div className="flex items-center gap-2">
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
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={etiquetaColors[pedido.etiquetaEnvio]}
                    >
                      {etiquetaLabels[pedido.etiquetaEnvio]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                            •••
                          </Button>
                        </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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