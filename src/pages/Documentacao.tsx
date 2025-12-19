import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  FileText, 
  Users, 
  Truck,
  BarChart3,
  Settings,
  CheckCircle,
  ArrowRight,
  Box,
  Home
} from "lucide-react";
import { Link } from "react-router-dom";

export default function Documentacao() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Sistema ERP - Documentação
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Manual completo de uso do sistema
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Introdução */}
        <section className="mb-16">
          <Card className="p-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-600 rounded-lg">
                <Package className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  Bem-vindo ao Sistema ERP
                </h2>
                <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                  Este é um sistema completo de gestão empresarial (ERP) desenvolvido para
                  otimizar e automatizar os processos do seu negócio. Com ele, você pode
                  gerenciar pedidos, controlar estoque, emitir notas fiscais, acompanhar
                  métricas de desempenho, gerenciar leads e muito mais.
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* Funcionalidades Principais */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            Funcionalidades Principais
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dashboard e Métricas */}
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Dashboard e Métricas
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    Visualize métricas em tempo real do seu negócio com gráficos e indicadores de desempenho.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-purple-600" />
                      Receita total e por período
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-purple-600" />
                      Número de pedidos e ticket médio
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-purple-600" />
                      Taxa de conversão de leads
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-purple-600" />
                      Produtos mais vendidos
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Gerenciamento de Pedidos */}
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <ShoppingCart className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Gerenciamento de Pedidos
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    Controle completo do fluxo de pedidos desde a criação até a entrega.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-blue-600" />
                      Criar e editar pedidos manualmente
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-blue-600" />
                      Kanban board para visualização de status
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-blue-600" />
                      Histórico completo de cada pedido
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-blue-600" />
                      Integração com pagamentos
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Controle de Estoque */}
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Box className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Controle de Estoque e Produtos
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    Gerencie seu inventário com precisão e controle total.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-600" />
                      Cadastro completo de produtos
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-600" />
                      Controle de quantidade em estoque
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-600" />
                      Variações de produtos (cores, tamanhos)
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-600" />
                      Alertas de estoque baixo
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Notas Fiscais */}
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <FileText className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Emissão de Notas Fiscais
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    Emita notas fiscais de forma rápida e em conformidade com a legislação.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-orange-600" />
                      Emissão automática de NF-e
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-orange-600" />
                      Integração com SEFAZ
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-orange-600" />
                      Histórico de notas emitidas
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-orange-600" />
                      Download de XML e DANFE
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Logística e Envio */}
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <Truck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Logística e Etiquetas de Envio
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    Gerencie envios e imprima etiquetas para múltiplas transportadoras.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-indigo-600" />
                      Cotação de frete com Melhor Envio
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-indigo-600" />
                      Impressão de etiquetas Correios, Jadlog, etc.
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-indigo-600" />
                      Rastreamento de envios
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-indigo-600" />
                      Gerenciamento de embalagens
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Gerenciamento de Leads */}
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                  <Users className="h-6 w-6 text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Gerenciamento de Leads
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    Acompanhe e converta leads em clientes de forma eficiente.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-pink-600" />
                      Cadastro e organização de leads
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-pink-600" />
                      Acompanhamento do funil de vendas
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-pink-600" />
                      Histórico de interações
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-pink-600" />
                      Conversão automática em pedidos
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Guia de Uso Passo a Passo */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Guia de Uso Passo a Passo
          </h2>

          <div className="space-y-6">
            {/* Passo 1 */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Primeiro Acesso
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Faça login no sistema utilizando suas credenciais. Após o login, você será direcionado
                    ao Dashboard principal onde poderá visualizar um resumo completo do seu negócio.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Dica:</strong> No primeiro acesso, configure suas preferências em 
                      <strong> Configurações</strong> antes de começar a usar o sistema.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Passo 2 */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Cadastrar Produtos
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Acesse a seção <strong>Estoque</strong> no menu lateral e cadastre seus produtos.
                    Inclua informações como nome, descrição, preço, quantidade em estoque e imagens.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-4">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2"></div>
                      <span>Preencha todos os campos obrigatórios</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2"></div>
                      <span>Adicione variações se necessário (ex: cores, tamanhos)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2"></div>
                      <span>Configure embalagens para cada produto</span>
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Passo 3 */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Criar Pedidos
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Clique em <strong>Novo Pedido</strong> no menu ou botão flutuante. Selecione o cliente,
                    adicione produtos ao carrinho e configure informações de pagamento e entrega.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Importante:</strong> O sistema pode receber pedidos automaticamente através
                      de integrações com plataformas de e-commerce (Yampi, etc).
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Passo 4 */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Gerenciar Status do Pedido
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Utilize o Kanban board para visualizar e movimentar pedidos entre os diferentes status:
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg">
                      <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Pendente</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Em Produção</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-3 rounded-lg">
                      <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">Pronto</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300">Enviado</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Passo 5 */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  5
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Emitir Nota Fiscal
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Dentro da página do pedido, clique em <strong>Emitir NF-e</strong>. O sistema gerará
                    automaticamente a nota fiscal com base nas informações do pedido e a enviará ao SEFAZ.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2"></div>
                      <span>O sistema valida automaticamente os dados antes de enviar</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2"></div>
                      <span>Após aprovação, XML e DANFE ficam disponíveis para download</span>
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Passo 6 */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  6
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Processar Envio
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Acesse a seção <strong>Logística</strong> para processar o envio:
                  </p>
                  <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex gap-3">
                      <span className="font-semibold text-blue-600">1.</span>
                      <span>Selecione o pedido e clique em <strong>Cotar Frete</strong></span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-blue-600">2.</span>
                      <span>Escolha a melhor opção de transportadora entre as disponíveis</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-blue-600">3.</span>
                      <span>Gere a etiqueta de envio</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-blue-600">4.</span>
                      <span>Imprima e cole na embalagem</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-blue-600">5.</span>
                      <span>Atualize o status do pedido para "Enviado"</span>
                    </li>
                  </ol>
                </div>
              </div>
            </Card>

            {/* Passo 7 */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  7
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Acompanhar Métricas
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Retorne ao <strong>Dashboard</strong> regularmente para acompanhar o desempenho do negócio.
                    Visualize gráficos de vendas, produtos mais vendidos, taxa de conversão e outras métricas
                    importantes para tomada de decisão.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Recursos Adicionais */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Recursos Adicionais
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <Settings className="h-6 w-6 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Configurações
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Personalize o sistema de acordo com suas necessidades. Configure remetentes,
                    embalagens padrão, preferências de notificação e muito mais.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-4">
                <TrendingUp className="h-6 w-6 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Relatórios
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Gere relatórios detalhados de vendas, estoque, financeiro e muito mais.
                    Exporte dados em diversos formatos para análise externa.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-4">
                <Package className="h-6 w-6 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Integrações
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    O sistema integra-se com diversas plataformas: Yampi (e-commerce),
                    Melhor Envio (logística), gateways de pagamento e sistemas fiscais.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-4">
                <Users className="h-6 w-6 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Gestão de Equipe
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Adicione usuários à sua conta com diferentes níveis de permissão.
                    Controle quem pode acessar cada área do sistema.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Dicas e Melhores Práticas */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Dicas e Melhores Práticas
          </h2>
          
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    Mantenha o cadastro de produtos atualizado
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Revise regularmente as quantidades em estoque e atualize preços quando necessário.
                    Isso evita vendas de produtos indisponíveis.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    Processe pedidos diariamente
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Estabeleça uma rotina para processar pedidos, emitir notas fiscais e gerar etiquetas
                    de envio. Isso melhora o tempo de entrega e a satisfação do cliente.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    Acompanhe as métricas
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Utilize o dashboard para identificar tendências, produtos mais vendidos e períodos
                    de maior demanda. Use essas informações para planejar compras e promoções.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    Gerencie seus leads ativamente
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Não deixe leads sem acompanhamento. Use a seção de Leads para manter contato
                    e converter oportunidades em vendas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    Configure embalagens adequadas
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Cadastre as embalagens utilizadas para cada produto. Isso facilita a cotação
                    de frete e garante que o cálculo seja preciso.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    Faça backup regularmente
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Embora o sistema faça backups automáticos, exporte seus dados importantes
                    periodicamente para maior segurança.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Suporte */}
        <section>
          <Card className="p-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Precisa de Ajuda?
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
                Nossa equipe está pronta para ajudá-lo a aproveitar ao máximo o sistema ERP.
                Entre em contato conosco para suporte técnico, treinamento ou dúvidas sobre
                funcionalidades.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button size="lg" variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Baixar PDF
                </Button>
              </div>
            </div>
          </Card>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <p className="text-sm">
              © {new Date().getFullYear()} Sistema ERP. Todos os direitos reservados.
            </p>
            <div className="flex gap-4 justify-center mt-4 text-sm">
              <Link to="/termos-servico" className="hover:text-blue-600 dark:hover:text-blue-400">
                Termos de Serviço
              </Link>
              <span>•</span>
              <Link to="/politica-privacidade" className="hover:text-blue-600 dark:hover:text-blue-400">
                Política de Privacidade
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
