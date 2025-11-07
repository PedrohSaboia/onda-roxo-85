create or replace function public.verificar_estoque_e_atualizar_status()
returns trigger as $$
declare
  item record;
  v_total_itens int := 0;
  v_itens_com_estoque int := 0;
  v_itens_sem_estoque int := 0;
  v_prod_qntd int;
  v_var_qntd int;
begin
  -- Só executa quando o pedido for liberado (pedido_liberado = TRUE pela primeira vez)
  if (TG_OP = 'UPDATE' and NEW.pedido_liberado = true and OLD.pedido_liberado is distinct from true) then
    
    -- Conta e analisa os itens do pedido
    for item in
      select * from itens_pedido where pedido_id = NEW.id
    loop
      v_prod_qntd := null;
      v_var_qntd := null;

      -- Verifica variação
      if item.variacao_id is not null then
        select qntd into v_var_qntd from variacoes_produto where id = item.variacao_id;
      end if;

      -- Se não tiver variação, pega do produto
      if v_var_qntd is null then
        select qntd into v_prod_qntd from produtos where id = item.produto_id;
      end if;

      v_total_itens := v_total_itens + 1;

      -- Verifica se há estoque suficiente
      if coalesce(v_var_qntd, v_prod_qntd, 0) >= item.quantidade then
        v_itens_com_estoque := v_itens_com_estoque + 1;
      else
        v_itens_sem_estoque := v_itens_sem_estoque + 1;

        -- Marca o item do pedido como faltante quando não houver estoque suficiente
        update itens_pedido
          set item_faltante = true
        where id = item.id;
      end if;
    end loop;

    -- Caso 1: Todos os itens têm estoque → Logística + etiqueta pendente
    if v_itens_com_estoque = v_total_itens then
      update pedidos
        set status_id = '3473cae9-47c8-4b85-96af-b41fe0e15fa9',
            etiqueta_envio_id = '0c0ff1fc-1c3b-4eff-9dec-a505d33f3e18'
      where id = NEW.id;

      -- Desconta estoque de todos os itens
      for item in
        select * from itens_pedido where pedido_id = NEW.id
      loop
        if item.variacao_id is not null then
          update variacoes_produto
            set qntd = qntd - item.quantidade
          where id = item.variacao_id;
        else
          update produtos
            set qntd = qntd - item.quantidade
          where id = item.produto_id;
        end if;
      end loop;

    -- Caso 2: Alguns têm estoque → Entrada Logística
    elsif v_itens_com_estoque > 0 then
      update pedidos
        set status_id = '13fe767a-b4a6-4b9b-ac5e-a93c61f79e14'
      where id = NEW.id;

      -- Desconta apenas dos que têm estoque suficiente
      for item in
        select * from itens_pedido where pedido_id = NEW.id
      loop
        v_prod_qntd := null;
        v_var_qntd := null;

        if item.variacao_id is not null then
          select qntd into v_var_qntd from variacoes_produto where id = item.variacao_id;
        end if;
        if v_var_qntd is null then
          select qntd into v_prod_qntd from produtos where id = item.produto_id;
        end if;

        if coalesce(v_var_qntd, v_prod_qntd, 0) >= item.quantidade then
          if item.variacao_id is not null then
            update variacoes_produto
              set qntd = qntd - item.quantidade
            where id = item.variacao_id;
          else
            update produtos
              set qntd = qntd - item.quantidade
            where id = item.produto_id;
          end if;
        else
          -- Marca o item do pedido como faltante quando não houver estoque suficiente
          update itens_pedido
            set item_faltante = true
          where id = item.id;
        end if;
      end loop;

    -- Caso 3: Nenhum item tem estoque → Produção
    else
      update pedidos
        set status_id = 'ce505c97-8a44-4e4b-956b-d837013b252e'
      where id = NEW.id;

  -- Marca todos os itens do pedido como faltantes (nenhum item tinha estoque)
  update itens_pedido
  set item_faltante = true
  where pedido_id = NEW.id;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- Remove e recria o trigger
drop trigger if exists trigger_verificar_estoque_e_atualizar_status on pedidos;

create trigger trigger_verificar_estoque_e_atualizar_status
after update on pedidos
for each row
execute function public.verificar_estoque_e_atualizar_status();
