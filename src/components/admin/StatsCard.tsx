import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface StatsCardProps {
    icon: ReactNode;
    label: string;
    value: number | string;
    color: 'primary' | 'accent' | 'success' | 'warning';
    delay?: number;
}

const colorClasses = {
    primary: 'from-primary-500 to-primary-600 text-primary-600 bg-primary-50',
    accent: 'from-accent-500 to-accent-600 text-accent-600 bg-accent-50',
    success: 'from-green-500 to-green-600 text-green-600 bg-green-50',
    warning: 'from-orange-500 to-orange-600 text-orange-600 bg-orange-50',
};

const StatsCard = ({ icon, label, value, color, delay = 0 }: StatsCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-300"
        >
            <div className="flex items-center gap-4">
                <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center ${colorClasses[color].split(' ').slice(2).join(' ')
                        }`}
                >
                    <span className={colorClasses[color].split(' ')[2]}>{icon}</span>
                </div>
                <div>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    <p className="text-sm text-gray-500 font-medium">{label}</p>
                </div>
            </div>
        </motion.div>
    );
};

export default StatsCard;
