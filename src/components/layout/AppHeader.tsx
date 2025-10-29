import { Search, Bell, User, Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';

interface AppHeaderProps {
  onMenuClick?: () => void;
  activeModule?: string;
  onModuleChange?: (moduleId: string) => void;
}

export function AppHeader({ onMenuClick, activeModule, onModuleChange }: AppHeaderProps) {
  const { user, signOut } = useAuth();

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

  const navigationItems = [
    { id: 'home', label: 'Home' },
    { id: 'comercial', label: 'Comercial' },
    { id: 'producao', label: 'Produção' },
    { id: 'logistica', label: 'Logística' },
    { id: 'estoque', label: 'Estoque' },
    { id: 'configuracoes', label: 'Configurações' },
  ];

  return (
    <header
      className="h-16 border-b px-4 flex items-center shadow-lg"
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
              onError={(e:any) => { e.currentTarget.src = '/placeholder.svg'; }}
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
                onClick={() => onModuleChange?.(item.id)}
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
        <div className="w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-4 w-4" />
            <Input
              placeholder="Buscar pedidos..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 pl-10 focus:bg-white/20 focus:border-white/40 transition-colors"
            />
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10 relative"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            3
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8 border-2 border-white/20">
                <AvatarImage src="/api/placeholder/32/32" />
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