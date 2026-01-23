import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaChevronLeft, FaTable, FaTrophy } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import ScoringTabular from '../../components/judge/ScoringTabular';
import RankingTabular from '../../components/judge/RankingTabular';
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

    useEffect(() => {
        if (categoryId) {
            fetchCategory();
        }
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
        navigate('/judge/panel');
    };

    const handleFinish = () => {
        navigate(`/judge/finished/${categoryId}`);
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <div className="flex-1 flex items-center gap-3">
                    <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-maroon'}`}>{category.name}</h1>
                    <span className={`text-sm ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>•</span>
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                        {category.events.name}
                    </p>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isDarkMode ? 'bg-white/10 border border-white/20' : 'bg-gray-100 border border-gray-200'}`}>
                        {isRankingBased ? (
                            <>
                                <FaTrophy className={`w-3.5 h-3.5 ${isDarkMode ? 'text-maroon' : 'text-maroon'}`} />
                                <span className={isDarkMode ? 'text-maroon-light' : 'text-maroon'}>Ranking</span>
                            </>
                        ) : (
                            <>
                                <FaTable className={`w-3.5 h-3.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                                <span className={isDarkMode ? 'text-blue-300' : 'text-blue-700'}>Scoring</span>
                            </>
                        )}
                    </span>
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
                        categoryId={parseInt(categoryId || '0')}
                        judgeId={judge.id}
                        onFinish={handleFinish}
                        isDarkMode={isDarkMode}
                        eventParticipantType={category.events.participant_type}
                    />
                ) : (
                    <ScoringTabular
                        categoryId={parseInt(categoryId || '0')}
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
