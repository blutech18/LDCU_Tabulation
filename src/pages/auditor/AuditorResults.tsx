import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaTrophy, FaMedal, FaChartBar, FaMars, FaVenus } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import type { Auditor, Category, Criteria, Participant, Judge, Score, Event } from '../../types';

interface AuditorContext {
    auditor: Auditor;
    isDarkMode: boolean;
}

const AuditorResults = () => {
    const { auditor, isDarkMode } = useOutletContext<AuditorContext>();
    const [event, setEvent] = useState<Event | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [judges, setJudges] = useState<Judge[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [scores, setScores] = useState<Score[]>([]);
    const [criteriaMap, setCriteriaMap] = useState<Record<number, Criteria[]>>({});
    const [loading, setLoading] = useState(true);
    const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');

    const isIndividual = event?.participant_type === 'individual';

    useEffect(() => {
        if (auditor?.event_id) {
            fetchAllData();
        }
    }, [auditor?.event_id]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Fetch event
            const { data: eventData } = await supabase
                .from('events')
                .select('*')
                .eq('id', auditor.event_id)
                .single();
            if (eventData) setEvent(eventData);

            // Fetch categories
            const { data: catsData } = await supabase
                .from('categories')
                .select('*')
                .eq('event_id', auditor.event_id)
                .order('display_order');
            if (catsData) setCategories(catsData);

            // Fetch judges
            const { data: judgesData } = await supabase
                .from('judges')
                .select('*')
                .eq('event_id', auditor.event_id)
                .eq('is_active', true)
                .order('name');
            if (judgesData) setJudges(judgesData);

            // Fetch participants
            const { data: partsData } = await supabase
                .from('participants')
                .select('*')
                .eq('event_id', auditor.event_id)
                .eq('is_active', true)
                .order('display_order');
            if (partsData) setParticipants(partsData);

            // Fetch criteria for all categories
            if (catsData && catsData.length > 0) {
                const { data: criteriaData } = await supabase
                    .from('criteria')
                    .select('*')
                    .in('category_id', catsData.map(c => c.id))
                    .order('display_order');

                if (criteriaData) {
                    const grouped: Record<number, Criteria[]> = {};
                    criteriaData.forEach((c: Criteria) => {
                        if (!grouped[c.category_id]) grouped[c.category_id] = [];
                        grouped[c.category_id].push(c);
                    });
                    setCriteriaMap(grouped);

                    // Fetch all scores
                    const { data: scoresData } = await supabase
                        .from('scores')
                        .select('*')
                        .in('criteria_id', criteriaData.map(c => c.id));
                    if (scoresData) setScores(scoresData);
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const getFilteredParticipants = () => {
        if (!isIndividual) return participants;
        return participants.filter(p => p.gender === selectedGender);
    };

    // Calculate final results data
    const getResultsData = () => {
        if (categories.length === 0) return null;

        const filteredParticipants = getFilteredParticipants();
        const participantCategoryRanks: Record<number, Record<number, number | null>> = {};

        filteredParticipants.forEach(p => {
            participantCategoryRanks[p.id] = {};
        });

        categories.forEach(category => {
            const criteria = criteriaMap[category.id] || [];
            if (criteria.length === 0) return;

            const participantTotals = filteredParticipants.map(participant => {
                let totalSum = 0;
                let judgeCount = 0;

                judges.forEach(judge => {
                    let hasScore = false;
                    let judgeTotal = 0;
                    criteria.forEach((c: any) => {
                        const score = scores.find(
                            s => s.judge_id === judge.id &&
                                s.participant_id === participant.id &&
                                s.criteria_id === c.id
                        );
                        if (score && score.score > 0) {
                            hasScore = true;
                            judgeTotal += score.score;
                        }
                    });
                    if (hasScore) {
                        totalSum += judgeTotal;
                        judgeCount++;
                    }
                });

                const avgTotal = judgeCount > 0 ? totalSum / judgeCount : 0;
                return { participant, avgTotal };
            });

            const sorted = [...participantTotals].sort((a, b) => b.avgTotal - a.avgTotal);
            const hasScores = sorted.some(p => p.avgTotal > 0);

            sorted.forEach((item, index) => {
                let rank: number | null = null;
                if (hasScores && item.avgTotal > 0) {
                    if (index === 0) {
                        rank = 1;
                    } else if (item.avgTotal === sorted[index - 1].avgTotal) {
                        const firstWithSameScore = sorted.findIndex(s => s.avgTotal === item.avgTotal);
                        rank = firstWithSameScore + 1;
                    } else {
                        rank = index + 1;
                    }
                }
                participantCategoryRanks[item.participant.id][category.id] = rank;
            });
        });

        const participantResults = filteredParticipants.map(participant => {
            const categoryRanks = participantCategoryRanks[participant.id];
            const validRanks = Object.values(categoryRanks).filter((r): r is number => r !== null);
            const sumRanks = validRanks.reduce((a, b) => a + b, 0);
            const categoryCount = validRanks.length;
            const results = categoryCount > 0 ? sumRanks / categoryCount : null;

            return {
                participant,
                categoryRanks,
                sumRanks,
                categoryCount,
                results
            };
        });

        const sorted = [...participantResults].sort((a, b) => {
            if (a.results === null && b.results === null) return 0;
            if (a.results === null) return 1;
            if (b.results === null) return -1;
            return a.results - b.results;
        });

        const ranked = sorted.map((item, index) => {
            let finalRank: number | null = null;
            if (item.results !== null) {
                if (index === 0) {
                    finalRank = 1;
                } else if (item.results === sorted[index - 1].results) {
                    const firstWithSameResults = sorted.findIndex(s => s.results === item.results);
                    finalRank = firstWithSameResults + 1;
                } else {
                    finalRank = index + 1;
                }
            }
            return { ...item, finalRank };
        });

        return ranked;
    };

    const resultsData = getResultsData();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className={`w-10 h-10 border-4 ${isDarkMode ? 'border-white/30 border-t-white' : 'border-maroon/30 border-t-maroon'} rounded-full animate-spin`} />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-8"
            >
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${isDarkMode ? 'bg-maroon/20 text-maroon-light' : 'bg-maroon/10 text-maroon'}`}>
                    <FaChartBar className="w-4 h-4" />
                    <span className="text-sm font-medium">Event Results</span>
                </div>
                <h1 className={`text-3xl md:text-4xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-maroon'}`}>
                    {event?.name || 'Event Results'}
                </h1>
                <p className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>
                    Final rankings and scores
                </p>
            </motion.div>

            {/* Gender Toggle for Individual Events */}
            {isIndividual && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className={`rounded-2xl p-4 mb-6 ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/10' : 'bg-white border border-gray-200 shadow-sm'}`}
                >
                    <label className={`text-sm font-medium mb-3 block ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                        Filter by Gender
                    </label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedGender('male')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${selectedGender === 'male'
                                ? 'bg-blue-600 text-white'
                                : isDarkMode ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            <FaMars className="w-4 h-4" />
                            Male
                        </button>
                        <button
                            onClick={() => setSelectedGender('female')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${selectedGender === 'female'
                                ? 'bg-pink-600 text-white'
                                : isDarkMode ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            <FaVenus className="w-4 h-4" />
                            Female
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Results Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/10' : 'bg-white border border-gray-200 shadow-lg'}`}
            >
                {/* Table Header */}
                <div className={`px-6 py-4 ${isDarkMode ? 'bg-gradient-to-r from-maroon/80 to-maroon-dark/80' : 'bg-gradient-to-r from-maroon to-maroon-dark'}`}>
                    <div className="flex items-center gap-3">
                        <FaTrophy className="w-6 h-6 text-gold" />
                        <div>
                            <h3 className="text-lg font-semibold text-white">Final Rankings</h3>
                            <p className="text-white/70 text-sm">Overall ranking based on average of all category ranks</p>
                        </div>
                    </div>
                </div>

                {/* Table Content */}
                <div className="p-6">
                    {resultsData && resultsData.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className={isDarkMode ? 'bg-white/5' : 'bg-gray-50'}>
                                        <th className={`border px-4 py-3 text-left font-semibold ${isDarkMode ? 'border-white/10 text-white' : 'border-gray-200 text-gray-900'}`}>
                                            Participant
                                        </th>
                                        {categories.map((category) => (
                                            <th key={category.id} className={`border px-4 py-3 text-center font-semibold ${isDarkMode ? 'border-white/10 text-white' : 'border-gray-200 text-gray-900'}`}>
                                                {category.name}
                                            </th>
                                        ))}
                                        <th className={`border px-4 py-3 text-center font-semibold ${isDarkMode ? 'border-white/10 text-white bg-blue-500/20' : 'border-gray-200 text-gray-900 bg-blue-50'}`}>
                                            Sum
                                        </th>
                                        <th className={`border px-4 py-3 text-center font-semibold ${isDarkMode ? 'border-white/10 text-white bg-purple-500/20' : 'border-gray-200 text-gray-900 bg-purple-50'}`}>
                                            <div>Results</div>
                                            <div className={`text-xs font-normal ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>(Sum ÷ Count)</div>
                                        </th>
                                        <th className={`border px-4 py-3 text-center font-semibold ${isDarkMode ? 'border-white/10 text-white bg-yellow-500/20' : 'border-gray-200 text-gray-900 bg-yellow-50'}`}>
                                            Final Rank
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resultsData.map((item, index) => (
                                        <tr key={item.participant.id} className={index % 2 === 0 ? (isDarkMode ? 'bg-white/5' : 'bg-white') : (isDarkMode ? 'bg-white/10' : 'bg-gray-50')}>
                                            <td className={`border px-4 py-3 ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                                                <div className="flex items-center gap-3">
                                                    {item.participant.photo_url ? (
                                                        <img
                                                            src={item.participant.photo_url}
                                                            alt={item.participant.name}
                                                            className="w-10 h-10 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold bg-maroon`}>
                                                            {item.participant.name.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.participant.name}</p>
                                                        <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>{item.participant.department}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            {categories.map((category) => (
                                                <td key={category.id} className={`border px-4 py-3 text-center ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                                                    {item.categoryRanks[category.id] !== null ? (
                                                        <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                            {item.categoryRanks[category.id]}
                                                        </span>
                                                    ) : (
                                                        <span className={isDarkMode ? 'text-white/40' : 'text-gray-400'}>—</span>
                                                    )}
                                                </td>
                                            ))}
                                            <td className={`border px-4 py-3 text-center font-bold ${isDarkMode ? 'border-white/10 text-blue-300 bg-blue-500/10' : 'border-gray-200 text-blue-700 bg-blue-50'}`}>
                                                {item.categoryCount > 0 ? item.sumRanks : '—'}
                                            </td>
                                            <td className={`border px-4 py-3 text-center font-bold ${isDarkMode ? 'border-white/10 text-purple-300 bg-purple-500/10' : 'border-gray-200 text-purple-700 bg-purple-50'}`}>
                                                {item.results !== null ? item.results.toFixed(2) : '—'}
                                            </td>
                                            <td className={`border px-4 py-3 text-center font-bold ${isDarkMode ? 'border-white/10 bg-yellow-500/10' : 'border-gray-200 bg-yellow-50'}`}>
                                                {item.finalRank !== null ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        {item.finalRank <= 3 && (
                                                            <FaMedal className={`w-5 h-5 ${item.finalRank === 1 ? 'text-yellow-500' :
                                                                    item.finalRank === 2 ? 'text-gray-400' :
                                                                        'text-amber-600'
                                                                }`} />
                                                        )}
                                                        <span className={
                                                            item.finalRank === 1 ? 'text-yellow-600' :
                                                                item.finalRank === 2 ? 'text-gray-500' :
                                                                    item.finalRank === 3 ? 'text-amber-600' :
                                                                        isDarkMode ? 'text-white' : 'text-gray-600'
                                                        }>
                                                            {getOrdinal(item.finalRank)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className={isDarkMode ? 'text-white/40' : 'text-gray-400'}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className={`text-center py-12 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                            <FaChartBar className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? 'text-white/20' : 'text-gray-300'}`} />
                            <p className="text-lg font-medium mb-2">No Results Yet</p>
                            <p className="text-sm">Scores have not been submitted for this event.</p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Event Info Footer */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className={`mt-6 text-center text-sm ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}
            >
                <p>Viewing results for: {event?.name}</p>
                {event?.date && <p>Event Date: {new Date(event.date).toLocaleDateString()}</p>}
            </motion.div>
        </div>
    );
};

export default AuditorResults;
