import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTrophy, FaMedal, FaChartBar, FaMars, FaVenus, FaUserTie } from 'react-icons/fa';
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
    const [activeScoreTab, setActiveScoreTab] = useState<'judge-scores' | 'average-scores' | 'final-results'>('final-results');

    // Detailed view filters
    const [selectedJudge, setSelectedJudge] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [selectedCategoryForTable2, setSelectedCategoryForTable2] = useState<number | null>(null);

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

            // Check if this category is ranking-based - case insensitive safe check
            const isRankingBased = (category.tabular_type || '').toLowerCase() === 'ranking';

            if (isRankingBased) {
                // For ranking-based categories, use the rank column directly
                // Average the ranks across all judges for each participant
                const participantRankData = filteredParticipants.map(participant => {
                    const firstCriteria = criteria[0];
                    let totalRank = 0;
                    let judgeCount = 0;

                    judges.forEach(judge => {
                        const scoreEntry = scores.find(
                            s => s.judge_id === judge.id &&
                                s.participant_id === participant.id &&
                                s.criteria_id === firstCriteria.id
                        );
                        if (scoreEntry?.rank !== null && scoreEntry?.rank !== undefined) {
                            totalRank += scoreEntry.rank;
                            judgeCount++;
                        }
                    });

                    const avgRank = judgeCount > 0 ? totalRank / judgeCount : null;
                    return { participant, avgRank };
                });

                // Sort by average rank (ascending - lower is better)
                const sorted = [...participantRankData].sort((a, b) => {
                    if (a.avgRank === null && b.avgRank === null) return 0;
                    if (a.avgRank === null) return 1;
                    if (b.avgRank === null) return -1;
                    return a.avgRank - b.avgRank;
                });

                const hasRanks = sorted.some(p => p.avgRank !== null);

                sorted.forEach((item, index) => {
                    let rank: number | null = null;
                    if (hasRanks && item.avgRank !== null) {
                        if (index === 0) {
                            rank = 1;
                        } else if (item.avgRank === sorted[index - 1].avgRank) {
                            const firstWithSameRank = sorted.findIndex(s => s.avgRank === item.avgRank);
                            rank = firstWithSameRank + 1;
                        } else {
                            rank = index + 1;
                        }
                    }
                    participantCategoryRanks[item.participant.id][category.id] = rank;
                });
            } else {
                // For scoring-based categories, calculate ranks from scores
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
            }
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

        // Use dense ranking (1st, 2nd, 2nd, 3rd) instead of competition ranking (1st, 2nd, 2nd, 4th)
        let currentRank = 0;
        let previousResults: number | null = null;
        const ranked = sorted.map((item) => {
            let finalRank: number | null = null;
            if (item.results !== null) {
                if (item.results !== previousResults) {
                    currentRank++;
                }
                finalRank = currentRank;
                previousResults = item.results;
            }
            return { ...item, finalRank };
        });

        return ranked;
    };

    // ==================== TABLE 1: Judge Rankings by Criteria (Detailed View) ====================
    const getTable1Data = () => {
        if (!selectedJudge || !selectedCategory) return null;

        const criteria = criteriaMap[selectedCategory] || [];
        const filteredParticipants = getFilteredParticipants();

        const participantScores = filteredParticipants.map(participant => {
            const criteriaScores: Record<number, number> = {};
            let total = 0;

            criteria.forEach((c: Criteria) => {
                const score = scores.find(
                    s => s.judge_id === selectedJudge &&
                        s.participant_id === participant.id &&
                        s.criteria_id === c.id
                );
                const scoreValue = score?.score ?? 0;
                criteriaScores[c.id] = scoreValue;
                total += scoreValue;
            });

            return { participant, criteriaScores, total };
        });

        const sorted = [...participantScores].sort((a, b) => b.total - a.total);
        const hasScores = sorted.some(p => p.total > 0);

        const ranked = sorted.map((item, index) => {
            let rank: number | null = null;
            if (hasScores && item.total > 0) {
                if (index === 0) {
                    rank = 1;
                } else if (item.total === sorted[index - 1].total) {
                    const firstWithSameScore = sorted.findIndex(s => s.total === item.total);
                    rank = firstWithSameScore + 1;
                } else {
                    rank = index + 1;
                }
            }
            return { ...item, rank };
        });

        return { criteria, participants: ranked };
    };

    // ==================== TABLE 2: Scores by Judge (Detailed View) ====================
    const getTable2Data = () => {
        if (!selectedCategoryForTable2) return null;

        const category = categories.find(c => c.id === selectedCategoryForTable2);
        if (!category) return null;

        const criteria = criteriaMap[selectedCategoryForTable2] || [];
        const filteredParticipants = getFilteredParticipants();

        // Check if this category is ranking-based - case insensitive safe check
        const isRankingBased = (category.tabular_type || '').toLowerCase() === 'ranking';

        const judgesWithScores = judges.filter(judge => {
            if (isRankingBased) {
                // For ranking, only check the first criteria since ranking is per-category
                const firstCriteria = criteria[0];
                if (!firstCriteria) return false;
                return scores.some(s =>
                    s.judge_id === judge.id &&
                    s.criteria_id === firstCriteria.id &&
                    s.rank !== null // Ensure there is a rank
                );
            } else {
                return scores.some(s =>
                    s.judge_id === judge.id &&
                    criteria.some((c: Criteria) => c.id === s.criteria_id)
                );
            }
        });

        if (isRankingBased) {
            // For ranking-based categories, directly use the rank column from scores
            const participantData = filteredParticipants.map(participant => {
                const judgeRanks: Record<number, { total: number; rank: number | null }> = {};

                judgesWithScores.forEach(judge => {
                    // For ranking categories, get the rank directly from the first criteria
                    const firstCriteria = criteria[0];
                    const scoreEntry = firstCriteria ? scores.find(
                        s => s.judge_id === judge.id &&
                            s.participant_id === participant.id &&
                            s.criteria_id === firstCriteria.id
                    ) : null;

                    const rank = scoreEntry?.rank ?? null;
                    judgeRanks[judge.id] = { total: 0, rank };
                });

                return { participant, judgeRanks };
            });

            // Calculate sum and results for each participant (Sum of Ranks ÷ Number of Judges)
            const participantsWithAvg = participantData.map(p => {
                const ranks = Object.values(p.judgeRanks)
                    .map(jr => jr.rank)
                    .filter((r): r is number => r !== null);
                const sumRanks = ranks.reduce((a, b) => a + b, 0);
                const judgeCount = ranks.length;
                const results = judgeCount > 0 ? sumRanks / judgeCount : null;
                return { ...p, sumRanks, judgeCount, results };
            });

            // Sort by results (lower mean rank is better)
            const sorted = [...participantsWithAvg].sort((a, b) => {
                if (a.results === null && b.results === null) return 0;
                if (a.results === null) return 1;
                if (b.results === null) return -1;
                return a.results - b.results;
            });

            // Assign final ranks
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

            return { judges: judgesWithScores, participants: ranked, category, isRankingBased: true };
        }

        const participantData = filteredParticipants.map(participant => {
            const judgeRanks: Record<number, { total: number; rank: number | null }> = {};

            judgesWithScores.forEach(judge => {
                let total = 0;
                criteria.forEach((c: Criteria) => {
                    const score = scores.find(
                        s => s.judge_id === judge.id &&
                            s.participant_id === participant.id &&
                            s.criteria_id === c.id
                    );
                    total += score?.score ?? 0;
                });
                judgeRanks[judge.id] = { total, rank: null };
            });

            return { participant, judgeRanks };
        });

        judgesWithScores.forEach(judge => {
            const participantsForJudge = participantData
                .map(p => ({ id: p.participant.id, total: p.judgeRanks[judge.id]?.total ?? 0 }))
                .sort((a, b) => b.total - a.total);

            const hasScores = participantsForJudge.some(p => p.total > 0);

            participantsForJudge.forEach((item, index) => {
                const pData = participantData.find(p => p.participant.id === item.id);
                if (pData && pData.judgeRanks[judge.id]) {
                    if (!hasScores || item.total === 0) {
                        pData.judgeRanks[judge.id].rank = null;
                    } else if (index === 0) {
                        pData.judgeRanks[judge.id].rank = 1;
                    } else if (item.total === participantsForJudge[index - 1].total) {
                        const firstWithSameScore = participantsForJudge.findIndex(s => s.total === item.total);
                        pData.judgeRanks[judge.id].rank = firstWithSameScore + 1;
                    } else {
                        pData.judgeRanks[judge.id].rank = index + 1;
                    }
                }
            });
        });

        const participantsWithAvg = participantData.map(p => {
            const ranks = Object.values(p.judgeRanks)
                .map(jr => jr.rank)
                .filter((r): r is number => r !== null);
            const sumRanks = ranks.reduce((a, b) => a + b, 0);
            const judgeCount = ranks.length;
            const results = judgeCount > 0 ? sumRanks / judgeCount : null;
            return { ...p, sumRanks, judgeCount, results };
        });

        const sorted = [...participantsWithAvg].sort((a, b) => {
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

        return { judges: judgesWithScores, participants: ranked, category, isRankingBased: false };
    };


    const resultsData = getResultsData();
    const table1Data = event?.auditor_detailed_view ? getTable1Data() : null;
    const table2Data = event?.auditor_detailed_view ? getTable2Data() : null;

    // Filter results based on top_display_limit setting
    const topLimit = event?.top_display_limit;
    const filteredResultsData = resultsData && topLimit && topLimit > 0
        ? resultsData.filter(item => item.finalRank !== null && item.finalRank <= topLimit)
        : resultsData;

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

            {/* Main Score Section Tabs - Only shown when auditor_detailed_view is enabled */}
            {event?.auditor_detailed_view && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-6"
                >
                    <div className={`p-1.5 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                            <button
                                onClick={() => setActiveScoreTab('judge-scores')}
                                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${activeScoreTab === 'judge-scores'
                                    ? isDarkMode ? 'bg-white text-maroon shadow-md' : 'bg-white text-maroon shadow-md ring-1 ring-black/5'
                                    : isDarkMode ? 'bg-transparent text-white/70 hover:text-white hover:bg-white/20' : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-white/50'
                                    }`}
                            >
                                Judge Scores by Criteria
                            </button>
                            <button
                                onClick={() => setActiveScoreTab('average-scores')}
                                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${activeScoreTab === 'average-scores'
                                    ? isDarkMode ? 'bg-white text-maroon shadow-md' : 'bg-white text-maroon shadow-md ring-1 ring-black/5'
                                    : isDarkMode ? 'bg-transparent text-white/70 hover:text-white hover:bg-white/20' : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-white/50'
                                    }`}
                            >
                                Average Judge Scores
                            </button>
                            <button
                                onClick={() => setActiveScoreTab('final-results')}
                                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${activeScoreTab === 'final-results'
                                    ? isDarkMode ? 'bg-white text-maroon shadow-md' : 'bg-white text-maroon shadow-md ring-1 ring-black/5'
                                    : isDarkMode ? 'bg-transparent text-white/70 hover:text-white hover:bg-white/20' : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-white/50'
                                    }`}
                            >
                                Average Ranks - Final Results
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Gender Toggle for Individual Events */}
            {isIndividual && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-6"
                >
                    <div className={`p-1.5 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => setSelectedGender('male')}
                                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm flex-1 ${selectedGender === 'male'
                                    ? isDarkMode ? 'bg-white text-blue-600 shadow-md' : 'bg-white text-blue-600 shadow-md ring-1 ring-black/5'
                                    : isDarkMode ? 'bg-transparent text-white/70 hover:text-white hover:bg-white/20' : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-white/50'
                                    }`}
                            >
                                <FaMars className="w-4 h-4" />
                                Male
                            </button>
                            <button
                                onClick={() => setSelectedGender('female')}
                                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm flex-1 ${selectedGender === 'female'
                                    ? isDarkMode ? 'bg-white text-pink-600 shadow-md' : 'bg-white text-pink-600 shadow-md ring-1 ring-black/5'
                                    : isDarkMode ? 'bg-transparent text-white/70 hover:text-white hover:bg-white/20' : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-white/50'
                                    }`}
                            >
                                <FaVenus className="w-4 h-4" />
                                Female
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Tab Content with Animations */}
            <AnimatePresence mode="wait">
                {/* TABLE 3: Final Results - Show when no detailed view OR when final-results tab is active */}
                {(!event?.auditor_detailed_view || activeScoreTab === 'final-results') && (
                    <motion.div
                        key="final-results"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/10' : 'bg-white border border-gray-200 shadow-lg'}`}
                    >
                        {/* Table Header */}
                        <div className={`px-6 py-4 ${isDarkMode ? 'bg-gradient-to-r from-maroon/80 to-maroon-dark/80' : 'bg-gradient-to-r from-maroon to-maroon-dark'}`}>
                            <div className="flex items-center gap-3">
                                <FaTrophy className="w-6 h-6 text-gold" />
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-white">{event?.auditor_detailed_view ? '3. Average Ranks - Final Results' : 'Final Rankings'}</h3>
                                    <p className="text-white/70 text-sm">Overall ranking based on average of all category ranks</p>
                                </div>
                                {topLimit && topLimit > 0 && (
                                    <div className="px-3 py-1.5 bg-white/20 rounded-full text-white text-sm font-medium">
                                        Showing Top {topLimit}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Table Content */}
                        <div className="p-6">
                            {filteredResultsData && filteredResultsData.length > 0 ? (
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
                                            {filteredResultsData.map((item, index) => (
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
                )}

                {/* TABLE 1: Judge Rankings by Criteria - Only shown when judge-scores tab is active */}
                {event?.auditor_detailed_view && activeScoreTab === 'judge-scores' && (
                    <motion.div
                        key="judge-scores"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/10' : 'bg-white border border-gray-200 shadow-lg'}`}
                    >
                        <div className={`px-6 py-4 ${isDarkMode ? 'bg-gradient-to-r from-maroon/80 to-maroon-dark/80' : 'bg-gradient-to-r from-maroon to-maroon-dark'}`}>
                            <div className="flex items-center gap-3">
                                <FaUserTie className="w-6 h-6 text-white" />
                                <div>
                                    <h3 className="text-lg font-semibold text-white">1. Judge Rankings by Criteria</h3>
                                    <p className="text-white/70 text-sm">View rankings per criteria with total score and overall rank</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>Select Judge</label>
                                    <select
                                        value={selectedJudge || ''}
                                        onChange={(e) => setSelectedJudge(e.target.value ? Number(e.target.value) : null)}
                                        className={`w-full px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                    >
                                        <option value="" className="text-gray-900">-- Select a Judge --</option>
                                        {judges.map(judge => (
                                            <option key={judge.id} value={judge.id} className="text-gray-900">{judge.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>Select Category</label>
                                    <select
                                        value={selectedCategory || ''}
                                        onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
                                        className={`w-full px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                    >
                                        <option value="" className="text-gray-900">-- Select a Category --</option>
                                        {categories.map(category => (
                                            <option key={category.id} value={category.id} className="text-gray-900">{category.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {table1Data ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className={isDarkMode ? 'bg-white/5' : 'bg-gray-50'}>
                                                <th className={`border px-4 py-3 text-left font-semibold ${isDarkMode ? 'border-white/10 text-white' : 'border-gray-200 text-gray-900'}`}>
                                                    Participant
                                                </th>
                                                {table1Data.criteria.map((c: Criteria) => (
                                                    <th key={c.id} className={`border px-4 py-3 text-center font-semibold ${isDarkMode ? 'border-white/10 text-white' : 'border-gray-200 text-gray-900'}`}>
                                                        <div>{c.name}</div>
                                                        <div className={`text-xs font-normal ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                                                            {c.percentage > 0 ? `${c.percentage}%` : ''}
                                                        </div>
                                                        <div className={`text-xs font-normal ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                                                            ({c.min_score} - {c.max_score})
                                                        </div>
                                                    </th>
                                                ))}
                                                <th className={`border px-4 py-3 text-center font-semibold ${isDarkMode ? 'border-white/10 text-white bg-maroon/20' : 'border-gray-200 text-gray-900 bg-maroon/10'}`}>
                                                    Total
                                                </th>
                                                <th className={`border px-4 py-3 text-center font-semibold ${isDarkMode ? 'border-white/10 text-white bg-yellow-500/20' : 'border-gray-200 text-gray-900 bg-yellow-50'}`}>
                                                    Rank
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {table1Data.participants.map((item, index) => (
                                                <tr key={item.participant.id} className={index % 2 === 0 ? (isDarkMode ? 'bg-white/5' : 'bg-white') : (isDarkMode ? 'bg-white/10' : 'bg-gray-50')}>
                                                    <td className={`border px-4 py-3 ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                                                        <div className="flex items-center gap-3">
                                                            {item.participant.photo_url ? (
                                                                <img src={item.participant.photo_url} alt={item.participant.name} className="w-8 h-8 rounded-full object-cover" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-maroon flex items-center justify-center text-white text-sm font-bold">
                                                                    {item.participant.name.charAt(0)}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.participant.name}</p>
                                                                <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>{item.participant.department}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {table1Data.criteria.map((c: Criteria) => (
                                                        <td key={c.id} className={`border px-4 py-3 text-center ${isDarkMode ? 'border-white/10 text-white/40' : 'border-gray-200 text-gray-400'}`}>
                                                            —
                                                        </td>
                                                    ))}
                                                    <td className={`border px-4 py-3 text-center font-bold ${isDarkMode ? 'border-white/10 text-maroon-light bg-maroon/10' : 'border-gray-200 text-maroon bg-maroon/5'}`}>
                                                        {item.total.toFixed(1)}
                                                    </td>
                                                    <td className={`border px-4 py-3 text-center font-bold ${isDarkMode ? 'border-white/10 bg-yellow-500/10' : 'border-gray-200 bg-yellow-50'}`}>
                                                        {item.rank !== null ? (
                                                            <span className={item.rank === 1 ? 'text-yellow-600' : item.rank === 2 ? 'text-gray-500' : item.rank === 3 ? 'text-amber-600' : isDarkMode ? 'text-white' : 'text-gray-600'}>
                                                                {getOrdinal(item.rank)}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className={`text-center py-8 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                                    Select a judge and category to view rankings
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* TABLE 2: Scores by Judge - Only shown when average-scores tab is active */}
                {event?.auditor_detailed_view && activeScoreTab === 'average-scores' && (
                    <motion.div
                        key="average-scores"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/10' : 'bg-white border border-gray-200 shadow-lg'}`}
                    >
                        <div className={`px-6 py-4 ${isDarkMode ? 'bg-gradient-to-r from-maroon/80 to-maroon-dark/80' : 'bg-gradient-to-r from-maroon to-maroon-dark'}`}>
                            <div className="flex items-center gap-3">
                                <FaChartBar className="w-6 h-6 text-white" />
                                <div>
                                    <h3 className="text-lg font-semibold text-white">
                                        2. Scores by Judge / Average Judge Scores
                                        {table2Data?.isRankingBased && <span className="ml-2 text-yellow-300 text-sm">(Ranking Mode)</span>}
                                    </h3>
                                    <p className="text-white/70 text-sm">View rankings from each judge and the average</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="mb-6">
                                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>Select Category</label>
                                <select
                                    value={selectedCategoryForTable2 || ''}
                                    onChange={(e) => setSelectedCategoryForTable2(e.target.value ? Number(e.target.value) : null)}
                                    className={`w-full max-w-md px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                >
                                    <option value="" className="text-gray-900">-- Select a Category --</option>
                                    {categories.map(category => (
                                        <option key={category.id} value={category.id} className="text-gray-900">{category.name}</option>
                                    ))}
                                </select>
                            </div>

                            {table2Data ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className={isDarkMode ? 'bg-white/5' : 'bg-gray-50'}>
                                                <th className={`border px-4 py-3 text-left font-semibold ${isDarkMode ? 'border-white/10 text-white' : 'border-gray-200 text-gray-900'}`}>
                                                    Participant
                                                </th>
                                                {table2Data.judges.map((judge) => (
                                                    <th key={judge.id} className={`border px-4 py-3 text-center font-semibold ${isDarkMode ? 'border-white/10 text-white' : 'border-gray-200 text-gray-900'}`}>
                                                        {judge.name}
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
                                            {table2Data.participants.map((item, index) => (
                                                <tr key={item.participant.id} className={index % 2 === 0 ? (isDarkMode ? 'bg-white/5' : 'bg-white') : (isDarkMode ? 'bg-white/10' : 'bg-gray-50')}>
                                                    <td className={`border px-4 py-3 ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                                                        <div className="flex items-center gap-3">
                                                            {item.participant.photo_url ? (
                                                                <img src={item.participant.photo_url} alt={item.participant.name} className="w-8 h-8 rounded-full object-cover" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-bold">
                                                                    {item.participant.name.charAt(0)}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.participant.name}</p>
                                                                <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>{item.participant.department}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {table2Data.judges.map((judge) => (
                                                        <td key={judge.id} className={`border px-4 py-3 text-center ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                                                            {item.judgeRanks[judge.id]?.rank !== null ? (
                                                                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.judgeRanks[judge.id].rank}</span>
                                                            ) : '—'}
                                                        </td>
                                                    ))}
                                                    <td className={`border px-4 py-3 text-center font-bold ${isDarkMode ? 'border-white/10 text-blue-300 bg-blue-500/10' : 'border-gray-200 text-blue-700 bg-blue-50'}`}>
                                                        {item.judgeCount > 0 ? item.sumRanks : '—'}
                                                    </td>
                                                    <td className={`border px-4 py-3 text-center font-bold ${isDarkMode ? 'border-white/10 text-purple-300 bg-purple-500/10' : 'border-gray-200 text-purple-700 bg-purple-50'}`}>
                                                        {item.results !== null ? item.results.toFixed(2) : '—'}
                                                    </td>
                                                    <td className={`border px-4 py-3 text-center font-bold ${isDarkMode ? 'border-white/10 bg-yellow-500/10' : 'border-gray-200 bg-yellow-50'}`}>
                                                        {item.finalRank !== null ? (
                                                            <span className={item.finalRank === 1 ? 'text-yellow-600' : item.finalRank === 2 ? 'text-gray-500' : item.finalRank === 3 ? 'text-amber-600' : isDarkMode ? 'text-white' : 'text-gray-600'}>
                                                                {getOrdinal(item.finalRank)}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className={`text-center py-8 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                                    Select a category to view judge scores
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
