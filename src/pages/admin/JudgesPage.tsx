import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaCopy, FaCheck, FaUserTie, FaImage, FaTimes, FaHistory } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/common/Modal';
import JudgeLogsModal from '../../components/admin/JudgeLogsModal';
import type { Judge, Event } from '../../types';

const JudgesPage = () => {
    const [judges, setJudges] = useState<Judge[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingJudge, setEditingJudge] = useState<Judge | null>(null);
    const [judgeName, setJudgeName] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);

    // Image upload states
    const [judgeImageFile, setJudgeImageFile] = useState<File | null>(null);
    const [judgeImagePreview, setJudgeImagePreview] = useState<string>('');
    const [uploading, setUploading] = useState(false);

    // Logs modal state
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [selectedJudgeForLogs, setSelectedJudgeForLogs] = useState<Judge | null>(null);

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        if (selectedEventId) {
            fetchJudges();
        } else {
            setJudges([]);
        }
    }, [selectedEventId]);

    const fetchEvents = async () => {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .order('date', { ascending: false });
        if (!error && data) {
            setEvents(data as Event[]);
            // Auto-select first event if available
            if (data.length > 0) {
                setSelectedEventId(data[0].id);
            }
        }
        setLoading(false);
    };

    const fetchJudges = async () => {
        if (!selectedEventId) return;

        const { data, error } = await supabase
            .from('judges')
            .select('*')
            .eq('event_id', selectedEventId)
            .eq('is_active', true)
            .order('name');
        if (!error && data) {
            setJudges(data as Judge[]);
        }
    };

    const generateCode = () => {
        return 'JUDGE' + Math.random().toString(36).substring(2, 6).toUpperCase();
    };

    // Image upload handler
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            alert('Please upload a JPG or PNG image');
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size must be less than 5MB');
            return;
        }

        setJudgeImageFile(file);
        setJudgeImagePreview(URL.createObjectURL(file));
    };

    const removeImage = () => {
        setJudgeImageFile(null);
        setJudgeImagePreview('');
    };

    const uploadImage = async (file: File): Promise<string | null> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `judge_${Date.now()}.${fileExt}`;

        const { error } = await supabase.storage
            .from('tabulation-participant')
            .upload(fileName, file);

        if (error) {
            console.error('Upload error:', error);
            return null;
        }

        const { data: urlData } = supabase.storage
            .from('tabulation-participant')
            .getPublicUrl(fileName);

        return urlData.publicUrl;
    };

    const handleAddJudge = async () => {
        if (!judgeName.trim() || !selectedEventId) return;
        setUploading(true);

        let photoUrl = null;
        if (judgeImageFile) {
            photoUrl = await uploadImage(judgeImageFile);
        }

        const code = generateCode();
        const { error } = await supabase.from('judges').insert({
            event_id: selectedEventId,
            name: judgeName,
            code,
            photo_url: photoUrl,
        });

        setUploading(false);
        if (!error) {
            fetchJudges();
            closeModal();
        }
    };

    const handleUpdateJudge = async () => {
        if (!editingJudge || !judgeName.trim()) return;
        setUploading(true);

        let photoUrl = editingJudge.photo_url || null;
        if (judgeImageFile) {
            photoUrl = await uploadImage(judgeImageFile);
        }

        const { error } = await supabase
            .from('judges')
            .update({
                name: judgeName,
                photo_url: photoUrl,
            })
            .eq('id', editingJudge.id);

        setUploading(false);
        if (!error) {
            fetchJudges();
            closeModal();
        }
    };

    const handleDeleteJudge = async (id: number) => {
        if (!confirm('Are you sure you want to delete this judge?')) return;

        const { error } = await supabase.from('judges').delete().eq('id', id);
        if (!error) {
            fetchJudges();
        }
    };

    const handleCopyCode = (judge: Judge) => {
        navigator.clipboard.writeText(judge.code);
        setCopiedId(judge.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const openEditModal = (judge: Judge) => {
        setEditingJudge(judge);
        setJudgeName(judge.name);
        setJudgeImagePreview(judge.photo_url || '');
        setShowModal(true);
    };

    const openAddModal = () => {
        setEditingJudge(null);
        setJudgeName('');
        setJudgeImageFile(null);
        setJudgeImagePreview('');
        setShowModal(true);
    };

    const openLogsModal = (judge: Judge) => {
        setSelectedJudgeForLogs(judge);
        setShowLogsModal(true);
    };

    const closeLogsModal = () => {
        setShowLogsModal(false);
        setSelectedJudgeForLogs(null);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingJudge(null);
        setJudgeName('');
        setJudgeImageFile(null);
        setJudgeImagePreview('');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-maroon/20 border-t-maroon rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Judges</h1>
                    <p className="text-gray-500 mt-1">Manage your panel of judges</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <select
                        value={selectedEventId || ''}
                        onChange={(e) => setSelectedEventId(e.target.value ? Number(e.target.value) : null)}
                        className="form-input py-2.5 pr-8 w-full md:w-64"
                    >
                        <option value="">-- Select an Event --</option>
                        {events.map(event => (
                            <option key={event.id} value={event.id}>{event.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={openAddModal}
                        className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
                        disabled={!selectedEventId}
                    >
                        <FaPlus className="w-4 h-4" />
                        Add Judge
                    </button>
                </div>
            </div>

            {/* Event Selector Warning */}
            {!selectedEventId && events.length > 0 && (
                <div className="bg-amber-50 text-amber-800 px-4 py-3 rounded-xl text-sm border border-amber-200">
                    ⚠️ Please select an event to view and manage judges
                </div>
            )}
            {events.length === 0 && (
                <div className="bg-gray-50 text-gray-500 px-4 py-3 rounded-xl text-sm border border-gray-200">
                    No events found. Create an event first to add judges.
                </div>
            )}

            {/* Judges Grid */}
            {!selectedEventId ? (
                <div className="text-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="w-20 h-20 bg-maroon/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaUserTie className="w-10 h-10 text-maroon/40" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Select an Event</h3>
                    <p className="text-gray-500 mt-1">Choose an event from the dropdown above to manage its judges</p>
                </div>
            ) : judges.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaUserTie className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No judges yet</h3>
                    <p className="text-gray-500 mt-1 mb-6">Add your first judge to this event to get started</p>
                    <button onClick={openAddModal} className="btn-primary">
                        <FaPlus className="w-4 h-4 mr-2" />
                        Add First Judge
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {judges.map((judge, index) => (
                        <motion.div
                            key={judge.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            className="relative h-72 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group cursor-pointer"
                            onClick={() => openLogsModal(judge)}
                        >
                            {/* Full Background Image */}
                            <div className="absolute inset-0 bg-gray-900">
                                {judge.photo_url ? (
                                    <img 
                                        src={judge.photo_url} 
                                        alt={judge.name}
                                        className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-maroon to-gray-900 flex items-center justify-center">
                                        <FaUserTie className="w-16 h-16 text-white/20" />
                                    </div>
                                )}
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-maroon/95 via-maroon/40 to-transparent opacity-90" />
                            </div>

                            {/* Action Buttons (Top-Right) */}
                            <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                <button
                                    onClick={(e) => { e.stopPropagation(); openLogsModal(judge); }}
                                    className="p-3 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full transition-all border border-white/10"
                                    title="View Activity Logs"
                                >
                                    <FaHistory className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); openEditModal(judge); }}
                                    className="p-3 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full transition-all border border-white/10"
                                    title="Edit Judge"
                                >
                                    <FaEdit className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteJudge(judge.id); }}
                                    className="p-3 text-white/80 hover:text-red-400 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full transition-all border border-white/10"
                                    title="Delete Judge"
                                >
                                    <FaTrash className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content Overlay */}
                            <div className="absolute bottom-0 inset-x-0 p-4 flex flex-col justify-end h-full z-10">
                                {/* Initial Avatar Badge */}
                                <div className="mb-auto pt-2">
                                    {!judge.photo_url && (
                                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                                            {judge.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                {/* Name & Info */}
                                <div className="mb-4 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                                    <div className="inline-block max-w-full">
                                        <h3 className="font-bold text-white text-lg leading-tight mb-1 drop-shadow-md truncate">
                                            {judge.name}
                                        </h3>
                                        <div className="h-0.5 w-full bg-yellow-400 rounded-full mb-2 opacity-80" />
                                    </div>
                                </div>

                                {/* Access Code Section */}
                                <div className="relative overflow-hidden rounded-lg bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors group/code">
                                    <div 
                                        onClick={(e) => { e.stopPropagation(); handleCopyCode(judge); }}
                                        className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-[9px] uppercase tracking-widest text-white/60 font-medium">
                                                Code
                                            </span>
                                            <code className="font-mono text-base font-bold text-white tracking-wider drop-shadow-sm">
                                                {judge.code}
                                            </code>
                                        </div>
                                        
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 group-hover/code:bg-white/20 transition-colors">
                                            {copiedId === judge.id ? (
                                                <FaCheck className="w-3.5 h-3.5 text-green-400" />
                                            ) : (
                                                <FaCopy className="w-3.5 h-3.5 text-white/90" />
                                            )}
                                        </div>
                                    </div>
                                    {copiedId === judge.id && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-green-500/90 backdrop-blur-sm text-white text-xs font-bold tracking-wide animate-in fade-in">
                                            COPIED!
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title={editingJudge ? 'Edit Judge' : 'Add New Judge'}
            >
                <div className="space-y-5">
                    <div>
                        <label className="form-label">Judge Name *</label>
                        <input
                            type="text"
                            value={judgeName}
                            onChange={(e) => setJudgeName(e.target.value)}
                            placeholder="e.g. Dr. Juan Dela Cruz"
                            className="form-input"
                            autoFocus
                        />
                    </div>

                    {/* Photo Upload */}
                    <div>
                        <label className="form-label">Profile Photo (Optional)</label>
                        {judgeImagePreview ? (
                            <div className="flex justify-center py-2">
                                <div className="relative">
                                    <img
                                        src={judgeImagePreview}
                                        alt="Judge preview"
                                        className="w-24 h-24 object-cover rounded-full border-3 border-gray-200 shadow-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={removeImage}
                                        className="absolute top-0 right-0 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                                    >
                                        <FaTimes className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-maroon/50 hover:bg-gray-50 transition-all">
                                <FaImage className="w-6 h-6 text-gray-400 mb-1" />
                                <span className="text-sm text-gray-500">Click to upload photo</span>
                                <span className="text-xs text-gray-400">JPG or PNG, max 5MB</span>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>

                    {!editingJudge && (
                        <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                            <span className="mt-0.5">ℹ️</span>
                            <p>A secure 6-character access code will be automatically generated for this judge.</p>
                        </div>
                    )}
                </div>
                <div className="flex gap-3 mt-8 pt-4 border-t border-gray-100">
                    <button onClick={closeModal} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={editingJudge ? handleUpdateJudge : handleAddJudge}
                        disabled={!judgeName.trim() || uploading}
                        className="btn-primary flex-1"
                    >
                        {uploading ? 'Saving...' : (editingJudge ? 'Save Changes' : 'Create Judge')}
                    </button>
                </div>
            </Modal>

            {/* Judge Logs Modal */}
            <JudgeLogsModal
                isOpen={showLogsModal}
                onClose={closeLogsModal}
                judge={selectedJudgeForLogs}
            />
        </div>
    );
};

export default JudgesPage;
