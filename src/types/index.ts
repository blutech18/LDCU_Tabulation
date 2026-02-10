// ============================================================
// LDCU TABULATION SYSTEM - TYPE DEFINITIONS
// Matches the minimal optimized database schema
// ============================================================

// ============================================================
// CORE ENTITIES
// ============================================================

export interface Event {
    id: number;
    name: string;
    photo_url?: string;
    date: string;
    event_start?: string;
    end_date?: string;
    event_end?: string;
    start_time?: string;
    end_time?: string;
    venue?: string;
    participant_type: 'individual' | 'group';
    status: 'draft' | 'ongoing' | 'completed';
    auditor_detailed_view?: boolean;
    top_display_limit?: number | null; // null or 0 = show all, 3-10 = show only top N results
    judge_display_limit?: number | null; // null or 0 = show all, 3-10 = only show top N participants to judges
    created_at: string;
}

export interface Category {
    id: number;
    event_id: number;
    name: string;
    tabular_type: 'scoring' | 'ranking';
    score_min: number;
    score_max: number;
    photo_url?: string;
    display_order: number;
    top_display?: number | null;
    is_completed?: boolean;
    created_at: string;
}

export interface Criteria {
    id: number;
    category_id: number;
    name: string;
    description?: string;
    percentage: number;
    min_score: number;
    max_score: number;
    display_order: number;
    created_at: string;
}

export interface Participant {
    id: number;
    event_id: number;
    number: number;
    name: string;
    department?: string;
    gender?: 'male' | 'female';
    photo_url?: string;
    display_order?: number;
    is_active: boolean;
    created_at: string;
}

// Alias for backward compatibility
export type Contestant = Participant;

export interface Judge {
    id: number;
    event_id: number;
    name: string;
    code: string;
    photo_url?: string;
    is_active: boolean;
    created_at: string;
}

export interface Auditor {
    id: number;
    event_id: number;
    name: string;
    code: string;
    photo_url?: string;
    is_active: boolean;
    created_at: string;
}

// ============================================================
// SCORING
// ============================================================

export interface Score {
    id: number;
    judge_id: number;
    participant_id: number;
    criteria_id: number;
    score: number;
    rank?: number;
    submitted_at?: string;
    created_at: string;
}

export interface ActivityLog {
    id: number;
    user_id?: string;
    action: string;
    description: string;
    metadata?: any;
    created_at: string;
}

export interface JudgeActivityLog {
    id: number;
    judge_id: number;
    category_id: number;
    action: 'submit' | 'unlock' | 'score_change';
    description?: string;
    metadata?: {
        participant_id?: number;
        participant_name?: string;
        old_score?: number;
        new_score?: number;
        old_rank?: number;
        new_rank?: number;
        category_name?: string;
        tabular_type?: 'scoring' | 'ranking';
        gender?: 'male' | 'female';
        [key: string]: any;
    };
    created_at: string;
    // Joined fields
    judges?: Judge;
    categories?: Category;
}

// ============================================================
// UI/STATE TYPES
// ============================================================

// For the scoring/ranking tabular UI
export interface ScoreEntry {
    participant_id: number;
    criteria_scores: Record<number, number>; // criteria_id -> score
    total_score: number;
    rank?: number;
    is_locked: boolean;
}

// Category with full criteria info for UI
export interface CategoryWithCriteria extends Category {
    criteria: Criteria[];
    participants: Participant[];
}

// Judge panel category card
export interface JudgeCategoryCard {
    category: Category;
    event: Event;
    is_complete: boolean;
    participants_scored: number;
    total_participants: number;
}

// Admin dashboard stats
export interface DashboardStats {
    total_events: number;
    active_events: number;
    total_categories: number;
    active_categories: number;
    total_judges: number;
    total_participants: number;
}

// Event with categories for admin view
export interface EventWithCategories extends Event {
    categories: Category[];
}

// Leaderboard entry
export interface LeaderboardEntry {
    rank: number;
    participant: Participant;
    average_score: number;
    judge_count: number;
    scores_by_judge: {
        judge: Judge;
        total_score: number;
        status: string;
    }[];
}

// ============================================================
// FORM TYPES
// ============================================================

export interface CreateEventInput {
    name: string;
    photo_url?: string;
    date: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    venue?: string;
    participant_type: 'individual' | 'group';
}

export interface CreateCategoryInput {
    event_id: number;
    name: string;
    tabular_type: 'scoring' | 'ranking';
    score_min?: number;
    score_max?: number;
    photo_url?: string;
}

export interface CreateCriteriaInput {
    category_id: number;
    name: string;
    description?: string;
    percentage: number;
    min_score?: number;
    max_score?: number;
}

export interface CreateJudgeInput {
    event_id: number;
    name: string;
    code: string;
}

export interface CreateParticipantInput {
    event_id: number;
    number: number;
    name: string;
    department?: string;
    gender?: 'male' | 'female';
    photo_url?: string;
}

export interface StatsData {
    events: number;
    categories: number;
    judges: number;
    participants: number;
}


