import { useEffect, useState } from 'react';
import { useScoreStore } from '../stores';
import { supabase } from '../lib/supabase';
import type { Criteria } from '../types';

interface UseScoresParams {
    categoryId: number;
    judgeId: number;
}

/**
 * Hook to manage scores/rankings with real-time updates
 */
export function useScores({ categoryId, judgeId }: UseScoresParams) {
    const {
        scores,
        rankings,
        participants,
        lockedParticipants,
        loading,
        fetchParticipants,
        fetchScores,
        setScore,
        setRanking,
        lockParticipant,
        unlockParticipant,
    } = useScoreStore();

    useEffect(() => {
        if (categoryId && judgeId) {
            fetchScores(categoryId, judgeId);
            fetchParticipants(categoryId);
        }
    }, [categoryId, judgeId]);

    const handleScoreChange = (participantId: number, criteriaId: number, points: number) => {
        if (lockedParticipants.has(participantId)) return;
        setScore(participantId, criteriaId, points);
    };

    const handleRankingChange = (participantId: number, rank: number) => {
        if (lockedParticipants.has(participantId)) return;
        setRanking(participantId, rank);
    };

    const handleSubmitScores = async (participantId: number, isRanking = false) => {
        return lockParticipant(participantId, categoryId, judgeId, isRanking);
    };

    const handleUnlockScores = async (participantId: number) => {
        return unlockParticipant(participantId, categoryId, judgeId);
    };

    const getParticipantScore = (participantId: number, criteriaId: number) => {
        if (scores[participantId] && scores[participantId][criteriaId] !== undefined) {
            return scores[participantId][criteriaId];
        }
        return 0; // Default score
    };

    const getParticipantRank = (participantId: number) => {
        return rankings[participantId] || 0;
    };

    const isParticipantLocked = (participantId: number) => {
        return lockedParticipants.has(participantId);
    };

    const allLocked = participants.length > 0 && participants.every(p => lockedParticipants.has(p.id));

    return {
        scores,
        rankings,
        participants,
        loading,
        allLocked,
        handleScoreChange,
        handleRankingChange,
        handleSubmitScores,
        handleUnlockScores,
        getParticipantScore,
        getParticipantRank,
        isParticipantLocked,
        manualRefresh: () => {
            fetchScores(categoryId, judgeId);
            fetchParticipants(categoryId);
        }
    };
};

/**
 * Hook to fetch criteria for a category
 */
export function useCriteria(categoryId: number) {
    const [criteria, setCriteria] = useState<Criteria[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCriteria = async () => {
            const { data } = await supabase
                .from('criteria')
                .select('*')
                .eq('category_id', categoryId)
                // .eq('is_active', true) // Removed is_active
                .order('display_order');

            setCriteria((data as unknown as Criteria[]) || []);
            setLoading(false);
        };

        fetchCriteria();
    }, [categoryId]);

    return { criteria, loading };
}
