import { useState, useEffect, useRef, Fragment } from 'react';
import { Settings, Users, Tag, Palette, Building, Lock, Trash, GripVertical, Plus, ChevronDown, CreditCard, AlertCircle, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockUsuarios, mockStatus, mockPlataformas } from '@/data/mockData';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Download, Calendar, User, FileText, Package, RefreshCw } from 'lucide-react';
import { buscarHistoricoMovimentacoes, type HistoricoMovimentacao } from '@/lib/historicoMovimentacoes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { CardDescription } from '@/components/ui/card';

// Componente de Histórico
function HistoricoTab() {
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
      mov.usuario?.nome || 'Automático do Banco de Dados',
      mov.pedido?.id_externo || '-',
      mov.alteracao || '-'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historico_movimentacoes_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Histórico de Movimentações</CardTitle>
              <CardDescription>Visualize e acompanhe todas as movimentações de pedidos do sistema</CardDescription>
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
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
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
            <p className="text-sm text-muted-foreground mb-4">
              {filteredMovimentacoes.length} resultado(s) encontrado(s)
            </p>
          )}
          
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
                          <span className="font-medium">{mov.usuario?.nome || 'Automático do Banco de Dados'}</span>
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

export function Configuracoes() {
  const [darkMode, setDarkMode] = useState(() => {
    // Load dark mode preference from localStorage
    const stored = localStorage.getItem('darkMode');
    return stored === 'true';
  });
  const { toast } = useToast();
  const { empresaId, user: currentUser, permissoes, hasPermissao, isLoading } = useAuth();

  // permissões por usuário (dialog)
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [permDialogUsuarioId, setPermDialogUsuarioId] = useState<string | undefined>(undefined);
  const [permDialogUsuarioNome, setPermDialogUsuarioNome] = useState<string>('');
  const [dialogPerms, setDialogPerms] = useState<Array<{ permissao_id: number; permissao_nome: string; categoria_permissao_id?: number; nome_categoria?: string; tem_permissao?: boolean }>>([]);
  const [loadingDialogPerms, setLoadingDialogPerms] = useState(false);
  const [dialogSearch, setDialogSearch] = useState('');
  const [dialogCategoriaFilter, setDialogCategoriaFilter] = useState<number | null>(null);
  const [dialogPage, setDialogPage] = useState<number>(1);
  const [dialogPageSize] = useState<number>(5);

  const fetchPermissoesVinculadas = async (usuarioId?: string) => {
    if (!usuarioId) return;
    setLoadingDialogPerms(true);
    try {
      let q = supabase.from('permissoes_vinculadas').select('permissao_id, permissao_nome, categoria_permissao_id, nome_categoria, tem_permissao').eq('usuario_id', usuarioId).order('permissao_nome', { ascending: true });
      if (dialogCategoriaFilter) q = q.eq('categoria_permissao_id', dialogCategoriaFilter);
      if (dialogSearch) q = q.ilike('permissao_nome', `%${dialogSearch}%`);
      const { data, error } = await q;
      if (error) throw error;
      setDialogPerms((data ?? []) as any);
      setDialogPage(1);
    } catch (err) {
      console.error('Erro ao carregar permissoes vinculadas:', err);
      toast({ title: 'Erro', description: 'Não foi possível carregar permissões vinculadas', variant: 'destructive' });
      setDialogPerms([]);
    } finally {
      setLoadingDialogPerms(false);
    }
  };

  useEffect(() => {
    if (!permDialogOpen || !permDialogUsuarioId) return;
    fetchPermissoesVinculadas(permDialogUsuarioId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permDialogOpen, permDialogUsuarioId, dialogCategoriaFilter, dialogSearch]);

  // Apply dark mode to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  // new user modal state
  const [openNewUser, setOpenNewUser] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPapel, setNewPapel] = useState<string>('');
  const [predefPapels, setPredefPapels] = useState<Array<{ id: number; nome: string }>>([]);
  const [loadingPredefPapels, setLoadingPredefPapels] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const newFileInputRef = useRef<HTMLInputElement | null>(null);
  // users list state
  type Usuario = { id?: string; nome: string; email?: string; acesso_id?: number | null; acesso_nome?: string | null; ativo?: boolean; img_url?: string };
  const [users, setUsers] = useState<Usuario[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  // edit user state
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | undefined>(undefined);
  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPapel, setEditPapel] = useState<string>('');
  const [editAtivo, setEditAtivo] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editFile, setEditFile] = useState<File | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  // delete user state
  const [deleteUserId, setDeleteUserId] = useState<string | undefined>(undefined);
  const [deleteUserName, setDeleteUserName] = useState('');
  const [deleting, setDeleting] = useState(false);

  // helper to upload a user's image to Supabase Storage and return public URL
  const uploadUserImage = async (file: File, userId: string) => {
    try {
      // create filename with timestamp to avoid collisions
      const parts = file.name.split('.');
      const ext = parts.length > 1 ? parts.pop() : 'jpg';
      const filename = `${Date.now()}.${ext}`;
      const path = `Fotos/${userId}/${filename}`;

      const { error: uploadErr } = await supabase.storage.from('Usuarios').upload(path, file, { upsert: true });
      if (uploadErr) {
        console.error('Erro upload imagem:', uploadErr);
        return null;
      }

      // get public URL (supabase v2 returns data.publicUrl)
      const pub = supabase.storage.from('Usuarios').getPublicUrl(path as string) as any;
      const publicUrl = pub?.data?.publicUrl ?? pub?.publicUrl ?? null;
      return publicUrl;
    } catch (err) {
      console.error('Erro ao enviar imagem:', err);
      return null;
    }
  };

  // helper: create object URL for preview and revoke previous if any
  const createPreviewUrl = (file: File | null) => {
    if (!file) return null;
    try {
      return URL.createObjectURL(file);
    } catch (err) {
      return null;
    }
  };

  const fetchUsuarios = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      // Use the view usuarios_completos which returns acesso_nome junto com acesso_id
      const { data, error } = await supabase
        .from('usuarios_completos')
        .select('user_id, nome, email, acesso_id, acesso_nome, ativo, img_url')
        .order('nome', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Array<any>;
      const mapped = rows.map((r) => ({ id: r.user_id ?? r.id, nome: r.nome, email: r.email, acesso_id: r.acesso_id ?? null, acesso_nome: r.acesso_nome ?? null, ativo: r.ativo, img_url: r.img_url }));
      setUsers(mapped as Usuario[]);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      setUsersError(String(err));
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // statuses state
  type Status = { id?: string; nome: string; cor_hex: string; ordem: number };
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [statusesError, setStatusesError] = useState<string | null>(null);

  const fetchStatuses = async () => {
    setLoadingStatuses(true);
    setStatusesError(null);
    try {
      const { data, error } = await supabase.from('status').select('id, nome, cor_hex, ordem').order('ordem', { ascending: true });
      if (error) throw error;
      setStatuses((data ?? []) as Status[]);
    } catch (err) {
      console.error('Erro ao buscar status:', err);
      setStatusesError(String(err));
      setStatuses([]);
    } finally {
      setLoadingStatuses(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // create status modal state
  const [createStatusOpen, setCreateStatusOpen] = useState(false);
  const [createNome, setCreateNome] = useState('');
  const [createCor, setCreateCor] = useState('#000000');
  const [createOrdem, setCreateOrdem] = useState<number>(1);
  const [creatingStatus, setCreatingStatus] = useState(false);

  // edit status dialog state
  const [editStatusOpen, setEditStatusOpen] = useState(false);
  const [editStatusId, setEditStatusId] = useState<string | undefined>(undefined);
  const [editStatusNome, setEditStatusNome] = useState('');
  const [editStatusCor, setEditStatusCor] = useState('#000000');
  const [editStatusOrdem, setEditStatusOrdem] = useState<number>(1);
  const [editingStatus, setEditingStatus] = useState(false);

  // plataformas state
  type Plataforma = { id?: string; nome: string; cor: string; img_url?: string };
  const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
  const [loadingPlataformas, setLoadingPlataformas] = useState(false);
  const [plataformasError, setPlataformasError] = useState<string | null>(null);

  const fetchPlataformas = async () => {
    setLoadingPlataformas(true);
    setPlataformasError(null);
    try {
      const { data, error } = await supabase.from('plataformas').select('id, nome, cor, img_url').order('nome', { ascending: true });
      if (error) throw error;
      setPlataformas((data ?? []) as Plataforma[]);
    } catch (err) {
      console.error('Erro ao buscar plataformas:', err);
      setPlataformasError(String(err));
      setPlataformas([]);
    } finally {
      setLoadingPlataformas(false);
    }
  };

  useEffect(() => {
    fetchPlataformas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPredefPapels = async () => {
    setLoadingPredefPapels(true);
    try {
      const { data, error } = await supabase
        .from('predefinicoes_permissoes')
        .select('id, nome')
        .order('nome', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Array<{ id: number; nome: string }>;
      setPredefPapels(rows);
      if (rows.length > 0 && !newPapel) setNewPapel(String(rows[0].id));
    } catch (err) {
      console.error('Erro ao carregar predefinicoes_permissoes:', err);
      setPredefPapels([]);
    } finally {
      setLoadingPredefPapels(false);
    }
  };

  useEffect(() => {
    fetchPredefPapels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // categorias de permissoes (para dropdown de filtro)
  const [categoriasPermissoes, setCategoriasPermissoes] = useState<Array<{ id: number; categoria_nome: string }>>([]);
  const [loadingCategoriasPermissoes, setLoadingCategoriasPermissoes] = useState(false);
  const [selectedCategoriaPermissao, setSelectedCategoriaPermissao] = useState<number | null>(null);

  // permissões lista principal
  const [permissoesList, setPermissoesList] = useState<Array<{ id: number; permissao_nome: string; categoria_permissao_id?: number }>>([]);
  const [loadingPermissoes, setLoadingPermissoes] = useState(false);

  const fetchPermissoes = async () => {
    setLoadingPermissoes(true);
    try {
      const { data, error } = await supabase
        .from('permissoes')
        .select('id, permissao_nome, categoria_permissao_id')
        .order('permissao_nome', { ascending: true });
      if (error) throw error;
      setPermissoesList((data ?? []) as Array<{ id: number; permissao_nome: string; categoria_permissao_id?: number }>);
    } catch (err) {
      console.error('Erro ao carregar permissoes:', err);
      setPermissoesList([]);
    } finally {
      setLoadingPermissoes(false);
    }
  };

  useEffect(() => {
    fetchPermissoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCategoriasPermissoes = async () => {
    setLoadingCategoriasPermissoes(true);
    try {
      const { data, error } = await supabase
        .from('categorias_permissoes')
        .select('id, categoria_nome')
        .order('categoria_nome', { ascending: true });
      if (error) throw error;
      setCategoriasPermissoes((data ?? []) as Array<{ id: number; categoria_nome: string }>);
    } catch (err) {
      console.error('Erro ao carregar categorias_permissoes:', err);
      setCategoriasPermissoes([]);
    } finally {
      setLoadingCategoriasPermissoes(false);
    }
  };

  useEffect(() => {
    fetchCategoriasPermissoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // predefinições de permissões (popup)
  const [predefOpen, setPredefOpen] = useState(false);
  const [predefinicoes, setPredefinicoes] = useState<Array<{ id: number; nome: string }>>([]);
  const [loadingPredefinicoes, setLoadingPredefinicoes] = useState(false);
  const [selectedPredef, setSelectedPredef] = useState<number | null>(null);
  const [predefPermissoes, setPredefPermissoes] = useState<Array<{ id: number; permissao_nome: string }>>([]);
  const [loadingPredefPermissoes, setLoadingPredefPermissoes] = useState(false);

  const fetchPredefinicoes = async () => {
    setLoadingPredefinicoes(true);
    try {
      // A view vw_ass_predefinicao_perm_completo traz linhas (predefinicao_id, nome, permissao_id, permissao_nome)
      // Buscamos todas as linhas e deduplicamos as predefinicoes pelo id no cliente.
      const { data, error } = await supabase
        .from('vw_ass_predefinicao_perm_completo')
        .select('predefinicao_id, nome')
        .order('nome', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Array<{ predefinicao_id: number; nome: string }>;
      const map = new Map<number, string>();
      rows.forEach((r) => {
        const id = Number((r as any).predefinicao_id);
        if (!map.has(id)) map.set(id, (r as any).nome ?? '');
      });
      const dedup = Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
      setPredefinicoes(dedup);
    } catch (err) {
      console.error('Erro ao carregar predefinicoes:', err);
      setPredefinicoes([]);
    } finally {
      setLoadingPredefinicoes(false);
    }
  };

  const fetchPredefPermissoes = async (predefId: number) => {
    setLoadingPredefPermissoes(true);
    try {
      // Agora usamos a view vw_ass_predefinicao_perm_completo para buscar as permissões
      const { data, error } = await supabase
        .from('vw_ass_predefinicao_perm_completo')
        .select('permissao_id, permissao_nome')
        .eq('predefinicao_id', predefId)
        .order('permissao_nome', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Array<{ permissao_id: number; permissao_nome: string }>;
      const perms = rows.map((r) => ({ id: Number((r as any).permissao_id), permissao_nome: (r as any).permissao_nome }));
      setPredefPermissoes(perms);
    } catch (err) {
      console.error('Erro ao carregar permissoes da predefinicao:', err);
      setPredefPermissoes([]);
    } finally {
      setLoadingPredefPermissoes(false);
    }
  };

  useEffect(() => {
    if (!predefOpen) return;
    fetchPredefinicoes();
    setSelectedPredef(null);
    setPredefPermissoes([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predefOpen]);

  // create plataforma state
  const [createPlataformaOpen, setCreatePlataformaOpen] = useState(false);
  const [createPlataformaNome, setCreatePlataformaNome] = useState('');
  const [createPlataformaCor, setCreatePlataformaCor] = useState('#000000');
  const [createPlataformaFile, setCreatePlataformaFile] = useState<File | null>(null);
  const createPlataformaFileInputRef = useRef<HTMLInputElement | null>(null);
  const [creatingPlataforma, setCreatingPlataforma] = useState(false);

  // edit plataforma state
  const [editPlataformaOpen, setEditPlataformaOpen] = useState(false);
  const [editPlataformaId, setEditPlataformaId] = useState<string | undefined>(undefined);
  const [editPlataformaNome, setEditPlataformaNome] = useState('');
  const [editPlataformaCor, setEditPlataformaCor] = useState('#000000');
  const [editPlataformaFile, setEditPlataformaFile] = useState<File | null>(null);
  const editPlataformaFileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingPlataforma, setEditingPlataforma] = useState(false);

  // delete plataforma state
  const [deletePlataformaId, setDeletePlataformaId] = useState<string | undefined>(undefined);
  const [deletePlataformaNome, setDeletePlataformaNome] = useState('');
  const [deletingPlataforma, setDeletingPlataforma] = useState(false);

  // setores state
  type Setor = { id: string; nome: string; rota: string; ordem: number };
  const [setores, setSetores] = useState<Setor[]>([]);
  const [editOrderMode, setEditOrderMode] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // create/edit setor state removed (UI no longer supports create/edit/delete)

  // Load setores from localStorage
  const loadSetores = () => {
    try {
      const stored = localStorage.getItem('setores');
      if (stored) {
        const parsed = JSON.parse(stored) as Setor[];
        
        let needsSave = false;
        
        // Migração: garantir que contabilidade existe
        const hasContabilidade = parsed.some(s => s.id === 'contabilidade');
        if (!hasContabilidade) {
          // Adicionar contabilidade entre logística e estoque
          const logisticaIndex = parsed.findIndex(s => s.id === 'logistica');
          if (logisticaIndex !== -1) {
            parsed.splice(logisticaIndex + 1, 0, {
              id: 'contabilidade',
              nome: 'Contabilidade',
              rota: '/contabilidade',
              ordem: logisticaIndex + 1
            });
            needsSave = true;
          }
        }
        
        // Migração: garantir que historico-movimentacoes existe
        const hasHistorico = parsed.some(s => s.id === 'historico-movimentacoes');
        if (!hasHistorico) {
          // Adicionar histórico antes de configurações
          const configIndex = parsed.findIndex(s => s.id === 'configuracoes');
          if (configIndex !== -1) {
            parsed.splice(configIndex, 0, {
              id: 'historico-movimentacoes',
              nome: 'Histórico de Movimentações',
              rota: '/historico-movimentacoes',
              ordem: configIndex
            });
            needsSave = true;
          }
        }
        
        if (needsSave) {
          // Reordenar todos após as inserções
          parsed.forEach((s, idx) => {
            s.ordem = idx;
          });
          // Salvar a versão migrada
          localStorage.setItem('setores', JSON.stringify(parsed));
          setSetores(parsed);
          window.dispatchEvent(new Event('setores-updated'));
          return;
        }
        
        setSetores(parsed.sort((a, b) => a.ordem - b.ordem));
      } else {
        // Default setores
        const defaultSetores: Setor[] = [
          { id: 'home', nome: 'Home', rota: '/', ordem: 0 },
          { id: 'comercial', nome: 'Comercial', rota: '/comercial', ordem: 1 },
          { id: 'producao', nome: 'Produção', rota: '/producao', ordem: 2 },
          { id: 'logistica', nome: 'Logística', rota: '/logistica', ordem: 3 },
          { id: 'estoque', nome: 'Estoque', rota: '/estoque', ordem: 4 },
          { id: 'contabilidade', nome: 'Contabilidade', rota: '/contabilidade', ordem: 5 },
          { id: 'historico-movimentacoes', nome: 'Histórico de Movimentações', rota: '/historico-movimentacoes', ordem: 6 },
          { id: 'configuracoes', nome: 'Configurações', rota: '/configuracoes', ordem: 7 },
        ];
        setSetores(defaultSetores);
        localStorage.setItem('setores', JSON.stringify(defaultSetores));
      }
    } catch (err) {
      console.error('Erro ao carregar setores:', err);
    }
  };

  // Save setores to localStorage
  const saveSetores = (newSetores: Setor[]) => {
    try {
      localStorage.setItem('setores', JSON.stringify(newSetores));
      setSetores(newSetores);
      // Dispatch custom event to update header in same tab
      window.dispatchEvent(new Event('setores-updated'));
      toast({ title: 'Setores salvos com sucesso' });
    } catch (err) {
      console.error('Erro ao salvar setores:', err);
      toast({ title: 'Erro ao salvar setores', variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadSetores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSetores = [...setores];
    const draggedItem = newSetores[draggedIndex];
    newSetores.splice(draggedIndex, 1);
    newSetores.splice(index, 0, draggedItem);

    // Update ordem
    newSetores.forEach((setor, idx) => {
      setor.ordem = idx;
    });

    setSetores(newSetores);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null) {
      saveSetores(setores);
    }
    setDraggedIndex(null);
  };

  // empresas state
  type Empresa = { id?: number; nome: string; cnpj?: string; cor?: string; logo?: string; cores_hsl?: Record<string, string> | null };
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [empresasError, setEmpresasError] = useState<string | null>(null);

  const fetchEmpresas = async () => {
    setLoadingEmpresas(true);
    setEmpresasError(null);
    try {
      const { data, error } = await supabase.from('empresas').select('id, nome, cnpj, cor, logo, cores_hsl').order('nome', { ascending: true });
      if (error) throw error;
      setEmpresas((data ?? []) as Empresa[]);
    } catch (err) {
      console.error('Erro ao buscar empresas:', err);
      setEmpresasError(String(err));
      setEmpresas([]);
    } finally {
      setLoadingEmpresas(false);
    }
  };

  useEffect(() => {
    fetchEmpresas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // create empresa state
  const [createEmpresaOpen, setCreateEmpresaOpen] = useState(false);
  const [createEmpresaNome, setCreateEmpresaNome] = useState('');
  const [createEmpresaCnpj, setCreateEmpresaCnpj] = useState('');
  const [createEmpresaCor, setCreateEmpresaCor] = useState('#6366f1');
  const [createEmpresaFile, setCreateEmpresaFile] = useState<File | null>(null);
  const createEmpresaFileInputRef = useRef<HTMLInputElement | null>(null);
  const [creatingEmpresa, setCreatingEmpresa] = useState(false);

  // edit empresa state
  const [editEmpresaOpen, setEditEmpresaOpen] = useState(false);
  const [editEmpresaId, setEditEmpresaId] = useState<number | undefined>(undefined);
  const [editEmpresaNome, setEditEmpresaNome] = useState('');
  const [editEmpresaCnpj, setEditEmpresaCnpj] = useState('');
  const [editEmpresaCor, setEditEmpresaCor] = useState('#6366f1');
  const [editEmpresaFile, setEditEmpresaFile] = useState<File | null>(null);
  const editEmpresaFileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingEmpresa, setEditingEmpresa] = useState(false);

  // helper to format CNPJ with mask
  const formatCNPJ = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Limit to 14 digits
    const limited = digits.slice(0, 14);
    
    // Apply mask: 00.000.000/0000-00
    if (limited.length <= 2) {
      return limited;
    } else if (limited.length <= 5) {
      return `${limited.slice(0, 2)}.${limited.slice(2)}`;
    } else if (limited.length <= 8) {
      return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5)}`;
    } else if (limited.length <= 12) {
      return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8)}`;
    } else {
      return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8, 12)}-${limited.slice(12)}`;
    }
  };

  // helper to generate color palette from a base color (custom-600) for both light and dark modes
  const generateColorPalette = (hexColor: string) => {
    // Convert hex to RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    // Convert RGB to HSL
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    // Convert to degrees and percentages
    const hue = Math.round(h * 360);
    const saturation = Math.round(s * 100);
    const lightness = Math.round(l * 100);

    // Generate palette variations for LIGHT MODE
    const light = {
      'custom-50': `${hue} ${Math.max(saturation - 5, 20)}% 98%`,
      'custom-100': `${hue} ${Math.max(saturation - 10, 20)}% 95%`,
      'custom-200': `${hue} ${Math.max(saturation - 15, 20)}% 92%`,
      'custom-300': `${hue} ${Math.max(saturation - 18, 20)}% 80%`,
      'custom-400': `${hue} ${Math.max(saturation - 10, 20)}% 60%`,
      'custom-500': `${hue} ${saturation}% ${Math.min(lightness + 6, 50)}%`,
      'custom-600': `${hue} ${saturation}% ${lightness}%`,
      'custom-700': `${hue} ${Math.max(saturation - 2, 20)}% ${Math.max(lightness - 5, 25)}%`,
      'custom-800': `${hue} ${Math.max(saturation - 6, 20)}% ${Math.max(lightness - 10, 20)}%`,
      'custom-900': `${hue} ${Math.max(saturation - 8, 20)}% ${Math.max(lightness - 16, 15)}%`,
    };

    // Generate palette variations for DARK MODE
    // In dark mode, lighter shades (50-400) should be darker, while darker shades stay similar
    const dark = {
      'custom-50': `${hue} ${Math.max(saturation - 5, 20)}% 8%`,
      'custom-100': `${hue} ${Math.max(saturation - 10, 20)}% 12%`,
      'custom-200': `${hue} ${Math.max(saturation - 15, 20)}% 18%`,
      'custom-300': `${hue} ${Math.max(saturation - 18, 20)}% 30%`,
      'custom-400': `${hue} ${Math.max(saturation - 10, 20)}% 45%`,
      'custom-500': `${hue} ${saturation}% ${Math.min(lightness + 6, 50)}%`,
      'custom-600': `${hue} ${saturation}% ${lightness}%`,
      'custom-700': `${hue} ${Math.max(saturation - 2, 20)}% ${Math.max(lightness - 5, 25)}%`,
      'custom-800': `${hue} ${Math.max(saturation - 6, 20)}% ${Math.max(lightness - 10, 20)}%`,
      'custom-900': `${hue} ${Math.max(saturation - 8, 20)}% ${Math.max(lightness - 16, 15)}%`,
    };

    return { light, dark };
  };

  // helper to upload empresa logo
  const uploadEmpresaLogo = async (file: File, empresaId: number) => {
    try {
      const parts = file.name.split('.');
      const ext = parts.length > 1 ? parts.pop() : 'jpg';
      const filename = `${Date.now()}.${ext}`;
      const path = `Empresas/${empresaId}/${filename}`;

      const { error: uploadErr } = await supabase.storage.from('Usuarios').upload(path, file, { upsert: true });
      if (uploadErr) {
        console.error('Erro upload logo:', uploadErr);
        return null;
      }

      const pub = supabase.storage.from('Usuarios').getPublicUrl(path as string) as any;
      const publicUrl = pub?.data?.publicUrl ?? pub?.publicUrl ?? null;
      return publicUrl;
    } catch (err) {
      console.error('Erro ao enviar logo:', err);
      return null;
    }
  };

  // helper to upload plataforma image
  const uploadPlataformaImage = async (file: File, plataformaId: string) => {
    try {
      const parts = file.name.split('.');
      const ext = parts.length > 1 ? parts.pop() : 'jpg';
      const filename = `${Date.now()}.${ext}`;
      const path = `Plataformas/${plataformaId}/${filename}`;

      const { error: uploadErr } = await supabase.storage.from('Usuarios').upload(path, file, { upsert: true });
      if (uploadErr) {
        console.error('Erro upload imagem:', uploadErr);
        return null;
      }

      const pub = supabase.storage.from('Usuarios').getPublicUrl(path as string) as any;
      const publicUrl = pub?.data?.publicUrl ?? pub?.publicUrl ?? null;
      return publicUrl;
    } catch (err) {
      console.error('Erro ao enviar imagem:', err);
      return null;
    }
  };

  // formas de pagamento state
  type FormaPagamento = { id?: string; nome: string; img_url?: string; created_at?: string };
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [loadingFormasPagamento, setLoadingFormasPagamento] = useState(false);
  const [formasPagamentoError, setFormasPagamentoError] = useState<string | null>(null);
  // grupos de formas de pagamento (fechados por padrão)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const fetchFormasPagamento = async () => {
    setLoadingFormasPagamento(true);
    setFormasPagamentoError(null);
    try {
      const { data, error } = await supabase
        .from('formas_pagamentos')
        .select('id, nome, img_url, created_at')
        .order('id', { ascending: true });
      if (error) throw error;
      setFormasPagamento((data ?? []) as FormaPagamento[]);
    } catch (err) {
      console.error('Erro ao buscar formas de pagamento:', err);
      setFormasPagamentoError(String(err));
      setFormasPagamento([]);
    } finally {
      setLoadingFormasPagamento(false);
    }
  };

  useEffect(() => {
    fetchFormasPagamento();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // create forma pagamento state
  const [createFormaPagamentoOpen, setCreateFormaPagamentoOpen] = useState(false);
  const [createFormaPagamentoNome, setCreateFormaPagamentoNome] = useState('');
  const [createFormaPagamentoFile, setCreateFormaPagamentoFile] = useState<File | null>(null);
  const createFormaPagamentoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [creatingFormaPagamento, setCreatingFormaPagamento] = useState(false);

  // edit forma pagamento state
  const [editFormaPagamentoOpen, setEditFormaPagamentoOpen] = useState(false);
  const [editFormaPagamentoId, setEditFormaPagamentoId] = useState<string | undefined>(undefined);
  const [editFormaPagamentoNome, setEditFormaPagamentoNome] = useState('');
  const [editFormaPagamentoFile, setEditFormaPagamentoFile] = useState<File | null>(null);
  const editFormaPagamentoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingFormaPagamento, setEditingFormaPagamento] = useState(false);

  // delete forma pagamento state
  const [deleteFormaPagamentoId, setDeleteFormaPagamentoId] = useState<string | undefined>(undefined);
  const [deleteFormaPagamentoNome, setDeleteFormaPagamentoNome] = useState('');
  const [deletingFormaPagamento, setDeletingFormaPagamento] = useState(false);

  // helper to upload forma pagamento image
  const uploadFormaPagamentoImage = async (file: File, formaPagamentoId: string) => {
    try {
      const parts = file.name.split('.');
      const ext = parts.length > 1 ? parts.pop() : 'jpg';
      const filename = `${Date.now()}.${ext}`;
      const path = `FormasPagamento/${formaPagamentoId}/${filename}`;

      const { error: uploadErr } = await supabase.storage.from('Usuarios').upload(path, file, { upsert: true });
      if (uploadErr) {
        console.error('Erro upload imagem:', uploadErr);
        return null;
      }

      const pub = supabase.storage.from('Usuarios').getPublicUrl(path as string) as any;
      const publicUrl = pub?.data?.publicUrl ?? pub?.publicUrl ?? null;
      return publicUrl;
    } catch (err) {
      console.error('Erro ao enviar imagem:', err);
      return null;
    }
  };

    const hasAccess = hasPermissao ? hasPermissao(59) : ((permissoes || []).includes(59));

    if (!isLoading && !hasAccess) {
      return (
        <div className="p-6">
          <Card className="w-[500px] justify-center mx-auto">
            <CardContent className="p-8 text-center">
              <AlertCircle className="mx-auto mb-4 text-red-600" />
              <h3 className="text-lg font-semibold">Você não tem permissão para acessar as configurações</h3>
              <p className="text-sm text-muted-foreground mt-2">Se você acha que deveria ter acesso, contate o administrador.</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    const canViewStatus = hasPermissao ? hasPermissao(49) : ((permissoes || []).includes(49));
    const canAccessFormas = hasPermissao ? hasPermissao(55) : ((permissoes || []).includes(55));
    const canAccessUsers = hasPermissao ? (hasPermissao(5) || hasPermissao(21)) : (((permissoes || []).includes(5) || (permissoes || []).includes(21)));
    const canAccessPreferencias = hasPermissao ? hasPermissao(13) : ((permissoes || []).includes(13));

    return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie usuários, status, plataformas e preferências do sistema
        </p>
      </div>

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="usuarios">
            <Users className="h-4 w-4 mr-2" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="status">
            <Tag className="h-4 w-4 mr-2" />
            Status
          </TabsTrigger>
          
          <TabsTrigger value="setores">
            <Settings className="h-4 w-4 mr-2" />
            Setores
          </TabsTrigger>
          <TabsTrigger value="formas-pagamento">
            <CreditCard className="h-4 w-4 mr-2" />
            Formas de Pagamentos
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="preferencias">
            <Palette className="h-4 w-4 mr-2" />
            Preferências
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          {!canAccessUsers ? (
            <Card className="w-[500px] justify-center mx-auto">
              <CardContent className="p-8 text-center">
                <AlertCircle className="mx-auto mb-4 text-red-600" />
                <h3 className="text-lg font-semibold">Você não tem permissão para gerenciar os usuários</h3>
                <p className="text-sm text-muted-foreground mt-2">Se você acha que deveria ter acesso, contate o administrador.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Usuários do Sistema</CardTitle>
                  <Dialog open={openNewUser} onOpenChange={setOpenNewUser}>
                    <DialogTrigger asChild>
                      <Button 
                        className="bg-custom-600 hover:bg-custom-700"
                        onClick={(e) => {
                          const canCreate = hasPermissao ? hasPermissao(4) : false;
                          if (!canCreate) {
                            e.preventDefault();
                            toast({ title: 'Você não tem permissão para isso', description: '', variant: 'destructive' });
                          }
                        }}
                      >
                        Novo Usuário
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Usuário</DialogTitle>
                        <DialogDescription>Crie uma nova conta de usuário. Será criada a autenticação e o registro em usuários será atualizado automaticamente quando possível.</DialogDescription>
                      </DialogHeader>

                      <div className="grid gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="novo-nome">Nome</Label>
                          <Input id="novo-nome" value={newNome} onChange={(e) => setNewNome(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="novo-email">Email</Label>
                          <Input id="novo-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="novo-senha">Senha</Label>
                          <Input id="novo-senha" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="novo-papel">Acesso</Label>
                          <select id="novo-papel" value={newPapel} onChange={(e) => setNewPapel(e.target.value)} className="border rounded px-2 py-1">
                            {loadingPredefPapels ? (
                              <option>Carregando...</option>
                            ) : predefPapels.length === 0 ? (
                              <option value="">Sem opções</option>
                            ) : (
                              predefPapels.map((p) => (
                                <option key={p.id} value={String(p.id)}>{p.nome}</option>
                              ))
                            )}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>Foto</Label>
                          <div
                            onClick={() => newFileInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const f = e.dataTransfer?.files?.[0];
                              if (f) setNewFile(f);
                            }}
                            className="w-full border-dashed border-2 rounded p-4 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                          >
                            {!newFile ? (
                              <div className="text-center text-sm text-muted-foreground">
                                Clique ou arraste uma imagem aqui para anexar
                              </div>
                            ) : (
                              <div className="flex items-center gap-4">
                                <img src={createPreviewUrl(newFile) ?? ''} alt="preview" className="w-24 h-24 object-cover rounded" />
                                <div className="flex flex-col gap-2">
                                  <Button variant="outline" onClick={(e) => { e.stopPropagation(); newFileInputRef.current?.click(); }}>Trocar</Button>
                                  <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setNewFile(null); }}>Remover</Button>
                                </div>
                              </div>
                            )}
                          </div>
                          <input ref={newFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setNewFile(e.target.files?.[0] ?? null)} />
                        </div>
                      </div>

                      <DialogFooter>
                        <div className="flex gap-2">
                          <Button variant="ghost" onClick={() => setOpenNewUser(false)}>Cancelar</Button>
                          <Button className="bg-custom-600 hover:bg-custom-700" onClick={async () => {
                            // create auth user then upsert into usuarios
                            try {
                              if (!newNome || !newEmail || !newPassword) {
                                toast({ title: 'Preencha todos os campos', variant: 'destructive' });
                                return;
                              }
                              setCreating(true);

                              // Salvar sessão atual antes de criar o novo usuário
                              const { data: { session: currentSession } } = await supabase.auth.getSession();

                              const { data, error } = await supabase.auth.signUp({ 
                                email: newEmail, 
                                password: newPassword, 
                                options: { 
                                  data: { nome: newNome },
                                  emailRedirectTo: window.location.origin
                                } 
                              });

                              if (error) {
                                toast({ title: 'Erro ao criar autenticação', description: error.message || String(error), variant: 'destructive' });
                                setCreating(false);
                                return;
                              }

                              // try to read created user id from response
                              type SignUpData = { user?: { id?: string } } | null;
                              const userId = (data as SignUpData)?.user?.id ?? null;

                              if (userId) {
                                // if an image was selected, upload it first
                                let imgUrl: string | null = null;
                                if (newFile) {
                                  imgUrl = await uploadUserImage(newFile, userId);
                                  if (!imgUrl) {
                                    toast({ title: 'Aviso', description: 'Imagem não pôde ser enviada. Usuário será criado sem foto.', variant: 'destructive' });
                                  }
                                }

                                // upsert into usuarios with same uuid
                                const selectedPapel = predefPapels.find(p => String(p.id) === String(newPapel));
                                const upsertObj: any = { id: userId, nome: newNome, email: newEmail, acesso_id: selectedPapel ? Number(selectedPapel.id) : null, ativo: true };
                                if (imgUrl) upsertObj.img_url = imgUrl;
                                if (empresaId) upsertObj.empresa_id = empresaId;
                                const { error: upsertErr } = await supabase.from('usuarios').upsert(upsertObj).select();
                                if (upsertErr) {
                                  toast({ title: 'Conta criada, mas erro ao registrar no sistema', description: upsertErr.message || String(upsertErr), variant: 'destructive' });
                                } else {
                                  toast({ title: 'Usuário criado', description: 'Autenticação criada e usuário registrado.' });
                                  await fetchUsuarios();
                                }
                              } else {
                                // fallback: insert without linking id — admin will need to reconcile
                                const selectedPapel2 = predefPapels.find(p => String(p.id) === String(newPapel));
                                const insertObj: any = { nome: newNome, email: newEmail, acesso_id: selectedPapel2 ? Number(selectedPapel2.id) : null, ativo: true };
                                if (empresaId) insertObj.empresa_id = empresaId;
                                const { error: insErr } = await supabase.from('usuarios').insert(insertObj).select();
                                if (insErr) {
                                  toast({ title: 'Erro ao inserir usuário', description: insErr.message || String(insErr), variant: 'destructive' });
                                } else {
                                  toast({ title: 'Autenticação criada', description: 'Conta criada. O usuário será registrado no sistema automaticamente após confirmação de email.' });
                                  await fetchUsuarios();
                                }
                              }

                              // Restaurar a sessão original (fazer logout do novo usuário e login do admin)
                              if (currentSession) {
                                await supabase.auth.setSession({
                                  access_token: currentSession.access_token,
                                  refresh_token: currentSession.refresh_token
                                });
                              }

                              // reset form and close
                              setNewNome(''); setNewEmail(''); setNewPassword(''); setNewPapel(''); setNewFile(null);
                              // refresh list (in case creation succeeded)
                              fetchUsuarios();
                              setOpenNewUser(false);
                            } catch (err) {
                              console.error('Erro criar usuário:', err);
                              toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                            } finally {
                              setCreating(false);
                            }
                          }} disabled={creating}>{creating ? 'Criando...' : 'Criar usuário'}</Button>
                        </div>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Acesso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingUsers ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-sm text-muted-foreground">Carregando usuários...</TableCell>
                      </TableRow>
                    ) : usersError ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-sm text-destructive">Erro: {usersError}</TableCell>
                      </TableRow>
                    ) : users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-sm text-muted-foreground">Nenhum usuário encontrado.</TableCell>
                      </TableRow>
                    ) : (
                      users.map((usuario) => (
                        <TableRow key={usuario.id ?? usuario.email ?? usuario.nome}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={usuario.img_url} alt={usuario.nome} />
                                <AvatarFallback>{usuario.nome.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span>{usuario.nome}</span>
                            </div>
                          </TableCell>
                          <TableCell>{usuario.email}</TableCell>
                          <TableCell>
                            <Badge variant={usuario.acesso_nome && String(usuario.acesso_nome).toLowerCase().includes('admin') ? 'default' : 'secondary'}>
                              {usuario.acesso_nome ?? 'Operador'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={usuario.ativo ? 'default' : 'secondary'}>
                              {usuario.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {(() => {
                                const canEdit = (currentUser?.id && usuario.id && currentUser.id === usuario.id) || (hasPermissao ? hasPermissao(5) : (permissoes ?? []).includes(5));
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (!canEdit) {
                                        toast({ title: 'Você não tem permissão para isso', description: '', variant: 'destructive' });
                                        return;
                                      }
                                      // open edit modal with user data
                                      setEditUserId(usuario.id);
                                      setEditNome(usuario.nome ?? '');
                                      setEditEmail(usuario.email ?? '');
                                      // set edit papel to acesso_id from view (or empty string)
                                      setEditPapel(String((usuario as any).acesso_id ?? ''));
                                      setEditAtivo(usuario.ativo ?? true);
                                      setEditOpen(true);
                                    }}
                                  >
                                    Editar
                                  </Button>
                                );
                              })()}
                              {(() => {
                                const canManagePerms = hasPermissao ? hasPermissao(21) : (permissoes ?? []).includes(21);
                                if (!canManagePerms) return null;
                                return (
                                  <Button variant="outline" size="sm" onClick={() => {
                                    setPermDialogUsuarioId(usuario.id);
                                    setPermDialogUsuarioNome(usuario.nome ?? '');
                                    setPermDialogOpen(true);
                                  }}>
                                    <Lock className="h-4 w-4" />
                                  </Button>
                                );
                              })()}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={(e) => {
                                    const canDelete = hasPermissao ? hasPermissao(6) : (permissoes ?? []).includes(6);
                                    if (!canDelete) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toast({ title: 'Você não tem permissão para isso', description: '', variant: 'destructive' });
                                      return;
                                    }
                                    setDeleteUserId(usuario.id);
                                    setDeleteUserName(usuario.nome);
                                  }}>
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja deletar o usuário <strong>{usuario.nome}</strong>? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive hover:bg-destructive/90"
                                      onClick={async () => {
                                        try {
                                          if (!usuario.id) {
                                            toast({ title: 'Erro', description: 'Usuário sem ID não pode ser deletado', variant: 'destructive' });
                                            return;
                                          }
                                          setDeleting(true);
                                          const { error } = await supabase.from('usuarios').delete().eq('id', usuario.id);
                                          if (error) {
                                            toast({ title: 'Erro ao deletar usuário', description: error.message || String(error), variant: 'destructive' });
                                          } else {
                                            toast({ title: 'Usuário deletado', description: `${usuario.nome} foi removido do sistema.` });
                                            await fetchUsuarios();
                                          }
                                        } catch (err) {
                                          console.error('Erro ao deletar usuário:', err);
                                          toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                                        } finally {
                                          setDeleting(false);
                                        }
                                      }}
                                      disabled={deleting}
                                    >
                                      {deleting ? 'Deletando...' : 'Deletar'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Edit status dialog */}
        <Dialog open={editStatusOpen} onOpenChange={setEditStatusOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Status</DialogTitle>
              <DialogDescription>Atualize nome, cor e ordem do status.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-status-nome">Nome</Label>
                <Input id="edit-status-nome" value={editStatusNome} onChange={(e) => setEditStatusNome(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-status-cor">Cor</Label>
                <div className="flex items-center gap-2">
                  <input id="edit-status-cor" type="color" value={editStatusCor} onChange={(e) => setEditStatusCor(e.target.value)} className="w-10 h-10 p-0 border-0" />
                  <Input value={editStatusCor} onChange={(e) => setEditStatusCor(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-status-ordem">Ordem</Label>
                <Input id="edit-status-ordem" type="number" value={String(editStatusOrdem)} onChange={(e) => setEditStatusOrdem(Number(e.target.value))} />
              </div>
            </div>

            <DialogFooter>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditStatusOpen(false)}>Cancelar</Button>
                <Button className="bg-custom-600 hover:bg-custom-700" onClick={async () => {
                  try {
                    if (!editStatusId) {
                      toast({ title: 'Erro', description: 'Status sem id não pode ser editado', variant: 'destructive' });
                      return;
                    }
                    setEditingStatus(true);
                    const { error } = await supabase.from('status').update({ nome: editStatusNome, cor_hex: editStatusCor, ordem: editStatusOrdem }).eq('id', editStatusId).select();
                    if (error) {
                      toast({ title: 'Erro ao atualizar status', description: error.message || String(error), variant: 'destructive' });
                    } else {
                      toast({ title: 'Status atualizado' });
                      await fetchStatuses();
                      setEditStatusOpen(false);
                    }
                  } catch (err) {
                    console.error('Erro ao atualizar status:', err);
                    toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                  } finally {
                    setEditingStatus(false);
                  }
                }} disabled={editingStatus}>{editingStatus ? 'Salvando...' : 'Salvar alterações'}</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit user dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>Atualize os dados do usuário e salve as alterações.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-nome">Nome</Label>
                <Input id="edit-nome" value={editNome} onChange={(e) => setEditNome(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-papel">Acesso</Label>
                <select id="edit-papel" value={editPapel} onChange={(e) => setEditPapel(e.target.value)} className="border rounded px-2 py-1">
                  {loadingPredefPapels ? (
                    <option>Carregando...</option>
                  ) : predefPapels.length === 0 ? (
                    <option value="">Sem opções</option>
                  ) : (
                    predefPapels.map((p) => (
                      <option key={p.id} value={String(p.id)}>{p.nome}</option>
                    ))
                  )}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Foto</Label>
                <div
                  onClick={() => editFileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer?.files?.[0];
                    if (f) setEditFile(f);
                  }}
                  className="w-full border-dashed border-2 rounded p-4 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                >
                  {!editFile ? (
                    <div className="text-center text-sm text-muted-foreground">
                      Clique ou arraste uma imagem aqui para anexar
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <img src={createPreviewUrl(editFile) ?? ''} alt="preview" className="w-24 h-24 object-cover rounded" />
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" onClick={(e) => { e.stopPropagation(); editFileInputRef.current?.click(); }}>Trocar</Button>
                        <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setEditFile(null); }}>Remover</Button>
                      </div>
                    </div>
                  )}
                </div>
                <input ref={editFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setEditFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={editAtivo} onCheckedChange={(v) => setEditAtivo(Boolean(v))} />
              </div>
            </div>

            <DialogFooter>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
                <Button className="bg-custom-600 hover:bg-custom-700" onClick={async () => {
                  try {
                    if (!editUserId) {
                      toast({ title: 'Erro', description: 'Usuário sem id não pode ser editado', variant: 'destructive' });
                      return;
                    }
                    setEditing(true);
                    // if a new image was selected, upload it and include img_url in update
                    let imgUrl: string | null = null;
                    if (editFile) {
                      imgUrl = await uploadUserImage(editFile, editUserId);
                      if (!imgUrl) {
                        toast({ title: 'Aviso', description: 'Imagem não pôde ser enviada. Alterações serão salvas sem foto.', variant: 'destructive' });
                      }
                    }

                    const updateObj: any = { nome: editNome, email: editEmail, acesso_id: editPapel ? Number(editPapel) : null, ativo: editAtivo };
                    if (imgUrl) updateObj.img_url = imgUrl;
                    const { error } = await supabase.from('usuarios').update(updateObj).eq('id', editUserId).select();
                    if (error) {
                      toast({ title: 'Erro ao atualizar usuário', description: error.message || String(error), variant: 'destructive' });
                    } else {
                      toast({ title: 'Usuário atualizado' });
                      await fetchUsuarios();
                      setEditOpen(false);
                      setEditFile(null);
                    }
                  } catch (err) {
                    console.error('Erro ao atualizar usuário:', err);
                    toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                  } finally {
                    setEditing(false);
                  }
                }} disabled={editing}>{editing ? 'Salvando...' : 'Salvar alterações'}</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Permissões do usuário (dialog) */}
        <Dialog open={permDialogOpen} onOpenChange={(v) => { if (!v) { setPermDialogOpen(false); setDialogPerms([]); } else setPermDialogOpen(true); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Permissões de {permDialogUsuarioNome}</DialogTitle>
              <DialogDescription>Gerencie as permissões deste usuário. Só aparece se você tiver permissão necessária.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="flex gap-2 items-center">
                <select value={String(dialogCategoriaFilter ?? '')} onChange={(e) => setDialogCategoriaFilter(e.target.value ? Number(e.target.value) : null)} className="border rounded px-2 py-1">
                  <option value="">Todas as categorias</option>
                  {categoriasPermissoes.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.categoria_nome}</option>
                  ))}
                </select>
                <Input placeholder="Pesquisar permissão" value={dialogSearch} onChange={(e) => setDialogSearch(e.target.value)} />
                <Button onClick={() => { setDialogSearch(''); setDialogCategoriaFilter(null); }}>Limpar</Button>
              </div>

              <div>
                {loadingDialogPerms ? (
                  <div>Carregando...</div>
                ) : dialogPerms.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhuma permissão encontrada para este usuário.</div>
                  ) : (
                  <div>
                    {(() => {
                      const total = dialogPerms.length;
                      const totalPages = Math.max(1, Math.ceil(total / dialogPageSize));
                      const start = (dialogPage - 1) * dialogPageSize;
                      const visible = dialogPerms.slice(start, start + dialogPageSize);
                      return (
                        <div className="space-y-2">
                          {visible.map((p) => (
                            <div key={p.permissao_id} className="flex items-center justify-between border rounded p-2">
                              <div>
                                <div className="font-medium">{p.permissao_nome}</div>
                                <div className="text-xs text-muted-foreground">{p.nome_categoria}</div>
                              </div>
                              <div>
                                <input
                                  type="checkbox"
                                  checked={Boolean(p.tem_permissao)}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    try {
                                      const { error } = await supabase.rpc('set_usuario_permissao', { p_usuario_id: permDialogUsuarioId, p_permissao_id: p.permissao_id, p_value: newVal });
                                      if (error) throw error;
                                      setDialogPerms((prev) => prev.map((pp) => pp.permissao_id === p.permissao_id ? { ...pp, tem_permissao: newVal } : pp));
                                      toast({ title: 'Atualizado', description: 'Permissão atualizada.' });
                                    } catch (err) {
                                      console.error('Erro ao atualizar permissão:', err);
                                      toast({ title: 'Erro', description: 'Não foi possível atualizar permissão', variant: 'destructive' });
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          ))}

                          <div className="flex items-center justify-end mt-2">
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => setDialogPage((p) => Math.max(1, p - 1))} disabled={dialogPage === 1}>Anterior</Button>
                              <div className="text-sm">{dialogPage} de {totalPages}</div>
                              <Button size="sm" variant="outline" onClick={() => setDialogPage((p) => Math.min(totalPages, p + 1))} disabled={dialogPage === totalPages}>Próximo</Button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

          </DialogContent>
        </Dialog>

        <TabsContent value="status">
          {!canViewStatus ? (
            <Card className="w-[500px] justify-center mx-auto">
              <CardContent className="p-8 text-center">
                <AlertCircle className="mx-auto mb-4 text-red-600" />
                <h3 className="text-lg font-semibold">Você não tem permissão para gerenciar os status</h3>
                <p className="text-sm text-muted-foreground mt-2">Se você acha que deveria ter acesso, contate o administrador.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Status dos Pedidos</CardTitle>
                  <Dialog open={createStatusOpen} onOpenChange={setCreateStatusOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-custom-600 hover:bg-custom-700">Novo Status</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Status</DialogTitle>
                        <DialogDescription>Crie um novo status para os pedidos.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="novo-status-nome">Nome</Label>
                          <Input id="novo-status-nome" value={createNome} onChange={(e) => setCreateNome(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="novo-status-cor">Cor</Label>
                          <div className="flex items-center gap-2">
                            <input id="novo-status-cor" type="color" value={createCor} onChange={(e) => setCreateCor(e.target.value)} className="w-10 h-10 p-0 border-0" />
                            <Input value={createCor} onChange={(e) => setCreateCor(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="novo-status-ordem">Ordem</Label>
                          <Input id="novo-status-ordem" type="number" value={String(createOrdem)} onChange={(e) => setCreateOrdem(Number(e.target.value))} />
                        </div>
                      </div>
                      <DialogFooter>
                        <div className="flex gap-2">
                          <Button variant="ghost" onClick={() => setCreateStatusOpen(false)}>Cancelar</Button>
                          <Button className="bg-custom-600 hover:bg-custom-700" onClick={async () => {
                            try {
                              if (!createNome || !createCor) {
                                toast({ title: 'Preencha os campos', variant: 'destructive' });
                                return;
                              }
                              setCreatingStatus(true);
                              const insertObj: any = { nome: createNome, cor_hex: createCor, ordem: createOrdem };
                              if (empresaId) insertObj.empresa_id = empresaId;
                              const { error } = await supabase.from('status').insert(insertObj).select();
                              if (error) {
                                toast({ title: 'Erro ao criar status', description: error.message || String(error), variant: 'destructive' });
                              } else {
                                toast({ title: 'Status criado' });
                                fetchStatuses();
                                setCreateNome(''); setCreateCor('#000000'); setCreateOrdem(1);
                              }
                              setCreateStatusOpen(false);
                            } catch (err) {
                              console.error('Erro criar status:', err);
                              toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                            } finally {
                              setCreatingStatus(false);
                            }
                          }} disabled={creatingStatus}>{creatingStatus ? 'Criando...' : 'Criar'}</Button>
                        </div>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingStatuses ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-sm text-muted-foreground">Carregando status...</TableCell>
                      </TableRow>
                    ) : statusesError ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-sm text-destructive">Erro: {statusesError}</TableCell>
                      </TableRow>
                    ) : statuses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-sm text-muted-foreground">Nenhum status encontrado.</TableCell>
                      </TableRow>
                    ) : (
                      statuses.map((status) => (
                        <TableRow key={status.id ?? status.nome}>
                          <TableCell>{status.ordem}</TableCell>
                          <TableCell className="font-medium">{status.nome}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: status.cor_hex }}
                              />
                              <span className="font-mono text-sm">{status.cor_hex}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => {
                                // open edit status modal
                                setEditStatusId(status.id);
                                setEditStatusNome(status.nome);
                                setEditStatusCor(status.cor_hex);
                                setEditStatusOrdem(status.ordem);
                                setEditStatusOpen(true);
                              }}>Editar</Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja deletar o status <strong>{status.nome}</strong>? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive hover:bg-destructive/90"
                                      onClick={async () => {
                                        try {
                                          if (!status.id) {
                                            toast({ title: 'Erro', description: 'Status sem ID não pode ser deletado', variant: 'destructive' });
                                            return;
                                          }
                                          const { error } = await supabase.from('status').delete().eq('id', status.id);
                                          if (error) {
                                            toast({ title: 'Erro ao deletar status', description: error.message || String(error), variant: 'destructive' });
                                          } else {
                                            toast({ title: 'Status deletado', description: `${status.nome} foi removido do sistema.` });
                                            await fetchStatuses();
                                          }
                                        } catch (err) {
                                          console.error('Erro ao deletar status:', err);
                                          toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                                        }
                                      }}
                                    >
                                      Deletar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        

        {/* Edit Plataforma Dialog */}
        <Dialog open={editPlataformaOpen} onOpenChange={setEditPlataformaOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Plataforma</DialogTitle>
              <DialogDescription>Atualize as informações da plataforma.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-plataforma-nome">Nome</Label>
                <Input id="edit-plataforma-nome" value={editPlataformaNome} onChange={(e) => setEditPlataformaNome(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-plataforma-cor">Cor</Label>
                <div className="flex items-center gap-2">
                  <input id="edit-plataforma-cor" type="color" value={editPlataformaCor} onChange={(e) => setEditPlataformaCor(e.target.value)} className="w-10 h-10 p-0 border-0" />
                  <Input value={editPlataformaCor} onChange={(e) => setEditPlataformaCor(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Logo (opcional)</Label>
                <div
                  onClick={() => editPlataformaFileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer?.files?.[0];
                    if (f) setEditPlataformaFile(f);
                  }}
                  className="w-full border-dashed border-2 rounded p-4 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                >
                  {!editPlataformaFile ? (
                    <div className="text-center text-sm text-muted-foreground">
                      Clique ou arraste uma imagem aqui
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <img src={createPreviewUrl(editPlataformaFile) ?? ''} alt="preview" className="w-24 h-24 object-cover rounded" />
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" onClick={(e) => { e.stopPropagation(); editPlataformaFileInputRef.current?.click(); }}>Trocar</Button>
                        <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setEditPlataformaFile(null); }}>Remover</Button>
                      </div>
                    </div>
                  )}
                </div>
                <input ref={editPlataformaFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setEditPlataformaFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            <DialogFooter>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditPlataformaOpen(false)}>Cancelar</Button>
                <Button className="bg-custom-600 hover:bg-custom-700" onClick={async () => {
                  try {
                    if (!editPlataformaId) {
                      toast({ title: 'Erro', description: 'Plataforma sem id não pode ser editada', variant: 'destructive' });
                      return;
                    }
                    setEditingPlataforma(true);

                    const updateObj: any = { nome: editPlataformaNome, cor: editPlataformaCor };

                    // Upload new image if provided
                    if (editPlataformaFile) {
                      const imgUrl = await uploadPlataformaImage(editPlataformaFile, editPlataformaId);
                      if (imgUrl) {
                        updateObj.img_url = imgUrl;
                      }
                    }

                    const { error } = await supabase.from('plataformas').update(updateObj).eq('id', editPlataformaId).select();
                    if (error) {
                      toast({ title: 'Erro ao atualizar plataforma', description: error.message || String(error), variant: 'destructive' });
                    } else {
                      toast({ title: 'Plataforma atualizada' });
                      await fetchPlataformas();
                      setEditPlataformaOpen(false);
                      setEditPlataformaFile(null);
                    }
                  } catch (err) {
                    console.error('Erro ao atualizar plataforma:', err);
                    toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                  } finally {
                    setEditingPlataforma(false);
                  }
                }} disabled={editingPlataforma}>{editingPlataforma ? 'Salvando...' : 'Salvar alterações'}</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TabsContent value="setores">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Setores do Sistema</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Gerencie os setores que aparecem no header de navegação
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={editOrderMode ? 'default' : 'outline'}
                    onClick={() => setEditOrderMode(!editOrderMode)}
                    className={editOrderMode ? 'bg-custom-600 hover:bg-custom-700' : ''}
                  >
                    <GripVertical className="h-4 w-4 mr-2" />
                    {editOrderMode ? 'Finalizar Ordenação' : 'Editar Ordem'}
                  </Button>
                  {/* Novo Setor removido */}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editOrderMode && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Modo de Ordenação:</strong> Arraste os setores para reorganizar a ordem no header.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {setores.map((setor, index) => (
                  <div
                    key={setor.id}
                    draggable={editOrderMode}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-4 border rounded-lg transition-all ${
                      editOrderMode
                        ? 'cursor-move hover:border-custom-400 hover:bg-custom-50'
                        : 'bg-card'
                    } ${draggedIndex === index ? 'opacity-50' : ''}`}
                  >
                    {editOrderMode && (
                      <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 flex items-center gap-6">
                      <div>
                        <div className="text-sm text-muted-foreground">Ordem</div>
                        <div className="font-medium">{index + 1}</div>
                      </div>
                      <div>
                        <div className="font-medium">{setor.nome}</div>
                      </div>
                    </div>
                    {/* Ações de Editar/Deletar setor removidas */}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Setor dialog removed */}

        

        <TabsContent value="formas-pagamento">
          {!canAccessFormas ? (
            <Card className="w-[500px] justify-center mx-auto">
              <CardContent className="p-8 text-center">
                <AlertCircle className="mx-auto mb-4 text-red-600" />
                <h3 className="text-lg font-semibold">Você não tem permissão para gerenciar as formas de pagamento</h3>
                <p className="text-sm text-muted-foreground mt-2">Se você acha que deveria ter acesso, contate o administrador.</p>
              </CardContent>
            </Card>
          ) : (
            <>
            <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Formas de Pagamentos</CardTitle>
                <Dialog open={createFormaPagamentoOpen} onOpenChange={setCreateFormaPagamentoOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-custom-600 hover:bg-custom-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Forma de Pagamento
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Forma de Pagamento</DialogTitle>
                      <DialogDescription>Adicione uma nova forma de pagamento ao sistema</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="create-forma-nome">Nome</Label>
                        <Input
                          id="create-forma-nome"
                          value={createFormaPagamentoNome}
                          onChange={(e) => setCreateFormaPagamentoNome(e.target.value)}
                          placeholder="Ex: Cartão de Crédito, PIX, Boleto..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Imagem/Logo</Label>
                        <div className="flex flex-col gap-2">
                          {!createFormaPagamentoFile ? (
                            <Button
                              variant="outline"
                              onClick={() => createFormaPagamentoFileInputRef.current?.click()}
                              className="w-full"
                            >
                              Selecionar Imagem
                            </Button>
                          ) : (
                            <div className="flex items-center gap-4">
                              <img
                                src={createPreviewUrl(createFormaPagamentoFile) ?? ''}
                                alt="preview"
                                className="w-24 h-24 object-cover rounded border"
                              />
                              <div className="flex flex-col gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => createFormaPagamentoFileInputRef.current?.click()}
                                >
                                  Trocar
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => setCreateFormaPagamentoFile(null)}
                                >
                                  Remover
                                </Button>
                              </div>
                            </div>
                          )}
                          <input
                            ref={createFormaPagamentoFileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => setCreateFormaPagamentoFile(e.target.files?.[0] ?? null)}
                          />
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="ghost" onClick={() => {
                        setCreateFormaPagamentoOpen(false);
                        setCreateFormaPagamentoNome('');
                        setCreateFormaPagamentoFile(null);
                      }}>
                        Cancelar
                      </Button>
                      <Button
                        className="bg-custom-600 hover:bg-custom-700"
                        onClick={async () => {
                          try {
                            if (!createFormaPagamentoNome.trim()) {
                              toast({ title: 'Preencha o nome da forma de pagamento', variant: 'destructive' });
                              return;
                            }
                            setCreatingFormaPagamento(true);

                            const insertObj: any = { nome: createFormaPagamentoNome };

                            const { data: inserted, error } = await supabase
                              .from('formas_pagamentos')
                              .insert(insertObj)
                              .select()
                              .single();

                            if (error) {
                              toast({ title: 'Erro ao criar forma de pagamento', description: error.message, variant: 'destructive' });
                              return;
                            }

                            if (createFormaPagamentoFile && inserted?.id) {
                              const imgUrl = await uploadFormaPagamentoImage(createFormaPagamentoFile, String(inserted.id));
                              if (imgUrl) {
                                await supabase
                                  .from('formas_pagamentos')
                                  .update({ img_url: imgUrl })
                                  .eq('id', inserted.id);
                              }
                            }

                            toast({ title: 'Forma de pagamento criada com sucesso!' });
                            await fetchFormasPagamento();
                            setCreateFormaPagamentoOpen(false);
                            setCreateFormaPagamentoNome('');
                            setCreateFormaPagamentoFile(null);
                          } catch (err) {
                            console.error('Erro ao criar forma de pagamento:', err);
                            toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                          } finally {
                            setCreatingFormaPagamento(false);
                          }
                        }}
                        disabled={creatingFormaPagamento}
                      >
                        {creatingFormaPagamento ? 'Criando...' : 'Criar'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loadingFormasPagamento ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : formasPagamentoError ? (
                <div className="text-center py-8 text-destructive">Erro: {formasPagamentoError}</div>
              ) : formasPagamento.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhuma forma de pagamento cadastrada</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imagem</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const groups: Record<string, typeof formasPagamento> = {};
                      formasPagamento.forEach((f) => {
                        const key = (f.nome || '').trim().split(/\s+/)[0] || 'Outros';
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(f);
                      });
                      return Object.entries(groups).map(([group, items]) => {
                        const opened = Boolean(openGroups[group]);
                        return (
                          <Fragment key={group}>
                            <TableRow className="cursor-pointer" onClick={() => setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }))}>
                              <TableCell colSpan={2} className="bg-gray-50 font-semibold">
                                <div className="flex items-center justify-between">
                                  <span>{group}</span>
                                  <span className="text-sm text-muted-foreground">{items.length}</span>
                                </div>
                              </TableCell>
                              <TableCell className="bg-gray-50 text-right">
                                <ChevronDown className={`inline-block transition-transform ${opened ? 'rotate-180' : ''}`} />
                              </TableCell>
                            </TableRow>
                            {opened && items.map((forma) => (
                              <TableRow key={forma.id}>
                                <TableCell>
                                  {forma.img_url ? (
                                    <img src={forma.img_url} alt={forma.nome} className="w-12 h-12 object-cover rounded" />
                                  ) : (
                                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                      <CreditCard className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">{forma.nome}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditFormaPagamentoId(forma.id);
                                        setEditFormaPagamentoNome(forma.nome);
                                        setEditFormaPagamentoFile(null);
                                        setEditFormaPagamentoOpen(true);
                                      }}
                                    >
                                      Editar
                                    </Button>
                                    <AlertDialog
                                      open={deleteFormaPagamentoId === forma.id}
                                      onOpenChange={(open) => {
                                        if (!open) {
                                          setDeleteFormaPagamentoId(undefined);
                                          setDeleteFormaPagamentoNome('');
                                        }
                                      }}
                                    >
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => {
                                            setDeleteFormaPagamentoId(forma.id);
                                            setDeleteFormaPagamentoNome(forma.nome);
                                          }}
                                        >
                                          <Trash className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Tem certeza que deseja excluir a forma de pagamento "{deleteFormaPagamentoNome}"? Esta ação não pode ser desfeita.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction
                                            className="bg-destructive hover:bg-destructive/90"
                                            onClick={async () => {
                                              try {
                                                if (!deleteFormaPagamentoId) return;
                                                setDeletingFormaPagamento(true);

                                                const { error } = await supabase
                                                  .from('formas_pagamentos')
                                                  .delete()
                                                  .eq('id', deleteFormaPagamentoId);

                                                if (error) {
                                                  toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
                                                } else {
                                                  toast({ title: 'Forma de pagamento excluída com sucesso!' });
                                                  await fetchFormasPagamento();
                                                  setDeleteFormaPagamentoId(undefined);
                                                  setDeleteFormaPagamentoNome('');
                                                }
                                              } catch (err) {
                                                console.error('Erro ao excluir forma de pagamento:', err);
                                                toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                                              } finally {
                                                setDeletingFormaPagamento(false);
                                              }
                                            }}
                                            disabled={deletingFormaPagamento}
                                          >
                                            {deletingFormaPagamento ? 'Excluindo...' : 'Excluir'}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </Fragment>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Edit Dialog */}
          <Dialog open={editFormaPagamentoOpen} onOpenChange={setEditFormaPagamentoOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Forma de Pagamento</DialogTitle>
                <DialogDescription>Atualize as informações da forma de pagamento</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-forma-nome">Nome</Label>
                  <Input
                    id="edit-forma-nome"
                    value={editFormaPagamentoNome}
                    onChange={(e) => setEditFormaPagamentoNome(e.target.value)}
                    placeholder="Ex: Cartão de Crédito, PIX, Boleto..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Imagem/Logo</Label>
                  <div className="flex flex-col gap-2">
                    {!editFormaPagamentoFile ? (
                      <Button
                        variant="outline"
                        onClick={() => editFormaPagamentoFileInputRef.current?.click()}
                        className="w-full"
                      >
                        Selecionar Nova Imagem
                      </Button>
                    ) : (
                      <div className="flex items-center gap-4">
                        <img
                          src={createPreviewUrl(editFormaPagamentoFile) ?? ''}
                          alt="preview"
                          className="w-24 h-24 object-cover rounded border"
                        />
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            onClick={() => editFormaPagamentoFileInputRef.current?.click()}
                          >
                            Trocar
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setEditFormaPagamentoFile(null)}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    )}
                    <input
                      ref={editFormaPagamentoFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setEditFormaPagamentoFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => {
                  setEditFormaPagamentoOpen(false);
                  setEditFormaPagamentoFile(null);
                }}>
                  Cancelar
                </Button>
                <Button
                  className="bg-custom-600 hover:bg-custom-700"
                  onClick={async () => {
                    try {
                      if (!editFormaPagamentoId) {
                        toast({ title: 'Erro', description: 'ID da forma de pagamento não encontrado', variant: 'destructive' });
                        return;
                      }
                      if (!editFormaPagamentoNome.trim()) {
                        toast({ title: 'Preencha o nome da forma de pagamento', variant: 'destructive' });
                        return;
                      }
                      setEditingFormaPagamento(true);

                      const updateObj: any = { nome: editFormaPagamentoNome };

                      if (editFormaPagamentoFile) {
                        const imgUrl = await uploadFormaPagamentoImage(editFormaPagamentoFile, editFormaPagamentoId);
                        if (imgUrl) {
                          updateObj.img_url = imgUrl;
                        }
                      }

                      const { error } = await supabase
                        .from('formas_pagamentos')
                        .update(updateObj)
                        .eq('id', editFormaPagamentoId);

                      if (error) {
                        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
                      } else {
                        toast({ title: 'Forma de pagamento atualizada com sucesso!' });
                        await fetchFormasPagamento();
                        setEditFormaPagamentoOpen(false);
                        setEditFormaPagamentoFile(null);
                      }
                    } catch (err) {
                      console.error('Erro ao atualizar forma de pagamento:', err);
                      toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                    } finally {
                      setEditingFormaPagamento(false);
                    }
                  }}
                  disabled={editingFormaPagamento}
                >
                  {editingFormaPagamento ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
          )}
        </TabsContent>

        <TabsContent value="historico">
          <HistoricoTab />
        </TabsContent>

        <TabsContent value="preferencias">
          {!canAccessPreferencias ? (
            <Card className="w-[500px] justify-center mx-auto">
              <CardContent className="p-8 text-center">
                <AlertCircle className="mx-auto mb-4 text-red-600" />
                <h3 className="text-lg font-semibold">Você não tem permissão para gerenciar as preferências</h3>
                <p className="text-sm text-muted-foreground mt-2">Se você acha que deveria ter acesso, contate o administrador.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Modo Escuro Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Preferências de Aparência</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Alternar entre tema claro e escuro</p>
                    </div>
                    <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                  </div>
                </CardContent>
              </Card>

              {/* Minha Empresa Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Minha Empresa</CardTitle>
                  <p className="text-sm text-muted-foreground">Informações sobre meu negócio</p>
                </CardHeader>
                <CardContent>
                  {loadingEmpresas ? (
                    <div className="text-sm text-muted-foreground">Carregando...</div>
                  ) : empresasError ? (
                    <div className="text-sm text-destructive">Erro: {empresasError}</div>
                  ) : empresas.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</div>
                  ) : (
                    <div className="space-y-6">
                      {empresas.map((empresa) => (
                        <div key={empresa.id} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Coluna Esquerda - Informações */}
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Empresa</Label>
                                <div className="px-3 py-2 border rounded-md bg-muted text-sm">
                                  {empresa.nome}
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">CNPJ</Label>
                                <div className="px-3 py-2 border rounded-md bg-muted text-sm font-mono">
                                  {empresa.cnpj || '-'}
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Cor</Label>
                                <div className="flex items-center gap-3 px-3 py-2 border rounded-md bg-muted">
                                  <div 
                                    className="w-8 h-8 rounded-md border"
                                    style={{ backgroundColor: empresa.cor || '#6366f1' }}
                                  />
                                  <span className="font-mono text-sm">{empresa.cor || '#6366f1'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Coluna Direita - Logo */}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Logo Marca</Label>
                              <div className="flex items-center justify-center border-2 rounded-lg p-8 bg-muted/30 h-full min-h-[200px]">
                                {empresa.logo ? (
                                  <img src={empresa.logo} alt={empresa.nome} className="max-w-full max-h-48 object-contain" />
                                ) : (
                                  <div className="text-center text-muted-foreground">
                                    <Building className="h-16 w-16 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">Sem logo</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Botões de Ação */}
                          <div className="flex gap-3 pt-2">
                            <Button 
                              variant="outline" 
                              className="flex-1"
                              onClick={() => {
                                setEditEmpresaId(empresa.id);
                                setEditEmpresaNome(empresa.nome);
                                setEditEmpresaCnpj(empresa.cnpj || '');
                                setEditEmpresaCor(empresa.cor || '#6366f1');
                                setEditEmpresaOpen(true);
                              }}
                            >
                              Editar Empresa
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="flex-1">
                                  <Trash className="h-4 w-4 mr-2" />
                                  Deletar Empresa
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja deletar a empresa <strong>{empresa.nome}</strong>? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90"
                                    onClick={async () => {
                                      try {
                                        if (!empresa.id) {
                                          toast({ title: 'Erro', description: 'Empresa sem ID não pode ser deletada', variant: 'destructive' });
                                          return;
                                        }
                                        const { error } = await supabase.from('empresas').delete().eq('id', empresa.id);
                                        if (error) {
                                          toast({ title: 'Erro ao deletar empresa', description: error.message || String(error), variant: 'destructive' });
                                        } else {
                                          toast({ title: 'Empresa deletada', description: `${empresa.nome} foi removida do sistema.` });
                                          await fetchEmpresas();
                                        }
                                      } catch (err) {
                                        console.error('Erro ao deletar empresa:', err);
                                        toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                                      }
                                    }}
                                  >
                                    Deletar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Edit Empresa Dialog */}
        <Dialog open={editEmpresaOpen} onOpenChange={setEditEmpresaOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Empresa</DialogTitle>
              <DialogDescription>Atualize as informações da empresa. A cor selecionada será usada como base para gerar toda a paleta.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-empresa-nome">Nome da Empresa</Label>
                <Input id="edit-empresa-nome" value={editEmpresaNome} onChange={(e) => setEditEmpresaNome(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-empresa-cnpj">CNPJ</Label>
                <Input 
                  id="edit-empresa-cnpj" 
                  placeholder="00.000.000/0000-00" 
                  value={editEmpresaCnpj} 
                  onChange={(e) => setEditEmpresaCnpj(formatCNPJ(e.target.value))} 
                  maxLength={18}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-empresa-cor">Cor principal</Label>
                <div className="flex items-center gap-2">
                  <input id="edit-empresa-cor" type="color" value={editEmpresaCor} onChange={(e) => setEditEmpresaCor(e.target.value)} className="w-10 h-10 p-0 border-0" />
                  <Input value={editEmpresaCor} onChange={(e) => setEditEmpresaCor(e.target.value)} />
                </div>
                <div className="mt-2 p-3 border rounded-md bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-3">Preview das paletas geradas:</p>
                  
                  {/* Light Mode Palette */}
                  <div className="mb-4">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-full bg-yellow-400"></span>
                      Light Mode
                    </p>
                    <div className="grid grid-cols-5 gap-1">
                      {Object.entries(generateColorPalette(editEmpresaCor).light).map(([key, value]) => (
                        <div key={key} className="text-center">
                          <div 
                            className="h-8 rounded border"
                            style={{ backgroundColor: `hsl(${value})` }}
                            title={`${key}: ${value}`}
                          />
                          <p className="text-[10px] mt-1">{key.replace('custom-', '')}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dark Mode Palette */}
                  <div>
                    <p className="text-xs font-medium mb-2 flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-full bg-slate-700"></span>
                      Dark Mode
                    </p>
                    <div className="grid grid-cols-5 gap-1">
                      {Object.entries(generateColorPalette(editEmpresaCor).dark).map(([key, value]) => (
                        <div key={key} className="text-center">
                          <div 
                            className="h-8 rounded border"
                            style={{ backgroundColor: `hsl(${value})` }}
                            title={`${key}: ${value}`}
                          />
                          <p className="text-[10px] mt-1">{key.replace('custom-', '')}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    💡 Ambas paletas serão salvas automaticamente como JSONB
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Logo (opcional)</Label>
                <div
                  onClick={() => editEmpresaFileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer?.files?.[0];
                    if (f) setEditEmpresaFile(f);
                  }}
                  className="w-full border-dashed border-2 rounded p-4 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                >
                  {!editEmpresaFile ? (
                    <div className="text-center text-sm text-muted-foreground">
                      Clique ou arraste uma imagem aqui
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <img src={createPreviewUrl(editEmpresaFile) ?? ''} alt="preview" className="w-24 h-24 object-cover rounded" />
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" onClick={(e) => { e.stopPropagation(); editEmpresaFileInputRef.current?.click(); }}>Trocar</Button>
                        <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setEditEmpresaFile(null); }}>Remover</Button>
                      </div>
                    </div>
                  )}
                </div>
                <input ref={editEmpresaFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setEditEmpresaFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditEmpresaOpen(false)}>Cancelar</Button>
              <Button className="bg-custom-600 hover:bg-custom-700" onClick={async () => {
                try {
                  if (!editEmpresaId) {
                    toast({ title: 'Erro', description: 'Empresa sem id não pode ser editada', variant: 'destructive' });
                    return;
                  }
                  if (!editEmpresaNome) {
                    toast({ title: 'Preencha o nome da empresa', variant: 'destructive' });
                    return;
                  }
                  setEditingEmpresa(true);

                  // Generate color palettes for both light and dark modes
                  const paletas = generateColorPalette(editEmpresaCor);

                  const updateObj: any = { 
                    nome: editEmpresaNome, 
                    cnpj: editEmpresaCnpj || null, 
                    cor: editEmpresaCor,
                    cores_hsl: paletas  // Save both light and dark palettes
                  };

                  if (editEmpresaFile) {
                    const logoUrl = await uploadEmpresaLogo(editEmpresaFile, editEmpresaId);
                    if (logoUrl) {
                      updateObj.logo = logoUrl;
                    }
                  }

                  const { error } = await supabase.from('empresas').update(updateObj).eq('id', editEmpresaId).select();
                  if (error) {
                    toast({ title: 'Erro ao atualizar empresa', description: error.message || String(error), variant: 'destructive' });
                  } else {
                    toast({ title: 'Empresa atualizada', description: 'Paletas light e dark mode geradas e salvas!' });
                    await fetchEmpresas();
                    setEditEmpresaOpen(false);
                    setEditEmpresaFile(null);
                  }
                } catch (err) {
                  console.error('Erro ao atualizar empresa:', err);
                  toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                } finally {
                  setEditingEmpresa(false);
                }
              }} disabled={editingEmpresa}>{editingEmpresa ? 'Salvando...' : 'Salvar Alterações'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Tabs>
    </div>
  );
}