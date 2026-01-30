import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Eye, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Pedido } from '@/types';
import ComercialSidebar from '@/components/layout/ComercialSidebar';
import { useAuth } from '@/hooks/useAuth';

const CANCELADO_STATUS_ID = '09ddb68a-cff3-4a69-a120-7459642cca6f';
const COMERCIAL_STATUS_ID = '3ca23a64-cb1e-480c-8efa-0468ebc18097';

export function PedidosCancelados() {
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
  const [confirmDuplicateOpen, setConfirmDuplicateOpen] = useState(false);
  const [pedidoToDuplicate, setPedidoToDuplicate] = useState<string | null>(null);
  
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

        // Query the vw_clientes_pedidos view which flattens cliente+pedido fields
        const query = (supabase as any)
          .from('vw_clientes_pedidos')
          .select(`*, cliente_id, cliente_nome, cliente_criado_em, cliente_atualizado_em, pedido_id, id_externo, pedido_cliente_nome, contato, responsavel_id, plataforma_id, status_id, etiqueta_envio_id, urgente, pedido_criado_em, pedido_atualizado_em, frete_melhor_envio`, { count: 'exact' })
          .eq('status_id', CANCELADO_STATUS_ID)
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

        const plataformasArray = Array.isArray(platResp?.data) ? platResp.data : (Array.isArray(platResp) ? platResp : []);
        const plataformasMap = plataformasArray.reduce((acc: any, p: any) => (acc[p.id] = p, acc), {});
        
        const usuariosArray = Array.isArray(userResp?.data) ? userResp.data : (Array.isArray(userResp) ? userResp : []);
        const usuariosMap = usuariosArray.reduce((acc: any, u: any) => (acc[u.id] = u, acc), {});
        
        const statusArray = Array.isArray(statusResp?.data) ? statusResp.data : (Array.isArray(statusResp) ? statusResp : []);
        const statusMap = statusArray.reduce((acc: any, s: any) => (acc[s.id] = s, acc), {});
        
        const etiquetaArray = Array.isArray(etiquetaResp?.data) ? etiquetaResp.data : (Array.isArray(etiquetaResp) ? etiquetaResp : []);
        const etiquetaMap = etiquetaArray.reduce((acc: any, t: any) => (acc[t.id] = t, acc), {});

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
        console.error('Erro ao buscar pedidos cancelados', err);
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();

    return () => { mounted = false };
  }, [page, pageSize, searchTerm]);

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

  const duplicatePedido = async () => {
    const pedidoId = pedidoToDuplicate;
    if (!pedidoId) return;
    
    setConfirmDuplicateOpen(false);
    setPedidoToDuplicate(null);
    
    try {
      const { data: pedidoRow, error: pedidoError } = await supabase
        .from('pedidos')
        .select(`*, clientes(*), itens_pedido(*)`)
        .eq('id', pedidoId)
        .single();

      if (pedidoError) throw pedidoError;

      const pick = (val: any) => Array.isArray(val) ? val[0] : val;
      const cliente = pick((pedidoRow as any).clientes) || null;

      // build new pedido payload copying relevant fields
      const now = new Date().toISOString();
      const computeNewIdExterno = (orig: any) => {
        const idExt = orig || '';
        if (!idExt) return null;
        const m = idExt.match(/^(.*)\/(\d+)$/);
        if (m) {
          // increment suffix
          const base = m[1];
          const num = Number(m[2] || 0) + 1;
          return `${base}/${num}`;
        }
        return `${idExt}/1`;
      };

      const newPedidoPayload: any = {
        id_externo: computeNewIdExterno((pedidoRow as any).id_externo),
        cliente_nome: (pedidoRow as any).cliente_nome || (cliente && cliente.nome) || null,
        contato: (pedidoRow as any).contato ? String((pedidoRow as any).contato).replace(/\D/g, '') : (cliente ? String(cliente.telefone || cliente.contato || '').replace(/\D/g, '') : null),
        plataforma_id: (pedidoRow as any).plataforma_id || null,
        status_id: COMERCIAL_STATUS_ID,
        responsavel_id: (pedidoRow as any).responsavel_id || null,
        valor_total: (pedidoRow as any).valor_total || null,
        frete_venda: (pedidoRow as any).frete_venda || null,
        cor_do_pedido: '#FF0000',
        criado_em: now,
        empresa_id: empresaId || null
      };

      // mark the inserted record as a duplicata
      newPedidoPayload.duplicata = true;

      const { data: newPedidoData, error: newPedidoError } = await supabase.from('pedidos').insert(newPedidoPayload).select('id').single();
      if (newPedidoError) throw newPedidoError;

      const newPedidoId = (newPedidoData as any).id;

      // mark original pedido as foi_duplicado = true
      try {
        const { error: markErr } = await supabase.from('pedidos').update({ foi_duplicado: true, atualizado_em: new Date().toISOString() } as any).eq('id', pedidoId);
        if (markErr) console.error('Erro ao marcar pedido original como duplicado:', markErr);
        else {
          // update local state to reflect original foiDuplicado
          setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, foiDuplicado: true } : p));
        }
      } catch (markEx) {
        console.error('Exceção ao marcar pedido original como duplicado:', markEx);
      }

      // create a cliente record linked to the new pedido (if original cliente exists)
      if (cliente) {
        try {
          const clientePayload: any = {
            nome: cliente.nome || (pedidoRow as any).cliente_nome || null,
            telefone: cliente.telefone ? String(cliente.telefone).replace(/\D/g, '') : (cliente.contato ? String(cliente.contato).replace(/\D/g, '') : null),
            email: cliente.email || null,
            cpf: cliente.cpf || null,
            cnpj: cliente.cnpj || null,
            endereco: cliente.endereco || null,
            numero: cliente.numero || null,
            complemento: cliente.complemento || null,
            bairro: cliente.bairro || null,
            cidade: cliente.cidade || null,
            estado: cliente.estado || null,
            cep: cliente.cep || null,
            link_formulario: `/${newPedidoId}`,
            formulario_enviado: false,
            pedido_id: newPedidoId,
            criado_em: new Date().toISOString(),
            empresa_id: empresaId || null
          };
          const { error: clienteError } = await supabase.from('clientes').insert(clientePayload as any);
          if (clienteError) console.error('Erro ao duplicar cliente:', clienteError);
        } catch (cliErr) {
          console.error('Exceção ao criar cliente duplicado:', cliErr);
        }
      }

      // duplicate itens_pedido if present
      const itens = (pedidoRow as any).itens_pedido || [];
      if (itens && itens.length) {
        try {
          const itensPayload = [];
          for (const it of itens) {
            // Buscar dimensões do produto ou variação
            let dimensoes = { altura: null, largura: null, comprimento: null, peso: null };
            
            try {
              // Se tem variação, buscar da variação primeiro
              if (it.variacao_id) {
                const { data: variacaoData } = await supabase
                  .from('variacoes_produto')
                  .select('altura, largura, comprimento, peso')
                  .eq('id', it.variacao_id)
                  .maybeSingle();
                
                if (variacaoData) {
                  dimensoes = {
                    altura: variacaoData.altura,
                    largura: variacaoData.largura,
                    comprimento: variacaoData.comprimento,
                    peso: variacaoData.peso
                  };
                }
              }
              
              // Se não tem variação ou a variação não tem dimensões, buscar do produto
              if (!dimensoes.altura && !dimensoes.peso) {
                const { data: produtoData } = await supabase
                  .from('produtos')
                  .select('altura, largura, comprimento, peso')
                  .eq('id', it.produto_id)
                  .maybeSingle();
                
                if (produtoData) {
                  dimensoes = {
                    altura: produtoData.altura,
                    largura: produtoData.largura,
                    comprimento: produtoData.comprimento,
                    peso: produtoData.peso
                  };
                }
              }
            } catch (err) {
              console.error('Erro ao buscar dimensões:', err);
            }
            
            itensPayload.push({
              pedido_id: newPedidoId,
              produto_id: it.produto_id,
              variacao_id: it.variacao_id || null,
              quantidade: it.quantidade || 1,
              preco_unitario: it.preco_unitario || it.preco || 0,
              codigo_barras: it.codigo_barras || null,
              altura: dimensoes.altura,
              largura: dimensoes.largura,
              comprimento: dimensoes.comprimento,
              peso: dimensoes.peso,
              criado_em: new Date().toISOString(),
              empresa_id: empresaId || null
            });
          }
          
          const { error: itensError } = await supabase.from('itens_pedido').insert(itensPayload as any);
          if (itensError) console.error('Erro ao duplicar itens do pedido:', itensError);
        } catch (itErr) {
          console.error('Exceção ao duplicar itens:', itErr);
        }
      }

      toast({ title: 'Duplicado', description: 'Pedido duplicado com sucesso' });

      // Navigate to the new order page
      navigate(`/pedido/${newPedidoId}`);
    } catch (err: any) {
      console.error('Erro ao duplicar pedido:', err);
      toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-shrink-0">
        <ComercialSidebar />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pedidos Cancelados</h1>
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
                    placeholder="Buscar pedidos cancelados..."
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
                  <TableHead className="text-center">Data Criado</TableHead>
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
                  <TableRow key={pedido.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => {
                    const currentParams = new URLSearchParams();
                    currentParams.set('readonly', '1');
                    currentParams.set('returnTo', location.pathname + location.search);
                    navigate(`/pedido/${pedido.id}?${currentParams.toString()}`);
                  }}>
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
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          const currentParams = new URLSearchParams();
                          currentParams.set('readonly', '1');
                          currentParams.set('returnTo', location.pathname + location.search);
                          navigate(`/pedido/${pedido.id}?${currentParams.toString()}`);
                        }}>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          setPedidoToDuplicate(pedido.id);
                          setConfirmDuplicateOpen(true);
                        }} title="Duplicar pedido">
                          <Copy className="h-4 w-4" />
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

      <AlertDialog open={confirmDuplicateOpen} onOpenChange={setConfirmDuplicateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicar Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja duplicar este pedido? Um novo pedido será criado com status "Comercial" e você será redirecionado para editá-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setConfirmDuplicateOpen(false);
              setPedidoToDuplicate(null);
            }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={duplicatePedido}>Duplicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default PedidosCancelados;
