-- Add embalgens_id to produtos
ALTER TABLE public.produtos
ADD COLUMN IF NOT EXISTS embalgens_id UUID NULL REFERENCES public.embalagens(id) ON DELETE SET NULL;

-- Optionally create an index to speed up joins
CREATE INDEX IF NOT EXISTS idx_produtos_embalgens_id ON public.produtos(embalgens_id);
