import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FaTable,
    FaUsers,
    FaClipboardList,
    FaPlus,
    FaEdit,
    FaTrash,
    FaChevronLeft,
    FaCalendarAlt,
    FaCog,
    FaUserTie,
    FaCopy,
    FaCheck,
    FaClock,
    FaMapMarkerAlt,
    FaImage,
    FaTimes,
} from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/common/Modal';
import type { Event, Category, Contestant, Judge } from '../../types';

type TabId = 'tabular' | 'participants' | 'criteria' | 'judges' | 'settings';

interface Tab {
    id: TabId;
    label: string;
    icon: React.ReactNode;
}

const tabs: Tab[] = [
    { id: 'tabular', label: 'Categories', icon: <FaTable /> },
    { id: 'participants', label: 'Participants', icon: <FaUsers /> },
    { id: 'criteria', label: 'Criteria', icon: <FaClipboardList /> },
    { id: 'judges', label: 'Judges', icon: <FaUserTie /> },
    { id: 'settings', label: 'Settings', icon: <FaCog /> },
];

const EventsPage = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('tabular');
    const [loading, setLoading] = useState(true);

    // Add Event Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEventName, setNewEventName] = useState('');
    const [newEventStartDate, setNewEventStartDate] = useState('');
    const [newEventStartTime, setNewEventStartTime] = useState('');
    const [newEventEndDate, setNewEventEndDate] = useState('');
    const [newEventEndTime, setNewEventEndTime] = useState('');
    const [newEventVenue, setNewEventVenue] = useState('');
    const [newEventDescription, setNewEventDescription] = useState('');
    const [newEventParticipantType, setNewEventParticipantType] = useState<'individual' | 'group'>('individual');

    // Edit Event Modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);

    // Delete Confirmation Modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        if (eventId && events.length > 0) {
            const event = events.find((e) => e.id === parseInt(eventId));
            if (event) setSelectedEvent(event);
        }
    }, [eventId, events]);

    const fetchEvents = async () => {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .order('date', { ascending: false });
        if (!error && data) {
            setEvents(data as Event[]);
        }
        setLoading(false);
    };

    const handleAddEvent = async () => {
        if (!newEventName || !newEventStartDate) return;

        // Combine date and time for start/end timestamps
        const eventStart = newEventStartDate
            ? `${newEventStartDate}T${newEventStartTime || '00:00:00'}`
            : null;
        const eventEnd = newEventEndDate
            ? `${newEventEndDate}T${newEventEndTime || '23:59:00'}`
            : null;

        const { error } = await supabase.from('events').insert({
            name: newEventName,
            date: newEventStartDate, // Use start date as the main event date
            event_start: eventStart,
            event_end: eventEnd,
            venue: newEventVenue || null,
            description: newEventDescription || null,
            participant_type: newEventParticipantType,
        });

        if (!error) {
            fetchEvents();
            closeAddModal();
        } else {
            console.error('Error creating event:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleEditEvent = async () => {
        if (!editingEvent || !newEventName || !newEventStartDate) return;

        // Combine date and time for start/end timestamps
        const eventStart = newEventStartDate
            ? `${newEventStartDate}T${newEventStartTime || '00:00:00'}`
            : null;
        const eventEnd = newEventEndDate
            ? `${newEventEndDate}T${newEventEndTime || '23:59:00'}`
            : null;

        const { error } = await supabase
            .from('events')
            .update({
                name: newEventName,
                date: newEventStartDate, // Use start date as the main event date
                event_start: eventStart,
                event_end: eventEnd,
                venue: newEventVenue || null,
                description: newEventDescription || null,
                participant_type: newEventParticipantType,
            })
            .eq('id', editingEvent.id);

        if (!error) {
            fetchEvents();
            closeEditModal();
            // Update selected event if it's the one being edited
            if (selectedEvent?.id === editingEvent.id) {
                setSelectedEvent({
                    ...selectedEvent,
                    name: newEventName,
                    date: newEventStartDate,
                    event_start: eventStart || undefined,
                    event_end: eventEnd || undefined,
                    venue: newEventVenue,
                    description: newEventDescription,
                });
            }
        } else {
            console.error('Error updating event:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleDeleteEvent = async () => {
        if (!deletingEvent) return;

        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', deletingEvent.id);

        if (!error) {
            fetchEvents();
            setShowDeleteModal(false);
            setDeletingEvent(null);
            // Navigate back to list if we deleted the currently selected event
            if (selectedEvent?.id === deletingEvent.id) {
                setSelectedEvent(null);
                navigate('/admin/events');
            }
        }
    };

    const closeAddModal = () => {
        setShowAddModal(false);
        setNewEventName('');
        setNewEventStartDate('');
        setNewEventStartTime('');
        setNewEventEndDate('');
        setNewEventEndTime('');
        setNewEventVenue('');
        setNewEventDescription('');
        setNewEventParticipantType('individual');
    };

    const closeEditModal = () => {
        setShowEditModal(false);
        setEditingEvent(null);
        setNewEventName('');
        setNewEventStartDate('');
        setNewEventStartTime('');
        setNewEventEndDate('');
        setNewEventEndTime('');
        setNewEventVenue('');
        setNewEventDescription('');
        setNewEventParticipantType('individual');
    };

    const openEditModal = (event: Event) => {
        setEditingEvent(event);
        setNewEventName(event.name);

        // Use the main date field as start date, or parse from event_start if available
        if (event.event_start) {
            const startDate = new Date(event.event_start);
            setNewEventStartDate(startDate.toISOString().split('T')[0]);
            setNewEventStartTime(startDate.toTimeString().slice(0, 5));
        } else {
            // Fallback to the date field
            setNewEventStartDate(event.date);
            setNewEventStartTime('');
        }

        if (event.event_end) {
            const endDate = new Date(event.event_end);
            setNewEventEndDate(endDate.toISOString().split('T')[0]);
            setNewEventEndTime(endDate.toTimeString().slice(0, 5));
        } else {
            setNewEventEndDate('');
            setNewEventEndTime('');
        }

        setNewEventVenue(event.venue || '');
        setNewEventDescription(event.description || '');
        setNewEventParticipantType(event.participant_type || 'individual');
        setShowEditModal(true);
    };

    const openDeleteModal = (event: Event) => {
        setDeletingEvent(event);
        setShowDeleteModal(true);
    };

    const handleSelectEvent = (event: Event) => {
        setSelectedEvent(event);
        navigate(`/admin/events/${event.id}`);
    };

    const handleBackToList = () => {
        setSelectedEvent(null);
        navigate('/admin/events');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-maroon/20 border-t-maroon rounded-full animate-spin" />
            </div>
        );
    }

    // Event Detail View with Tabs
    if (selectedEvent) {
        return (
            <div className="space-y-6">
                {/* Header */}
                {/* Header */}
                <div className="flex items-center gap-4 mb-4">
                    <button
                        onClick={handleBackToList}
                        className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-maroon hover:text-maroon hover:bg-maroon/5 transition-all bg-white shadow-sm shrink-0"
                    >
                        <FaChevronLeft className="w-4 h-4 ml-[-2px]" />
                    </button>
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight leading-none">
                            {selectedEvent.name}
                        </h1>
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500 font-medium">
                            {/* Date */}
                            <div className="flex items-center gap-2">
                                <FaCalendarAlt className="w-4 h-4 text-maroon/70" />
                                <span>
                                    {new Date(selectedEvent.date).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                    {selectedEvent.event_end && new Date(selectedEvent.event_end).toDateString() !== new Date(selectedEvent.date).toDateString() && (
                                        <> - {new Date(selectedEvent.event_end).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        })}</>
                                    )}
                                </span>
                            </div>

                            {/* Time */}
                            {selectedEvent.event_start && (
                                <>
                                    <div className="w-1 h-1 rounded-full bg-gray-300" />
                                    <div className="flex items-center gap-2">
                                        <FaClock className="w-4 h-4 text-maroon/70" />
                                        <span>
                                            {new Date(selectedEvent.event_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                            {selectedEvent.event_end && (
                                                <> - {new Date(selectedEvent.event_end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
                                            )}
                                        </span>
                                    </div>
                                </>
                            )}

                            {/* Venue */}
                            {selectedEvent.venue && (
                                <>
                                    <div className="w-1 h-1 rounded-full bg-gray-300" />
                                    <div className="flex items-center gap-2">
                                        <FaMapMarkerAlt className="w-4 h-4 text-maroon/70" />
                                        <span>{selectedEvent.venue}</span>
                                    </div>
                                </>
                            )}

                            {/* Participant Type */}
                            <div className="w-1 h-1 rounded-full bg-gray-300" />
                            <div className="flex items-center gap-2">
                                <FaUsers className="w-4 h-4 text-maroon/70" />
                                <span className="capitalize">{selectedEvent.participant_type}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="flex gap-8">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`relative flex items-center gap-2 py-4 text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? 'text-maroon'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="tab-indicator"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-maroon"
                                    />
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'tabular' && <TabularTab event={selectedEvent} />}
                        {activeTab === 'participants' && <ParticipantsTab event={selectedEvent} />}
                        {activeTab === 'criteria' && <CriteriaTab event={selectedEvent} />}
                        {activeTab === 'judges' && <JudgesTab event={selectedEvent} />}
                        {activeTab === 'settings' && <SettingsTab event={selectedEvent} onEdit={() => openEditModal(selectedEvent)} onDelete={() => openDeleteModal(selectedEvent)} />}
                    </motion.div>
                </AnimatePresence>

                {/* Edit Event Modal */}
                <Modal
                    isOpen={showEditModal}
                    onClose={closeEditModal}
                    title="Edit Event"
                >
                    <div className="space-y-4">
                        <div>
                            <label className="form-label">Event Name *</label>
                            <input
                                type="text"
                                value={newEventName}
                                onChange={(e) => setNewEventName(e.target.value)}
                                placeholder="e.g., Mr. & Ms. LDCU 2024"
                                className="form-input"
                                autoFocus
                            />
                        </div>

                        {/* Start Date & Time */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="form-label">Start Date *</label>
                                <input
                                    type="date"
                                    value={newEventStartDate}
                                    onChange={(e) => setNewEventStartDate(e.target.value)}
                                    className="form-input"
                                />
                            </div>
                            <div>
                                <label className="form-label">Start Time (Optional)</label>
                                <input
                                    type="time"
                                    value={newEventStartTime}
                                    onChange={(e) => setNewEventStartTime(e.target.value)}
                                    className="form-input"
                                />
                            </div>
                        </div>

                        {/* End Date & Time */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="form-label">End Date (Optional)</label>
                                <input
                                    type="date"
                                    value={newEventEndDate}
                                    onChange={(e) => setNewEventEndDate(e.target.value)}
                                    className="form-input"
                                />
                            </div>
                            <div>
                                <label className="form-label">End Time (Optional)</label>
                                <input
                                    type="time"
                                    value={newEventEndTime}
                                    onChange={(e) => setNewEventEndTime(e.target.value)}
                                    className="form-input"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="form-label">Venue (Optional)</label>
                            <input
                                type="text"
                                value={newEventVenue}
                                onChange={(e) => setNewEventVenue(e.target.value)}
                                placeholder="e.g., LDCU Gymnasium"
                                className="form-input"
                            />
                        </div>
                        <div>
                            <label className="form-label">Description (Optional)</label>
                            <textarea
                                value={newEventDescription}
                                onChange={(e) => setNewEventDescription(e.target.value)}
                                placeholder="Add a brief description of the event..."
                                className="form-input min-h-[80px] resize-none"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button onClick={closeEditModal} className="btn-ghost flex-1">
                            Cancel
                        </button>
                        <button
                            onClick={handleEditEvent}
                            disabled={!newEventName || !newEventStartDate}
                            className="btn-primary flex-1"
                        >
                            Save Changes
                        </button>
                    </div>
                </Modal>

                {/* Delete Confirmation Modal */}
                <Modal
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    title="Delete Event"
                    size="sm"
                >
                    <div className="text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FaTrash className="w-8 h-8 text-red-600" />
                        </div>
                        <p className="text-gray-600 mb-2">Are you sure you want to delete</p>
                        <p className="font-semibold text-gray-900 text-lg mb-4">"{deletingEvent?.name}"?</p>
                        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                            ⚠️ This will also delete all categories, scores, and rankings associated with this event. This action cannot be undone.
                        </p>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setShowDeleteModal(false)} className="btn-ghost flex-1">
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteEvent}
                            className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Delete Event
                        </button>
                    </div>
                </Modal>
            </div>
        );
    }

    // Event List View
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Events</h1>
                    <p className="text-gray-500 mt-1">Manage your tabulation events</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <FaPlus className="w-4 h-4" />
                    Add Event
                </button>
            </div>

            {/* Events Grid */}
            {events.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-20 h-20 bg-maroon/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaCalendarAlt className="w-10 h-10 text-maroon" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No events yet</h3>
                    <p className="text-gray-500 mt-1">Create your first tabulation event</p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="btn-primary mt-4"
                    >
                        Create Event
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map((event, index) => (
                        <motion.div
                            key={event.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-maroon/30 transition-all duration-200 group"
                        >
                            {/* Card Header - Maroon with Date and Action Buttons */}
                            <div className="bg-gradient-to-r from-maroon to-maroon-dark p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                                            <FaCalendarAlt className="w-5 h-5 text-white" />
                                        </div>
                                        <h3 className="text-white font-bold text-lg leading-tight">
                                            {event.name}
                                        </h3>
                                    </div>
                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEditModal(event);
                                            }}
                                            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                                            title="Edit Event"
                                        >
                                            <FaEdit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openDeleteModal(event);
                                            }}
                                            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                                            title="Delete Event"
                                        >
                                            <FaTrash className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div
                                className="p-5 cursor-pointer"
                                onClick={() => handleSelectEvent(event)}
                            >
                                {/* Date and Venue */}
                                <div className="space-y-2 mb-4">
                                    <p className="text-sm text-gray-600 flex items-center gap-2">
                                        <FaCalendarAlt className="w-4 h-4 text-maroon/60" />
                                        {new Date(event.date).toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        })}
                                        {event.event_end && new Date(event.event_end).toDateString() !== new Date(event.date).toDateString() && (
                                            <> - {new Date(event.event_end).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}</>
                                        )}
                                    </p>
                                    {event.event_start && (
                                        <p className="text-sm text-gray-600 flex items-center gap-2">
                                            <FaClock className="w-4 h-4 text-maroon/60" />
                                            {new Date(event.event_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                            {event.event_end && (
                                                <> - {new Date(event.event_end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
                                            )}
                                        </p>
                                    )}
                                    {event.venue && (
                                        <p className="text-sm text-gray-600 flex items-center gap-2">
                                            <span className="w-4 text-center">📍</span>
                                            {event.venue}
                                        </p>
                                    )}
                                    {event.participant_type && (
                                        <p className="text-sm text-gray-600 flex items-center gap-2">
                                            <FaUsers className="w-4 h-4 text-maroon/60" />
                                            <span className="capitalize">{event.participant_type}</span>
                                        </p>
                                    )}
                                    {event.description && (
                                        <p className="text-sm text-gray-500 line-clamp-2 mt-2">
                                            {event.description}
                                        </p>
                                    )}
                                </div>

                                {/* Footer - View Link */}
                                <div className="flex items-center justify-end pt-3 border-t border-gray-100">
                                    <span className="text-maroon text-sm font-medium group-hover:translate-x-1 transition-transform">
                                        View Details →
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Add Event Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={closeAddModal}
                title="Create New Event"
                size="2xl"
            >
                <div className="space-y-4">
                    {/* Row 1: Event Name and Venue */}
                    <div className="grid grid-cols-1 md:grid-cols-10 gap-4">
                        <div className="md:col-span-6">
                            <label className="form-label">Event Name *</label>
                            <input
                                type="text"
                                value={newEventName}
                                onChange={(e) => setNewEventName(e.target.value)}
                                placeholder="e.g., Mr. & Ms. LDCU 2024"
                                className="form-input"
                                autoFocus
                            />
                        </div>
                        <div className="md:col-span-4">
                            <label className="form-label">Venue</label>
                            <input
                                type="text"
                                value={newEventVenue}
                                onChange={(e) => setNewEventVenue(e.target.value)}
                                placeholder="e.g., Gymnasium"
                                className="form-input"
                            />
                        </div>
                    </div>

                    {/* Combined Row 2 & 3: Dates, Times, and Participant Type */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Start Date *</label>
                                    <input
                                        type="date"
                                        value={newEventStartDate}
                                        onChange={(e) => setNewEventStartDate(e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Start Time</label>
                                    <input
                                        type="time"
                                        value={newEventStartTime}
                                        onChange={(e) => setNewEventStartTime(e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">End Date</label>
                                    <input
                                        type="date"
                                        value={newEventEndDate}
                                        onChange={(e) => setNewEventEndDate(e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">End Time</label>
                                    <input
                                        type="time"
                                        value={newEventEndTime}
                                        onChange={(e) => setNewEventEndTime(e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <label className="form-label text-maroon font-semibold">Participant Type *</label>
                            <button
                                type="button"
                                onClick={() => setNewEventParticipantType('individual')}
                                className={`w-full h-[42px] px-4 rounded-lg border text-sm font-medium transition-all ${newEventParticipantType === 'individual'
                                    ? 'bg-maroon text-white border-maroon shadow-sm'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-maroon/50 hover:text-maroon'
                                    }`}
                            >
                                Individual
                            </button>
                            <div className="h-[42px] flex items-center justify-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">— Or —</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setNewEventParticipantType('group')}
                                className={`w-full h-[42px] px-4 rounded-lg border text-sm font-medium transition-all ${newEventParticipantType === 'group'
                                    ? 'bg-maroon text-white border-maroon shadow-sm'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-maroon/50 hover:text-maroon'
                                    }`}
                            >
                                Group
                            </button>
                        </div>
                    </div>

                    {/* Row 4: Description */}
                    <div>
                        <label className="form-label">Description</label>
                        <textarea
                            value={newEventDescription}
                            onChange={(e) => setNewEventDescription(e.target.value)}
                            placeholder="Add a brief description..."
                            className="form-input min-h-[100px] resize-y"
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={closeAddModal} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={handleAddEvent}
                        disabled={!newEventName || !newEventStartDate}
                        className="btn-primary flex-1"
                    >
                        Create Event
                    </button>
                </div>
            </Modal>

            {/* Edit Event Modal */}
            <Modal
                isOpen={showEditModal}
                onClose={closeEditModal}
                title="Edit Event"
                size="2xl"
            >
                <div className="space-y-4">
                    {/* Row 1: Event Name and Venue */}
                    <div className="grid grid-cols-1 md:grid-cols-10 gap-4">
                        <div className="md:col-span-6">
                            <label className="form-label">Event Name *</label>
                            <input
                                type="text"
                                value={newEventName}
                                onChange={(e) => setNewEventName(e.target.value)}
                                placeholder="e.g., Mr. & Ms. LDCU 2024"
                                className="form-input"
                                autoFocus
                            />
                        </div>
                        <div className="md:col-span-4">
                            <label className="form-label">Venue (Optional)</label>
                            <input
                                type="text"
                                value={newEventVenue}
                                onChange={(e) => setNewEventVenue(e.target.value)}
                                placeholder="e.g., LDCU Gymnasium"
                                className="form-input"
                            />
                        </div>
                    </div>

                    {/* Combined Row 2 & 3: Dates, Times, and Participant Type */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Start Date *</label>
                                    <input
                                        type="date"
                                        value={newEventStartDate}
                                        onChange={(e) => setNewEventStartDate(e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Start Time</label>
                                    <input
                                        type="time"
                                        value={newEventStartTime}
                                        onChange={(e) => setNewEventStartTime(e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">End Date</label>
                                    <input
                                        type="date"
                                        value={newEventEndDate}
                                        onChange={(e) => setNewEventEndDate(e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">End Time</label>
                                    <input
                                        type="time"
                                        value={newEventEndTime}
                                        onChange={(e) => setNewEventEndTime(e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <label className="form-label text-maroon font-semibold">Participant Type *</label>
                            <button
                                type="button"
                                onClick={() => setNewEventParticipantType('individual')}
                                className={`w-full h-[42px] px-4 rounded-lg border text-sm font-medium transition-all ${newEventParticipantType === 'individual'
                                    ? 'bg-maroon text-white border-maroon shadow-sm'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-maroon/50 hover:text-maroon'
                                    }`}
                            >
                                Individual
                            </button>
                            <div className="h-[42px] flex items-center justify-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">— Or —</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setNewEventParticipantType('group')}
                                className={`w-full h-[42px] px-4 rounded-lg border text-sm font-medium transition-all ${newEventParticipantType === 'group'
                                    ? 'bg-maroon text-white border-maroon shadow-sm'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-maroon/50 hover:text-maroon'
                                    }`}
                            >
                                Group
                            </button>
                        </div>
                    </div>

                    {/* Row 4: Description */}
                    <div>
                        <label className="form-label">Description (Optional)</label>
                        <textarea
                            value={newEventDescription}
                            onChange={(e) => setNewEventDescription(e.target.value)}
                            placeholder="Add a brief description of the event..."
                            className="form-input min-h-[100px] resize-y"
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={closeEditModal} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={handleEditEvent}
                        disabled={!newEventName || !newEventStartDate}
                        className="btn-primary flex-1"
                    >
                        Save Changes
                    </button>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Event"
                size="sm"
            >
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaTrash className="w-8 h-8 text-red-600" />
                    </div>
                    <p className="text-gray-600 mb-2">Are you sure you want to delete</p>
                    <p className="font-semibold text-gray-900 text-lg mb-4">"{deletingEvent?.name}"?</p>
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                        ⚠️ This will also delete all categories, scores, and rankings associated with this event. This action cannot be undone.
                    </p>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowDeleteModal(false)} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={handleDeleteEvent}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Delete Event
                    </button>
                </div>
            </Modal>
        </div >
    );
};

// Tabular Tab Component
const TabularTab = ({ event }: { event: Event }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [categoryName, setCategoryName] = useState('');
    const [categoryType, setCategoryType] = useState<'scoring' | 'ranking'>('scoring');
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

    // Image upload states
    const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
    const [categoryImagePreview, setCategoryImagePreview] = useState<string>('');
    const [uploading, setUploading] = useState(false);

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

        setCategoryImageFile(file);
        setCategoryImagePreview(URL.createObjectURL(file));
    };

    const removeImage = () => {
        setCategoryImageFile(null);
        setCategoryImagePreview('');
    };

    const uploadImage = async (file: File): Promise<string | null> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${event.id}_${Date.now()}.${fileExt}`;

        const { error } = await supabase.storage
            .from('tabulation-category')
            .upload(fileName, file);

        if (error) {
            console.error('Upload error:', error);
            return null;
        }

        const { data: urlData } = supabase.storage
            .from('tabulation-category')
            .getPublicUrl(fileName);

        return urlData.publicUrl;
    };
    useEffect(() => {
        fetchCategories();
    }, [event.id]);

    const fetchCategories = async () => {
        const { data } = await supabase
            .from('categories')
            .select('*')
            .eq('event_id', event.id)
            .order('display_order');
        setCategories((data as Category[]) || []);
        setLoading(false);
    };

    const handleAddCategory = async () => {
        if (!categoryName.trim()) return;
        setUploading(true);

        let imageUrl = null;
        if (categoryImageFile) {
            imageUrl = await uploadImage(categoryImageFile);
        }

        const { error } = await supabase.from('categories').insert({
            event_id: event.id,
            name: categoryName,
            tabular_type: categoryType,
            photo_url: imageUrl,
        });

        setUploading(false);
        if (!error) {
            fetchCategories();
            closeModal();
        }
    };

    const handleEditCategory = async () => {
        if (!editingCategory || !categoryName.trim()) return;
        setUploading(true);

        let imageUrl = editingCategory.photo_url || null;
        if (categoryImageFile) {
            imageUrl = await uploadImage(categoryImageFile);
        }

        const { error } = await supabase
            .from('categories')
            .update({
                name: categoryName,
                tabular_type: categoryType,
                photo_url: imageUrl,
            })
            .eq('id', editingCategory.id);

        setUploading(false);
        if (!error) {
            fetchCategories();
            closeModal();
        }
    };

    const handleDeleteCategory = async () => {
        if (!deletingCategory) return;

        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', deletingCategory.id);

        if (!error) {
            fetchCategories();
            setShowDeleteModal(false);
            setDeletingCategory(null);
        }
    };

    const openEditModal = (category: Category) => {
        setEditingCategory(category);
        setCategoryName(category.name);
        setCategoryType(category.tabular_type);
        setCategoryImagePreview(category.photo_url || '');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingCategory(null);
        setCategoryName('');
        setCategoryType('scoring');
        setCategoryImageFile(null);
        setCategoryImagePreview('');
    };

    if (loading) {
        return <div className="text-center py-8 text-gray-500">Loading categories...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Categories</h3>
                <button
                    onClick={() => setShowModal(true)}
                    className="btn-primary text-sm flex items-center gap-2"
                >
                    <FaPlus className="w-3 h-3" />
                    Add Category
                </button>
            </div>
            {categories.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <div className="w-16 h-16 bg-maroon/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaTable className="w-8 h-8 text-maroon" />
                    </div>
                    <p className="text-gray-500">No categories yet</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="text-maroon font-medium mt-2 hover:underline"
                    >
                        Add your first category
                    </button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {categories.map((category) => (
                        <div
                            key={category.id}
                            className="relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-maroon/30 hover:shadow-lg transition-all group"
                        >
                            {/* Background Image with Overlay */}
                            <div className="relative h-48">
                                {category.photo_url ? (
                                    <>
                                        <img
                                            src={category.photo_url}
                                            alt={category.name}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                                    </>
                                ) : (
                                    <div className={`w-full h-full ${category.tabular_type === 'ranking'
                                        ? 'bg-gradient-to-br from-purple-500 to-purple-700'
                                        : 'bg-gradient-to-br from-blue-500 to-blue-700'
                                        }`}>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                                    </div>
                                )}

                                {/* Content Overlay */}
                                <div className="absolute inset-0 p-4 flex flex-col justify-between">
                                    {/* Top - Type Badge and Action Buttons */}
                                    <div className="flex justify-between items-start">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${category.tabular_type === 'ranking'
                                            ? 'bg-purple-500/90 text-white'
                                            : 'bg-blue-500/90 text-white'
                                            }`}>
                                            {category.tabular_type === 'ranking' ? 'Ranking' : 'Scoring'}
                                        </span>

                                        {/* Action Buttons - Always Visible */}
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => openEditModal(category)}
                                                className="p-2 bg-white/90 backdrop-blur-sm text-maroon rounded-lg hover:bg-white transition-colors shadow-lg"
                                                title="Edit Category"
                                            >
                                                <FaEdit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setDeletingCategory(category);
                                                    setShowDeleteModal(true);
                                                }}
                                                className="p-2 bg-white/90 backdrop-blur-sm text-red-600 rounded-lg hover:bg-white transition-colors shadow-lg"
                                                title="Delete Category"
                                            >
                                                <FaTrash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Bottom - Category Name */}
                                    <div>
                                        <h3 className="text-white font-bold text-lg leading-tight mb-2 drop-shadow-lg">
                                            {category.name}
                                        </h3>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Category Modal */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title={editingCategory ? 'Edit Category' : 'Add New Category'}
            >
                <div className="space-y-4">
                    <div>
                        <label className="form-label">Category Name *</label>
                        <input
                            type="text"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            placeholder="e.g., Best in Talent"
                            className="form-input"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="form-label">Tabulation Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setCategoryType('scoring')}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${categoryType === 'scoring'
                                    ? 'border-maroon bg-maroon/5'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <p className="font-medium text-gray-900">Scoring</p>
                                <p className="text-xs text-gray-500 mt-1">Percentage-based (100%)</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategoryType('ranking')}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${categoryType === 'ranking'
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <p className="font-medium text-gray-900">Ranking</p>
                                <p className="text-xs text-gray-500 mt-1">Point-based (1-10)</p>
                            </button>
                        </div>
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label className="form-label">Category Image (Optional)</label>
                        {categoryImagePreview ? (
                            <div className="relative inline-block">
                                <img
                                    src={categoryImagePreview}
                                    alt="Category preview"
                                    className="w-32 h-32 object-cover rounded-xl border-2 border-gray-200"
                                />
                                <button
                                    type="button"
                                    onClick={removeImage}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                                >
                                    <FaTimes className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-maroon/50 hover:bg-gray-50 transition-all">
                                <FaImage className="w-8 h-8 text-gray-400 mb-2" />
                                <span className="text-sm text-gray-500">Click to upload image</span>
                                <span className="text-xs text-gray-400 mt-1">JPG or PNG, max 5MB</span>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={closeModal} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={editingCategory ? handleEditCategory : handleAddCategory}
                        disabled={!categoryName.trim() || uploading}
                        className="btn-primary flex-1"
                    >
                        {uploading ? 'Uploading...' : editingCategory ? 'Save Changes' : 'Add Category'}
                    </button>
                </div>
            </Modal>

            {/* Delete Category Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Category"
                size="sm"
            >
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaTrash className="w-8 h-8 text-red-600" />
                    </div>
                    <p className="text-gray-600 mb-4">
                        Delete category <strong>"{deletingCategory?.name}"</strong>?
                    </p>
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                        ⚠️ All scores for this category will also be deleted.
                    </p>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowDeleteModal(false)} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={handleDeleteCategory}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </Modal>
        </div>
    );
};

// Participants Tab Component
const ParticipantsTab = ({ event }: { event: Event }) => {
    const [contestants, setContestants] = useState<Contestant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [contestantName, setContestantName] = useState('');
    const [contestantDept, setContestantDept] = useState('');
    const [contestantGender, setContestantGender] = useState<'male' | 'female' | 'other' | ''>('');
    const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingContestant, setDeletingContestant] = useState<Contestant | null>(null);

    // Image upload states
    const [contestantImageFile, setContestantImageFile] = useState<File | null>(null);
    const [contestantImagePreview, setContestantImagePreview] = useState<string>('');
    const [uploading, setUploading] = useState(false);

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

        setContestantImageFile(file);
        setContestantImagePreview(URL.createObjectURL(file));
    };

    const removeImage = () => {
        setContestantImageFile(null);
        setContestantImagePreview('');
    };

    const uploadImage = async (file: File): Promise<string | null> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${event.id}_${Date.now()}.${fileExt}`;

        const { error } = await supabase.storage
            .from('tabulation-contestant')
            .upload(fileName, file);

        if (error) {
            console.error('Upload error:', error);
            return null;
        }

        const { data: urlData } = supabase.storage
            .from('tabulation-contestant')
            .getPublicUrl(fileName);

        return urlData.publicUrl;
    };

    // Helper to get participant label based on event type
    const getParticipantLabel = () => {
        return event.participant_type === 'individual' ? 'Participant' : 'Group';
    };

    // Check if event type is individual (show gender field)
    const isIndividual = event.participant_type === 'individual';

    useEffect(() => {
        fetchContestants();
    }, [event.id]);

    const fetchContestants = async () => {
        const { data } = await supabase
            .from('contestants')
            .select('*')
            .eq('event_id', event.id)
            .order('contestant_number');
        setContestants((data as Contestant[]) || []);
        setLoading(false);
    };

    const handleAddContestant = async () => {
        if (!contestantName.trim() || !contestantDept.trim()) return;
        setUploading(true);

        let photoUrl = null;
        if (contestantImageFile) {
            photoUrl = await uploadImage(contestantImageFile);
        }

        const insertData: any = {
            name: contestantName,
            department: contestantDept,
            contestant_number: contestants.length + 1,
            event_id: event.id,
        };

        // Add gender for individual participants
        if (isIndividual && contestantGender) {
            insertData.gender = contestantGender;
        }

        // Add photo URL if uploaded
        if (photoUrl) {
            insertData.photo_url = photoUrl;
        }

        const { error } = await supabase.from('contestants').insert(insertData);

        setUploading(false);
        if (!error) {
            fetchContestants();
            closeModal();
        }
    };

    const handleEditContestant = async () => {
        if (!editingContestant || !contestantName.trim() || !contestantDept.trim()) return;
        setUploading(true);

        let photoUrl = editingContestant.photo_url || null;
        if (contestantImageFile) {
            photoUrl = await uploadImage(contestantImageFile);
        }

        const updateData: any = {
            name: contestantName,
            department: contestantDept,
        };

        // Add gender for individual participants
        if (isIndividual) {
            updateData.gender = contestantGender || null;
        }

        // Add photo URL
        updateData.photo_url = photoUrl;

        const { error } = await supabase
            .from('contestants')
            .update(updateData)
            .eq('id', editingContestant.id);

        setUploading(false);
        if (!error) {
            fetchContestants();
            closeModal();
        }
    };

    const handleDeleteContestant = async () => {
        if (!deletingContestant) return;

        const { error } = await supabase
            .from('contestants')
            .delete()
            .eq('id', deletingContestant.id);

        if (!error) {
            fetchContestants();
            setShowDeleteModal(false);
            setDeletingContestant(null);
        }
    };

    const openEditModal = (contestant: Contestant) => {
        setEditingContestant(contestant);
        setContestantName(contestant.name);
        setContestantDept(contestant.department);
        setContestantGender(contestant.gender || '');
        setContestantImagePreview(contestant.photo_url || '');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingContestant(null);
        setContestantName('');
        setContestantDept('');
        setContestantGender('');
        setContestantImageFile(null);
        setContestantImagePreview('');
    };

    if (loading) {
        return <div className="text-center py-8 text-gray-500">Loading participants...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-gray-900">{getParticipantLabel()}s</h3>
                    <p className="text-sm text-gray-500">
                        {event.participant_type === 'individual' ? 'Individual participants' : 'Group participants'}
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="btn-primary text-sm flex items-center gap-2"
                >
                    <FaPlus className="w-3 h-3" />
                    Add {getParticipantLabel()}
                </button>
            </div>
            {contestants.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <div className="w-16 h-16 bg-maroon/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaUsers className="w-8 h-8 text-maroon" />
                    </div>
                    <p className="text-gray-500">No {getParticipantLabel().toLowerCase()}s yet</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="text-maroon font-medium mt-2 hover:underline"
                    >
                        Add your first {getParticipantLabel().toLowerCase()}
                    </button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {contestants.map((contestant) => (
                        <div
                            key={contestant.id}
                            className="bg-white border border-gray-200 rounded-xl p-4 hover:border-maroon/30 hover:shadow-md transition-all"
                        >
                            <div className="flex items-start gap-4">
                                {/* Avatar */}
                                <div className="flex-shrink-0">
                                    {contestant.photo_url ? (
                                        <img
                                            src={contestant.photo_url}
                                            alt={contestant.name}
                                            className="w-16 h-16 rounded-full object-cover border-3 border-maroon/20 shadow-sm"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-maroon to-maroon-dark flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                            {contestant.contestant_number || contestant.name.charAt(0)}
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 truncate">{contestant.name}</p>
                                            {isIndividual && contestant.gender && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${contestant.gender === 'male'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : contestant.gender === 'female'
                                                        ? 'bg-pink-100 text-pink-700'
                                                        : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {contestant.gender === 'male' ? '♂ Male' : contestant.gender === 'female' ? '♀ Female' : 'Other'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-1 flex-shrink-0">
                                            <button
                                                onClick={() => openEditModal(contestant)}
                                                className="p-2 text-gray-400 hover:text-maroon rounded-lg hover:bg-gray-100 transition-colors"
                                                title="Edit"
                                            >
                                                <FaEdit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setDeletingContestant(contestant);
                                                    setShowDeleteModal(true);
                                                }}
                                                className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 transition-colors"
                                                title="Delete"
                                            >
                                                <FaTrash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 truncate">{contestant.department}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Participant Modal */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title={editingContestant ? `Edit ${getParticipantLabel()}` : `Add New ${getParticipantLabel()}`}
            >
                <div className="space-y-4">
                    <div>
                        <label className="form-label">{getParticipantLabel()} Name *</label>
                        <input
                            type="text"
                            value={contestantName}
                            onChange={(e) => setContestantName(e.target.value)}
                            placeholder={isIndividual ? "Enter full name" : `Enter ${getParticipantLabel().toLowerCase()} name`}
                            className="form-input"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="form-label">Department/College *</label>
                        <input
                            type="text"
                            value={contestantDept}
                            onChange={(e) => setContestantDept(e.target.value)}
                            placeholder="e.g., College of Engineering"
                            className="form-input"
                        />
                    </div>

                    {/* Gender field - only for individual participants */}
                    {isIndividual && (
                        <div>
                            <label className="form-label">Gender</label>
                            <div className="flex gap-3">
                                {[
                                    { value: 'male', label: 'Male', icon: '♂' },
                                    { value: 'female', label: 'Female', icon: '♀' },
                                ].map((gender) => (
                                    <button
                                        key={gender.value}
                                        type="button"
                                        onClick={() => setContestantGender(gender.value as any)}
                                        className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-all ${contestantGender === gender.value
                                            ? gender.value === 'male'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : gender.value === 'female'
                                                    ? 'border-pink-500 bg-pink-50 text-pink-700'
                                                    : 'border-gray-500 bg-gray-50 text-gray-700'
                                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                            }`}
                                    >
                                        {gender.icon} {gender.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Photo Upload */}
                    <div>
                        <label className="form-label">Photo (Optional)</label>
                        {contestantImagePreview ? (
                            <div className="relative inline-block">
                                <img
                                    src={contestantImagePreview}
                                    alt="Participant preview"
                                    className="w-24 h-24 object-cover rounded-full border-2 border-gray-200"
                                />
                                <button
                                    type="button"
                                    onClick={removeImage}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                                >
                                    <FaTimes className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-maroon/50 hover:bg-gray-50 transition-all">
                                <FaImage className="w-8 h-8 text-gray-400 mb-2" />
                                <span className="text-sm text-gray-500">Click to upload photo</span>
                                <span className="text-xs text-gray-400 mt-1">JPG or PNG, max 5MB</span>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={closeModal} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={editingContestant ? handleEditContestant : handleAddContestant}
                        disabled={!contestantName.trim() || !contestantDept.trim() || uploading}
                        className="btn-primary flex-1"
                    >
                        {uploading ? 'Uploading...' : editingContestant ? 'Save Changes' : `Add ${getParticipantLabel()}`}
                    </button>
                </div>
            </Modal>

            {/* Delete Participant Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title={`Delete ${getParticipantLabel()}`}
                size="sm"
            >
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaTrash className="w-8 h-8 text-red-600" />
                    </div>
                    <p className="text-gray-600">
                        Delete {getParticipantLabel().toLowerCase()} <strong>"{deletingContestant?.name}"</strong>?
                    </p>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowDeleteModal(false)} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={handleDeleteContestant}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </Modal>
        </div>
    );
};

// Criteria Tab Component - Shows sub-criteria per category (direct sub-criteria without intermediate criteria layer)
const CriteriaTab = ({ event }: { event: Event }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [subCriteria, setSubCriteria] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states for Sub-Criteria (now the main criteria items)
    const [showSubCriteriaModal, setShowSubCriteriaModal] = useState(false);
    const [editingSubCriteria, setEditingSubCriteria] = useState<any | null>(null);
    const [subCriteriaName, setSubCriteriaName] = useState('');
    const [subCriteriaDescription, setSubCriteriaDescription] = useState('');
    const [subCriteriaPercentage, setSubCriteriaPercentage] = useState('');
    const [subCriteriaMinScore, setSubCriteriaMinScore] = useState('');
    const [subCriteriaMaxScore, setSubCriteriaMaxScore] = useState('');

    // Delete confirmation
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingItem, setDeletingItem] = useState<any | null>(null);

    useEffect(() => {
        fetchCategories();
    }, [event.id]);

    useEffect(() => {
        if (selectedCategory) {
            fetchSubCriteria(selectedCategory.id);
        }
    }, [selectedCategory]);

    const fetchCategories = async () => {
        const { data } = await supabase
            .from('categories')
            .select('*')
            .eq('event_id', event.id)
            .order('display_order');
        const cats = (data as Category[]) || [];
        setCategories(cats);
        if (cats.length > 0 && !selectedCategory) {
            setSelectedCategory(cats[0]);
        }
        setLoading(false);
    };

    const fetchSubCriteria = async (categoryId: number) => {
        setLoading(true);
        // Fetch criteria directly linked to the category (these act as the main scoring items)
        const { data } = await supabase
            .from('category_criteria')
            .select('*')
            .eq('category_id', categoryId)
            .eq('is_active', true)
            .order('display_order');
        setSubCriteria(data || []);
        setLoading(false);
    };

    // Calculate total percentage
    const totalPercentage = subCriteria.reduce((sum, c) => sum + (c.percentage || 0), 0);

    // CRUD for Sub-Criteria (main criteria items under category)
    const openAddSubCriteriaModal = () => {
        setEditingSubCriteria(null);
        setSubCriteriaName('');
        setSubCriteriaDescription('');
        setSubCriteriaPercentage('');
        // Set default min/max from category for ranking-based
        setSubCriteriaMinScore(selectedCategory?.tabular_type === 'ranking' ? String(selectedCategory?.score_min || 1) : '');
        setSubCriteriaMaxScore(selectedCategory?.tabular_type === 'ranking' ? String(selectedCategory?.score_max || 10) : '');
        setShowSubCriteriaModal(true);
    };

    const openEditSubCriteriaModal = (sub: any) => {
        setEditingSubCriteria(sub);
        setSubCriteriaName(sub.name || '');
        setSubCriteriaDescription(sub.description || '');
        setSubCriteriaPercentage(sub.percentage?.toString() || '');
        setSubCriteriaMinScore(sub.min_score?.toString() || String(selectedCategory?.score_min || 1));
        setSubCriteriaMaxScore(sub.max_score?.toString() || String(selectedCategory?.score_max || 10));
        setShowSubCriteriaModal(true);
    };

    const closeSubCriteriaModal = () => {
        setShowSubCriteriaModal(false);
        setEditingSubCriteria(null);
    };

    const handleSaveSubCriteria = async () => {
        if (!subCriteriaName.trim() || !selectedCategory) return;

        const isRanking = selectedCategory.tabular_type === 'ranking';

        const subData = {
            category_id: selectedCategory.id,
            name: subCriteriaName.trim(),
            description: subCriteriaDescription.trim() || null,
            percentage: isRanking ? 0 : (parseInt(subCriteriaPercentage) || 0),
            min_score: isRanking ? (parseInt(subCriteriaMinScore) || selectedCategory.score_min || 1) : null,
            max_score: isRanking ? (parseInt(subCriteriaMaxScore) || selectedCategory.score_max || 10) : null,
            display_order: editingSubCriteria ? editingSubCriteria.display_order : subCriteria.length,
        };

        if (editingSubCriteria) {
            await supabase
                .from('category_criteria')
                .update(subData)
                .eq('id', editingSubCriteria.id);
        } else {
            await supabase.from('category_criteria').insert(subData);
        }

        fetchSubCriteria(selectedCategory.id);
        closeSubCriteriaModal();
    };

    // Delete handlers
    const openDeleteModal = (item: any) => {
        setDeletingItem(item);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!deletingItem) return;

        await supabase
            .from('category_criteria')
            .update({ is_active: false })
            .eq('id', deletingItem.id);

        if (selectedCategory) fetchSubCriteria(selectedCategory.id);

        setShowDeleteModal(false);
        setDeletingItem(null);
    };

    if (loading && categories.length === 0) {
        return <div className="text-center py-8 text-gray-500">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Category Tabs - Responsive Grid */}
            {categories.length > 0 ? (
                <div className="bg-gray-100 p-1.5 rounded-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-1.5">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${selectedCategory?.id === cat.id
                                    ? 'bg-white text-maroon shadow-md ring-1 ring-black/5'
                                    : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-white/50'
                                    }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <div className="w-16 h-16 bg-maroon/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaClipboardList className="w-8 h-8 text-maroon" />
                    </div>
                    <p className="text-gray-600 font-medium">No categories available</p>
                    <p className="text-sm text-gray-500 mt-1">Create a category first in the Categories tab</p>
                </div>
            )}

            {/* Criteria Content */}
            {selectedCategory && (
                <div className="space-y-6">
                    {/* Header Section */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                                <h3 className="text-xl font-bold text-gray-900">
                                    {selectedCategory.name}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${selectedCategory.tabular_type === 'ranking'
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>
                                        {selectedCategory.tabular_type === 'ranking' ? 'Ranking' : 'Scoring'}
                                    </span>
                                    {selectedCategory.tabular_type === 'scoring' ? (
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-gray-400">|</span>
                                            <span className="text-gray-600">Total:</span>
                                            <span className={`font-bold ${totalPercentage === 100 ? 'text-green-600' : 'text-orange-500'
                                                }`}>
                                                {totalPercentage}%
                                            </span>
                                            {totalPercentage !== 100 && (
                                                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                                                    Target: 100%
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <span className="text-gray-400">|</span>
                                            <span>Range: {selectedCategory.score_min || 1} - {selectedCategory.score_max || 10} pts</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={openAddSubCriteriaModal}
                            className="btn-primary flex items-center justify-center gap-2 flex-shrink-0 w-full sm:w-auto"
                        >
                            <FaPlus className="w-3.5 h-3.5" />
                            Add Criteria
                        </button>
                    </div>

                    {/* Criteria List - Simple Single Row */}
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="w-8 h-8 border-4 border-maroon/20 border-t-maroon rounded-full animate-spin mx-auto" />
                            <p className="text-gray-500 mt-3">Loading criteria...</p>
                        </div>
                    ) : subCriteria.length === 0 ? (
                        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                            <p className="text-gray-500 mb-4">No criteria added yet</p>
                            <button
                                onClick={openAddSubCriteriaModal}
                                className="text-maroon font-semibold hover:underline"
                            >
                                Add first criteria
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {subCriteria.map((sub, index) => (
                                <div
                                    key={sub.id}
                                    className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-white border border-gray-200 rounded-lg p-3 hover:border-maroon/30 hover:shadow-sm transition-all"
                                >
                                    {/* Left: Number & Name */}
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 text-gray-500 font-bold flex items-center justify-center text-sm group-hover:bg-maroon/10 group-hover:text-maroon transition-colors">
                                            {index + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 truncate">{sub.name}</p>
                                            {sub.description && (
                                                <p className="text-xs text-gray-500 truncate">{sub.description}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Value & Actions */}
                                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                                        <div className="flex-shrink-0">
                                            {selectedCategory?.tabular_type === 'scoring' ? (
                                                <div className="px-3 py-1 rounded-md bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-700 min-w-[60px] text-center group-hover:border-maroon/20 group-hover:bg-maroon/5 group-hover:text-maroon transition-colors">
                                                    {sub.percentage}%
                                                </div>
                                            ) : (
                                                <div className="px-3 py-1 rounded-md bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600 group-hover:border-purple-200 group-hover:bg-purple-50 group-hover:text-purple-700 transition-colors">
                                                    {sub.min_score || selectedCategory?.score_min || 1}-{sub.max_score || selectedCategory?.score_max || 10} pts
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openEditSubCriteriaModal(sub)}
                                                className="p-1.5 text-gray-400 hover:text-maroon hover:bg-gray-100 rounded-md transition-colors"
                                                title="Edit"
                                            >
                                                <FaEdit className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => openDeleteModal(sub)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-md transition-colors"
                                                title="Delete"
                                            >
                                                <FaTrash className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Criteria Modal */}
            <Modal
                isOpen={showSubCriteriaModal}
                onClose={closeSubCriteriaModal}
                title={editingSubCriteria ? 'Edit Criteria' : 'Add New Criteria'}
            >
                <div className="space-y-4">
                    <div>
                        <label className="form-label">Criteria Name *</label>
                        <input
                            type="text"
                            value={subCriteriaName}
                            onChange={(e) => setSubCriteriaName(e.target.value)}
                            placeholder="e.g., Beauty, Talent, Poise"
                            className="form-input"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="form-label">Description (Optional)</label>
                        <textarea
                            value={subCriteriaDescription}
                            onChange={(e) => setSubCriteriaDescription(e.target.value)}
                            placeholder="Brief description of this criteria..."
                            className="form-input min-h-[60px] resize-none"
                        />
                    </div>
                    {selectedCategory?.tabular_type === 'scoring' ? (
                        <div>
                            <label className="form-label">Percentage Weight *</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={subCriteriaPercentage}
                                onChange={(e) => setSubCriteriaPercentage(e.target.value)}
                                placeholder="e.g., 25"
                                className="form-input"
                            />
                            <p className="text-xs text-gray-500 mt-1">All criteria percentages should total 100%</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="form-label">Min Score *</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={subCriteriaMinScore}
                                    onChange={(e) => setSubCriteriaMinScore(e.target.value)}
                                    placeholder={String(selectedCategory?.score_min || 1)}
                                    className="form-input"
                                />
                            </div>
                            <div>
                                <label className="form-label">Max Score *</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={subCriteriaMaxScore}
                                    onChange={(e) => setSubCriteriaMaxScore(e.target.value)}
                                    placeholder={String(selectedCategory?.score_max || 10)}
                                    className="form-input"
                                />
                            </div>
                            <p className="text-xs text-gray-500 col-span-2">
                                Judges will score each contestant from {subCriteriaMinScore || selectedCategory?.score_min || 1} to {subCriteriaMaxScore || selectedCategory?.score_max || 10} points for this criteria
                            </p>
                        </div>
                    )}
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={closeSubCriteriaModal} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveSubCriteria}
                        disabled={!subCriteriaName.trim() || (selectedCategory?.tabular_type === 'scoring' && !subCriteriaPercentage)}
                        className="btn-primary flex-1"
                    >
                        {editingSubCriteria ? 'Save Changes' : 'Add Criteria'}
                    </button>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Criteria"
                size="sm"
            >
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaTrash className="w-8 h-8 text-red-600" />
                    </div>
                    <p className="text-gray-600 mb-2">Are you sure you want to delete</p>
                    <p className="font-semibold text-gray-900 text-lg mb-4">
                        "{deletingItem?.name}"?
                    </p>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowDeleteModal(false)} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </Modal>
        </div>
    );
};


// Judges Tab Component - Manage judges for this event
const JudgesTab = ({ event }: { event: Event }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [judges, setJudges] = useState<Judge[]>([]);
    const [assignedJudges, setAssignedJudges] = useState<Record<number, number[]>>({}); // categoryId -> judgeIds
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<number | null>(null);

    // Modal states
    const [showJudgeModal, setShowJudgeModal] = useState(false);
    const [editingJudge, setEditingJudge] = useState<Judge | null>(null);
    const [judgeName, setJudgeName] = useState('');
    const [judgeTitle, setJudgeTitle] = useState('');
    const [judgeAffiliation, setJudgeAffiliation] = useState('');

    // Assignment modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

    // Delete modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingJudge, setDeletingJudge] = useState<Judge | null>(null);

    useEffect(() => {
        fetchData();
    }, [event.id]);

    const fetchData = async () => {
        setLoading(true);

        // Fetch categories for this event
        const { data: categoriesData } = await supabase
            .from('categories')
            .select('*')
            .eq('event_id', event.id)
            .order('display_order');
        setCategories((categoriesData as Category[]) || []);

        // Fetch judges assigned to categories of this event
        if (categoriesData && categoriesData.length > 0) {
            const categoryIds = categoriesData.map((c: Category) => c.id);

            // Get judge IDs that are assigned to this event's categories
            const { data: assignmentsData } = await supabase
                .from('judge_assignments')
                .select('judge_id')
                .in('category_id', categoryIds)
                .eq('is_active', true);

            const assignedJudgeIds = [...new Set((assignmentsData || []).map((a: any) => a.judge_id))];

            if (assignedJudgeIds.length > 0) {
                const { data: judgesData } = await supabase
                    .from('judges')
                    .select('*')
                    .in('id', assignedJudgeIds)
                    .eq('is_active', true)
                    .order('name');
                setJudges((judgesData as Judge[]) || []);
            } else {
                setJudges([]);
            }
        } else {
            setJudges([]);
        }

        // Fetch judge assignments for all categories of this event
        if (categoriesData && categoriesData.length > 0) {
            const categoryIds = categoriesData.map((c: Category) => c.id);
            const { data: assignmentsData } = await supabase
                .from('judge_assignments')
                .select('*')
                .in('category_id', categoryIds)
                .eq('is_active', true);

            // Group assignments by category_id
            const grouped: Record<number, number[]> = {};
            (assignmentsData || []).forEach((a: any) => {
                if (!grouped[a.category_id]) grouped[a.category_id] = [];
                grouped[a.category_id].push(a.judge_id);
            });
            setAssignedJudges(grouped);
        }

        setLoading(false);
    };

    const generateCode = () => {
        return 'JUDGE' + Math.random().toString(36).substring(2, 6).toUpperCase();
    };

    const handleCopyCode = (judge: Judge) => {
        navigator.clipboard.writeText(judge.code);
        setCopiedId(judge.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Judge CRUD
    const openAddJudgeModal = () => {
        setEditingJudge(null);
        setJudgeName('');
        setJudgeTitle('');
        setJudgeAffiliation('');
        setShowJudgeModal(true);
    };

    const openEditJudgeModal = (judge: Judge) => {
        setEditingJudge(judge);
        setJudgeName(judge.name);
        setJudgeTitle(judge.title || '');
        setJudgeAffiliation(judge.affiliation || '');
        setShowJudgeModal(true);
    };

    const closeJudgeModal = () => {
        setShowJudgeModal(false);
        setEditingJudge(null);
    };

    const handleSaveJudge = async () => {
        if (!judgeName.trim()) return;

        if (editingJudge) {
            await supabase
                .from('judges')
                .update({
                    name: judgeName.trim(),
                    title: judgeTitle.trim() || null,
                    affiliation: judgeAffiliation.trim() || null,
                })
                .eq('id', editingJudge.id);
        } else {
            const code = generateCode();
            // Create judge without event_id (database column may not exist)
            await supabase.from('judges').insert({
                name: judgeName.trim(),
                title: judgeTitle.trim() || null,
                affiliation: judgeAffiliation.trim() || null,
                code,
            });
        }

        fetchData();
        closeJudgeModal();
    };

    const handleDeleteJudge = async () => {
        if (!deletingJudge) return;

        await supabase
            .from('judges')
            .update({ is_active: false })
            .eq('id', deletingJudge.id);

        fetchData();
        setShowDeleteModal(false);
        setDeletingJudge(null);
    };

    // Assignment handling
    const openAssignModal = (category: Category) => {
        setSelectedCategory(category);
        setShowAssignModal(true);
    };

    const toggleJudgeAssignment = async (judgeId: number, categoryId: number) => {
        const isCurrentlyAssigned = assignedJudges[categoryId]?.includes(judgeId);

        if (isCurrentlyAssigned) {
            // Remove assignment
            await supabase
                .from('judge_assignments')
                .delete()
                .eq('judge_id', judgeId)
                .eq('category_id', categoryId);
        } else {
            // Add assignment
            await supabase.from('judge_assignments').insert({
                judge_id: judgeId,
                category_id: categoryId,
            });
        }

        fetchData();
    };

    const getAssignedJudgesForCategory = (categoryId: number): Judge[] => {
        const judgeIds = assignedJudges[categoryId] || [];
        return judges.filter(j => judgeIds.includes(j.id));
    };

    if (loading) {
        return <div className="text-center py-8 text-gray-500">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-gray-900">Judges</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage judges and their category assignments for this event
                    </p>
                </div>
                <button
                    onClick={openAddJudgeModal}
                    className="btn-primary text-sm flex items-center gap-2"
                >
                    <FaPlus className="w-3 h-3" />
                    Add Judge
                </button>
            </div>

            {/* Judges Grid */}
            {judges.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <div className="w-16 h-16 bg-maroon/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaUserTie className="w-8 h-8 text-maroon" />
                    </div>
                    <p className="text-gray-500">No judges yet</p>
                    <button
                        onClick={openAddJudgeModal}
                        className="text-maroon font-medium mt-2 hover:underline"
                    >
                        Add your first judge
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {judges.map((judge) => (
                        <div
                            key={judge.id}
                            className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                        >
                            {/* Card Header */}
                            <div className="bg-gradient-to-r from-maroon to-maroon-dark p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold">
                                        {judge.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="text-white flex-1 min-w-0">
                                        <h4 className="font-semibold truncate">
                                            {judge.title ? `${judge.title} ` : ''}{judge.name}
                                        </h4>
                                        <p className="text-white/70 text-sm truncate">
                                            {judge.affiliation || 'Judge'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-4">
                                {/* Access Code */}
                                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                                    <p className="text-xs text-gray-500 mb-1">Access Code</p>
                                    <div className="flex items-center justify-between">
                                        <code className="font-mono font-bold text-maroon">
                                            {judge.code}
                                        </code>
                                        <button
                                            onClick={() => handleCopyCode(judge)}
                                            className="p-1.5 text-gray-400 hover:text-maroon rounded hover:bg-white transition-colors"
                                            title="Copy code"
                                        >
                                            {copiedId === judge.id ? (
                                                <FaCheck className="w-3 h-3 text-green-500" />
                                            ) : (
                                                <FaCopy className="w-3 h-3" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openEditJudgeModal(judge)}
                                        className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1"
                                    >
                                        <FaEdit className="w-3 h-3" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDeletingJudge(judge);
                                            setShowDeleteModal(true);
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                    >
                                        <FaTrash className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Category Assignments Section */}
            {categories.length > 0 && judges.length > 0 && (
                <div className="mt-8">
                    <h3 className="font-semibold text-gray-900 mb-4">Category Assignments</h3>
                    <div className="space-y-3">
                        {categories.map((category) => {
                            const assignedList = getAssignedJudgesForCategory(category.id);
                            return (
                                <div
                                    key={category.id}
                                    className="bg-white border border-gray-200 rounded-xl p-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium text-gray-900">{category.name}</h4>
                                            <p className="text-sm text-gray-500">
                                                {assignedList.length} judge{assignedList.length !== 1 ? 's' : ''} assigned
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => openAssignModal(category)}
                                            className="btn-secondary text-sm"
                                        >
                                            Manage Judges
                                        </button>
                                    </div>
                                    {assignedList.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {assignedList.map((judge) => (
                                                <span
                                                    key={judge.id}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-maroon/10 text-maroon text-sm rounded-full"
                                                >
                                                    <FaUserTie className="w-3 h-3" />
                                                    {judge.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Add/Edit Judge Modal */}
            <Modal
                isOpen={showJudgeModal}
                onClose={closeJudgeModal}
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
                    <div>
                        <label className="form-label">Title (Optional)</label>
                        <input
                            type="text"
                            value={judgeTitle}
                            onChange={(e) => setJudgeTitle(e.target.value)}
                            placeholder="e.g., Dr., Prof., Ms."
                            className="form-input"
                        />
                    </div>
                    <div>
                        <label className="form-label">Affiliation (Optional)</label>
                        <input
                            type="text"
                            value={judgeAffiliation}
                            onChange={(e) => setJudgeAffiliation(e.target.value)}
                            placeholder="e.g., LDCU College of Arts"
                            className="form-input"
                        />
                    </div>
                    {!editingJudge && (
                        <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                            💡 A unique access code will be generated automatically.
                        </p>
                    )}
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={closeJudgeModal} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveJudge}
                        disabled={!judgeName.trim()}
                        className="btn-primary flex-1"
                    >
                        {editingJudge ? 'Update Judge' : 'Add Judge'}
                    </button>
                </div>
            </Modal>

            {/* Assign Judges Modal */}
            <Modal
                isOpen={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                title={`Assign Judges to "${selectedCategory?.name}"`}
            >
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {judges.map((judge) => {
                        const isAssigned = selectedCategory
                            ? assignedJudges[selectedCategory.id]?.includes(judge.id)
                            : false;
                        return (
                            <div
                                key={judge.id}
                                onClick={() => selectedCategory && toggleJudgeAssignment(judge.id, selectedCategory.id)}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${isAssigned
                                    ? 'bg-maroon/10 border-2 border-maroon'
                                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                    }`}
                            >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isAssigned ? 'border-maroon bg-maroon' : 'border-gray-300'
                                    }`}>
                                    {isAssigned && <FaCheck className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">
                                        {judge.title ? `${judge.title} ` : ''}{judge.name}
                                    </p>
                                    <p className="text-sm text-gray-500">{judge.affiliation || 'Judge'}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowAssignModal(false)} className="btn-primary flex-1">
                        Done
                    </button>
                </div>
            </Modal>

            {/* Delete Judge Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Judge"
                size="sm"
            >
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaTrash className="w-8 h-8 text-red-600" />
                    </div>
                    <p className="text-gray-600 mb-2">Are you sure you want to delete</p>
                    <p className="font-semibold text-gray-900 text-lg mb-4">
                        "{deletingJudge?.name}"?
                    </p>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowDeleteModal(false)} className="btn-ghost flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={handleDeleteJudge}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </Modal>
        </div>
    );
};

// Settings Tab Component
const SettingsTab = ({ event, onEdit, onDelete }: { event: Event; onEdit: () => void; onDelete: () => void }) => {
    return (
        <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Event Information</h3>
                <div className="grid gap-4">
                    <div className="flex justify-between py-3 border-b border-gray-100">
                        <span className="text-gray-500">Name</span>
                        <span className="font-medium">{event.name}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-gray-100">
                        <span className="text-gray-500">Date</span>
                        <span className="font-medium">{new Date(event.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-gray-100">
                        <span className="text-gray-500">Venue</span>
                        <span className="font-medium">{event.venue || '-'}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-gray-100">
                        <span className="text-gray-500">Status</span>
                        <span className={`badge ${event.status === 'ongoing' ? 'badge-success' :
                            event.status === 'completed' ? 'badge-info' :
                                'badge-warning'
                            }`}>
                            {event.status || 'draft'}
                        </span>
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onEdit} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                        <FaEdit className="w-4 h-4" />
                        Edit Event
                    </button>
                </div>
            </div>

            <div className="bg-white border border-red-200 rounded-xl p-6">
                <h3 className="font-semibold text-red-600 mb-2">Danger Zone</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Once you delete an event, there is no going back. This will permanently delete all categories, scores, and rankings.
                </p>
                <button
                    onClick={onDelete}
                    className="px-4 py-2 bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2"
                >
                    <FaTrash className="w-4 h-4" />
                    Delete this event
                </button>
            </div>
        </div>
    );
};

export default EventsPage;
