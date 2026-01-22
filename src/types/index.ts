// ============================================================
// LDCU TABULATION SYSTEM - TYPE DEFINITIONS
// Matches the optimized database schema
// ============================================================

// ============================================================
// CORE ENTITIES
// ============================================================

export interface Event {
    id: number;
    name: string;
    description?: string;
    date: string;
    event_start?: string;
    event_end?: string;
    venue?: string;
    participant_type: 'individual' | 'group';
    status: 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'archived';
    created_at: string;
    updated_at: string;
}

export interface Category {
    id: number;
    event_id: number;
    name: string;
    description?: string;
    tabular_type: 'scoring' | 'ranking';
    // For ranking-based: score range per criteria
    score_min: number;
    score_max: number;
    // For scoring-based
    require_percentage_total: boolean;
    // Scheduling
    schedule_start?: string;
    schedule_end?: string;
    // Display
    photo_url?: string;
    display_order: number;
    status: 'scheduled' | 'active' | 'paused' | 'completed';
    manual_override: boolean;
    created_at: string;
    updated_at: string;
    // Joined relations
    events?: Event;
}

export interface Contestant {
    id: number;
    event_id: number;
    contestant_number?: number;
    name: string;
    nickname?: string;
    department: string;
    course?: string;
    gender?: 'male' | 'female' | 'other';
    photo_url?: string;
    bio?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Judge {
    id: number;
    event_id?: number;
    name: string;
    title?: string;
    affiliation?: string;
    code: string;
    photo_url?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// ============================================================
// CRITERIA SYSTEM
// ============================================================

export interface CategoryCriteria {
    id: number;
    category_id: number;
    name: string;
    description?: string;
    percentage: number;
    min_score?: number;
    max_score?: number;
    display_order: number;
    is_active: boolean;
    created_at: string;
}

// ============================================================
// ASSIGNMENTS
// ============================================================

export interface ContestantAssignment {
    id: number;
    contestant_id: number;
    category_id: number;
    contestant_number?: number;
    is_active: boolean;
    created_at: string;
    // Joined relations
    contestants?: Contestant;
    categories?: Category;
}

export interface JudgeAssignment {
    id: number;
    judge_id: number;
    category_id: number;
    is_active: boolean;
    created_at: string;
    // Joined relations
    judges?: Judge;
    categories?: Category;
}

// ============================================================
// SCORING
// ============================================================

export interface Score {
    id: number;
    judge_id: number;
    contestant_id: number;
    category_id: number;
    total_score: number;
    computed_rank?: number;
    status: 'draft' | 'submitted' | 'locked';
    submitted_at?: string;
    locked_at?: string;
    created_at: string;
    updated_at: string;
    // Joined relations
    judges?: Judge;
    contestants?: Contestant;
    categories?: Category;
    score_details?: ScoreDetail[];
}

export interface ScoreDetail {
    id: number;
    score_id: number;
    category_criteria_id: number;
    raw_score: number;
    weighted_score: number;
    created_at: string;
    updated_at: string;
    // Joined relations
    category_criteria?: CategoryCriteria;
}

// ============================================================
// RESULTS
// ============================================================

export interface CategoryResult {
    id: number;
    category_id: number;
    contestant_id: number;
    average_score: number;
    final_rank?: number;
    judge_count: number;
    tiebreaker_score?: number;
    is_finalized: boolean;
    finalized_at?: string;
    created_at: string;
    updated_at: string;
    // Joined relations
    contestants?: Contestant;
    categories?: Category;
}

// ============================================================
// AUDIT
// ============================================================

export interface ScoreHistory {
    id: number;
    score_id: number;
    previous_total?: number;
    new_total?: number;
    previous_status?: string;
    new_status?: string;
    changed_by?: string;
    change_reason?: string;
    created_at: string;
}

// ============================================================
// UI/STATE TYPES
// ============================================================

// For the scoring/ranking tabular UI
export interface ScoreEntry {
    contestant_id: number;
    criteria_scores: Record<number, number>; // criteria_id -> raw_score
    total_score: number;
    rank?: number;
    is_locked: boolean;
}

// Category with full criteria info for UI
export interface CategoryWithCriteria extends Category {
    criteria: CategoryCriteria[];
    contestants: Contestant[];
}

// Judge panel category card
export interface JudgeCategoryCard {
    category: Category;
    event: Event;
    is_complete: boolean;
    contestants_scored: number;
    total_contestants: number;
}

// Admin dashboard stats
export interface DashboardStats {
    total_events: number;
    active_events: number;
    total_categories: number;
    active_categories: number;
    total_judges: number;
    total_contestants: number;
}

// Event with categories for admin view
export interface EventWithCategories extends Event {
    categories: Category[];
}

// Leaderboard entry
export interface LeaderboardEntry {
    rank: number;
    contestant: Contestant;
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
    description?: string;
    date: string;
    venue?: string;
}

export interface CreateCategoryInput {
    event_id: number;
    name: string;
    description?: string;
    tabular_type: 'scoring' | 'ranking';
    score_min?: number;
    score_max?: number;
    schedule_start?: string;
    schedule_end?: string;
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
    name: string;
    title?: string;
    affiliation?: string;
}

export interface CreateContestantInput {
    contestant_number?: number;
    name: string;
    nickname?: string;
    department: string;
    course?: string;
    photo_url?: string;
    bio?: string;
}
