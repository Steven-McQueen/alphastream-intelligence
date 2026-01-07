import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PortfolioProvider } from "@/context/PortfolioContext";
import { MarketProvider } from "@/context/MarketContext";
import { AuthProvider } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import FinanceHome from "./pages/FinanceHome";
import Screener from "./pages/Screener";
import WatchlistPage from "./pages/WatchlistPage";
import Portfolio from "./pages/Portfolio";
import Holdings from "./pages/Holdings";
import Market from "./pages/Market";
import IndexDetail from "./pages/IndexDetail";
import Intelligence from "./pages/Intelligence";
import Optimizer from "./pages/Optimizer";
import Simulation from "./pages/Simulation";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import { WatchlistProvider } from "./contexts/WatchlistContext";
import { StockDetailProvider, useStockDetail } from "./contexts/StockDetailContext";
import { StockDetailSheet } from "./components/screener/StockDetailSheet";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <PortfolioProvider>
            <MarketProvider>
              <WatchlistProvider>
                <StockDetailProvider>
              <Toaster />
              <Sonner />
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                
                {/* Protected routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <FinanceHome />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/finance"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <FinanceHome />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                    <Route
                      path="/screener"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Screener />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                <Route
                  path="/watchlist"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                            <WatchlistPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/portfolio"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Portfolio />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/holdings"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Holdings />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/market"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Market />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/market/:symbol"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <IndexDetail />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/intelligence"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Intelligence />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/optimizer"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Optimizer />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/simulation"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Simulation />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Settings />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                
                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
                  <StockDetailPortal />
                </StockDetailProvider>
              </WatchlistProvider>
            </MarketProvider>
          </PortfolioProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

function StockDetailPortal() {
  const { selectedStock, closeStockDetail } = useStockDetail();
  if (!selectedStock) return null;
  return (
    <StockDetailSheet
      stock={selectedStock}
      open={!!selectedStock}
      onOpenChange={(open) => {
        if (!open) closeStockDetail();
      }}
    />
  );
}

export default App;
