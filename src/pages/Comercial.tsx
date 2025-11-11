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
import { useToast } from '@/hooks/use-toast';
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
  const ETIQUETA_FILTER_ID = '0c0ff1fc-1c3b-4eff-9dec-a505d33f3e18';
  // etiqueta que representa "processado/impresso" — usada para remover do filtro de "Etiqueta Pendente"
  const PROCESSED_ETIQUETA_ID = '466958dd-e525-4e8d-95f1-067124a5ea7f';
  const initialEtiquetaParam = new URLSearchParams(location.search).get('etiqueta_envio_id') || '';
  const [filterEtiquetaId, setFilterEtiquetaId] = useState<string | ''>(initialEtiquetaParam);
  const initialClienteFormParam = new URLSearchParams(location.search).get('cliente_formulario_enviado');
  const [filterClienteFormNotSent, setFilterClienteFormNotSent] = useState<boolean>(initialClienteFormParam === 'false');
  const [etiquetaCount, setEtiquetaCount] = useState<number>(0);
  const { toast } = useToast();
  const [processingRapid, setProcessingRapid] = useState<Record<string, boolean>>({});
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
  const searchTrim = (searchTerm || '').trim();
  const actualPage = searchTrim.length > 0 ? 1 : page;
  const from = (actualPage - 1) * pageSize;
  const to = actualPage * pageSize - 1;

        // If the ComercialSidebar requested a specific view (ex: enviados), apply extra filters
        const view = new URLSearchParams(location.search).get('view') || 'pedidos';

        const query = supabase
          .from('pedidos')
          .select(
            `*, plataformas(id,nome,cor,img_url), usuarios(id,nome,img_url), status(id,nome,cor_hex,ordem), tipos_etiqueta(id,nome,cor_hex,ordem,criado_em,atualizado_em), clientes(id,nome,formulario_enviado)`,
            { count: 'exact' }
          )
          .order('criado_em', { ascending: false });

        // apply search term server-side so pagination is based on the query
        if (searchTrim.length > 0) {
          // use ilike (case-insensitive) for id_externo, cliente_nome and contato
          // PostgREST OR syntax: "col.ilike.%term%,othercol.ilike.%term%"
          const pattern = `%${searchTrim}%`;
          try {
            (query as any).or(`id_externo.ilike.${pattern},cliente_nome.ilike.${pattern},contato.ilike.${pattern}`);
          } catch (e) {
            // fallback: if .or fails, attempt adding single ilike on cliente_nome
            (query as any).ilike('cliente_nome', pattern);
          }
        }

        // when on the "enviados" view, only fetch pedidos with the Enviado status id
        if (view === 'enviados') {
          query.eq('status_id', 'fa6b38ba-1d67-4bc3-821e-ab089d641a25');
        }

        // apply pedido_liberado = FALSE filter when requested
        if (filterNotLiberado) {
          // only include pedidos where pedido_liberado is false
          // cast to any to avoid TypeScript deep-instantiation error from the Postgrest query typings
          (query as any).eq('pedido_liberado', false);
        }

        // apply etiqueta_envio_id filter when requested
        if (filterEtiquetaId) {
          (query as any).eq('etiqueta_envio_id', filterEtiquetaId);
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
          const clienteRow = pick(row.clientes);
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
            clienteNome: clienteRow?.nome || row.cliente_nome,
            contato: row.contato || '',
            formularioEnviado: !!clienteRow?.formulario_enviado,
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
  }, [page, pageSize, view, filterNotLiberado, filterEtiquetaId, searchTerm]);

  // when the user types a search, reset to page 1 so results appear on the first page
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  // load count of pedidos with the specific etiqueta id (to show next to filter)
  useEffect(() => {
    let mounted = true;
    const loadEtiquetaCount = async () => {
      try {
        const { count, error } = await supabase.from('pedidos').select('id', { count: 'exact' }).eq('etiqueta_envio_id', ETIQUETA_FILTER_ID).limit(1);
        if (error) throw error;
        if (!mounted) return;
        setEtiquetaCount(count || 0);
      } catch (err) {
        console.error('Erro ao buscar contagem de etiqueta:', err);
      }
    };
    loadEtiquetaCount();
    return () => { mounted = false };
  }, []);

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

  // normalize helper: remove diacritics and lower-case
  const normalize = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  const digitsOnly = (s?: string) => (s || '').replace(/\D/g, '').trim();

  const normalizedSearch = normalize(searchTerm);
  const normalizedDigits = digitsOnly(searchTerm);

  const filteredPedidos = pedidos.filter(pedido => {
    const idExterno = normalize(pedido.idExterno);
    const cliente = normalize(pedido.clienteNome);
    const contatoText = normalize(pedido.contato);
    const contatoDigits = digitsOnly(pedido.contato);

    // match by id_externo, cliente_nome or contato (text)
    if (idExterno.includes(normalizedSearch) || cliente.includes(normalizedSearch) || contatoText.includes(normalizedSearch)) return true;

    // if user typed digits (or phone with formatting), match contato ignoring formatting (numbers-only)
    if (normalizedDigits.length > 0 && contatoDigits.includes(normalizedDigits)) return true;

    return false;
  });

  // apply client-formulario filter client-side: only include pedidos whose cliente.formulario_enviado === false
  const filteredPedidosWithClienteFilter = filterClienteFormNotSent ? filteredPedidos.filter(p => !(p as any).formularioEnviado) : filteredPedidos;

  const handleEnvioRapido = async (pedidoId: string) => {
    if (!pedidoId) return;
    setProcessingRapid(prev => ({ ...prev, [pedidoId]: true }));
    try {
      // load full pedido with cliente and itens
      const { data: pedidoRow, error: pedidoError } = await supabase
        .from('pedidos')
        .select(`*, clientes(*), itens_pedido(id,quantidade,preco_unitario, produto:produtos(id,nome,sku,preco), variacao:variacoes_produto(id,nome,sku))`)
        .eq('id', pedidoId)
        .single();

      if (pedidoError) throw pedidoError;

      // normalize cliente shape: PostgREST may return arrays for relations
      const pick = (val: any) => Array.isArray(val) ? val[0] : val;
      const cliente = pick((pedidoRow as any).clientes) || null;

      // load default remetente and embalagem (use first available)
      const [{ data: remetentesData, error: remErr }, { data: embalagensData, error: embErr }] = await Promise.all([
        supabase.from('remetentes').select('*').order('nome'),
        supabase.from('embalagens').select('*').order('nome')
      ]);
      if (remErr) throw remErr;
      if (embErr) throw embErr;

      const selectedRemetente = (remetentesData && remetentesData[0]) || null;
      const selectedEmbalagem = (embalagensData && embalagensData[0]) || null;

      const stored = (pedidoRow as any).frete_melhor_envio;
      let melhorEnvioId: any = null;

      const buildProducts = (pedidoRow?.itens_pedido || []).map((it: any) => ({
        name: it.variacao?.nome || it.produto?.nome || 'Produto',
        quantity: String(it.quantidade || 1),
        unitary_value: String(Number(it.preco_unitario || it.preco || 0).toFixed(2))
      }));

      if (stored) {
        // reuse stored payload when available
  const insuranceValue = (pedidoRow?.itens_pedido || []).reduce((s: number, it: any) => s + (Number(it.preco_unitario || it.preco || 0) * Number(it.quantidade || 1)), 0) || 1;
        const payload: any = {
          from: {
            name: selectedRemetente?.nome || stored.from?.name || '' ,
            phone: (selectedRemetente as any)?.contato || (selectedRemetente as any)?.telefone || stored.from?.phone || '',
            email: (selectedRemetente as any)?.email || stored.from?.email || 'contato@empresa.com',
            document: (selectedRemetente as any)?.cpf || stored.from?.document || '',
            address: (selectedRemetente as any)?.endereco || stored.from?.address || '',
            number: (selectedRemetente as any)?.numero || stored.from?.number || '',
            complement: (selectedRemetente as any)?.complemento || stored.from?.complement || '',
            district: (selectedRemetente as any)?.bairro || stored.from?.district || '',
            city: (selectedRemetente as any)?.cidade || stored.from?.city || '',
            state_abbr: (selectedRemetente as any)?.estado || stored.from?.state_abbr || '',
            country_id: stored.from?.country_id || 'BR',
            postal_code: ((selectedRemetente as any)?.cep || stored.from?.postal_code || '').replace(/\D/g, '')
          },
          to: {
            name: cliente?.nome || stored.to?.name || '' ,
            phone: (cliente as any)?.telefone || (cliente as any)?.contato || stored.to?.phone || '',
            email: (cliente as any)?.email || stored.to?.email || 'cliente@email.com',
            document: (cliente as any)?.cpf || stored.to?.document || '',
            address: (cliente as any)?.endereco || stored.to?.address || '',
            number: (cliente as any)?.numero || stored.to?.number || '',
            complement: (cliente as any)?.complemento || stored.to?.complement || '',
            district: (cliente as any)?.bairro || stored.to?.district || '',
            city: (cliente as any)?.cidade || stored.to?.city || '',
            state_abbr: (cliente as any)?.estado || stored.to?.state_abbr || '',
            country_id: stored.to?.country_id || 'BR',
            postal_code: (((cliente as any)?.cep) || stored.to?.postal_code || '').replace(/\D/g, '')
          },
          options: stored.options || { insurance_value: insuranceValue, receipt: false, own_hand: false, reverse: false, non_commercial: true },
          products: buildProducts,
          service: stored.service || stored.service_id || stored.raw_response?.service || stored.raw_response?.service_id,
          volumes: stored.volumes || (selectedEmbalagem ? [{ height: selectedEmbalagem.altura, width: selectedEmbalagem.largura, length: selectedEmbalagem.comprimento, weight: selectedEmbalagem.peso, insurance_value: insuranceValue }] : [{ height: 5, width: 20, length: 20, weight: 1, insurance_value: insuranceValue }])
        };

        // send to cart function
        const { data: carrinhoResp, error: carrinhoError } = await supabase.functions.invoke('adic-carrinho-melhorenvio', { body: payload });
        if (carrinhoError) throw carrinhoError;

        melhorEnvioId = carrinhoResp?.id || carrinhoResp?.data?.id || carrinhoResp?.shipment?.id;

        const { error: updateErr } = await supabase.from('pedidos').update({ id_melhor_envio: melhorEnvioId || null, carrinho_me: true, atualizado_em: new Date().toISOString() } as any).eq('id', pedidoId);
        if (updateErr) throw updateErr;
        toast({ title: 'Sucesso', description: 'Frete enviado ao carrinho do Melhor Envio' });
      } else {
        // calculate frete, pick cheapest and send it
  if (!cliente?.cep) throw new Error('CEP do cliente ausente');
  const cepLimpo = String((cliente as any).cep).replace(/\D/g, '');
        if (!/^[0-9]{8}$/.test(cepLimpo)) throw new Error('CEP do cliente inválido');

        if (!selectedRemetente || !selectedEmbalagem) throw new Error('Remetente ou embalagem não configurados');

        // build calc payload
  const itemsValue = (pedidoRow?.itens_pedido || []).reduce((s: number, it: any) => s + (Number(it.preco_unitario || it.preco || 0) * Number(it.quantidade || 1)), 0);
        const calcPayload = {
          origem: { postal_code: ((selectedRemetente as any)?.cep || '').replace(/\D/g,''), contact: (selectedRemetente as any)?.contato || (selectedRemetente as any)?.nome, email: (selectedRemetente as any)?.email || 'contato@empresa.com' },
          destino: { postal_code: cepLimpo },
          pacote: [{ weight: selectedEmbalagem.peso, insurance_value: itemsValue || 1, length: selectedEmbalagem.comprimento, height: selectedEmbalagem.altura, width: selectedEmbalagem.largura, id: '1', quantity: 1 }]
        };

        const { data: calcResp, error: calcErr } = await supabase.functions.invoke('calculo-frete-melhorenvio', { body: calcPayload });
        if (calcErr) throw calcErr;
        const cotacoesValidas = (calcResp?.cotacoes || []).filter((q: any) => !q.error).map((quote: any) => ({ service_id: quote.id, transportadora: quote.company.name, modalidade: quote.name, prazo: `${quote.delivery_time} dias úteis`, preco: Number(quote.price), raw_response: quote }));
        if (!cotacoesValidas.length) throw new Error('Nenhuma opção de frete disponível');
        const maisBarato = cotacoesValidas.reduce((prev: any, curr: any) => prev.preco < curr.preco ? prev : curr);

        // build payload to add to cart using cheapest quote
        const insuranceValue = itemsValue || 1;
        const payload: any = {
          from: {
            name: selectedRemetente?.nome || '',
            phone: (selectedRemetente as any)?.contato || (selectedRemetente as any)?.telefone || '',
            email: (selectedRemetente as any)?.email || 'contato@empresa.com',
            document: (selectedRemetente as any)?.cpf || '',
            address: (selectedRemetente as any)?.endereco || '',
            number: (selectedRemetente as any)?.numero || '',
            complement: (selectedRemetente as any)?.complemento || '',
            district: (selectedRemetente as any)?.bairro || '',
            city: (selectedRemetente as any)?.cidade || '',
            state_abbr: (selectedRemetente as any)?.estado || '',
            country_id: 'BR',
            postal_code: ((selectedRemetente as any)?.cep || '').replace(/\D/g, '')
          },
          to: {
            name: cliente?.nome || '',
            phone: (cliente as any)?.telefone || (cliente as any)?.contato || '',
            email: (cliente as any)?.email || 'cliente@email.com',
            document: (cliente as any)?.cpf || '',
            address: (cliente as any)?.endereco || '',
            number: (cliente as any)?.numero || '',
            complement: (cliente as any)?.complemento || '',
            district: (cliente as any)?.bairro || '',
            city: (cliente as any)?.cidade || '',
            state_abbr: (cliente as any)?.estado || '',
            country_id: 'BR',
            postal_code: cepLimpo
          },
          options: { insurance_value: insuranceValue, receipt: false, own_hand: false, reverse: false, non_commercial: true },
          products: buildProducts,
          service: maisBarato.service_id || maisBarato.raw_response?.service_id || maisBarato.raw_response?.service,
          volumes: selectedEmbalagem ? [{ height: selectedEmbalagem.altura, width: selectedEmbalagem.largura, length: selectedEmbalagem.comprimento, weight: selectedEmbalagem.peso, insurance_value: insuranceValue }] : [{ height: 5, width: 20, length: 20, weight: 1, insurance_value: insuranceValue }]
        };

        const { data: carrinhoResp, error: carrinhoError } = await supabase.functions.invoke('adic-carrinho-melhorenvio', { body: payload });
        if (carrinhoError) throw carrinhoError;
        melhorEnvioId = carrinhoResp?.id || carrinhoResp?.data?.id || carrinhoResp?.shipment?.id;

        const { error: updateErr } = await supabase.from('pedidos').update({ id_melhor_envio: melhorEnvioId || null, carrinho_me: true, frete_melhor_envio: { transportadora: maisBarato.transportadora, modalidade: maisBarato.modalidade, prazo: maisBarato.prazo, preco: maisBarato.preco, service_id: maisBarato.service_id, raw_response: maisBarato.raw_response }, atualizado_em: new Date().toISOString() } as any).eq('id', pedidoId);
        if (updateErr) throw updateErr;
        toast({ title: 'Sucesso', description: 'Frete calculado e enviado ao carrinho do Melhor Envio' });
      }

      // After sending to cart, process label
      try {
        const payloadLabel = { pedidoId, id_melhor_envio: melhorEnvioId };
        console.log('processar-etiqueta-melhorenvio payload:', payloadLabel);

        // first attempt
        const { data: labelResp, error: labelErr } = await supabase.functions.invoke('processar-etiqueta-melhorenvio', { body: payloadLabel });
        console.log('processar-etiqueta-melhorenvio response:', { labelResp, labelErr });

        // if the function returned an error or an unexpected response, try once more (transient network issues)
        let finalResp = labelResp;
        let finalErr = labelErr;
        if (finalErr || (!finalResp || (typeof finalResp === 'object' && Object.keys(finalResp).length === 0))) {
          console.warn('Etiqueta: resposta inicial inválida, tentando novamente...');
          try {
            await new Promise(r => setTimeout(r, 800));
            const retry = await supabase.functions.invoke('processar-etiqueta-melhorenvio', { body: payloadLabel });
            console.log('processar-etiqueta-melhorenvio retry response:', retry);
            finalResp = (retry as any).data || finalResp;
            finalErr = (retry as any).error || finalErr;
          } catch (retryErr) {
            console.error('Retry falhou:', retryErr);
          }
        }

        if (finalErr) {
          console.error('Erro da função processar-etiqueta-melhorenvio:', finalErr, finalResp);
          // show detailed message to user so they can report it
          const detail = (finalErr && (finalErr.message || finalErr.name)) || JSON.stringify(finalResp || finalErr);
          toast({ title: 'Erro ao processar etiqueta', description: String(detail).slice(0, 200), variant: 'destructive' });
          } else {
            const returnedUrl = finalResp?.url || null;
            if (returnedUrl && /^https?:\/\//i.test(returnedUrl)) {
              window.open(returnedUrl, '_blank');
              toast({ title: 'Etiqueta processada', description: 'A etiqueta foi processada e aberta em nova aba' });
            } else if (finalResp?.id) {
              toast({ title: 'Etiqueta processada', description: 'Etiqueta gerada no Melhor Envio. Verifique o painel.' });
            } else {
              // If response is unexpected, surface its JSON (truncated)
              console.warn('Resposta inesperada ao processar etiqueta:', finalResp);
              toast({ title: 'Etiqueta processada', description: 'Etiqueta processada. Verifique o painel do Melhor Envio.' });
            }

            // Marcar o pedido como com etiqueta processada para que saia do filtro "Etiqueta Pendente"
            try {
              const { error: updateEtiquetaErr } = await supabase
                .from('pedidos')
                .update({ etiqueta_envio_id: PROCESSED_ETIQUETA_ID, atualizado_em: new Date().toISOString() } as any)
                .eq('id', pedidoId);
              if (updateEtiquetaErr) {
                console.error('Erro ao atualizar etiqueta_envio_id no pedido:', updateEtiquetaErr);
                // não interrompe o fluxo principal — só avisa o usuário
                toast({ title: 'Aviso', description: 'Etiqueta processada, mas não foi possível atualizar o pedido no servidor.', variant: 'destructive' });
              } else {
                // Atualiza o estado local imediatamente para remover o pedido do filtro "Etiqueta Pendente"
                setPedidos(prev => {
                  // se o filtro de etiqueta pendente estiver ativo, remova o pedido da lista
                  if (filterEtiquetaId === ETIQUETA_FILTER_ID) {
                    return prev.filter(p => p.id !== pedidoId);
                  }
                  // caso contrário apenas atualize o campo da etiqueta no pedido
                  return prev.map(p => p.id === pedidoId ? { ...p, etiquetaEnvioId: PROCESSED_ETIQUETA_ID, etiquetaEnvio: 'DISPONIVEL' } : p);
                });

                // decrementa contagem local de etiquetas pendentes se aplicável
                setEtiquetaCount(c => Math.max(0, (c || 0) - (filterEtiquetaId === ETIQUETA_FILTER_ID ? 1 : 0)));
              }
            } catch (updErr) {
              console.error('Exceção ao atualizar etiqueta_envio_id:', updErr);
            }
        }
      } catch (err: any) {
        console.error('Erro ao processar etiqueta após envio ao carrinho:', err);
        toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
      }
  // Note: we no longer refresh the entire route here — local state is updated to reflect
  // the etiqueta change in real time (see setPedidos above). This avoids a full reload.
    } catch (err: any) {
      console.error('Erro no Envio Rápido:', err);
      toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setProcessingRapid(prev => ({ ...prev, [pedidoId]: false }));
    }
  };

  const totalPages = Math.max(1, Math.ceil((total || filteredPedidosWithClienteFilter.length) / pageSize));

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
                  ? `${filteredPedidosWithClienteFilter.length} pedidos encontrados`
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
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar pedidos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Active filter tags (appear directly below the search input) */}
              <div className="mt-2">
                {(filterNotLiberado || filterClienteFormNotSent || !!filterEtiquetaId) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {filterNotLiberado && (
                      <div className="flex items-center gap-2 bg-gray-100 text-gray-800 px-3 py-1 rounded">
                        <span className="text-sm">Somente não liberados</span>
                        <button
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => {
                            setFilterNotLiberado(false);
                            setPage(1);
                            const next = new URLSearchParams(location.search);
                            next.delete('pedido_liberado');
                            if (!next.get('module')) next.set('module', 'comercial');
                            navigate({ pathname: location.pathname, search: next.toString() });
                          }}
                          aria-label="Remover filtro não liberado"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {filterClienteFormNotSent && (
                      <div className="flex items-center gap-2 bg-gray-100 text-gray-800 px-3 py-1 rounded">
                        <span className="text-sm">Formulário não enviado</span>
                        <button
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => {
                            setFilterClienteFormNotSent(false);
                            setPage(1);
                            const next = new URLSearchParams(location.search);
                            next.delete('cliente_formulario_enviado');
                            if (!next.get('module')) next.set('module', 'comercial');
                            navigate({ pathname: location.pathname, search: next.toString() });
                          }}
                          aria-label="Remover filtro formulário não enviado"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {filterEtiquetaId === ETIQUETA_FILTER_ID && (
                      <div className="flex items-center gap-2 bg-gray-100 text-gray-800 px-3 py-1 rounded">
                        <span className="text-sm">Etiqueta Pendente</span>
                        <button
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => {
                            setFilterEtiquetaId('');
                            setPage(1);
                            const next = new URLSearchParams(location.search);
                            next.delete('etiqueta_envio_id');
                            if (!next.get('module')) next.set('module', 'comercial');
                            navigate({ pathname: location.pathname, search: next.toString() });
                          }}
                          aria-label="Remover filtro etiqueta pendente"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
              <div className="flex items-center gap-2 relative">
                <div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowFilters(s => !s)}>
                      <Filter className="h-4 w-4 mr-2" />
                      Filtrar
                    </Button>
                    <Button
                      size="sm"
                      variant={filterEtiquetaId === ETIQUETA_FILTER_ID ? 'outline' : 'ghost'}
                      onClick={() => {
                        // toggle etiqueta filter and reset to page 1
                        const next = new URLSearchParams(location.search);
                        if (filterEtiquetaId === ETIQUETA_FILTER_ID) {
                          setFilterEtiquetaId('');
                          next.delete('etiqueta_envio_id');
                        } else {
                          setFilterEtiquetaId(ETIQUETA_FILTER_ID);
                          next.set('etiqueta_envio_id', ETIQUETA_FILTER_ID);
                        }
                        // Ensure the module query is preserved so we don't unintentionally return to Dashboard
                        if (!next.get('module')) next.set('module', 'comercial');
                        setPage(1);
                        navigate({ pathname: location.pathname, search: next.toString() });
                      }}
                      className="ml-2 flex items-center gap-2"
                    >
                      <span className="text-sm">Etiqueta Pendente</span>
                      <span className="inline-block bg-red-50 text-red-700 px-2 py-0.5 rounded text-sm">{etiquetaCount}</span>
                    </Button>
                  </div>
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
                      <div className="flex items-center gap-2 mb-3">
                        <input id="filter-cliente-formulario" type="checkbox" checked={filterClienteFormNotSent} onChange={(e) => setFilterClienteFormNotSent(e.target.checked)} />
                        <label htmlFor="filter-cliente-formulario" className="text-sm">Somente pedidos com formulário não enviado</label>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          // clear filters
                          setFilterNotLiberado(false);
                          setFilterClienteFormNotSent(false);
                          const next = new URLSearchParams(location.search);
                          next.delete('pedido_liberado');
                          next.delete('cliente_formulario_enviado');
                          navigate({ pathname: location.pathname, search: next.toString() });
                          setShowFilters(false);
                        }}>Limpar</Button>
                        <Button size="sm" onClick={() => {
                          // apply filters via query params so they're shareable
                          const next = new URLSearchParams(location.search);
                          if (filterNotLiberado) next.set('pedido_liberado', 'false'); else next.delete('pedido_liberado');
                          if (filterClienteFormNotSent) next.set('cliente_formulario_enviado', 'false'); else next.delete('cliente_formulario_enviado');
                          // ensure module param remains
                          if (!next.get('module')) next.set('module', 'comercial');
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
                <TableHead className="text-center">Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Plataforma</TableHead>
                <TableHead className="text-center">Transportadora</TableHead>
                <TableHead className="text-center">Responsável</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Etiqueta</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* loading row intentionally removed per request */}
              {error && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-red-600">
                    {error}
                  </TableCell>
                </TableRow>
              )}

              {filteredPedidosWithClienteFilter.map((pedido) => (
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
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      {((pedido as any).etiquetaEnvioId === ETIQUETA_FILTER_ID) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mb-1 bg-purple-600 text-white hover:bg-purple-700 px-2 py-0 h-6 rounded text-xs"
                          onClick={(e) => { e.stopPropagation(); handleEnvioRapido(pedido.id); }}
                        >
                          {processingRapid[pedido.id] ? 'Processando...' : 'Envio Rápido'}
                        </Button>
                      )}
                      <div className="flex items-center justify-center">
                        <Badge 
                          variant="outline" 
                          className={etiquetaColors[pedido.etiquetaEnvio]}
                        >
                          {etiquetaLabels[pedido.etiquetaEnvio]}
                        </Badge>
                      </div>
                    </div>
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
              Mostrando <strong>{(page - 1) * pageSize + 1}</strong> - <strong>{Math.min(page * pageSize, total || filteredPedidosWithClienteFilter.length)}</strong> de <strong>{total || filteredPedidosWithClienteFilter.length}</strong>
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