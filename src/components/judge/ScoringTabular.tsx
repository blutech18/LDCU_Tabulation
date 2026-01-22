import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaLock, FaUnlock, FaCheck } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import type { Contestant, CategoryCriteria } from '../../types';

interface ScoringTabularProps {
    categoryId: number;
    judgeId: number;
    onFinish: () => void;
    isDarkMode: boolean;
}

interface ScoreState {
    [contestantId: number]: {
        [criteriaId: number]: number;
        locked: boolean;
    };
}

const ScoringTabular = ({ categoryId, judgeId, onFinish, isDarkMode }: ScoringTabularProps) => {
    const [contestants, setContestants] = useState<Contestant[]>([]);
    const [criteria, setCriteria] = useState<CategoryCriteria[]>([]);
    const [scores, setScores] = useState<ScoreState>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
                .from('contestants')
                .select('*')
                .eq('event_id', categoryData.event_id)
                .eq('is_active', true)
                .order('contestant_number');

            if (!error && contestantData) {
                contestantsList = contestantData as Contestant[];
            }
        }

        // Fallback: if no contestants found or event_id query failed, try without event_id filter
        if (contestantsList.length === 0) {
            const { data: allContestants } = await supabase
                .from('contestants')
                .select('*')
                .eq('is_active', true)
                .order('contestant_number');
            contestantsList = (allContestants || []) as Contestant[];
        }

        setContestants(contestantsList);

        // Fetch criteria for this category
        const { data: criteriaData } = await supabase
            .from('category_criteria')
            .select('*')
            .eq('category_id', categoryId)
            .eq('is_active', true)
            .order('display_order');

        setCriteria((criteriaData as CategoryCriteria[]) || []);

        // Fetch existing scores
        const { data: scoreData } = await supabase
            .from('scores')
            .select('*, score_details(*)')
            .eq('category_id', categoryId)
            .eq('judge_id', judgeId);

        // Initialize scores state
        const initialScores: ScoreState = {};
        contestantsList?.forEach((contestant) => {
            initialScores[contestant.id] = { locked: false };
            criteriaData?.forEach((c: any) => {
                initialScores[contestant.id][c.id] = 0;
            });
        });

        // Apply existing scores
        scoreData?.forEach((score: any) => {
            if (initialScores[score.contestant_id]) {
                initialScores[score.contestant_id].locked = score.status === 'submitted';
                score.score_details?.forEach((detail: { category_criteria_id: number; raw_score: number }) => {
                    if (initialScores[score.contestant_id]) {
                        initialScores[score.contestant_id][detail.category_criteria_id] = detail.raw_score;
                    }
                });
            }
        });

        setScores(initialScores);
        setLoading(false);
    };

    const handleScoreChange = (contestantId: number, criteriaId: number, value: number) => {
        if (scores[contestantId]?.locked) return;

        const max = criteria.find((c) => c.id === criteriaId)?.percentage || 100;
        const clampedValue = Math.min(Math.max(0, value), max);

        setScores((prev) => ({
            ...prev,
            [contestantId]: {
                ...prev[contestantId],
                [criteriaId]: clampedValue,
            },
        }));
    };

    const calculateTotal = (contestantId: number) => {
        if (!scores[contestantId]) return 0;
        return criteria.reduce((sum, c) => sum + (scores[contestantId][c.id] || 0), 0);
    };

    const handleLockContestant = async (contestantId: number) => {
        setSaving(true);

        // Save scores to database
        const totalScore = calculateTotal(contestantId);

        // Check if score exists
        const { data: existingScore } = await supabase
            .from('scores')
            .select('id')
            .eq('category_id', categoryId)
            .eq('judge_id', judgeId)
            .eq('contestant_id', contestantId)
            .single();

        let scoreId: number;

        if (existingScore) {
            // Update existing score
            await supabase
                .from('scores')
                .update({ total_score: totalScore, status: 'submitted', updated_at: new Date().toISOString() })
                .eq('id', existingScore.id);
            scoreId = existingScore.id;
        } else {
            // Insert new score
            const { data: newScore } = await supabase
                .from('scores')
                .insert({
                    judge_id: judgeId,
                    contestant_id: contestantId,
                    category_id: categoryId,
                    total_score: totalScore,
                    status: 'submitted',
                })
                .select('id')
                .single();
            scoreId = newScore?.id || 0;
        }

        // Delete existing details and insert new ones
        await supabase.from('score_details').delete().eq('score_id', scoreId);

        const details = criteria.map((c) => ({
            score_id: scoreId,
            category_criteria_id: c.id,
            raw_score: scores[contestantId][c.id] || 0,
            weighted_score: scores[contestantId][c.id] || 0, // For now, raw = weighted
        }));

        await supabase.from('score_details').insert(details);

        setScores((prev) => ({
            ...prev,
            [contestantId]: {
                ...prev[contestantId],
                locked: true,
            },
        }));

        setSaving(false);
    };

    const handleUnlockContestant = async (contestantId: number) => {
        await supabase
            .from('scores')
            .update({ status: 'draft' })
            .eq('category_id', categoryId)
            .eq('judge_id', judgeId)
            .eq('contestant_id', contestantId);

        setScores((prev) => ({
            ...prev,
            [contestantId]: {
                ...prev[contestantId],
                locked: false,
            },
        }));
    };

    const allContestantsLocked = contestants.every((c) => scores[c.id]?.locked);

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className={`w-8 h-8 border-4 rounded-full animate-spin ${isDarkMode ? 'border-white/20 border-t-white' : 'border-white/20 border-t-white'}`} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Scoring Table */}
            <div className={`rounded-2xl overflow-hidden shadow-lg ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/10' : 'bg-white border border-gray-200'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className={isDarkMode ? 'border-b border-white/10' : 'bg-gray-50 border-b border-gray-200'}>
                                <th className={`px-4 py-4 text-left text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    Contestant
                                </th>
                                {criteria.map((c) => (
                                    <th key={c.id} className={`px-4 py-4 text-center text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        <div>{c.name}</div>
                                        <div className={`text-xs font-normal ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Max: {c.percentage}%</div>
                                    </th>
                                ))}
                                <th className={`px-4 py-4 text-center text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    Total
                                </th>
                                <th className={`px-4 py-4 text-center text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className={isDarkMode ? 'divide-y divide-white/5' : 'divide-y divide-gray-100'}>
                            {contestants.map((contestant, index) => (
                                <motion.tr
                                    key={contestant.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`${scores[contestant.id]?.locked ? (isDarkMode ? 'bg-green-500/10' : 'bg-green-50') : (isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50')}`}
                                >
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-sm ${isDarkMode ? 'bg-gradient-to-br from-primary-500 to-accent-500' : 'bg-gradient-to-br from-maroon to-maroon-dark'}`}>
                                                {contestant.contestant_number || contestant.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{contestant.name}</p>
                                                <p className={`text-sm ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>{contestant.department}</p>
                                            </div>
                                        </div>
                                    </td>
                                    {criteria.map((c) => (
                                        <td key={c.id} className="px-4 py-4">
                                            <input
                                                type="number"
                                                min={0}
                                                max={c.percentage}
                                                step={0.5}
                                                value={scores[contestant.id]?.[c.id] || 0}
                                                onChange={(e) =>
                                                    handleScoreChange(contestant.id, c.id, parseFloat(e.target.value) || 0)
                                                }
                                                disabled={scores[contestant.id]?.locked}
                                                className={`w-20 px-3 py-2 rounded-lg text-center focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:ring-primary-500' : 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:ring-maroon focus:border-maroon disabled:bg-gray-100'}`}
                                            />
                                        </td>
                                    ))}
                                    <td className="px-4 py-4 text-center">
                                        <span className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-maroon'}`}>
                                            {calculateTotal(contestant.id).toFixed(1)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        {scores[contestant.id]?.locked ? (
                                            <button
                                                onClick={() => handleUnlockContestant(contestant.id)}
                                                className={`p-2 rounded-lg transition-colors shadow-sm ${isDarkMode ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                                                title="Unlock to edit"
                                            >
                                                <FaLock className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleLockContestant(contestant.id)}
                                                disabled={saving}
                                                className={`p-2 rounded-lg transition-colors disabled:opacity-50 shadow-sm ${isDarkMode ? 'bg-primary-500/20 text-primary-300 hover:bg-primary-500/30' : 'bg-maroon/10 text-maroon hover:bg-maroon/20'}`}
                                                title="Lock and save"
                                            >
                                                <FaUnlock className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Submit All Button */}
            {allContestantsLocked && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center"
                >
                    <button
                        onClick={onFinish}
                        className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg shadow-green-500/25"
                    >
                        <FaCheck className="w-5 h-5" />
                        Complete Scoring
                    </button>
                </motion.div>
            )}
        </div>
    );
};

export default ScoringTabular;
