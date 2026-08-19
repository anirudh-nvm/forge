import type {
  LifeDirection,
  Goal,
  Project,
  Task,
  IdentityData,
  SessionContext,
} from "./IdentityTypes";
import { StorageEngine } from "../storage/StorageEngine";

let data: IdentityData = {
  lifeDirections: [],
  goals: [],
  projects: [],
  tasks: [],
};
let loaded = false;

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowStr(): string {
  return new Date().toISOString();
}

function persist(): void {
  StorageEngine.saveIdentityData(data).catch(() => {});
}

export async function loadIdentity(): Promise<void> {
  if (loaded) return;
  data = await StorageEngine.loadIdentityData();
  loaded = true;
}

export function getCurrentLifeDirection(): LifeDirection | undefined {
  return data.lifeDirections[0];
}

export function getAllLifeDirections(): LifeDirection[] {
  return [...data.lifeDirections];
}

export function getGoals(lifeDirectionId: string): Goal[] {
  return data.goals.filter((g) => g.lifeDirectionId === lifeDirectionId);
}

export function getProjects(goalId: string): Project[] {
  return data.projects.filter((p) => p.goalId === goalId);
}

export function getTasks(projectId: string): Task[] {
  return data.tasks.filter((t) => t.projectId === projectId);
}

export function getTaskById(taskId: string): Task | undefined {
  return data.tasks.find((t) => t.id === taskId);
}

export function getProjectById(projectId: string): Project | undefined {
  return data.projects.find((p) => p.id === projectId);
}

export function getGoalById(goalId: string): Goal | undefined {
  return data.goals.find((g) => g.id === goalId);
}

export function getLifeDirectionById(id: string): LifeDirection | undefined {
  return data.lifeDirections.find((ld) => ld.id === id);
}

export function createLifeDirection(params: {
  title: string;
  description: string;
}): LifeDirection {
  const lifeDirection: LifeDirection = {
    id: generateId("ld"),
    title: params.title,
    description: params.description,
    goalIds: [],
    createdAt: nowStr(),
    updatedAt: nowStr(),
  };

  data.lifeDirections.push(lifeDirection);
  persist();
  return lifeDirection;
}

export function createGoal(params: {
  lifeDirectionId: string;
  title: string;
  description: string;
}): Goal | undefined {
  const lifeDirection = data.lifeDirections.find(
    (ld) => ld.id === params.lifeDirectionId
  );
  if (!lifeDirection) return undefined;

  const goal: Goal = {
    id: generateId("goal"),
    lifeDirectionId: params.lifeDirectionId,
    title: params.title,
    description: params.description,
    projectIds: [],
    createdAt: nowStr(),
  };

  data.goals.push(goal);
  lifeDirection.goalIds.push(goal.id);
  lifeDirection.updatedAt = nowStr();
  persist();
  return goal;
}

export function createProject(params: {
  goalId: string;
  title: string;
  description: string;
}): Project | undefined {
  const goal = data.goals.find((g) => g.id === params.goalId);
  if (!goal) return undefined;

  const project: Project = {
    id: generateId("proj"),
    goalId: params.goalId,
    title: params.title,
    description: params.description,
    taskIds: [],
    createdAt: nowStr(),
  };

  data.projects.push(project);
  goal.projectIds.push(project.id);
  persist();
  return project;
}

export function createTask(params: {
  projectId: string;
  title: string;
  description: string;
}): Task | undefined {
  const project = data.projects.find((p) => p.id === params.projectId);
  if (!project) return undefined;

  const task: Task = {
    id: generateId("task"),
    projectId: params.projectId,
    title: params.title,
    description: params.description,
    completed: false,
    createdAt: nowStr(),
  };

  data.tasks.push(task);
  project.taskIds.push(task.id);
  persist();
  return task;
}

export function completeTask(taskId: string): Task | undefined {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return undefined;

  task.completed = true;
  persist();
  return task;
}

export function linkSessionToTask(taskId: string, sessionId: string): Task | undefined {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return undefined;

  task.sessionId = sessionId;
  persist();
  return task;
}

export function getSessionContext(sessionId: string): SessionContext | undefined {
  const task = data.tasks.find((t) => t.sessionId === sessionId);
  if (!task) return undefined;

  const project = data.projects.find((p) => p.id === task.projectId);
  if (!project) return undefined;

  const goal = data.goals.find((g) => g.id === project.goalId);
  if (!goal) return undefined;

  const lifeDirection = data.lifeDirections.find(
    (ld) => ld.id === goal.lifeDirectionId
  );
  if (!lifeDirection) return undefined;

  return {
    taskId: task.id,
    projectId: project.id,
    goalId: goal.id,
    lifeDirectionId: lifeDirection.id,
    goalTitle: goal.title,
    projectTitle: project.title,
    taskTitle: task.title,
  };
}

export function getContextForCommitment(
  commitmentTitle: string
): SessionContext | undefined {
  const task = data.tasks.find(
    (t) => t.title.toLowerCase() === commitmentTitle.toLowerCase()
  );
  if (!task) return undefined;

  const project = data.projects.find((p) => p.id === task.projectId);
  if (!project) return undefined;

  const goal = data.goals.find((g) => g.id === project.goalId);
  if (!goal) return undefined;

  const lifeDirection = data.lifeDirections.find(
    (ld) => ld.id === goal.lifeDirectionId
  );
  if (!lifeDirection) return undefined;

  return {
    taskId: task.id,
    projectId: project.id,
    goalId: goal.id,
    lifeDirectionId: lifeDirection.id,
    goalTitle: goal.title,
    projectTitle: project.title,
    taskTitle: task.title,
  };
}

export function getData(): IdentityData {
  return {
    lifeDirections: [...data.lifeDirections],
    goals: [...data.goals],
    projects: [...data.projects],
    tasks: [...data.tasks],
  };
}

export function reset(): void {
  data = {
    lifeDirections: [],
    goals: [],
    projects: [],
    tasks: [],
  };
  loaded = false;
}
