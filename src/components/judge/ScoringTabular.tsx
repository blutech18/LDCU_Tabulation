import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
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
    onSaveStateChange?: (isSaving: boolean) => void;
}

export interface ScoringTabularRef {
    refresh: () => Promise<void>;
}

interface ScoreState {
    [participantId: number]: {
        [criteriaId: number]: number | undefined;
        locked?: boolean;
    };
}

const ScoringTabular = forwardRef<ScoringTabularRef, ScoringTabularProps>(({ categoryId, judgeId, onFinish, isDarkMode, eventParticipantType, onSaveStateChange }, ref) => {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [criteria, setCriteria] = useState<Criteria[]>([]);
    const [scores, setScores] = useState<ScoreState>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');
    const saveTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

    const isIndividual = eventParticipantType === 'individual';

    const fetchData = useCallback(async () => {
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

        // Initialize scores state - default to 0 but can be cleared
        const initialScores: ScoreState = {};
        participantsList?.forEach((participant) => {
            initialScores[participant.id] = {};
            criteriaData?.forEach((c: any) => {
                // Initialize with 0 as default
                initialScores[participant.id][c.id] = 0;
            });
        });

        // Apply existing scores (overwrite defaults if they exist)
        scoreData?.forEach((score: any) => {
            if (!initialScores[score.participant_id]) {
                initialScores[score.participant_id] = {};
            }

            if (score.criteria_id) {
                // Set the score from database (including 0)
                initialScores[score.participant_id][score.criteria_id] = score.score ?? 0;
            }
            
            // Use submitted_at as locked indicator
            if (score.submitted_at) {
                initialScores[score.participant_id].locked = true;
            }
        });

        setScores(initialScores);
        setLoading(false);
    }, [categoryId, judgeId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Expose refresh function via ref
    useImperativeHandle(ref, () => ({
        refresh: fetchData
    }), [fetchData]);

    // Notify parent of save state changes
    useEffect(() => {
        if (onSaveStateChange) {
            onSaveStateChange(saving);
        }
    }, [saving, onSaveStateChange]);

    // Auto-save score to database with debouncing (without locking)
    const saveScoreToDb = useCallback(async (participantId: number, criteriaId: number, score: number) => {
        setSaving(true);
        try {
            // Check if participant is already locked
            const isLocked = scores[participantId]?.locked;
            
            await supabase
                .from('scores')
                .upsert({
                    judge_id: judgeId,
                    participant_id: participantId,
                    criteria_id: criteriaId,
                    score: score,
                    // Only set submitted_at if already locked, otherwise leave it null
                    submitted_at: isLocked ? new Date().toISOString() : null
                }, { onConflict: 'judge_id,participant_id,criteria_id' });
        } catch (error) {
            console.error('Error saving score:', error);
        } finally {
            setSaving(false);
        }
    }, [judgeId, scores]);

    const handleScoreChange = (participantId: number, criteriaId: number, value: string) => {
        if (scores[participantId]?.locked) return;
        
        // Allow empty string
        if (value === '') {
            setScores((prev) => ({
                ...prev,
                [participantId]: {
                    ...prev[participantId],
                    [criteriaId]: undefined,
                },
            }));

            // Debounced auto-save with 0 for empty values
            const key = `${participantId}-${criteriaId}`;
            if (saveTimeoutRef.current[key]) {
                clearTimeout(saveTimeoutRef.current[key]);
            }
            saveTimeoutRef.current[key] = setTimeout(() => {
                saveScoreToDb(participantId, criteriaId, 0);
            }, 500);
            return;
        }

        const numValue = Number.parseFloat(value);
        if (isNaN(numValue)) return;

        const max = criteria.find((c) => c.id === criteriaId)?.percentage || 100;
        const clampedValue = Math.min(Math.max(0, numValue), max);

        setScores((prev) => ({
            ...prev,
            [participantId]: {
                ...prev[participantId],
                [criteriaId]: clampedValue,
            },
        }));

        // Debounced auto-save
        const key = `${participantId}-${criteriaId}`;
        if (saveTimeoutRef.current[key]) {
            clearTimeout(saveTimeoutRef.current[key]);
        }
        saveTimeoutRef.current[key] = setTimeout(() => {
            saveScoreToDb(participantId, criteriaId, clampedValue);
        }, 500);
    };

    const handleLockParticipant = async (participantId: number) => {
        setSaving(true);

        // Save all scores for this participant
        const participantScores = scores[participantId];
        const inserts = criteria.map(c => ({
            judge_id: judgeId,
            participant_id: participantId,
            criteria_id: c.id,
            score: participantScores[c.id] || 0,
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
        const criteriaIds = criteria.map(c => c.id);
        
        await supabase
            .from('scores')
            .update({ submitted_at: null })
            .eq('judge_id', judgeId)
            .eq('participant_id', participantId)
            .in('criteria_id', criteriaIds);

        setScores((prev) => ({
            ...prev,
            [participantId]: {
                ...prev[participantId],
                locked: false,
            },
        }));
    };

    const calculateTotal = (participantId: number) => {
        if (!scores[participantId]) return 0;
        return criteria.reduce((sum, c) => sum + (scores[participantId][c.id] ?? 0), 0);
    };

    // Convert rank to ordinal format (1st, 2nd, 3rd, etc.)
    const getOrdinal = (rank: number) => {
        const suffixes = ['th', 'st', 'nd', 'rd'];
        const v = rank % 100;
        return rank + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
    };

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            Object.values(saveTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
        };
    }, []);

    // Filter participants by gender for individual events
    const filteredParticipants = isIndividual
        ? participants.filter(p => p.gender === selectedGender)
        : participants;

    // Calculate rankings based on total scores
    const getRankings = () => {
        const participantsWithScores = filteredParticipants.map(p => ({
            id: p.id,
            total: calculateTotal(p.id)
        }));

        // Check if all scores are 0
        const hasAnyScores = participantsWithScores.some(p => p.total > 0);
        
        // Sort by total score (descending)
        participantsWithScores.sort((a, b) => b.total - a.total);

        // Assign ranks (handle ties)
        const rankings: { [key: number]: number | null } = {};
        let currentRank = 1;
        for (let i = 0; i < participantsWithScores.length; i++) {
            // Don't assign rank if no scores have been entered yet
            if (!hasAnyScores || participantsWithScores[i].total === 0) {
                rankings[participantsWithScores[i].id] = null;
            } else {
                if (i > 0 && participantsWithScores[i].total < participantsWithScores[i - 1].total) {
                    currentRank = i + 1;
                }
                rankings[participantsWithScores[i].id] = currentRank;
            }
        }

        return rankings;
    };

    const rankings = getRankings();

    // Check if any scores have been entered
    const hasAnyScoresEntered = filteredParticipants.some(p => {
        if (!scores[p.id]) return false;
        return criteria.some(c => scores[p.id][c.id] !== undefined && scores[p.id][c.id] !== 0);
    });

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
                                <th className={`px-4 py-4 text-left text-sm font-semibold w-64 min-w-64 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    Participant
                                </th>
                                {criteria.map((c) => (
                                    <th key={c.id} className={`px-4 py-4 text-center text-sm font-semibold align-middle ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        <div className="flex flex-col items-center justify-center">
                                            <div>{c.name}</div>
                                            <div className={`text-xs font-normal ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                                                {c.percentage > 0 ? `${c.percentage}%` : ''}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                                <th className={`px-4 py-4 text-center text-sm font-semibold align-middle ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    Rank
                                </th>
                                <th className={`px-4 py-4 text-center text-sm font-semibold align-middle ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
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
                                    <td className="px-4 py-4 w-64 min-w-64">
                                        <div className="flex items-center gap-3">
                                            {participant.photo_url ? (
                                                <img
                                                    src={participant.photo_url}
                                                    alt={participant.name}
                                                    className="w-10 h-10 rounded-full object-cover border-2 shadow-sm flex-shrink-0"
                                                    style={{ borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(128, 0, 0, 0.2)' }}
                                                    onError={(e) => {
                                                        // Hide image and show fallback
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                        const parent = target.parentElement;
                                                        if (parent) {
                                                            const fallback = parent.querySelector('.avatar-fallback') as HTMLElement;
                                                            if (fallback) fallback.style.display = 'flex';
                                                        }
                                                    }}
                                                />
                                            ) : null}
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-sm flex-shrink-0 avatar-fallback ${participant.photo_url ? 'hidden' : ''} ${isDarkMode ? 'bg-gradient-to-br from-primary-500 to-accent-500' : 'bg-gradient-to-br from-maroon to-maroon-dark'}`}>
                                                {participant.number || participant.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{participant.name}</p>
                                                <p className={`text-sm truncate ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>{participant.department}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td colSpan={criteria.length} className="px-4 py-4 align-middle">
                                        <div className="flex flex-col items-center gap-3 w-full">
                                            {/* Editable Total Score Input */}
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={0.5}
                                                value={calculateTotal(participant.id) || ''}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    
                                                    if (scores[participant.id]?.locked) return;
                                                    
                                                    // Allow empty string
                                                    if (value === '') {
                                                        const newScores = { ...scores };
                                                        if (!newScores[participant.id]) {
                                                            newScores[participant.id] = {};
                                                        }
                                                        criteria.forEach((c) => {
                                                            newScores[participant.id][c.id] = 0;
                                                        });
                                                        setScores(newScores);
                                                        return;
                                                    }
                                                    
                                                    const newTotal = parseFloat(value);
                                                    if (isNaN(newTotal)) return;
                                                    
                                                    const clampedTotal = Math.min(Math.max(0, newTotal), 100);
                                                    
                                                    // Distribute the new total proportionally across criteria
                                                    const newScores = { ...scores };
                                                    if (!newScores[participant.id]) {
                                                        newScores[participant.id] = {};
                                                    }
                                                    
                                                    criteria.forEach((c) => {
                                                        const proportion = c.percentage / 100;
                                                        const newScore = clampedTotal * proportion;
                                                        newScores[participant.id][c.id] = newScore;
                                                    });
                                                    
                                                    setScores(newScores);
                                                    
                                                    // Save all criteria scores with debounce
                                                    criteria.forEach((c) => {
                                                        const key = `${participant.id}-${c.id}`;
                                                        if (saveTimeoutRef.current[key]) {
                                                            clearTimeout(saveTimeoutRef.current[key]);
                                                        }
                                                        saveTimeoutRef.current[key] = setTimeout(() => {
                                                            const proportion = c.percentage / 100;
                                                            const newScore = clampedTotal * proportion;
                                                            saveScoreToDb(participant.id, c.id, newScore);
                                                        }, 500);
                                                    });
                                                }}
                                                onFocus={(e) => e.target.select()}
                                                disabled={scores[participant.id]?.locked}
                                                className={`w-32 px-4 py-2 text-3xl font-bold text-center rounded-lg border-2 transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:ring-primary-500 focus:border-primary-500' : 'bg-white border-gray-300 text-maroon placeholder:text-gray-400 focus:ring-maroon focus:border-maroon disabled:bg-gray-100'}`}
                                                placeholder="0.0"
                                            />
                                            {/* Single Slider for Total Score - Spans across all criteria */}
                                            <div className="w-full px-8">
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={100}
                                                    step={0.5}
                                                    value={calculateTotal(participant.id)}
                                                    onChange={(e) => {
                                                        const newTotal = parseFloat(e.target.value);
                                                        
                                                        if (scores[participant.id]?.locked) return;
                                                        
                                                        // Distribute the new total proportionally across criteria
                                                        const newScores = { ...scores };
                                                        if (!newScores[participant.id]) {
                                                            newScores[participant.id] = {};
                                                        }
                                                        
                                                        // Calculate proportional distribution
                                                        criteria.forEach((c) => {
                                                            const proportion = c.percentage / 100;
                                                            const newScore = newTotal * proportion;
                                                            newScores[participant.id][c.id] = newScore;
                                                        });
                                                        
                                                        setScores(newScores);
                                                        
                                                        // Save all criteria scores
                                                        criteria.forEach((c) => {
                                                            const key = `${participant.id}-${c.id}`;
                                                            if (saveTimeoutRef.current[key]) {
                                                                clearTimeout(saveTimeoutRef.current[key]);
                                                            }
                                                            saveTimeoutRef.current[key] = setTimeout(() => {
                                                                const proportion = c.percentage / 100;
                                                                const newScore = newTotal * proportion;
                                                                saveScoreToDb(participant.id, c.id, newScore);
                                                            }, 500);
                                                        });
                                                    }}
                                                    disabled={scores[participant.id]?.locked}
                                                    className={`w-full h-3 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed slider ${isDarkMode ? 'slider-dark' : 'slider-light'}`}
                                                    style={{
                                                        background: scores[participant.id]?.locked 
                                                            ? isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                                            : `linear-gradient(to right, ${isDarkMode ? '#fbbf24' : '#800000'} 0%, ${isDarkMode ? '#fbbf24' : '#800000'} ${calculateTotal(participant.id)}%, ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} ${calculateTotal(participant.id)}%, ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} 100%)`
                                                    }}
                                                />
                                                {/* Min/Max Labels */}
                                                <div className={`flex justify-between w-full text-xs mt-1 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                                                    <span>0</span>
                                                    <span>100</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center align-middle">
                                        {rankings[participant.id] === null ? (
                                            <span className={`text-lg ${isDarkMode ? 'text-white/30' : 'text-gray-400'}`}>
                                                —
                                            </span>
                                        ) : (
                                            <span className={`text-lg font-bold ${
                                                rankings[participant.id] === 1
                                                    ? isDarkMode ? 'text-yellow-300' : 'text-yellow-600'
                                                    : rankings[participant.id] === 2
                                                        ? isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                                        : rankings[participant.id] === 3
                                                            ? isDarkMode ? 'text-amber-300' : 'text-amber-600'
                                                            : isDarkMode ? 'text-white/70' : 'text-gray-500'
                                            }`}>
                                                {getOrdinal(rankings[participant.id]!)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-center align-middle">
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

            {/* Auto-save indicator and Complete button */}
            <div className="flex items-center justify-between pb-4 sm:pb-6 md:pb-8 lg:pb-10">
                <div className={`text-sm ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                    {saving ? (
                        <span className="flex items-center gap-2">
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Saving...
                        </span>
                    ) : (
                        <span>✓ All changes saved automatically</span>
                    )}
                </div>
                {hasAnyScoresEntered && (
                    <button
                        onClick={async () => {
                            // Lock all participants before finishing
                            setSaving(true);
                            const lockPromises = filteredParticipants.map(async (participant) => {
                                if (!scores[participant.id]?.locked) {
                                    const participantScores = scores[participant.id];
                                    const inserts = criteria.map(c => ({
                                        judge_id: judgeId,
                                        participant_id: participant.id,
                                        criteria_id: c.id,
                                        score: participantScores[c.id] ?? 0,
                                        submitted_at: new Date().toISOString()
                                    }));
                                    await supabase
                                        .from('scores')
                                        .upsert(inserts, { onConflict: 'judge_id,participant_id,criteria_id' });
                                }
                            });
                            await Promise.all(lockPromises);
                            setSaving(false);
                            onFinish();
                        }}
                        disabled={saving}
                        className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 text-white ${isDarkMode ? 'bg-maroon hover:bg-maroon-dark shadow-maroon/50' : 'bg-maroon hover:bg-maroon-dark shadow-maroon/25'}`}
                    >
                        <FaCheck className="w-5 h-5" />
                        Complete Scoring
                    </button>
                )}
            </div>
        </div>
    );
});

ScoringTabular.displayName = 'ScoringTabular';

export default ScoringTabular;
