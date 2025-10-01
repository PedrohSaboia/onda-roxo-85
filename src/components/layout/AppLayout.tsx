import { useState, useEffect } from 'react';
import { AppHeader } from './AppHeader';
import { AppNavigation } from './AppNavigation';
import { Dashboard } from '@/pages/Dashboard';
import { Comercial } from '@/pages/Comercial';
import { Producao } from '@/pages/Producao';
import { Logistica } from '@/pages/Logistica';
import { Estoque } from '@/pages/Estoque';
import { Configuracoes } from '@/pages/Configuracoes';

import { useLocation } from 'react-router-dom';

export function AppLayout() {
  const location = useLocation();
  const getModuleFromQuery = () => {
    try {
      const params = new URLSearchParams(location.search);
      const m = params.get('module');
      return m || 'home';
    } catch {
      return 'home';
    }
  };

  const [activeModule, setActiveModule] = useState<string>(getModuleFromQuery());

  useEffect(() => {
    setActiveModule(getModuleFromQuery());
  }, [location.search]);

  const renderContent = () => {
    switch (activeModule) {
      case 'home':
        return <Dashboard />;
      case 'comercial':
        return <Comercial />;
      case 'producao':
        return <Producao />;
      case 'logistica':
        return <Logistica />;
      case 'estoque':
        return <Estoque />;
      case 'configuracoes':
        return <Configuracoes />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <AppNavigation 
        activeModule={activeModule} 
        onModuleChange={setActiveModule} 
      />
      <main className="min-h-[calc(100vh-8rem)]">
        {renderContent()}
      </main>
    </div>
  );
}