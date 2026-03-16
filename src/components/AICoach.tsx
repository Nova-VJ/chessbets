import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Crown, Target, Shield, Zap, ChevronRight, Activity, TrendingUp, AlertTriangle, Lightbulb, UploadCloud, Loader2, MessageSquare, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { invokeChessChat } from '@/lib/coachApi';
import { supabase } from '@/integrations/supabase/client';

interface AICoachProps {
  profile: any;
}

// Edge functions are used directly - no API_URL needed
const generateCoachRoomSessionToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const AICoach = ({ profile }: AICoachProps) => {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'openings' | 'tactics' | 'endgame' | 'mental'>('overview');
  const [insights, setInsights] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistories, setChatHistories] = useState<Record<string, { role: 'user' | 'coach', text: string }[]>>({});
  const [chatSessionTokens, setChatSessionTokens] = useState<Record<string, string>>({});
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState('general');
  const [wikiProfile, setWikiProfile] = useState<any>(null);

  const COACHES = [
    { id: 'general', name: 'Master IA', icon: Brain, color: 'text-indigo-400', desc: 'Análisis balanceado' },
    { id: 'fischer', name: 'Bobby Fischer', icon: Zap, color: 'text-red-400', desc: 'Agresivo y directo' },
    { id: 'tal', name: 'Mikhail Tal', icon: Activity, color: 'text-orange-400', desc: 'Mago del sacrificio' },
    { id: 'capablanca', name: 'Capablanca', icon: Target, color: 'text-blue-400', desc: 'Lógica y técnica' },
    { id: 'kasparov', name: 'Garry Kasparov', icon: Shield, color: 'text-purple-400', desc: 'Energía y dinamismo' },
    { id: 'carlsen', name: 'Magnus Carlsen', icon: Crown, color: 'text-yellow-400', desc: 'Pragmático moderno' },
  ];

  const activeCoach = COACHES.find(c => c.id === selectedCoachId) || COACHES[0];
  const currentChatHistory = chatHistories[selectedCoachId] || [];

  // Prefetch wiki profile when coach changes
  useEffect(() => {
    if (selectedCoachId === 'general') { setWikiProfile(null); return; }
    setWikiProfile(null);
    supabase.functions.invoke('wiki-profile', { body: { coach_id: selectedCoachId, lang: 'es' } })
      .then(({ data }) => { if (data && !data.error) setWikiProfile(data); })
      .catch(() => {});
  }, [selectedCoachId]);

  const ensureCoachRoomSession = (coachId: string) => {
    const existing = chatSessionTokens[coachId];
    if (existing) return existing;
    const nextToken = generateCoachRoomSessionToken();
    setChatSessionTokens(prev => ({ ...prev, [coachId]: nextToken }));
    return nextToken;
  };

  const fetchInsights = async () => {
    // Insights were from the Python backend - now return default state
    setInsights({
      state: 'active',
      games_analyzed: 0,
      books_ingested: 0,
      overview: {
        elo_trend: '+0',
        estimated_title: 'Principiante',
        verdict: 'Usa el chat con los maestros para recibir análisis personalizados de tus partidas.'
      },
      openings: [
        { name: 'Siciliana', winRate: '0%', color: 'text-zinc-500', bg: 'bg-zinc-700', bar: 'w-0' },
        { name: 'Italiana', winRate: '0%', color: 'text-zinc-500', bg: 'bg-zinc-700', bar: 'w-0' },
        { name: 'Francesa', winRate: '0%', color: 'text-zinc-500', bg: 'bg-zinc-700', bar: 'w-0' },
      ],
      tactics: { solved: 0, accuracy: 0, tip: 'Practica tácticas regularmente.' },
      endgame: { accuracy: 0, tip: 'Los finales son clave para mejorar.' },
      mental: { tilt_risk: 'Bajo', tip: 'Mantén la calma en posiciones complicadas.' }
    });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchInsights();
  }, [profile?.id, session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) return;
    ensureCoachRoomSession(selectedCoachId);
  }, [selectedCoachId, session?.access_token]);

  // Load past conversation history from DB when coach changes
  useEffect(() => {
    if (!profile?.id || !session?.access_token) return;
    const loadConversationHistory = async () => {
      try {
        const query = supabase
          .from('coach_conversations')
          .select('role, content, created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: true })
          .limit(30);
        
        if (selectedCoachId !== 'general') {
          query.eq('coach_id', selectedCoachId);
        }

        const { data } = await query;
        if (data && data.length > 0) {
          const msgs = data.map((m: any) => ({ role: m.role as 'user' | 'coach', text: m.content }));
          setChatHistories(prev => ({ ...prev, [selectedCoachId]: msgs }));
        }
      } catch (e) { console.error(e); }
    };
    loadConversationHistory();
  }, [selectedCoachId, profile?.id, session?.access_token]);

  const handleFileUpload = async (_e: React.ChangeEvent<HTMLInputElement>) => {
    toast.info("La importación de PGN estará disponible próximamente.");
  };

  const handleAnalyze = async () => {
    toast.info("El análisis automático estará disponible próximamente.");
  };

  const handleDownloadPDF = async () => {
    toast.info("La descarga de informes PDF estará disponible próximamente.");
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !profile?.id || isSendingChat) return;
    
    const userMsg = chatMessage.trim();
    const sessionToken = ensureCoachRoomSession(selectedCoachId);
    setChatHistories(prev => ({
      ...prev,
      [selectedCoachId]: [...(prev[selectedCoachId] || []), { role: 'user', text: userMsg }]
    }));
    setChatMessage('');
    setIsSendingChat(true);

    try {
      const data = await invokeChessChat({
        message: userMsg,
        persona: selectedCoachId,
        interaction_mode: 'coach_room',
        message_kind: 'user',
        session_token: sessionToken,
        user_id: profile.id
      });
      if (!data.reply) throw new Error("Chat reply missing");
      setChatHistories(prev => ({
        ...prev,
        [selectedCoachId]: [...(prev[selectedCoachId] || []), { role: 'coach', text: data.reply }]
      }));
    } catch (err) {
      toast.error("El coach no puede responder en este momento");
    } finally {
      setIsSendingChat(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mt-8 relative overflow-visible rounded-2xl border border-yellow-500/20 bg-black/40 backdrop-blur-md shadow-[0_0_40px_rgba(234,179,8,0.05)]"
    >
      {/* Premium Background Effects */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="p-6 border-b border-white/5 relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-600 to-yellow-900 border border-yellow-500/50 flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.2)]">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500">
                IA Coach Pro
              </h2>
              <p className="text-sm text-zinc-400 font-sans mt-1">
                Análisis avanzado de tu estilo de juego
              </p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-xs font-bold text-yellow-500 uppercase tracking-wider">
              {insights?.state === 'onboarding' ? 'Calibrando...' : 'Activo'}
            </span>
          </div>
        </div>

        {insights?.state !== 'onboarding' && !isLoading && (
          <div className="flex gap-2 mt-6 overflow-x-auto pb-2 scrollbar-hide">
            <Button 
              variant={activeTab === 'overview' ? 'default' : 'outline'}
              onClick={() => setActiveTab('overview')}
              className={`rounded-full px-6 h-9 text-xs font-bold transition-all ${activeTab === 'overview' ? 'bg-yellow-500 text-black hover:bg-yellow-600 border-transparent shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'}`}
            >
              <Activity className="w-4 h-4 mr-2" /> Resumen
            </Button>
            <Button 
              variant={activeTab === 'openings' ? 'default' : 'outline'}
              onClick={() => setActiveTab('openings')}
              className={`rounded-full px-6 h-9 text-xs font-bold transition-all ${activeTab === 'openings' ? 'bg-yellow-500 text-black hover:bg-yellow-600 border-transparent shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'}`}
            >
              <Shield className="w-4 h-4 mr-2" /> Aperturas
            </Button>
            <Button 
              variant={activeTab === 'tactics' ? 'default' : 'outline'}
              onClick={() => setActiveTab('tactics')}
              className={`rounded-full px-6 h-9 text-xs font-bold transition-all ${activeTab === 'tactics' ? 'bg-yellow-500 text-black hover:bg-yellow-600 border-transparent shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'}`}
            >
              <Zap className="w-4 h-4 mr-2" /> Tácticas
            </Button>
            <Button 
              variant={activeTab === 'endgame' ? 'default' : 'outline'}
              onClick={() => setActiveTab('endgame')}
              className={`rounded-full px-6 h-9 text-xs font-bold transition-all ${activeTab === 'endgame' ? 'bg-yellow-500 text-black hover:bg-yellow-600 border-transparent shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'}`}
            >
              <Target className="w-4 h-4 mr-2" /> Finales
            </Button>
            <Button 
              variant={activeTab === 'mental' ? 'default' : 'outline'}
              onClick={() => setActiveTab('mental')}
              className={`rounded-full px-4 h-9 text-xs font-bold transition-all ${activeTab === 'mental' ? 'bg-indigo-500 text-white hover:bg-indigo-600 border-transparent shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'border-indigo-500/30 text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/50'}`}
            >
              <Brain className="w-4 h-4 mr-2" /> Psicología
            </Button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-6 relative z-10 min-h-[300px]">
        {isLoading || !profile?.id ? (
           <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
             <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 border-t-2 border-yellow-500 rounded-full animate-spin"></div>
                <Brain className="absolute inset-0 m-auto w-6 h-6 text-yellow-500/50" />
             </div>
             <p className="text-sm font-mono animate-pulse">Conectando con Motor AI...</p>
           </div>
        ) : !insights ? (
           <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
             <AlertTriangle className="w-8 h-8 text-destructive mb-4" />
             <p className="text-sm">El motor AI no está respondiendo.</p>
             <p className="text-xs mt-1">Asegúrese de que el backend Python esté ejecutándose y los puertos estén configurados correctamente.</p>
             <Button variant="outline" size="sm" className="mt-4" onClick={fetchInsights}>
               Reintentar Conexión
             </Button>
           </div>
        ) : insights?.state === 'onboarding' ? (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center text-center py-8">
             <div className="w-20 h-20 bg-zinc-900/80 rounded-full flex items-center justify-center border border-zinc-800 mb-6 shadow-xl relative group">
                <UploadCloud className="w-8 h-8 text-zinc-400 group-hover:text-yellow-500 transition-colors" />
                <input type="file" accept=".pgn" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
             </div>
             <h3 className="text-xl font-bold text-white mb-2">Calibración Requerida</h3>
             <p className="text-sm text-zinc-400 max-w-sm mb-6 leading-relaxed">
               Soy tu Coach IA local. Para crear tu perfil táctico y cruzarlos con los 20 libros maestros, necesito al menos <strong className="text-yellow-500">5 partidas</strong> (idealmente 20) de un mismo ritmo de juego.
             </p>
             <div className="flex gap-3">
               <div className="relative">
                 <Button disabled={isUploading} className="bg-yellow-500 text-black hover:bg-yellow-600 font-bold relative z-10">
                   {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                   Importar Archivo PGN
                 </Button>
                 <input type="file" accept=".pgn" onChange={handleFileUpload} disabled={isUploading} className="absolute inset-0 z-20 opacity-0 cursor-pointer" />
               </div>
             </div>
             <div className="mt-8 pt-6 border-t border-zinc-900 w-full flex items-center justify-between text-xs text-zinc-500">
                <span>Partidas: <strong className="text-white">{insights.games_analyzed}/5</strong></span>
                <span>Libros RAG: <strong className="text-white">{insights.books_ingested}/20</strong></span>
             </div>
           </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            
            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    <div className="text-zinc-500 text-xs font-bold mb-1 flex items-center gap-2"><TrendingUp className="w-3 h-3 text-success" /> TENDENCIA ELO</div>
                    <div className="text-2xl font-mono text-white">{insights.overview.elo_trend} <span className="text-sm text-zinc-500 font-sans">pts (30 días)</span></div>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    <div className="text-zinc-500 text-xs font-bold mb-1 flex items-center gap-2"><Crown className="w-3 h-3 text-yellow-500" /> TÍTULO ESTIMADO</div>
                    <div className="text-xl font-serif font-bold text-yellow-500">{insights.overview.estimated_title}</div>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-indigo-500/20">
                  <h3 className="text-sm font-bold text-indigo-300 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" /> Veredicto de la IA
                  </h3>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                     {insights.overview.verdict}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 mt-4">
                  <Button 
                    onClick={handleAnalyze} 
                    disabled={isUploading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                    Analizar con Stockfish
                  </Button>
                  <Button 
                    onClick={handleDownloadPDF}
                    variant="outline"
                    className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 font-bold text-xs"
                  >
                    <ChevronRight className="w-4 h-4 mr-2" />
                    Descargar Informe PDF
                  </Button>
                  <div className="relative">
                    <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white font-bold text-xs">
                      <UploadCloud className="w-4 h-4 mr-2" /> Importar más PGN
                    </Button>
                    <input type="file" accept=".pgn" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Floating Chat Button */}
            <Button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="fixed bottom-24 right-8 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-900/40 border border-indigo-400/30 group z-50"
            >
              <MessageSquare className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            </Button>

            {/* Chat Window */}
            <AnimatePresence>
              {isChatOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 20 }}
                  className="fixed bottom-28 right-4 z-50 flex h-[min(450px,calc(100vh-8rem))] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-xl md:bottom-40 md:right-8"
                >
                  <div className="p-3 bg-zinc-800/50 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-0.5 rounded-lg bg-zinc-900 border border-white/10 overflow-hidden w-10 h-10 flex items-center justify-center ${activeCoach.color}`}>
                        <img 
                          src={`/coaches/${activeCoach.id}_avatar.png`} 
                          alt={activeCoach.name}
                          className="w-full h-full object-cover rounded-md"
                          onError={(e: any) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                        <activeCoach.icon className="w-5 h-5 hidden" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-white leading-none mb-1">{activeCoach.name}</h3>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">{activeCoach.desc}</p>
                      </div>
                      <button onClick={() => setIsChatOpen(false)} className="text-zinc-600 hover:text-white transition-colors">
                        <ChevronRight className="w-4 h-4 rotate-90" />
                      </button>
                    </div>

                    {/* Personality Selector Ribbon */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {COACHES.map((coach) => (
                        <button
                          key={coach.id}
                          onClick={() => setSelectedCoachId(coach.id)}
                          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all border overflow-hidden ${
                            selectedCoachId === coach.id 
                              ? `bg-zinc-800 border-white/20 scale-110 ${coach.color}` 
                              : 'bg-black/40 border-transparent text-zinc-600 hover:text-zinc-400'
                          }`}
                          title={coach.name}
                        >
                          <img 
                            src={`/coaches/${coach.id}_avatar.png`} 
                            alt={coach.name}
                            className="w-full h-full object-cover"
                            onError={(e: any) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'block';
                            }}
                          />
                          <coach.icon className="w-5 h-5 hidden" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {currentChatHistory.length === 0 && (
                      <div className="text-center py-8">
                        <Brain className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500">¿Tienes dudas sobre una apertura o un final? Pregúntame lo que sea.</p>
                      </div>
                    )}
                    {currentChatHistory.map((msg, i) => (
                      <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                          msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : 'bg-zinc-800 text-zinc-300 border border-white/5 rounded-tl-none'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isSendingChat && (
                      <div className="flex gap-2 justify-start">
                        <div className="bg-zinc-800 p-3 rounded-2xl rounded-tl-none border border-white/5">
                          <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-white/5 bg-zinc-900/50">
                    <div className="relative">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Escribe tu duda..."
                        className="w-full bg-zinc-800 border border-white/5 rounded-xl px-4 py-2 pr-10 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={isSendingChat}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TAB: OPENINGS */}
            {activeTab === 'openings' && (
              <motion.div
                key="openings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="space-y-3">
                  {insights.openings.map((op: any, i: number) => (
                    <motion.div variants={itemVariants} key={i} className="p-3 rounded-lg border border-zinc-800/50 bg-black/20">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-bold text-white">{op.name}</span>
                        <span className={`text-xs font-mono font-bold ${op.color}`}>{op.winRate} Win</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full ${op.bg} ${op.bar} rounded-full`} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              
              <div className="mt-4 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-yellow-500 mb-1">Recomendación</h4>
                  <p className="text-xs text-zinc-400">Tu tasa de victoria con la Defensa Siciliana está cayendo contra jugadores de +1500 ELO. Te sugerimos repasar la variante Najdorf.</p>
                </div>
              </div>
            </motion.div>
          )}

            {/* TAB: TACTICS */}
            {activeTab === 'tactics' && (
              <motion.div
                key="tactics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-success/20 bg-success/5 text-center">
                    <Zap className="w-6 h-6 text-success mx-auto mb-2" />
                    <div className="text-xs text-zinc-400 mb-1 leading-tight">PRESIÓN EN<br/>EL CENTRO</div>
                    <div className="text-xl font-bold text-success">{insights.tactics.center_pressure}</div>
                  </div>
                  <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-center">
                    <Target className="w-6 h-6 text-destructive mx-auto mb-2" />
                    <div className="text-xs text-zinc-400 mb-1 leading-tight">ATAQUE A<br/>DESCUBIERTO</div>
                    <div className="text-xl font-bold text-destructive">{insights.tactics.discovered_attacks}</div>
                  </div>
                </div>
                <p className="text-sm text-zinc-400 text-center px-4 mt-6">
                   La IA detectó que pasaste por alto <strong className="text-white">{insights.tactics.missed_double_attacks} tácticas de ataque doble</strong> en tus partidas. 
                </p>
              </motion.div>
            )}

            {/* TAB: ENDGAME */}
            {activeTab === 'endgame' && (
              <motion.div
                key="endgame"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 relative"
              >
                <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
                  <div className="w-12 h-12 rounded-full border-[4px] border-warning flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">{insights.endgame.precision}%</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Precisión en Finales</h4>
                    <p className="text-xs text-zinc-400">{insights.endgame.weakness}</p>
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors flex items-center justify-between group">
                  <div>
                    <h4 className="text-sm font-bold text-primary mb-1">Lección Recomendada AI</h4>
                    <p className="text-xs text-zinc-400">{insights.endgame.recommended_lesson}</p>
                    {insights.endgame.book_reference && (
                      <p className="text-[10px] text-primary/70 mt-1 uppercase font-bold tracking-wider">
                        📖 {insights.endgame.book_reference}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            )}

            {/* TAB: MENTAL (PSYCHOLOGICAL PROFILE) */}
            {activeTab === 'mental' && insights.psychological_profile && (
              <motion.div
                key="mental"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                  <div>
                    <h4 className="text-[10px] font-bold text-indigo-400 mb-1 tracking-wider uppercase">Resiliencia Mental</h4>
                    <div className="text-3xl font-bold text-white">{insights.psychological_profile.resilience_score}<span className="text-lg text-zinc-500">/100</span></div>
                  </div>
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-500/30 flex items-center justify-center">
                    <Brain className="w-8 h-8 text-indigo-400" />
                  </div>
                </div>
                
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning" /> Diagnóstico Cognitivo
                  </h4>
                  <p className="text-sm text-zinc-300 leading-relaxed italic">
                    "{insights.psychological_profile.diagnosis}"
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
                  <span className="text-2xl">📖</span>
                  <div>
                    <h4 className="text-sm font-bold text-primary mb-1">Terapia RAG Recomendada</h4>
                    <p className="text-xs text-zinc-400">Recomendamos la lectura de <strong className="text-white">{insights.psychological_profile.recommended_book}</strong> para re-programar tus hábitos de pensamiento durante la partida.</p>
                  </div>
                </div>
              </motion.div>
            )}


          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

export default AICoach;
