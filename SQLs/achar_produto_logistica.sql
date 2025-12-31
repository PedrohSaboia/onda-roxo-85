-- Procura um item em logística pelo código de barras seguindo prioridade definida
-- Regras de ordenação aplicadas (na ordem):
-- 1) urgente = TRUE primeiro
-- 2) pedidos mais antigos (criado_em asc)
-- 3) itens unitários (quantidade = 1) primeiro
-- 4) pedidos que pedem mais quantidade do mesmo item (quantidade desc)
-- 5) pedidos com menos itens distintos (quantidade_itens_pedido asc)

create or replace function public.achar_item_por_codigo_bipado(codigo_bipado text)
returns table(
  item_pedido_id uuid,
  pedido_id uuid,
  produto_id uuid,
  variacao_id uuid
) as $$
begin
  return query
  select
    ipc.id,
    ipc.pedido_id,
    ipc.produto_id,
    ipc.variacao_id
  from itens_pedidos_completos ipc
  where ipc.codigo_barras = codigo_bipado
    and ipc.status_id = '3473cae9-47c8-4b85-96af-b41fe0e15fa9' -- logística
  order by
    (case when ipc.urgente = true then 0 else 1 end), -- urgente primeiro
    ipc.criado_em asc, -- mais antigos primeiro
    (case when ipc.quantidade = 1 then 0 else 1 end), -- unitários primeiro
    ipc.quantidade desc, -- maior quantidade do mesmo item em seguida
    ipc.quantidade_itens_pedido asc -- pedidos com menos itens distintos primeiro
  limit 1;
end;
$$ language plpgsql security definer;

-- Retorna 0 linhas quando não houver correspondência.
