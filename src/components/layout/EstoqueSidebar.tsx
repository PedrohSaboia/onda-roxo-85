import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Package, Box } from 'lucide-react'
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { FaBoxesPacking } from "react-icons/fa6";
import { AiFillProduct } from "react-icons/ai";


const items = [
  { id: 'produtos', label: 'Lista de Produtos', icon: AiFillProduct },
  { id: 'embalagens', label: 'Lista de Embalagens', icon: FaBoxesPacking },
]

export function EstoqueSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast();
  const { permissoes, hasPermissao } = useAuth();
  const canViewEmbalagens = hasPermissao ? hasPermissao(14) : ((permissoes || []).includes(14));
  const params = new URLSearchParams(location.search)
  const view = params.get('view') || 'produtos'
  const [isExpanded, setIsExpanded] = useState(false)

  const handleClick = (id: string) => {
    // Special-case: open the dedicated Embalagens page
    if (id === 'embalagens') {
      if (!canViewEmbalagens) {
        toast({ title: 'Sem permissão', description: 'Você não tem permissão para acessar Embalagens', variant: 'destructive' });
        return;
      }
      navigate('/estoque/embalagens');
      return;
    }

    // For produtos, navigate to /estoque
    if (id === 'produtos') {
      navigate('/estoque');
      return;
    }

    // Default: update view parameter
    const next = new URLSearchParams(location.search)
    next.set('view', id)
    navigate({ pathname: location.pathname, search: next.toString() })
  }

  // Sidebar begins below header because it's rendered inside the page's main area
  return (
    <aside 
      className={`hidden lg:block relative min-h-screen transition-all duration-300 ease-in-out bg-[hsl(var(--secondary-background))] shadow-md ${
        isExpanded ? 'w-60' : 'w-16'
      }`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onFocus={() => setIsExpanded(true)}
      onBlur={(e) => {
        // Only collapse if focus is moving outside the sidebar
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsExpanded(false);
        }
      }}
    >
      <div className="sticky top-0 h-[calc(100vh-4rem)] overflow-hidden">
        <nav aria-label="Menu Estoque" className="h-full">
          <ul className="px-2 py-3 space-y-2 h-full">
            {items.map((it) => {
              const Icon = it.icon
              // When on the dedicated /estoque/embalagens route, mark the corresponding item active.
              let isActive = false;
              if (location.pathname === '/estoque/embalagens') {
                isActive = it.id === 'embalagens';
              } else if (location.pathname === '/estoque' || location.pathname.startsWith('/estoque')) {
                isActive = it.id === 'produtos' && it.id === view || (it.id === 'produtos' && location.pathname === '/estoque');
              } else {
                isActive = view === it.id;
              }
              return (
                <li key={it.id}>
                  <button
                    onClick={() => handleClick(it.id)}
                    className={`w-full flex items-center gap-3 text-sm rounded-md px-3 py-2.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-custom-400 ${
                      isActive
                        ? 'bg-custom-600 text-white font-medium'
                        : 'text-slate-700 hover:bg-custom-50 hover:text-custom-700'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                    title={!isExpanded ? it.label : undefined}
                  >
                    <span className={`flex-shrink-0 p-1 rounded-md ${isActive ? 'bg-white/20' : 'bg-transparent'}`}>
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-custom-600'}`} />
                    </span>
                    <span 
                      className={`flex-1 text-left whitespace-nowrap transition-all duration-300 ${
                        isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
                      }`}
                    >
                      {it.label}
                    </span>
                    {isActive && isExpanded && (
                      <span className="w-1.5 h-6 bg-white/30 rounded ml-1 flex-shrink-0" aria-hidden />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      {/* Right-side subtle shadow */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 bottom-0 right-0 w-6 z-20"
        style={{ boxShadow: '8px 0 24px -8px rgba(2,6,23,0.08)' }}
      />
    </aside>
  )
}

export default EstoqueSidebar
