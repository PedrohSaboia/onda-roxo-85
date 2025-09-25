import { useState } from 'react';
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

export function Configuracoes() {
  const [darkMode, setDarkMode] = useState(false);

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
                <Button className="bg-purple-600 hover:bg-purple-700">
                  Novo Usuário
                </Button>
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
                  {mockUsuarios.map((usuario) => (
                    <TableRow key={usuario.id}>
                      <TableCell className="font-medium">{usuario.nome}</TableCell>
                      <TableCell>{usuario.email}</TableCell>
                      <TableCell>
                        <Badge variant={usuario.papel === 'admin' ? 'default' : 'secondary'}>
                          {usuario.papel === 'admin' ? 'Administrador' : 'Operador'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={usuario.ativo ? 'default' : 'secondary'}>
                          {usuario.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
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

        <TabsContent value="status">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Status dos Pedidos</CardTitle>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  Novo Status
                </Button>
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
                  {mockStatus.map((status) => (
                    <TableRow key={status.id}>
                      <TableCell>{status.ordem}</TableCell>
                      <TableCell className="font-medium">{status.nome}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: status.corHex }}
                          />
                          <span className="font-mono text-sm">{status.corHex}</span>
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