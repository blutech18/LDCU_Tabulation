import { FaBars, FaSignOutAlt } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
    onToggleSidebar?: () => void;
    showMenuButton?: boolean;
}

const Header = ({ onToggleSidebar, showMenuButton = false }: HeaderProps) => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-14 header-maroon">
            <div className="h-full px-4 flex items-center justify-between">
                {/* Left Side */}
                <div className="flex items-center gap-4">
                    {showMenuButton && (
                        <button
                            onClick={onToggleSidebar}
                            className="p-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <FaBars className="w-5 h-5" />
                        </button>
                    )}
                    <div className="flex items-center gap-3">
                        <img
                            src="/ldcu-logo.png"
                            alt="LDCU Logo"
                            className="w-9 h-9 object-contain"
                        />
                        <span className="font-semibold text-white hidden sm:block">
                            LDCU Tabulation System
                        </span>
                    </div>
                </div>

                {/* Right Side */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <FaSignOutAlt className="w-4 h-4" />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
