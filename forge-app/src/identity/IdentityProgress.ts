import type {
  LifeDirection,
  Goal,
  Project,
  Task,
  GoalProgress,
  ProjectProgress,
  IdentityProgress,
} from "./IdentityTypes";
import { getData } from "./IdentityEngine";

function calculateProjectProgress(
  project: Project,
  tasks: Task[]
): ProjectProgress {
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter((t) => t.completed).length;

  return {
    projectId: project.id,
    projectTitle: project.title,
    completedTasks,
    totalTasks,
    rate: totalTasks > 0 ? completedTasks / totalTasks : 0,
  };
}

function calculateGoalProgress(
  goal: Goal,
  projects: Project[],
  tasks: Task[]
): GoalProgress {
  const goalProjects = projects.filter((p) => p.goalId === goal.id);
  const projectProgress = goalProjects.map((p) =>
    calculateProjectProgress(p, tasks)
  );

  const totalTasks = projectProgress.reduce((sum, p) => sum + p.totalTasks, 0);
  const completedTasks = projectProgress.reduce(
    (sum, p) => sum + p.completedTasks,
    0
  );

  return {
    goalId: goal.id,
    goalTitle: goal.title,
    projectProgress,
    overallRate: totalTasks > 0 ? completedTasks / totalTasks : 0,
  };
}

export function calculateProgress(lifeDirectionId: string): IdentityProgress | undefined {
  const data = getData();
  const lifeDirection = data.lifeDirections.find(
    (ld) => ld.id === lifeDirectionId
  );
  if (!lifeDirection) return undefined;

  const goals = data.goals.filter(
    (g) => g.lifeDirectionId === lifeDirectionId
  );
  const goalProgress = goals.map((g) =>
    calculateGoalProgress(g, data.projects, data.tasks)
  );

  return {
    lifeDirectionId: lifeDirection.id,
    lifeDirectionTitle: lifeDirection.title,
    goalProgress,
    generatedAt: new Date().toISOString(),
  };
}

export function calculateAllProgress(): IdentityProgress[] {
  const data = getData();
  return data.lifeDirections.map((ld) => {
    const goals = data.goals.filter((g) => g.lifeDirectionId === ld.id);
    const goalProgress = goals.map((g) =>
      calculateGoalProgress(g, data.projects, data.tasks)
    );

    return {
      lifeDirectionId: ld.id,
      lifeDirectionTitle: ld.title,
      goalProgress,
      generatedAt: new Date().toISOString(),
    };
  });
}

export function getProgressSummary(): {
  totalTasks: number;
  completedTasks: number;
  overallRate: number;
} {
  const data = getData();
  const totalTasks = data.tasks.length;
  const completedTasks = data.tasks.filter((t) => t.completed).length;

  return {
    totalTasks,
    completedTasks,
    overallRate: totalTasks > 0 ? completedTasks / totalTasks : 0,
  };
}
