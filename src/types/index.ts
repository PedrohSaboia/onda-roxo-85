export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: 'admin' | 'operador';
  avatar?: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Plataforma {
  id: string;
  nome: string;
  cor: string;
  imagemUrl?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Status {
  id: string;
  nome: string;
  corHex: string;
  ordem: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Produto {
  id: string;
  nome: string;
  sku: string;
  preco: number;
  unidade: string;
  categoria: string;
  imagemUrl?: string;
  variacoes?: Array<{
    id: string;
    nome: string;
    sku: string;
    valor: number;
    qntd: number;
    img_url?: string | null;
  }>;
  nomeVariacao?: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Variacao {
  id: string;
  produtoId: string;
  atributo: string;
  valor: string;
  precoMin: number;
  qtd: number;
  skuVar: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ItemPedido {
  id: string;
  pedidoId: string;
  produtoId: string;
  variacaoId?: string;
  qtd: number;
  precoUnit: number;
  produto?: Produto;
  variacao?: Variacao;
  criadoEm: string;
  atualizadoEm: string;
}

export type EtiquetaEnvio = 'NAO_LIBERADO' | 'PENDENTE' | 'DISPONIVEL';

export interface TipoEtiqueta {
  id: string;
  nome: string;
  corHex: string;
  ordem: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Pedido {
  id: string;
  idExterno: string;
  clienteNome: string;
  clienteEmail?: string;
  clienteCpf?: string;
  clienteCnpj?: string;
  contato: string;
  responsavelId: string;
  plataformaId: string;
  statusId: string;
  etiquetaEnvio: EtiquetaEnvio;
  etiqueta?: TipoEtiqueta;
  urgente: boolean;
  dataPrevista?: string;
  observacoes: string;
  itens: ItemPedido[];
  responsavel?: Usuario;
  plataforma?: Plataforma;
  transportadora?: { id?: string; nome?: string; imagemUrl?: string; raw?: any };
  status?: Status;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DashboardMetrics {
  totalPedidos: number;
  pedidosHoje: number;
  pedidosSemana: number;
  pedidosPorStatus: Array<{
    status: Status;
    count: number;
  }>;
  pedidosPorPlataforma: Array<{
    plataforma: Plataforma;
    count: number;
  }>;
  etiquetasEnvio: {
    naoLiberado: number;
    pendente: number;
    disponivel: number;
  };
}

export interface ModuloConfig {
  id: string;
  nome: string;
  rotulo: string;
  ativo: boolean;
}