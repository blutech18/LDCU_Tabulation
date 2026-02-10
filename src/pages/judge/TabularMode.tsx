import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaChevronLeft, FaTable, FaTrophy, FaSync } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import ScoringTabular, { ScoringTabularRef } from '../../components/judge/ScoringTabular';
import RankingTabular, { RankingTabularRef } from '../../components/judge/RankingTabular';
import type { Judge, Category, Event, Participant } from '../../types';

interface JudgeContext {
    judge: Judge;
    isDarkMode: boolean;
}

interface CategoryWithEvent extends Category {
    events: Event;
}

const TabularMode = () => {
    const { categoryId } = useParams();
    const navigate = useNavigate();
    const { judge, isDarkMode } = useOutletContext<JudgeContext>();
    const [category, setCategory] = useState<CategoryWithEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [allowedParticipantIds, setAllowedParticipantIds] = useState<number[] | null>(null);
    const scoringTabularRef = useRef<ScoringTabularRef>(null);
    const rankingTabularRef = useRef<RankingTabularRef>(null);

    useEffect(() => {
        if (categoryId) {
            fetchCategory();
        }
    }, [categoryId]);

    // Enter fullscreen when component mounts
    useEffect(() => {
        const enterFullscreen = async () => {
            try {
                const element = document.documentElement;
                if (element.requestFullscreen) {
                    await element.requestFullscreen();
                } else if ((element as any).webkitRequestFullscreen) {
                    // Safari
                    await (element as any).webkitRequestFullscreen();
                } else if ((element as any).mozRequestFullScreen) {
                    // Firefox
                    await (element as any).mozRequestFullScreen();
                } else if ((element as any).msRequestFullscreen) {
                    // IE/Edge
                    await (element as any).msRequestFullscreen();
                }
            } catch (error) {
                console.log('Fullscreen not supported or failed:', error);
            }
        };

        // Enter fullscreen after a short delay to ensure component is mounted
        const timer = setTimeout(() => {
            enterFullscreen();
        }, 100);

        return () => {
            clearTimeout(timer);
        };
    }, [categoryId]);

    const fetchCategory = async () => {
        const { data, error } = await supabase
            .from('categories')
            .select(`
        *,
        events (
          id,
          name,
          date,
          participant_type,
          judge_display_limit
        )
      `)
            .eq('id', categoryId)
            .single();

        if (!error && data) {
            const cat = data as CategoryWithEvent;
            setCategory(cat);

            // If judge_display_limit is set, calculate which participants are in top N
            const limit = cat.events?.judge_display_limit;
            if (limit && limit > 0) {
                const topIds = await calculateTopParticipantIds(cat.events.id, limit, cat.events.participant_type);
                setAllowedParticipantIds(topIds);
            } else {
                setAllowedParticipantIds(null);
            }
        }
        setLoading(false);
    };

    // Calculate final rankings (same logic as AuditorResults) and return top N participant IDs
    const calculateTopParticipantIds = async (
        eventId: number,
        limit: number,
        _participantType: string
    ): Promise<number[] | null> => {
        try {
            // Fetch all categories for this event (non-completed)
            const { data: categoriesData } = await supabase
                .from('categories')
                .select('*')
                .eq('event_id', eventId)
                .order('display_order');
            const allCategories = (categoriesData || []).filter((c: any) => !c.is_completed);
            if (allCategories.length === 0) return null;

            // Fetch judges
            const { data: judgesData } = await supabase
                .from('judges')
                .select('*')
                .eq('event_id', eventId)
                .eq('is_active', true);
            const allJudges = judgesData || [];
            if (allJudges.length === 0) return null;

            // Fetch participants
            const { data: participantsData } = await supabase
                .from('participants')
                .select('*')
                .eq('event_id', eventId)
                .eq('is_active', true)
                .order('display_order', { ascending: true, nullsFirst: false })
                .order('number', { ascending: true });
            const allParticipants = (participantsData || []) as Participant[];
            if (allParticipants.length === 0) return null;

            // Fetch all criteria grouped by category
            const categoryIds = allCategories.map((c: any) => c.id);
            const { data: criteriaData } = await supabase
                .from('criteria')
                .select('*')
                .in('category_id', categoryIds)
                .order('display_order');
            const criteriaMap: Record<number, any[]> = {};
            (criteriaData || []).forEach((c: any) => {
                if (!criteriaMap[c.category_id]) criteriaMap[c.category_id] = [];
                criteriaMap[c.category_id].push(c);
            });

            // Fetch all scores
            const criteriaIds = (criteriaData || []).map((c: any) => c.id);
            let allScores: any[] = [];
            if (criteriaIds.length > 0) {
                const { data: scoresData } = await supabase
                    .from('scores')
                    .select('*')
                    .in('criteria_id', criteriaIds);
                allScores = scoresData || [];
            }

            // For individual events, we need to calculate per gender
            // But for the judge display limit, we calculate across all participants
            // since the judge sees one gender at a time but the limit applies globally
            const participantCategoryValues: Record<number, Record<number, number | null>> = {};
            allParticipants.forEach((p) => {
                participantCategoryValues[p.id] = {};
            });

            // Ranking-based mode calculation (same as AuditorResults default)
            allCategories.forEach((category: any) => {
                const criteria = criteriaMap[category.id] || [];
                if (criteria.length === 0) return;

                const isRankingBased = (category.tabular_type || '').toLowerCase() === 'ranking';

                if (isRankingBased) {
                    const participantRankData = allParticipants.map((participant) => {
                        const firstCriteria = criteria[0];
                        let totalRank = 0;
                        let judgeCount = 0;
                        allJudges.forEach((judge: any) => {
                            const scoreEntry = allScores.find(
                                (s) => s.judge_id === judge.id && s.participant_id === participant.id && s.criteria_id === firstCriteria.id
                            );
                            if (scoreEntry?.rank !== null && scoreEntry?.rank !== undefined) {
                                totalRank += scoreEntry.rank;
                                judgeCount++;
                            }
                        });
                        const avgRank = judgeCount > 0 ? totalRank / judgeCount : null;
                        return { participant, avgRank };
                    });

                    const sorted = [...participantRankData].sort((a, b) => {
                        if (a.avgRank === null && b.avgRank === null) return 0;
                        if (a.avgRank === null) return 1;
                        if (b.avgRank === null) return -1;
                        return a.avgRank - b.avgRank;
                    });

                    let currentRank = 0;
                    let previousAvg: number | null = null;
                    sorted.forEach((item) => {
                        if (item.avgRank !== null) {
                            if (item.avgRank !== previousAvg) currentRank++;
                            participantCategoryValues[item.participant.id][category.id] = currentRank;
                            previousAvg = item.avgRank;
                        } else {
                            participantCategoryValues[item.participant.id][category.id] = null;
                        }
                    });
                } else {
                    // Scoring-based: average total scores across judges, then rank
                    const participantScoreData = allParticipants.map((participant) => {
                        let totalSum = 0;
                        let judgeCount = 0;
                        allJudges.forEach((judge: any) => {
                            let hasScore = false;
                            let judgeTotal = 0;
                            criteria.forEach((c: any) => {
                                const score = allScores.find(
                                    (s) => s.judge_id === judge.id && s.participant_id === participant.id && s.criteria_id === c.id
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
                        const avgScore = judgeCount > 0 ? totalSum / judgeCount : null;
                        return { participant, avgScore };
                    });

                    const sorted = [...participantScoreData].sort((a, b) => {
                        if (a.avgScore === null && b.avgScore === null) return 0;
                        if (a.avgScore === null) return 1;
                        if (b.avgScore === null) return -1;
                        return b.avgScore - a.avgScore; // higher score = better = lower rank
                    });

                    let currentRank = 0;
                    let previousScore: number | null = null;
                    sorted.forEach((item) => {
                        if (item.avgScore !== null) {
                            if (item.avgScore !== previousScore) currentRank++;
                            participantCategoryValues[item.participant.id][category.id] = currentRank;
                            previousScore = item.avgScore;
                        } else {
                            participantCategoryValues[item.participant.id][category.id] = null;
                        }
                    });
                }
            });

            // Calculate average ranks across categories -> final rank
            const participantResults = allParticipants.map((participant) => {
                const categoryRanks = participantCategoryValues[participant.id];
                const validRanks = Object.values(categoryRanks).filter((r): r is number => r !== null);
                const sumRanks = validRanks.reduce((a, b) => a + b, 0);
                const categoryCount = validRanks.length;
                const avgRank = categoryCount > 0 ? sumRanks / categoryCount : null;
                return { participant, avgRank };
            });

            const sorted = [...participantResults].sort((a, b) => {
                if (a.avgRank === null && b.avgRank === null) return 0;
                if (a.avgRank === null) return 1;
                if (b.avgRank === null) return -1;
                return a.avgRank - b.avgRank;
            });

            let currentRank = 0;
            let previousAvg: number | null = null;
            const ranked = sorted.map((item) => {
                let finalRank: number | null = null;
                if (item.avgRank !== null) {
                    if (item.avgRank !== previousAvg) currentRank++;
                    finalRank = currentRank;
                    previousAvg = item.avgRank;
                }
                return { ...item, finalRank };
            });

            // Return IDs of participants within the top N (by final rank)
            const topIds = ranked
                .filter((item) => item.finalRank !== null && item.finalRank <= limit)
                .map((item) => item.participant.id);

            return topIds.length > 0 ? topIds : null;
        } catch (err) {
            console.error('Error calculating top participants:', err);
            return null;
        }
    };

    const handleBack = () => {
        // Exit fullscreen before navigating back
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitFullscreenElement) {
            (document as any).webkitExitFullscreen();
        } else if ((document as any).mozFullScreenElement) {
            (document as any).mozCancelFullScreen();
        } else if ((document as any).msFullscreenElement) {
            (document as any).msExitFullscreen();
        }
        navigate('/judge/panel');
    };

    const handleFinish = () => {
        // Exit fullscreen before navigating
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitFullscreenElement) {
            (document as any).webkitExitFullscreen();
        } else if ((document as any).mozFullScreenElement) {
            (document as any).mozCancelFullScreen();
        } else if ((document as any).msFullscreenElement) {
            (document as any).msExitFullscreen();
        }
        navigate(`/judge/finished/${categoryId}`);
    };

    const handleRefresh = async () => {
        if (!category) return;
        setIsRefreshing(true);
        try {
            const isRankingBased = category.tabular_type === 'ranking';
            if (isRankingBased && rankingTabularRef.current) {
                await rankingTabularRef.current.refresh();
            } else if (!isRankingBased && scoringTabularRef.current) {
                await scoringTabularRef.current.refresh();
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            setIsRefreshing(false);
        }
    };



    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className={`w-10 h-10 border-4 rounded-full animate-spin ${isDarkMode ? 'border-white/20 border-t-white' : 'border-maroon/20 border-t-maroon'}`} />
            </div>
        );
    }

    if (!category) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Category Not Found</h2>
                    <button onClick={handleBack} className={`font-medium ${isDarkMode ? 'text-gold hover:text-gold-light' : 'text-maroon hover:text-maroon-dark'}`}>
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const isRankingBased = category.tabular_type === 'ranking';

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-8 sm:pb-10 md:pb-12 lg:pb-14">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 mb-8"
            >
                <button
                    onClick={handleBack}
                    className={`p-3 rounded-xl transition-colors shadow-sm ${isDarkMode ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-maroon'}`}
                >
                    <FaChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-maroon'}`}>{category.name}</h1>
                        <span className={`text-lg ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>•</span>
                        <p className={`text-lg ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                            {category.events.name}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${isDarkMode ? 'bg-maroon/90 border border-maroon' : 'bg-maroon border border-maroon-dark'}`}>
                            {isRankingBased ? (
                                <>
                                    <FaTrophy className="w-4 h-4 text-gold" />
                                    <span className="text-white">Ranking</span>
                                </>
                            ) : (
                                <>
                                    <FaTable className="w-4 h-4 text-gold" />
                                    <span className="text-white">Scoring</span>
                                </>
                            )}
                        </span>
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className={`p-2 rounded-lg transition-all ${isDarkMode ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            title="Refresh data"
                        >
                            <FaSync className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Dynamic Tabular Component */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                {isRankingBased ? (
                    <RankingTabular
                        ref={rankingTabularRef}
                        categoryId={Number.parseInt(categoryId || '0')}
                        judgeId={judge.id}
                        onFinish={handleFinish}
                        isDarkMode={isDarkMode}
                        eventParticipantType={category.events.participant_type}
                        allowedParticipantIds={allowedParticipantIds}
                    />
                ) : (
                    <ScoringTabular
                        ref={scoringTabularRef}
                        categoryId={Number.parseInt(categoryId || '0')}
                        judgeId={judge.id}
                        onFinish={handleFinish}
                        isDarkMode={isDarkMode}
                        eventParticipantType={category.events.participant_type}
                        allowedParticipantIds={allowedParticipantIds}
                    />
                )}
            </motion.div>
        </div>
    );
};

export default TabularMode;
