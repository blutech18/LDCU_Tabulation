import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { motion } from "framer-motion";
import { FaUnlock, FaCheck, FaMars, FaVenus } from "react-icons/fa";
import { supabase } from "../../lib/supabase";
import type { Participant, Criteria } from "../../types";

interface ScoringTabularProps {
  categoryId: number;
  judgeId: number;
  onFinish: () => void;
  isDarkMode: boolean;
  eventParticipantType?: "individual" | "group";
  onSaveStateChange?: (isSaving: boolean) => void;
  onLockChange?: (isLocked: boolean) => void;
  allowedParticipantIds?: number[] | null;
}

export interface ScoringTabularRef {
  refresh: () => Promise<void>;
  unlock: () => Promise<void>;
}

interface ScoreState {
  [participantId: number]: {
    [criteriaId: number]: number | undefined;
    locked?: boolean;
  };
}

const ScoringTabular = forwardRef<ScoringTabularRef, ScoringTabularProps>(
  (
    {
      categoryId,
      judgeId,
      onFinish,
      isDarkMode,
      eventParticipantType,
      onSaveStateChange,
      onLockChange,
      allowedParticipantIds,
    },
    ref,
  ) => {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [criteria, setCriteria] = useState<Criteria[]>([]);
    const [scores, setScores] = useState<ScoreState>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedGender, setSelectedGender] = useState<"male" | "female">(
      "male",
    );
    const [categoryName, setCategoryName] = useState<string>("");
    const saveTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
    const previousScoresRef = useRef<ScoreState>({});
    const hasBeenSubmittedRef = useRef<Record<number, boolean>>({});

    // Log judge activity
    const logJudgeActivity = useCallback(
      async (
        action: "submit" | "unlock" | "score_change",
        description: string,
        metadata: Record<string, any> = {},
      ) => {
        try {
          await supabase.from("judge_activity_logs").insert({
            judge_id: judgeId,
            category_id: categoryId,
            action,
            description,
            metadata: {
              ...metadata,
              category_name: categoryName,
              tabular_type: "scoring",
              gender: isIndividual ? selectedGender : undefined,
            },
          });
        } catch (error) {
          console.error("Error logging judge activity:", error);
        }
      },
      [judgeId, categoryId, categoryName, selectedGender],
    );

    // Floating button visibility state
    const [isBottomVisible, setIsBottomVisible] = useState(false);
    const observerRef = useRef<IntersectionObserver | null>(null);

    const isIndividual = eventParticipantType === "individual";

    // Callback ref to handle IntersectionObserver setup
    const setupIntersectionObserver = useCallback(
      (element: HTMLDivElement | null) => {
        // Clean up existing observer
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }

        if (element) {
          const observer = new IntersectionObserver(
            ([entry]) => {
              setIsBottomVisible(entry.isIntersecting);
            },
            {
              root: null,
              threshold: 0.1,
            },
          );

          observer.observe(element);
          observerRef.current = observer;
        }
      },
      [],
    );

    const calculateTotal = (participantId: number) => {
      if (!scores[participantId]) return 0;
      return criteria.reduce(
        (sum, c) => sum + (scores[participantId][c.id] ?? 0),
        0,
      );
    };

    // Filter participants by gender for individual events
    const baseFilteredParticipants = isIndividual
      ? participants.filter((p) => p.gender === selectedGender)
      : participants;

    const isAllLocked =
      baseFilteredParticipants.length > 0 &&
      baseFilteredParticipants.every((p) => scores[p.id]?.locked);

    const filteredParticipants = [...baseFilteredParticipants].sort((a, b) => {
      if (isAllLocked) {
        const scoreA = calculateTotal(a.id);
        const scoreB = calculateTotal(b.id);
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
      }
      return 0;
    });

    // Notify parent of lock state changes
    useEffect(() => {
      const isLocked =
        participants.length > 0 &&
        participants.every((p) => scores[p.id]?.locked);
      if (onLockChange) {
        onLockChange(isLocked);
      }
    }, [scores, participants, onLockChange]);

    const unlock = useCallback(async () => {
      setSaving(true);
      try {
        // Unlock all participants
        const criteriaIds = criteria.map((c) => c.id);
        const participantIds = filteredParticipants.map((p) => p.id);

        await supabase
          .from("scores")
          .update({ submitted_at: null })
          .eq("judge_id", judgeId)
          .in("participant_id", participantIds)
          .in("criteria_id", criteriaIds);

        // Log unlock action
        const participantNames = filteredParticipants
          .map((p) => p.name)
          .join(", ");
        await logJudgeActivity(
          "unlock",
          `Unlocked scoring for ${filteredParticipants.length} participant(s)`,
          {
            participant_count: filteredParticipants.length,
            participant_names: participantNames,
          },
        );

        setScores((prev) => {
          const newScores = { ...prev };
          participantIds.forEach((pId) => {
            if (newScores[pId]) {
              newScores[pId] = { ...newScores[pId], locked: false };
            }
          });
          return newScores;
        });
      } catch (error) {
        console.error("Error unlocking:", error);
      } finally {
        setSaving(false);
      }
    }, [criteria, filteredParticipants, judgeId, logJudgeActivity]);

    const fetchData = useCallback(async () => {
      // First, get the category to find its event_id and name
      const { data: categoryData } = await supabase
        .from("categories")
        .select("event_id, name")
        .eq("id", categoryId)
        .single();

      if (categoryData?.name) {
        setCategoryName(categoryData.name);
      }

      // Try to fetch participants for this event
      // Fallback to all participants if event_id column doesn't exist
      let participantsList: Participant[] = [];

      if (categoryData?.event_id) {
        const { data: participantData, error } = await supabase
          .from("participants")
          .select("*")
          .eq("event_id", categoryData.event_id)
          .eq("is_active", true)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("number", { ascending: true });

        if (!error && participantData) {
          participantsList = participantData as Participant[];
        }
      }

      // Fallback: if no participants found or event_id query failed, try without event_id filter
      if (participantsList.length === 0) {
        const { data: allParticipants } = await supabase
          .from("participants")
          .select("*")
          .eq("is_active", true)
          .order("number");
        participantsList = (allParticipants || []) as Participant[];
      }

      // Filter by allowedParticipantIds if set (judge_display_limit)
      if (allowedParticipantIds && allowedParticipantIds.length > 0) {
        participantsList = participantsList.filter((p) =>
          allowedParticipantIds.includes(p.id),
        );
      }

      setParticipants(participantsList);

      // Fetch criteria for this category
      const { data: criteriaData } = await supabase
        .from("criteria") // Updated table name
        .select("*")
        .eq("category_id", categoryId)
        // .eq('is_active', true) // Removed is_active if it's not in schema
        .order("display_order");

      setCriteria((criteriaData as Criteria[]) || []);

      // Fetch existing scores for this judge and criteria
      const criteriaIds = (criteriaData || []).map((c: any) => c.id);
      let scoreData: any[] = [];

      if (criteriaIds.length > 0) {
        const { data } = await supabase
          .from("scores")
          .select("*")
          .eq("judge_id", judgeId)
          .in("criteria_id", criteriaIds);
        scoreData = data || [];
      }

      // Initialize scores state - default to 0 but can be cleared
      const initialScores: ScoreState = {};
      participantsList?.forEach((participant) => {
        initialScores[participant.id] = {};
        criteriaData?.forEach((c: any) => {
          // Initialize with 0 as default
          initialScores[participant.id][c.id] = 0;
        });
      });

      // Apply existing scores (overwrite defaults if they exist)
      scoreData?.forEach((score: any) => {
        if (!initialScores[score.participant_id]) {
          initialScores[score.participant_id] = {};
        }

        if (score.criteria_id) {
          // Set the score from database (including 0)
          initialScores[score.participant_id][score.criteria_id] =
            score.score ?? 0;
        }

        // Use submitted_at as locked indicator
        if (score.submitted_at) {
          initialScores[score.participant_id].locked = true;
          // Track that this participant was previously submitted
          hasBeenSubmittedRef.current[score.participant_id] = true;
        }
      });

      setScores(initialScores);
      previousScoresRef.current = JSON.parse(JSON.stringify(initialScores));
      setLoading(false);
    }, [categoryId, judgeId]);

    useEffect(() => {
      fetchData();
    }, [fetchData]);

    // Expose refresh function via ref
    useImperativeHandle(
      ref,
      () => ({
        refresh: fetchData,
        unlock,
      }),
      [fetchData, unlock],
    );

    // Notify parent of save state changes
    useEffect(() => {
      if (onSaveStateChange) {
        onSaveStateChange(saving);
      }
    }, [saving, onSaveStateChange]);

    // Auto-save score to database with debouncing (without locking)
    const saveScoreToDb = useCallback(
      async (participantId: number, criteriaId: number, score: number) => {
        setSaving(true);
        try {
          // Check if participant is already locked
          const isLocked = scores[participantId]?.locked;
          const participant = participants.find((p) => p.id === participantId);
          const criteriaItem = criteria.find((c) => c.id === criteriaId);
          const oldScore =
            previousScoresRef.current[participantId]?.[criteriaId] ?? 0;

          await supabase.from("scores").upsert(
            {
              judge_id: judgeId,
              participant_id: participantId,
              criteria_id: criteriaId,
              score: score,
              // Only set submitted_at if already locked, otherwise leave it null
              submitted_at: isLocked ? new Date().toISOString() : null,
            },
            { onConflict: "judge_id,participant_id,criteria_id" },
          );

          // Log score change if participant was previously submitted (even after unlock)
          const wasSubmitted =
            hasBeenSubmittedRef.current[participantId] || isLocked;
          if (wasSubmitted && oldScore !== score) {
            await logJudgeActivity(
              "score_change",
              `Changed score for "${participant?.name || "Unknown"}" in "${criteriaItem?.name || "Unknown Criteria"}": ${oldScore} → ${score}`,
              {
                participant_id: participantId,
                participant_name: participant?.name,
                criteria_id: criteriaId,
                criteria_name: criteriaItem?.name,
                old_score: oldScore,
                new_score: score,
              },
            );
          }

          // Update previous scores ref
          if (!previousScoresRef.current[participantId]) {
            previousScoresRef.current[participantId] = {};
          }
          previousScoresRef.current[participantId][criteriaId] = score;
        } catch (error) {
          console.error("Error saving score:", error);
        } finally {
          setSaving(false);
        }
      },
      [judgeId, scores, participants, criteria, logJudgeActivity],
    );

    // Convert rank to ordinal format (1st, 2nd, 3rd, etc.)
    const getOrdinal = (rank: number) => {
      const suffixes = ["th", "st", "nd", "rd"];
      const v = rank % 100;
      return rank + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
    };

    // Cleanup timeouts on unmount
    useEffect(() => {
      return () => {
        Object.values(saveTimeoutRef.current).forEach((timeout) =>
          clearTimeout(timeout),
        );
      };
    }, []);

    // Calculate rankings based on total scores
    const getRankings = () => {
      const participantsWithScores = filteredParticipants.map((p) => ({
        id: p.id,
        total: calculateTotal(p.id),
      }));

      // Check if all scores are 0
      const hasAnyScores = participantsWithScores.some((p) => p.total > 0);

      // Sort by total score (descending)
      participantsWithScores.sort((a, b) => b.total - a.total);

      // Assign ranks (handle ties)
      const rankings: { [key: number]: number | null } = {};
      let currentRank = 1;
      for (let i = 0; i < participantsWithScores.length; i++) {
        // Don't assign rank if no scores have been entered yet
        if (!hasAnyScores || participantsWithScores[i].total === 0) {
          rankings[participantsWithScores[i].id] = null;
        } else {
          if (
            i > 0 &&
            participantsWithScores[i].total <
              participantsWithScores[i - 1].total
          ) {
            currentRank = i + 1;
          }
          rankings[participantsWithScores[i].id] = currentRank;
        }
      }

      return rankings;
    };

    const rankings = getRankings();

    // Check if any scores have been entered
    const hasAnyScoresEntered = filteredParticipants.some((p) => {
      if (!scores[p.id]) return false;
      return criteria.some(
        (c) => scores[p.id][c.id] !== undefined && scores[p.id][c.id] !== 0,
      );
    });

    const handleToggleLock = async () => {
      const isLocked = filteredParticipants.every((p) => scores[p.id]?.locked);

      setSaving(true);

      if (isLocked) {
        // Unlock all participants
        const criteriaIds = criteria.map((c) => c.id);
        const participantIds = filteredParticipants.map((p) => p.id);

        await supabase
          .from("scores")
          .update({ submitted_at: null })
          .eq("judge_id", judgeId)
          .in("participant_id", participantIds)
          .in("criteria_id", criteriaIds);

        // Log unlock action
        const participantNames = filteredParticipants
          .map((p) => p.name)
          .join(", ");
        await logJudgeActivity(
          "unlock",
          `Unlocked scoring for ${filteredParticipants.length} participant(s)`,
          {
            participant_count: filteredParticipants.length,
            participant_names: participantNames,
          },
        );

        setScores((prev) => {
          const newScores = { ...prev };
          participantIds.forEach((pId) => {
            if (newScores[pId]) {
              newScores[pId] = { ...newScores[pId], locked: false };
            }
          });
          return newScores;
        });
      } else {
        // Lock all participants
        const lockPromises = filteredParticipants.map(async (participant) => {
          if (!scores[participant.id]?.locked) {
            const participantScores = scores[participant.id];
            const inserts = criteria.map((c) => ({
              judge_id: judgeId,
              participant_id: participant.id,
              criteria_id: c.id,
              score: participantScores?.[c.id] ?? 0,
              submitted_at: new Date().toISOString(),
            }));
            await supabase
              .from("scores")
              .upsert(inserts, {
                onConflict: "judge_id,participant_id,criteria_id",
              });
          }
        });
        await Promise.all(lockPromises);

        // Log submit action with detailed scores per criteria
        const scoresData = filteredParticipants.map((p) => {
          const criteriaScores: Record<string, number> = {};
          criteria.forEach((c) => {
            criteriaScores[c.name] = scores[p.id]?.[c.id] ?? 0;
          });
          return {
            participant_id: p.id,
            participant_name: p.name,
            participant_department: p.department,
            criteria_scores: criteriaScores,
            total_score: calculateTotal(p.id),
          };
        });
        const criteriaInfo = criteria.map((c) => ({
          id: c.id,
          name: c.name,
          min_score: c.min_score,
          max_score: c.max_score,
        }));
        await logJudgeActivity(
          "submit",
          `Submitted scores for ${filteredParticipants.length} participant(s)`,
          {
            participant_count: filteredParticipants.length,
            criteria: criteriaInfo,
            scores: scoresData,
          },
        );

        // Mark participants as submitted for future change tracking
        filteredParticipants.forEach((p) => {
          hasBeenSubmittedRef.current[p.id] = true;
        });

        // Update local state to locked
        setScores((prev) => {
          const newScores = { ...prev };
          filteredParticipants.forEach((p) => {
            if (newScores[p.id]) {
              newScores[p.id] = { ...newScores[p.id], locked: true };
            }
          });
          return newScores;
        });

        // Update previous scores ref
        previousScoresRef.current = JSON.parse(JSON.stringify(scores));

        onFinish();
      }
      setSaving(false);
    };

    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <div
            className={`w-8 h-8 border-4 rounded-full animate-spin ${isDarkMode ? "border-white/20 border-t-white" : "border-white/20 border-t-white"}`}
          />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Gender Toggle for Individual Events */}
        {isIndividual && (
          <div
            className={`rounded-2xl overflow-hidden ${isDarkMode ? "bg-white/5 backdrop-blur-lg border border-white/10" : "bg-white border border-gray-200 shadow-sm"}`}
          >
            <div className="grid grid-cols-2">
              <button
                onClick={() => setSelectedGender("male")}
                className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all ${
                  selectedGender === "male"
                    ? isDarkMode
                      ? "bg-white/10 text-white border-b-2 border-blue-400"
                      : "bg-blue-50 text-blue-700 border-b-2 border-blue-500"
                    : isDarkMode
                      ? "text-white/50 hover:text-white/70 hover:bg-white/5"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <FaMars
                  className={`w-4 h-4 ${selectedGender === "male" ? (isDarkMode ? "text-blue-400" : "text-blue-500") : ""}`}
                />
                Male
              </button>
              <button
                onClick={() => setSelectedGender("female")}
                className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all ${
                  selectedGender === "female"
                    ? isDarkMode
                      ? "bg-white/10 text-white border-b-2 border-pink-400"
                      : "bg-pink-50 text-pink-700 border-b-2 border-pink-500"
                    : isDarkMode
                      ? "text-white/50 hover:text-white/70 hover:bg-white/5"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <FaVenus
                  className={`w-4 h-4 ${selectedGender === "female" ? (isDarkMode ? "text-pink-400" : "text-pink-500") : ""}`}
                />
                Female
              </button>
            </div>
          </div>
        )}

        {/* Scoring Table */}
        <div
          className={`rounded-2xl overflow-hidden shadow-lg ${isDarkMode ? "bg-white/10 backdrop-blur-lg border border-white/10" : "bg-white border border-gray-200"}`}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className={
                    isDarkMode
                      ? "border-b border-white/10"
                      : "bg-gray-50 border-b border-gray-200"
                  }
                >
                  <th
                    className={`px-4 py-4 text-left text-sm font-semibold w-64 min-w-64 ${isDarkMode ? "text-white" : "text-gray-900"}`}
                  >
                    Participant
                  </th>
                  {criteria.map((c) => (
                    <th
                      key={c.id}
                      className={`px-4 py-4 text-center text-sm font-semibold align-middle ${isDarkMode ? "text-white" : "text-gray-900"}`}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div>{c.name}</div>
                        <div
                          className={`text-xs font-normal ${isDarkMode ? "text-white/50" : "text-gray-500"}`}
                        >
                          {c.percentage > 0 ? `${c.percentage}%` : ""}
                        </div>
                      </div>
                    </th>
                  ))}
                  <th
                    className={`px-4 py-4 text-center text-sm font-semibold align-middle ${isDarkMode ? "text-white" : "text-gray-900"}`}
                  >
                    Rank
                  </th>
                </tr>
              </thead>
              <tbody
                className={
                  isDarkMode
                    ? "divide-y divide-white/5"
                    : "divide-y divide-gray-100"
                }
              >
                {filteredParticipants.map((participant, index) => (
                  <motion.tr
                    key={participant.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`${scores[participant.id]?.locked ? (isDarkMode ? "bg-green-500/10" : "bg-green-50") : isDarkMode ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
                  >
                    <td className="px-4 py-4 w-64 min-w-64">
                      <div className="flex items-center gap-3">
                        {participant.photo_url ? (
                          <img
                            src={participant.photo_url}
                            alt={participant.name}
                            className="w-10 h-10 rounded-full object-cover border-2 shadow-sm flex-shrink-0"
                            style={{
                              borderColor: isDarkMode
                                ? "rgba(255, 255, 255, 0.2)"
                                : "rgba(128, 0, 0, 0.2)",
                            }}
                            onError={(e) => {
                              // Hide image and show fallback
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const parent = target.parentElement;
                              if (parent) {
                                const fallback = parent.querySelector(
                                  ".avatar-fallback",
                                ) as HTMLElement;
                                if (fallback) fallback.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-sm flex-shrink-0 avatar-fallback ${participant.photo_url ? "hidden" : ""} ${isDarkMode ? "bg-gradient-to-br from-primary-500 to-accent-500" : "bg-gradient-to-br from-maroon to-maroon-dark"}`}
                        >
                          {participant.number || participant.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`font-medium truncate ${isDarkMode ? "text-white" : "text-gray-900"}`}
                          >
                            {participant.name}
                          </p>
                          <p
                            className={`text-sm truncate ${isDarkMode ? "text-white/50" : "text-gray-500"}`}
                          >
                            {participant.department}
                          </p>
                        </div>
                      </div>
                    </td>
                    {/* Separate input for each criteria */}
                    {criteria.map((c) => {
                      const maxScore = c.percentage;
                      const currentScore = scores[participant.id]?.[c.id] ?? 0;
                      const displayScore = Math.round(currentScore * 100) / 100;

                      return (
                        <td key={c.id} className="px-2 py-4 align-middle">
                          <div className="flex flex-col items-center gap-2 w-full">
                            {/* Score Input */}
                            <input
                              type="number"
                              min={0}
                              max={maxScore}
                              step={0.01}
                              value={displayScore || ""}
                              onChange={(e) => {
                                const value = e.target.value;

                                if (scores[participant.id]?.locked) return;

                                // Allow empty string
                                if (value === "") {
                                  const newScores = { ...scores };
                                  if (!newScores[participant.id]) {
                                    newScores[participant.id] = {};
                                  }
                                  newScores[participant.id][c.id] = 0;
                                  setScores(newScores);
                                  return;
                                }

                                const newScore = parseFloat(value);
                                if (isNaN(newScore)) return;

                                // Round to 2 decimal places and clamp
                                const roundedScore =
                                  Math.round(
                                    Math.min(Math.max(0, newScore), maxScore) *
                                      100,
                                  ) / 100;

                                const newScores = { ...scores };
                                if (!newScores[participant.id]) {
                                  newScores[participant.id] = {};
                                }
                                newScores[participant.id][c.id] = roundedScore;
                                setScores(newScores);

                                // Save with debounce
                                const key = `${participant.id}-${c.id}`;
                                if (saveTimeoutRef.current[key]) {
                                  clearTimeout(saveTimeoutRef.current[key]);
                                }
                                saveTimeoutRef.current[key] = setTimeout(() => {
                                  saveScoreToDb(
                                    participant.id,
                                    c.id,
                                    roundedScore,
                                  );
                                }, 500);
                              }}
                              onBlur={(e) => {
                                // Round on blur to ensure clean display
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value)) {
                                  const roundedScore =
                                    Math.round(
                                      Math.min(Math.max(0, value), maxScore) *
                                        100,
                                    ) / 100;
                                  const newScores = { ...scores };
                                  if (!newScores[participant.id]) {
                                    newScores[participant.id] = {};
                                  }
                                  newScores[participant.id][c.id] =
                                    roundedScore;
                                  setScores(newScores);
                                }
                              }}
                              onFocus={(e) => e.target.select()}
                              disabled={scores[participant.id]?.locked}
                              className={`w-20 px-2 py-2 text-xl font-bold text-center rounded-lg border-2 transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? "bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:ring-primary-500 focus:border-primary-500" : "bg-white border-gray-300 text-maroon placeholder:text-gray-400 focus:ring-maroon focus:border-maroon disabled:bg-gray-100"}`}
                              placeholder="0"
                            />
                            {/* Slider for this criteria */}
                            <div className="w-full px-1">
                              <input
                                type="range"
                                min={0}
                                max={maxScore}
                                step={0.5}
                                value={currentScore}
                                onChange={(e) => {
                                  if (scores[participant.id]?.locked) return;

                                  // Round to 2 decimal places
                                  const newScore =
                                    Math.round(
                                      parseFloat(e.target.value) * 100,
                                    ) / 100;

                                  const newScores = { ...scores };
                                  if (!newScores[participant.id]) {
                                    newScores[participant.id] = {};
                                  }
                                  newScores[participant.id][c.id] = newScore;
                                  setScores(newScores);

                                  // Save with debounce
                                  const key = `${participant.id}-${c.id}`;
                                  if (saveTimeoutRef.current[key]) {
                                    clearTimeout(saveTimeoutRef.current[key]);
                                  }
                                  saveTimeoutRef.current[key] = setTimeout(
                                    () => {
                                      saveScoreToDb(
                                        participant.id,
                                        c.id,
                                        newScore,
                                      );
                                    },
                                    500,
                                  );
                                }}
                                disabled={scores[participant.id]?.locked}
                                className={`w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed slider ${isDarkMode ? "slider-dark" : "slider-light"}`}
                                style={{
                                  background: scores[participant.id]?.locked
                                    ? isDarkMode
                                      ? "rgba(255,255,255,0.1)"
                                      : "rgba(0,0,0,0.1)"
                                    : `linear-gradient(to right, ${isDarkMode ? "#fbbf24" : "#800000"} 0%, ${isDarkMode ? "#fbbf24" : "#800000"} ${(currentScore / maxScore) * 100}%, ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} ${(currentScore / maxScore) * 100}%, ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} 100%)`,
                                }}
                              />
                              {/* Min/Max Labels */}
                              <div
                                className={`flex justify-between w-full text-xs mt-1 ${isDarkMode ? "text-white/50" : "text-gray-500"}`}
                              >
                                <span>0</span>
                                <span>{maxScore}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-4 text-center align-middle">
                      {rankings[participant.id] === null ? (
                        <span
                          className={`text-lg ${isDarkMode ? "text-white/30" : "text-gray-400"}`}
                        >
                          —
                        </span>
                      ) : (
                        <span
                          className={`text-lg font-bold ${
                            rankings[participant.id] === 1
                              ? isDarkMode
                                ? "text-yellow-300"
                                : "text-yellow-600"
                              : rankings[participant.id] === 2
                                ? isDarkMode
                                  ? "text-gray-300"
                                  : "text-gray-600"
                                : rankings[participant.id] === 3
                                  ? isDarkMode
                                    ? "text-amber-300"
                                    : "text-amber-600"
                                  : isDarkMode
                                    ? "text-white/70"
                                    : "text-gray-500"
                          }`}
                        >
                          {getOrdinal(rankings[participant.id]!)}
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Auto-save indicator and Complete button */}
        <div
          ref={setupIntersectionObserver}
          className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 pb-4 sm:pb-6 md:pb-8 lg:pb-10"
        >
          <div
            className={`text-sm w-full sm:w-auto text-center sm:text-left ${isDarkMode ? "text-white/50" : "text-gray-500"}`}
          >
            {saving ? (
              <span className="flex items-center justify-center sm:justify-start gap-2">
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <span>✓ All changes saved automatically</span>
            )}
          </div>
          {hasAnyScoresEntered && (
            <div className="relative min-h-[46px] w-full sm:w-auto sm:min-w-[200px]">
              {" "}
              {/* Placeholder to prevent layout shift */}
              {!isBottomVisible && (
                <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 flex items-center justify-center sm:justify-end">
                    <motion.button
                      layoutId="scoring-action-button"
                      onClick={handleToggleLock}
                      disabled={saving}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`pointer-events-auto w-full sm:w-auto flex items-center justify-center gap-2 font-bold text-white shadow-lg disabled:opacity-70 disabled:cursor-not-allowed rounded-xl px-6 py-2.5 ${
                        filteredParticipants.every((p) => scores[p.id]?.locked)
                          ? isDarkMode
                            ? "bg-gray-600 hover:bg-gray-500"
                            : "bg-gray-600 hover:bg-gray-700"
                          : isDarkMode
                            ? "bg-maroon hover:bg-maroon-light"
                            : "bg-maroon hover:bg-maroon-dark"
                      }`}
                    >
                      {filteredParticipants.every(
                        (p) => scores[p.id]?.locked,
                      ) ? (
                        <>
                          <FaUnlock className="w-4 h-4" />
                          Unlock Scoring
                        </>
                      ) : (
                        <>
                          <FaCheck className="w-5 h-5" />
                          Complete Scoring
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              )}
              <div className="w-full h-full flex justify-center sm:justify-end items-center">
                {isBottomVisible && (
                  <motion.button
                    layoutId="scoring-action-button"
                    onClick={handleToggleLock}
                    disabled={saving}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`pointer-events-auto w-full sm:w-auto flex items-center justify-center gap-2 font-bold text-white shadow-lg disabled:opacity-70 disabled:cursor-not-allowed rounded-xl px-6 py-2.5 ${
                      filteredParticipants.every((p) => scores[p.id]?.locked)
                        ? isDarkMode
                          ? "bg-gray-600 hover:bg-gray-500"
                          : "bg-gray-600 hover:bg-gray-700"
                        : isDarkMode
                          ? "bg-maroon hover:bg-maroon-light"
                          : "bg-maroon hover:bg-maroon-dark"
                    }`}
                  >
                    {filteredParticipants.every((p) => scores[p.id]?.locked) ? (
                      <>
                        <FaUnlock className="w-4 h-4" />
                        Unlock Scoring
                      </>
                    ) : (
                      <>
                        <FaCheck className="w-5 h-5" />
                        Complete Scoring
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

ScoringTabular.displayName = "ScoringTabular";

export default ScoringTabular;
