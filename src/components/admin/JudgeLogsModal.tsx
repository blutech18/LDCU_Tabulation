import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaTable, FaTrophy, FaHistory, FaEye, FaUserTie } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import type { Judge, JudgeActivityLog } from '../../types';

interface JudgeLogsModalProps {
    isOpen: boolean;
    onClose: () => void;
    judge: Judge | null;
}

const JudgeLogsModal = ({ isOpen, onClose, judge }: JudgeLogsModalProps) => {
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<JudgeActivityLog[]>([]);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState<JudgeActivityLog | null>(null);

    useEffect(() => {
        if (isOpen && judge) {
            fetchLogs();
        }
    }, [isOpen, judge]);

    const fetchLogs = async () => {
        if (!judge) return;

        setLoading(true);
        try {
            // Fetch only submit logs for this judge with category info
            const { data, error } = await supabase
                .from('judge_activity_logs')
                .select(`
                    *,
                    categories (
                        id,
                        name,
                        tabular_type,
                        event_id
                    )
                `)
                .eq('judge_id', judge.id)
                .eq('action', 'submit')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const mainModal = createPortal(
        <AnimatePresence>
            {isOpen && judge && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[60vh] min-h-[400px] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-maroon to-maroon-dark">
                            <div className="flex items-center gap-3">
                                <FaHistory className="w-5 h-5 text-white" />
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Submission History</h2>
                                    <p className="text-sm text-white/90 font-medium">{judge.name}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <FaTimes className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto bg-gray-50">
                            {loading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="w-8 h-8 border-4 border-maroon/20 border-t-maroon rounded-full animate-spin" />
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <FaHistory className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500 text-lg">No submissions yet</p>
                                    </div>
                                </div>
                            ) : (
                                <table className="w-full border-collapse">
                                    <thead className="sticky top-0 bg-white shadow-sm z-10">
                                        <tr className="border-b-2 border-gray-200">
                                            <th className="px-4 py-3 text-center text-xs md:text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 w-40">Date & Time</th>
                                            <th className="px-4 py-3 text-center text-xs md:text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">Category</th>
                                            <th className="px-4 py-3 text-center text-xs md:text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">Description</th>
                                            <th className="px-4 py-3 text-center text-xs md:text-sm font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 w-32">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {logs.map((log: any, index) => (
                                            <tr
                                                key={log.id}
                                                className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                                                    }`}
                                            >
                                                {/* Date & Time */}
                                                <td className="px-4 py-3 whitespace-nowrap align-middle text-center">
                                                    <div className="text-sm md:text-base font-medium text-gray-900">{new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                    <div className="text-xs md:text-sm text-gray-500">{new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                                                </td>

                                                {/* Category */}
                                                <td className="px-4 py-3 align-middle">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="min-w-0 text-center">
                                                            <div className="text-sm md:text-base font-medium text-gray-900 truncate">{log.categories?.name || 'Unknown'}</div>
                                                            <div className="text-xs md:text-sm text-gray-500 capitalize">{log.categories?.tabular_type || 'scoring'}</div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Description */}
                                                <td className="px-4 py-3 text-sm md:text-base text-gray-700 align-middle text-center">
                                                    {log.description}
                                                </td>

                                                {/* Action Button */}
                                                <td className="px-4 py-3 text-center align-middle">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedLog(log);
                                                            setDetailsModalOpen(true);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-maroon text-white text-xs md:text-sm font-medium rounded-lg hover:bg-maroon-dark transition-colors whitespace-nowrap"
                                                    >
                                                        <FaEye className="w-3 h-3 md:w-4 md:h-4" />
                                                        View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );

    // Render details modal - shows tabular view of scores/rankings
    const detailsModal = createPortal(
        <AnimatePresence>
            {detailsModalOpen && selectedLog && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={() => setDetailsModalOpen(false)}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden ring-1 ring-white/10"
                    >
                        {/* Premium Header */}
                        {/* Premium Header - Maroon */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between px-6 md:px-8 py-6 bg-gradient-to-r from-maroon to-maroon-dark border-b border-white/10">
                            <div className="mb-4 md:mb-0 flex items-center flex-wrap gap-4">
                                <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                                    {selectedLog.categories?.name || 'Submission Details'}
                                </h3>

                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 backdrop-blur-sm">
                                    <FaHistory className="w-3.5 h-3.5 text-white/70" />
                                    <span className="text-sm font-medium">
                                        {new Date(selectedLog.created_at).toLocaleDateString('en-US', {
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                        <span className="mx-1.5 opacity-30">|</span>
                                        {new Date(selectedLog.created_at).toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => setDetailsModalOpen(false)}
                                className="absolute top-4 right-4 md:static group p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/30 transition-all duration-200"
                            >
                                <FaTimes className="w-5 h-5 md:w-6 md:h-6 text-white/80 group-hover:text-white transition-colors" />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 bg-gray-50/50 flex flex-col overflow-y-auto">
                            <div className="p-4 md:p-8 flex-1 min-h-0">
                                {selectedLog.categories?.tabular_type === 'ranking' ? (
                                    // Ranking View
                                    (() => {
                                        const rankings = selectedLog.metadata?.rankings || [];
                                        const maleRankings = rankings.filter((r: any) => r.participant_gender === 'male').sort((a: any, b: any) => a.rank - b.rank);
                                        const femaleRankings = rankings.filter((r: any) => r.participant_gender === 'female').sort((a: any, b: any) => a.rank - b.rank);

                                        const RankingCard = ({ item, index }: { item: any, index: number }) => {
                                            const isTop3 = item.rank <= 3;
                                            const rankColors = {
                                                1: 'bg-gradient-to-br from-yellow-50 to-white border-yellow-200 text-yellow-700 shadow-yellow-100',
                                                2: 'bg-gradient-to-br from-gray-100 via-gray-200 to-white border-gray-300 text-gray-700 shadow-gray-200',
                                                3: 'bg-gradient-to-br from-amber-50 to-white border-amber-200 text-amber-700 shadow-amber-100',
                                                default: 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
                                            };
                                            const badgeColors = {
                                                1: 'bg-yellow-100 text-yellow-800 ring-4 ring-yellow-50',
                                                2: 'bg-gray-200 text-gray-800 ring-4 ring-gray-100',
                                                3: 'bg-amber-100 text-amber-800 ring-4 ring-amber-50',
                                                default: 'bg-gray-50 text-gray-500'
                                            };

                                            const style = isTop3 ? rankColors[item.rank as 1 | 2 | 3] : rankColors.default;
                                            const badgeStyle = isTop3 ? badgeColors[item.rank as 1 | 2 | 3] : badgeColors.default;

                                            return (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className={`relative flex items-center p-4 rounded-xl border-2 shadow-sm transition-all duration-300 ${style}`}
                                                >
                                                    <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-xl mr-4 flex-shrink-0 ${badgeStyle}`}>
                                                        {item.rank}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-gray-900 truncate text-lg">
                                                            {item.participant_name}
                                                        </h4>
                                                        <p className="text-sm text-gray-500 font-medium truncate">
                                                            {item.participant_department || 'No Department'}
                                                        </p>
                                                    </div>
                                                    {isTop3 && (
                                                        <div className="absolute top-0 right-0 p-3 opacity-10">
                                                            <FaTrophy className="w-16 h-16 transform rotate-12" />
                                                        </div>
                                                    )}
                                                </motion.div>
                                            );
                                        };

                                        // If no gender data/all grouped
                                        if (maleRankings.length === 0 && femaleRankings.length === 0) {
                                            const allRankings = rankings.sort((a: any, b: any) => a.rank - b.rank);
                                            return (
                                                <div className="max-w-3xl mx-auto w-full">
                                                    <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200 pb-4 mb-2 pt-2 flex items-center gap-3">
                                                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                                            <FaTrophy className="w-5 h-5" />
                                                        </div>
                                                        <h4 className="text-lg font-bold text-gray-900">Final Rankings</h4>
                                                    </div>
                                                    <div className="grid gap-3">
                                                        {allRankings.map((item: any, idx: number) => (
                                                            <RankingCard key={idx} item={item} index={idx} />
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="grid lg:grid-cols-2 gap-8 items-start">
                                                {/* Male Rankings */}
                                                <div className="flex flex-col border border-gray-100 rounded-2xl bg-white shadow-sm lg:shadow-none lg:border-0 lg:bg-transparent">
                                                    {/* Scroll Container */}
                                                    <div className="flex-1 lg:pr-2 min-h-0 relative">
                                                        {/* Sticky Header Inside Scroll */}
                                                        <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200 py-3 flex items-center justify-center mb-2">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                                                                    <span className="text-lg font-bold leading-none">♂</span>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-base font-bold text-gray-900 uppercase tracking-wide">Male Category</h4>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-3 p-2 pt-0">
                                                            {maleRankings.map((item: any, idx: number) => (
                                                                <RankingCard key={idx} item={item} index={idx} />
                                                            ))}
                                                            {maleRankings.length === 0 && (
                                                                <div className="text-center py-12 flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/30">
                                                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-gray-300">
                                                                        <FaUserTie className="w-5 h-5" />
                                                                    </div>
                                                                    <p className="text-gray-400 font-medium">No male participants</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Female Rankings */}
                                                <div className="flex flex-col border border-gray-100 rounded-2xl bg-white shadow-sm lg:shadow-none lg:border-0 lg:bg-transparent">
                                                    {/* Scroll Container */}
                                                    <div className="flex-1 lg:pr-2 min-h-0 relative">
                                                        {/* Sticky Header Inside Scroll */}
                                                        <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200 py-3 flex items-center justify-center mb-2">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center shadow-sm">
                                                                    <span className="text-lg font-bold leading-none">♀</span>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-base font-bold text-gray-900 uppercase tracking-wide">Female Category</h4>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-3 p-2 pt-0">
                                                            {femaleRankings.map((item: any, idx: number) => (
                                                                <RankingCard key={idx} item={item} index={idx} />
                                                            ))}
                                                            {femaleRankings.length === 0 && (
                                                                <div className="text-center py-12 flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/30">
                                                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-gray-300">
                                                                        <FaUserTie className="w-5 h-5" />
                                                                    </div>
                                                                    <p className="text-gray-400 font-medium">No female participants</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()
                                ) : (
                                    // Scoring View
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                                    <FaTable className="w-5 h-5" />
                                                </div>
                                                <h4 className="text-lg font-bold text-gray-900">Detailed Scores</h4>
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-gray-100 bg-gray-50/50">
                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-1/4">
                                                            Participant
                                                        </th>
                                                        {selectedLog.metadata?.criteria?.map((c: any) => (
                                                            <th key={c.id} className="px-4 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span>{c.name}</span>
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-normal">
                                                                        {c.min_score}-{c.max_score}
                                                                    </span>
                                                                </div>
                                                            </th>
                                                        ))}
                                                        <th className="px-6 py-4 text-center text-xs font-bold text-maroon uppercase tracking-wider bg-maroon/5 w-32 border-l border-red-50">
                                                            Total Score
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {selectedLog.metadata?.scores?.sort((a: any, b: any) => b.total_score - a.total_score).map((item: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-gray-900 text-base">{item.participant_name}</span>
                                                                    <span className="text-sm text-gray-400 font-medium">{item.participant_department || 'No Department'}</span>
                                                                </div>
                                                            </td>
                                                            {selectedLog.metadata?.criteria?.map((c: any) => (
                                                                <td key={c.id} className="px-4 py-4 text-center">
                                                                    <div className="inline-flex items-center justify-center min-w-[3rem] h-10 px-3 bg-white border border-gray-200 rounded-lg text-lg font-semibold text-gray-700 shadow-sm">
                                                                        {item.criteria_scores?.[c.name] ?? 0}
                                                                    </div>
                                                                </td>
                                                            ))}
                                                            <td className="px-6 py-4 text-center bg-maroon/5 border-l border-red-50">
                                                                <span className="inline-flex items-center justify-center px-4 py-1.5 bg-gradient-to-r from-maroon to-red-800 text-white rounded-xl text-lg font-bold shadow-md shadow-maroon/20">
                                                                    {item.total_score}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );

    return (
        <>
            {mainModal}
            {detailsModal}
        </>
    );
};

export default JudgeLogsModal;
