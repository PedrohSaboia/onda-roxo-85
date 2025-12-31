-- Função: set_usuario_permissao
-- Ativa ou desativa uma permissão para um usuário.
CREATE OR REPLACE FUNCTION public.set_usuario_permissao(
  p_usuario_id uuid,
  p_permissao_id integer,
  p_value boolean
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
  tbl text;
BEGIN
  -- usar tabela específica `usuarios_permissoes` com colunas `user_id` e `permissao_id`
  tbl := 'public.usuarios_permissoes';

  IF p_value THEN
    -- inserir somente se não existir a associação (verifica por existência)
    IF NOT EXISTS (SELECT 1 FROM public.usuarios_permissoes WHERE user_id = p_usuario_id AND permissao_id = p_permissao_id) THEN
      INSERT INTO public.usuarios_permissoes(user_id, permissao_id) VALUES (p_usuario_id, p_permissao_id);
    END IF;
  ELSE
    -- remover se existir
    DELETE FROM public.usuarios_permissoes WHERE user_id = p_usuario_id AND permissao_id = p_permissao_id;
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

