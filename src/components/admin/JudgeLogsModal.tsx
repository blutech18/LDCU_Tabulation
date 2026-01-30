import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaTable, FaTrophy, FaHistory, FaEye } from 'react-icons/fa';
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
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-maroon to-maroon-dark">
                            <div className="flex items-center gap-3">
                                <FaHistory className="w-5 h-5 text-white" />
                                <div>
                                    <h2 className="text-xl font-bold text-white">Submission History</h2>
                                    <p className="text-sm text-white/80">{judge.name}</p>
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
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 w-40">Date & Time</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">Category</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">Description</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 w-32">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {logs.map((log: any, index) => (
                                            <tr 
                                                key={log.id}
                                                className={`hover:bg-gray-50 transition-colors ${
                                                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                                                }`}
                                            >
                                                {/* Date & Time */}
                                                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap align-middle text-center">
                                                    <div className="font-medium">{new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                    <div className="text-xs text-gray-500">{new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                                                </td>

                                                {/* Category */}
                                                <td className="px-4 py-3 align-middle">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="min-w-0 text-center">
                                                            <div className="text-sm text-gray-900 font-medium truncate">{log.categories?.name || 'Unknown'}</div>
                                                            <div className="text-xs text-gray-500 capitalize">{log.categories?.tabular_type || 'scoring'}</div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Description */}
                                                <td className="px-4 py-3 text-sm text-gray-700 align-middle text-center">
                                                    {log.description}
                                                </td>

                                                {/* Action Button */}
                                                <td className="px-4 py-3 text-center align-middle">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedLog(log);
                                                            setDetailsModalOpen(true);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-maroon text-white text-xs font-medium rounded-lg hover:bg-maroon-dark transition-colors whitespace-nowrap"
                                                    >
                                                        <FaEye className="w-3 h-3" />
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
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={() => setDetailsModalOpen(false)}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-maroon to-maroon-dark">
                            <div>
                                <h3 className="text-lg font-bold text-white">{selectedLog.categories?.name || 'Submission Details'}</h3>
                                <p className="text-sm text-white/80">
                                    {new Date(selectedLog.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    {selectedLog.metadata?.gender && ` • ${selectedLog.metadata.gender === 'male' ? 'Male' : 'Female'}`}
                                </p>
                            </div>
                            <button
                                onClick={() => setDetailsModalOpen(false)}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <FaTimes className="w-4 h-4 text-white" />
                            </button>
                        </div>

                        {/* Content - Tabular View */}
                        <div className="flex-1 overflow-auto p-4">
                            {selectedLog.categories?.tabular_type === 'ranking' ? (
                                // Ranking View - Always show two columns for Male and Female
                                (() => {
                                    const rankings = selectedLog.metadata?.rankings || [];
                                    const maleRankings = rankings.filter((r: any) => r.participant_gender === 'male').sort((a: any, b: any) => a.rank - b.rank);
                                    const femaleRankings = rankings.filter((r: any) => r.participant_gender === 'female').sort((a: any, b: any) => a.rank - b.rank);
                                    
                                    // If no gender data at all, show all rankings in single column (for group events or old data)
                                    if (maleRankings.length === 0 && femaleRankings.length === 0) {
                                        const allRankings = rankings.sort((a: any, b: any) => a.rank - b.rank);
                                        return (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <FaTrophy className="w-5 h-5 text-amber-500" />
                                                    <span className="font-semibold text-gray-700">Rankings</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {allRankings.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0 ${
                                                                item.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                                                item.rank === 2 ? 'bg-gray-200 text-gray-700' :
                                                                item.rank === 3 ? 'bg-amber-100 text-amber-700' :
                                                                'bg-gray-100 text-gray-600'
                                                            }`}>
                                                                {item.rank}
                                                            </span>
                                                            <div>
                                                                <span className="font-medium text-gray-900">{item.participant_department || '-'}</span>
                                                                <span className="text-gray-400 text-sm ml-2">{item.participant_name}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }
                                    
                                    // Two column layout for Male and Female (always show both columns)
                                    return (
                                        <div className="grid grid-cols-2 gap-6">
                                            {/* Male Column */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                                                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                                        <span className="text-sm font-bold">♂</span>
                                                    </div>
                                                    <span className="font-semibold text-gray-700">Male</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {maleRankings.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50/50">
                                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0 ${
                                                                item.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                                                item.rank === 2 ? 'bg-gray-200 text-gray-700' :
                                                                item.rank === 3 ? 'bg-amber-100 text-amber-700' :
                                                                'bg-gray-100 text-gray-600'
                                                            }`}>
                                                                {item.rank}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <div className="font-medium text-gray-900">{item.participant_department || '-'}</div>
                                                                <div className="text-gray-400 text-sm">{item.participant_name}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {maleRankings.length === 0 && (
                                                        <p className="text-gray-400 text-sm italic py-4 text-center">No male participants</p>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Female Column */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                                                    <div className="w-7 h-7 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center">
                                                        <span className="text-sm font-bold">♀</span>
                                                    </div>
                                                    <span className="font-semibold text-gray-700">Female</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {femaleRankings.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-pink-50/50">
                                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0 ${
                                                                item.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                                                item.rank === 2 ? 'bg-gray-200 text-gray-700' :
                                                                item.rank === 3 ? 'bg-amber-100 text-amber-700' :
                                                                'bg-gray-100 text-gray-600'
                                                            }`}>
                                                                {item.rank}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <div className="font-medium text-gray-900">{item.participant_department || '-'}</div>
                                                                <div className="text-gray-400 text-sm">{item.participant_name}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {femaleRankings.length === 0 && (
                                                        <p className="text-gray-400 text-sm italic py-4 text-center">No female participants</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : (
                                // Scoring View
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 mb-4">
                                        <FaTable className="w-5 h-5 text-blue-500" />
                                        <span className="font-semibold text-gray-700">Scores</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse min-w-[600px]">
                                            <thead>
                                                <tr className="border-b-2 border-gray-200">
                                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Participant</th>
                                                    {selectedLog.metadata?.criteria?.map((c: any) => (
                                                        <th key={c.id} className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">
                                                            {c.name}
                                                            <div className="text-[10px] text-gray-400 font-normal">({c.min_score}-{c.max_score})</div>
                                                        </th>
                                                    ))}
                                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase bg-maroon/5">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {selectedLog.metadata?.scores?.sort((a: any, b: any) => b.total_score - a.total_score).map((item: any, idx: number) => (
                                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-gray-900">{item.participant_name}</div>
                                                            <div className="text-xs text-gray-500">{item.participant_department || '-'}</div>
                                                        </td>
                                                        {selectedLog.metadata?.criteria?.map((c: any) => (
                                                            <td key={c.id} className="px-3 py-3 text-center">
                                                                <span className="inline-flex items-center justify-center w-12 h-8 bg-gray-100 rounded text-sm font-medium text-gray-700">
                                                                    {item.criteria_scores?.[c.name] ?? 0}
                                                                </span>
                                                            </td>
                                                        ))}
                                                        <td className="px-4 py-3 text-center bg-maroon/5">
                                                            <span className="inline-flex items-center justify-center px-3 py-1 bg-maroon text-white rounded-lg text-sm font-bold">
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
