import { Search, User, Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { SyntheticEvent } from 'react';
import SearchPanel from '@/components/layout/SearchPanel';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificacoesDropdown } from '@/components/notifications/NotificacoesDropdown';

interface AppHeaderProps {
  onMenuClick?: () => void;
  activeModule?: string;
  onModuleChange?: (moduleId: string) => void;
}

export function AppHeader({ onMenuClick, activeModule, onModuleChange }: AppHeaderProps) {
  const { user, signOut, imgUrl, permissoes, hasPermissao } = useAuth();
  const { toast } = useToast();
  const canNavigateHome = hasPermissao ? hasPermissao(56) : ((permissoes || []).includes(56));
  const navigate = useNavigate();

  const [searchOpen, setSearchOpen] = useState(false);
  const [navigationItems, setNavigationItems] = useState<Array<{ id: string; label: string }>>([]);

  // Load setores from localStorage
  useEffect(() => {
    const loadSetores = () => {
      try {
        const stored = localStorage.getItem('setores');
        let items: any[] = [];
        
        if (stored) {
          const parsed = JSON.parse(stored);
          
          items = parsed
            .filter((s: any) => s.id !== 'historico-movimentacoes')
            .sort((a: any, b: any) => a.ordem - b.ordem)
            .map((s: any) => ({ id: s.id, label: s.nome }));
        } else {
          // Default navigation items
          items = [
            { id: 'home', label: 'Home' },
            { id: 'comercial', label: 'Comercial' },
            { id: 'producao', label: 'Produção' },
            { id: 'logistica', label: 'Logística' },
            { id: 'contabilidade', label: 'Contabilidade' },
            { id: 'estoque', label: 'Estoque' },
            { id: 'configuracoes', label: 'Configurações' },
          ];
        }
        
        setNavigationItems(items);
      } catch (err) {
        console.error('Erro ao carregar setores:', err);
        // Fallback to default
        setNavigationItems([
          { id: 'home', label: 'Home' },
          { id: 'comercial', label: 'Comercial' },
          { id: 'producao', label: 'Produção' },
          { id: 'logistica', label: 'Logística' },
          { id: 'contabilidade', label: 'Contabilidade' },
          { id: 'estoque', label: 'Estoque' },
          { id: 'configuracoes', label: 'Configurações' },
        ]);
      }
    };

    loadSetores();

    // Listen for storage changes (when setores are updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'setores') {
        loadSetores();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Custom event for same-tab updates
    const handleSetoresUpdate = () => {
      loadSetores();
    };
    window.addEventListener('setores-updated', handleSetoresUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('setores-updated', handleSetoresUpdate);
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
  };

  const getUserName = () => {
    if (user?.user_metadata?.nome) {
      return user.user_metadata.nome;
    }
    return user?.email?.split('@')[0] || 'Usuário';
  };

  const getUserInitials = () => {
    const name = getUserName();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header
      className="relative h-16 border-b px-4 flex items-center shadow-lg"
      style={{ background: 'var(--gradient-primary)', borderBottomColor: 'rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMenuClick}
          className="lg:hidden text-white hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex items-center">
            {/* logo image - place your uploaded logo in public/zeelux-logo.png (or .svg). The image should have transparent background. */}
            <img
              src="/zeelux-logo.png"
              alt="zeelux"
              className="h-10 object-contain"
              style={{ maxWidth: 200 }}
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
            />
          </div>
        </div>
      </div>

      {/* Centered navigation */}
      <nav className="flex-1 flex justify-center">
        <div className="flex items-center gap-6">
          {navigationItems.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'home' && !canNavigateHome) {
                    toast({ title: 'Sem permissão', description: 'Você não tem permissão para acessar a Home', variant: 'destructive' });
                    return;
                  }
                  onModuleChange?.(item.id);
                  const map: Record<string, string> = {
                    home: '/',
                    comercial: '/comercial',
                    producao: '/producao',
                    logistica: '/logistica',
                    contabilidade: '/contabilidade',
                    estoque: '/estoque',
                    configuracoes: '/configuracoes',
                  };
                  // navigate to mapped path
                  navigate(map[item.id] || '/');
                }}
                className={`text-sm font-medium py-2 px-3 rounded-md transition-colors ${isActive ? 'text-white bg-white/10' : 'text-white/80 hover:bg-white/5'}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Right area: search + icons */}
      <div className="flex items-center gap-3 ml-auto">
        <div>
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setSearchOpen(true)} aria-label="Abrir busca">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />

        <NotificacoesDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8 border-2 border-white/20">
                <AvatarImage src={imgUrl || undefined} />
                <AvatarFallback className="bg-white/20 text-white">{getUserInitials()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <div className="flex flex-col space-y-1 p-2">
              <p className="text-sm font-medium leading-none">{getUserName()}</p>
              <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}