-- Criar tabela de tipos de etiqueta
CREATE TABLE public.tipos_etiqueta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cor_hex TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir tipos de etiqueta padrão
INSERT INTO public.tipos_etiqueta (nome, cor_hex, ordem) VALUES
('Não Liberado', '#6B7280', 1),
('Pendente', '#F59E0B', 2),
('Disponível', '#10B981', 3);

-- Criar tabela de usuários
CREATE TABLE public.usuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, 
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  acesso TEXT NOT NULL CHECK (acesso IN ('admin', 'operador', 'visualizador')), 
  img_url TEXT, 
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de plataformas
CREATE TABLE public.plataformas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de status
CREATE TABLE public.status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cor_hex TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  cpf TEXT,
  cnpj TEXT,
  telefone TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  numero TEXT,
  cep TEXT,
  complemento TEXT,
  link_formulario TEXT,
  formulario_enviado BOOLEAN DEFAULT false,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de produtos
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  preco DECIMAL(10,2) NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'un',
  categoria TEXT,
  img_url TEXT,
  qntd INTEGER DEFAULT 0,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de variações de produtos
CREATE TABLE public.variacoes_produto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  valor DECIMAL(10,2) NOT NULL,
  img_url TEXT,
  qntd INTEGER DEFAULT 0,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de pedidos
CREATE TABLE public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_externo TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  cliente_nome TEXT NOT NULL,
  contato TEXT,
  responsavel_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  plataforma_id UUID REFERENCES public.plataformas(id) ON DELETE SET NULL,
  status_id UUID REFERENCES public.status(id) ON DELETE SET NULL,
  etiqueta_envio_id UUID REFERENCES public.tipos_etiqueta(id) ON DELETE SET NULL,
  urgente BOOLEAN NOT NULL DEFAULT false,
  data_prevista DATE,
  observacoes TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de itens do pedido
CREATE TABLE public.itens_pedido (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
  variacao_id UUID REFERENCES public.variacoes_produto(id) ON DELETE SET NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10,2) NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.tipos_etiqueta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plataformas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variacoes_produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para usuários autenticados
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.tipos_etiqueta FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.usuarios FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.plataformas FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.status FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.clientes FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.pedidos FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.produtos FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.variacoes_produto FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.itens_pedido FOR ALL TO authenticated USING (true);

-- Criar função para atualizar timestamp automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar triggers para atualizar automaticamente o campo atualizado_em
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.tipos_etiqueta FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.plataformas FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.status FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.variacoes_produto FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.itens_pedido FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();