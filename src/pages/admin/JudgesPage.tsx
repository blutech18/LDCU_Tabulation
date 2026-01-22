import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaCopy, FaCheck, FaUserTie } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/common/Modal';
import type { Judge } from '../../types';

const JudgesPage = () => {
    const [judges, setJudges] = useState<Judge[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingJudge, setEditingJudge] = useState<Judge | null>(null);
    const [judgeName, setJudgeName] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);

    useEffect(() => {
        fetchJudges();
    }, []);

    const fetchJudges = async () => {
        const { data, error } = await supabase
            .from('judges')
            .select('*')
            .order('name');
        if (!error && data) {
            setJudges(data as Judge[]);
        }
        setLoading(false);
    };

    const generateCode = () => {
        return 'JUDGE' + Math.random().toString(36).substring(2, 6).toUpperCase();
    };

    const handleAddJudge = async () => {
        if (!judgeName.trim()) return;

        const code = generateCode();
        const { error } = await supabase.from('judges').insert({
            name: judgeName,
            code,
        });

        if (!error) {
            fetchJudges();
            closeModal();
        }
    };

    const handleUpdateJudge = async () => {
        if (!editingJudge || !judgeName.trim()) return;

        const { error } = await supabase
            .from('judges')
            .update({
                name: judgeName,
            })
            .eq('id', editingJudge.id);

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
        setShowModal(true);
    };

    const openAddModal = () => {
        setEditingJudge(null);
        setJudgeName('');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingJudge(null);
        setJudgeName('');
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
                <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
                    <FaPlus className="w-4 h-4" />
                    Add Judge
                </button>
            </div>

            {/* Judges Grid */}
            {judges.length === 0 ? (
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
                        disabled={!judgeName.trim()}
                        className="btn-primary flex-1"
                    >
                        {editingJudge ? 'Update Judge' : 'Add Judge'}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default JudgesPage;
