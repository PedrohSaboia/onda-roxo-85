import { useState, useEffect } from 'react';
import { Settings, Users, Tag, Palette, Building } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockUsuarios, mockStatus, mockPlataformas } from '@/data/mockData';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function Configuracoes() {
  const [darkMode, setDarkMode] = useState(false);
  const { toast } = useToast();

  // new user modal state
  const [openNewUser, setOpenNewUser] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPapel, setNewPapel] = useState<'admin'|'operador'|'visualizador'>('operador');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  // users list state
  type Usuario = { id?: string; nome: string; email?: string; acesso?: string; ativo?: boolean };
  const [users, setUsers] = useState<Usuario[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  // edit user state
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | undefined>(undefined);
  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPapel, setEditPapel] = useState<'admin'|'operador'|'visualizador'>('operador');
  const [editAtivo, setEditAtivo] = useState(true);
  const [editing, setEditing] = useState(false);

  const fetchUsuarios = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const { data, error } = await supabase.from('usuarios').select('id, nome, email, acesso, ativo').order('nome', { ascending: true });
      if (error) throw error;
      setUsers((data ?? []) as Usuario[]);
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie usuários, status, plataformas e preferências do sistema
        </p>
      </div>

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="usuarios">
            <Users className="h-4 w-4 mr-2" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="status">
            <Tag className="h-4 w-4 mr-2" />
            Status
          </TabsTrigger>
          <TabsTrigger value="plataformas">
            <Building className="h-4 w-4 mr-2" />
            Plataformas
          </TabsTrigger>
          <TabsTrigger value="setores">
            <Settings className="h-4 w-4 mr-2" />
            Setores
          </TabsTrigger>
          <TabsTrigger value="preferencias">
            <Palette className="h-4 w-4 mr-2" />
            Preferências
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Usuários do Sistema</CardTitle>
                <Dialog open={openNewUser} onOpenChange={setOpenNewUser}>
                  <DialogTrigger asChild>
                    <Button className="bg-purple-600 hover:bg-purple-700">Novo Usuário</Button>
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
                        <Label htmlFor="novo-papel">Papel</Label>
                        <select id="novo-papel" value={newPapel} onChange={(e) => setNewPapel(e.target.value as 'admin'|'operador'|'visualizador')} className="border rounded px-2 py-1">
                          <option value="operador">Operador</option>
                          <option value="admin">Administrador</option>
                          <option value="visualizador">Visualizador</option>
                        </select>
                      </div>
                    </div>

                    <DialogFooter>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setOpenNewUser(false)}>Cancelar</Button>
                        <Button className="bg-purple-600 hover:bg-purple-700" onClick={async () => {
                          // create auth user then upsert into usuarios
                          try {
                            if (!newNome || !newEmail || !newPassword) {
                              toast({ title: 'Preencha todos os campos', variant: 'destructive' });
                              return;
                            }
                            setCreating(true);

                            const { data, error } = await supabase.auth.signUp({ email: newEmail, password: newPassword, options: { data: { nome: newNome } } });

                            if (error) {
                              toast({ title: 'Erro ao criar autenticação', description: error.message || String(error), variant: 'destructive' });
                              setCreating(false);
                              return;
                            }

                            // try to read created user id from response
                            type SignUpData = { user?: { id?: string } } | null;
                            const userId = (data as SignUpData)?.user?.id ?? null;

                            if (userId) {
                              // upsert into usuarios with same uuid
                              const { error: upsertErr } = await supabase.from('usuarios').upsert({ id: userId, nome: newNome, email: newEmail, acesso: newPapel, ativo: true }).select();
                              if (upsertErr) {
                                toast({ title: 'Conta criada, mas erro ao registrar no sistema', description: upsertErr.message || String(upsertErr), variant: 'destructive' });
                              } else {
                                toast({ title: 'Usuário criado', description: 'Autenticação criada e usuário registrado.' });
                                await fetchUsuarios();
                              }
                            } else {
                              // fallback: insert without linking id — admin will need to reconcile
                              const { error: insErr } = await supabase.from('usuarios').insert({ nome: newNome, email: newEmail, acesso: newPapel, ativo: true }).select();
                              if (insErr) {
                                toast({ title: 'Erro ao inserir usuário', description: insErr.message || String(insErr), variant: 'destructive' });
                              } else {
                                toast({ title: 'Autenticação criada', description: 'Conta criada. O usuário será registrado no sistema automaticamente após confirmação de email.' });
                                await fetchUsuarios();
                              }
                            }

                            // reset form and close
                            setNewNome(''); setNewEmail(''); setNewPassword(''); setNewPapel('operador');
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
                    <TableHead>Papel</TableHead>
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
                        <TableCell className="font-medium">{usuario.nome}</TableCell>
                        <TableCell>{usuario.email}</TableCell>
                        <TableCell>
                          <Badge variant={usuario.acesso === 'admin' ? 'default' : 'secondary'}>
                            {usuario.acesso === 'admin' ? 'Administrador' : (usuario.acesso ?? 'Operador')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={usuario.ativo ? 'default' : 'secondary'}>
                            {usuario.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => {
                            // open edit modal with user data
                            setEditUserId(usuario.id);
                            setEditNome(usuario.nome ?? '');
                            setEditEmail(usuario.email ?? '');
                            setEditPapel((usuario.acesso as 'admin'|'operador'|'visualizador') ?? 'operador');
                            setEditAtivo(usuario.ativo ?? true);
                            setEditOpen(true);
                          }}>
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
                <Button className="bg-purple-600 hover:bg-purple-700" onClick={async () => {
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
                <Label htmlFor="edit-papel">Papel</Label>
                <select id="edit-papel" value={editPapel} onChange={(e) => setEditPapel(e.target.value as 'admin'|'operador'|'visualizador')} className="border rounded px-2 py-1">
                  <option value="operador">Operador</option>
                  <option value="admin">Administrador</option>
                  <option value="visualizador">Visualizador</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={editAtivo} onCheckedChange={(v) => setEditAtivo(Boolean(v))} />
              </div>
            </div>

            <DialogFooter>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
                <Button className="bg-purple-600 hover:bg-purple-700" onClick={async () => {
                  try {
                    if (!editUserId) {
                      toast({ title: 'Erro', description: 'Usuário sem id não pode ser editado', variant: 'destructive' });
                      return;
                    }
                    setEditing(true);
                    const { error } = await supabase.from('usuarios').update({ nome: editNome, email: editEmail, acesso: editPapel, ativo: editAtivo }).eq('id', editUserId).select();
                    if (error) {
                      toast({ title: 'Erro ao atualizar usuário', description: error.message || String(error), variant: 'destructive' });
                    } else {
                      toast({ title: 'Usuário atualizado' });
                      await fetchUsuarios();
                      setEditOpen(false);
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

        <TabsContent value="status">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Status dos Pedidos</CardTitle>
                <Dialog open={createStatusOpen} onOpenChange={setCreateStatusOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-purple-600 hover:bg-purple-700">Novo Status</Button>
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
                        <Label htmlFor="novo-status-cor">Cor (hex)</Label>
                        <Input id="novo-status-cor" value={createCor} onChange={(e) => setCreateCor(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="novo-status-ordem">Ordem</Label>
                        <Input id="novo-status-ordem" type="number" value={String(createOrdem)} onChange={(e) => setCreateOrdem(Number(e.target.value))} />
                      </div>
                    </div>
                    <DialogFooter>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setCreateStatusOpen(false)}>Cancelar</Button>
                        <Button className="bg-purple-600 hover:bg-purple-700" onClick={async () => {
                          try {
                            if (!createNome || !createCor) {
                              toast({ title: 'Preencha os campos', variant: 'destructive' });
                              return;
                            }
                            setCreatingStatus(true);
                            const { error } = await supabase.from('status').insert({ nome: createNome, cor_hex: createCor, ordem: createOrdem }).select();
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
                          <Button variant="outline" size="sm" onClick={() => {
                            // open edit status modal
                            setEditStatusId(status.id);
                            setEditStatusNome(status.nome);
                            setEditStatusCor(status.cor_hex);
                            setEditStatusOrdem(status.ordem);
                            setEditStatusOpen(true);
                          }}>Editar</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plataformas">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Plataformas de Venda</CardTitle>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  Nova Plataforma
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockPlataformas.map((plataforma) => (
                    <TableRow key={plataforma.id}>
                      <TableCell className="font-medium">{plataforma.nome}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: plataforma.cor }}
                          />
                          <span className="font-mono text-sm">{plataforma.cor}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="setores">
          <Card>
            <CardHeader>
              <CardTitle>Rótulos dos Setores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="comercial">Setor Comercial</Label>
                  <Input id="comercial" defaultValue="Comercial" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="design">Setor Design</Label>
                  <Input id="design" defaultValue="Design" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="producao">Setor Produção</Label>
                  <Input id="producao" defaultValue="Produção" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logistica">Setor Logística</Label>
                  <Input id="logistica" defaultValue="Logística" />
                </div>
              </div>
              <Button className="bg-purple-600 hover:bg-purple-700">
                Salvar Alterações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferencias">
          <Card>
            <CardHeader>
              <CardTitle>Preferências Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="empresa">Nome da Empresa</Label>
                  <Input id="empresa" defaultValue="Tridi" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Modo Escuro</Label>
                    <p className="text-sm text-muted-foreground">
                      Alternar entre tema claro e escuro
                    </p>
                  </div>
                  <Switch
                    checked={darkMode}
                    onCheckedChange={setDarkMode}
                  />
                </div>
              </div>
              
              <Button className="bg-purple-600 hover:bg-purple-700">
                Salvar Preferências
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}