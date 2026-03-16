import { useState, useEffect } from 'react';
import { AppHeader } from './AppHeader';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useEmpresaColors } from '@/hooks/useEmpresaColors';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function AppLayout() {
  const location = useLocation();
  const { empresaId, user } = useAuth();
  const { status, subscribe } = usePushNotifications();
  
  // Load and apply empresa colors dynamically
  useEmpresaColors(empresaId);

  // Solicitar permissão de push automaticamente assim que o usuário logar
  useEffect(() => {
    if (!user) return;
    if (status !== 'idle') return;
    if (!('Notification' in window)) return;
    // Se já foi concedida, inscrever diretamente; caso contrário, pede permissão
    if (Notification.permission === 'denied') return;
    subscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, status]);
  
  const getModuleFromPath = () => {
    const path = location.pathname.replace(/\/$/, '');
    if (!path || path === '') return 'home';
    // Match /pedido/:id but not /pedido-contabilidade
    if (path === '/comercial' || path.startsWith('/pedidos') || path.startsWith('/pedido/') || path === '/novo-pedido' || path === '/dashboard-comercial' || path === '/leads' || path === '/tipos-de-lead' || path === '/pedidos-cancelados' || path === '/pedidos-enviados' || path === '/pedidos-retornados') return 'comercial';
    if (path === '/producao') return 'producao';
    if (path === '/logistica' || path === '/envio-por-etiqueta') return 'logistica';
    if (path === '/estoque' || path.startsWith('/estoque')) return 'estoque';
    if (path === '/contabilidade' || path.startsWith('/pedido-contabilidade')) return 'contabilidade';
    if (path === '/configuracoes') return 'configuracoes';
    return 'home';
  };

  const [activeModule, setActiveModule] = useState<string>(getModuleFromPath());
  const navigate = useNavigate();

  useEffect(() => {
    setActiveModule(getModuleFromPath());
  }, [location.pathname]);

  const handleModuleChange = (moduleId: string) => {
    setActiveModule(moduleId);
    switch (moduleId) {
      case 'home':
        navigate('/');
        break;
      case 'comercial':
        navigate('/comercial');
        break;
      case 'producao':
        navigate('/producao');
        break;
      case 'logistica':
        navigate('/logistica');
        break;
      case 'estoque':
        navigate('/estoque');
        break;
      case 'contabilidade':
        navigate('/contabilidade');
        break;
      case 'configuracoes':
        navigate('/configuracoes');
        break;
      default:
        navigate('/');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="flex-shrink-0">
        <AppHeader activeModule={activeModule} onModuleChange={handleModuleChange} />
      </div>
      <main className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}