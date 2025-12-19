import { Toaster } from "@/components/ui/toaster";
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
import NovoPedido from "./pages/NovoPedido";
import InformacoesEntrega from "./pages/InformacoesEntrega";
import Leads from "./pages/Leads";
import PedidosEnviados from "./pages/PedidosEnviados";
import PedidosCancelados from "./pages/PedidosCancelados";
import ListaEmbalagens from "./pages/ListaEmbalagens";
import { TermosServico } from "./pages/TermosServico";
import { TermoPrivacidade } from "./pages/TermoPrivacidade";
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
            <Route path="/pedido/:id" element={
              <ProtectedRoute>
                <Pedido />
              </ProtectedRoute>
            } />
            <Route path="/novo-pedido" element={
              <ProtectedRoute>
                <NovoPedido />
              </ProtectedRoute>
            } />
            <Route path="/informacoes-entrega/:id" element={
              <InformacoesEntrega />
            } />
            <Route path="/leads" element={
              <ProtectedRoute>
                <Leads />
              </ProtectedRoute>
            } />
            <Route path="/pedidos-cancelados" element={
              <ProtectedRoute>
                <PedidosCancelados />
              </ProtectedRoute>
            } />
            <Route path="/pedidos-enviados" element={
              <ProtectedRoute>
                <PedidosEnviados />
              </ProtectedRoute>
            } />
            <Route path="/estoque/embalagens" element={
              <ProtectedRoute>
                <ListaEmbalagens />
              </ProtectedRoute>
            } />
            <Route path="/termos-servico" element={<TermosServico />} />
            <Route path="/politica-privacidade" element={<TermoPrivacidade />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />
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
