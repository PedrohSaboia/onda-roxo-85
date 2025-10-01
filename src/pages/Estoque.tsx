import { useEffect, useState } from 'react';
import { Plus, Search, Filter, Package, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { mockProdutos } from '@/data/mockData';
import { Produto } from '@/types';
import ProductForm from '@/components/products/ProductForm';
import { supabase } from '@/integrations/supabase/client';

export function Estoque() {
  const [searchTerm, setSearchTerm] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchProdutos = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: supaError } = await supabase
          .from('produtos')
          .select('id,nome,sku,preco,unidade,categoria,img_url,qntd,nome_variacao,criado_em,atualizado_em, variacoes_produto(id,nome,sku,valor,qntd,img_url)')
          .order('criado_em', { ascending: false });

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
          variacoes: (p.variacoes_produto || []).map((v: any) => ({ id: v.id, nome: v.nome, sku: v.sku, valor: Number(v.valor), qntd: v.qntd ?? 0, img_url: v.img_url || null })),
          nomeVariacao: p.nome_variacao || null,
          qntd: p.qntd ?? 0,
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
  }, []);

  const [showNewProduct, setShowNewProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  const handleModalClose = () => {
    setShowNewProduct(false);
    setEditingProduct(null);
    // refetch produtos after modal close
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('produtos').select('id,nome,sku,preco,unidade,categoria,img_url,qntd,nome_variacao,criado_em,atualizado_em, variacoes_produto(id,nome,sku,valor,qntd,img_url)').order('criado_em', { ascending: false });
      if (data) setProdutos(data.map((p: any) => ({
        id: p.id,
        nome: p.nome,
        sku: p.sku,
        preco: Number(p.preco),
        unidade: p.unidade || 'un',
        categoria: p.categoria || '',
        imagemUrl: p.img_url || undefined,
        variacoes: (p.variacoes_produto || []).map((v: any) => ({ id: v.id, nome: v.nome, sku: v.sku, valor: Number(v.valor), qntd: v.qntd ?? 0, img_url: v.img_url || null })),
        nomeVariacao: p.nome_variacao || null,
        qntd: p.qntd ?? 0,
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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estoque</h1>
          <p className="text-muted-foreground">
            {filteredProdutos.length} produtos cadastrados
          </p>
        </div>
  <Button className="bg-purple-600 hover:bg-purple-700" onClick={()=>{ setEditingProduct(null); setShowNewProduct(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Métricas resumidas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-purple-600" />
          </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{produtos.length}</div>
                  <p className="text-xs text-muted-foreground">produtos ativos</p>
                </>
              )}
            </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorias</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {new Set(produtos.map(p => p.categoria)).size}
                </div>
                <p className="text-xs text-muted-foreground">categorias diferentes</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Médio</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  R$ {produtos.length > 0 ? (produtos.reduce((acc, p) => acc + p.preco, 0) / produtos.length).toFixed(2) : '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">preço médio</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtros e busca */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtrar
            </Button>
          </div>
        </CardHeader>
      </Card>

  <ProductForm open={showNewProduct} onClose={handleModalClose} product={editingProduct} />

      {/* Tabela de produtos */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead className="text-right">Ações</TableHead>
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
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center overflow-hidden">
                            {produto.imagemUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={produto.imagemUrl} alt={produto.nome} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="h-5 w-5 text-purple-600" />
                            )}
                          </div>
                      <div>
                        <div className="font-medium">{produto.nome}</div>
                        <div className="text-sm text-muted-foreground">
                          Criado em {new Date(produto.criadoEm).toLocaleDateString('pt-BR')}
                        </div>
                        {produto.variacoes && produto.variacoes.length > 0 && (
                          <div className="text-sm mt-1">
                            <strong>{produto.nomeVariacao || 'Variação'}:</strong> {` ${produto.variacoes[0].nome} - `}
                            <span className="font-mono">SKU: {produto.variacoes[0].sku}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {produto.sku}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {produto.categoria}
                    </Badge>
                  </TableCell>
                  <TableCell>{produto.unidade}</TableCell>
                  <TableCell className="font-medium">
                    R$ {produto.preco.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => { setEditingProduct(produto); setShowNewProduct(true); }}>
                        Editar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}