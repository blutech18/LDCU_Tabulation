import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from './stores';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import JudgeLayout from './layouts/JudgeLayout';
import AuditorLayout from './layouts/AuditorLayout';

// Pages
import Login from './pages/Login';
import JudgeLogin from './pages/JudgeLogin';
import AuditorLogin from './pages/AuditorLogin';

// Admin Pages
import Dashboard from './pages/admin/Dashboard';
import EventsPage from './pages/admin/EventsPage';
import JudgesPage from './pages/admin/JudgesPage';
import AuditorsPage from './pages/admin/AuditorsPage';

// Judge Pages
import JudgeLanding from './pages/judge/JudgeLanding';
import TabularMode from './pages/judge/TabularMode';
import Finished from './pages/judge/Finished';

// Auditor Pages
import AuditorResults from './pages/auditor/AuditorResults';

const pageVariants = {
    initial: { opacity: 0, y: 10 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -10 },
};

const pageTransition: any = {
    type: 'tween',
    ease: 'easeInOut',
    duration: 0.3,
};

function AppWrapper() {
    const location = useLocation();
    const { isAdmin, init } = useAuthStore();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        init().then(() => setLoading(false));
    }, [init]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                    <p className="text-gray-500 font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                {/* Public Routes */}
                <Route
                    path="/login"
                    element={
                        <motion.div
                            initial="initial"
                            animate="in"
                            exit="out"
                            variants={pageVariants}
                            transition={pageTransition}
                        >
                            {!isAdmin ? <Login /> : <Navigate to="/admin/dashboard" />}
                        </motion.div>
                    }
                />
                <Route
                    path="/judge/login"
                    element={
                        <motion.div
                            initial="initial"
                            animate="in"
                            exit="out"
                            variants={pageVariants}
                            transition={pageTransition}
                        >
                            <JudgeLogin />
                        </motion.div>
                    }
                />
                <Route
                    path="/auditor/login"
                    element={
                        <motion.div
                            initial="initial"
                            animate="in"
                            exit="out"
                            variants={pageVariants}
                            transition={pageTransition}
                        >
                            <AuditorLogin />
                        </motion.div>
                    }
                />

                {/* Admin Routes */}
                <Route
                    path="/admin/*"
                    element={isAdmin ? <AdminLayout /> : <Navigate to="/login" />}
                >
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="events" element={<EventsPage />} />
                    <Route path="events/:eventId" element={<EventsPage />} />
                    <Route path="judges" element={<JudgesPage />} />
                    <Route path="auditors" element={<AuditorsPage />} />
                </Route>

                {/* Judge Routes */}
                <Route path="/judge/*" element={<JudgeLayout />}>
                    <Route path="panel" element={<JudgeLanding />} />
                    <Route path="tabular/:categoryId" element={<TabularMode />} />
                    <Route path="finished/:categoryId" element={<Finished />} />
                </Route>

                {/* Auditor Routes */}
                <Route path="/auditor/*" element={<AuditorLayout />}>
                    <Route path="results" element={<AuditorResults />} />
                </Route>

                {/* Default Route */}
                <Route
                    path="/"
                    element={<Navigate to={isAdmin ? '/admin/dashboard' : '/judge/login'} />}
                />

                {/* 404 */}
                <Route
                    path="*"
                    element={
                        <div className="min-h-screen flex items-center justify-center bg-gray-50">
                            <div className="text-center">
                                <h1 className="text-6xl font-bold text-gray-300">404</h1>
                                <p className="mt-4 text-gray-500">Page not found</p>
                            </div>
                        </div>
                    }
                />
            </Routes>
        </AnimatePresence>
    );
}

function App() {
    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppWrapper />
        </Router>
    );
}

export default App;

