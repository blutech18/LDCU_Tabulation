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
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <Header onToggleSidebar={toggleSidebar} showMenuButton />

            <div className="flex">
                {/* Sidebar */}
                <Sidebar isOpen={sidebarOpen} />

                {/* Main Content */}
                <main
                    className={`flex-1 transition-all duration-300 pt-14 min-h-screen ${sidebarOpen ? 'ml-64' : 'ml-20'
                        }`}
                >
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="p-6"
                    >
                        <Outlet />
                    </motion.div>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
