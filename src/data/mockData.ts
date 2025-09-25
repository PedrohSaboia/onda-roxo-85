import { Usuario, Plataforma, Status, Pedido, Produto } from '../types';

export const mockUsuarios: Usuario[] = [
  {
    id: '1',
    nome: 'Pedro Sabóia',
    email: 'pedro@tridi.com.br',
    papel: 'admin',
    avatar: '/api/placeholder/40/40',
    ativo: true,
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    nome: 'Ana Silva',
    email: 'ana@tridi.com.br',
    papel: 'operador',
    avatar: '/api/placeholder/40/40',
    ativo: true,
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
];

export const mockPlataformas: Plataforma[] = [
  {
    id: '1',
    nome: 'Yampi',
    cor: '#E91E63',
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    nome: 'Shopee',
    cor: '#FF6B35',
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    nome: 'WhatsApp',
    cor: '#25D366',
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
];

export const mockStatus: Status[] = [
  {
    id: '1',
    nome: 'Sem Arte',
    corHex: '#6B7280',
    ordem: 1,
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    nome: 'Com Arte',
    corHex: '#3B82F6',
    ordem: 2,
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    nome: 'Aumento T',
    corHex: '#F59E0B',
    ordem: 3,
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
  {
    id: '4',
    nome: 'Aguardando Aprovação',
    corHex: '#EF4444',
    ordem: 4,
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
  {
    id: '5',
    nome: 'Aprovado',
    corHex: '#10B981',
    ordem: 5,
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
  {
    id: '6',
    nome: 'Em produção',
    corHex: '#8B5CF6',
    ordem: 6,
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
];

export const mockProdutos: Produto[] = [
  {
    id: '1',
    nome: 'Almofada para Carimbo',
    sku: 'ALM001',
    preco: 46.90,
    unidade: 'un',
    categoria: 'Carimbos',
    imagemUrl: '/api/placeholder/60/60',
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    nome: 'Carimbo Personalizado',
    sku: 'CAR001',
    preco: 142.90,
    unidade: 'un',
    categoria: 'Carimbos',
    imagemUrl: '/api/placeholder/60/60',
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    nome: 'Tinta para Madeira',
    sku: 'TIN001',
    preco: 20.80,
    unidade: 'un',
    categoria: 'Tintas',
    imagemUrl: '/api/placeholder/60/60',
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
  },
];

export const mockPedidos: Pedido[] = [
  {
    id: '1',
    idExterno: '96059-6607',
    clienteNome: 'Gislene Ferreira da Costa Belo Rodrigues',
    contato: '11960596607',
    responsavelId: '1',
    plataformaId: '1',
    statusId: '2',
    etiquetaEnvio: 'NAO_LIBERADO',
    urgente: false,
    dataPrevista: '2024-08-28',
    observacoes: 'Entrega no período da manhã',
    itens: [],
    criadoEm: '2024-08-25T10:39:00Z',
    atualizadoEm: '2024-08-25T10:39:00Z',
  },
  {
    id: '2',
    idExterno: '78287971484242',
    clienteNome: 'Maria Silva Santos',
    contato: '11987654321',
    responsavelId: '2',
    plataformaId: '2',
    statusId: '1',
    etiquetaEnvio: 'NAO_LIBERADO',
    urgente: true,
    observacoes: '',
    itens: [],
    criadoEm: '2024-08-25T09:15:00Z',
    atualizadoEm: '2024-08-25T09:15:00Z',
  },
  {
    id: '3',
    idExterno: '782873650587',
    clienteNome: 'João Pedro Costa',
    contato: '11912345678',
    responsavelId: '1',
    plataformaId: '3',
    statusId: '3',
    etiquetaEnvio: 'PENDENTE',
    urgente: false,
    dataPrevista: '2024-08-29',
    observacoes: 'Cliente preferencial',
    itens: [],
    criadoEm: '2024-08-25T08:22:00Z',
    atualizadoEm: '2024-08-25T14:30:00Z',
  },
];

// Adicionar relacionamentos
mockPedidos.forEach(pedido => {
  pedido.responsavel = mockUsuarios.find(u => u.id === pedido.responsavelId);
  pedido.plataforma = mockPlataformas.find(p => p.id === pedido.plataformaId);
  pedido.status = mockStatus.find(s => s.id === pedido.statusId);
});