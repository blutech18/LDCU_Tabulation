import { useEffect } from 'react';
import { useEventStore } from '../stores';

/**
 * Hook to fetch and subscribe to events with real-time updates
 */
export function useEvents() {
    const { events, loading, error, fetchEvents, subscribeToEvents } = useEventStore();

    useEffect(() => {
        fetchEvents();
        const unsubscribe = subscribeToEvents();
        return unsubscribe;
    }, [fetchEvents, subscribeToEvents]);

    return { events, loading, error };
}

/**
 * Hook to fetch and subscribe to categories for a specific event
 */
export function useCategories(eventId?: number) {
    const { categories, loading, error, fetchCategories, subscribeToCategories } = useEventStore();

    useEffect(() => {
        fetchCategories(eventId);
        const unsubscribe = subscribeToCategories();
        return unsubscribe;
    }, [eventId, fetchCategories, subscribeToCategories]);

    return { categories, loading, error };
}
