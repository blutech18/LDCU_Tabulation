import { useState, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';
import { FaGripVertical, FaLock, FaCheck, FaMedal } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import type { Contestant } from '../../types';

interface RankingTabularProps {
    categoryId: number;
    judgeId: number;
    onFinish: () => void;
    isDarkMode: boolean;
}

interface RankedContestant extends Contestant {
    rank: number;
    locked: boolean;
}

const RankingTabular = ({ categoryId, judgeId, onFinish, isDarkMode }: RankingTabularProps) => {
    const [contestants, setContestants] = useState<RankedContestant[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [locked, setLocked] = useState(false);

    useEffect(() => {
        fetchData();
    }, [categoryId]);

    const fetchData = async () => {
        // First, get the category to find its event_id
        const { data: categoryData } = await supabase
            .from('categories')
            .select('event_id')
            .eq('id', categoryId)
            .single();

        // Try to fetch contestants for this event
        // Fallback to all contestants if event_id column doesn't exist
        let contestantsList: Contestant[] = [];

        if (categoryData?.event_id) {
            const { data: contestantData, error } = await supabase
                .from('participants')
                .select('*')
                .eq('event_id', categoryData.event_id)
                .eq('is_active', true)
                .order('number');

            if (!error && contestantData) {
                contestantsList = contestantData as Contestant[];
            }
        }

        // Fallback: if no contestants found or event_id query failed, try without event_id filter
        if (contestantsList.length === 0) {
            const { data: allContestants } = await supabase
                .from('participants')
                .select('*')
                .eq('is_active', true)
                .order('number');
            contestantsList = (allContestants || []) as Contestant[];
        }

        // Fetch existing rankings from scores table
        // First get the first criteria for this category
        const { data: criteriaData } = await supabase
            .from('criteria')
            .select('id')
            .eq('category_id', categoryId)
            .order('display_order')
            .single();

        let rankingData: any[] = [];
        if (criteriaData) {
            const { data } = await supabase
                .from('scores')
                .select('participant_id, rank, submitted_at')
                .eq('criteria_id', criteriaData.id)
                .eq('judge_id', judgeId)
                .not('rank', 'is', null);
            rankingData = data || [];
        }

        // Apply existing rankings or assign default order
        const rankedContestants: RankedContestant[] = contestantsList?.map((contestant, index) => {
            const existingRank = rankingData?.find((r) => r.participant_id === contestant.id);
            return {
                ...contestant,
                rank: existingRank?.rank || index + 1,
                locked: !!existingRank?.submitted_at,
            };
        }) || [];

        // Sort by rank
        rankedContestants.sort((a, b) => a.rank - b.rank);

        setContestants(rankedContestants);
        setLocked(rankedContestants.every((c) => c.locked));
        setLoading(false);
    };

    const handleReorder = (newOrder: RankedContestant[]) => {
        if (locked) return;

        // Update ranks based on new order
        const updatedContestants = newOrder.map((contestant, index) => ({
            ...contestant,
            rank: index + 1,
        }));
        setContestants(updatedContestants);
    };

    const handleSaveRankings = async () => {
        setSaving(true);

        // Get the first criteria for this category
        const { data: criteriaData } = await supabase
            .from('criteria')
            .select('id')
            .eq('category_id', categoryId)
            .order('display_order')
            .single();

        if (!criteriaData) {
            console.error('No criteria found for category');
            setSaving(false);
            return;
        }

        // Delete existing rankings for this judge and category
        await supabase
            .from('scores')
            .delete()
            .eq('criteria_id', criteriaData.id)
            .eq('judge_id', judgeId);

        // Insert new rankings into scores table
        const rankings = contestants.map((contestant) => ({
            judge_id: judgeId,
            participant_id: contestant.id,
            criteria_id: criteriaData.id,
            score: 0, // Not used for ranking
            rank: contestant.rank,
            submitted_at: new Date().toISOString(),
        }));

        await supabase.from('scores').insert(rankings);

        setContestants((prev) => prev.map((c) => ({ ...c, locked: true })));
        setLocked(true);
        setSaving(false);
    };

    const handleUnlock = async () => {
        // Get the first criteria for this category
        const { data: criteriaData } = await supabase
            .from('criteria')
            .select('id')
            .eq('category_id', categoryId)
            .order('display_order')
            .single();

        if (criteriaData) {
            await supabase
                .from('scores')
                .update({ submitted_at: null })
                .eq('criteria_id', criteriaData.id)
                .eq('judge_id', judgeId);
        }

        setContestants((prev) => prev.map((c) => ({ ...c, locked: false })));
        setLocked(false);
    };

    const getRankMedal = (rank: number) => {
        switch (rank) {
            case 1:
                return <FaMedal className="w-5 h-5 text-yellow-400" />;
            case 2:
                return <FaMedal className="w-5 h-5 text-gray-300" />;
            case 3:
                return <FaMedal className="w-5 h-5 text-amber-600" />;
            default:
                return <span className={`w-5 h-5 flex items-center justify-center font-bold ${isDarkMode ? 'text-white/50' : 'text-gray-600'}`}>{rank}</span>;
        }
    };

    const getPoints = (rank: number, total: number) => {
        // Points system: 1st gets max points, decreasing
        return Math.max(total - rank + 1, 1);
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className={`w-8 h-8 border-4 rounded-full animate-spin ${isDarkMode ? 'border-white/20 border-t-white' : 'border-maroon/20 border-t-maroon'}`} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Instructions */}
            <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/20' : 'bg-purple-50 border border-purple-200'}`}>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-purple-700'}`}>
                    {locked
                        ? '✅ Rankings are locked. Click unlock to make changes.'
                        : '🎯 Drag and drop to rearrange contestants by rank. Top position = 1st place.'}
                </p>
            </div>

            {/* Ranking List */}
            <div className={`rounded-2xl overflow-hidden shadow-lg ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/10' : 'bg-white border border-gray-200'}`}>
                <Reorder.Group
                    axis="y"
                    values={contestants}
                    onReorder={handleReorder}
                    className={isDarkMode ? 'divide-y divide-white/5' : 'divide-y divide-gray-100'}
                >
                    {contestants.map((contestant, index) => (
                        <Reorder.Item
                            key={contestant.id}
                            value={contestant}
                            className={`${locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
                            style={{ pointerEvents: locked ? 'none' : 'auto' } as any}
                        >
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={`flex items-center gap-4 p-4 ${locked ? (isDarkMode ? 'bg-green-500/5' : 'bg-green-50') : (isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50')
                                    }`}
                            >
                                {/* Drag Handle */}
                                {!locked && (
                                    <div className={isDarkMode ? 'text-white/30 hover:text-white/50' : 'text-gray-400 hover:text-gray-600'}>
                                        <FaGripVertical className="w-4 h-4" />
                                    </div>
                                )}

                                {/* Rank Badge */}
                                <div
                                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${contestant.rank === 1
                                        ? isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100 border border-yellow-300'
                                        : contestant.rank === 2
                                            ? isDarkMode ? 'bg-gray-400/20' : 'bg-gray-100 border border-gray-300'
                                            : contestant.rank === 3
                                                ? isDarkMode ? 'bg-amber-600/20' : 'bg-amber-100 border border-amber-300'
                                                : isDarkMode ? 'bg-white/10' : 'bg-gray-50 border border-gray-200'
                                        }`}
                                >
                                    {getRankMedal(contestant.rank)}
                                </div>

                                {/* Contestant Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-sm ${isDarkMode ? 'bg-gradient-to-br from-primary-500 to-accent-500' : 'bg-gradient-to-br from-maroon to-maroon-dark'}`}>
                                            {contestant.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{contestant.name}</p>
                                            <p className={`text-sm ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>{contestant.department}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Points Display */}
                                <div className="text-right">
                                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-maroon'}`}>
                                        {getPoints(contestant.rank, contestants.length)}
                                    </p>
                                    <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>points</p>
                                </div>
                            </motion.div>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4">
                {locked ? (
                    <>
                        <button
                            onClick={handleUnlock}
                            className={`flex items-center gap-2 px-6 py-3 font-medium rounded-xl transition-colors shadow-lg ${isDarkMode ? 'bg-white/20 backdrop-blur-lg border border-white/30 text-white hover:bg-white/30' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-maroon'}`}
                        >
                            <FaLock className="w-4 h-4" />
                            Unlock Rankings
                        </button>
                        <button
                            onClick={onFinish}
                            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg shadow-green-500/25"
                        >
                            <FaCheck className="w-5 h-5" />
                            Complete Ranking
                        </button>
                    </>
                ) : (
                    <button
                        onClick={handleSaveRankings}
                        disabled={saving}
                        className={`flex items-center gap-2 px-8 py-4 text-white font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 ${isDarkMode ? 'bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold shadow-gold/50' : 'bg-maroon hover:bg-maroon-dark shadow-maroon/25'}`}
                    >
                        {saving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <FaCheck className="w-5 h-5" />
                                Save Rankings
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default RankingTabular;
