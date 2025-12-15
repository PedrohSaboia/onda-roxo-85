-- Add status_up_sell column to itens_pedido if not exists
do $$ 
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'itens_pedido' 
    and column_name = 'status_up_sell'
  ) then
    alter table public.itens_pedido 
    add column status_up_sell bigint null;
    
    -- Add foreign key constraint
    alter table public.itens_pedido
    add constraint itens_pedido_status_up_sell_fkey 
    foreign key (status_up_sell) 
    references public.status_upsell (id);
    
    -- Add index for better performance
    create index if not exists idx_itens_pedido_status_up_sell 
    on public.itens_pedido(status_up_sell);
    
    -- Add comment
    comment on column public.itens_pedido.status_up_sell is 
    'ID do status de up-sell quando o item foi substituído por up-sell';
  end if;
end $$;
