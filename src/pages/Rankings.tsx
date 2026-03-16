import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, TrendingUp, Coins } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface Player {
  rank: number;
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
  total_won: number;
  rating: number;
}

const Rankings = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, wins, losses, total_won, rating')
      .order('rating', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setPlayers(
          (data || []).map((p: any, i: number) => ({
            rank: i + 1,
            id: p.id,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            wins: p.wins || 0,
            losses: p.losses || 0,
            total_won: Number(p.total_won || 0),
            rating: p.rating || 1200,
          }))
        );
        setLoading(false);
      });
  }, []);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2: return <Medal className="w-5 h-5 text-gray-400" />;
      case 3: return <Medal className="w-5 h-5 text-amber-600" />;
      default: return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const top3 = players.slice(0, 3);

  return (
    <div className="min-h-screen bg-background pb-24 pt-20">
      <AppHeader />
      <main className="container mx-auto px-4 py-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 text-center">
          <h1 className="text-xl font-serif font-bold"><span className="gradient-text">Rankings</span></h1>
          <p className="text-xs text-muted-foreground">Los mejores jugadores de GameBet</p>
        </motion.div>

        {loading ? (
          <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
        ) : players.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Aún no hay jugadores registrados.</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {top3.length >= 3 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex justify-center items-end gap-2 mb-6">
                {[top3[1], top3[0], top3[2]].map((player, i) => {
                  const heights = ['h-20', 'h-28', 'h-16'];
                  const order = [1, 0, 2];
                  return (
                    <div key={player.id} className={`flex flex-col items-center ${i === 1 ? 'order-2' : i === 0 ? 'order-1' : 'order-3'}`}>
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-1">
                        {player.avatar_url ? (
                          <img src={player.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                        ) : getRankIcon(player.rank)}
                      </div>
                      <p className="text-[10px] font-mono mb-1 truncate max-w-[60px]">{player.display_name || 'Anon'}</p>
                      <div className={`w-16 ${heights[order[i]]} bg-gradient-to-t from-primary/20 to-primary/40 rounded-t-lg flex items-end justify-center pb-2`}>
                        <span className="text-xs font-bold">{player.rating}</span>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {/* Full Leaderboard */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card overflow-hidden">
              <div className="p-3 border-b border-border">
                <h2 className="text-sm font-semibold">Clasificación</h2>
              </div>
              <div className="divide-y divide-border">
                {players.map((player, index) => (
                  <motion.div key={player.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * index }} className="flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors">
                    <div className="w-8 flex justify-center">{getRankIcon(player.rank)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono truncate">{player.display_name || 'Anon'}</p>
                      <p className="text-[10px] text-muted-foreground">{player.wins}W - {player.losses}L</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{player.rating}</p>
                      {player.total_won > 0 && <p className="text-[10px] text-success">+{player.total_won.toFixed(2)} BNB</p>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Rankings;
