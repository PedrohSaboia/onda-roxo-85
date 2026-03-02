CREATE OR REPLACE FUNCTION producao_get_itens(
  p_end timestamptz,
  p_start timestamptz DEFAULT NULL
)
RETURNS TABLE (
  quantidade        integer,
  pedido_id         uuid,
  produto_id        uuid,
  variacao_id       uuid,
  nome_produto      text,
  img_url_produto   text,
  nome_variacao     text,
  img_url_variacao  text,
  criado_em         timestamptz,
  id_externo        text,
  status_id         uuid,
  urgente           boolean,
  plataforma_id     uuid,
  plataforma_nome   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    ip.quantidade::integer,
    ip.pedido_id,
    ip.produto_id,
    ip.variacao_id,
    pr.nome            AS nome_produto,
    pr.img_url         AS img_url_produto,
    vp.nome            AS nome_variacao,
    vp.img_url         AS img_url_variacao,
    ped.criado_em,
    ped.id_externo,
    ped.status_id,
    ped.urgente,
    pl.id              AS plataforma_id,
    pl.nome            AS plataforma_nome
  FROM itens_pedido ip
  JOIN pedidos     ped ON ped.id  = ip.pedido_id
  JOIN plataformas pl  ON pl.id   = ped.plataforma_id
  LEFT JOIN produtos          pr  ON pr.id = ip.produto_id
  LEFT JOIN variacoes_produto vp  ON vp.id = ip.variacao_id
  WHERE ped.status_id = ANY(ARRAY[
    '3473cae9-47c8-4b85-96af-b41fe0e15fa9'::uuid,
    '13fe767a-b4a6-4b9b-ac5e-a93c61f79e14'::uuid,
    '3ca23a64-cb1e-480c-8efa-0468ebc18097'::uuid,
    'ce505c97-8a44-4e4b-956b-d837013b252e'::uuid
  ])
  AND ped.criado_em <= p_end
  AND (p_start IS NULL OR ped.criado_em >= p_start);
$$;
