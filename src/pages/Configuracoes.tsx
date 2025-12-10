import { useState, useEffect, useRef } from 'react';
import { Settings, Users, Tag, Palette, Building, Trash, GripVertical, Plus } from 'lucide-react';
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
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export function Configuracoes() {
  const [darkMode, setDarkMode] = useState(() => {
    // Load dark mode preference from localStorage
    const stored = localStorage.getItem('darkMode');
    return stored === 'true';
  });
  const { toast } = useToast();
  const { empresaId } = useAuth();

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
  const [newPapel, setNewPapel] = useState<'admin'|'operador'|'visualizador'>('operador');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const newFileInputRef = useRef<HTMLInputElement | null>(null);
  // users list state
  type Usuario = { id?: string; nome: string; email?: string; acesso?: string; ativo?: boolean; img_url?: string };
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
      const { data, error } = await supabase.from('usuarios').select('id, nome, email, acesso, ativo, img_url').order('nome', { ascending: true });
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

  // create setor state
  const [createSetorOpen, setCreateSetorOpen] = useState(false);
  const [createSetorNome, setCreateSetorNome] = useState('');
  const [createSetorRota, setCreateSetorRota] = useState('');

  // edit setor state
  const [editSetorOpen, setEditSetorOpen] = useState(false);
  const [editSetorId, setEditSetorId] = useState<string>('');
  const [editSetorNome, setEditSetorNome] = useState('');
  const [editSetorRota, setEditSetorRota] = useState('');

  // Load setores from localStorage
  const loadSetores = () => {
    try {
      const stored = localStorage.getItem('setores');
      if (stored) {
        const parsed = JSON.parse(stored) as Setor[];
        setSetores(parsed.sort((a, b) => a.ordem - b.ordem));
      } else {
        // Default setores
        const defaultSetores: Setor[] = [
          { id: 'home', nome: 'Home', rota: '/', ordem: 0 },
          { id: 'comercial', nome: 'Comercial', rota: '/comercial', ordem: 1 },
          { id: 'producao', nome: 'Produ\u00e7\u00e3o', rota: '/producao', ordem: 2 },
          { id: 'logistica', nome: 'Log\u00edstica', rota: '/logistica', ordem: 3 },
          { id: 'estoque', nome: 'Estoque', rota: '/estoque', ordem: 4 },
          { id: 'configuracoes', nome: 'Configura\u00e7\u00f5es', rota: '/configuracoes', ordem: 5 },
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
  type Empresa = { id?: number; nome: string; cnpj?: string; cor?: string; logo?: string };
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [empresasError, setEmpresasError] = useState<string | null>(null);

  const fetchEmpresas = async () => {
    setLoadingEmpresas(true);
    setEmpresasError(null);
    try {
      const { data, error } = await supabase.from('empresas').select('id, nome, cnpj, cor, logo').order('nome', { ascending: true });
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
                      <div className="space-y-1">
                        <Label>Foto)</Label>
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
                        <Button className="bg-purple-600 hover:bg-purple-700" onClick={async () => {
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
                              const upsertObj: any = { id: userId, nome: newNome, email: newEmail, acesso: newPapel, ativo: true };
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
                              const insertObj: any = { nome: newNome, email: newEmail, acesso: newPapel, ativo: true };
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
                            setNewNome(''); setNewEmail(''); setNewPassword(''); setNewPapel('operador'); setNewFile(null);
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
                          <div className="flex justify-end gap-2">
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => {
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
                <Button className="bg-purple-600 hover:bg-purple-700" onClick={async () => {
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

                    const updateObj: any = { nome: editNome, email: editEmail, acesso: editPapel, ativo: editAtivo };
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
        </TabsContent>

        <TabsContent value="plataformas">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Plataformas de Venda</CardTitle>
                <Dialog open={createPlataformaOpen} onOpenChange={setCreatePlataformaOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-purple-600 hover:bg-purple-700">
                      Nova Plataforma
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Plataforma</DialogTitle>
                      <DialogDescription>Crie uma nova plataforma de venda.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="nova-plataforma-nome">Nome</Label>
                        <Input id="nova-plataforma-nome" value={createPlataformaNome} onChange={(e) => setCreatePlataformaNome(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="nova-plataforma-cor">Cor</Label>
                        <div className="flex items-center gap-2">
                          <input id="nova-plataforma-cor" type="color" value={createPlataformaCor} onChange={(e) => setCreatePlataformaCor(e.target.value)} className="w-10 h-10 p-0 border-0" />
                          <Input value={createPlataformaCor} onChange={(e) => setCreatePlataformaCor(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Logo (opcional)</Label>
                        <div
                          onClick={() => createPlataformaFileInputRef.current?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const f = e.dataTransfer?.files?.[0];
                            if (f) setCreatePlataformaFile(f);
                          }}
                          className="w-full border-dashed border-2 rounded p-4 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                        >
                          {!createPlataformaFile ? (
                            <div className="text-center text-sm text-muted-foreground">
                              Clique ou arraste uma imagem aqui
                            </div>
                          ) : (
                            <div className="flex items-center gap-4">
                              <img src={createPreviewUrl(createPlataformaFile) ?? ''} alt="preview" className="w-24 h-24 object-cover rounded" />
                              <div className="flex flex-col gap-2">
                                <Button variant="outline" onClick={(e) => { e.stopPropagation(); createPlataformaFileInputRef.current?.click(); }}>Trocar</Button>
                                <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setCreatePlataformaFile(null); }}>Remover</Button>
                              </div>
                            </div>
                          )}
                        </div>
                        <input ref={createPlataformaFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setCreatePlataformaFile(e.target.files?.[0] ?? null)} />
                      </div>
                    </div>

                    <DialogFooter>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setCreatePlataformaOpen(false)}>Cancelar</Button>
                        <Button className="bg-purple-600 hover:bg-purple-700" onClick={async () => {
                          try {
                            if (!createPlataformaNome || !createPlataformaCor) {
                              toast({ title: 'Preencha os campos', variant: 'destructive' });
                              return;
                            }
                            setCreatingPlataforma(true);

                            // Insert plataforma first to get ID
                            const { data: insertData, error: insertError } = await supabase
                              .from('plataformas')
                              .insert({ nome: createPlataformaNome, cor: createPlataformaCor })
                              .select()
                              .single();

                            if (insertError) {
                              toast({ title: 'Erro ao criar plataforma', description: insertError.message || String(insertError), variant: 'destructive' });
                              return;
                            }

                            const plataformaId = insertData?.id;

                            // Upload image if provided
                            if (createPlataformaFile && plataformaId) {
                              const imgUrl = await uploadPlataformaImage(createPlataformaFile, plataformaId);
                              if (imgUrl) {
                                await supabase.from('plataformas').update({ img_url: imgUrl }).eq('id', plataformaId);
                              }
                            }

                            toast({ title: 'Plataforma criada' });
                            await fetchPlataformas();
                            setCreatePlataformaNome('');
                            setCreatePlataformaCor('#000000');
                            setCreatePlataformaFile(null);
                            setCreatePlataformaOpen(false);
                          } catch (err) {
                            console.error('Erro criar plataforma:', err);
                            toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                          } finally {
                            setCreatingPlataforma(false);
                          }
                        }} disabled={creatingPlataforma}>{creatingPlataforma ? 'Criando...' : 'Criar'}</Button>
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
                    <TableHead>Cor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPlataformas ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-sm text-muted-foreground">Carregando plataformas...</TableCell>
                    </TableRow>
                  ) : plataformasError ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-sm text-destructive">Erro: {plataformasError}</TableCell>
                    </TableRow>
                  ) : plataformas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-sm text-muted-foreground">Nenhuma plataforma encontrada.</TableCell>
                    </TableRow>
                  ) : (
                    plataformas.map((plataforma) => (
                      <TableRow key={plataforma.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {plataforma.img_url && (
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={plataforma.img_url} alt={plataforma.nome} />
                                <AvatarFallback>{plataforma.nome.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                            )}
                            <span>{plataforma.nome}</span>
                          </div>
                        </TableCell>
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
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                              setEditPlataformaId(plataforma.id);
                              setEditPlataformaNome(plataforma.nome);
                              setEditPlataformaCor(plataforma.cor);
                              setEditPlataformaOpen(true);
                            }}>
                              Editar
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => {
                                  setDeletePlataformaId(plataforma.id);
                                  setDeletePlataformaNome(plataforma.nome);
                                }}>
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja deletar a plataforma <strong>{plataforma.nome}</strong>? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90"
                                    onClick={async () => {
                                      try {
                                        if (!plataforma.id) {
                                          toast({ title: 'Erro', description: 'Plataforma sem ID não pode ser deletada', variant: 'destructive' });
                                          return;
                                        }
                                        setDeletingPlataforma(true);
                                        const { error } = await supabase.from('plataformas').delete().eq('id', plataforma.id);
                                        if (error) {
                                          toast({ title: 'Erro ao deletar plataforma', description: error.message || String(error), variant: 'destructive' });
                                        } else {
                                          toast({ title: 'Plataforma deletada', description: `${plataforma.nome} foi removida do sistema.` });
                                          await fetchPlataformas();
                                        }
                                      } catch (err) {
                                        console.error('Erro ao deletar plataforma:', err);
                                        toast({ title: 'Erro', description: String(err), variant: 'destructive' });
                                      } finally {
                                        setDeletingPlataforma(false);
                                      }
                                    }}
                                    disabled={deletingPlataforma}
                                  >
                                    {deletingPlataforma ? 'Deletando...' : 'Deletar'}
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
                <Button className="bg-purple-600 hover:bg-purple-700" onClick={async () => {
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
                    className={editOrderMode ? 'bg-purple-600 hover:bg-purple-700' : ''}
                  >
                    <GripVertical className="h-4 w-4 mr-2" />
                    {editOrderMode ? 'Finalizar Ordenação' : 'Editar Ordem'}
                  </Button>
                  <Dialog open={createSetorOpen} onOpenChange={setCreateSetorOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-purple-600 hover:bg-purple-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Setor
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Setor</DialogTitle>
                        <DialogDescription>Adicione um novo setor ao sistema.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="novo-setor-nome">Nome do Setor</Label>
                          <Input
                            id="novo-setor-nome"
                            placeholder="Ex: Design"
                            value={createSetorNome}
                            onChange={(e) => setCreateSetorNome(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="novo-setor-rota">Rota (URL)</Label>
                          <Input
                            id="novo-setor-rota"
                            placeholder="Ex: /design"
                            value={createSetorRota}
                            onChange={(e) => setCreateSetorRota(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setCreateSetorOpen(false)}>Cancelar</Button>
                        <Button
                          className="bg-purple-600 hover:bg-purple-700"
                          onClick={() => {
                            if (!createSetorNome || !createSetorRota) {
                              toast({ title: 'Preencha todos os campos', variant: 'destructive' });
                              return;
                            }
                            const newSetor: Setor = {
                              id: createSetorRota.replace('/', '').toLowerCase(),
                              nome: createSetorNome,
                              rota: createSetorRota,
                              ordem: setores.length,
                            };
                            const newSetores = [...setores, newSetor];
                            saveSetores(newSetores);
                            setCreateSetorNome('');
                            setCreateSetorRota('');
                            setCreateSetorOpen(false);
                          }}
                        >
                          Criar Setor
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
                        ? 'cursor-move hover:border-purple-400 hover:bg-purple-50'
                        : 'bg-card'
                    } ${draggedIndex === index ? 'opacity-50' : ''}`}
                  >
                    {editOrderMode && (
                      <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                      <div>
                        <div className="text-sm text-muted-foreground">Ordem</div>
                        <div className="font-medium">{index + 1}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Nome</div>
                        <div className="font-medium">{setor.nome}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Rota</div>
                        <div className="font-mono text-sm">{setor.rota}</div>
                      </div>
                    </div>
                    {!editOrderMode && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditSetorId(setor.id);
                            setEditSetorNome(setor.nome);
                            setEditSetorRota(setor.rota);
                            setEditSetorOpen(true);
                          }}
                        >
                          Editar
                        </Button>
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
                                Tem certeza que deseja deletar o setor <strong>{setor.nome}</strong>? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => {
                                  const newSetores = setores.filter((s) => s.id !== setor.id);
                                  newSetores.forEach((s, idx) => {
                                    s.ordem = idx;
                                  });
                                  saveSetores(newSetores);
                                  toast({ title: 'Setor deletado', description: `${setor.nome} foi removido.` });
                                }}
                              >
                                Deletar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Setor Dialog */}
        <Dialog open={editSetorOpen} onOpenChange={setEditSetorOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Setor</DialogTitle>
              <DialogDescription>Atualize as informações do setor.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-setor-nome">Nome do Setor</Label>
                <Input
                  id="edit-setor-nome"
                  value={editSetorNome}
                  onChange={(e) => setEditSetorNome(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-setor-rota">Rota (URL)</Label>
                <Input
                  id="edit-setor-rota"
                  value={editSetorRota}
                  onChange={(e) => setEditSetorRota(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditSetorOpen(false)}>Cancelar</Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => {
                  if (!editSetorNome || !editSetorRota) {
                    toast({ title: 'Preencha todos os campos', variant: 'destructive' });
                    return;
                  }
                  const newSetores = setores.map((s) =>
                    s.id === editSetorId
                      ? { ...s, nome: editSetorNome, rota: editSetorRota }
                      : s
                  );
                  saveSetores(newSetores);
                  setEditSetorOpen(false);
                }}
              >
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TabsContent value="preferencias">
          <div className="space-y-6">
            {/* Modo Escuro Card */}
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Aparência</CardTitle>
              </CardHeader>
              <CardContent>
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
        </TabsContent>

        {/* Edit Empresa Dialog */}
        <Dialog open={editEmpresaOpen} onOpenChange={setEditEmpresaOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Empresa</DialogTitle>
              <DialogDescription>Atualize as informações da empresa.</DialogDescription>
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
                <Label htmlFor="edit-empresa-cor">Cor</Label>
                <div className="flex items-center gap-2">
                  <input id="edit-empresa-cor" type="color" value={editEmpresaCor} onChange={(e) => setEditEmpresaCor(e.target.value)} className="w-10 h-10 p-0 border-0" />
                  <Input value={editEmpresaCor} onChange={(e) => setEditEmpresaCor(e.target.value)} />
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
              <Button className="bg-purple-600 hover:bg-purple-700" onClick={async () => {
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

                  const updateObj: any = { nome: editEmpresaNome, cnpj: editEmpresaCnpj || null, cor: editEmpresaCor };

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
                    toast({ title: 'Empresa atualizada' });
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