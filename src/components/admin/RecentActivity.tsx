import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FaFilter } from 'react-icons/fa';
import Modal from '../common/Modal';

export interface LogEntry {
    id: string;
    timestamp: Date;
    type: 'event' | 'category' | 'judge' | 'participant' | 'system';
    action: string;
    details: string;
    preview?: string; // Short version for the container
    status: 'success' | 'warning' | 'error';
}

interface RecentActivityProps {
    items: LogEntry[];
}

const RecentActivity = ({ items }: RecentActivityProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'event' | 'judge' | 'category' | 'participant'>('all');

    const filteredItems = useMemo(() => {
        if (filterType === 'all') return items;
        return items.filter(item => item.type === filterType);
    }, [items, filterType]);

    return (
        <>
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 h-full flex flex-col cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setIsModalOpen(true)}
            >
                <div className="p-6 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">System Logs</h3>
                    <p className="text-sm text-gray-500 mt-1">Click to view detailed history.</p>
                </div>
                
                <div className="flex-1 overflow-auto bg-gray-50/50">
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            No logs available
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {items.map((log) => (
                                <div key={log.id} className="p-4 hover:bg-gray-100 transition-colors flex gap-3 text-sm items-center">
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                        log.status === 'success' ? 'bg-green-400' :
                                        log.status === 'warning' ? 'bg-yellow-400' : 'bg-red-400'
                                    }`} />
                                    <p className="text-gray-600 text-xs truncate">
                                        {log.preview || log.details}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Detailed Logs Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="System Logs History"
                size="4xl"
            >
                <div className="flex flex-col h-[60vh] min-h-[400px]">
                    {/* Filter Controls */}
                    <div className="flex-none pb-4 border-b border-gray-100">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex items-center gap-2 text-gray-500 text-sm font-medium min-w-fit">
                                <FaFilter className="w-3 h-3" />
                                <span>Filter by:</span>
                            </div>
                            <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {['all', 'event', 'judge', 'category', 'participant'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(type as any)}
                                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-center border w-full ${
                                            filterType === type
                                                ? 'bg-maroon text-white border-maroon shadow-sm'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-maroon hover:text-maroon'
                                        }`}
                                    >
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6 -mb-6 pb-6">
                        {filteredItems.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-400 bg-gray-50/50 rounded-lg border border-dashed border-gray-200 m-6">
                                No logs found for this filter
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 -mx-6">
                                {filteredItems.map((log) => (
                                    <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors grid grid-cols-12 gap-4 text-sm bg-white items-center">
                                        {/* Date Column */}
                                        <div className="col-span-2 text-gray-500 font-mono text-xs">
                                            <div className="font-semibold text-gray-700">
                                                {log.timestamp.toLocaleDateString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </div>
                                            <div className="text-gray-400">
                                                {log.timestamp.toLocaleTimeString(undefined, {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </div>
                                        </div>

                                        {/* Type Badge Column */}
                                        <div className="col-span-2 flex justify-center">
                                            <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider w-full text-center border ${
                                                log.type === 'event' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                log.type === 'category' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                log.type === 'judge' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                log.type === 'participant' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                'bg-gray-50 text-gray-700 border-gray-100'
                                            }`}>
                                                {log.type}
                                            </span>
                                        </div>

                                        {/* Details Column */}
                                        <div className="col-span-7 min-w-0">
                                            <div className="font-medium text-gray-900 truncate mb-0.5">
                                                {log.action}
                                            </div>
                                            <p className="text-gray-500 text-xs truncate">
                                                {log.details}
                                            </p>
                                        </div>

                                        {/* Status Column */}
                                        <div className="col-span-1 flex justify-end">
                                            <div className={`w-2.5 h-2.5 rounded-full ring-4 ring-opacity-20 ${
                                                log.status === 'success' ? 'bg-green-500 ring-green-500' :
                                                log.status === 'warning' ? 'bg-yellow-500 ring-yellow-500' : 'bg-red-500 ring-red-500'
                                            }`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default RecentActivity;
