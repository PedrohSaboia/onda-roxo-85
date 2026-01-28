-- Trigger que envia pedido direto para logística quando for liberado
-- Não verifica estoque, apenas atualiza o status

create or replace function enviar_direto_logistica()
returns trigger as $$
begin
  -- Só executa quando o pedido for liberado (pedido_liberado = TRUE pela primeira vez)
  if (TG_OP = 'UPDATE' and NEW.pedido_liberado = true and OLD.pedido_liberado is distinct from true) then
    
    -- Envia direto para Logística + etiqueta pendente
    update pedidos
      set status_id = '3473cae9-47c8-4b85-96af-b41fe0e15fa9',
          etiqueta_envio_id = '0c0ff1fc-1c3b-4eff-9dec-a505d33f3e18'
    where id = NEW.id;

  end if;

  return NEW;
end;
$$ language plpgsql;

-- Cria o trigger (ajuste o nome da tabela se necessário)
create trigger trigger_enviar_direto_logistica
  after update on pedidos
  for each row
  execute function enviar_direto_logistica();
