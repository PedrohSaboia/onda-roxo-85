import { supabase } from '@/integrations/supabase/client';

export interface HistoricoMovimentacao {
  id: number;
  created_at: string;
  alteracao: string;
  user_id: string | null;
  pedido_id: string | null;
  usuario?: {
    nome: string;
    email: string;
    img_url?: string;
  };
  pedido?: {
    id_externo: string;
  };
}

/**
 * Registra uma movimentação no histórico
 * @param pedidoId - ID do pedido
 * @param alteracao - Descrição da alteração realizada
 * @param userId - ID do usuário que realizou a alteração (opcional, usa o usuário logado se não informado)
 */
export async function registrarHistoricoMovimentacao(
  pedidoId: string,
  alteracao: string,
  userId?: string
) {
  try {
    // Se não passou userId, pega o usuário logado
    let user_id = userId;
    if (!user_id) {
      const { data: { user } } = await supabase.auth.getUser();
      user_id = user?.id || null;
    }

    const { error } = await (supabase as any)
      .from('historico_movimentacoes')
      .insert({
        pedido_id: pedidoId,
        alteracao,
        user_id,
      });

    if (error) {
      console.error('Erro ao registrar histórico de movimentação:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.error('Erro ao registrar histórico de movimentação:', err);
    return { success: false, error: err };
  }
}

/**
 * Busca o histórico de movimentações com filtros
 */
export async function buscarHistoricoMovimentacoes(filters?: {
  pedidoId?: string;
  userId?: string;
  dataInicio?: string;
  dataFim?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    let query = (supabase as any)
      .from('historico_movimentacoes')
      .select(`
        *,
        usuario:user_id (
          nome,
          email,
          img_url
        ),
        pedido:pedido_id (
          id_externo
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.pedidoId) {
      query = query.eq('pedido_id', filters.pedidoId);
    }

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters?.dataInicio) {
      query = query.gte('created_at', filters.dataInicio);
    }

    if (filters?.dataFim) {
      query = query.lte('created_at', filters.dataFim);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar histórico de movimentações:', error);
      return { data: null, error };
    }

    return { data: data as HistoricoMovimentacao[], error: null };
  } catch (err) {
    console.error('Erro ao buscar histórico de movimentações:', err);
    return { data: null, error: err };
  }
}
