import { useEffect, useState } from 'react';
import { Plus, Search, Package, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { mockProdutos } from '@/data/mockData';
import { Produto } from '@/types';
import ProductForm from '@/components/products/ProductForm';
import { supabase } from '@/integrations/supabase/client';
import EstoqueSidebar from '@/components/layout/EstoqueSidebar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { HiFilter } from "react-icons/hi";
import { AiFillProduct } from "react-icons/ai";
import { BiSolidCategoryAlt } from "react-icons/bi";
import { TbReportMoney } from "react-icons/tb";
import { cn } from '@/lib/utils';
import { FaPencil } from "react-icons/fa6";


const colorStyles: Record<string, string> = {
  custom: 'from-custom-500 to-custom-600',
  blue: 'from-blue-500 to-blue-600',
  green: 'from-green-500 to-green-600',
  orange: 'from-orange-500 to-orange-600',
  red: 'from-red-500 to-red-600',
};

const borderStyles: Record<string, string> = {
  custom: 'border-custom-600',
  blue: 'border-blue-600',
  green: 'border-green-600',
  orange: 'border-orange-600',
  red: 'border-red-600',
};

const formatBR = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });



export function Estoque() {
  const [searchTerm, setSearchTerm] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const { toast } = useToast();
  const { permissoes, hasPermissao } = useAuth();
  const canCreateProduct = hasPermissao ? hasPermissao(36) : ((permissoes || []).includes(36));
  const canEditProduct = hasPermissao ? hasPermissao(37) : ((permissoes || []).includes(37));

  useEffect(() => {
    let mounted = true;
    const fetchProdutos = async () => {
      setLoading(true);
      setError(null);
      try {
        // Buscar com paginação
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        // Buscar total primeiro para paginação
        const { count: totalCount } = await supabase
          .from('produtos')
          .select('*', { count: 'exact', head: true });

        if (totalCount !== null) {
          setTotal(totalCount);
        }

        const { data, error: supaError } = await supabase
          .from('produtos')
          .select('id,nome,sku,preco,unidade,categoria,img_url,qntd,nome_variacao,criado_em,atualizado_em,up_cell,lista_id_upsell,contagem,altura,largura,comprimento,peso, variacoes_produto(id,nome,sku,valor,qntd,img_url,ordem)')
          .order('contagem', { ascending: false, nullsFirst: false })
          .order('criado_em', { ascending: false })
          .range(from, to);

        if (supaError) throw supaError;
        if (!mounted) return;

        const mapped: Produto[] = (data || []).map((p: any) => ({
          id: p.id,
          nome: p.nome,
          sku: p.sku,
          preco: Number(p.preco),
          unidade: p.unidade || 'un',
          categoria: p.categoria || '',
          imagemUrl: p.img_url || undefined,
          variacoes: (p.variacoes_produto || [])
            .map((v: any) => ({ id: v.id, nome: v.nome, sku: v.sku, valor: Number(v.valor), qntd: v.qntd ?? 0, img_url: v.img_url || null, ordem: v.ordem ?? 999 }))
            .sort((a: any, b: any) => a.ordem - b.ordem),
          nomeVariacao: p.nome_variacao || null,
          qntd: p.qntd ?? 0,
          up_cell: p.up_cell,
          upCell: p.up_cell,
          lista_id_upsell: p.lista_id_upsell,
          altura: p.altura ?? null,
          largura: p.largura ?? null,
          comprimento: p.comprimento ?? null,
          peso: p.peso ?? null,
          criadoEm: p.criado_em,
          atualizadoEm: p.atualizado_em,
        }));

        setProdutos(mapped);
      } catch (err: any) {
        console.error('Erro ao buscar produtos', err);
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchProdutos();
    return () => { mounted = false };
  }, [page, pageSize]);

  const [showNewProduct, setShowNewProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  const handleModalClose = () => {
    setShowNewProduct(false);
    setEditingProduct(null);
    // refetch produtos after modal close
    (async () => {
      setLoading(true);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { count: totalCount } = await supabase
        .from('produtos')
        .select('*', { count: 'exact', head: true });

      if (totalCount !== null) {
        setTotal(totalCount);
      }

      const { data } = await supabase.from('produtos').select('id,nome,sku,preco,unidade,categoria,img_url,qntd,nome_variacao,criado_em,atualizado_em,up_cell,lista_id_upsell,contagem,altura,largura,comprimento,peso, variacoes_produto(id,nome,sku,valor,qntd,img_url,ordem)').order('contagem', { ascending: false, nullsFirst: false }).order('criado_em', { ascending: false }).range(from, to);
      if (data) setProdutos(data.map((p: any) => ({
        id: p.id,
        nome: p.nome,
        sku: p.sku,
        preco: Number(p.preco),
        unidade: p.unidade || 'un',
        categoria: p.categoria || '',
        imagemUrl: p.img_url || undefined,
        variacoes: (p.variacoes_produto || [])
          .map((v: any) => ({ id: v.id, nome: v.nome, sku: v.sku, valor: Number(v.valor), qntd: v.qntd ?? 0, img_url: v.img_url || null, ordem: v.ordem ?? 999 }))
          .sort((a: any, b: any) => a.ordem - b.ordem),
        nomeVariacao: p.nome_variacao || null,
        qntd: p.qntd ?? 0,
        up_cell: p.up_cell,
        upCell: p.up_cell,
        lista_id_upsell: p.lista_id_upsell,
        altura: p.altura ?? null,
        largura: p.largura ?? null,
        comprimento: p.comprimento ?? null,
        peso: p.peso ?? null,
        criadoEm: p.criado_em,
        atualizadoEm: p.atualizado_em,
      })));
      setLoading(false);
    })();
  }

  const filteredProdutos = produtos.filter(produto =>
    produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <EstoqueSidebar />
      
      <div className="flex-1 space-y-4 sm:space-y-6 p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Estoque</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os produtos cadastrados
            </p>
          </div>
          <Button
            className="bg-custom-600 hover:bg-custom-700 w-full sm:w-auto"
            onClick={() => {
              if (!canCreateProduct) {
                toast({ title: 'Sem permissão', description: 'Você não tem permissão para criar produtos', variant: 'destructive' });
                return;
              }
              setEditingProduct(null);
              setShowNewProduct(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>

      {/* Métricas resumidas */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className={cn("relative overflow-hidden border-2", borderStyles.custom)}>
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-5", colorStyles.custom)} />
          <CardHeader className="flex flex-row items-center px-4 pt-4 justify-between space-y-0 pb-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Total de Produtos</CardTitle>
            <div className={cn("p-2 rounded-lg bg-gradient-to-br", colorStyles.custom)}>
              <AiFillProduct className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 ">
              {loading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold">{total}</div>
                </>
              )}
            </CardContent>
        </Card>

        <Card className={cn("relative overflow-hidden border-2", borderStyles.blue)}>
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-5", colorStyles.blue)} />
          <CardHeader className="flex flex-row items-center px-4 pt-4 justify-between space-y-0 pb-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Categorias</CardTitle>
            <div className={cn("p-2 rounded-lg bg-gradient-to-br", colorStyles.blue)}>
              <BiSolidCategoryAlt className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 ">
            {loading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">
                  {new Set(produtos.map(p => p.categoria)).size}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={cn("relative overflow-hidden border-2", borderStyles.green)}>
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-5", colorStyles.green)} />
          <CardHeader className="flex flex-row items-center px-4 pt-4 justify-between space-y-0 pb-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Valor Médio</CardTitle>
            <div className={cn("p-2 rounded-lg bg-gradient-to-br", colorStyles.green)}>
              <TbReportMoney className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 ">
            {loading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">
                  <span className="text-sm align-center mr-1" style={{ fontSize: '12px', fontWeight: 600, color: '#545454' }}>R$</span>
                  {produtos.length > 0 ? formatBR(produtos.reduce((acc, p) => acc + p.preco, 0) / produtos.length) : '0,00'}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtros e busca (movido para o card de produtos) */}

  <ProductForm key={editingProduct?.id ?? 'new'} open={showNewProduct} onClose={handleModalClose} product={editingProduct} />

      {/* Tabela de produtos - Desktop */}
      <Card className="hidden md:block">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div>
                <div className="font-medium">
                  <span className="block md:inline" style={{ fontSize: '24px', fontWeight: 600, color: '#000000' }}>Produtos</span>
                  <span className="ml-2 text-sm text-muted-foreground" style={{ fontSize: '12px', fontWeight: 400, color: '#545454' }}>{total} produtos cadastrados</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por nome ou SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-center">Preço</TableHead>
                <TableHead className="text-center w-[140px]">Categoria</TableHead>
                <TableHead className="text-center w-[70px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Carregando produtos...</TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-red-600">{error}</TableCell>
                </TableRow>
              )}

              {!loading && !error && filteredProdutos.map((produto) => (
                <TableRow key={produto.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-custom-100 rounded-lg flex items-center justify-center overflow-hidden">
                            {produto.imagemUrl ? (
                              <img src={produto.imagemUrl} alt={produto.nome} className="w-full h-full object-cover" />
                            ) : (
                              <AiFillProduct className="h-5 w-5 text-custom-600" />
                            )}
                          </div>
                      <div>
                        <div className="font-medium">{produto.nome}</div>
                        {produto.variacoes && produto.variacoes.length > 0 && (
                          <div className="text-sm mt-1">
                            <span style={{ fontSize: '12px', fontWeight: 400, color: '#545454' }}>{produto.nomeVariacao || 'Variação'}:</span> {` ${produto.variacoes[0].nome} `}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {produto.sku}
                  </TableCell>
                  
                  <TableCell className="text-center">{Number((produto as any).qntd ?? 0)}</TableCell>
                  <TableCell className="font-medium text-center">
                          <span className="align-top mr-0.5" style={{ fontSize: '8px', fontWeight: 400, color: '#545454' }}>R$</span>{formatBR(produto.preco)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">
                      {produto.categoria}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!canEditProduct) {
                              toast({ title: 'Sem permissão', description: 'Você não tem permissão para editar produtos', variant: 'destructive' });
                              return;
                            }
                            setEditingProduct(produto);
                            setShowNewProduct(true);
                          }}
                        >
                          <FaPencil className="h-4 w-4" />
                        </Button>
                      </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>          
          {/* Paginação - Desktop */}
          <div className="flex items-center justify-between p-4 border-t">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Mostrando <strong>{(page - 1) * pageSize + 1}</strong> - <strong>{Math.min(page * pageSize, total)}</strong> de <strong>{total}</strong>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Mostrar</label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    setPageSize(newSize);
                    setPage(1);
                  }}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-sm text-muted-foreground">por página</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <div className="text-sm">{page} de {Math.max(1, Math.ceil(total / pageSize))}</div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))} 
                disabled={page >= Math.ceil(total / pageSize)}
              >
                Próximo
              </Button>
            </div>
          </div>        
        </CardContent>
      </Card>

      {/* Lista de produtos - Mobile */}
      <div className="md:hidden space-y-3">
        {loading && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Carregando produtos...
            </CardContent>
          </Card>
        )}
        {error && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-red-600">
              {error}
            </CardContent>
          </Card>
        )}
        {!loading && !error && filteredProdutos.map((produto) => (
          <Card key={produto.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="grid gap-3">
                <div className="flex gap-3 items-start">
                  <div className="w-16 h-16 bg-custom-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {produto.imagemUrl ? (
                      <img src={produto.imagemUrl} alt={produto.nome} className="w-full h-full object-cover" />
                    ) : (
                      <AiFillProduct className="h-8 w-8 text-custom-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base">{produto.nome}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Quantidade</div>
                        <div className="font-semibold">{Number((produto as any).qntd ?? 0)}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Preço</div>
                        <div className="font-semibold">
                          <span className="text-xs align-center mr-1" style={{ fontSize: '11px', fontWeight:'500', color: '#393939' }}>R$</span>
                          {formatBR(produto.preco)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      if (!canEditProduct) {
                        toast({ title: 'Sem permissão', description: 'Você não tem permissão para editar produtos', variant: 'destructive' });
                        return;
                      }
                      setEditingProduct(produto);
                      setShowNewProduct(true);
                    }}
                  >
                    Editar Produto
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {/* Paginação - Mobile */}
        {!loading && !error && (
          <Card>
            <CardContent className="p-2">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 w-full justify-center">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    disabled={page <= 1}
                  >
                    Anterior
                  </Button>
                  <div className="text-sm">{page} de {Math.max(1, Math.ceil(total / pageSize))}</div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))} 
                    disabled={page >= Math.ceil(total / pageSize)}
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}