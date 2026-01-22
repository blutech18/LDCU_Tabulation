import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaHome, FaCalendarAlt, FaUserTie } from 'react-icons/fa';

interface SidebarProps {
    isOpen: boolean;
}

const menuItems = [
    { path: '/admin/dashboard', icon: FaHome, label: 'Dashboard' },
    { path: '/admin/events', icon: FaCalendarAlt, label: 'Events' },
    { path: '/admin/judges', icon: FaUserTie, label: 'Judges' },
];

const Sidebar = ({ isOpen }: SidebarProps) => {
    const location = useLocation();

    return (
        <motion.aside
            initial={false}
            animate={{ width: isOpen ? 260 : 72 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed top-14 left-0 bottom-0 sidebar-maroon overflow-hidden z-40 shadow-lg"
        >
            <nav className="p-3 pt-4">
                <ul className="space-y-1">
                    {menuItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.path);
                        const Icon = item.icon;

                        return (
                            <li key={item.path}>
                                <NavLink
                                    to={item.path}
                                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                                >
                                    <Icon className="w-5 h-5 flex-shrink-0" />
                                    <motion.span
                                        initial={false}
                                        animate={{
                                            opacity: isOpen ? 1 : 0,
                                            width: isOpen ? 'auto' : 0,
                                        }}
                                        transition={{ duration: 0.2 }}
                                        className="whitespace-nowrap overflow-hidden"
                                    >
                                        {item.label}
                                    </motion.span>
                                </NavLink>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Footer - School name when expanded */}
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="absolute bottom-4 left-0 right-0 text-center"
                >
                    <p className="text-white/30 text-xs">
                        Liceo de Cagayan University
                    </p>
                </motion.div>
            )}
        </motion.aside>
    );
};

export default Sidebar;
