import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Judge } from '../types';

interface AuthState {
    // Admin auth (Supabase Auth)
    session: any | null;
    isAdmin: boolean;

    // Judge auth (localStorage)
    judge: Judge | null;
    isJudge: boolean;

    // Actions
    setSession: (session: any) => void;
    setJudge: (judge: Judge | null) => void;
    logout: () => void;
    init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    session: null,
    isAdmin: false,
    judge: null,
    isJudge: false,

    setSession: (session) => set({ session, isAdmin: !!session }),

    setJudge: (judge) => {
        if (judge) {
            localStorage.setItem('judge', JSON.stringify(judge));
        } else {
            localStorage.removeItem('judge');
        }
        set({ judge, isJudge: !!judge });
    },

    logout: async () => {
        const { isAdmin } = get();
        if (isAdmin) {
            await supabase.auth.signOut();
        }
        localStorage.removeItem('judge');
        set({ session: null, isAdmin: false, judge: null, isJudge: false });
    },

    init: async () => {
        // Check admin session
        const { data: { session } } = await supabase.auth.getSession();

        // Check judge in localStorage
        const judgeData = localStorage.getItem('judge');
        const judge = judgeData ? JSON.parse(judgeData) : null;

        set({
            session,
            isAdmin: !!session,
            judge,
            isJudge: !!judge,
        });

        // Listen for auth changes
        supabase.auth.onAuthStateChange((_event, session) => {
            set({ session, isAdmin: !!session });
        });
    },
}));
