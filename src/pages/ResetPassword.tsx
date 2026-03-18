import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

const resetSchema = z
  .object({
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string().min(6, 'Confirme a senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type ResetFormData = z.infer<typeof resetSchema>;

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  const form = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  // O Supabase injeta os tokens na URL hash automaticamente ao abrir o link
  // Precisamos aguardar o onAuthStateChange resolver a sessão
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
        setSessionReady(true);
      }
    });

    // Verifica se já há sessão ativa ao abrir a página
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      } else {
        // Aguarda o evento por até 4s; se não chegar, mostra erro
        const timer = setTimeout(() => {
          setSessionReady((prev) => (prev === null ? false : prev));
        }, 4000);
        return () => clearTimeout(timer);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (data: ResetFormData) => {
    const { error } = await supabase.auth.updateUser({ password: data.password });

    if (error) {
      toast({
        title: 'Erro ao redefinir senha',
        description: error.message || 'Tente novamente ou solicite um novo link.',
        variant: 'destructive',
      });
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate('/auth'), 3000);
  };

  // ── Tela de carregamento ──────────────────────────────────────────────────
  if (sessionReady === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-custom-50 to-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // ── Link inválido / expirado ──────────────────────────────────────────────
  if (sessionReady === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-custom-50 to-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-custom-600 to-custom-800 bg-clip-text text-transparent">
              Zeelux ERP
            </h1>
          </div>
          <Card className="shadow-lg border-0" style={{ boxShadow: 'var(--shadow-elevated)' }}>
            <CardContent className="pt-10 pb-8 flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-lg font-semibold">Link inválido ou expirado</p>
              <p className="text-sm text-muted-foreground">
                Solicite um novo link de redefinição de senha na tela de login.
              </p>
              <Button
                className="mt-2 bg-gradient-to-r from-custom-600 to-custom-700 hover:from-custom-700 hover:to-custom-800"
                onClick={() => navigate('/auth')}
              >
                Ir para o login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Sucesso ───────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-custom-50 to-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-custom-600 to-custom-800 bg-clip-text text-transparent">
              Zeelux ERP
            </h1>
          </div>
          <Card className="shadow-lg border-0" style={{ boxShadow: 'var(--shadow-elevated)' }}>
            <CardContent className="pt-10 pb-8 flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-lg font-semibold">Senha redefinida com sucesso!</p>
              <p className="text-sm text-muted-foreground">
                Você será redirecionado para o login em instantes…
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Formulário principal ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-custom-50 to-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-custom-600 to-custom-800 bg-clip-text text-transparent">
            Zeelux ERP
          </h1>
          <p className="text-muted-foreground mt-2">Sistema de Gestão de Pedidos</p>
        </div>

        <Card className="shadow-lg border-0" style={{ boxShadow: 'var(--shadow-elevated)' }}>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">Redefinir senha</CardTitle>
            <CardDescription className="text-center">
              Digite e confirme sua nova senha
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Nova senha */}
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    className="pl-10 pr-10"
                    {...form.register('password')}
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
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>

              {/* Confirmar senha */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repita a nova senha"
                    className="pl-10 pr-10"
                    {...form.register('confirmPassword')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-custom-600 to-custom-700 hover:from-custom-700 hover:to-custom-800"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-primary underline"
                  onClick={() => navigate('/auth')}
                >
                  Voltar ao login
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
