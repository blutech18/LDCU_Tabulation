import { useState, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';
import { FaGripVertical, FaLock, FaCheck, FaMars, FaVenus } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import type { Contestant, Criteria } from '../../types';

interface RankingTabularProps {
    categoryId: number;
    judgeId: number;
    onFinish: () => void;
    isDarkMode: boolean;
    eventParticipantType?: 'individual' | 'group';
}

interface RankedContestant extends Contestant {
    rank: number;
    locked: boolean;
}

const RankingTabular = ({ categoryId, judgeId, onFinish, isDarkMode, eventParticipantType }: RankingTabularProps) => {
    const [contestants, setContestants] = useState<RankedContestant[]>([]);
    const [criteria, setCriteria] = useState<Criteria[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [locked, setLocked] = useState(false);
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

        // Fetch criteria for this category
        const { data: criteriaData } = await supabase
            .from('criteria')
            .select('*')
            .eq('category_id', categoryId)
            .order('display_order');
        setCriteria((criteriaData as Criteria[]) || []);

        // Try to fetch contestants for this event
        // Fallback to all contestants if event_id column doesn't exist
        let contestantsList: Contestant[] = [];

        if (categoryData?.event_id) {
            const { data: contestantData, error } = await supabase
                .from('participants')
                .select('*')
                .eq('event_id', categoryData.event_id)
                .eq('is_active', true)
                .order('display_order', { ascending: true, nullsFirst: false })
                .order('number', { ascending: true });

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
        const { data: criteriaList } = await supabase
            .from('criteria')
            .select('id')
            .eq('category_id', categoryId)
            .order('display_order')
            .limit(1);

        const firstCriteria = criteriaList?.[0];

        let rankingData: any[] = [];
        if (firstCriteria) {
            const { data } = await supabase
                .from('scores')
                .select('participant_id, rank, submitted_at')
                .eq('criteria_id', firstCriteria.id)
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

    // Handle drag-and-drop reorder
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
        const { data: criteriaList } = await supabase
            .from('criteria')
            .select('id')
            .eq('category_id', categoryId)
            .order('display_order')
            .limit(1);

        const criteriaData = criteriaList?.[0];

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
        const { data: criteriaList } = await supabase
            .from('criteria')
            .select('id')
            .eq('category_id', categoryId)
            .order('display_order')
            .limit(1);

        const criteriaData = criteriaList?.[0];

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

    // Convert rank to ordinal format (1st, 2nd, 3rd, etc.)
    const getOrdinal = (rank: number) => {
        const suffixes = ['th', 'st', 'nd', 'rd'];
        const v = rank % 100;
        return rank + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
    };

    // Handle rank input change - moves contestant to new position
    const handleRankChange = (contestantId: number, newRank: number) => {
        if (locked) return;
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

        // If individual event, merge with other gender contestants
        if (isIndividual) {
            const otherGender = contestants.filter(c => c.gender !== selectedGender);
            setContestants([...updatedContestants, ...otherGender]);
        } else {
            setContestants(updatedContestants);
        }
    };

    // Filter contestants by gender for individual events
    const filteredContestants = isIndividual
        ? contestants.filter(c => c.gender === selectedGender)
        : contestants;

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

            {/* Instructions */}
            <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/20' : 'bg-maroon/10 border border-maroon/30'}`}>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-maroon'}`}>
                    {locked
                        ? '✅ Rankings are locked. Click unlock to make changes.'
                        : '🎯 Drag to reorder or edit the rank number. Lower rank = higher placement.'}
                </p>
            </div>

            {/* Sub-Criteria Display */}
            {criteria.length > 0 && (
                <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-white/5 backdrop-blur-lg border border-white/10' : 'bg-white border border-gray-200 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Criteria</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {criteria.map((criterion) => (
                            <div
                                key={criterion.id}
                                className={`p-3 rounded-lg ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}
                            >
                                <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {criterion.name}
                                </p>
                                {criterion.description && (
                                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                                        {criterion.description}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                    {criterion.percentage > 0 && (
                                        <span className={`text-xs font-medium ${isDarkMode ? 'text-gold' : 'text-maroon'}`}>
                                            {criterion.percentage}%
                                        </span>
                                    )}
                                    {(criterion.min_score !== undefined || criterion.max_score !== undefined) && (
                                        <span className={`text-xs ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>
                                            (Score: {criterion.min_score ?? 0} - {criterion.max_score ?? 100})
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Ranking List */}
            <div className={`rounded-2xl overflow-hidden shadow-lg ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/10' : 'bg-white border border-gray-200'}`}>
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
                            className={`${locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
                            style={{ pointerEvents: locked ? 'none' : 'auto' } as any}
                        >
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={`flex items-center gap-4 p-4 ${locked ? (isDarkMode ? 'bg-green-500/5' : 'bg-green-50') : (isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50')}`}
                            >
                                {/* Drag Handle */}
                                {!locked && (
                                    <div className={isDarkMode ? 'text-white/30 hover:text-white/50' : 'text-gray-400 hover:text-gray-600'}>
                                        <FaGripVertical className="w-4 h-4" />
                                    </div>
                                )}

                                {/* Editable Rank Input - uses index+1 for display */}
                                <div className="flex-shrink-0">
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
                                                // Reset to current position if invalid
                                                e.target.value = String(index + 1);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                (e.target as HTMLInputElement).blur();
                                            }
                                        }}
                                        disabled={locked}
                                        className={`w-14 h-10 text-center font-bold text-lg rounded-lg border-2 transition-all focus:outline-none focus:ring-2 disabled:cursor-not-allowed ${
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
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-sm ${isDarkMode ? 'bg-gradient-to-br from-primary-500 to-accent-500' : 'bg-gradient-to-br from-maroon to-maroon-dark'}`}>
                                            {contestant.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{contestant.name}</p>
                                            <p className={`text-sm ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>{contestant.department}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Ordinal Display - on the right side */}
                                <div className={`text-right font-bold text-xl ${
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
