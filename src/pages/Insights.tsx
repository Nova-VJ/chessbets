import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Target, Brain, Trophy, Swords, Shield } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { invokeCoachInsights } from '@/lib/coachApi';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS_PIE = ['hsl(var(--success))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];
const COACH_LABELS: Record<string, string> = {
  fischer: 'Fischer', tal: 'Tal', capablanca: 'Capablanca',
  kasparov: 'Kasparov', carlsen: 'Carlsen', general: 'General',
};

const Insights = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    invokeCoachInsights({ user_id: user.id })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const pieData = data ? [
    { name: 'Victorias', value: data.wins || 0 },
    { name: 'Derrotas', value: data.losses || 0 },
    { name: 'Tablas', value: data.draws || 0 },
  ] : [];

  const ratingData = (data?.rating_history || []).map((r: any) => ({
    date: new Date(r.date).toLocaleDateString('es', { month: 'short', day: 'numeric' }),
    rating: r.rating,
  }));

  const openingData = (data?.top_openings || []).map((o: any) => ({
    name: o.name?.length > 15 ? o.name.slice(0, 15) + '…' : o.name,
    count: o.count,
  }));

  const coachData = Object.entries(data?.coach_stats || {}).map(([id, s]: any) => ({
    name: COACH_LABELS[id] || id,
    games: s.games,
    winRate: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0,
  }));

  const memoryProfiles = data?.memory_profiles || [];

  return (
    <div className="min-h-screen bg-background pb-24 pt-20">
      <AppHeader />
      <main className="container mx-auto px-4 py-4 space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-2">
          <h1 className="text-xl font-serif font-bold"><span className="gradient-text">Insights</span></h1>
          <p className="text-xs text-muted-foreground">Análisis de tu rendimiento</p>
        </motion.div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
          </div>
        ) : !data || data.total_games === 0 ? (
          <div className="glass-card p-8 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Juega partidas con los coaches para ver tus estadísticas aquí.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-3 text-center">
                <Trophy className="w-5 h-5 mx-auto text-primary mb-1" />
                <p className="text-lg font-bold">{data.total_games}</p>
                <p className="text-[10px] text-muted-foreground">Partidas</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-3 text-center">
                <Target className="w-5 h-5 mx-auto text-success mb-1" />
                <p className="text-lg font-bold">{data.win_rate}%</p>
                <p className="text-[10px] text-muted-foreground">Win Rate</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-3 text-center">
                <Swords className="w-5 h-5 mx-auto text-accent mb-1" />
                <p className="text-lg font-bold">{data.wins}</p>
                <p className="text-[10px] text-muted-foreground">Victorias</p>
              </motion.div>
            </div>

            {/* Win/Loss/Draw Pie */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Resultados
              </h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS_PIE[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Rating Progression */}
            {ratingData.length > 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card p-4">
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Progresión de Rating
                </h2>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={ratingData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="rating" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Openings Distribution */}
            {openingData.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="glass-card p-4">
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Aperturas Frecuentes
                </h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={openingData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Coach Stats */}
            {coachData.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-card p-4">
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" /> Rendimiento por Coach
                </h2>
                <div className="space-y-2">
                  {coachData.map((c: any) => (
                    <div key={c.name} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                      <span className="text-sm font-medium">{c.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{c.games} partidas</span>
                        <span className="text-xs font-semibold text-success">{c.winRate}% win</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Memory Profiles */}
            {memoryProfiles.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="glass-card p-4">
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" /> Perfil de Memoria
                </h2>
                <div className="space-y-3">
                  {memoryProfiles.map((mp: any) => (
                    <div key={mp.id} className="p-3 rounded-lg bg-secondary/20 space-y-2">
                      <p className="text-xs font-semibold">{COACH_LABELS[mp.coach_id] || mp.coach_id}</p>
                      {mp.strengths_json?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-success font-medium">Fortalezas</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(mp.strengths_json as string[]).map((s: string, i: number) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {mp.weaknesses_json?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-destructive font-medium">Debilidades</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(mp.weaknesses_json as string[]).map((w: string, i: number) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{w}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {mp.last_topic && <p className="text-[10px] text-muted-foreground">Último tema: {mp.last_topic}</p>}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Insights;
