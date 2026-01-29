import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FaSun, FaMoon } from 'react-icons/fa';
import type { Judge } from '../types';

const JudgeLayout = () => {
    const navigate = useNavigate();
    const [judge, setJudge] = useState<Judge | null>(null);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('judgeDarkMode');
        return saved === 'true';
    });

    useEffect(() => {
        const judgeData = localStorage.getItem('judge');
        if (!judgeData) {
            navigate('/judge/login');
            return;
        }
        setJudge(JSON.parse(judgeData));
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('judge');
        navigate('/judge/login');
    };

    const toggleDarkMode = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        localStorage.setItem('judgeDarkMode', String(newMode));
    };

    if (!judge) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900' : 'bg-gray-50'}`}>
                <div className={`w-10 h-10 border-4 ${isDarkMode ? 'border-white/30 border-t-white' : 'border-maroon/30 border-t-maroon'} rounded-full animate-spin`} />
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900' : 'bg-white'}`}>
            {/* Header */}
            <header className={`fixed top-0 left-0 right-0 z-50 shadow-md ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border-b border-white/10' : 'bg-maroon'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md overflow-hidden ${isDarkMode ? 'bg-gradient-to-br from-primary-400 to-accent-500 text-white' : 'bg-white text-maroon'}`}>
                                {judge.photo_url ? (
                                    <img 
                                        src={judge.photo_url} 
                                        alt={judge.name} 
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    judge.name.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div>
                                <p className="text-white font-semibold">
                                    {judge.name}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Dark Mode Toggle */}
                            <button
                                onClick={toggleDarkMode}
                                className={`p-2 rounded-lg transition-colors duration-200 ${isDarkMode ? 'text-white hover:bg-white/10' : 'text-white hover:bg-white/10'}`}
                                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                            >
                                {isDarkMode ? (
                                    <FaSun className="w-5 h-5" />
                                ) : (
                                    <FaMoon className="w-5 h-5" />
                                )}
                            </button>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 text-white hover:bg-white/10 rounded-lg transition-colors duration-200 font-medium"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className={`pt-16 min-h-screen ${isDarkMode ? '' : 'bg-white'}`}>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <Outlet context={{ judge, isDarkMode }} />
                </motion.div>
            </main>
        </div>
    );
};

export default JudgeLayout;
