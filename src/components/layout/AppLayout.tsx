import { useState, useEffect } from 'react';
import { AppHeader } from './AppHeader';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useEmpresaColors } from '@/hooks/useEmpresaColors';
import { useAuth } from '@/hooks/useAuth';

export function AppLayout() {
  const location = useLocation();
  const { empresaId } = useAuth();
  
  // Load and apply empresa colors dynamically
  useEmpresaColors(empresaId);
  
  const getModuleFromPath = () => {
    const path = location.pathname.replace(/\/$/, '');
    if (!path || path === '') return 'home';
    // Match /pedido/:id but not /pedido-contabilidade
    if (path === '/comercial' || path.startsWith('/pedidos') || path.startsWith('/pedido/') || path === '/novo-pedido') return 'comercial';
    if (path === '/producao') return 'producao';
    if (path === '/logistica') return 'logistica';
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
      <AppHeader activeModule={activeModule} onModuleChange={handleModuleChange} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}