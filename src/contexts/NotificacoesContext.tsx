import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

// Cast para qualquer tipo para tabelas não definidas nos tipos
const supabaseAny = supabase as any;

// Interface da notificação retornada pela view_notificacoes
export interface Notificacao {
  notificacao_id: number;
  notificacao_criada_em: string;
  responsavel_id: string | null;
  pedido_id: string | null;
  titulo: string | null;
  mensagem: string | null;
  data_prog: string | null;
  id_externo: string | null;
  historico_id: number | null;
  lido: boolean | null;
  concluida: boolean | null;
  historico_criado_em: string | null;
}

// Reexportar como type
export type { Notificacao as NotificacaoType };

interface NotificacoesContextType {
  notificacoes: Notificacao[];
  naoLidas: number;
  lidasNaoConcluidas: number;
  marcarComoLida: (id: number) => Promise<void>;
  marcarTodasComoLidas: () => Promise<void>;
  marcarComoConcluida: (id: number) => Promise<void>;
  carregarNotificacoes: () => Promise<void>;
  verificarSeJaLida: (notificacaoId: number) => boolean;
}

const NotificacoesContext = createContext<NotificacoesContextType | undefined>(undefined);

export const useNotificacoes = () => {
  const context = useContext(NotificacoesContext);
  if (!context) {
    throw new Error('useNotificacoes deve ser usado dentro de NotificacoesProvider');
  }
  return context;
};

const copiarParaClipboard = async (texto: string, onCopiar?: () => Promise<void>) => {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success('ID copiado para a área de transferência!', {
      duration: 2000,
    });
    // Executar callback após copiar (para marcar como lida)
    if (onCopiar) {
      await onCopiar();
    }
  } catch (err) {
    toast.error('Erro ao copiar ID');
  }
};

interface NotificacaoToastProps {
  notificacao: Notificacao;
  onCopiar?: () => Promise<void>;
}

