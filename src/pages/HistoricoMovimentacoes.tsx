import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Download, Calendar, User, FileText, Package, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buscarHistoricoMovimentacoes, type HistoricoMovimentacao } from "@/lib/historicoMovimentacoes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function HistoricoMovimentacoes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [movimentacoes, setMovimentacoes] = useState<HistoricoMovimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredMovimentacoes, setFilteredMovimentacoes] = useState<HistoricoMovimentacao[]>([]);
  const { toast } = useToast();

  const carregarMovimentacoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await buscarHistoricoMovimentacoes({ limit: 100 });
      
      if (error) {
        toast({
          title: "Erro ao carregar movimentações",
          description: "Não foi possível carregar o histórico de movimentações",
          variant: "destructive"
        });
        return;
      }

      setMovimentacoes(data || []);
      setFilteredMovimentacoes(data || []);
    } catch (error) {
      console.error("Erro ao carregar movimentações:", error);
      toast({
        title: "Erro ao carregar movimentações",
        description: "Ocorreu um erro inesperado",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarMovimentacoes();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredMovimentacoes(movimentacoes);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = movimentacoes.filter((mov) => {
      return (
        mov.alteracao?.toLowerCase().includes(term) ||
        mov.usuario?.nome?.toLowerCase().includes(term) ||
        mov.usuario?.email?.toLowerCase().includes(term) ||
        mov.pedido?.id_externo?.toLowerCase().includes(term)
      );
    });

    setFilteredMovimentacoes(filtered);
  }, [searchTerm, movimentacoes]);

  const exportarCSV = () => {
    const headers = ['Data/Hora', 'Usuário', 'Pedido', 'Alteração'];
    const rows = filteredMovimentacoes.map(mov => [
      format(new Date(mov.created_at), 'dd/MM/yyyy HH:mm:ss'),
      mov.usuario?.nome || 'Sistema',
      mov.pedido?.id_externo || '-',
      mov.alteracao || '-'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historico_movimentacoes_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`;
    link.click();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Histórico de Movimentações</h1>
          <p className="text-muted-foreground">
            Visualize e acompanhe todas as movimentações de pedidos do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={carregarMovimentacoes}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportarCSV} disabled={filteredMovimentacoes.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Movimentações</CardTitle>
          <CardDescription>
            Pesquise por alteração, usuário ou ID do pedido
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar movimentações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {searchTerm && (
            <p className="text-sm text-muted-foreground mt-2">
              {filteredMovimentacoes.length} resultado(s) encontrado(s)
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimentações Recentes</CardTitle>
          <CardDescription>
            {filteredMovimentacoes.length} movimentação(ões) registrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredMovimentacoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Nenhuma movimentação encontrada</p>
              <p className="text-sm mt-2">
                As movimentações aparecerão aqui conforme forem registradas
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">
                      <Calendar className="h-4 w-4 inline mr-1" />
                      Data/Hora
                    </TableHead>
                    <TableHead>
                      <User className="h-4 w-4 inline mr-1" />
                      Usuário
                    </TableHead>
                    <TableHead>
                      <FileText className="h-4 w-4 inline mr-1" />
                      Pedido
                    </TableHead>
                    <TableHead>Alteração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovimentacoes.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(mov.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={mov.usuario?.img_url} />
                            <AvatarFallback className="bg-custom-100 text-custom-700 text-xs">
                              {mov.usuario?.nome?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'BD'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">{mov.usuario?.nome || 'Automático do Banco de Dados'}</span>
                            {mov.usuario?.email ? (
                              <span className="text-xs text-muted-foreground">{mov.usuario.email}</span>
                            ) : !mov.usuario && (
                              <span className="text-xs text-muted-foreground italic">Ação automática via trigger</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {mov.pedido?.id_externo ? (
                          <Badge variant="outline">{mov.pedido.id_externo}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <span className="text-sm">{mov.alteracao}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
