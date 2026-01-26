import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaCopy, FaCheck, FaChartLine } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/common/Modal';
import type { Auditor, Event } from '../../types';

const AuditorsPage = () => {
    const [auditors, setAuditors] = useState<Auditor[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAuditor, setEditingAuditor] = useState<Auditor | null>(null);
    const [auditorName, setAuditorName] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        if (selectedEventId) {
            fetchAuditors();
        } else {
            setAuditors([]);
        }
    }, [selectedEventId]);

    const fetchEvents = async () => {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .order('date', { ascending: false });
        if (!error && data) {
            setEvents(data as Event[]);
            if (data.length > 0) {
                setSelectedEventId(data[0].id);
            }
        }
        setLoading(false);
    };

    const fetchAuditors = async () => {
        if (!selectedEventId) return;

        const { data, error } = await supabase
            .from('auditors')
            .select('*')
            .eq('event_id', selectedEventId)
            .eq('is_active', true)
            .order('name');
        if (!error && data) {
            setAuditors(data as Auditor[]);
        }
    };

    const generateCode = () => {
        return 'AUDIT' + Math.random().toString(36).substring(2, 6).toUpperCase();
    };

    const handleAddAuditor = async () => {
        if (!auditorName.trim() || !selectedEventId) return;

        const code = generateCode();
        const { error } = await supabase
            .from('auditors')
            .insert([{
                name: auditorName.trim(),
                code,
                event_id: selectedEventId
            }]);

        if (!error) {
            fetchAuditors();
            setShowModal(false);
            setAuditorName('');
        } else {
            alert('Error creating auditor: ' + error.message);
        }
    };

    const handleEditAuditor = async () => {
        if (!auditorName.trim() || !editingAuditor) return;

        const { error } = await supabase
            .from('auditors')
            .update({ name: auditorName.trim() })
            .eq('id', editingAuditor.id);

        if (!error) {
            fetchAuditors();
            setShowModal(false);
            setEditingAuditor(null);
            setAuditorName('');
        }
    };

    const handleDeleteAuditor = async (id: number) => {
        if (!confirm('Are you sure you want to delete this auditor?')) return;

        const { error } = await supabase
            .from('auditors')
            .update({ is_active: false })
            .eq('id', id);

        if (!error) {
            fetchAuditors();
        }
    };

    const copyCode = (auditor: Auditor) => {
        navigator.clipboard.writeText(auditor.code);
        setCopiedId(auditor.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const openAddModal = () => {
        setEditingAuditor(null);
        setAuditorName('');
        setShowModal(true);
    };

    const openEditModal = (auditor: Auditor) => {
        setEditingAuditor(auditor);
        setAuditorName(auditor.name);
        setShowModal(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-10 h-10 border-4 border-maroon/20 border-t-maroon rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Auditors</h1>
                    <p className="text-gray-600">Manage auditors who can view event results</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Event Selector */}
                    <select
                        value={selectedEventId || ''}
                        onChange={(e) => setSelectedEventId(e.target.value ? Number(e.target.value) : null)}
                        className="px-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-maroon"
                    >
                        <option value="">Select Event</option>
                        {events.map((event) => (
                            <option key={event.id} value={event.id}>
                                {event.name}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={openAddModal}
                        disabled={!selectedEventId}
                        className="flex items-center gap-2 px-4 py-2 bg-maroon text-white rounded-lg hover:bg-maroon-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FaPlus className="w-4 h-4" />
                        Add Auditor
                    </button>
                </div>
            </div>

            {/* Auditors Grid */}
            {auditors.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {auditors.map((auditor) => (
                        <motion.div
                            key={auditor.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-maroon to-maroon-dark flex items-center justify-center text-white text-xl font-bold">
                                    <FaChartLine className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">{auditor.name}</h3>
                                    <div className="mt-2 flex items-center gap-2">
                                        <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-maroon">
                                            {auditor.code}
                                        </code>
                                        <button
                                            onClick={() => copyCode(auditor)}
                                            className="p-1.5 text-gray-500 hover:text-maroon hover:bg-maroon/10 rounded transition-colors"
                                            title="Copy code"
                                        >
                                            {copiedId === auditor.id ? (
                                                <FaCheck className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <FaCopy className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-2">
                                <button
                                    onClick={() => openEditModal(auditor)}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <FaEdit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDeleteAuditor(auditor.id)}
                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <FaTrash className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                    <FaChartLine className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">
                        {selectedEventId
                            ? 'No auditors yet. Add your first auditor to get started.'
                            : 'Select an event to manage auditors.'}
                    </p>
                </div>
            )}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingAuditor(null);
                    setAuditorName('');
                }}
                title={editingAuditor ? 'Edit Auditor' : 'Add Auditor'}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Auditor Name
                        </label>
                        <input
                            type="text"
                            value={auditorName}
                            onChange={(e) => setAuditorName(e.target.value)}
                            placeholder="Enter auditor name"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon"
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setShowModal(false);
                                setEditingAuditor(null);
                                setAuditorName('');
                            }}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={editingAuditor ? handleEditAuditor : handleAddAuditor}
                            className="px-4 py-2 bg-maroon text-white rounded-lg hover:bg-maroon-dark transition-colors"
                        >
                            {editingAuditor ? 'Save Changes' : 'Add Auditor'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AuditorsPage;
