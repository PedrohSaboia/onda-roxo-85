import { Toaster } from "@/components/ui/toast";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { NotificacoesProvider } from "@/contexts/NotificacoesContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Pedido from "./pages/Pedido";
import PedidoContabilidade from "./pages/PedidoContabilidade";
import NovoPedido from "./pages/NovoPedido";
import InformacoesEntrega from "./pages/InformacoesEntrega";
import Leads from "./pages/Leads";
import PedidosEnviados from "./pages/PedidosEnviados";
import PedidosCancelados from "./pages/PedidosCancelados";
import ListaEmbalagens from "./pages/ListaEmbalagens";
import SkuPlataformas from "./pages/SkuPlataformas";
import { TermosServico } from "./pages/TermosServico";
import { TermoPrivacidade } from "./pages/TermoPrivacidade";
import Documentacao from "./pages/Documentacao";
import { Contabilidade } from "./pages/Contabilidade";
import { Comercial } from "./pages/Comercial";
import { Logistica } from "./pages/Logistica";
import { Estoque } from "./pages/Estoque";
import { Dashboard } from "./pages/Dashboard";
import { Design } from "./pages/Design";
import { Producao } from "./pages/Producao";
import { Configuracoes } from "./pages/Configuracoes";
import { AppLayout } from "./components/layout/AppLayout";
import { useEffect } from "react";

const queryClient = new QueryClient();

const App = () => {
  // Initialize dark mode from localStorage on app load
  useEffect(() => {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <NotificacoesProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            
            {/* Pedido contabilidade moved inside AppLayout so header appears */}
            
            <Route path="/informacoes-entrega/:id" element={
              <InformacoesEntrega />
            } />
            {/* AppLayout wrapper: header + main app pages (protected) */}
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="pedido-contabilidade/:id" element={<PedidoContabilidade />} />
              <Route path="comercial" element={<Comercial />} />
              <Route path="pedido/:id" element={<Pedido />} />
              <Route path="logistica" element={<Logistica />} />
              <Route path="estoque" element={<Estoque />} />
              <Route path="estoque/sku-plataformas" element={<SkuPlataformas />} />
              <Route path="design" element={<Design />} />
              <Route path="producao" element={<Producao />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="leads" element={<Leads />} />
              <Route path="pedidos-cancelados" element={<PedidosCancelados />} />
              <Route path="pedidos-enviados" element={<PedidosEnviados />} />
              <Route path="estoque/embalagens" element={<ListaEmbalagens />} />
              <Route path="contabilidade" element={<Contabilidade />} />
                <Route path="novo-pedido" element={<NovoPedido />} />
            </Route>
            <Route path="/termos-servico" element={<TermosServico />} />
            <Route path="/politica-privacidade" element={<TermoPrivacidade />} />
            <Route path="/documentacao" element={<Documentacao />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </NotificacoesProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
