import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  MessageSquare, 
  History, 
  Flag, 
  Handshake, 
  Maximize2,
  Minimize2,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronRight,
  Trophy,
  Smile
} from 'lucide-react';
import Header from '@/components/Header';
import ChessBoard from '@/components/ChessBoard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Chess } from 'chess.js';
import { settleGameOnChain } from '@/lib/contract';

import LiveClock from '@/components/LiveClock';

const COMMON_EMOJIS = ['😂', '😎', '😡', '🤔', '😅', '🔥', '💀', '🎯', '🤝', '👋', '👀', '♟️'];

const Play = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, session } = useAuth();
  const [gameData, setGameData] = useState<any>(null);
  const [chess] = useState(new Chess());
  const [isMuted, setIsMuted] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [settings, setSettings] = useState({
    boardTheme: 'classic',
    pieceTheme: 'neo',
    confirmResign: true,
    confirmDraw: true,
  });

  useEffect(() => {
    if (!id) return;
    fetchGame();

    const channel = supabase
      .channel(`game-${id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'games',
        filter: `id=eq.${id}`
      }, (payload) => {
        handleGameUpdate(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchGame = async () => {
    const { data, error } = await (supabase
      .from('games') as any)
      .select(`
        *,
        white_player:profiles!games_white_user_id_fkey (id, display_name, avatar_url, wallet_address, rating, rating_blitz),
        black_player:profiles!games_black_user_id_fkey (id, display_name, avatar_url, wallet_address, rating, rating_blitz)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      toast.error('Partida no encontrada');
      navigate('/lobby');
    } else {
      setGameData(data);
      chess.load(data.fen);
    }
  };

  const handleGameUpdate = (newData: any) => {
    setGameData((prev: any) => ({ ...prev, ...newData }));
    if (newData.fen) {
      chess.load(newData.fen);
    }
  };

  const calculateRemainingTime = (color: 'white' | 'black', data: any) => {
     if (data.status !== 'in_progress' || !data.last_move_at) return color === 'white' ? data.white_time_ms : data.black_time_ms;
     
     const turn = chess.turn();
     const isTurn = (color === 'white' && turn === 'w') || (color === 'black' && turn === 'b');
     
     if (!isTurn) return color === 'white' ? data.white_time_ms : data.black_time_ms;
     
     const startTime = new Date(data.last_move_at).getTime();
     const now = Date.now();
     const elapsed = now - startTime;
     return Math.max(0, (color === 'white' ? data.white_time_ms : data.black_time_ms) - elapsed);
  };

  // ── Settlement logic ──
  const settleGame = async (
    game: any, 
    winnerId: string | null, 
    resultStr: string
  ) => {
    if (isSettling) return;
    setIsSettling(true);

    try {
      const isDraw = resultStr === 'draw';
      const stakeAmount = Number(game.stake_amount || 0);

      // Web3 settlement
      if (game.payment_method === 'web3' && game.contract_game_id && stakeAmount > 0) {
        let winnerWallet: string | null = null;
        if (!isDraw && winnerId) {
          const winnerPlayer = game.white_player?.id === winnerId ? game.white_player : game.black_player;
          winnerWallet = winnerPlayer?.wallet_address || null;
        }

        toast.loading('Liquidando partida on-chain...', { id: 'settle' });
        const result = await settleGameOnChain(game.contract_game_id, winnerWallet, isDraw);
        
        if (result.status === 'settled') {
          toast.success('Partida liquidada on-chain', { id: 'settle' });
        } else if (result.status === 'skipped') {
          toast.info('Liquidación on-chain pendiente (requiere wallet owner)', { id: 'settle', description: result.reason });
        } else {
          toast.error('Error al liquidar on-chain', { id: 'settle', description: result.reason });
        }
      }

      // Internal balance settlement
      if (game.payment_method === 'internal' && stakeAmount > 0) {
        const totalPot = stakeAmount * 2;
        const balanceField = game.currency === 'USDT' ? 'balance_usdt' : 'balance';
        const wonField = game.currency === 'USDT' ? 'total_won_usdt' : 'total_won';

        if (isDraw) {
          // Refund both players
          for (const pid of [game.creator_id, game.opponent_id]) {
            if (!pid) continue;
            const { data: p } = await supabase.from('profiles').select(balanceField).eq('id', pid).single();
            if (p) {
              await (supabase.from('profiles') as any).update({ 
                [balanceField]: Number((p as any)[balanceField] || 0) + stakeAmount 
              }).eq('id', pid);
            }
          }
          toast.success('Apuesta devuelta a ambos jugadores');
        } else if (winnerId) {
          const { data: wp } = await supabase.from('profiles').select(`${balanceField}, ${wonField}`).eq('id', winnerId).single();
          if (wp) {
            await (supabase.from('profiles') as any).update({
              [balanceField]: Number((wp as any)[balanceField] || 0) + totalPot,
              [wonField]: Number((wp as any)[wonField] || 0) + totalPot,
            }).eq('id', winnerId);
          }
          toast.success(`Ganancia de ${totalPot} ${game.currency} acreditada`);
        }
      }

      // Update stats for both players
      const players = [
        { id: game.creator_id, isWinner: winnerId === game.creator_id },
        { id: game.opponent_id, isWinner: winnerId === game.opponent_id },
      ];

      for (const p of players) {
        if (!p.id) continue;
        const { data: prof } = await (supabase.from('profiles') as any)
          .select('games_played, wins, losses, draws, rating')
          .eq('id', p.id)
          .single();
        if (prof) {
          const update: any = { games_played: (prof.games_played || 0) + 1 };
          if (isDraw) {
            update.draws = (prof.draws || 0) + 1;
          } else if (p.isWinner) {
            update.wins = (prof.wins || 0) + 1;
            update.games_won = (prof.games_played || 0) + 1; // legacy field
            update.rating = (prof.rating || 1200) + 15;
          } else {
            update.losses = (prof.losses || 0) + 1;
            update.rating = Math.max(100, (prof.rating || 1200) - 12);
          }
          await (supabase.from('profiles') as any).update(update).eq('id', p.id);
        }
      }
    } catch (e) {
      console.error('Settlement error:', e);
    } finally {
      setIsSettling(false);
    }
  };

  const handleMove = async (move: any) => {
    if (!gameData || gameData.status !== 'in_progress') return;

    const isWhiteTurn = user?.id === gameData.white_user_id;
    const turn = chess.turn();

    if ((turn === 'w' && !isWhiteTurn) || (turn === 'b' && isWhiteTurn)) {
      toast.error('No es tu turno');
      return;
    }

    try {
      const remainingTime = calculateRemainingTime(turn === 'w' ? 'white' : 'black', gameData);
      const result = chess.move(move);
      
      if (result) {
        let status = 'in_progress';
        let winner_user_id = null;
        let result_str: string | null = null;

        if (chess.isCheckmate()) {
          status = 'finished';
          winner_user_id = isWhiteTurn ? gameData.white_user_id : gameData.black_user_id;
          result_str = isWhiteTurn ? 'white' : 'black';
          toast.success('¡JAQUE MATE! Has ganado.');
        } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
          status = 'finished';
          result_str = 'draw';
          toast.info('Tablas.');
        }

        const update: any = {
          fen: chess.fen(),
          pgn: chess.pgn(),
          status,
          winner_user_id,
          result: result_str,
          last_move_at: new Date().toISOString(),
          moves: [...(gameData.moves || []), { ...move, t: Date.now(), san: result.san }]
        };

        if (turn === 'w') {
          update.white_time_ms = remainingTime;
        } else {
          update.black_time_ms = remainingTime;
        }

        const { error } = await supabase
          .from('games')
          .update(update)
          .eq('id', id);

        if (error) throw error;
        
        if (status === 'finished') {
          await settleGame(gameData, winner_user_id, result_str || 'draw');
        }
      }
    } catch (e) {
      toast.error('Movimiento inválido');
    }
  };

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchMessages();
    
    const chatChannel = supabase
      .channel(`chat-${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'game_messages',
        filter: `game_id=eq.${id}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [id]);

  const fetchMessages = async () => {
    const { data } = await (supabase
      .from('game_messages') as any)
      .select('*')
      .eq('game_id', id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    
    await (supabase.from('game_messages') as any).insert({
      game_id: id,
      user_id: user.id,
      content: newMessage.trim()
    });
    setNewMessage('');
  };

  const handleResign = async () => {
    if (settings.confirmResign && !window.confirm('¿Seguro que quieres rendirte?')) return;
    
    const winnerId = isWhite ? gameData.black_user_id : gameData.white_user_id;
    const result_str = isWhite ? 'black' : 'white';

    await supabase.from('games').update({
      status: 'finished',
      winner_user_id: winnerId,
      result: result_str,
      ended_at: new Date().toISOString(),
    }).eq('id', id);
    
    await settleGame(gameData, winnerId, result_str);
    toast.error('Has abandonado la partida');
  };

  const handleTimeout = async (colorTimedOut: 'white' | 'black') => {
    if (!gameData || gameData.status === 'finished') return;
    
    const isMyTimeout = (colorTimedOut === 'white' && isWhite) || (colorTimedOut === 'black' && !isWhite);
    if (!isMyTimeout) return;

    const winnerId = colorTimedOut === 'white' ? gameData.black_user_id : gameData.white_user_id;
    const result_str = colorTimedOut === 'white' ? 'black' : 'white';

    toast.error('Se agotó el tiempo');

    await supabase.from('games').update({
      status: 'finished',
      winner_user_id: winnerId,
      result: result_str,
      ended_at: new Date().toISOString(),
    }).eq('id', id);
    
    await settleGame(gameData, winnerId, result_str);
  };

  const handleDrawOffer = async () => {
    toast.info('Oferta de tablas enviada');
  };

  if (!gameData) return null;

  const isWhite = user?.id === gameData.white_user_id;
  const opponent = isWhite ? gameData.black_player : gameData.white_player;
  const me = isWhite ? gameData.white_player : gameData.black_player;

  return (
    <div className={`min-h-screen bg-[#0a0a0a] transition-all duration-500 ${isFocusMode ? 'pt-0' : 'pt-24'}`}>
      {!isFocusMode && <Header />}

      <main className="container mx-auto px-4 pb-12">
        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
          
          {/* Board Area */}
          <div className="w-full lg:flex-1 shrink-0 flex flex-col justify-center items-center h-full w-full lg:max-w-[900px] space-y-4">
            {/* Opponent Info */}
            <div className="flex items-center justify-between bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden border border-zinc-700">
                  {opponent?.avatar_url && <img src={opponent.avatar_url} className="w-full h-full object-cover" />}
                </div>
                <div>
                  <div className="text-white font-bold text-sm flex items-center gap-2">
                    {opponent?.display_name || 'Oponente'}
                    <span className="text-xs text-zinc-500 font-mono">({opponent?.rating_blitz || 1200})</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{isWhite ? 'Negras' : 'Blancas'}</div>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-lg font-mono text-xl font-bold min-w-[100px] text-center ${chess.turn() === (isWhite ? 'b' : 'w') ? 'bg-white text-black' : 'bg-black/40 text-zinc-500 border border-zinc-800'}`}>
                <LiveClock 
                  initialTimeMs={isWhite ? gameData.black_time_ms : gameData.white_time_ms}
                  lastMoveAt={gameData.last_move_at}
                  isActive={chess.turn() === (isWhite ? 'b' : 'w')}
                  onTimeout={() => handleTimeout(isWhite ? 'black' : 'white')}
                />
              </div>
            </div>

            {/* Chessboard */}
            <div className={`shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-lg overflow-hidden border-4 border-zinc-800/50 transition-all mx-auto bg-[#769656] ${isFocusMode ? 'scale-110' : ''}`} style={{ height: 'calc(100vh - 300px)', maxHeight: 'calc(100vh - 300px)', aspectRatio: '1/1' }}>
               <ChessBoard 
                  fen={chess.fen()} 
                  onMove={handleMove} 
                  orientation={isWhite ? 'white' : 'black'}
                  gameId={id!}
                  isMuted={isMuted}
                  lastMove={gameData.moves?.[gameData.moves.length - 1]}
               />
            </div>

            {/* My Info */}
            <div className="flex items-center justify-between bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden border border-zinc-700">
                  {me?.avatar_url && <img src={me.avatar_url} className="w-full h-full object-cover" />}
                </div>
                <div>
                  <div className="text-white font-bold text-sm flex items-center gap-2">
                    {me?.display_name || 'Tú'}
                    <span className="text-xs text-zinc-500 font-mono">({me?.rating_blitz || 1200})</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{isWhite ? 'Blancas' : 'Negras'}</div>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-lg font-mono text-xl font-bold min-w-[100px] text-center ${chess.turn() === (isWhite ? 'w' : 'b') ? 'bg-primary text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]' : 'bg-black/40 text-zinc-500 border border-zinc-800'}`}>
                <LiveClock 
                  initialTimeMs={isWhite ? gameData.white_time_ms : gameData.black_time_ms}
                  lastMoveAt={gameData.last_move_at}
                  isActive={chess.turn() === (isWhite ? 'w' : 'b')}
                  onTimeout={() => handleTimeout(isWhite ? 'white' : 'black')}
                />
              </div>
            </div>
          </div>

          {/* Professional Sidebar */}
          <div className="w-full lg:w-[400px] h-[720px] flex flex-col gap-4">
            <div className="flex-1 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl overflow-hidden flex flex-col backdrop-blur-xl">
              <Tabs defaultValue="moves" className="flex-1 flex flex-col">
                <TabsList className="bg-black/40 border-b border-zinc-800 p-1 h-14 shrink-0 rounded-none">
                  <TabsTrigger value="moves" className="flex-1 gap-2 data-[state=active]:bg-zinc-800/50">
                    <History className="w-4 h-4" /> Historial
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="flex-1 gap-2 data-[state=active]:bg-zinc-800/50">
                    <MessageSquare className="w-4 h-4" /> Chat
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="flex-1 gap-2 data-[state=active]:bg-zinc-800/50">
                    <Settings className="w-4 h-4" /> Ajustes
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/20">
                  <TabsContent value="moves" className="m-0 h-full">
                    <div className="grid grid-cols-2 gap-px bg-zinc-800/50 border border-zinc-800 rounded-lg overflow-hidden">
                      <div className="bg-zinc-900/60 p-2 text-[10px] font-mono text-zinc-500 text-center border-b border-zinc-800 col-span-2 uppercase tracking-widest py-3">
                        Comienzo de la partida
                      </div>
                      {gameData?.moves?.map((move: any, i: number) => (
                        <div key={i} className={`p-2 text-xs font-mono flex items-center gap-3 ${i % 2 === 0 ? 'bg-zinc-900/40 text-white' : 'bg-zinc-800/20 text-zinc-400'}`}>
                           <span className="text-zinc-600 w-4 text-right">{Math.floor(i/2) + 1}.</span>
                           <span className="font-bold">{move.san || move.to}</span>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="chat" className="m-0 h-full flex flex-col">
                    <div className="flex-1 space-y-4 overflow-y-auto mb-4">
                       <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-[10px] text-primary/60 italic leading-relaxed">
                         GameBet Chat: Respeta a tu oponente. El chat está monitoreado para garantizar un juego limpio y agradable.
                       </div>
                       {messages.map((msg, i) => (
                         <div key={i} className={`flex flex-col ${msg.user_id === user?.id ? 'items-end' : 'items-start'}`}>
                           <div className={`max-w-[80%] p-3 rounded-2xl text-xs ${msg.user_id === user?.id ? 'bg-primary text-white rounded-tr-none' : 'bg-zinc-800 text-zinc-300 rounded-tl-none'}`}>
                             {msg.content}
                           </div>
                         </div>
                       ))}
                    </div>
                    <div className="pt-2 relative">
                      <AnimatePresence>
                        {showEmojis && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-full left-0 mb-2 p-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl grid grid-cols-6 gap-2 z-50"
                          >
                            {COMMON_EMOJIS.map(emoji => (
                              <button 
                                key={emoji}
                                onClick={() => {
                                  setNewMessage(prev => prev + emoji);
                                  setShowEmojis(false);
                                }}
                                className="w-8 h-8 flex items-center justify-center hover:bg-zinc-800 rounded text-xl transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="relative flex items-center gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className={`shrink-0 w-10 h-10 rounded-lg ${showEmojis ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                          onClick={() => setShowEmojis(!showEmojis)}
                        >
                          <Smile className="w-5 h-5" />
                        </Button>
                        <div className="relative flex-1">
                          <Input 
                            placeholder="Escribe un mensaje..." 
                            className="bg-black/40 border-zinc-800 pr-10 h-10 text-xs rounded-lg" 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                          />
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 text-zinc-500 hover:text-white"
                            onClick={sendMessage}
                          >
                             <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="m-0 h-full space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Visual</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                           <span className="text-sm text-zinc-400">Tema del tablero</span>
                           <select className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none">
                             <option>Clásico (Madera)</option>
                             <option>Azul Galaxia</option>
                             <option>Verde Torneo</option>
                           </select>
                        </div>
                        <div className="flex items-center justify-between">
                           <span className="text-sm text-zinc-400">Estilo de piezas</span>
                           <select className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none">
                             <option>Neo (Premium)</option>
                             <option>Alpha</option>
                             <option>Letter</option>
                           </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Privacidad y Juego</h3>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-400">Silenciar sonidos</span>
                        <Button variant="ghost" size="sm" onClick={() => setIsMuted(!isMuted)}>
                          {isMuted ? <VolumeX className="w-5 h-5 text-destructive" /> : <Volume2 className="w-5 h-5" />}
                        </Button>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-400">Modo Enfoque</span>
                        <Button variant="ghost" size="sm" onClick={() => setIsFocusMode(!isFocusMode)}>
                          {isFocusMode ? <Minimize2 className="w-5 h-5 text-primary" /> : <Maximize2 className="w-5 h-5" />}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>

            {/* Game Actions */}
            <div className="grid grid-cols-2 gap-3 h-20">
              <Button 
                variant="outline" 
                className="h-full border-zinc-800 text-zinc-400 hover:bg-zinc-800/50 hover:text-white flex-col gap-1 rounded-xl"
                onClick={handleDrawOffer}
              >
                <Handshake className="w-5 h-5" />
                <span className="text-[10px] uppercase font-bold tracking-widest">Ofrecer Tablas</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-full border-zinc-800 text-zinc-400 hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive flex-col gap-1 rounded-xl"
                onClick={handleResign}
              >
                <Flag className="w-5 h-5" />
                <span className="text-[10px] uppercase font-bold tracking-widest">Rendirse</span>
              </Button>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800/50 p-4 rounded-xl flex items-center justify-between">
               <div className="text-[10px] font-mono text-zinc-600">ID: {id?.substring(0, 8)}</div>
               <div className="flex gap-4">
                 <RotateCcw className="w-4 h-4 text-zinc-600 hover:text-zinc-400 cursor-pointer" onClick={() => navigate('/lobby')} />
                 <RotateCcw className="w-4 h-4 text-zinc-600 hover:text-zinc-400 cursor-pointer rotate-180" />
               </div>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {gameData?.status === 'finished' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center space-y-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-2 border ${
                  gameData.result === (isWhite ? 'white' : 'black') 
                  ? 'bg-primary/20 border-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)]' 
                  : gameData.result === 'draw' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-destructive/20 border-destructive'
                }`}>
                  <Trophy className={`w-10 h-10 ${
                    gameData.result === (isWhite ? 'white' : 'black') ? 'text-primary' : 'text-zinc-500'
                  }`} />
                </div>

                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                    {gameData.result === (isWhite ? 'white' : 'black') ? '¡VICTORIA!' : 
                     gameData.result === 'draw' ? 'TABLAS' : 'DERROTA'}
                  </h2>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                    {gameData.result === 'draw' ? 'Empate Técnico' : 'Partida Finalizada'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-zinc-800/50">
                   <div className="space-y-1">
                      <div className="text-[10px] text-zinc-500 uppercase font-bold">Puntos</div>
                      <div className="text-xl font-mono font-bold text-white">
                        {gameData.result === (isWhite ? 'white' : 'black') ? '+15' : gameData.result === 'draw' ? '+0' : '-12'}
                      </div>
                   </div>
                   <div className="space-y-1">
                      <div className="text-[10px] text-zinc-500 uppercase font-bold">Nuevo Rating</div>
                      <div className="text-xl font-mono font-bold text-white">
                        {(profile as any)?.rating_blitz || profile?.rating || 1200}
                      </div>
                   </div>
                </div>

                <div className="space-y-3">
                  <Button 
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl"
                    onClick={() => navigate('/lobby')}
                  >
                    Volver al Lobby
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full h-10 text-zinc-500 hover:text-white"
                    onClick={() => window.location.reload()}
                  >
                    Ver análisis
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Play;
