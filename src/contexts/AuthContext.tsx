import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useWalletContext } from '@/contexts/WalletContext';
import { toast } from 'sonner';

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  balance: number;
  balance_usdt: number;
  total_deposited: number;
  total_withdrawn: number;
  total_won: number;
  total_won_usdt: number;
  wallet_address: string | null;
  preferred_wallet: string | null;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  rating_bullet: number;
  rating_blitz: number;
  rating_rapid: number;
  country_code: string | null;
  settings: any | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, displayName?: string, avatarUrl?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
  updateBalance: (newBalance: number, currency?: 'BNB' | 'USDT') => void;
  linkWallet: (address: string, walletType: string) => Promise<void>;
  isSyncing: boolean;
  clearSignoutFlag: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncTrigger, setSyncTrigger] = useState(0);
  const { address, activeWalletType } = useWalletContext();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data as unknown as Profile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      if (profileData) {
        setProfile(profileData);
      }
    }
  };

  const updateBalance = (newBalance: number, currency: 'BNB' | 'USDT' = 'BNB') => {
    if (profile) {
      if (currency === 'USDT') {
        setProfile({ ...profile, balance_usdt: newBalance });
      } else {
        setProfile({ ...profile, balance: newBalance });
      }
    }
  };

  const linkWallet = async (walletAddress: string, walletType: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({ wallet_address: walletAddress, preferred_wallet: walletType })
      .eq('id', user.id);

    if (!error) {
      await refreshProfile();
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          fetchProfile(session.user.id).then(setProfile);
        } else if (!address) {
          setProfile(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [address]);

  // Ref to prevent re-entrant sync calls
  const syncInProgress = React.useRef(false);

  // Effect to handle wallet-only profile syncing
  useEffect(() => {
    // Check if user explicitly signed out recently
    const checkSignoutStatus = () => localStorage.getItem('gamebet_signout_requested') === 'true';

    const syncWalletProfile = async () => {
      // Don't sync if no address, or if already syncing
      if (!address || syncInProgress.current) return;
      
      // If we already have a user and a profile with a wallet address, we're done
      if (user && profile?.wallet_address === address) return;

      syncInProgress.current = true;
      setIsSyncing(true);
      try {
        // If already has a user, ensure wallet is linked
        if (user && profile && !profile.wallet_address) {
          await linkWallet(address, activeWalletType || 'metamask');
          return;
        }

        // If no user, but has address, we need a real Supabase Auth user to pass RLS
        const signoutRequested = checkSignoutStatus();

        if (!user && !isLoading && !signoutRequested) {
          const dummyEmail = `${address.toLowerCase()}@wallet.gamebet`;
          const dummyPassword = 'WalletLogin2026!';
          
          console.log("AUTH_DEBUG: Attempting Web3 Shadow Login for", address);

          // Try to sign in first
          let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: dummyEmail,
            password: dummyPassword
          });

          if (signInError) {
            console.log("AUTH_DEBUG: Shadow Sign-in failed (likely new user), attempting Sign-up...", signInError.message);
            // If sign in fails, sign up the user
            const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
              email: dummyEmail,
              password: dummyPassword,
              options: {
                data: {
                  display_name: `Master-${address.substring(2, 6).toUpperCase()}`,
                  is_wallet_user: true
                }
              }
            });

            if (signUpError) {
              console.error('AUTH_DEBUG: Shadow Sign-up failed:', signUpError.message);
              toast.error(`Error al vincular wallet: ${signUpError.message}`);
              // We do not use anonymous fallback to ensure game persistence.
              return;
            }

            console.log("AUTH_DEBUG: Shadow Sign-up success for", address);
            // After signup, update the profile with the wallet address
            if (signUpData.user) {
              const { error: linkError } = await supabase
                .from('profiles')
                .update({ 
                  wallet_address: address, 
                  preferred_wallet: activeWalletType || 'metamask' 
                })
                .eq('id', signUpData.user.id);
              
              if (linkError) console.error("AUTH_DEBUG: Profile link error:", linkError);
              await refreshProfile();
            }
          }
        } else if (signoutRequested) {
          console.log("AUTH_DEBUG: Shadow sync skipped - signoutRequested is true. If you want to play, please login or reconnect.");
        }
      } catch (err) {
        console.error('Error syncing wallet profile:', err);
      } finally {
        setIsSyncing(false);
        syncInProgress.current = false;
      }
    };

    // Adding a small delay to let other state updates settle
    const timer = setTimeout(syncWalletProfile, 500);
    return () => clearTimeout(timer);
  }, [address, user, profile?.wallet_address, isLoading, syncTrigger]);

  const clearSignoutFlag = () => {
    localStorage.removeItem('gamebet_signout_requested');
    setSyncTrigger(prev => prev + 1);
  };

  const signUp = async (email: string, password: string, displayName?: string, avatarUrl?: string) => {
    localStorage.removeItem('gamebet_signout_requested');
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName || email.split('@')[0],
          avatar_url: avatarUrl || null
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    localStorage.removeItem('gamebet_signout_requested');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const signOut = async () => {
    localStorage.setItem('gamebet_signout_requested', 'true');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isAuthenticated: !!user,
        signUp,
        signIn,
        signOut,
        resetPassword,
        refreshProfile,
        updateBalance,
        linkWallet,
        isSyncing,
        clearSignoutFlag
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
