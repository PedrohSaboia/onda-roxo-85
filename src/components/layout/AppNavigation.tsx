import { Home, Package, Palette, Cog, Truck, BarChart3, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ElementType;
  active?: boolean;
}

interface AppNavigationProps {
  activeModule: string;
  onModuleChange: (moduleId: string) => void;
}

const navigationItems: NavigationItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'comercial', label: 'Comercial', icon: Package },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'producao', label: 'Produção', icon: Cog },
  { id: 'logistica', label: 'Logística', icon: Truck },
  { id: 'estoque', label: 'Estoque', icon: BarChart3 },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
];

export function AppNavigation({ activeModule, onModuleChange }: AppNavigationProps) {
  return (
    <nav className="bg-white border-b border-gray-200 px-4">
      <div className="flex space-x-8 overflow-x-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                isActive
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}