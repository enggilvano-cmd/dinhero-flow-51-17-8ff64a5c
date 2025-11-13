import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  whatsapp?: string;
  avatar_url?: string;
  role: 'admin' | 'user' | 'subscriber' | 'trial';
  is_active: boolean;
  trial_expires_at?: string;
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, whatsapp?: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  isAdmin: () => boolean;
  hasRole: (role: 'admin' | 'user' | 'subscriber' | 'trial') => boolean;
  isSubscriptionActive: () => boolean;
  getSubscriptionTimeRemaining: () => string | null;
  initializeUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar o perfil do usuário.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('Profile fetched:', data);
      setProfile(data ? {
        ...data,
        full_name: data.full_name ?? undefined,
        avatar_url: data.avatar_url ?? undefined,
        whatsapp: data.whatsapp ?? undefined,
        trial_expires_at: data.trial_expires_at ?? undefined,
        subscription_expires_at: data.subscription_expires_at ?? undefined,
      } : null);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar perfil.",
        variant: "destructive",
      });
    }
  };

  const logActivity = async (action: string, resourceType: string, resourceId?: string) => {
    if (user) {
      try {
        const result = await supabase.rpc('log_user_activity', {
          p_user_id: user.id,
          p_action: action,
          p_resource_type: resourceType,
          p_resource_id: resourceId
        });
        
        if (result.error) {
          console.error('Error logging activity:', result.error);
        }
      } catch (error) {
        console.error('Error logging activity:', error);
      }
    }
  };

  const initializeUserData = async () => {
    if (!user) return;
    
    try {
      console.log('Initializing user data for:', user.id);
      
      // Initialize default categories if none exist
      const { data: categories } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (!categories || categories.length === 0) {
        console.log('Initializing default categories');
        await supabase.rpc('initialize_default_categories', { p_user_id: user.id });
      }

      // Initialize default settings if none exist (using upsert to avoid race conditions)
      await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          currency: 'BRL',
          theme: 'system',
          notifications: true,
          auto_backup: false,
          language: 'pt-BR'
        }, { onConflict: 'user_id', ignoreDuplicates: true });
      
      console.log('User data initialization completed');
    } catch (error) {
      console.error('Error initializing user data:', error);
    }
  };

  const syncProfileEmail = async (userId: string, newEmail?: string | null) => {
    try {
      if (!newEmail) return;
      const { error } = await supabase
        .from('profiles')
        .update({ email: newEmail })
        .eq('user_id', userId)
        .neq('email', newEmail);
      if (error) {
        console.error('Error syncing profile email:', error);
      } else {
        console.log('Profile email synced to auth email');
      }
    } catch (error) {
      console.error('Unexpected error syncing profile email:', error);
    }
  };

  useEffect(() => {
    console.log('Setting up auth state listener...');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);

          // Ensure profiles.email matches Auth email after any auth change
          setTimeout(() => {
            syncProfileEmail(session.user!.id, session.user!.email);
          }, 0);
          
          if (event === 'SIGNED_IN') {
            setTimeout(async () => {
              await logActivity('signed_in', 'auth');
              await initializeUserData();
            }, 0);
          }
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.id);
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        // Also sync profile.email to the current auth email
        setTimeout(() => {
          syncProfileEmail(session.user!.id, session.user!.email);
        }, 0);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting to sign in user:', email);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Sign in successful');
        toast({
          title: "Login realizado",
          description: "Bem-vindo de volta!",
        });
      }

      return { error };
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, whatsapp?: string) => {
    try {
      console.log('Attempting to sign up user:', email);
      
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            whatsapp: whatsapp,
          }
        }
      });

      if (error) {
        console.error('Sign up error:', error);
        toast({
          title: "Erro no cadastro",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Sign up successful');
        toast({
          title: "Cadastro realizado",
          description: "Verifique seu email para confirmar a conta.",
        });
      }

      return { error };
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      console.log('Attempting to sign out');
      
      await logActivity('signed_out', 'auth');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        toast({
          title: "Erro ao sair",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Sign out successful');
        toast({
          title: "Logout realizado",
          description: "Até logo!",
        });
      }

      return { error };
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('Attempting to reset password for:', email);
      
      const redirectUrl = `${window.location.origin}/auth?mode=reset`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('Reset password error:', error);
        toast({
          title: "Erro na recuperação",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Reset password successful');
        toast({
          title: "Email enviado",
          description: "Verifique seu email para redefinir a senha.",
        });
      }

      return { error };
    } catch (error: any) {
      console.error('Reset password error:', error);
      toast({
        title: "Erro na recuperação",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const isAdmin = () => {
    const result = profile?.role === 'admin' && profile?.is_active;
    console.log('isAdmin check:', { role: profile?.role, active: profile?.is_active, result });
    return result;
  };

  const hasRole = (role: 'admin' | 'user' | 'subscriber' | 'trial') => {
    return profile?.role === role && profile?.is_active;
  };

  const isSubscriptionActive = () => {
    if (!profile) return false;
    if (profile.role === 'admin' || profile.role === 'user') return profile.is_active;
    if (profile.role === 'trial') {
      if (!profile.trial_expires_at) return false;
      const expiresAt = new Date(profile.trial_expires_at);
      const now = new Date();
      return expiresAt > now && profile.is_active;
    }
    if (profile.role === 'subscriber') {
      if (!profile.subscription_expires_at) return false;
      const expiresAt = new Date(profile.subscription_expires_at);
      const now = new Date();
      return expiresAt > now && profile.is_active;
    }
    return false;
  };

  const getSubscriptionTimeRemaining = () => {
    if (!profile) return null;
    
    let expiresAt: Date | null = null;
    
    if (profile.role === 'trial' && profile.trial_expires_at) {
      expiresAt = new Date(profile.trial_expires_at);
    } else if (profile.role === 'subscriber' && profile.subscription_expires_at) {
      expiresAt = new Date(profile.subscription_expires_at);
    }
    
    if (!expiresAt) return null;
    
    const now = new Date();
    const timeLeft = expiresAt.getTime() - now.getTime();
    
    if (timeLeft <= 0) return 'Expirado';
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} dia${days > 1 ? 's' : ''} restante${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours}h restantes`;
    } else {
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      return `${minutes}m restantes`;
    }
  };

  return (
    <AuthContext.Provider 
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        isAdmin,
        hasRole,
        isSubscriptionActive,
        getSubscriptionTimeRemaining,
        initializeUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}