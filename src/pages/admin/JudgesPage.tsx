import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaCopy, FaCheck, FaUserTie, FaImage, FaTimes } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/common/Modal';
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Judges</h1>
                    <p className="text-gray-500 mt-1">Manage your panel of judges</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="btn-primary flex items-center gap-2"
                    disabled={!selectedEventId}
                >
                    <FaPlus className="w-4 h-4" />
                    Add Judge
                </button>
            </div>

            {/* Event Selector */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
                <label className="form-label">Select Event</label>
                <select
                    value={selectedEventId || ''}
                    onChange={(e) => setSelectedEventId(e.target.value ? Number(e.target.value) : null)}
                    className="form-input max-w-md"
                >
                    <option value="">-- Select an Event --</option>
                    {events.map(event => (
                        <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                </select>
                {!selectedEventId && events.length > 0 && (
                    <p className="text-sm text-amber-600 mt-2">⚠️ Please select an event to view and manage judges</p>
                )}
                {events.length === 0 && (
                    <p className="text-sm text-gray-500 mt-2">No events found. Create an event first to add judges.</p>
                )}
            </div>

            {/* Judges Grid */}
            {!selectedEventId ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl">
                    <div className="w-20 h-20 bg-maroon/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaUserTie className="w-10 h-10 text-maroon" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Select an Event</h3>
                    <p className="text-gray-500 mt-1">Choose an event from the dropdown above to manage its judges</p>
                </div>
            ) : judges.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-20 h-20 bg-maroon/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaUserTie className="w-10 h-10 text-maroon" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No judges yet</h3>
                    <p className="text-gray-500 mt-1">Add your first judge to get started</p>
                    <button onClick={openAddModal} className="btn-primary mt-4">
                        Add Judge
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {judges.map((judge, index) => (
                        <motion.div
                            key={judge.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                        >
                            {/* Card Header */}
                            <div className="bg-gradient-to-r from-maroon to-maroon-dark p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-lg">
                                        {judge.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="text-white">
                                        <h3 className="font-semibold">
                                            {judge.name}
                                        </h3>
                                        <p className="text-white/70 text-sm">
                                            Judge
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-4">
                                {/* Access Code */}
                                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                    <p className="text-xs text-gray-500 mb-1">Access Code</p>
                                    <div className="flex items-center justify-between">
                                        <code className="text-lg font-mono font-bold text-maroon">
                                            {judge.code}
                                        </code>
                                        <button
                                            onClick={() => handleCopyCode(judge)}
                                            className="p-2 text-gray-400 hover:text-maroon rounded-lg hover:bg-white transition-colors"
                                            title="Copy code"
                                        >
                                            {copiedId === judge.id ? (
                                                <FaCheck className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <FaCopy className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openEditModal(judge)}
                                        className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2"
                                    >
                                        <FaEdit className="w-3 h-3" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDeleteJudge(judge.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                    >
                                        <FaTrash className="w-4 h-4" />
                                    </button>
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
                <div className="space-y-4">
                    <div>
                        <label className="form-label">Judge Name *</label>
                        <input
                            type="text"
                            value={judgeName}
                            onChange={(e) => setJudgeName(e.target.value)}
                            placeholder="Enter judge name"
                            className="form-input"
                            autoFocus
                        />
                    </div>

                    {/* Photo Upload */}
                    <div>
                        <label className="form-label">Photo (Optional)</label>
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
                        <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                            💡 A unique access code will be generated automatically.
                        </p>
                    )}
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={closeModal} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={editingJudge ? handleUpdateJudge : handleAddJudge}
                        disabled={!judgeName.trim() || uploading}
                        className="btn-primary flex-1"
                    >
                        {uploading ? 'Uploading...' : (editingJudge ? 'Update Judge' : 'Add Judge')}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default JudgesPage;
