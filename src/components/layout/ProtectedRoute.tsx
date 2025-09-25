import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isUserActive, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isUserActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/10 flex items-center justify-center">
              <span className="text-warning text-2xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">Conta Inativa</h2>
            <p className="text-muted-foreground mb-4">
              Sua conta ainda não foi ativada por um administrador. 
              Entre em contato para mais informações.
            </p>
            <p className="text-sm text-muted-foreground">
              Email: {user.email}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}