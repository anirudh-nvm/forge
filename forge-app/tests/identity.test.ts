import { describe, it, expect, beforeEach, vi } from "vitest";
import * as IdentityEngine from "../src/identity/IdentityEngine";
import { calculateProgress, calculateAllProgress, getProgressSummary } from "../src/identity/IdentityProgress";
import type { IdentityData } from "../src/identity/IdentityTypes";

let mockData: IdentityData = { lifeDirections: [], goals: [], projects: [], tasks: [] };

vi.mock("../src/storage/StorageEngine", () => ({
  StorageEngine: {
    loadIdentityData: async () => mockData,
    saveIdentityData: async (d: IdentityData) => {
      mockData = d;
    },
  },
}));

describe("IdentityEngine", () => {
  beforeEach(async () => {
    mockData = { lifeDirections: [], goals: [], projects: [], tasks: [] };
    IdentityEngine.reset();
    await IdentityEngine.loadIdentity();
  });

  describe("createLifeDirection", () => {
    it("creates a life direction", () => {
      const ld = IdentityEngine.createLifeDirection({
        title: "Become Interview Ready",
        description: "Master DSA and system design",
      });

      expect(ld.title).toBe("Become Interview Ready");
      expect(ld.goalIds).toHaveLength(0);
      expect(ld.id).toBeTruthy();
    });

    it("sets current life direction", () => {
      IdentityEngine.createLifeDirection({
        title: "Direction 1",
        description: "Desc",
      });

      const current = IdentityEngine.getCurrentLifeDirection();
      expect(current?.title).toBe("Direction 1");
    });
  });

  describe("createGoal", () => {
    it("creates a goal under a life direction", () => {
      const ld = IdentityEngine.createLifeDirection({
        title: "Direction",
        description: "Desc",
      });

      const goal = IdentityEngine.createGoal({
        lifeDirectionId: ld.id,
        title: "Become Interview Ready",
        description: "Master DSA",
      });

      expect(goal).toBeDefined();
      expect(goal?.title).toBe("Become Interview Ready");
      expect(goal?.lifeDirectionId).toBe(ld.id);
    });

    it("returns undefined for invalid life direction", () => {
      const goal = IdentityEngine.createGoal({
        lifeDirectionId: "invalid",
        title: "Goal",
        description: "Desc",
      });

      expect(goal).toBeUndefined();
    });

    it("links goal to life direction", () => {
      const ld = IdentityEngine.createLifeDirection({
        title: "Direction",
        description: "Desc",
      });

      IdentityEngine.createGoal({
        lifeDirectionId: ld.id,
        title: "Goal 1",
        description: "Desc",
      });

      const goals = IdentityEngine.getGoals(ld.id);
      expect(goals).toHaveLength(1);
    });
  });

  describe("createProject", () => {
    it("creates a project under a goal", () => {
      const ld = IdentityEngine.createLifeDirection({
        title: "Direction",
        description: "Desc",
      });
      const goal = IdentityEngine.createGoal({
        lifeDirectionId: ld.id,
        title: "Goal",
        description: "Desc",
      });

      const project = IdentityEngine.createProject({
        goalId: goal!.id,
        title: "DSA",
        description: "Data structures and algorithms",
      });

      expect(project).toBeDefined();
      expect(project?.title).toBe("DSA");
    });

    it("returns undefined for invalid goal", () => {
      const project = IdentityEngine.createProject({
        goalId: "invalid",
        title: "Project",
        description: "Desc",
      });

      expect(project).toBeUndefined();
    });
  });

  describe("createTask", () => {
    it("creates a task under a project", () => {
      const ld = IdentityEngine.createLifeDirection({
        title: "Direction",
        description: "Desc",
      });
      const goal = IdentityEngine.createGoal({
        lifeDirectionId: ld.id,
        title: "Goal",
        description: "Desc",
      });
      const project = IdentityEngine.createProject({
        goalId: goal!.id,
        title: "Project",
        description: "Desc",
      });

      const task = IdentityEngine.createTask({
        projectId: project!.id,
        title: "Solve 5 Leetcode questions",
        description: "Easy difficulty",
      });

      expect(task).toBeDefined();
      expect(task?.title).toBe("Solve 5 Leetcode questions");
      expect(task?.completed).toBe(false);
    });

    it("returns undefined for invalid project", () => {
      const task = IdentityEngine.createTask({
        projectId: "invalid",
        title: "Task",
        description: "Desc",
      });

      expect(task).toBeUndefined();
    });
  });

  describe("completeTask", () => {
    it("marks task as completed", () => {
      const ld = IdentityEngine.createLifeDirection({
        title: "Direction",
        description: "Desc",
      });
      const goal = IdentityEngine.createGoal({
        lifeDirectionId: ld.id,
        title: "Goal",
        description: "Desc",
      });
      const project = IdentityEngine.createProject({
        goalId: goal!.id,
        title: "Project",
        description: "Desc",
      });
      const task = IdentityEngine.createTask({
        projectId: project!.id,
        title: "Task",
        description: "Desc",
      });

      const completed = IdentityEngine.completeTask(task!.id);
      expect(completed?.completed).toBe(true);
    });
  });

  describe("linkSessionToTask", () => {
    it("links session to task", () => {
      const ld = IdentityEngine.createLifeDirection({
        title: "Direction",
        description: "Desc",
      });
      const goal = IdentityEngine.createGoal({
        lifeDirectionId: ld.id,
        title: "Goal",
        description: "Desc",
      });
      const project = IdentityEngine.createProject({
        goalId: goal!.id,
        title: "Project",
        description: "Desc",
      });
      const task = IdentityEngine.createTask({
        projectId: project!.id,
        title: "Task",
        description: "Desc",
      });

      const linked = IdentityEngine.linkSessionToTask(task!.id, "session_123");
      expect(linked?.sessionId).toBe("session_123");
    });
  });

  describe("getSessionContext", () => {
    it("returns full context for a session", () => {
      const ld = IdentityEngine.createLifeDirection({
        title: "Become Healthier",
        description: "Improve fitness",
      });
      const goal = IdentityEngine.createGoal({
        lifeDirectionId: ld.id,
        title: "Become Healthier",
        description: "Desc",
      });
      const project = IdentityEngine.createProject({
        goalId: goal!.id,
        title: "Exercise",
        description: "Desc",
      });
      const task = IdentityEngine.createTask({
        projectId: project!.id,
        title: "Gym",
        description: "Desc",
      });

      IdentityEngine.linkSessionToTask(task!.id, "session_abc");

      const context = IdentityEngine.getSessionContext("session_abc");
      expect(context).toBeDefined();
      expect(context?.goalTitle).toBe("Become Healthier");
      expect(context?.projectTitle).toBe("Exercise");
      expect(context?.taskTitle).toBe("Gym");
    });

    it("returns undefined for unknown session", () => {
      const context = IdentityEngine.getSessionContext("unknown");
      expect(context).toBeUndefined();
    });
  });

  describe("getContextForCommitment", () => {
    it("returns context by commitment title", () => {
      const ld = IdentityEngine.createLifeDirection({
        title: "Direction",
        description: "Desc",
      });
      const goal = IdentityEngine.createGoal({
        lifeDirectionId: ld.id,
        title: "Goal",
        description: "Desc",
      });
      const project = IdentityEngine.createProject({
        goalId: goal!.id,
        title: "Project",
        description: "Desc",
      });
      IdentityEngine.createTask({
        projectId: project!.id,
        title: "Gym",
        description: "Desc",
      });

      const context = IdentityEngine.getContextForCommitment("Gym");
      expect(context).toBeDefined();
      expect(context?.goalTitle).toBe("Goal");
    });

    it("returns undefined for unknown commitment", () => {
      const context = IdentityEngine.getContextForCommitment("Unknown");
      expect(context).toBeUndefined();
    });
  });

  describe("query", () => {
    it("getGoals returns goals for a life direction", () => {
      const ld = IdentityEngine.createLifeDirection({
        title: "Direction",
        description: "Desc",
      });

      IdentityEngine.createGoal({
        lifeDirectionId: ld.id,
        title: "Goal 1",
        description: "Desc",
      });
      IdentityEngine.createGoal({
        lifeDirectionId: ld.id,
        title: "Goal 2",
        description: "Desc",
      });

      const goals = IdentityEngine.getGoals(ld.id);
      expect(goals).toHaveLength(2);
    });

    it("getTasks returns tasks for a project", () => {
      const ld = IdentityEngine.createLifeDirection({
        title: "Direction",
        description: "Desc",
      });
      const goal = IdentityEngine.createGoal({
        lifeDirectionId: ld.id,
        title: "Goal",
        description: "Desc",
      });
      const project = IdentityEngine.createProject({
        goalId: goal!.id,
        title: "Project",
        description: "Desc",
      });

      IdentityEngine.createTask({
        projectId: project!.id,
        title: "Task 1",
        description: "Desc",
      });
      IdentityEngine.createTask({
        projectId: project!.id,
        title: "Task 2",
        description: "Desc",
      });

      const tasks = IdentityEngine.getTasks(project!.id);
      expect(tasks).toHaveLength(2);
    });
  });
});

