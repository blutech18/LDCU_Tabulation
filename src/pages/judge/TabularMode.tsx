import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaChevronLeft, FaTable, FaTrophy, FaSync } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import ScoringTabular, { ScoringTabularRef } from '../../components/judge/ScoringTabular';
import RankingTabular, { RankingTabularRef } from '../../components/judge/RankingTabular';
import type { Judge, Category, Event } from '../../types';

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
          participant_type
        )
      `)
            .eq('id', categoryId)
            .single();

        if (!error && data) {
            setCategory(data as CategoryWithEvent);
        }
        setLoading(false);
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
                    />
                ) : (
                    <ScoringTabular
                        ref={scoringTabularRef}
                        categoryId={Number.parseInt(categoryId || '0')}
                        judgeId={judge.id}
                        onFinish={handleFinish}
                        isDarkMode={isDarkMode}
                        eventParticipantType={category.events.participant_type}
                    />
                )}
            </motion.div>
        </div>
    );
};

export default TabularMode;
