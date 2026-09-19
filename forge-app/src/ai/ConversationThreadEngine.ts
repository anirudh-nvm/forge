import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  ConversationThread,
  EnergyState,
  TaskCheckIn,
  TaskCheckInResponse,
  ThreadStatus,
  ReferenceContext,
} from "../types/companion";

const THREAD_KEY = "forge:conversation_thread";
const THREAD_HISTORY_KEY = "forge:thread_history";

export function createThread(): ConversationThread {
  const now = new Date();
  return {
    id: `thread_${now.getTime()}`,
    date: now.toISOString().split("T")[0],
    energy: { level: "neutral", source: "self_report", confidence: 0.5 },
    taskCheckIns: [],
    status: "morning",
    isOpen: true,
    createdAt: now.toISOString(),
  };
}

export async function saveThread(thread: ConversationThread): Promise<void> {
  await AsyncStorage.setItem(THREAD_KEY, JSON.stringify(thread));
}

export async function loadThread(): Promise<ConversationThread | null> {
  const raw = await AsyncStorage.getItem(THREAD_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ConversationThread;
  } catch {
    return null;
  }
}

export async function closeThread(): Promise<void> {
  const thread = await loadThread();
  if (!thread) return;

  thread.isOpen = false;
  thread.closedAt = new Date().toISOString();

  await saveThread(thread);
  await appendToHistory(thread);
}

export async function updateThreadEnergy(energy: EnergyState): Promise<void> {
  const thread = await loadThread();
  if (!thread) return;

  thread.energy = energy;
  await saveThread(thread);
}

export async function updateThreadStatus(status: ThreadStatus): Promise<void> {
  const thread = await loadThread();
  if (!thread) return;

  thread.status = status;
  await saveThread(thread);
}

export async function addTaskCheckIn(
  commitmentId: string,
  response: TaskCheckInResponse
): Promise<void> {
  const thread = await loadThread();
  if (!thread) return;

  const checkIn: TaskCheckIn = {
    commitmentId,
    response,
    timestamp: new Date().toISOString(),
  };

  thread.taskCheckIns.push(checkIn);
  await saveThread(thread);
}

export async function getYesterdayThread(): Promise<ConversationThread | null> {
  const history = await getThreadHistory();
  const today = new Date().toISOString().split("T")[0];

  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].date !== today) {
      return history[i];
    }
  }
  return null;
}

export async function getThreadHistory(): Promise<ConversationThread[]> {
  const raw = await AsyncStorage.getItem(THREAD_HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ConversationThread[];
  } catch {
    return [];
  }
}

async function appendToHistory(thread: ConversationThread): Promise<void> {
  const history = await getThreadHistory();
  history.push(thread);

  const maxHistory = 30;
  if (history.length > maxHistory) {
    history.splice(0, history.length - maxHistory);
  }

  await AsyncStorage.setItem(THREAD_HISTORY_KEY, JSON.stringify(history));
}

function didCompleteTasks(thread: ConversationThread): boolean {
  if (thread.taskCheckIns.length === 0) return false;
  return thread.taskCheckIns.some(
    (c) => c.response === "productive" || c.response === "great" || c.response === "fine"
  );
}

function isLowEnergy(level: string): boolean {
  return level === "tired" || level === "low" || level === "recovering";
}

export function getReferenceContext(
  yesterdayThread: ConversationThread | null
): ReferenceContext {
  const defaultContext: ReferenceContext = {
    shouldAskEnergy: true,
    question: "how are you feeling today?",
    shouldReferenceYesterday: false,
    yesterdayMessage: null,
  };

  if (!yesterdayThread) {
    return defaultContext;
  }

  const { level } = yesterdayThread.energy;
  const completed = didCompleteTasks(yesterdayThread);
  const low = isLowEnergy(level);

  if (low && !completed) {
    return {
      shouldAskEnergy: true,
      question: "feeling any better today?",
      shouldReferenceYesterday: true,
      yesterdayMessage: "yesterday felt pretty heavy.",
    };
  }

  if (low && completed) {
    return {
      shouldAskEnergy: true,
      question: "ready for another one?",
      shouldReferenceYesterday: false,
      yesterdayMessage: null,
    };
  }

  if (level === "good" || level === "energized") {
    return {
      shouldAskEnergy: true,
      question: "feeling about the same today?",
      shouldReferenceYesterday: false,
      yesterdayMessage: null,
    };
  }

  return defaultContext;
}

export function getEnergyResponse(level: string): string {
  switch (level) {
    case "tired":
    case "low":
      return "thanks for telling me.";
    case "neutral":
      return "nice.";
    case "good":
      return "good.";
    case "energized":
      return "love to hear that.";
    case "stressed":
      return "understood.";
    default:
      return "alright.";
  }
}