const NotificacaoToast = ({ notificacao, onCopiar }: NotificacaoToastProps) => {
  return (
    <div className="flex flex-col gap-2 min-w-[320px]">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-100 rounded-full">
          <Bell className="h-5 w-5 text-amber-600" />
        </div>
        <span className="font-bold text-gray-900 text-lg">{notificacao.titulo || 'Nova Notificação'}</span>
      </div>
      
      <p className="text-gray-600 text-sm leading-relaxed pl-12">
        {notificacao.mensagem || 'Você recebeu uma nova notificação'}
      </p>
      
      {notificacao.id_externo && (
        <div className="flex items-center gap-2 mt-2 ml-12 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
          <code className="text-amber-700 text-xs font-mono flex-1 truncate">
            ID: {notificacao.id_externo}
          </code>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 hover:bg-amber-100 text-gray-500 hover:text-amber-700 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              copiarParaClipboard(notificacao.id_externo!, onCopiar);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export const NotificacoesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [notificacoesLidas, setNotificacoesLidas] = useState<Set<number>>(new Set());
  const [naoLidas, setNaoLidas] = useState(0);
  const [lidasNaoConcluidas, setLidasNaoConcluidas] = useState(0);
  const { user } = useAuth();

  const carregarNotificacoes = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabaseAny
      .from('view_notificacoes')
      .select('*')
      .eq('responsavel_id', user.id)
      .order('notificacao_criada_em', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Erro ao carregar notificações:', error);
      return;
    }

    const notificacoesData = (data || []) as Notificacao[];
    
    // A view já traz a informação de lido do histórico
    const idsLidas = new Set(
      notificacoesData.filter(n => n.lido === true).map(n => n.notificacao_id)
    );
    setNotificacoesLidas(idsLidas);

    setNotificacoes(notificacoesData);
    setNaoLidas(notificacoesData.filter(n => !n.lido).length);
    
    // Calcular lidas mas não concluídas
    const lidasNaoConcluidasCount = notificacoesData.filter(
      n => n.lido === true && n.concluida !== true
    ).length;
    setLidasNaoConcluidas(lidasNaoConcluidasCount);
    
    // Mostrar aviso se houver mais de 2 lidas não concluídas
    if (lidasNaoConcluidasCount > 2) {
      toast.warning(`Você tem ${lidasNaoConcluidasCount} notificações lidas pendentes de conclusão`, {
        duration: 5000,
      });
    }
  }, [user?.id]);

  const verificarSeJaLida = (notificacaoId: number): boolean => {
    return notificacoesLidas.has(notificacaoId);
  };

  // Versão interna que não mostra toast (para uso no popup ao copiar)
  const marcarComoLidaInterno = async (id: number) => {
    if (!user?.id) return;

    // Inserir no histórico de notificações
    const { error } = await supabaseAny
      .from('historico_notificacoes')
      .insert({
        responsavel_id: user.id,
        notificacao_id: id,
        lido: true,
        concluida: false
      });

    if (!error) {
      // Recarregar notificações da view para ter os dados atualizados
      await carregarNotificacoes();
    } else {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const marcarComoLida = async (id: number) => {
    if (!user?.id) return;

    // Inserir no histórico de notificações
    const { error } = await supabaseAny
      .from('historico_notificacoes')
      .insert({
        responsavel_id: user.id,
        notificacao_id: id,
        lido: true,
        concluida: false
      });

    if (!error) {
      // Recarregar notificações da view para ter os dados atualizados
      await carregarNotificacoes();
      toast.success('Notificação marcada como lida');
    } else {
      console.error('Erro ao marcar como lida:', error);
      toast.error('Erro ao marcar notificação como lida');
    }
  };

  const marcarTodasComoLidas = async () => {
    if (!user?.id) return;

    const notificacoesNaoLidas = notificacoes.filter(n => !n.lido);
    
    // Inserir todas no histórico
    const inserts = notificacoesNaoLidas.map(n => ({
      responsavel_id: user.id,
      notificacao_id: n.notificacao_id,
      lido: true,
      concluida: false
    }));

    if (inserts.length === 0) return;

    const { error } = await supabaseAny
      .from('historico_notificacoes')
      .insert(inserts);

    if (!error) {
      // Recarregar notificações da view para ter os dados atualizados
      await carregarNotificacoes();
      toast.success('Todas as notificações foram marcadas como lidas');
    } else {
      console.error('Erro ao marcar todas como lidas:', error);
      toast.error('Erro ao marcar notificações como lidas');
    }
  };

  const marcarComoConcluida = async (id: number) => {
    if (!user?.id) return;

    // Encontrar o historico_id da notificação
    const notificacao = notificacoes.find(n => n.notificacao_id === id);
    if (!notificacao?.historico_id) {
      toast.error('Notificação não encontrada no histórico');
      return;
    }

    // Atualizar o campo concluida no histórico
    const { error } = await supabaseAny
      .from('historico_notificacoes')
      .update({ concluida: true })
      .eq('id', notificacao.historico_id);

    if (!error) {
      // Recarregar notificações da view para ter os dados atualizados
      await carregarNotificacoes();
      toast.success('Notificação marcada como concluída');
    } else {
      console.error('Erro ao marcar como concluída:', error);
      toast.error('Erro ao marcar notificação como concluída');
    }
  };

  const mostrarNotificacaoToast = (notificacao: Notificacao) => {
    // Criar callback para marcar como lida ao copiar
    const handleCopiar = async () => {
      // Se a notificação ainda não foi lida, marcar como lida
      if (!notificacao.lido) {
        await marcarComoLidaInterno(notificacao.notificacao_id);
      }
    };

    toast.custom(
      () => (
        <div 
          className="bg-white border-2 border-amber-500 rounded-xl p-4 shadow-2xl"
          style={{
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), 0 0 20px rgba(245, 158, 11, 0.2)',
          }}
        >
          <NotificacaoToast notificacao={notificacao} onCopiar={handleCopiar} />
        </div>
      ),
      {
        duration: 10000,
        position: 'top-right',
      }
    );
  };

  useEffect(() => {
    if (user?.id) {
      carregarNotificacoes();
    }
  }, [user?.id, carregarNotificacoes]);

  useEffect(() => {
    // Configurar listener em tempo real
    const channel = supabase
      .channel('notificacoes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
        },
        (payload) => {
          const rawNotificacao = payload.new as any;
          // Mapear para o formato da view
          const novaNotificacao: Notificacao = {
            notificacao_id: rawNotificacao.id,
            notificacao_criada_em: rawNotificacao.created_at,
            responsavel_id: rawNotificacao.responsavel_id,
            pedido_id: rawNotificacao.pedido_id,
            titulo: rawNotificacao.titulo,
            mensagem: rawNotificacao.mensagem,
            data_prog: rawNotificacao.data_prog,
            id_externo: rawNotificacao.id_externo,
            historico_id: null,
            lido: false,
            concluida: null,
            historico_criado_em: null
          };
          
          // Adicionar à lista
          setNotificacoes(prev => [novaNotificacao, ...prev]);
          setNaoLidas(prev => prev + 1);
          
          // Mostrar toast chamativo
          mostrarNotificacaoToast(novaNotificacao);
          
          // Tocar som de notificação (opcional)
          try {
            const audio = new Audio('/notification-sound.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => {});
          } catch (e) {
            // Ignorar erro de áudio
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <NotificacoesContext.Provider
      value={{
        notificacoes,
        naoLidas,
        lidasNaoConcluidas,
        marcarComoLida,
        marcarTodasComoLidas,
        marcarComoConcluida,
        carregarNotificacoes,
        verificarSeJaLida,
      }}
    >
      {children}
    </NotificacoesContext.Provider>
  );
};
