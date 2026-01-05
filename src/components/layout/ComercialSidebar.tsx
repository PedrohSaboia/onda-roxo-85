import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { List, Users, Send, XCircle } from 'lucide-react'

const items = [
  { id: 'pedidos', label: 'Lista de Pedidos', icon: List },
  { id: 'leads', label: 'Lista de Leads', icon: Users },
  { id: 'cancelados', label: 'Pedidos Cancelados', icon: XCircle },
  { id: 'enviados', label: 'Pedidos Enviados', icon: Send },
]

export function ComercialSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const view = params.get('view') || 'pedidos'
  const [isExpanded, setIsExpanded] = useState(false)

  const handleClick = (id: string) => {
    // Special-case: open the dedicated Leads page
    if (id === 'leads') {
      navigate('/leads');
      return;
    }

    // Special-case: open the dedicated PedidosCancelados page
    if (id === 'cancelados') {
      navigate('/pedidos-cancelados');
      return;
    }

    // Special-case: open the dedicated PedidosEnviados page
    if (id === 'enviados') {
      navigate('/pedidos-enviados');
      return;
    }

    const next = new URLSearchParams(location.search)
    next.set('view', id)
    // If we're currently on a dedicated route like /leads or /pedidos-enviados, navigate to the Comercial root
    // otherwise keep current pathname (expecting /comercial)
    const targetPath = (location.pathname === '/leads' || location.pathname === '/pedidos-enviados' || location.pathname === '/pedidos-cancelados') ? '/comercial' : location.pathname || '/comercial';
    navigate({ pathname: targetPath, search: next.toString() })
  }

  // Sidebar begins below header because it's rendered inside the page's main area
  return (
    <aside 
      className={`hidden lg:block relative h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out bg-[hsl(var(--secondary-background))] shadow-md ${
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
      <div className="sticky top-0 h-full overflow-hidden">
        <nav aria-label="Menu Comercial" className="h-full">
          <ul className="px-2 py-3 space-y-2 h-full">
            {items.map((it) => {
              const Icon = it.icon
              // When on the dedicated /leads or /pedidos-enviados route, mark the corresponding item active.
              let isActive = false;
              if (location.pathname === '/leads') {
                isActive = it.id === 'leads';
              } else if (location.pathname === '/pedidos-cancelados') {
                isActive = it.id === 'cancelados';
              } else if (location.pathname === '/pedidos-enviados') {
                isActive = it.id === 'enviados';
              } else {
                // Treat root or /comercial as the Comercial area
                const inComercial = location.pathname === '/' || location.pathname === '/comercial' || location.pathname.startsWith('/pedidos');
                isActive = view === it.id && inComercial;
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

export default ComercialSidebar
