import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Target, Brain, Trophy, Swords, Shield, Crown, Flame } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Area, AreaChart } from 'recharts';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { invokeCoachInsights } from '@/lib/coachApi';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS_PIE = ['hsl(145 60% 45%)', 'hsl(0 70% 50%)', 'hsl(220 10% 40%)'];
const COACH_LABELS: Record<string, string> = {
  fischer: 'Fischer', tal: 'Tal', capablanca: 'Capablanca',
  kasparov: 'Kasparov', carlsen: 'Carlsen', general: 'General',
};

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4, ease: 'easeOut' as const },
});

const StatCard = ({ icon: Icon, value, label, color, delay }: {
  icon: any; value: string | number; label: string; color: string; delay: number;
}) => (
  <motion.div {...anim(delay)} className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 text-center">
    <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full bg-${color}/5 blur-xl`} />
    <Icon className={`w-5 h-5 mx-auto mb-2 text-${color}`} />
    <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
    <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wider">{label}</p>
  </motion.div>
);

const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-2.5 mb-4">
    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
      <Icon className="w-3.5 h-3.5 text-primary" />
    </div>
    <h2 className="text-sm font-semibold tracking-wide uppercase">{title}</h2>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
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

  const totalGames = data?.total_games || 0;
  const wins = data?.wins || 0;
  const losses = data?.losses || 0;
  const draws = data?.draws || 0;

  const pieData = data ? [
    { name: 'Victorias', value: wins },
    { name: 'Derrotas', value: losses },
    { name: 'Tablas', value: draws },
  ].filter(d => d.value > 0) : [];

  const ratingData = (data?.rating_history || []).map((r: any) => ({
    date: new Date(r.date).toLocaleDateString('es', { month: 'short', day: 'numeric' }),
    rating: r.rating,
  }));

  const openingData = (data?.top_openings || []).map((o: any) => ({
    name: o.name?.length > 18 ? o.name.slice(0, 18) + '…' : o.name,
    count: o.count,
  }));

  const coachData = Object.entries(data?.coach_stats || {}).map(([id, s]: any) => ({
    name: COACH_LABELS[id] || id,
    id,
    games: s.games,
    wins: s.wins,
    winRate: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0,
  }));

  const memoryProfiles = data?.memory_profiles || [];

  return (
    <div className="min-h-screen bg-background pb-24 pt-20">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-1">
          <h1 className="text-2xl font-serif font-bold tracking-wide">
            <span className="gradient-text">Insights</span>
          </h1>
          <p className="text-xs text-muted-foreground tracking-wider uppercase">Análisis de rendimiento</p>
        </motion.div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
          </div>
        ) : !data || totalGames === 0 ? (
          <motion.div {...anim(0.1)} className="rounded-xl border border-border/50 bg-card p-10 text-center">
            <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-sm text-muted-foreground">Juega partidas con los coaches para ver tus estadísticas.</p>
          </motion.div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Trophy} value={totalGames} label="Partidas" color="primary" delay={0.05} />
              <StatCard icon={Target} value={`${data.win_rate}%`} label="Win Rate" color="success" delay={0.1} />
              <StatCard icon={Crown} value={wins} label="Victorias" color="accent" delay={0.15} />
            </div>

            {/* W/L/D Breakdown */}
            <motion.div {...anim(0.2)} className="rounded-xl border border-border/50 bg-card p-5">
              <SectionHeader icon={Shield} title="Resultados" />
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="45%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={0}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS_PIE[i]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {[
                    { label: 'Victorias', val: wins, pct: totalGames ? Math.round((wins / totalGames) * 100) : 0, color: 'bg-success' },
                    { label: 'Derrotas', val: losses, pct: totalGames ? Math.round((losses / totalGames) * 100) : 0, color: 'bg-destructive' },
                    { label: 'Tablas', val: draws, pct: totalGames ? Math.round((draws / totalGames) * 100) : 0, color: 'bg-muted-foreground' },
                  ].map(item => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-mono font-semibold">{item.val} <span className="text-muted-foreground">({item.pct}%)</span></span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Rating Progression */}
            {ratingData.length > 1 && (
              <motion.div {...anim(0.3)} className="rounded-xl border border-border/50 bg-card p-5">
                <SectionHeader icon={TrendingUp} title="Progresión de Rating" />
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={ratingData}>
                    <defs>
                      <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(45 80% 55%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(45 80% 55%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(220 10% 55%)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(220 10% 55%)' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="rating" stroke="hsl(45 80% 55%)" strokeWidth={2} fill="url(#ratingGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Openings */}
            {openingData.length > 0 && (
              <motion.div {...anim(0.35)} className="rounded-xl border border-border/50 bg-card p-5">
                <SectionHeader icon={BarChart3} title="Aperturas Frecuentes" />
                <ResponsiveContainer width="100%" height={Math.max(120, openingData.length * 36)}>
                  <BarChart data={openingData} layout="vertical" barCategoryGap="20%">
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(220 10% 55%)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(220 10% 55%)' }} width={110} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Partidas" fill="hsl(45 80% 55%)" radius={[0, 6, 6, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Coach Stats */}
            {coachData.length > 0 && (
              <motion.div {...anim(0.4)} className="rounded-xl border border-border/50 bg-card p-5">
                <SectionHeader icon={Flame} title="Rendimiento por Coach" />
                <div className="space-y-2.5">
                  {coachData.map((c) => (
                    <div key={c.name} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <img src={`/coaches/${c.id}_avatar.png`} alt={c.name} className="w-8 h-8 rounded-full object-cover border border-border/50" onError={(e) => { (e.target as HTMLImageElement).src = '/coaches/general_avatar.png'; }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.games} partidas · {c.wins} victorias</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold font-mono ${c.winRate >= 50 ? 'text-success' : 'text-destructive'}`}>{c.winRate}%</p>
                        <p className="text-[10px] text-muted-foreground">win rate</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Memory Profiles */}
            {memoryProfiles.length > 0 && (
              <motion.div {...anim(0.45)} className="rounded-xl border border-border/50 bg-card p-5">
                <SectionHeader icon={Brain} title="Perfil de Memoria" />
                <div className="space-y-3">
                  {memoryProfiles.map((mp: any) => (
                    <div key={mp.id} className="p-4 rounded-lg bg-secondary/20 border border-border/30 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider">{COACH_LABELS[mp.coach_id] || mp.coach_id}</p>
                      {mp.strengths_json?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-success font-semibold mb-1.5 uppercase tracking-wider">Fortalezas</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(mp.strengths_json as string[]).map((s: string, i: number) => (
                              <span key={i} className="text-[10px] px-2.5 py-1 rounded-full border border-success/20 bg-success/10 text-success">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {mp.weaknesses_json?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-destructive font-semibold mb-1.5 uppercase tracking-wider">Debilidades</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(mp.weaknesses_json as string[]).map((w: string, i: number) => (
                              <span key={i} className="text-[10px] px-2.5 py-1 rounded-full border border-destructive/20 bg-destructive/10 text-destructive">{w}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {mp.last_topic && (
                        <p className="text-[10px] text-muted-foreground italic">Último tema: {mp.last_topic}</p>
                      )}
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
