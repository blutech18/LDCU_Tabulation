import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaCalendarAlt, FaGavel, FaUsers, FaTrophy, FaPlus, FaArrowRight } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import StatsCard from '../../components/admin/StatsCard';
import type { Event, Category, StatsData } from '../../types';

const Dashboard = () => {
    const [stats, setStats] = useState<StatsData>({ events: 0, categories: 0, judges: 0, participants: 0 });
    const [recentEvents, setRecentEvents] = useState<Event[]>([]);
    const [recentCategories, setRecentCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [eventsRes, categoriesRes, judgesRes, contestantsRes] = await Promise.all([
                supabase.from('events').select('*', { count: 'exact' }),
                supabase.from('categories').select('*', { count: 'exact' }),
                supabase.from('judges').select('*', { count: 'exact' }),
                supabase.from('participants').select('*', { count: 'exact' }),
            ]);

            setStats({
                events: eventsRes.count || 0,
                categories: categoriesRes.count || 0,
                judges: judgesRes.count || 0,
                participants: contestantsRes.count || 0,
            });

            const { data: events } = await supabase
                .from('events')
                .select('*')
                .order('date', { ascending: false })
                .limit(5);
            setRecentEvents((events as Event[]) || []);

            const { data: categories } = await supabase
                .from('categories')
                .select('*, events(name)')
                .order('created_at', { ascending: false })
                .limit(5);
            setRecentCategories((categories as Category[]) || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 mt-1">Welcome to the LDCU Tabulation System</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    icon={<FaCalendarAlt className="w-6 h-6" />}
                    label="Events"
                    value={stats.events}
                    color="primary"
                    delay={0}
                />
                <StatsCard
                    icon={<FaTrophy className="w-6 h-6" />}
                    label="Categories"
                    value={stats.categories}
                    color="accent"
                    delay={0.1}
                />
                <StatsCard
                    icon={<FaGavel className="w-6 h-6" />}
                    label="Judges"
                    value={stats.judges}
                    color="success"
                    delay={0.2}
                />
                <StatsCard
                    icon={<FaUsers className="w-6 h-6" />}
                    label="Participants"
                    value={stats.participants}
                    color="warning"
                    delay={0.3}
                />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Events */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <FaCalendarAlt className="text-primary-500" />
                            Recent Events
                        </h3>
                        <Link
                            to="/admin/events"
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                        >
                            View All <FaArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="p-6">
                        {recentEvents.length === 0 ? (
                            <div className="text-center py-8">
                                <FaCalendarAlt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No events yet</p>
                                <Link
                                    to="/admin/events"
                                    className="inline-flex items-center gap-2 mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
                                >
                                    <FaPlus className="w-3 h-3" /> Create your first event
                                </Link>
                            </div>
                        ) : (
                            <ul className="space-y-3">
                                {recentEvents.map((event) => (
                                    <li
                                        key={event.id}
                                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                                    >
                                        <div>
                                            <p className="font-medium text-gray-900">{event.name}</p>
                                            <p className="text-sm text-gray-500">
                                                {new Date(event.date).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                })}
                                            </p>
                                        </div>
                                        <span
                                            className={`badge ${event.participant_type === 'group' ? 'bg-accent-100 text-accent-700' : 'bg-primary-100 text-primary-700'
                                                }`}
                                        >
                                            {event.participant_type || 'individual'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </motion.div>

                {/* Recent Categories */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <FaTrophy className="text-accent-500" />
                            Recent Categories
                        </h3>
                        <Link
                            to="/admin/events"
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                        >
                            View All <FaArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="p-6">
                        {recentCategories.length === 0 ? (
                            <div className="text-center py-8">
                                <FaTrophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No categories found</p>
                            </div>
                        ) : (
                            <ul className="space-y-3">
                                {recentCategories.map((category) => (
                                    <li
                                        key={category.id}
                                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                                    >
                                        <div>
                                            <p className="font-medium text-gray-900">{category.name}</p>
                                            <p className="text-sm text-gray-500">{(category as any).events?.name}</p>
                                        </div>
                                        <span className="badge bg-gray-100 text-gray-600">
                                            {category.tabular_type}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Dashboard;
