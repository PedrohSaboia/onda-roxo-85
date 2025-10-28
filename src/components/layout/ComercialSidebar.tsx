import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { List, Users, Send } from 'lucide-react'

const items = [
  { id: 'pedidos', label: 'Lista de Pedidos', icon: List },
  { id: 'leads', label: 'Lista de Leads', icon: Users },
  { id: 'enviados', label: 'Pedidos Enviados', icon: Send },
]

export function ComercialSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const currentModule = params.get('module') || ''
  const view = params.get('view') || 'pedidos'

  const handleClick = (id: string) => {
    // keep module=comercial while switching view
    const next = new URLSearchParams(location.search)
    next.set('module', 'comercial')
    next.set('view', id)
    navigate({ pathname: location.pathname, search: next.toString() })
  }

  // Sidebar begins below header because it's rendered inside the page's main area
  return (
    // make the aside full height below header (header is h-16 => 4rem)
      <aside className="w-60 hidden lg:block relative h-[calc(100vh-4rem)]">{/* increased width a bit; full height */}
      <div className="sticky top-0 h-full overflow-auto">{/* touch header (no gap); allow scrolling if content overflows */}
        <nav aria-label="Menu Comercial">
          {/* reduced horizontal padding to avoid compressing labels */}
          <ul className="px-3 py-3 space-y-2">{/* options directly in menu (no surrounding card) */}
            {items.map((it) => {
              const Icon = it.icon
              const isActive = view === it.id && currentModule === 'comercial'
              return (
                <li key={it.id}>
                  <button
                    onClick={() => handleClick(it.id)}
                    className={`w-full flex items-center gap-3 text-sm rounded-md px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                      isActive
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-slate-700 hover:bg-purple-50 hover:text-purple-700'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className={`p-1 rounded-md ${isActive ? 'bg-white/20' : 'bg-transparent'}`}>
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-600'}`} />
                    </span>
                      <span className={`flex-1 text-left whitespace-nowrap`}>{it.label}</span>
                    {isActive && <span className="w-1.5 h-6 bg-white/30 rounded ml-1" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      {/* Right-side subtle shadow like Melhor Envio */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 bottom-0 right-0 w-6 z-20"
        style={{ boxShadow: '8px 0 24px -8px rgba(2,6,23,0.08)' }}
      />
    </aside>
  )
}

export default ComercialSidebar
