import { Home, Users, Gamepad2, Trophy, User, Brain, UserPlus, BarChart3 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const BottomNav = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/lobby', icon: Users, label: 'Lobby' },
    { path: '/matchmaking', icon: Gamepad2, label: 'Jugar' },
    { path: '/friends', icon: UserPlus, label: 'Amigos' },
    { path: '/coach', icon: Brain, label: 'Coach AI' },
    { path: '/insights', icon: BarChart3, label: 'Insights' },
    { path: '/rankings', icon: Trophy, label: 'Ranking' },
    { path: '/profile', icon: User, label: 'Perfil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card border-b-0 rounded-b-none safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-1 py-2 px-4 relative"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <item.icon
                className={`w-5 h-5 relative z-10 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
              <span
                className={`text-[10px] font-medium relative z-10 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
