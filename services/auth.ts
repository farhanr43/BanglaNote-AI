import { supabase } from './supabaseClient';
import { AuthUser } from '../types';

export interface SignUpResult {
  ok: boolean;
  needsEmailConfirmation: boolean;
  error?: string;
}

export const authService = {
  async getCurrentUser(): Promise<AuthUser | null> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? '' };
  },

  async signUp(email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, needsEmailConfirmation: false, error: error.message };
    return {
      ok: true,
      needsEmailConfirmation: !!data.user && !data.session,
    };
  },

  async signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  /** Google OAuth — redirect flow; the app reloads with a session on return. */
  async signInWithGoogle(): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  onAuthChange(callback: (user: AuthUser | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null);
    });
    return () => data.subscription.unsubscribe();
  },

  /** Attach the current session JWT, or null for guests. */
  async getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
};
