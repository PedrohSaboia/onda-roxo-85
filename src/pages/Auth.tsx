import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Auth() {
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, resetPassword, user, isUserActive, isLoading, acesso } = useAuth();
  const { toast } = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  

  // Redirecionar se usuário já estiver logado e ativo
  useEffect(() => {
    if (user && isUserActive && !isLoading) {
      // redireciona para a raiz após login — não forçamos rota diferente por papel no frontend
      navigate('/');
    }
  }, [user, isUserActive, isLoading, navigate]);

  const onLogin = async (data: LoginFormData) => {
    await signIn(data.email, data.password);
  };

  const onReset = async () => {
    if (!resetEmail) {
      toast({ title: 'Informe o email', variant: 'destructive' });
      return;
    }
    setResetting(true);
    try {
      const { error } = await resetPassword(resetEmail);
      if (error) {
        toast({ title: 'Erro', description: error.message || String(error), variant: 'destructive' });
      } else {
        toast({ title: 'Enviado', description: 'Verifique seu email para redefinir a senha.' });
        setResetOpen(false);
        setResetEmail('');
      }
    } catch (err) {
      console.error('Erro ao solicitar reset:', err);
      toast({ title: 'Erro', description: String(err), variant: 'destructive' });
    } finally {
      setResetting(false);
    }
  };

  

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
            Zeelux ERP
          </h1>
          <p className="text-muted-foreground mt-2">
            Sistema de Gestão de Pedidos
          </p>
        </div>

        <Card className="shadow-lg border-0" style={{boxShadow: 'var(--shadow-elevated)'}}>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-1 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-2xl text-center">Fazer Login</CardTitle>
                <CardDescription className="text-center">
                  Entre com suas credenciais para acessar o sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-10"
                        {...loginForm.register('email')}
                      />
                    </div>
                    {loginForm.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {loginForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Sua senha"
                        className="pl-10 pr-10"
                        {...loginForm.register('password')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                    disabled={loginForm.formState.isSubmitting}
                  >
                    {loginForm.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
                  </Button>
                  <div className="text-center mt-3">
                    <button type="button" className="text-sm text-primary underline" onClick={() => setResetOpen(true)}>Esqueci a senha</button>
                  </div>
                </form>
              </CardContent>
            </TabsContent>
            <Dialog open={resetOpen} onOpenChange={setResetOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Redefinir senha</DialogTitle>
                </DialogHeader>
                <div className="grid gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancelar</Button>
                    <Button className="bg-purple-600 hover:bg-purple-700" onClick={onReset} disabled={resetting}>{resetting ? 'Enviando...' : 'Enviar email'}</Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
          </Tabs>
        </Card>
      </div>
    </div>
  );
}