import React, { useState } from 'react';
import { Bell, Check, CheckCheck, Copy, Clock, Package, Eye, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificacoes } from '@/contexts/NotificacoesContext';
import type { Notificacao } from '@/contexts/NotificacoesContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const copiarParaClipboard = async (texto: string, notificacaoId: number, marcarComoLidaFn: (id: number) => Promise<void>, jaLida: boolean) => {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success('ID copiado!', { duration: 2000 });
    // Marcar como lida automaticamente ao copiar (se ainda não estiver lida)
    if (!jaLida) {
      await marcarComoLidaFn(notificacaoId);
    }
  } catch (err) {
    toast.error('Erro ao copiar');
  }
};

export const NotificacoesDropdown: React.FC = () => {
  const { notificacoes, naoLidas, lidasNaoConcluidas, marcarComoLida, marcarTodasComoLidas, marcarComoConcluida } = useNotificacoes();
  const [tabAtiva, setTabAtiva] = useState<'nao-lidas' | 'lidas'>('nao-lidas');
  const [filtroLidas, setFiltroLidas] = useState<'todas' | 'concluidas' | 'nao-concluidas'>('todas');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Helper para verificar se está lida
  const estaLida = (notif: any) => notif.lido === true;

  // Filtrar notificações baseado na tab ativa e filtro de lidas
  const notificacoesFiltradas = notificacoes.filter(n => {
    if (tabAtiva === 'nao-lidas') {
      return !estaLida(n);
    } else {
      // Tab lidas - aplicar filtro adicional
      if (!estaLida(n)) return false;
      if (filtroLidas === 'concluidas') return n.concluida === true;
      if (filtroLidas === 'nao-concluidas') return n.concluida !== true;
      return true; // 'todas'
    }
  });

  const totalLidas = notificacoes.filter(n => estaLida(n)).length;
  const totalConcluidas = notificacoes.filter(n => estaLida(n) && n.concluida === true).length;
  const totalNaoConcluidas = notificacoes.filter(n => estaLida(n) && n.concluida !== true).length;

  const handleTabChange = (novaTab: 'nao-lidas' | 'lidas') => {
    if (novaTab === tabAtiva) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setTabAtiva(novaTab);
      setIsTransitioning(false);
    }, 150);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="relative text-white hover:bg-white/10 transition-colors"
        >
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {naoLidas > 99 ? '99+' : naoLidas}
              </span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-[420px] p-0 bg-white border-gray-200 shadow-2xl"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Header */}
        <div style={{background: 'var(--gradient-primary)'}} className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-400" />
            <h3 className="font-semibold text-white">Notificações</h3>
            {naoLidas > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                {naoLidas}
              </span>
            )}
            {lidasNaoConcluidas > 2 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                {lidasNaoConcluidas} pendentes
              </span>
            )}
          </div>
          
          {naoLidas > 0 && tabAtiva === 'nao-lidas' && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-white hover:text-amber-100 hover:bg-white/10"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                marcarTodasComoLidas();
              }}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>

        {/* Tab Bar */}
        <div className="relative border-b border-gray-200 bg-gray-50">
          <div className="flex">
            <button
              onClick={() => handleTabChange('nao-lidas')}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium transition-all duration-200",
                tabAtiva === 'nao-lidas'
                  ? "text-amber-700 bg-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <span>Não lidas</span>
                {naoLidas > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full min-w-[18px] text-center">
                    {naoLidas}
                  </span>
                )}
              </div>
            </button>
            
            <button
              onClick={() => handleTabChange('lidas')}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium transition-all duration-200",
                tabAtiva === 'lidas'
                  ? "text-amber-700 bg-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <span>Lidas</span>
                {totalLidas > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 rounded-full min-w-[18px] text-center">
                    {totalLidas}
                  </span>
                )}
              </div>
            </button>
          </div>
          
          {/* Indicador animado */}
          <div 
            className="absolute bottom-0 h-0.5 w-1/2 bg-amber-600 transition-transform duration-300 ease-out"
            style={{
              transform: tabAtiva === 'nao-lidas' ? 'translateX(0%)' : 'translateX(100%)'
            }}
          />
        </div>

        {/* Filtro de lidas */}
        {tabAtiva === 'lidas' && (
          <div className="flex items-center gap-1 p-2 bg-gray-50 border-b border-gray-200">
            <button
              onClick={() => setFiltroLidas('todas')}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full transition-all",
                filtroLidas === 'todas'
                  ? "bg-gray-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Todas ({totalLidas})
            </button>
            <button
              onClick={() => setFiltroLidas('nao-concluidas')}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full transition-all",
                filtroLidas === 'nao-concluidas'
                  ? "bg-orange-500 text-white"
                  : "bg-orange-50 text-orange-700 hover:bg-orange-100"
              )}
            >
              Pendentes ({totalNaoConcluidas})
            </button>
            <button
              onClick={() => setFiltroLidas('concluidas')}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full transition-all",
                filtroLidas === 'concluidas'
                  ? "bg-emerald-500 text-white"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              )}
            >
              Concluídas ({totalConcluidas})
            </button>
          </div>
        )}

        {/* Lista de Notificações */}
        <ScrollArea className="h-[400px]">
          <div 
            className={cn(
              "transition-all duration-200",
              isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
            )}
          >
            {notificacoesFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
              <Bell className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm">
                {tabAtiva === 'nao-lidas' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação lida'}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {notificacoesFiltradas.map((notificacao) => (
                <div
                  key={notificacao.notificacao_id}
                  className={cn(
                    "p-4 rounded-lg border transition-colors group",
                    tabAtiva === 'nao-lidas'
                      ? "bg-amber-50 border-amber-200 hover:bg-amber-100/50"
                      : tabAtiva === 'lidas' && notificacao.concluida
                        ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100/50"
                        : "bg-white border-gray-200 hover:bg-gray-50",
                    // Animação pulsante para lidas não concluídas
                    tabAtiva === 'lidas' && !notificacao.concluida && "animate-pulse-subtle"
                  )}
                  style={{
                    ...(tabAtiva === 'lidas' && !notificacao.concluida ? {
                      animation: 'pulse-glow 2s ease-in-out infinite',
                    } : {})
                  }}
                >
                  <div className="flex gap-2">
                    <div className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0",
                      tabAtiva === 'nao-lidas'
                        ? "bg-amber-100 text-amber-600"
                        : tabAtiva === 'lidas' && notificacao.concluida
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-gray-200 text-gray-400"
                    )}>
                      <Package className="h-4 w-4" />
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <h4 className="font-medium text-sm text-gray-900">
                            {notificacao.titulo || 'Notificação'}
                          </h4>
                          {tabAtiva === 'lidas' && notificacao.concluida && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded-full">
                              <CheckCircle2 className="h-3 w-3" />
                              Concluída
                            </span>
                          )}
                        </div>
                        
                        {tabAtiva === 'nao-lidas' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-amber-100 text-amber-700"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              marcarComoLida(notificacao.notificacao_id);
                            }}
                            title="Marcar como lida"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            <span className="text-xs">Lida</span>
                          </Button>
                        )}
                        
                        {tabAtiva === 'lidas' && !notificacao.concluida && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-100 text-green-700"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              marcarComoConcluida(notificacao.notificacao_id);
                            }}
                            title="Marcar como concluída"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            <span className="text-xs">Concluir</span>
                          </Button>
                        )}
                      </div>

                      <p className="text-xs mt-1 line-clamp-2 text-gray-600">
                        {notificacao.mensagem || 'Sem mensagem'}
                      </p>

                      {/* ID Externo com botão de copiar */}
                      {notificacao.valor_copiar && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md border border-gray-200 max-w-full">
                            <code className="text-[11px] font-mono text-amber-700 truncate">
                              {notificacao.valor_copiar}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 hover:bg-amber-100 flex-shrink-0"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                copiarParaClipboard(notificacao.valor_copiar!, notificacao.notificacao_id, marcarComoLida, estaLida(notificacao));
                              }}
                              title="Copiar ID"
                            >
                              <Copy className="h-3 w-3 text-gray-500 hover:text-amber-700" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(notificacao.notificacao_criada_em), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </ScrollArea>

        {/* Estilos para animação pulsante */}
        <style>{`
          @keyframes pulse-glow {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(251, 146, 60, 0);
              border-color: rgb(229, 231, 235);
            }
            50% {
              box-shadow: 0 0 8px 2px rgba(251, 146, 60, 0.4);
              border-color: rgb(251, 146, 60);
            }
          }
        `}</style>

        {/* Footer */}
        {notificacoesFiltradas.length > 0 && (
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <p className="text-center text-xs text-gray-400">
              {tabAtiva === 'nao-lidas' 
                ? `${notificacoesFiltradas.length} notificação${notificacoesFiltradas.length > 1 ? 'ões' : ''} não lida${notificacoesFiltradas.length > 1 ? 's' : ''}`
                : `${notificacoesFiltradas.length} notificação${notificacoesFiltradas.length > 1 ? 'ões' : ''} lida${notificacoesFiltradas.length > 1 ? 's' : ''}`
              }
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
