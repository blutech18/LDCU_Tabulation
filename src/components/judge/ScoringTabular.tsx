import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaLock, FaUnlock, FaCheck, FaMars, FaVenus } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import type { Participant, Criteria } from '../../types';

interface ScoringTabularProps {
    categoryId: number;
    judgeId: number;
    onFinish: () => void;
    isDarkMode: boolean;
    eventParticipantType?: 'individual' | 'group';
}

interface ScoreState {
    [participantId: number]: {
        [criteriaId: number]: number;
        locked: boolean;
    };
}

const ScoringTabular = ({ categoryId, judgeId, onFinish, isDarkMode, eventParticipantType }: ScoringTabularProps) => {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [criteria, setCriteria] = useState<Criteria[]>([]);
    const [scores, setScores] = useState<ScoreState>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');

    const isIndividual = eventParticipantType === 'individual';

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

        // Try to fetch participants for this event
        // Fallback to all participants if event_id column doesn't exist
        let participantsList: Participant[] = [];

        if (categoryData?.event_id) {
            const { data: participantData, error } = await supabase
                .from('participants')
                .select('*')
                .eq('event_id', categoryData.event_id)
                .eq('is_active', true)
                .order('display_order', { ascending: true, nullsFirst: false })
                .order('number', { ascending: true });

            if (!error && participantData) {
                participantsList = participantData as Participant[];
            }
        }

        // Fallback: if no participants found or event_id query failed, try without event_id filter
        if (participantsList.length === 0) {
            const { data: allParticipants } = await supabase
                .from('participants')
                .select('*')
                .eq('is_active', true)
                .order('number');
            participantsList = (allParticipants || []) as Participant[];
        }

        setParticipants(participantsList);

        // Fetch criteria for this category
        const { data: criteriaData } = await supabase
            .from('criteria') // Updated table name
            .select('*')
            .eq('category_id', categoryId)
            // .eq('is_active', true) // Removed is_active if it's not in schema
            .order('display_order');

        setCriteria((criteriaData as Criteria[]) || []);

        // Fetch existing scores for this judge and criteria
        const criteriaIds = (criteriaData || []).map((c: any) => c.id);
        let scoreData: any[] = [];

        if (criteriaIds.length > 0) {
            const { data } = await supabase
                .from('scores')
                .select('*')
                .eq('judge_id', judgeId)
                .in('criteria_id', criteriaIds);
            scoreData = data || [];
        }

        // Initialize scores state
        const initialScores: ScoreState = {};
        participantsList?.forEach((participant) => {
            initialScores[participant.id] = { locked: false };
            criteriaData?.forEach((c: any) => {
                initialScores[participant.id][c.id] = 0;
            });
        });

        // Apply existing scores
        // Minimal schema storage strategy: one row per criteria score?
        // Or one row per participant with details?
        // Let's assume one row per criteria per participant per judge.
        /*
         scoreData is array of { participant_id, criteria_id, score, ... }
        */

        scoreData?.forEach((score: any) => {
            if (!initialScores[score.participant_id]) {
                initialScores[score.participant_id] = { locked: false }; // Init if missing
            }

            // Assuming simplified schema where we just have rows
            if (score.criteria_id) {
                initialScores[score.participant_id][score.criteria_id] = score.score;
            }

            // status logic?
            // schema says 'status' is in `events`? 
            // `scores` table has `rank` but not explicitly `status` column in minimal schema sql provided?
            // Wait, looking at scoreStore logic I wrote earlier: 
            // "lockedParticipants.add(score.participant_id)" just by existence.
            // We can infer locked if scores exist? Or we need that status column back?
            // The previous file used `status` in scores.
            // The minimal schema `scores` table definition:
            // id, judge_id, participant_id, criteria_id, score, rank, submitted_at, created_at
            // No 'status' column.
            // Use `submitted_at` as locked indicator?
            if (score.submitted_at) {
                initialScores[score.participant_id].locked = true;
            }
        });

        setScores(initialScores);
        setLoading(false);
    };

    const handleScoreChange = (participantId: number, criteriaId: number, value: number) => {
        if (scores[participantId]?.locked) return;

        const max = criteria.find((c) => c.id === criteriaId)?.percentage || 100;
        const clampedValue = Math.min(Math.max(0, value), max);

        setScores((prev) => ({
            ...prev,
            [participantId]: {
                ...prev[participantId],
                [criteriaId]: clampedValue,
            },
        }));
    };

    const calculateTotal = (participantId: number) => {
        if (!scores[participantId]) return 0;
        return criteria.reduce((sum, c) => sum + (scores[participantId][c.id] || 0), 0);
    };

    const handleLockParticipant = async (participantId: number) => {
        setSaving(true);

        // Save scores to database
        const participantScores = scores[participantId];

        // Prepare inserts
        const inserts = criteria.map(c => ({
            judge_id: judgeId,
            participant_id: participantId,
            criteria_id: c.id,
            score: participantScores[c.id] || 0,
            // category_id? Not in scores table.
            submitted_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('scores')
            .upsert(inserts, { onConflict: 'judge_id,participant_id,criteria_id' });

        if (!error) {
            setScores((prev) => ({
                ...prev,
                [participantId]: {
                    ...prev[participantId],
                    locked: true,
                },
            }));
        }

        setSaving(false);
    };

    const handleUnlockParticipant = async (participantId: number) => {
        // To unlock, we clear submitted_at?
        // Or delete rows?
        // Let's update submitted_at to null

        /* 
           Wait, `submitted_at` might not be nullable? 
           Schema: "submitted_at TIMESTAMPTZ DEFAULT NOW()" 
           Usually nullable if not specified NOT NULL.
           Let's try to update it to null.
        */

        await supabase
            .from('scores')
            .update({ submitted_at: null })
            .eq('judge_id', judgeId)
            // .eq('category_id', categoryId) // Not in table
            .eq('participant_id', participantId);

        setScores((prev) => ({
            ...prev,
            [participantId]: {
                ...prev[participantId],
                locked: false,
            },
        }));
    };

    // Filter participants by gender for individual events
    const filteredParticipants = isIndividual
        ? participants.filter(p => p.gender === selectedGender)
        : participants;

    const allParticipantsLocked = filteredParticipants.length > 0 && filteredParticipants.every((c) => scores[c.id]?.locked);

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className={`w-8 h-8 border-4 rounded-full animate-spin ${isDarkMode ? 'border-white/20 border-t-white' : 'border-white/20 border-t-white'}`} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Gender Toggle for Individual Events */}
            {isIndividual && (
                <div className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-white/5 backdrop-blur-lg border border-white/10' : 'bg-white border border-gray-200 shadow-sm'}`}>
                    <div className="grid grid-cols-2">
                        <button
                            onClick={() => setSelectedGender('male')}
                            className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all ${selectedGender === 'male'
                                ? isDarkMode
                                    ? 'bg-white/10 text-white border-b-2 border-blue-400'
                                    : 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                                : isDarkMode
                                    ? 'text-white/50 hover:text-white/70 hover:bg-white/5'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <FaMars className={`w-4 h-4 ${selectedGender === 'male' ? (isDarkMode ? 'text-blue-400' : 'text-blue-500') : ''}`} />
                            Male
                        </button>
                        <button
                            onClick={() => setSelectedGender('female')}
                            className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all ${selectedGender === 'female'
                                ? isDarkMode
                                    ? 'bg-white/10 text-white border-b-2 border-pink-400'
                                    : 'bg-pink-50 text-pink-700 border-b-2 border-pink-500'
                                : isDarkMode
                                    ? 'text-white/50 hover:text-white/70 hover:bg-white/5'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <FaVenus className={`w-4 h-4 ${selectedGender === 'female' ? (isDarkMode ? 'text-pink-400' : 'text-pink-500') : ''}`} />
                            Female
                        </button>
                    </div>
                </div>
            )}

            {/* Scoring Table */}
            <div className={`rounded-2xl overflow-hidden shadow-lg ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/10' : 'bg-white border border-gray-200'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className={isDarkMode ? 'border-b border-white/10' : 'bg-gray-50 border-b border-gray-200'}>
                                <th className={`px-4 py-4 text-left text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    Participant
                                </th>
                                {criteria.map((c) => (
                                    <th key={c.id} className={`px-4 py-4 text-center text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        <div>{c.name}</div>
                                        <div className={`text-xs font-normal ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                                            {c.percentage > 0 ? `${c.percentage}%` : ''} 
                                            {(c.min_score !== undefined || c.max_score !== undefined) && (
                                                <span className="ml-1">({c.min_score ?? 0}-{c.max_score ?? 100})</span>
                                            )}
                                        </div>
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
                            {filteredParticipants.map((participant, index) => (
                                <motion.tr
                                    key={participant.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`${scores[participant.id]?.locked ? (isDarkMode ? 'bg-green-500/10' : 'bg-green-50') : (isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50')}`}
                                >
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-sm ${isDarkMode ? 'bg-gradient-to-br from-primary-500 to-accent-500' : 'bg-gradient-to-br from-maroon to-maroon-dark'}`}>
                                                {participant.number || participant.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{participant.name}</p>
                                                <p className={`text-sm ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>{participant.department}</p>
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
                                                value={scores[participant.id]?.[c.id] || 0}
                                                onChange={(e) =>
                                                    handleScoreChange(participant.id, c.id, parseFloat(e.target.value) || 0)
                                                }
                                                disabled={scores[participant.id]?.locked}
                                                className={`w-20 px-3 py-2 rounded-lg text-center focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:ring-primary-500' : 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:ring-maroon focus:border-maroon disabled:bg-gray-100'}`}
                                            />
                                        </td>
                                    ))}
                                    <td className="px-4 py-4 text-center">
                                        <span className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-maroon'}`}>
                                            {calculateTotal(participant.id).toFixed(1)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        {scores[participant.id]?.locked ? (
                                            <button
                                                onClick={() => handleUnlockParticipant(participant.id)}
                                                className={`p-2 rounded-lg transition-colors shadow-sm ${isDarkMode ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                                                title="Unlock to edit"
                                            >
                                                <FaLock className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleLockParticipant(participant.id)}
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
            {allParticipantsLocked && (
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
