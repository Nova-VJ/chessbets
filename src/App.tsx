import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WalletProvider } from "@/contexts/WalletContext";
import Index from "./pages/Index";
import Lobby from "./pages/Lobby";
import Play from "./pages/Play";
import Matchmaking from "./pages/Matchmaking";
import Rankings from "./pages/Rankings";
import Insights from "./pages/Insights";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import Friends from "./pages/Friends";
import Rules from "./pages/Rules";
import CreateGame from "./pages/CreateGame";
import CoachAI from "./pages/CoachAI";
import HistoricalPlay from "./pages/HistoricalPlay";
import MasterProfile from "./pages/MasterProfile";
import AdminTestGames from "./pages/AdminTestGames";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <WalletProvider>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/lobby" element={<Lobby />} />
              <Route path="/create-game" element={<CreateGame />} />
              <Route path="/play/:id" element={<Play />} />
              <Route path="/matchmaking" element={<Matchmaking />} />
              <Route path="/rankings" element={<Rankings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/coach" element={<CoachAI />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/historical-play" element={<HistoricalPlay />} />
              <Route path="/master-profile/:id" element={<MasterProfile />} />
              <Route path="/admin/test-games" element={<AdminTestGames />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </WalletProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
