import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaCopy, FaCheck, FaChartLine, FaTimes, FaImage } from 'react-icons/fa';
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

    // Image upload states
    const [auditorImageFile, setAuditorImageFile] = useState<File | null>(null);
    const [auditorImagePreview, setAuditorImagePreview] = useState<string>('');
    const [uploading, setUploading] = useState(false);

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

        setAuditorImageFile(file);
        setAuditorImagePreview(URL.createObjectURL(file));
    };

    const removeImage = () => {
        setAuditorImageFile(null);
        setAuditorImagePreview('');
    };

    const uploadImage = async (file: File): Promise<string | null> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `auditor_${Date.now()}.${fileExt}`;

        const { error } = await supabase.storage
            .from('tabulation-auditor')
            .upload(fileName, file);

        if (error) {
            console.error('Upload error:', error);
            alert(`Failed to upload image: ${error.message}`);
            return null;
        }

        const { data: urlData } = supabase.storage
            .from('tabulation-auditor')
            .getPublicUrl(fileName);

        return urlData.publicUrl;
    };

    const handleAddAuditor = async () => {
        if (!auditorName.trim() || !selectedEventId) return;
        setUploading(true);

        let photoUrl = null;
        if (auditorImageFile) {
            photoUrl = await uploadImage(auditorImageFile);
        }

        const code = generateCode();
        const { error } = await supabase
            .from('auditors')
            .insert([{
                name: auditorName.trim(),
                code,
                event_id: selectedEventId,
                photo_url: photoUrl
            }]);

        setUploading(false);
        if (!error) {
            fetchAuditors();
            closeModal();
        } else {
            alert('Error creating auditor: ' + error.message);
        }
    };

    const handleEditAuditor = async () => {
        if (!auditorName.trim() || !editingAuditor) return;
        setUploading(true);

        let photoUrl = editingAuditor.photo_url || null;
        if (auditorImageFile) {
            photoUrl = await uploadImage(auditorImageFile);
        }

        const { error } = await supabase
            .from('auditors')
            .update({ 
                name: auditorName.trim(),
                photo_url: photoUrl 
            })
            .eq('id', editingAuditor.id);

        setUploading(false);
        if (!error) {
            fetchAuditors();
            closeModal();
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
        setAuditorImageFile(null);
        setAuditorImagePreview('');
        setShowModal(true);
    };

    const openEditModal = (auditor: Auditor) => {
        setEditingAuditor(auditor);
        setAuditorName(auditor.name);
        setAuditorImagePreview(auditor.photo_url || '');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingAuditor(null);
        setAuditorName('');
        setAuditorImageFile(null);
        setAuditorImagePreview('');
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
                    <h1 className="text-2xl font-bold text-gray-900">Auditors</h1>
                    <p className="text-gray-500 mt-1">Manage auditors who can view event results</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <select
                        value={selectedEventId || ''}
                        onChange={(e) => setSelectedEventId(e.target.value ? Number(e.target.value) : null)}
                        className="form-input py-2.5 pr-8 w-full md:w-64"
                    >
                        <option value="">-- Select an Event --</option>
                        {events.map((event) => (
                            <option key={event.id} value={event.id}>
                                {event.name}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={openAddModal}
                        className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
                        disabled={!selectedEventId}
                    >
                        <FaPlus className="w-4 h-4" />
                        Add Auditor
                    </button>
                </div>
            </div>

            {/* Event Selector Warning */}
            {!selectedEventId && events.length > 0 && (
                <div className="bg-amber-50 text-amber-800 px-4 py-3 rounded-xl text-sm border border-amber-200">
                    ⚠️ Please select an event to view and manage auditors
                </div>
            )}
            {events.length === 0 && (
                <div className="bg-gray-50 text-gray-500 px-4 py-3 rounded-xl text-sm border border-gray-200">
                    No events found. Create an event first to add auditors.
                </div>
            )}

            {/* Auditors Grid */}
            {!selectedEventId ? (
                <div className="text-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="w-20 h-20 bg-maroon/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaChartLine className="w-10 h-10 text-maroon/40" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Select an Event</h3>
                    <p className="text-gray-500 mt-1">Choose an event from the dropdown above to manage its auditors</p>
                </div>
            ) : auditors.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaChartLine className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No auditors yet</h3>
                    <p className="text-gray-500 mt-1 mb-6">Add your first auditor to this event to get started</p>
                    <button onClick={openAddModal} className="btn-primary">
                        <FaPlus className="w-4 h-4 mr-2" />
                        Add First Auditor
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {auditors.map((auditor, index) => (
                        <motion.div
                            key={auditor.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            className="relative h-72 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group cursor-pointer"
                        >
                            {/* Full Background Image */}
                            <div className="absolute inset-0 bg-gray-900">
                                {/* Check for photo_url if added to schema, else fallback */}
                                {auditor.photo_url ? (
                                    <img 
                                        src={auditor.photo_url} 
                                        alt={auditor.name}
                                        className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-maroon to-gray-900 flex items-center justify-center">
                                        <FaChartLine className="w-20 h-20 text-white/10 rotate-12" />
                                    </div>
                                )}
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-maroon/95 via-maroon/40 to-transparent opacity-90" />
                            </div>

                            {/* Action Buttons (Top-Right) */}
                            <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                <button
                                    onClick={(e) => { e.stopPropagation(); openEditModal(auditor); }}
                                    className="p-3 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full transition-all border border-white/10"
                                    title="Edit Auditor"
                                >
                                    <FaEdit className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteAuditor(auditor.id); }}
                                    className="p-3 text-white/80 hover:text-red-400 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full transition-all border border-white/10"
                                    title="Delete Auditor"
                                >
                                    <FaTrash className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content Overlay */}
                            <div className="absolute bottom-0 inset-x-0 p-4 flex flex-col justify-end h-full z-10">
                                {/* Initial Avatar Badge */}
                                <div className="mb-auto pt-2">
                                    {!auditor.photo_url && (
                                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                                            <FaChartLine className="w-5 h-5" />
                                        </div>
                                    )}
                                </div>

                                {/* Name & Info */}
                                <div className="mb-4 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                                    <div className="inline-block max-w-full">
                                        <h3 className="font-bold text-white text-lg leading-tight mb-1 drop-shadow-md truncate">
                                            {auditor.name}
                                        </h3>
                                        <div className="h-0.5 w-full bg-yellow-400 rounded-full mb-2 opacity-80" />
                                    </div>
                                </div>

                                {/* Access Code Section - Glassmorphism */}
                                <div className="relative overflow-hidden rounded-lg bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors group/code">
                                    <div 
                                        onClick={(e) => { e.stopPropagation(); copyCode(auditor); }}
                                        className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-[9px] uppercase tracking-widest text-white/60 font-medium">
                                                Code
                                            </span>
                                            <code className="font-mono text-base font-bold text-white tracking-wider drop-shadow-sm">
                                                {auditor.code}
                                            </code>
                                        </div>
                                        
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 group-hover/code:bg-white/20 transition-colors">
                                            {copiedId === auditor.id ? (
                                                <FaCheck className="w-3.5 h-3.5 text-green-400" />
                                            ) : (
                                                <FaCopy className="w-3.5 h-3.5 text-white/90" />
                                            )}
                                        </div>
                                    </div>
                                    {copiedId === auditor.id && (
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
                title={editingAuditor ? 'Edit Auditor' : 'Add New Auditor'}
            >
                <div className="space-y-5">
                    <div>
                        <label className="form-label">Auditor Name *</label>
                        <input
                            type="text"
                            value={auditorName}
                            onChange={(e) => setAuditorName(e.target.value)}
                            placeholder="e.g. Maria Santos"
                            className="form-input"
                            autoFocus
                        />
                    </div>

                    {/* Photo Upload */}
                    <div>
                        <label className="form-label">Profile Photo (Optional)</label>
                        {auditorImagePreview ? (
                            <div className="flex justify-center py-2">
                                <div className="relative">
                                    <img
                                        src={auditorImagePreview}
                                        alt="Auditor preview"
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

                    {!editingAuditor && (
                        <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                            <span className="mt-0.5">ℹ️</span>
                            <p>A secure 6-character access code will be automatically generated for this auditor.</p>
                        </div>
                    )}
                </div>
                <div className="flex gap-3 mt-8 pt-4 border-t border-gray-100">
                    <button onClick={closeModal} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={editingAuditor ? handleEditAuditor : handleAddAuditor}
                        disabled={!auditorName.trim() || uploading}
                        className="btn-primary flex-1"
                    >
                        {uploading ? 'Saving...' : (editingAuditor ? 'Save Changes' : 'Create Auditor')}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default AuditorsPage;
