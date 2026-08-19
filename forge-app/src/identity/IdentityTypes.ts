export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  completed: boolean;
  sessionId?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  goalId: string;
  title: string;
  description: string;
  taskIds: string[];
  createdAt: string;
}

export interface Goal {
  id: string;
  lifeDirectionId: string;
  title: string;
  description: string;
  projectIds: string[];
  createdAt: string;
}

export interface LifeDirection {
  id: string;
  title: string;
  description: string;
  goalIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GoalProgress {
  goalId: string;
  goalTitle: string;
  projectProgress: ProjectProgress[];
  overallRate: number;
}

export interface ProjectProgress {
  projectId: string;
  projectTitle: string;
  completedTasks: number;
  totalTasks: number;
  rate: number;
}

export interface IdentityProgress {
  lifeDirectionId: string;
  lifeDirectionTitle: string;
  goalProgress: GoalProgress[];
  generatedAt: string;
}

export interface SessionContext {
  taskId: string;
  projectId: string;
  goalId: string;
  lifeDirectionId: string;
  goalTitle: string;
  projectTitle: string;
  taskTitle: string;
}

export interface IdentityData {
  lifeDirections: LifeDirection[];
  goals: Goal[];
  projects: Project[];
  tasks: Task[];
}
