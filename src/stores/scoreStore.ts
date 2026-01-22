import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Contestant } from '../types';

interface ScoreState {
    scores: Record<number, Record<number, number>>; // [contestantId][criteriaId] = points
    rankings: Record<number, number>; // [contestantId] = rank
    lockedContestants: Set<number>;
    contestants: Contestant[];
    loading: boolean;
    saving: boolean;
    error: string | null;

    // Actions
    fetchScores: (categoryId: number, judgeId: number) => Promise<void>;
    fetchRankings: (categoryId: number, judgeId: number) => Promise<void>;
    fetchContestants: (categoryId: number) => Promise<void>;

    setScore: (contestantId: number, criteriaId: number, points: number) => void;
    setRanking: (contestantId: number, rank: number) => void;

    lockContestant: (contestantId: number, categoryId: number, judgeId: number, isRanking: boolean) => Promise<boolean>;
    unlockContestant: (contestantId: number, categoryId: number, judgeId: number, isRanking: boolean) => Promise<void>;

    subscribeToScores: (categoryId: number) => () => void;
    subscribeToRankings: (categoryId: number) => () => void;

    reset: () => void;
}

export const useScoreStore = create<ScoreState>((set, get) => ({
    scores: {},
    rankings: {},
    lockedContestants: new Set(),
    contestants: [],
    loading: false,
    saving: false,
    error: null,

    fetchContestants: async (categoryId) => {
        // First, get the category to find its event_id
        const { data: categoryData } = await supabase
            .from('categories')
            .select('event_id')
            .eq('id', categoryId)
            .single();

        // Try to fetch contestants for this event
        // Fallback to all contestants if event_id column doesn't exist
        let contestants: Contestant[] = [];

        if (categoryData?.event_id) {
            const { data, error } = await supabase
                .from('contestants')
                .select('*')
                .eq('event_id', categoryData.event_id)
                .eq('is_active', true)
                .order('contestant_number');

            if (!error && data) {
                contestants = data as Contestant[];
            }
        }

        // Fallback: if no contestants found or event_id query failed, try without event_id filter
        if (contestants.length === 0) {
            const { data: allContestants } = await supabase
                .from('contestants')
                .select('*')
                .eq('is_active', true)
                .order('contestant_number');
            contestants = (allContestants || []) as Contestant[];
        }

        set({ contestants });
    },

    fetchScores: async (categoryId, judgeId) => {
        set({ loading: true });

        const { data } = await supabase
            .from('scores')
            .select('*, score_details(*)')
            .eq('category_id', categoryId)
            .eq('judge_id', judgeId);

        const scores: Record<number, Record<number, number>> = {};
        const lockedContestants = new Set<number>();

        data?.forEach((score: any) => {
            if (!scores[score.contestant_id]) {
                scores[score.contestant_id] = {};
            }
            if (score.status === 'submitted') {
                lockedContestants.add(score.contestant_id);
            }
            score.score_details?.forEach((detail: any) => {
                scores[score.contestant_id][detail.criteria_id] = detail.points;
            });
        });

        set({ scores, lockedContestants, loading: false });
    },

    fetchRankings: async (categoryId, judgeId) => {
        set({ loading: true });

        const { data } = await supabase
            .from('rankings')
            .select('*')
            .eq('category_id', categoryId)
            .eq('judge_id', judgeId);

        const rankings: Record<number, number> = {};
        const lockedContestants = new Set<number>();

        data?.forEach((ranking: any) => {
            rankings[ranking.contestant_id] = ranking.rank_position;
            if (ranking.status === 'submitted') {
                lockedContestants.add(ranking.contestant_id);
            }
        });

        set({ rankings, lockedContestants, loading: false });
    },

    setScore: (contestantId, criteriaId, points) => {
        set((state) => ({
            scores: {
                ...state.scores,
                [contestantId]: {
                    ...state.scores[contestantId],
                    [criteriaId]: points,
                },
            },
        }));
    },

    setRanking: (contestantId, rank) => {
        set((state) => ({
            rankings: {
                ...state.rankings,
                [contestantId]: rank,
            },
        }));
    },

    lockContestant: async (contestantId, categoryId, judgeId, isRanking) => {
        set({ saving: true });

        if (isRanking) {
            const { rankings } = get();
            await supabase.from('rankings').upsert({
                judge_id: judgeId,
                contestant_id: contestantId,
                category_id: categoryId,
                rank_position: rankings[contestantId] || 1,
                status: 'submitted',
            }, { onConflict: 'judge_id,contestant_id,category_id' });
        } else {
            const { scores } = get();
            const contestantScores = scores[contestantId] || {};
            const totalScore = Object.values(contestantScores).reduce((sum, p) => sum + p, 0);

            // Upsert score
            const { data: scoreRecord } = await supabase
                .from('scores')
                .upsert({
                    judge_id: judgeId,
                    contestant_id: contestantId,
                    category_id: categoryId,
                    total_score: totalScore,
                    status: 'submitted',
                }, { onConflict: 'judge_id,contestant_id,category_id' })
                .select('id')
                .single();

            if (scoreRecord) {
                // Delete old details and insert new
                await supabase.from('score_details').delete().eq('score_id', scoreRecord.id);

                const details = Object.entries(contestantScores).map(([criteriaId, points]) => ({
                    score_id: scoreRecord.id,
                    criteria_id: parseInt(criteriaId),
                    points,
                }));

                if (details.length > 0) {
                    await supabase.from('score_details').insert(details);
                }
            }
        }

        set((state) => ({
            lockedContestants: new Set([...state.lockedContestants, contestantId]),
            saving: false,
        }));

        return true;
    },

    unlockContestant: async (contestantId, categoryId, judgeId, isRanking) => {
        const table = isRanking ? 'rankings' : 'scores';

        await supabase
            .from(table)
            .update({ status: 'draft' })
            .eq('category_id', categoryId)
            .eq('judge_id', judgeId)
            .eq('contestant_id', contestantId);

        set((state) => {
            const newLocked = new Set(state.lockedContestants);
            newLocked.delete(contestantId);
            return { lockedContestants: newLocked };
        });
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

    subscribeToRankings: (categoryId) => {
        const channel = supabase
            .channel(`rankings-${categoryId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rankings', filter: `category_id=eq.${categoryId}` }, (payload) => {
                console.log('Ranking change:', payload);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },

    reset: () => set({
        scores: {},
        rankings: {},
        lockedContestants: new Set(),
        contestants: [],
        loading: false,
        saving: false,
        error: null,
    }),
}));
