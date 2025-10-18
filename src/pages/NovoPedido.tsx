import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockProdutos, mockStatus } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

export default function NovoPedido() {
  const navigate = useNavigate();
  const [idExterno, setIdExterno] = useState('');
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [plataforma, setPlataforma] = useState('');
  const [status, setStatus] = useState(mockStatus[0]?.id || '');
  const [plataformas, setPlataformas] = useState<any[]>([]);
  const [loadingPlataformas, setLoadingPlataformas] = useState(false);
  const [plataformasError, setPlataformasError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<any[]>([]);

  const produtos = mockProdutos.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase()));

  const addToCart = (produto: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === produto.id);
      if (existing) return prev.map((i) => (i.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      return [...prev, { ...produto, quantidade: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));

  const total = cart.reduce((s, it) => s + it.preco * it.quantidade, 0);

  useEffect(() => {
    let mounted = true;
    const loadPlataformas = async () => {
      setLoadingPlataformas(true);
      setPlataformasError(null);
      try {
        const { data, error } = await supabase.from('plataformas').select('*').order('nome');
        if (error) throw error;
        if (!mounted) return;
        setPlataformas(data || []);
        if (!plataforma && data && data.length) setPlataforma(data[0].id);
      } catch (err: any) {
        console.error('Erro ao carregar plataformas:', err);
        setPlataformasError(err?.message || String(err));
      } finally {
        setLoadingPlataformas(false);
      }
    };

    loadPlataformas();
    return () => { mounted = false };
  }, []);

  return (
    <>
      <AppHeader activeModule="comercial" onModuleChange={(m) => navigate('/?module=' + m)} />

      <main className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
              <button onClick={() => navigate('/?module=comercial')} className="text-sm text-muted-foreground hover:underline">&lt; Ver todos os pedidos</button>
              <h1 className="text-2xl font-bold">Novo Pedido</h1>
            </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/?module=comercial')}>Cancelar</Button>
            <Button className="bg-purple-700 text-white">+ Criar Pedido</Button>
          </div>
        </div>

        <Card>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="text-sm">ID do Pedido</label>
                <Input value={idExterno} onChange={(e) => setIdExterno(e.target.value)} />
              </div>

              <div>
                <label className="text-sm">Nome</label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>

              <div>
                <label className="text-sm">Contato</label>
                <Input value={contato} onChange={(e) => setContato(e.target.value)} />
              </div>

              <div>
                <label className="text-sm">Plataforma de venda</label>
                <select className="w-full border rounded p-2" value={plataforma} onChange={(e) => setPlataforma(e.target.value)}>
                  {loadingPlataformas ? (
                    <option>Carregando...</option>
                  ) : plataformasError ? (
                    <option>Erro ao carregar</option>
                  ) : (
                    plataformas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm">Transportadora</label>
                <select className="w-full border rounded p-2">
                  <option>Não definido</option>
                </select>
              </div>

              <div>
                <label className="text-sm">Status Almofada</label>
                <select className="w-full border rounded p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {mockStatus.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="mb-4">
              <Input placeholder="Buscar produto" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="space-y-4">
              {produtos.map((p) => (
                <div key={p.id} className="flex items-center gap-4">
                  <img src={p.imagemUrl} alt={p.nome} className="w-12 h-12 rounded" />
                  <div className="flex-1">
                    <div className="font-medium text-purple-700">{p.nome}</div>
                    <div className="text-sm text-muted-foreground">R$ {p.preco.toFixed(2)}</div>
                  </div>
                  <div>
                    <Button onClick={() => addToCart(p)} className="bg-purple-600 text-white">
                      +
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>
                  ITENS DO CARRINHO <span className="text-sm text-muted-foreground">{cart.length} <span>R$ {total.toFixed(2)}</span></span>
                </CardTitle>
              </CardHeader>

              <CardContent>
                <Table>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img src={item.imagemUrl} className="w-10 h-10 rounded" />
                            <div>
                              <div className="font-medium">{item.nome}</div>
                              <div className="text-sm text-muted-foreground">R$ {item.preco.toFixed(2)}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{item.quantidade}</TableCell>
                        <TableCell>R$ {(item.preco * item.quantidade).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" onClick={() => removeFromCart(item.id)}>
                            🗑️
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
