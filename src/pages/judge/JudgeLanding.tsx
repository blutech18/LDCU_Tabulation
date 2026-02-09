import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowRight, FaCalendarAlt, FaTrophy, FaTable, FaCheckCircle } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import type { Judge, Category, Event } from '../../types';

interface CategoryWithEvent extends Category {
    events: Event;
    is_completed?: boolean;
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
                // Fetch locked scores to determine completion status
                const { data: lockedData } = await supabase
                    .from('scores')
                    .select('criteria!inner(category_id)')
                    .eq('judge_id', judge.id)
                    .not('submitted_at', 'is', null);

                const completedCategoryIds = new Set(
                    lockedData?.map((item: any) => item.criteria?.category_id) || []
                );

                const cats = data
                    .filter((item: any) => item.categories)
                    .map((item: any) => ({
                        ...item.categories,
                        events: item.categories.events,
                        is_completed: completedCategoryIds.has(item.categories.id)
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
        navigate(`/judge/tabular/${categoryId}`);
    };



    // Loading state
    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-8"
                >
                    <h2 className={`text-3xl font-bold mb-2 transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-maroon'}`}>
                        Available Categories
                    </h2>
                    <p className={`transition-colors duration-500 ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                        Select a category to start judging
                    </p>
                </motion.div>
            </div>
        );
    }

    // Welcome Screen
    if (showWelcome) {
        return (
            <div className={`min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 md:p-12 transition-colors duration-500 ${isDarkMode ? '' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
                <motion.div
                    key="welcome-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-7xl mx-auto"
                >
                    {/* Background Logo Watermark - Adjusted for new layout */}
                    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] opacity-[0.03] pointer-events-none z-0">
                        <img src="/ldcu-logo.png" alt="" className="w-full h-full object-contain" />
                    </div>

                    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-12 lg:gap-24">

                        {/* LEFT COLUMN: Text & Actions */}
                        <div className="flex-1 text-center lg:text-left order-2 lg:order-1 max-w-2xl">
                            <motion.div
                                initial="hidden"
                                animate="visible"
                                variants={{
                                    hidden: { opacity: 0 },
                                    visible: {
                                        opacity: 1,
                                        transition: {
                                            staggerChildren: 0.15,
                                            delayChildren: 0.2
                                        }
                                    }
                                }}
                            >
                                <motion.h1
                                    variants={{
                                        hidden: { opacity: 0, x: 50 },
                                        visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: "easeOut" } }
                                    }}
                                    className={`text-5xl lg:text-7xl font-bold mb-4 leading-tight transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                                >
                                    Hello, <br />
                                    <span className="text-maroon dark:text-gold transition-colors duration-500">{judge?.name}</span>
                                </motion.h1>

                                <motion.p
                                    variants={{
                                        hidden: { opacity: 0, x: 50 },
                                        visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: "easeOut" } }
                                    }}
                                    className={`text-xl lg:text-2xl font-light mb-10 transition-colors duration-500 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}
                                >
                                    {getGreeting()}
                                </motion.p>

                                {/* Assignment Status - Formal Design */}
                                <motion.div
                                    variants={{
                                        hidden: { opacity: 0, x: 50 },
                                        visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: "easeOut" } }
                                    }}
                                    className="mb-8 w-full max-w-lg mx-auto lg:mx-0"
                                >
                                    {categories.length > 0 ? (
                                        <div className={`rounded-2xl p-6 transition-colors duration-500 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200 shadow-sm'}`}>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div>
                                                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 transition-colors duration-500 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>
                                                        Event
                                                    </p>
                                                    <p className={`font-bold text-xl truncate transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                        {categories[0].events?.name || 'Unknown Event'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className={`font-bold text-xl truncate transition-colors duration-500 ${isDarkMode ? 'text-gold' : 'text-maroon'}`}>
                                                        {categories.length === 1 ? categories[0].name : `${categories.length} Criteria`}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`rounded-2xl p-6 text-center ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                                            <p className={isDarkMode ? 'text-white/50' : 'text-gray-500'}>
                                                Waiting for category assignment...
                                            </p>
                                        </div>
                                    )}
                                </motion.div>

                                {/* Primary Action */}
                                {categories.length > 0 && (
                                    <motion.button
                                        variants={{
                                            hidden: { opacity: 0, x: 50 },
                                            visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: "easeOut" } }
                                        }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => categories.length === 1 ? handleProceed(categories[0].id) : setShowWelcome(false)}
                                        className="w-full max-w-lg px-8 py-4 bg-maroon text-white text-lg font-bold rounded-xl shadow-lg shadow-maroon/20 hover:bg-maroon-dark hover:shadow-maroon/40 transition-all flex items-center justify-between mx-auto lg:mx-0 group"
                                    >
                                        <span>{categories.length === 1 ? 'Proceed to Judging' : 'View Assignments'}</span>
                                        <div className="bg-white/20 p-2 rounded-lg group-hover:bg-white/30 transition-colors">
                                            <FaArrowRight className="w-4 h-4" />
                                        </div>
                                    </motion.button>
                                )}
                            </motion.div>
                        </div>

                        {/* RIGHT COLUMN: Maximized Profile Image */}
                        <div className="order-1 lg:order-2">
                            <motion.div
                                initial={{ x: 50, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.1, duration: 0.8, ease: "easeOut" }}
                                className="relative"
                            >
                                {/* Decorative Rings */}
                                <div className={`absolute inset-0 rounded-full border-2 border-dashed animate-[spin_10s_linear_infinite] transition-colors duration-500 ${isDarkMode ? 'border-white' : 'border-maroon'}`} />
                                <div className={`absolute -inset-4 rounded-full border border-solid transition-colors duration-500 ${isDarkMode ? 'border-white' : 'border-maroon'}`} />

                                {/* Main Image Container */}
                                <div className={`w-64 h-64 lg:w-96 lg:h-96 rounded-full p-2 transition-all duration-500 ${isDarkMode ? 'bg-white/5 backdrop-blur-sm border-2 border-white' : 'bg-white shadow-2xl border-2 border-maroon'}`}>
                                    <div className="w-full h-full rounded-full overflow-hidden relative">
                                        {judge?.photo_url ? (
                                            <img
                                                src={judge.photo_url}
                                                alt={judge.name}
                                                className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-700"
                                            />
                                        ) : (
                                            <div className={`w-full h-full flex items-center justify-center transition-all duration-500 ${isDarkMode ? 'bg-gradient-to-br from-white/10 to-white/5' : 'bg-gradient-to-br from-gray-50 to-white'}`}>
                                                <span className={`text-7xl font-bold transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-maroon'}`}>
                                                    {judge?.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        )}

                                        {/* Glass Overlay Effect */}
                                        <div className="absolute inset-0 bg-gradient-to-tr from-maroon/10 to-transparent pointer-events-none" />
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            </div>
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
                <h1 className={`text-3xl font-bold mb-2 transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-maroon'}`}>
                    {categories.length > 0 ? 'Available Categories' : 'No Categories Assigned'}
                </h1>
                <p className={`transition-colors duration-500 ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
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
                            className={`rounded-xl p-5 border cursor-pointer transition-all duration-500 group ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border-white/10 hover:bg-white/15 hover:border-gold/30' : 'bg-white border-gray-200 hover:border-maroon hover:shadow-lg'}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md transition-all duration-500 ${isDarkMode ? 'bg-maroon/20' : 'bg-gradient-to-br from-maroon to-maroon-dark'}`}>
                                        <FaCalendarAlt className="w-5 h-5 text-gold" />
                                    </div>
                                    <div>
                                        <h3 className={`text-lg font-semibold transition-colors duration-500 ${isDarkMode ? 'text-white group-hover:text-gold' : 'text-gray-900 group-hover:text-maroon'}`}>
                                            {category.name}
                                        </h3>
                                        <p className={`text-sm transition-colors duration-500 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                                            {category.events?.name}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {category.is_completed && (
                                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-500 ${isDarkMode ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                                            <FaCheckCircle className="w-3.5 h-3.5" />
                                            Submitted
                                        </span>
                                    )}
                                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-500 ${isDarkMode ? 'bg-maroon/90 text-white border border-maroon' : 'bg-maroon text-white border border-maroon-dark'}`}>
                                        {category.tabular_type === 'ranking' ? (
                                            <>
                                                <FaTrophy className="w-3.5 h-3.5 text-gold" />
                                                Ranking
                                            </>
                                        ) : (
                                            <>
                                                <FaTable className="w-3.5 h-3.5 text-gold" />
                                                Scoring
                                            </>
                                        )}
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
