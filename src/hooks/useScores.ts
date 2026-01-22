import { useEffect, useState } from 'react';
import { useScoreStore } from '../stores';
import { supabase } from '../lib/supabase';
import type { CategoryCriteria } from '../types';

interface UseScoresParams {
    categoryId: number;
    judgeId: number;
    isRanking?: boolean;
}

/**
 * Hook to manage scores/rankings with real-time updates
 */
export function useScores({ categoryId, judgeId, isRanking = false }: UseScoresParams) {
    const store = useScoreStore();
    const {
        scores,
        rankings,
        contestants,
        lockedContestants,
        loading,
        saving,
        fetchContestants,
        fetchScores,
        fetchRankings,
        setScore,
        setRanking,
        lockContestant,
        unlockContestant,
        subscribeToScores,
        subscribeToRankings,
        reset,
    } = store;

    useEffect(() => {
        // Fetch initial data
        fetchContestants(categoryId);
        if (isRanking) {
            fetchRankings(categoryId, judgeId);
        } else {
            fetchScores(categoryId, judgeId);
        }

        // Subscribe to real-time updates
        const unsubscribe = isRanking
            ? subscribeToRankings(categoryId)
            : subscribeToScores(categoryId);

        return () => {
            unsubscribe();
            reset();
        };
    }, [categoryId, judgeId, isRanking]);

    const handleScoreChange = (contestantId: number, criteriaId: number, points: number) => {
        if (lockedContestants.has(contestantId)) return;
        setScore(contestantId, criteriaId, points);
    };

    const handleRankingChange = (contestantId: number, rank: number) => {
        if (lockedContestants.has(contestantId)) return;
        setRanking(contestantId, rank);
    };

    const handleLock = async (contestantId: number) => {
        return lockContestant(contestantId, categoryId, judgeId, isRanking);
    };

    const handleUnlock = async (contestantId: number) => {
        return unlockContestant(contestantId, categoryId, judgeId, isRanking);
    };

    const getContestantScore = (contestantId: number, criteriaId: number) => {
        return scores[contestantId]?.[criteriaId] || 0;
    };

    const getTotalScore = (contestantId: number) => {
        const contestantScores = scores[contestantId] || {};
        return Object.values(contestantScores).reduce((sum, p) => sum + p, 0);
    };

    const isContestantLocked = (contestantId: number) => {
        return lockedContestants.has(contestantId);
    };

    const allLocked = contestants.length > 0 && contestants.every(c => lockedContestants.has(c.id));

    return {
        contestants,
        scores,
        rankings,
        loading,
        saving,
        handleScoreChange,
        handleRankingChange,
        handleLock,
        handleUnlock,
        getContestantScore,
        getTotalScore,
        isContestantLocked,
        allLocked,
    };
}

/**
 * Hook to fetch criteria for a category
 */
export function useCriteria(categoryId: number) {
    const [criteria, setCriteria] = useState<CategoryCriteria[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCriteria = async () => {
            const { data } = await supabase
                .from('category_criteria')
                .select('*')
                .eq('category_id', categoryId)
                .eq('is_active', true)
                .order('display_order');

            setCriteria((data as CategoryCriteria[]) || []);
            setLoading(false);
        };

        fetchCriteria();
    }, [categoryId]);

    return { criteria, loading };
}
