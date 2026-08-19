import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import type { TodayPlan, Session, SessionOutcome, TrustScore } from "../types/todayPlan";
import type { Adjustment } from "../engine/AdjustmentEngine";
import type { MentorPersonality } from "../onboarding/OnboardingTypes";
import type { CalendarEvent } from "../types/calendar";
import type { DailyHealth } from "../engine/HealthEngine";
import type { GitHubData } from "../engine/GitHubEngine";
import { adjustPlan as runAdjustment } from "../engine/AdjustmentEngine";
import { useConversation } from "../ai/ConversationProvider";
import { createForgeAI, type ForgeAIServices } from "../ai/services";
import { createAwareness, type Awareness } from "../ai/AwarenessEngine";
import { createEmptyPatternMemory } from "../ai/PatternLearner";
import { createEmptyConversationMemory } from "../ai/ConversationMemory";
import { explainChanges, formatChangeExplanation } from "../ai/ChangeExplainer";
import { updateTrustScore } from "../engine/TrustEngine";
import {
  checkLifecycleState,
  archiveYesterday,
  startNewDay,
  resumeSession,
  completeAbandonedSession,
  getRecoveryMessage,
  getMorningGreeting,
} from "../engine/LifecycleEngine";
import { generateMorningSentence } from "../engine/Summarizer";
import { promoteToActive } from "../engine/PlanStatusEngine";
import { loadTimeline, recordStarted, recordCompleted, recordSkipped } from "../engine/TimelineEngine";
import { StorageEngine } from "../storage/StorageEngine";

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function tryImportNative<T>(importFn: () => Promise<T>): Promise<T | null> {
  try {
    return await importFn();
  } catch {
    return null;
  }
}

type ForgeState = {
  userName: string;
  priorities: string[];
  personality: MentorPersonality;
  todayPlan: TodayPlan | null;
  currentSession: Session | null;
  completedCommitments: string[];
  isLoading: boolean;
  trustScore: TrustScore;
  morningSentence: string;
  morningGreeting: string;
  recoveryMessage: string | null;
  calendarEvents: CalendarEvent[];
  dailyHealth: DailyHealth | null;
  githubData: GitHubData | null;
};

type ForgeContextType = ForgeState & {
  ai: ForgeAIServices;
  setUserName: (name: string) => void;
  setPriorities: (priorities: string[]) => void;
  setPersonality: (personality: MentorPersonality) => void;
  setTodayPlan: (plan: TodayPlan) => void;
  setCurrentSession: (session: Session | null) => void;
  toggleCommitment: (id: string) => void;
  setLoading: (loading: boolean) => void;
  completeSession: (outcome: SessionOutcome) => void;
  generateTodayPlan: (conversation: string) => Promise<void>;
  adjustPlan: (adjustment: Adjustment) => void;
  adjustFromText: (text: string) => Promise<AdjustFromTextResult>;
  approvePlan: () => void;
  startSession: (commitmentId: string) => void;
  initializeDay: () => Promise<void>;
  resumeAbandonedSession: () => Promise<void>;
  syncCalendar: () => Promise<void>;
  syncHealth: () => Promise<void>;
  syncGitHub: (username: string, token?: string) => Promise<void>;
};

export type AdjustFromTextResult = {
  explanation: string;
  applied: boolean;
  aiUsed: boolean;
  plan?: TodayPlan;
};

const ForgeContext = createContext<ForgeContextType | null>(null);

