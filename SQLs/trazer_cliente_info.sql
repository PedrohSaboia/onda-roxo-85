CREATE OR REPLACE FUNCTION public.trazer_cliente_info(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Se o formulário já foi enviado, retorna apenas { "mensagem": "Formulário já preenchido" }.
  -- Caso contrário, retorna um objeto JSON com os campos do cliente.
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id AND coalesce(formulario_enviado, false) = true)
      THEN jsonb_build_object('mensagem', 'Formulário já preenchido')
    ELSE (
      SELECT jsonb_build_object(
        'cliente_id', id,
        'cliente_nome', nome,
        'cliente_email', email,
        'cliente_cpf', cpf,
        'cliente_cnpj', cnpj,
        'cliente_telefone', telefone,
        'cliente_endereco', endereco,
        'cliente_bairro', bairro,
        'cliente_cidade', cidade,
        'cliente_uf', estado,
        'cliente_numero', numero,
        'cliente_cep', cep,
        'cliente_complemento', complemento,
        'cliente_observacao', observacao
      ) FROM public.clientes WHERE id = p_cliente_id
    )
  END;
$$;