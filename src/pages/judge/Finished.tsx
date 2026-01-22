import { useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaHome } from 'react-icons/fa';
import type { Judge } from '../../types';

interface JudgeContext {
    judge: Judge;
}

const Finished = () => {
    const navigate = useNavigate();
    const { judge } = useOutletContext<JudgeContext>();

    useEffect(() => {
        // Confetti or celebration effect could be added here
    }, []);

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 to-gray-100">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', duration: 0.6 }}
                className="text-center max-w-md relative z-10"
            >
                {/* Success Icon */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2, stiffness: 200 }}
                    className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-6 shadow-2xl shadow-green-500/40"
                >
                    <FaCheckCircle className="w-12 h-12 text-white" />
                </motion.div>

                {/* Message */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-3xl font-bold text-maroon mb-3"
                >
                    All Done!
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-gray-600 text-lg mb-8"
                >
                    Your scores have been submitted successfully. Thank you, Judge {judge?.name}!
                </motion.p>

                {/* Back Button */}
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    onClick={() => navigate('/judge/panel')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-maroon text-white font-medium rounded-xl hover:bg-maroon-dark transition-colors shadow-lg shadow-maroon/25"
                >
                    <FaHome className="w-4 h-4" />
                    Back to Panel
                </motion.button>

                {/* Decorative elements */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(20)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{
                                opacity: 0,
                                x: Math.random() * 400 - 200,
                                y: -50,
                            }}
                            animate={{
                                opacity: [0, 1, 0],
                                y: 500,
                                rotate: Math.random() * 360,
                            }}
                            transition={{
                                duration: 3,
                                delay: i * 0.1,
                                repeat: Infinity,
                                repeatDelay: 5,
                            }}
                            className="absolute left-1/2 w-3 h-3 rounded-sm"
                            style={{
                                backgroundColor: ['#22c55e', '#10b981', '#14b8a6', '#0ea5e9', '#8b5cf6'][
                                    i % 5
                                ],
                            }}
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default Finished;