export function ForgeProvider({ children }: { children: ReactNode }) {
  const { understand } = useConversation();
  const [userName, setUserName] = useState("friend");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [personality, setPersonality] = useState<MentorPersonality>("supportive");
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [completedCommitments, setCompletedCommitments] = useState<string[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [trustScore, setTrustScore] = useState<TrustScore>({ current: 50, history: [] });
  const [morningSentence, setMorningSentence] = useState("");
  const [morningGreeting, setMorningGreeting] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [dailyHealth, setDailyHealth] = useState<DailyHealth | null>(null);
  const [githubData, setGithubData] = useState<GitHubData | null>(null);

  const ai = useMemo(() => createForgeAI(), []);
  const [awareness, setAwareness] = useState<Awareness>(() =>
    createAwareness(createEmptyPatternMemory(), createEmptyConversationMemory())
  );

  useEffect(() => {
    (async () => {
      try {
        const [savedTrust, savedName, savedPriorities, savedPersonality, savedPlan] = await Promise.all([
          StorageEngine.loadTrustScore(),
          StorageEngine.loadUserName(),
          StorageEngine.loadPriorities(),
          StorageEngine.loadPersonality(),
          StorageEngine.loadTodayPlan(),
        ]);

        if (savedTrust) setTrustScore(savedTrust);
        if (savedName) setUserName(savedName);
        if (savedPriorities.length > 0) setPriorities(savedPriorities);
        if (savedPersonality) setPersonality(savedPersonality);

        const now = new Date();
        const lifecycleState = await checkLifecycleState(now);

        if (!lifecycleState.isSameDay) {
          await archiveYesterday(
            lifecycleState.todaysPlan,
            lifecycleState.hasActiveSession && lifecycleState.activeSession
              ? [lifecycleState.activeSession]
              : [],
            savedTrust?.current ?? 50
          );
          await startNewDay();
          setTodayPlan(null);
          setCurrentSession(null);
          setCompletedCommitments([]);
          setRecoveryMessage(null);
          setMorningSentence("");
        } else {
          if (savedPlan) setTodayPlan(savedPlan);
          if (lifecycleState.hasActiveSession && lifecycleState.activeSession) {
            const recovery = getRecoveryMessage(lifecycleState.activeSession);
            setRecoveryMessage(recovery);
            setCurrentSession(lifecycleState.activeSession);
          }
        }

        const [patternMemory, conversationMemory] = await Promise.all([
          StorageEngine.loadPatternMemory(),
          StorageEngine.loadConversationMemory(),
        ]);
        setAwareness(
          createAwareness(
            patternMemory ?? createEmptyPatternMemory(),
            conversationMemory ?? createEmptyConversationMemory()
          )
        );

        await withTimeout(loadTimeline(), 3000, undefined);

        const CalendarEngine = await tryImportNative(() => import("../engine/CalendarEngine"));
        if (CalendarEngine) {
          const hasCalPermission = await withTimeout(CalendarEngine.checkPermission(), 2000, false);
          if (hasCalPermission) {
            const cached = await StorageEngine.loadCalendarEvents();
            if (cached.length > 0) setCalendarEvents(cached);
          }
        }

        const NotificationEngine = await tryImportNative(() => import("../engine/NotificationEngine"));
        if (NotificationEngine) {
          await withTimeout(NotificationEngine.requestPermission(), 2000, false);
        }

        const HealthEngine = await tryImportNative(() => import("../engine/HealthEngine"));
        if (HealthEngine) {
          const healthAvailable = await withTimeout(HealthEngine.isAvailable(), 2000, false);
          if (healthAvailable) {
            const granted = await withTimeout(HealthEngine.requestPermission(), 3000, false);
            if (granted) {
              const health = await withTimeout(HealthEngine.getDailyHealth(), 5000, null);
              if (health) {
                setDailyHealth(health);
                await StorageEngine.saveHealthData(health);
                await StorageEngine.setHealthSyncedAt(new Date().toISOString());
              }
            }
          }
        }

        const GitHubEngine = await tryImportNative(() => import("../engine/GitHubEngine"));
        if (GitHubEngine) {
          const ghUsername = await StorageEngine.loadGitHubUsername();
          if (ghUsername) {
            const cached = await StorageEngine.loadGitHubData();
            if (cached) setGithubData(cached);
            const token = await StorageEngine.loadGitHubToken();
            const ghData = await withTimeout(
              GitHubEngine.syncGitHub(ghUsername, token ?? undefined),
              5000,
              null
            );
            if (ghData) {
              setGithubData(ghData);
              await StorageEngine.saveGitHubData(ghData);
            }
          }
        }

        await StorageEngine.setVersion();
      } catch {
        // Fall back to fresh state, never block the user
      }
    })();
  }, []);

  useEffect(() => {
    if (todayPlan) StorageEngine.saveTodayPlan(todayPlan).catch(() => {});
  }, [todayPlan]);

  useEffect(() => {
    StorageEngine.saveTrustScore(trustScore).catch(() => {});
  }, [trustScore]);

  useEffect(() => {
    if (userName !== "friend") {
      StorageEngine.saveUserName(userName).catch(() => {});
    }
  }, [userName]);

  useEffect(() => {
    if (priorities.length > 0) {
      StorageEngine.savePriorities(priorities).catch(() => {});
    }
  }, [priorities]);

  useEffect(() => {
    StorageEngine.savePersonality(personality).catch(() => {});
  }, [personality]);

  useEffect(() => {
    StorageEngine.saveCurrentSession(currentSession).catch(() => {});
  }, [currentSession]);

  useEffect(() => {
    const store = awareness.store;
    if (store.patternMemory.patterns.length > 0 || store.patternMemory.observations.length > 0) {
      StorageEngine.savePatternMemory(store.patternMemory).catch(() => {});
    }
    if (store.conversationMemory.turns.length > 0) {
      StorageEngine.saveConversationMemory(store.conversationMemory).catch(() => {});
    }
  }, [awareness]);

  const toggleCommitment = useCallback((id: string) => {
    setCompletedCommitments((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }, []);

  const completeSession = useCallback((outcome: SessionOutcome) => {
    if (!currentSession) return;

    const newScore = updateTrustScore(
      trustScore,
      currentSession.id,
      outcome,
      currentSession.isProtected
    );
    setTrustScore(newScore);

    if (outcome === "skipped") {
      recordSkipped(currentSession.id, currentSession.title);
    } else {
      recordCompleted(currentSession.id, currentSession.title);
    }

    setCurrentSession((prev) =>
      prev ? { ...prev, status: "completed", outcome } : null
    );
  }, [currentSession, trustScore]);

  const generateTodayPlan = useCallback(async (conversation: string) => {
    setLoading(true);

    const { output } = await understand(conversation, priorities, calendarEvents);
    setTodayPlan(output.todayPlan);

    const sentence = generateMorningSentence(output.todayPlan, trustScore);
    setMorningSentence(sentence);

    await StorageEngine.setLastActiveDate(new Date().toISOString().split("T")[0]);
    const NE = await tryImportNative(() => import("../engine/NotificationEngine"));
    if (NE) await NE.schedulePlanReminders(output.todayPlan.commitments);

    setLoading(false);
  }, [understand, priorities, trustScore, calendarEvents]);

  const adjustPlan = useCallback((adjustment: Adjustment) => {
    if (!todayPlan) return;

    const { plan: newPlan } = runAdjustment(todayPlan, adjustment);
    setTodayPlan(newPlan);
  }, [todayPlan]);

  const adjustFromText = useCallback(
    async (text: string): Promise<AdjustFromTextResult> => {
      if (!todayPlan) return { explanation: "no plan yet.", applied: false, aiUsed: false };

      const before = todayPlan;

      const aiResult = await ai.intent.understand(text, before);
      const aiApplied =
        aiResult.apply?.plan &&
        aiResult.apply.changes.length > 0 &&
        aiResult.resolution.status === "resolved";

      if (aiApplied && aiResult.apply) {
        const after = aiResult.apply.plan;
        const changeSummary = formatChangeExplanation(explainChanges(before, after));
        const explanation = aiResult.failure
          ? `${aiResult.failure.userMessage}\n${changeSummary}`
          : changeSummary;
        setTodayPlan(after);
        awareness.learn(before, after);
        awareness.addTurn(text, before);
        const NE = await tryImportNative(() => import("../engine/NotificationEngine"));
        if (NE) await NE.schedulePlanReminders(after.commitments);
        return { explanation, applied: true, aiUsed: aiResult.source === "ai", plan: after };
      }

      const explanation = formatChangeExplanation(explainChanges(before, before));
      return { explanation, applied: false, aiUsed: aiResult.source === "ai" };
    },
    [todayPlan, ai, awareness]
  );

  const approvePlan = useCallback(() => {
    if (!todayPlan) return;
    setTodayPlan((plan) => (plan ? promoteToActive(plan) : plan));
  }, [todayPlan]);

  const startSession = useCallback(
    (commitmentId: string) => {
      if (!todayPlan) return;
      const commitment = todayPlan.commitments.find((c) => c.id === commitmentId);
      if (!commitment) return;

      const session: Session = {
        id: commitment.id,
        title: commitment.title,
        scheduledStart: commitment.startTime,
        scheduledEnd: commitment.endTime,
        status: "scheduled",
        durationMinutes: 90,
        message: [commitment.note ?? "we'll take it from here."],
        isProtected: commitment.locked,
      };

      setCurrentSession(session);
      recordStarted(commitment.id, commitment.title);

      setTodayPlan((plan) =>
        plan ? runAdjustment(plan, { type: "lock", taskId: commitmentId }).plan : plan
      );
    },
    [todayPlan]
  );

  const initializeDay = useCallback(async () => {
    setLoading(true);

    try {
      const now = new Date();
      const lifecycleState = await checkLifecycleState(now);

      setMorningGreeting(getMorningGreeting(now));

      if (!lifecycleState.isSameDay) {
        await archiveYesterday(
          lifecycleState.todaysPlan,
          lifecycleState.hasActiveSession && lifecycleState.activeSession
            ? [lifecycleState.activeSession]
            : [],
          trustScore.current
        );

        await startNewDay();

        setTodayPlan(null);
        setCurrentSession(null);
        setCompletedCommitments([]);
        setRecoveryMessage(null);
        setMorningSentence("");
      } else {
        if (lifecycleState.todaysPlan) {
          setTodayPlan(lifecycleState.todaysPlan);
          const sentence = generateMorningSentence(lifecycleState.todaysPlan, trustScore);
          setMorningSentence(sentence);
          const NE = await tryImportNative(() => import("../engine/NotificationEngine"));
          if (NE) await NE.schedulePlanReminders(lifecycleState.todaysPlan.commitments);
        }

        if (lifecycleState.hasActiveSession && lifecycleState.activeSession) {
          const recovery = getRecoveryMessage(lifecycleState.activeSession);
          setRecoveryMessage(recovery);
          setCurrentSession(lifecycleState.activeSession);
        }
      }
    } catch {
      // Fall back to fresh state, never block the user
    }

    setLoading(false);
  }, [trustScore]);

  const resumeAbandonedSession = useCallback(async () => {
    if (!currentSession) return;

    const resumed = await resumeSession(currentSession);
    setCurrentSession(resumed);
    setRecoveryMessage(null);
  }, [currentSession]);

  const syncCalendar = useCallback(async () => {
    const mod = await tryImportNative(() => import("../engine/CalendarEngine"));
    if (!mod) return;
    const hasPermission = await mod.requestPermission();
    if (!hasPermission) return;

    const result = await mod.syncCalendar();
    setCalendarEvents(result.events);
    await StorageEngine.saveCalendarEvents(result.events);
    await StorageEngine.saveCalendarPatterns(result.patterns);
    await StorageEngine.setCalendarSyncedAt(result.syncedAt);
  }, []);

  const syncHealth = useCallback(async () => {
    const mod = await tryImportNative(() => import("../engine/HealthEngine"));
    if (!mod) return;
    const available = await mod.isAvailable();
    if (!available) return;

    const granted = await mod.requestPermission();
    if (!granted) return;

    const health = await mod.getDailyHealth();
    setDailyHealth(health);
    await StorageEngine.saveHealthData(health);
    await StorageEngine.setHealthSyncedAt(new Date().toISOString());
  }, []);

  const syncGitHub = useCallback(async (username: string, token?: string) => {
    const mod = await tryImportNative(() => import("../engine/GitHubEngine"));
    if (!mod) return;
    await StorageEngine.saveGitHubUsername(username);
    if (token) await StorageEngine.saveGitHubToken(token);

    const data = await mod.syncGitHub(username, token);
    setGithubData(data);
    await StorageEngine.saveGitHubData(data);
  }, []);

  return (
    <ForgeContext.Provider
      value={{
        ai,
        userName,
        priorities,
        personality,
        todayPlan,
        currentSession,
        completedCommitments,
        isLoading,
        trustScore,
        morningSentence,
        morningGreeting,
        recoveryMessage,
        calendarEvents,
        dailyHealth,
        githubData,
        setUserName,
        setPriorities,
        setPersonality,
        setTodayPlan,
        setCurrentSession,
        toggleCommitment,
        setLoading,
        completeSession,
        generateTodayPlan,
        adjustPlan,
        adjustFromText,
        approvePlan,
        startSession,
        initializeDay,
        resumeAbandonedSession,
        syncCalendar,
        syncHealth,
        syncGitHub,
      }}
    >
      {children}
    </ForgeContext.Provider>
  );
}

export function useForge() {
  const ctx = useContext(ForgeContext);
  if (!ctx) throw new Error("useForge must be used within ForgeProvider");
  return ctx;
}
