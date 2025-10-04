-- Adicionar campos para integração com Melhor Envio na tabela pedidos
ALTER TABLE pedidos
ADD COLUMN IF NOT EXISTS id_melhor_envio TEXT,
ADD COLUMN IF NOT EXISTS carrinho_me BOOLEAN DEFAULT FALSE;

-- Adicionar comentários explicativos
COMMENT ON COLUMN pedidos.id_melhor_envio IS 'ID do pedido no carrinho do Melhor Envio (UUID retornado pela API)';
COMMENT ON COLUMN pedidos.carrinho_me IS 'Indica se o pedido foi adicionado ao carrinho do Melhor Envio';
