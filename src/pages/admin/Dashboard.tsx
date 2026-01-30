import { useState, useEffect } from 'react';
import { FaCalendarAlt, FaGavel, FaUsers, FaTrophy, FaDownload } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import StatsCard from '../../components/admin/StatsCard';
import DashboardCharts from '../../components/admin/DashboardCharts';
import RecentActivity, { LogEntry } from '../../components/admin/RecentActivity';
import type { StatsData } from '../../types';

const Dashboard = () => {
    const [stats, setStats] = useState<StatsData>({ events: 0, categories: 0, judges: 0, participants: 0 });
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [chartData, setChartData] = useState<{
        events: { name: string; participantsCount: number }[];
    }>({ events: [] });
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

            // Fetch data for charts and logs
            const { data: allEvents } = await supabase.from('events').select('*');
            const { data: allCategories } = await supabase.from('categories').select('*, events(name)');
            const { data: allJudges } = await supabase.from('judges').select('*, events(name)');
            const { data: allParticipants } = await supabase.from('participants').select('*, events(name)');

            if (allEvents) {
                // Process Events Participation for Charts
                const eventsChartData = allEvents.map(event => ({
                    name: event.name,
                    participantsCount: (allParticipants || []).filter(p => p.event_id === event.id).length
                })).sort((a, b) => b.participantsCount - a.participantsCount).slice(0, 10);

                setChartData({ events: eventsChartData });
            }

            // Generate System Logs from data
            const systemLogs: LogEntry[] = [];

            allEvents?.forEach(e => systemLogs.push({
                id: `evt-${e.id}`,
                timestamp: new Date(e.created_at),
                type: 'event',
                action: 'Event Created',
                details: `Event "${e.name}" was created.`,
                preview: `Event "${e.name}" created.`,
                status: 'success'
            }));

            allCategories?.forEach(c => systemLogs.push({
                id: `cat-${c.id}`,
                timestamp: new Date(c.created_at),
                type: 'category',
                action: 'Category Added',
                details: `Category "${c.name}" added to event "${(c as any).events?.name || 'Unknown'}".`,
                preview: `Category "${c.name}" added.`,
                status: 'success'
            }));

            allJudges?.forEach(j => systemLogs.push({
                id: `jdg-${j.id}`,
                timestamp: new Date(j.created_at),
                type: 'judge',
                action: 'Judge Registered',
                details: `Judge "${j.name}" registered for event "${(j as any).events?.name || 'Unknown'}".`,
                preview: `Judge "${j.name}" registered.`,
                status: 'success'
            }));

            allParticipants?.forEach(p => systemLogs.push({
                id: `ptc-${p.id}`,
                timestamp: new Date(p.created_at),
                type: 'participant',
                action: 'Participant Enrolled',
                details: `Participant "${p.name}" enrolled in event "${(p as any).events?.name || 'Unknown'}".`,
                preview: `Participant "${p.name}" enrolled.`,
                status: 'success'
            }));

            // Sort logs by newest first
            systemLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            setLogs(systemLogs.slice(0, 50)); // Show last 50 logs

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
        <div className="flex flex-col h-full space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 font-medium shadow-sm">
                        <FaCalendarAlt className="mr-2 text-gray-400" />
                        <span>Jan 20, 2023 - Feb 09, 2023</span>
                    </div>
                    <button className="flex items-center px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-medium shadow-sm transition-colors">
                        <FaDownload className="mr-2" />
                        Download
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-6">
                    {['Overview', 'Analytics', 'Reports', 'Notifications'].map((tab, index) => (
                        <button
                            key={tab}
                            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                index === 0
                                    ? 'border-gray-900 text-gray-900'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                    icon={<FaCalendarAlt className="w-5 h-5" />}
                    label="Total Events"
                    value={stats.events}
                    color="primary"
                    delay={0}
                    subtext="+20.1% from last month"
                />
                <StatsCard
                    icon={<FaTrophy className="w-5 h-5" />}
                    label="Categories"
                    value={stats.categories}
                    color="accent"
                    delay={0.1}
                    subtext="+180.1% from last month"
                />
                <StatsCard
                    icon={<FaGavel className="w-5 h-5" />}
                    label="Judges"
                    value={stats.judges}
                    color="success"
                    delay={0.2}
                    subtext="+19% from last month"
                />
                <StatsCard
                    icon={<FaUsers className="w-5 h-5" />}
                    label="Active Participants"
                    value={stats.participants}
                    color="warning"
                    delay={0.3}
                    subtext="+201 since last hour"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Charts Section - Takes up 2/3 */}
                <div className="lg:col-span-2 flex flex-col min-h-[300px] h-full">
                    <DashboardCharts 
                        eventsData={chartData.events}
                    />
                </div>

                {/* Recent Activity - Takes up 1/3 */}
                <div className="lg:col-span-1 flex flex-col min-h-[300px] h-full">
                    <RecentActivity 
                        items={logs}
                    />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
