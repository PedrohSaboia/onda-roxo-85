import { useState } from 'react';
import { AppHeader } from './AppHeader';
import { AppNavigation } from './AppNavigation';
import { Dashboard } from '@/pages/Dashboard';
import { Comercial } from '@/pages/Comercial';
import { Producao } from '@/pages/Producao';
import { Logistica } from '@/pages/Logistica';
import { Estoque } from '@/pages/Estoque';
import { Configuracoes } from '@/pages/Configuracoes';

export function AppLayout() {
  const [activeModule, setActiveModule] = useState('home');

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