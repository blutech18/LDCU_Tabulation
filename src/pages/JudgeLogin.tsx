import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaKey, FaSun, FaMoon } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores';

const JudgeLogin = () => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('judgeDarkMode');
        return saved === 'true';
    });
    const navigate = useNavigate();
    const { setJudge } = useAuthStore();

    const toggleDarkMode = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        localStorage.setItem('judgeDarkMode', String(newMode));
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { data: judge, error: fetchError } = await supabase
            .from('judges')
            .select('*')
            .eq('code', code.toUpperCase())
            .single();

        if (fetchError || !judge) {
            setError('Invalid access code. Please try again.');
            setLoading(false);
            return;
        }

        // Save judge to store
        setJudge(judge);
        navigate('/judge/panel');
    };

    return (
        <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-gradient-judge' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
            {/* Dark Mode Toggle - Fixed Position */}
            <div className="fixed top-4 right-4 z-50">
                <button
                    onClick={toggleDarkMode}
                    className={`p-3 rounded-full shadow-lg transition-all ${isDarkMode ? 'bg-white/10 backdrop-blur-lg border border-white/20 text-white hover:bg-white/20' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                    title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {isDarkMode ? (
                        <FaSun className="w-5 h-5" />
                    ) : (
                        <FaMoon className="w-5 h-5" />
                    )}
                </button>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md"
            >
                {/* Glass Card */}
                <div className={`rounded-3xl p-8 shadow-2xl ${isDarkMode ? 'bg-white/10 backdrop-blur-xl border border-white/20' : 'bg-white border border-gray-200'}`}>
                    {/* LDCU Logo */}
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.2 }}
                        >
                            <img
                                src="/ldcu-logo.png"
                                alt="LDCU Logo"
                                className="w-20 h-20 mx-auto mb-4 object-contain"
                            />
                        </motion.div>
                        <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-maroon'}`}>Judge Panel</h1>
                        <p className={`mt-1 ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>Enter your access code to continue</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-4 rounded-xl text-sm border ${isDarkMode ? 'bg-red-500/20 text-red-200 border-red-500/30' : 'bg-red-50 text-red-600 border-red-200'}`}
                            >
                                {error}
                            </motion.div>
                        )}

                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                                Access Code
                            </label>
                            <div className="relative">
                                <FaKey className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`} />
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="Enter your code"
                                    className={`w-full px-4 py-3.5 pl-11 rounded-xl uppercase tracking-widest focus:outline-none focus:ring-2 ${isDarkMode ? 'bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:ring-gold/50 focus:border-gold/50' : 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:ring-maroon focus:border-maroon'}`}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-gradient-to-r from-maroon to-maroon-dark text-white font-semibold rounded-xl hover:from-maroon-dark hover:to-maroon transition-all shadow-lg shadow-maroon/25 disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Verifying...
                                </span>
                            ) : (
                                'Enter Panel'
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <p className={`text-center text-sm mt-6 ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}>
                        Don't have a code? Contact the event administrator.
                    </p>
                </div>

                {/* Branding */}
                <p className={`text-center text-sm mt-6 ${isDarkMode ? 'text-white/30' : 'text-gray-500'}`}>
                    LDCU Tabulation System
                </p>
            </motion.div>
        </div>
    );
};

export default JudgeLogin;
