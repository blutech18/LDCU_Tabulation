import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface StatsCardProps {
    icon: ReactNode;
    label: string;
    value: number | string;
    color: 'primary' | 'accent' | 'success' | 'warning';
    delay?: number;
    subtext?: string;
}

const colorClasses = {
    primary: 'text-primary-600',
    accent: 'text-accent-600',
    success: 'text-green-600',
    warning: 'text-orange-600',
};

const StatsCard = ({ icon, label, value, color, delay = 0, subtext }: StatsCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-300 flex flex-col justify-between h-full"
        >
            <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <div className={`${colorClasses[color]}`}>
                    {icon}
                </div>
            </div>
            
            <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
                {subtext && (
                    <p className="text-xs text-gray-400">{subtext}</p>
                )}
                {!subtext && (
                    <p className="text-xs text-gray-400">+0% from last month</p>
                )}
            </div>
        </motion.div>
    );
};

export default StatsCard;
