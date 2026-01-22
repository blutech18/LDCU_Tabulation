import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaArrowRight, FaCalendarAlt } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import type { Judge, Category, Event } from '../../types';

interface CategoryWithEvent extends Category {
    events: Event;
}

interface JudgeContext {
    judge: Judge;
    isDarkMode: boolean;
}

const JudgeLanding = () => {
    const { judge, isDarkMode } = useOutletContext<JudgeContext>();
    const navigate = useNavigate();

    // Skip welcome screen if judge has already visited (e.g., coming back from tabular)
    const hasSeenWelcome = sessionStorage.getItem('judgeWelcomeSeen') === 'true';
    const [showWelcome, setShowWelcome] = useState(!hasSeenWelcome);
    const [categories, setCategories] = useState<CategoryWithEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState(hasSeenWelcome ? 0 : 4); // Skip countdown if already seen

    useEffect(() => {
        if (judge?.id) {
            fetchAssignedCategories();
        }
    }, [judge?.id]);

    // Countdown timer - only auto-proceed if there's exactly 1 category
    useEffect(() => {
        if (showWelcome && countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(countdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0) {
            if (categories.length === 1) {
                // Auto-proceed only if there's exactly 1 category
                handleProceed(categories[0].id);
            } else {
                // Show category list for selection (0 or multiple categories)
                setShowWelcome(false);
            }
        }
    }, [countdown, categories, showWelcome]);

    const fetchAssignedCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('judge_assignments')
                .select(`
                    category_id,
                    categories (
                        id,
                        name,
                        tabular_type,
                        status,
                        event_id,
                        events (
                            id,
                            name,
                            date
                        )
                    )
                `)
                .eq('judge_id', judge.id)
                .eq('is_active', true);

            if (!error && data) {
                const cats = data
                    .filter((item: any) => item.categories)
                    .map((item: any) => ({
                        ...item.categories,
                        events: item.categories.events,
                    })) as CategoryWithEvent[];
                setCategories(cats);
            }
        } catch (err) {
            console.error('Error fetching categories:', err);
        } finally {
            setLoading(false);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const handleProceed = (categoryId: number) => {
        // Mark that welcome has been seen so back navigation skips it
        sessionStorage.setItem('judgeWelcomeSeen', 'true');
        setShowWelcome(false);
        setTimeout(() => {
            navigate(`/judge/tabular/${categoryId}`);
        }, 300);
    };

    const handleSkipWelcome = () => {
        setShowWelcome(false);
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className={`w-16 h-16 border-4 rounded-full ${isDarkMode ? 'border-white/20 border-t-gold' : 'border-maroon/20 border-t-maroon'}`}
                />
            </div>
        );
    }

    // Welcome Screen
    if (showWelcome) {
        return (
            <motion.div
                key="welcome"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                className={`min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 ${isDarkMode ? '' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}
            >
                <div className="text-center max-w-2xl">
                    {/* LDCU Logo */}
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', delay: 0.2, stiffness: 150 }}
                        className="mb-8"
                    >
                        <img
                            src="/ldcu-logo.png"
                            alt="LDCU Logo"
                            className="w-28 h-28 mx-auto object-contain"
                        />
                    </motion.div>

                    {/* Greeting */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className={isDarkMode ? 'text-white/60 text-xl mb-2' : 'text-gray-600 text-xl mb-2'}
                    >
                        {getGreeting()},
                    </motion.p>

                    {/* Judge Title and Name with Wave */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="mb-4"
                    >
                        <div className="flex items-center justify-center gap-4 mb-2">
                            <h1 className={`text-4xl md:text-5xl font-bold ${isDarkMode ? 'text-white' : 'text-maroon'}`}>
                                {judge?.title ? `${judge.title} ` : ''}{judge?.name}
                            </h1>
                            <motion.span
                                animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
                                className="text-4xl"
                            >
                                👋
                            </motion.span>
                        </div>
                        {judge?.affiliation && (
                            <p className={isDarkMode ? 'text-white/40 text-sm' : 'text-gray-500 text-sm'}>{judge.affiliation}</p>
                        )}
                    </motion.div>

                    {/* Welcome message */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className={isDarkMode ? 'text-white/50 text-lg mb-8' : 'text-gray-600 text-lg mb-8'}
                    >
                        Welcome to the LDCU Tabulation System
                    </motion.p>

                    {/* Category info or message */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className={isDarkMode ? 'bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10 mb-8' : 'bg-white rounded-2xl p-6 border border-gray-200 shadow-lg mb-8'}
                    >
                        {categories.length > 0 ? (
                            <>
                                <p className={isDarkMode ? 'text-white/60 text-sm mb-2' : 'text-gray-600 text-sm mb-2'}>You will be judging</p>
                                <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-gold' : 'text-maroon'}`}>
                                    {categories[0].name}
                                </h2>
                                <div className="flex items-center justify-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${categories[0].tabular_type === 'ranking'
                                        ? isDarkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                                        : isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {categories[0].tabular_type === 'ranking' ? 'Ranking-Based' : 'Scoring-Based'}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className={isDarkMode ? 'text-white/60 text-sm mb-2' : 'text-gray-600 text-sm mb-2'}>Status</p>
                                <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                                    Waiting for category assignment...
                                </h2>
                            </>
                        )}
                    </motion.div>

                    {/* Countdown */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-white/10 border-2 border-gold' : 'bg-gradient-to-br from-gold-light to-gold border-2 border-gold-dark shadow-gold'}`}>
                            <span className={`text-3xl font-bold ${isDarkMode ? 'text-gold' : 'text-maroon'}`}>{countdown}</span>
                        </div>
                        <p className={isDarkMode ? 'text-white/40 text-sm' : 'text-gray-500 text-sm'}>
                            {categories.length > 0 ? `Starting in ${countdown}...` : 'Loading...'}
                        </p>

                        {/* Manual proceed button */}
                        {categories.length > 0 && (
                            <button
                                onClick={() => handleProceed(categories[0].id)}
                                className="mt-4 flex items-center gap-2 px-6 py-3 bg-maroon text-white font-medium rounded-xl hover:bg-maroon-dark transition-colors shadow-lg shadow-maroon/25"
                            >
                                Start Now
                                <FaArrowRight className="w-4 h-4" />
                            </button>
                        )}
                    </motion.div>
                </div>
            </motion.div>
        );
    }

    // After welcome - show category list (if no auto-proceed happened)
    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-8"
            >
                <h1 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-maroon'}`}>
                    {categories.length > 0 ? 'Available Categories' : 'No Categories Assigned'}
                </h1>
                <p className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>
                    {categories.length > 0
                        ? 'Select a category to start judging'
                        : 'Please contact the event administrator to get assigned to categories.'}
                </p>
            </motion.div>

            {categories.length > 0 && (
                <div className="grid gap-4">
                    {categories.map((category, index) => (
                        <motion.div
                            key={category.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            onClick={() => handleProceed(category.id)}
                            className={`rounded-xl p-5 border cursor-pointer transition-all group ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border-white/10 hover:bg-white/15 hover:border-gold/30' : 'bg-white border-gray-200 hover:border-maroon hover:shadow-lg'}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${isDarkMode ? 'bg-maroon/20' : 'bg-gradient-to-br from-maroon to-maroon-dark'}`}>
                                        <FaCalendarAlt className="w-5 h-5 text-gold" />
                                    </div>
                                    <div>
                                        <h3 className={`text-lg font-semibold transition-colors ${isDarkMode ? 'text-white group-hover:text-gold' : 'text-gray-900 group-hover:text-maroon'}`}>
                                            {category.name}
                                        </h3>
                                        <p className={isDarkMode ? 'text-white/50 text-sm' : 'text-gray-500 text-sm'}>
                                            {category.events?.name}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${category.tabular_type === 'ranking'
                                        ? isDarkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                                        : isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {category.tabular_type === 'ranking' ? 'Ranking' : 'Scoring'}
                                    </span>
                                    <FaArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition-all ${isDarkMode ? 'text-white/40 group-hover:text-gold' : 'text-gray-400 group-hover:text-maroon'}`} />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default JudgeLanding;
