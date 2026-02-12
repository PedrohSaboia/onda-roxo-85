import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TbTruck, TbFileUpload, TbPackageExport } from 'react-icons/tb'

const items = [
  { id: 'envio-pedidos', label: 'Envio de pedidos', icon: TbTruck, path: '/logistica' },
  { id: 'envio-etiqueta', label: 'Envio por etiqueta', icon: TbFileUpload, path: '/envio-por-etiqueta' },
  { id: 'envio-retornados', label: 'Envio de retornados', icon: TbPackageExport, path: null, badge: 'Em desenvolvimento' },
]

export function LogisticaSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isExpanded, setIsExpanded] = useState(false)

  const handleClick = (item: typeof items[0]) => {
    if (!item.path) {
      // Item em desenvolvimento
      return;
    }
    navigate(item.path);
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
        <nav aria-label="Menu Logística" className="h-full">
          <ul className="px-2 py-3 space-y-2 h-full">
            {items.map((it) => {
              const Icon = it.icon
              const isActive = location.pathname === it.path;
              const isDisabled = !it.path;
              
              return (
                <li key={it.id}>
                  <button
                    onClick={() => handleClick(it)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 text-sm rounded-md px-3 py-2.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-custom-400 ${
                      isDisabled
                        ? 'text-slate-400 cursor-not-allowed opacity-60'
                        : isActive
                        ? 'bg-custom-600 text-white font-medium'
                        : 'text-slate-700 hover:bg-custom-50 hover:text-custom-700'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                    title={!isExpanded ? it.label : undefined}
                  >
                    <span className={`flex-shrink-0 p-1 rounded-md ${isActive ? 'bg-white/20' : 'bg-transparent'}`}>
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : isDisabled ? 'text-slate-400' : 'text-custom-600'}`} />
                    </span>
                    <span 
                      className={`flex-1 text-left whitespace-nowrap transition-all duration-300 ${
                        isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
                      }`}
                    >
                      {it.label}
                    </span>
                    {it.badge && isExpanded && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full flex-shrink-0">
                        {it.badge}
                      </span>
                    )}
                    {isActive && isExpanded && !it.badge && (
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

export default LogisticaSidebar
