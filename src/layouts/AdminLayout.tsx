import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from '../components/admin/Sidebar';
import Header from '../components/common/Header';

const AdminLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const location = useLocation();

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    return (
        <div className="h-screen bg-gray-50 overflow-hidden flex flex-col">
            {/* Header */}
            <Header onToggleSidebar={toggleSidebar} showMenuButton />

            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} />

            {/* Main Content */}
            <main
                className={`flex-1 transition-all duration-300 h-full overflow-hidden pt-14 ${
                    sidebarOpen ? 'ml-[260px]' : 'ml-[72px]'
                }`}
            >
                <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="h-full p-6 overflow-y-auto overflow-x-hidden"
                >
                    <Outlet />
                </motion.div>
            </main>
        </div>
    );
};

export default AdminLayout;
