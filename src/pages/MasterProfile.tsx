import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpen, Swords, Trophy, Loader2, Brain, History as HistoryIcon, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

type MasterData = {
  id: string;
  name: string;
  style_tag: string;
  biography: string;
  curiosities: string[];
  stats_history: string;
  books: { title: string; author: string }[];
  games_played: number;
  user_wins: number;
  user_losses: number;
  user_draws: number;
  historical_games_count: number;
};

type GameHistoryEntry = {
  id: number;
  date: string;
  opponent_id: string;
  result: string;
  rating: number;
  pgn: string;
};

type MasterAnalytics = {
  total_games: number;
  distribution: { name: string; value: number }[];
  win_rate: number;
  max_win_streak: number;
  top_openings: { name: string; count: number }[];
  milestones: string[];
};

const API_URL = coachApiUrl('/api');

export default function MasterProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const [data, setData] = useState<MasterData | null>(null);
  const [analytics, setAnalytics] = useState<MasterAnalytics | null>(null);
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !id || !session) return;
    const fetchMasterData = async () => {
      try {
        const headers = {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        };

        const [masterRes, historyRes, analyticsRes] = await Promise.all([
          fetch(`${API_URL}/master/${id}`, { headers }),
          fetch(`${API_URL}/history`, { headers }),
          fetch(`${API_URL}/master/${id}/analytics`, { headers })
        ]);
        
        if (masterRes.ok) {
          const masterJson = await masterRes.json();
          setData(masterJson);
        }
        
        if (historyRes.ok) {
          const historyJson = await historyRes.json();
          setGameHistory(historyJson.games.map((g: any) => ({ ...g, opponent_id: g.opponent })));
        }

        if (analyticsRes.ok) {
          const analyticsJson = await analyticsRes.json();
          setAnalytics(analyticsJson);
        }
      } catch (err) {
        toast.error('Gambito fallido: No se pudo cargar la información del maestro.');
      } finally {
        setLoading(false);
      }
    };
    fetchMasterData();
  }, [id, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <h2 className="text-2xl font-bold mb-4">Maestro no encontrado</h2>
        <Button onClick={() => navigate('/historical-play')}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pt-24 px-4 pb-12 font-sans relative overflow-hidden">
      {/* Cinematic Background Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-yellow-500/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[url('/coaches/pattern.png')] opacity-[0.02] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <Button variant="ghost" className="mb-8 text-zinc-500 hover:text-white pl-0 transition-colors group" onClick={() => navigate('/historical-play')}>
          <ChevronLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" /> Volver al Tablero
        </Button>

        {/* Cinematic Header Section */}
        <div className="flex flex-col lg:flex-row gap-12 items-center lg:items-end mb-20">
          <div className="relative group">
            <div className={`absolute -inset-4 bg-gradient-to-tr from-yellow-500/20 to-transparent blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-1000`} />
            <div className="w-72 h-72 shrink-0 rounded-[40px] overflow-hidden border-8 border-zinc-900 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.7)] relative z-10">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
              <img 
                src={`/coaches/${id}_avatar.png`} 
                alt={data.name} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms]" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/coaches/general_avatar.png';
                }}
              />
              <div className="absolute bottom-6 left-6 z-20">
                <span className="px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-yellow-500 text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-xl shadow-2xl">
                  {data.style_tag}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 text-center lg:text-left pb-4">
            <div className="flex items-center justify-center lg:justify-start gap-4 mb-4">
               <div className="h-px w-12 bg-gradient-to-r from-transparent to-yellow-500/50" />
               <span className="text-[10px] font-black text-yellow-500/70 uppercase tracking-[0.4em]">Historical Grandmaster</span>
               <div className="h-px w-12 bg-gradient-to-l from-transparent to-yellow-500/50" />
            </div>
            <h1 className="text-6xl md:text-8xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-white to-zinc-500 mb-8 tracking-tighter leading-none">{data.name.toUpperCase()}</h1>
            <p className="text-zinc-400 text-xl md:text-2xl leading-relaxed mb-10 font-light italic max-w-2xl mx-auto lg:mx-0">
               <span className="text-4xl text-yellow-500/20 mr-1 font-serif">"</span>
               {data.biography}
               <span className="text-4xl text-yellow-500/20 ml-1 font-serif">"</span>
            </p>
            <Button 
                onClick={() => navigate('/historical-play')}
                className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black hover:from-yellow-400 hover:to-amber-500 font-black px-12 h-16 rounded-2xl shadow-[0_15px_40px_rgba(234,179,8,0.3)] transition-all hover:scale-[1.03] active:scale-[0.97] group"
              >
                <Swords className="w-6 h-6 mr-3 transition-transform group-hover:rotate-12" /> INICIAR DUELO HISTÓRICO
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-10">
            {/* NEW: Analytics Dashboard Section */}
            {analytics && (
              <div className="bg-zinc-900/60 border border-yellow-500/20 rounded-[40px] p-10 backdrop-blur-2xl relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 blur-[100px] pointer-events-none" />
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                  <div>
                    <h2 className="text-3xl font-black mb-2 flex items-center gap-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">
                      <HistoryIcon className="w-8 h-8 text-yellow-500" /> ANALÍTICAS DE MAESTRÍA
                    </h2>
                    <p className="text-zinc-500 text-sm font-bold tracking-widest uppercase">Análisis computacional de {analytics.total_games.toLocaleString()} partidas históricas</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-yellow-500/10 border border-yellow-500/20 px-6 py-3 rounded-2xl text-center">
                      <p className="text-2xl font-black text-yellow-500">{analytics.win_rate}%</p>
                      <p className="text-[8px] font-black text-yellow-500/50 uppercase tracking-tighter">Win Rate de Vida</p>
                    </div>
                    <div className="bg-indigo-500/10 border border-indigo-500/20 px-6 py-3 rounded-2xl text-center">
                      <p className="text-2xl font-black text-indigo-400">{analytics.max_win_streak}</p>
                      <p className="text-[8px] font-black text-indigo-400/50 uppercase tracking-tighter">Racha de Victorias</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                  {/* Pie Chart: Result Distribution */}
                  <div className="bg-black/40 border border-white/5 rounded-3xl p-6 h-[350px]">
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">Distribución de Resultados</h3>
                    <ResponsiveContainer width="100%" height="90%">
                      <PieChart>
                        <Pie
                          data={analytics.distribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#eab308" /> {/* Victorias */}
                          <Cell fill="#ef4444" /> {/* Derrotas */}
                          <Cell fill="#71717a" /> {/* Tablas */}
                        </Pie>
                        <RechartsTooltip 
                           contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', fontSize: '12px' }}
                           itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                        />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Bar Chart: Top Openings */}
                  <div className="bg-black/40 border border-white/5 rounded-3xl p-6 h-[350px]">
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">Aperturas más utilizadas</h3>
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={analytics.top_openings} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={100} 
                          tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip 
                           cursor={{ fill: 'transparent' }}
                           contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', fontSize: '10px' }}
                        />
                        <Bar dataKey="count" fill="#eab308" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* Milestones / Streaks */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analytics.milestones.map((milestone, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center gap-4 group/milestone">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                      <p className="text-[11px] font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors">{milestone}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Historical Intelligence (Curiosities) */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-[40px] p-10 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                 <Brain className="w-64 h-64 text-purple-500" />
              </div>
              <h2 className="text-2xl font-black mb-10 flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                   <Brain className="w-5 h-5 text-purple-400 font-black" />
                </div>
                INTELIGENCIA HISTÓRICA
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {data.curiosities.map((curiosity, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/5 p-6 rounded-[28px] hover:bg-white/10 transition-all duration-500 group/card">
                    <div className="text-[10px] font-black text-purple-500/50 uppercase mb-4 tracking-widest">Módulo {idx + 1}</div>
                    <p className="text-zinc-300 text-sm leading-relaxed font-medium">{curiosity}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Legacy & Stats */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-[40px] p-10 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                 <Trophy className="w-64 h-64 text-yellow-500" />
              </div>
              <h2 className="text-2xl font-black mb-10 flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
                   <Trophy className="w-5 h-5 text-yellow-400" />
                </div>
                LEGADO Y ESTADÍSTICAS
              </h2>
              <div className="relative">
                <div className="absolute -left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-500/50 to-transparent rounded-full" />
                <p className="text-zinc-200 text-xl font-serif italic leading-relaxed pl-4">
                   {data.stats_history}
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-10">
            {/* Performance Visualization Card */}
            <div className="bg-zinc-900/40 border border-white/10 rounded-[40px] p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full" />
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                <Swords className="w-4 h-4 text-red-500" /> Mi Desempeño
              </h2>
              
              <div className="flex flex-col items-center mb-10">
                 <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                       <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-zinc-800" />
                       <motion.circle 
                          cx="80" cy="80" r="70" 
                          stroke="currentColor" strokeWidth="12" fill="transparent" 
                          strokeDasharray={440}
                          initial={{ strokeDashoffset: 440 }}
                          animate={{ strokeDashoffset: 440 - (440 * (data.games_played > 0 ? (data.user_wins / data.games_played) : 0)) }}
                          transition={{ duration: 2, ease: "easeOut" }}
                          className="text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" 
                       />
                    </svg>
                    <div className="absolute text-center">
                       <p className="text-3xl font-black text-white">{data.games_played > 0 ? Math.round((data.user_wins / data.games_played) * 100) : 0}%</p>
                       <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Win Rate</p>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-black/40 p-5 rounded-3xl border border-white/5 text-center">
                  <p className="text-2xl font-black text-white">{data.games_played}</p>
                  <p className="text-[9px] text-zinc-600 font-black uppercase mt-1 tracking-widest">Duelos</p>
                </div>
                <div className="bg-white/5 p-5 rounded-3xl border border-white/5 text-center">
                  <p className="text-2xl font-black text-green-400">{data.user_wins}</p>
                  <p className="text-[9px] text-green-500/40 font-black uppercase mt-1 tracking-widest">Victorias</p>
                </div>
              </div>

              <div className="space-y-3 bg-black/20 p-5 rounded-[28px] border border-white/5">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                  <span className="text-zinc-500">Derrotas:</span>
                  <span className="text-red-400">{data.user_losses}</span>
                </div>
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                   <div className="h-full bg-red-500/50" style={{ width: `${data.games_played > 0 ? (data.user_losses / data.games_played) * 100 : 0}%` }} />
                </div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-2">
                  <span className="text-zinc-500">Tablas:</span>
                  <span className="text-zinc-300">{data.user_draws}</span>
                </div>
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                   <div className="h-full bg-zinc-500/50" style={{ width: `${data.games_played > 0 ? (data.user_draws / data.games_played) * 100 : 0}%` }} />
                </div>
              </div>
              <Button 
                variant="ghost" 
                className="w-full mt-8 text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-all"
                onClick={() => navigate('/profile')}
              >
                VER ANALÍTICAS COMPLETAS
              </Button>
            </div>

            {/* Master Wisdom & IA Memory Card */}
            <div className="bg-gradient-to-br from-indigo-900/40 to-blue-900/40 border border-indigo-500/30 rounded-[40px] p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl group">
              <div className="absolute top-0 right-0 p-8 opacity-[0.1] pointer-events-none group-hover:rotate-12 transition-transform duration-1000">
                 <Brain className="w-32 h-32 text-indigo-400" />
              </div>
              <h2 className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                <Brain className="w-4 h-4" /> Sabiduría de IA Real
              </h2>
              
              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-black text-white">{data.historical_games_count?.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Partidas Reales</span>
                </div>
                <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]" 
                  />
                </div>
              </div>

              <p className="text-[11px] text-zinc-300 leading-relaxed font-medium italic">
                "Esta IA ha sido entrenada con {data.historical_games_count} partidas reales jugadas por {data.name} en vida. Su estilo, instinto y respuestas están basados directamente en este historial masivo, además de sus libros fundamentales y su trayectoria histórica como ajedrecista profesional."
              </p>
            </div>

            {/* Knowledge Base Card */}
            <div className="bg-zinc-900/40 border border-white/10 rounded-[40px] p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full" />
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-blue-500" /> Biblioteca Cognitiva
              </h2>
              <div className="space-y-4">
                {data.books.map((book, idx) => (
                  <div key={idx} className="bg-white/5 p-4 rounded-[22px] border border-white/5 hover:border-blue-500/30 transition-all duration-300 group/book">
                    <p className="text-[11px] font-black text-zinc-300 group-hover:text-blue-400 transition-colors leading-tight mb-1">{book.title.toUpperCase()}</p>
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-tighter">{book.author}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Games / Move History Card */}
            <div className="bg-zinc-900/40 border border-white/10 rounded-[40px] p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-3xl rounded-full" />
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                <HistoryIcon className="w-4 h-4 text-green-500" /> Últimos Desafíos
              </h2>
              <div className="space-y-4">
                {gameHistory.length > 0 ? gameHistory.filter(g => g.opponent_id === id).slice(0, 5).map((game, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${game.result === '1-0' ? 'bg-green-500' : game.result === '0-1' ? 'bg-red-500' : 'bg-zinc-500'}`} />
                      <div>
                        <p className="text-[11px] font-black text-zinc-200">{game.date}</p>
                        <p className="text-[9px] text-zinc-500 uppercase font-bold">{game.result === '1-0' ? 'Victoria' : game.result === '0-1' ? 'Derrota' : 'Tablas'}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[9px] font-black text-zinc-500 hover:text-yellow-500"
                      onClick={() => {
                        alert(`Notación PGN: ${game.pgn || 'No disponible'}`);
                      }}
                    >
                      VER MOVS
                    </Button>
                  </div>
                )) : (
                  <div className="py-12 text-center opacity-30">
                    <HistoryIcon className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sin registros de combate aún</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
