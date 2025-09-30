-- Add nome_variacao to produtos (attribute name for variations)
ALTER TABLE public.produtos
ADD COLUMN IF NOT EXISTS nome_variacao TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_produtos_nome_variacao ON public.produtos(nome_variacao);
