import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isUserActive: boolean;
  acesso?: string | null;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
    resetPassword: (email: string) => Promise<{ error: any }>; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUserActive, setIsUserActive] = useState(false);
  const [acesso, setAcesso] = useState<string | null>(null);
  const { toast } = useToast();

  // Verificar se usuário está ativo
  const checkUserActive = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('ativo')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Erro ao verificar status do usuário:', error);
        return false;
      }
      
      return data?.ativo || false;
    } catch (error) {
      console.error('Erro ao verificar status do usuário:', error);
      return false;
    }
  };

  const fetchAcesso = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('acesso')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar acesso do usuário:', error);
        return null;
      }

      return data?.acesso ?? null;
    } catch (err) {
      console.error('Erro ao buscar acesso do usuário:', err);
      return null;
    }
  };

  useEffect(() => {
    // Configurar listener de mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Usar setTimeout para evitar deadlock no callback
          setTimeout(async () => {
            try {
              const active = await checkUserActive(session.user.id);
              setIsUserActive(active);
              const acc = await fetchAcesso(session.user.id);
              setAcesso(acc);
              
              if (!active && event === 'SIGNED_IN') {
                toast({
                  title: "Conta inativa",
                  description: "Sua conta ainda não foi ativada por um administrador. Entre em contato para mais informações.",
                  variant: "destructive",
                });
              }
            } catch (error) {
              console.error('Erro ao verificar status do usuário:', error);
              setIsUserActive(false);
            }
            setIsLoading(false);
          }, 0);
        } else {
          setIsUserActive(false);
          setAcesso(null);
          setIsLoading(false);
        }
      }
    );

    // Verificar sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(async () => {
          try {
            const active = await checkUserActive(session.user.id);
            setIsUserActive(active);
            const acc = await fetchAcesso(session.user.id);
            setAcesso(acc);
          } catch (error) {
            console.error('Erro ao verificar status do usuário:', error);
            setIsUserActive(false);
          }
          setIsLoading(false);
        }, 0);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [toast]);

  const signUp = async (email: string, password: string, nome: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            nome: nome
          }
        }
      });

      if (error) {
        let message = "Erro ao criar conta";
        if (error.message.includes("already been registered")) {
          message = "Este email já está cadastrado";
        } else if (error.message.includes("Password")) {
          message = "A senha deve ter pelo menos 6 caracteres";
        } else if (error.message.includes("Email")) {
          message = "Por favor, insira um email válido";
        }
        
        toast({
          title: "Erro no cadastro",
          description: message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Cadastro realizado!",
          description: "Verifique seu email e aguarde a ativação da sua conta por um administrador.",
        });
      }

      return { error };
    } catch (error) {
      console.error('Erro no cadastro:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        let message = "Erro ao fazer login";
        if (error.message.includes("Invalid login credentials")) {
          message = "Email ou senha incorretos";
        } else if (error.message.includes("Email not confirmed")) {
          message = "Por favor, confirme seu email antes de fazer login";
        }
        
        toast({
          title: "Erro no login",
          description: message,
          variant: "destructive",
        });
      }

      return { error };
    } catch (error) {
      console.error('Erro no login:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao fazer logout",
          variant: "destructive",
        });
      }

      return { error };
    } catch (error) {
      console.error('Erro no logout:', error);
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      // try v2 method names safely via any
  // don't set redirectTo here so Supabase uses its default reset flow
      const authAny: any = supabase.auth as any;
      if (typeof authAny.resetPasswordForEmail === 'function') {
        const res = await authAny.resetPasswordForEmail(email);
        return { error: res?.error ?? null };
      }
      if (typeof authAny.sendPasswordResetEmail === 'function') {
        const res = await authAny.sendPasswordResetEmail(email);
        return { error: res?.error ?? null };
      }
      // fallback to signUp-like api if available
      if (typeof authAny.api?.resetPasswordForEmail === 'function') {
        const res = await authAny.api.resetPasswordForEmail(email);
        return { error: res?.error ?? null };
      }
      return { error: new Error('Password reset not supported by client version') };
    } catch (err) {
      console.error('Erro ao solicitar reset de senha:', err);
      return { error: err };
    }
  };

  const value = {
    user,
    session,
    isLoading,
    isUserActive,
    acesso,
    signUp,
    signIn,
    signOut,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}