describe("IdentityProgress", () => {
  beforeEach(async () => {
    mockData = { lifeDirections: [], goals: [], projects: [], tasks: [] };
    IdentityEngine.reset();
    await IdentityEngine.loadIdentity();
  });

  it("calculates progress for a life direction", () => {
    const ld = IdentityEngine.createLifeDirection({
      title: "Become Interview Ready",
      description: "Desc",
    });
    const goal = IdentityEngine.createGoal({
      lifeDirectionId: ld.id,
      title: "Master DSA",
      description: "Desc",
    });
    const project = IdentityEngine.createProject({
      goalId: goal!.id,
      title: "Leetcode",
      description: "Desc",
    });

    const task1 = IdentityEngine.createTask({
      projectId: project!.id,
      title: "Task 1",
      description: "Desc",
    });
    const task2 = IdentityEngine.createTask({
      projectId: project!.id,
      title: "Task 2",
      description: "Desc",
    });

    IdentityEngine.completeTask(task1!.id);

    const progress = calculateProgress(ld.id);
    expect(progress).toBeDefined();
    expect(progress?.goalProgress).toHaveLength(1);
    expect(progress?.goalProgress[0].overallRate).toBe(0.5);
  });

  it("returns undefined for invalid life direction", () => {
    const progress = calculateProgress("invalid");
    expect(progress).toBeUndefined();
  });

  it("calculates all progress", () => {
    IdentityEngine.createLifeDirection({
      title: "Direction 1",
      description: "Desc",
    });
    IdentityEngine.createLifeDirection({
      title: "Direction 2",
      description: "Desc",
    });

    const all = calculateAllProgress();
    expect(all).toHaveLength(2);
  });

  it("calculates progress summary", () => {
    const ld = IdentityEngine.createLifeDirection({
      title: "Direction",
      description: "Desc",
    });
    const goal = IdentityEngine.createGoal({
      lifeDirectionId: ld.id,
      title: "Goal",
      description: "Desc",
    });
    const project = IdentityEngine.createProject({
      goalId: goal!.id,
      title: "Project",
      description: "Desc",
    });

    const task1 = IdentityEngine.createTask({
      projectId: project!.id,
      title: "Task 1",
      description: "Desc",
    });
    const task2 = IdentityEngine.createTask({
      projectId: project!.id,
      title: "Task 2",
      description: "Desc",
    });

    IdentityEngine.completeTask(task1!.id);

    const summary = getProgressSummary();
    expect(summary.totalTasks).toBe(2);
    expect(summary.completedTasks).toBe(1);
    expect(summary.overallRate).toBe(0.5);
  });

  it("handles empty data gracefully", () => {
    const summary = getProgressSummary();
    expect(summary.totalTasks).toBe(0);
    expect(summary.completedTasks).toBe(0);
    expect(summary.overallRate).toBe(0);
  });
});
