import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Event, Category } from '../types';

interface EventState {
    events: Event[];
    categories: Category[];
    selectedEvent: Event | null;
    selectedCategory: Category | null;
    loading: boolean;
    error: string | null;

    // Actions
    fetchEvents: () => Promise<void>;
    fetchCategories: (eventId?: number) => Promise<void>;
    selectEvent: (event: Event | null) => void;
    selectCategory: (category: Category | null) => void;
    addEvent: (event: Partial<Event>) => Promise<boolean>;
    updateEvent: (id: number, updates: Partial<Event>) => Promise<boolean>;
    deleteEvent: (id: number) => Promise<boolean>;
    subscribeToEvents: () => () => void;
    subscribeToCategories: () => () => void;
}

export const useEventStore = create<EventState>((set, get) => ({
    events: [],
    categories: [],
    selectedEvent: null,
    selectedCategory: null,
    loading: false,
    error: null,

    fetchEvents: async () => {
        set({ loading: true, error: null });
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            set({ error: error.message, loading: false });
        } else {
            set({ events: data as Event[], loading: false });
        }
    },

    fetchCategories: async (eventId) => {
        set({ loading: true, error: null });
        let query = supabase.from('categories').select('*, events(*)');

        if (eventId) {
            query = query.eq('event_id', eventId);
        }

        const { data, error } = await query.order('name');

        if (error) {
            set({ error: error.message, loading: false });
        } else {
            set({ categories: data as Category[], loading: false });
        }
    },

    selectEvent: (event) => set({ selectedEvent: event }),
    selectCategory: (category) => set({ selectedCategory: category }),

    addEvent: async (event) => {
        const { error } = await supabase.from('events').insert(event);
        if (!error) {
            get().fetchEvents();
            return true;
        }
        set({ error: error.message });
        return false;
    },

    updateEvent: async (id, updates) => {
        const { error } = await supabase.from('events').update(updates).eq('id', id);
        if (!error) {
            get().fetchEvents();
            return true;
        }
        set({ error: error.message });
        return false;
    },

    deleteEvent: async (id) => {
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (!error) {
            get().fetchEvents();
            return true;
        }
        set({ error: error.message });
        return false;
    },

    // Real-time subscription for events
    subscribeToEvents: () => {
        const channel = supabase
            .channel('events-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
                get().fetchEvents();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },

    // Real-time subscription for categories
    subscribeToCategories: () => {
        const channel = supabase
            .channel('categories-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
                const { selectedEvent } = get();
                get().fetchCategories(selectedEvent?.id);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },
}));
