import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { motion, Reorder } from 'framer-motion';
import { FaGripVertical, FaCheck, FaMars, FaVenus } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import type { Participant, Criteria } from '../../types';

interface RankingTabularProps {
    categoryId: number;
    judgeId: number;
    onFinish: () => void;
    isDarkMode: boolean;
    eventParticipantType?: 'individual' | 'group';
    onSaveStateChange?: (isSaving: boolean) => void;
}

export interface RankingTabularRef {
    refresh: () => Promise<void>;
}

interface RankedParticipant extends Participant {
    rank: number;
}

const RankingTabular = forwardRef<RankingTabularRef, RankingTabularProps>(({ categoryId, judgeId, onFinish, isDarkMode, eventParticipantType, onSaveStateChange }, ref) => {
    const [contestants, setContestants] = useState<RankedParticipant[]>([]);
    const [criteria, setCriteria] = useState<Criteria[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');
    const [firstCriteriaId, setFirstCriteriaId] = useState<number | null>(null);
    const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

    const isIndividual = eventParticipantType === 'individual';

    const fetchData = useCallback(async () => {
        setLoading(true);
        
        // First, get the category to find its event_id
        const { data: categoryData } = await supabase
            .from('categories')
            .select('event_id')
            .eq('id', categoryId)
            .single();

        // Fetch criteria for this category
        const { data: criteriaData } = await supabase
            .from('criteria')
            .select('*')
            .eq('category_id', categoryId)
            .order('display_order');
        setCriteria((criteriaData as Criteria[]) || []);

        // Fetch participants for this event
        let contestantsList: Participant[] = [];

        if (categoryData?.event_id) {
            const { data: contestantData, error } = await supabase
                .from('participants')
                .select('*')
                .eq('event_id', categoryData.event_id)
                .eq('is_active', true)
                .order('display_order', { ascending: true, nullsFirst: false })
                .order('number', { ascending: true });

            if (!error && contestantData) {
                contestantsList = contestantData as Participant[];
            }
        }

        // Fallback: if no participants found, try without event_id filter
        if (contestantsList.length === 0) {
            const { data: allContestants } = await supabase
                .from('participants')
                .select('*')
                .eq('is_active', true)
                .order('number');
            contestantsList = (allContestants || []) as Participant[];
        }

        // Fetch existing rankings from scores table
        const { data: criteriaList } = await supabase
            .from('criteria')
            .select('id')
            .eq('category_id', categoryId)
            .order('display_order')
            .limit(1);

        const firstCriteria = criteriaList?.[0];
        if (firstCriteria) {
            setFirstCriteriaId(firstCriteria.id);
        }

        let rankingData: any[] = [];
        if (firstCriteria) {
            const { data } = await supabase
                .from('scores')
                .select('participant_id, rank')
                .eq('criteria_id', firstCriteria.id)
                .eq('judge_id', judgeId)
                .not('rank', 'is', null);
            rankingData = data || [];
        }

        // Apply existing rankings or assign default order
        const rankedContestants: RankedParticipant[] = contestantsList.map((contestant, index) => {
            const existingRank = rankingData.find((r) => r.participant_id === contestant.id);
            return {
                ...contestant,
                rank: existingRank?.rank || index + 1,
            };
        });

        // Sort by rank
        rankedContestants.sort((a, b) => a.rank - b.rank);

        setContestants(rankedContestants);
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

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
        };
    }, [saveTimeout]);

    // Auto-save rankings to database
    const saveRankingsToDb = useCallback(async (contestantsToSave: RankedParticipant[]) => {
        if (!firstCriteriaId) return;
        
        setSaving(true);
        try {
            // Upsert all rankings
            const rankings = contestantsToSave.map((contestant) => ({
                judge_id: judgeId,
                participant_id: contestant.id,
                criteria_id: firstCriteriaId,
                score: 0,
                rank: contestant.rank,
                submitted_at: new Date().toISOString(),
            }));

            await supabase
                .from('scores')
                .upsert(rankings, { onConflict: 'judge_id,participant_id,criteria_id' });
        } catch (error) {
            console.error('Error saving rankings:', error);
        } finally {
            setSaving(false);
        }
    }, [judgeId, firstCriteriaId]);

    // Filter contestants by gender for individual events
    const filteredContestants = isIndividual
        ? contestants.filter(c => c.gender === selectedGender)
        : contestants;

    // Handle drag-and-drop reorder with debounced save
    const handleReorder = (newOrder: RankedParticipant[]) => {
        // Update ranks based on new order
        const updatedContestants = newOrder.map((contestant, index) => ({
            ...contestant,
            rank: index + 1,
        }));

        let allContestants: RankedParticipant[];
        
        // If individual event, merge with other gender contestants
        if (isIndividual) {
            const otherGender = contestants.filter(c => c.gender !== selectedGender);
            allContestants = [...updatedContestants, ...otherGender];
        } else {
            allContestants = updatedContestants;
        }
        
        setContestants(allContestants);
        
        // Clear existing timeout
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        
        // Debounce save - only save after 0.5 seconds of inactivity
        const newTimeout = setTimeout(() => {
            saveRankingsToDb(allContestants);
        }, 500);
        
        setSaveTimeout(newTimeout);
    };

    // Handle rank input change - moves contestant to new position
    const handleRankChange = (contestantId: number, newRank: number) => {
        if (newRank < 1 || newRank > filteredContestants.length) return;

        // Find current index of the contestant
        const currentIndex = filteredContestants.findIndex(c => c.id === contestantId);
        if (currentIndex === -1 || currentIndex + 1 === newRank) return;

        // Create new order by moving the contestant to the new position
        const newOrder = [...filteredContestants];
        const [movedContestant] = newOrder.splice(currentIndex, 1);
        newOrder.splice(newRank - 1, 0, movedContestant);

        // Update ranks based on new order
        const updatedContestants = newOrder.map((contestant, index) => ({
            ...contestant,
            rank: index + 1,
        }));

        let allContestants: RankedParticipant[];
        
        // If individual event, merge with other gender contestants
        if (isIndividual) {
            const otherGender = contestants.filter(c => c.gender !== selectedGender);
            allContestants = [...updatedContestants, ...otherGender];
        } else {
            allContestants = updatedContestants;
        }
        
        setContestants(allContestants);
        
        // Auto-save immediately after rank change
        saveRankingsToDb(allContestants);
    };


    // Convert rank to ordinal format (1st, 2nd, 3rd, etc.)
    const getOrdinal = (rank: number) => {
        const suffixes = ['th', 'st', 'nd', 'rd'];
        const v = rank % 100;
        return rank + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
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

            {/* Sub-Criteria Display */}
            {criteria.length > 0 && (
                <div className="w-full flex flex-wrap gap-3">
                    {criteria.map((criterion) => (
                        <div
                            key={criterion.id}
                            className={`flex-1 min-w-[200px] px-4 py-3 rounded-xl text-center ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/20' : 'bg-white border border-gray-300 shadow-sm'}`}
                        >
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {criterion.name} ({criterion.min_score ?? 0} - {criterion.max_score ?? 100})
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Ranking List */}
            <div className={`rounded-2xl overflow-hidden shadow-lg ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/10' : 'bg-white border border-gray-200'}`}>
                {/* Header Row */}
                <div className={`flex items-center gap-8 p-4 font-semibold text-sm ${isDarkMode ? 'bg-white/5 text-white/70 border-b border-white/10' : 'bg-gray-50 text-gray-600 border-b border-gray-200'}`}>
                    <div className="w-4"></div> {/* Drag handle space */}
                    <div className="w-14 text-center mr-8">Rank</div>
                    <div className="flex-1">Contestant</div>
                    <div className="w-16 text-center">Position</div>
                </div>

                {/* Scrollable Container with Custom Scrollbar */}
                <div className={`overflow-y-auto max-h-[60vh] custom-scrollbar ${isDarkMode ? 'custom-scrollbar-dark' : 'custom-scrollbar-light'}`}>
                    <Reorder.Group
                        axis="y"
                        values={filteredContestants}
                        onReorder={handleReorder}
                        className={isDarkMode ? 'divide-y divide-white/5' : 'divide-y divide-gray-100'}
                    >
                        {filteredContestants.map((contestant, index) => (
                            <Reorder.Item
                                key={contestant.id}
                                value={contestant}
                                className="cursor-grab active:cursor-grabbing"
                            >
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`flex items-center gap-8 p-4 ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                                >
                                    {/* Drag Handle */}
                                    <div className={isDarkMode ? 'text-white/30 hover:text-white/50' : 'text-gray-400 hover:text-gray-600'}>
                                        <FaGripVertical className="w-4 h-4" />
                                    </div>

                                    {/* Editable Rank Input */}
                                    <div className="flex-shrink-0 mr-8">
                                        <input
                                            type="number"
                                            min={1}
                                            max={filteredContestants.length}
                                            defaultValue={index + 1}
                                            key={`${contestant.id}-${index}`}
                                            onBlur={(e) => {
                                                const newRank = parseInt(e.target.value);
                                                if (newRank && newRank >= 1 && newRank <= filteredContestants.length && newRank !== index + 1) {
                                                    handleRankChange(contestant.id, newRank);
                                                } else {
                                                    e.target.value = String(index + 1);
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    (e.target as HTMLInputElement).blur();
                                                }
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            className={`w-14 h-10 text-center font-bold text-lg rounded-lg border-2 transition-all focus:outline-none focus:ring-2 ${
                                                index === 0
                                                    ? isDarkMode 
                                                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 focus:ring-yellow-500/50' 
                                                        : 'bg-yellow-50 border-yellow-300 text-yellow-700 focus:ring-yellow-400'
                                                    : index === 1
                                                        ? isDarkMode 
                                                            ? 'bg-gray-400/20 border-gray-400/50 text-gray-300 focus:ring-gray-400/50' 
                                                            : 'bg-gray-100 border-gray-300 text-gray-700 focus:ring-gray-400'
                                                        : index === 2
                                                            ? isDarkMode 
                                                                ? 'bg-amber-600/20 border-amber-500/50 text-amber-300 focus:ring-amber-500/50' 
                                                                : 'bg-amber-50 border-amber-300 text-amber-700 focus:ring-amber-400'
                                                            : isDarkMode 
                                                                ? 'bg-white/10 border-white/20 text-white focus:ring-white/30' 
                                                                : 'bg-gray-50 border-gray-200 text-gray-700 focus:ring-maroon/30'
                                            }`}
                                        />
                                    </div>

                                    {/* Contestant Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            {contestant.photo_url ? (
                                                <img 
                                                    src={contestant.photo_url} 
                                                    alt={contestant.name}
                                                    className="w-10 h-10 rounded-full object-cover shadow-sm"
                                                />
                                            ) : (
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-sm ${isDarkMode ? 'bg-gradient-to-br from-primary-500 to-accent-500' : 'bg-gradient-to-br from-maroon to-maroon-dark'}`}>
                                                    {contestant.name.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{contestant.name}</p>
                                                <p className={`text-sm ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>{contestant.department}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ordinal Rank Display */}
                                    <div className={`w-16 text-center font-semibold text-sm ${
                                        index === 0
                                            ? isDarkMode ? 'text-yellow-300' : 'text-yellow-600'
                                            : index === 1
                                                ? isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                                : index === 2
                                                    ? isDarkMode ? 'text-amber-300' : 'text-amber-600'
                                                    : isDarkMode ? 'text-white/50' : 'text-gray-500'
                                    }`}>
                                        {getOrdinal(index + 1)}
                                    </div>
                                </motion.div>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                </div>
            </div>

            {/* Auto-save indicator and Complete button */}
            <div className="flex items-center justify-between">
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
                <button
                    onClick={async () => {
                        // Save all rankings before finishing
                        if (firstCriteriaId) {
                            setSaving(true);
                            const rankings = contestants.map((contestant) => ({
                                judge_id: judgeId,
                                participant_id: contestant.id,
                                criteria_id: firstCriteriaId,
                                score: 0,
                                rank: contestant.rank,
                                submitted_at: new Date().toISOString(),
                            }));

                            await supabase
                                .from('scores')
                                .upsert(rankings, { onConflict: 'judge_id,participant_id,criteria_id' });
                            setSaving(false);
                        }
                        onFinish();
                    }}
                    disabled={saving}
                    className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 text-white ${isDarkMode ? 'bg-maroon hover:bg-maroon-dark shadow-maroon/50' : 'bg-maroon hover:bg-maroon-dark shadow-maroon/25'}`}
                >
                    <FaCheck className="w-5 h-5" />
                    Complete Ranking
                </button>
            </div>
        </div>
    );
});

RankingTabular.displayName = 'RankingTabular';

export default RankingTabular;
