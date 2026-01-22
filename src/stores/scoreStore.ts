import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Score, Participant } from '../types';

interface ScoreState {
    scores: Record<number, Record<number, number>>; // [participantId][criteriaId] = points
    rankings: Record<number, number>; // [participantId] = rank
    lockedParticipants: Set<number>;
    participants: Participant[];
    loading: boolean;
    error: string | null;

    // Actions
    fetchScores: (categoryId: number, judgeId: number) => Promise<void>;
    fetchParticipants: (categoryId: number) => Promise<void>;
    setScore: (participantId: number, criteriaId: number, points: number) => void;
    setRanking: (participantId: number, rank: number) => void;
    saveScores: (participantId: number, categoryId: number, judgeId: number) => Promise<boolean>;
    lockParticipant: (participantId: number, categoryId: number, judgeId: number, isRanking: boolean) => Promise<boolean>;
    unlockParticipant: (participantId: number, categoryId: number, judgeId: number) => Promise<void>;
    subscribeToScores: (categoryId: number) => () => void;
    reset: () => void;
}

export const useScoreStore = create<ScoreState>((set, get) => ({
    scores: {},
    rankings: {},
    lockedParticipants: new Set(),
    participants: [],
    loading: false,
    error: null,

    fetchParticipants: async (categoryId) => {
        set({ loading: true, error: null });
        try {
            // First get the event_id for this category
            const { data: categoryData } = await supabase
                .from('categories')
                .select('event_id')
                .eq('id', categoryId)
                .single();

            if (!categoryData) throw new Error('Category not found');

            // Try to fetch participants for this event
            let participants: Participant[] = [];

            const { data, error } = await supabase
                .from('participants')
                .select('*')
                .eq('event_id', categoryData.event_id)
                .eq('is_active', true)
                .order('participant_number');

            if (error) throw error;

            if (data) {
                participants = data as Participant[];
            }

            set({ participants });
        } catch (error) {
            console.error('Error fetching participants:', error);
            set({ error: (error as Error).message });
        } finally {
            set({ loading: false });
        }
    },

    fetchScores: async (categoryId, judgeId) => {
        set({ loading: true, error: null });
        try {
            // Fetch scores
            const { data: scoresData, error: scoresError } = await supabase
                .from('scores')
                .select('*')
                .eq('category_id', categoryId)
                .eq('judge_id', judgeId);

            if (scoresError) throw scoresError;

            const scores: Record<number, Record<number, number>> = {};
            const lockedParticipants = new Set<number>();

            scoresData?.forEach((score: Score) => {
                if (!scores[score.participant_id]) {
                    scores[score.participant_id] = {};
                }
                // If we are just mapping points by criteria:
                if (score.criteria_id) {
                    scores[score.participant_id][score.criteria_id] = score.score;
                }

                lockedParticipants.add(score.participant_id);
            });

            const rankings: Record<number, number> = {};
            scoresData?.forEach((score: Score) => {
                if (score.rank) {
                    rankings[score.participant_id] = score.rank;
                    lockedParticipants.add(score.participant_id);
                }
            });

            set({ scores, rankings, lockedParticipants, loading: false });
        } catch (error) {
            console.error('Error fetching scores:', error);
            set({ error: (error as Error).message });
        } finally {
            set({ loading: false });
        }
    },



    setScore: (participantId, criteriaId, points) => {
        const state = get();
        set({
            scores: {
                ...state.scores,
                [participantId]: {
                    ...state.scores[participantId],
                    [criteriaId]: points
                }
            }
        });
    },

    setRanking: (participantId, rank) => {
        const state = get();
        set({
            rankings: {
                ...state.rankings,
                [participantId]: rank
            }
        });
    },

    lockParticipant: async (participantId, categoryId, judgeId, isRanking) => {
        const state = get();
        set({ loading: true });
        try {
            if (isRanking) {
                const rank = state.rankings[participantId];
                if (!rank) throw new Error("No rank assigned");

                // For ranking categories, get the first criteria to store the rank
                const { data: criteria } = await supabase
                    .from('criteria')
                    .select('id')
                    .eq('category_id', categoryId)
                    .order('display_order')
                    .limit(1)
                    .single();

                if (!criteria) throw new Error("No criteria found for category");

                // Store rank in scores table with the first criteria
                await supabase.from('scores').upsert({
                    judge_id: judgeId,
                    participant_id: participantId,
                    criteria_id: criteria.id,
                    score: 0, // Score not used for ranking
                    rank: rank,
                    submitted_at: new Date().toISOString(),
                }, { onConflict: 'judge_id,participant_id,criteria_id' });

            } else {
                // Scoring logic
                const participantScores = state.scores[participantId] || {};

                const inserts = Object.entries(participantScores).map(([criteriaId, score]) => ({
                    judge_id: judgeId,
                    participant_id: participantId,
                    criteria_id: parseInt(criteriaId),
                    score: score,
                    submitted_at: new Date().toISOString(),
                }));

                if (inserts.length === 0) return false;

                const { error } = await supabase
                    .from('scores')
                    .upsert(inserts, { onConflict: 'judge_id,participant_id,criteria_id' });

                if (error) throw error;
            }

            set({
                lockedParticipants: new Set([...state.lockedParticipants, participantId]),
                loading: false
            });
            return true;
        } catch (error) {
            console.error('Error saving/locking scores:', error);
            set({ error: (error as Error).message, loading: false });
            return false;
        }
    },

    unlockParticipant: async (participantId, categoryId, judgeId) => {
        // Get criteria for this category to find the score records
        const { data: criteria } = await supabase
            .from('criteria')
            .select('id')
            .eq('category_id', categoryId);

        if (criteria && criteria.length > 0) {
            const criteriaIds = criteria.map(c => c.id);

            await supabase
                .from('scores')
                .update({ submitted_at: null })
                .eq('judge_id', judgeId)
                .eq('participant_id', participantId)
                .in('criteria_id', criteriaIds);
        }

        set((state) => {
            const newLocked = new Set(state.lockedParticipants);
            newLocked.delete(participantId);
            return { lockedParticipants: newLocked };
        });
    },

    saveScores: async (participantId, categoryId, judgeId) => {
        // Alias for lockParticipant for now
        return get().lockParticipant(participantId, categoryId, judgeId, false);
    },

    subscribeToScores: (categoryId) => {
        const channel = supabase
            .channel(`scores-${categoryId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `category_id=eq.${categoryId}` }, (payload) => {
                console.log('Score change:', payload);
                // Could trigger re-fetch or update state directly
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },



    reset: () => set({
        scores: {},
        rankings: {},
        lockedParticipants: new Set(),
        participants: [],
        loading: false,
        error: null,
    }),
}));
