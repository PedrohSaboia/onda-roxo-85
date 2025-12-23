-- Função: enviar_informacoes_cliente
-- Atualiza (ou insere) informações de entrega do cliente e marca formulario_enviado = true
CREATE OR REPLACE FUNCTION public.enviar_informacoes_cliente(
	p_cliente_id uuid,
	p_nome text,
	p_cpf text DEFAULT NULL,
	p_cnpj text DEFAULT NULL,
	p_email text DEFAULT NULL,
	p_telefone text DEFAULT NULL,
	p_cep text DEFAULT NULL,
	p_endereco text DEFAULT NULL,
	p_numero text DEFAULT NULL,
	p_complemento text DEFAULT NULL,
	p_observacao text DEFAULT NULL,
	p_bairro text DEFAULT NULL,
	p_cidade text DEFAULT NULL,
	p_estado text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
	v_exists boolean;
	v_result record;
BEGIN
	IF p_cliente_id IS NULL THEN
		RETURN jsonb_build_object('success', false, 'message', 'cliente_id is required');
	END IF;

	SELECT EXISTS(SELECT 1 FROM public.clientes WHERE id = p_cliente_id) INTO v_exists;

	IF v_exists THEN
		UPDATE public.clientes
		SET
			nome = COALESCE(p_nome, nome),
			cpf = CASE WHEN p_cpf IS NOT NULL THEN p_cpf ELSE cpf END,
			cnpj = CASE WHEN p_cnpj IS NOT NULL THEN p_cnpj ELSE cnpj END,
			email = COALESCE(p_email, email),
			telefone = COALESCE(p_telefone, telefone),
			cep = COALESCE(p_cep, cep),
			endereco = COALESCE(p_endereco, endereco),
			numero = COALESCE(p_numero, numero),
			complemento = COALESCE(p_complemento, complemento),
			observacao = COALESCE(p_observacao, observacao),
			bairro = COALESCE(p_bairro, bairro),
			cidade = COALESCE(p_cidade, cidade),
			estado = COALESCE(p_estado, estado),
			formulario_enviado = true,
			atualizado_em = now()
		WHERE id = p_cliente_id
		RETURNING id, nome, cpf, cnpj, email, telefone, cep, endereco, numero, complemento, observacao, bairro, cidade, estado, formulario_enviado
		INTO v_result;

		RETURN jsonb_build_object('success', true, 'cliente', to_jsonb(v_result.nome));
	ELSE
		-- Se o cliente não existe, não inserir: retornar erro para o cliente não encontrado
		RETURN jsonb_build_object('success', false, 'message', 'Cliente não encontrado');
	END IF;
EXCEPTION
	WHEN OTHERS THEN
		RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Grant execute to authenticated role if using Supabase (adjust role name if needed)
-- GRANT EXECUTE ON FUNCTION public.enviar_informacoes_cliente(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean) TO authenticated;

