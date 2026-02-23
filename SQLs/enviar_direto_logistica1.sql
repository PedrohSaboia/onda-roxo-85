
begin
  -- Só executa quando o pedido for liberado (pedido_liberado = TRUE pela primeira vez)
  if (TG_OP = 'UPDATE' and NEW.pedido_liberado = true and OLD.pedido_liberado is distinct from true) then
    
    -- Envia direto para Logística + etiqueta pendente
    update pedidos
      set status_id = '3473cae9-47c8-4b85-96af-b41fe0e15fa9',
          etiqueta_envio_id = '0c0ff1fc-1c3b-4eff-9dec-a505d33f3e18'
    where id = NEW.id;

    -- Registrar no histórico de movimentações (sem user_id pois é automático)
    insert into historico_movimentacoes (pedido_id, alteracao, user_id)
    values (NEW.id, 'Pedido liberado e enviado automaticamente para Logística com etiqueta pendente', null);

  end if;

  return NEW;
end;
