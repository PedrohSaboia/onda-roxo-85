-- Função: atualizar pedidos para logística quando o estoque é reposto
-- Regras principais:
-- 1) Disparada ao AUMENTAR qntd em `produtos` ou `variacoes_produto`.
-- 2) Procura pedidos com status `produção` ou `entrada logística` que tenham itens com `item_faltante = true`
--    relacionados ao produto/variação que foi reposto.
-- 3) Prioriza pedidos com `urgente = TRUE`, depois por `created_at` (mais antigos primeiro).
-- 4) Para cada pedido, tenta alocar (reservar) os itens que têm estoque suficiente:
--    - Faz SELECT ... FOR UPDATE nas linhas de estoque para evitar race conditions.
--    - Se o item puder ser atendido, decrementa o estoque e seta `itens_pedido.item_faltante = false`.
-- 5) Ao final por pedido: se todos os itens estiverem com estoque -> seta status = logística;
--    se ao menos 1 item foi atendido -> seta status = entrada logística;
--    caso contrário mantém o status (produção).

create or replace function public.atualizar_pedidos_para_logistica()
returns trigger as $$
declare
  -- tipos baseados nas colunas existentes para maior compatibilidade
  v_affected_produtos_id produtos.id%TYPE;
  v_affected_variacao_id variacoes_produto.id%TYPE;
  v_pedido record;
  item record;
  v_qntd int;
  v_total_itens int;
  v_itens_atendidos int;
begin
  -- Só prossegue quando houve aumento de quantidade
  if not (TG_OP = 'UPDATE' and NEW.qntd is distinct from OLD.qntd and NEW.qntd > OLD.qntd) then
    return NEW;
  end if;

  if TG_TABLE_NAME = 'produtos' then
    v_affected_produtos_id := NEW.id;
    v_affected_variacao_id := null;
  else
    -- Trigger foi disparada em variacoes_produto
    v_affected_variacao_id := NEW.id;
    select produto_id into v_affected_produtos_id from variacoes_produto where id = NEW.id;
  end if;

  -- Percorre pedidos candidatos: status produção OU entrada logística, que tenham itens pendentes para este produto/variação
  for v_pedido in
    select p.id
    from pedidos p
    where p.status_id in ('ce505c97-8a44-4e4b-956b-d837013b252e', '13fe767a-b4a6-4b9b-ac5e-a93c61f79e14')
      and exists (
        select 1 from itens_pedido ip
        where ip.pedido_id = p.id
          and ip.item_faltante = true
          and (
            (v_affected_variacao_id is not null and ip.variacao_id = v_affected_variacao_id)
            or (v_affected_variacao_id is null and ip.produto_id = v_affected_produtos_id)
          )
      )
    order by (case when p.urgente = true then 0 else 1 end), p.created_at
  loop
    v_total_itens := 0;
    v_itens_atendidos := 0;

    -- Para cada item do pedido, tentamos alocar quando possível
    for item in
      select * from itens_pedido where pedido_id = v_pedido.id
    loop
      v_total_itens := v_total_itens + 1;

      -- Só tentamos alocar se o item estiver marcado como faltante
      if item.item_faltante = true then
        if item.variacao_id is not null then
          -- trava a linha da variação e verifica quantidade
          select qntd into v_qntd from variacoes_produto where id = item.variacao_id for update;
          if coalesce(v_qntd,0) >= item.quantidade then
            update variacoes_produto set qntd = qntd - item.quantidade where id = item.variacao_id;
            update itens_pedido set item_faltante = false where id = item.id;
            v_itens_atendidos := v_itens_atendidos + 1;
          end if;
        else
          -- trava a linha do produto e verifica quantidade
          select qntd into v_qntd from produtos where id = item.produto_id for update;
          if coalesce(v_qntd,0) >= item.quantidade then
            update produtos set qntd = qntd - item.quantidade where id = item.produto_id;
            update itens_pedido set item_faltante = false where id = item.id;
            v_itens_atendidos := v_itens_atendidos + 1;
          end if;
        end if;
      else
        -- item já estava com estoque
        v_itens_atendidos := v_itens_atendidos + 1;
      end if;
    end loop;

    -- Atualiza o status do pedido conforme o resultado
    if v_total_itens > 0 and v_itens_atendidos = v_total_itens then
      update pedidos set status_id = '3473cae9-47c8-4b85-96af-b41fe0e15fa9' where id = v_pedido.id;
    elsif v_itens_atendidos > 0 then
      update pedidos set status_id = '13fe767a-b4a6-4b9b-ac5e-a93c61f79e14' where id = v_pedido.id;
    end if;
  end loop;

  return NEW;
end;
$$ language plpgsql security definer;

-- Triggers: um para produtos e outro para variações. Ambos disparam somente quando houve aumento de qntd.
drop trigger if exists trg_atualizar_pedidos_logistica_produtos on produtos;
create trigger trg_atualizar_pedidos_logistica_produtos
after update on produtos
for each row
when (OLD.qntd is distinct from NEW.qntd and NEW.qntd > OLD.qntd)
execute function public.atualizar_pedidos_para_logistica();

drop trigger if exists trg_atualizar_pedidos_logistica_variacoes on variacoes_produto;
create trigger trg_atualizar_pedidos_logistica_variacoes
after update on variacoes_produto
for each row
when (OLD.qntd is distinct from NEW.qntd and NEW.qntd > OLD.qntd)
execute function public.atualizar_pedidos_para_logistica();

-- Observações / Assunções:
-- - Assume que `pedidos` tem colunas boolean `urgente` e timestamp `created_at`.
-- - Assume que `itens_pedido` tem boolean `item_faltante`, numeric `quantidade`, e colunas `variacao_id`/`produto_id`.
-- - A função prioriza e processa pedidos na ordem pedida; usa SELECT ... FOR UPDATE para evitar condições de corrida.
-- Se seu esquema usar nomes diferentes (por exemplo, `urgent` ou `createdAt`), me diga que adapto.
