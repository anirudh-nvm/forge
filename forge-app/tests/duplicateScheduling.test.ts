import { describe, it, expect } from "vitest";
import { scheduleDay } from "../src/brain/Scheduler";

describe("duplicate scheduling", () => {
  it("schedules duplicate-titled flexible tasks at different times", () => {
    const { plan } = scheduleDay(
      [],
      [
        { title: "Competitive Exam", constraints: [], confidence: 0.9 },
        { title: "Competitive Exam", constraints: [], confidence: 0.8 },
      ],
      [],
      []
    );

    const exams = plan.commitments.filter(c => c.title === "Competitive Exam");
    expect(exams).toHaveLength(2);
    expect(plan.unscheduled.filter(u => u.title === "Competitive Exam")).toHaveLength(0);
  });

  it("assigns unique ids to duplicate-titled commitments", () => {
    const { plan } = scheduleDay(
      [],
      [
        { title: "Competitive Exam", constraints: [], confidence: 0.9 },
        { title: "Competitive Exam", constraints: [], confidence: 0.8 },
      ],
      [],
      []
    );

    const ids = plan.commitments.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const exams = plan.commitments.filter(c => c.title === "Competitive Exam");
    expect(exams[0].id).toBe("competitive-exam");
    expect(exams[1].id).toBe("competitive-exam-2");
  });

  it("does not overlap duplicate-titled commitments", () => {
    const { plan } = scheduleDay(
      [],
      [
        { title: "Competitive Exam", constraints: [], confidence: 0.9 },
        { title: "Competitive Exam", constraints: [], confidence: 0.8 },
      ],
      [],
      []
    );

    const parse = (t: string) => {
      const match = t.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
      if (!match) return 0;
      let h = parseInt(match[1], 10);
      const m = match[2] ? parseInt(match[2], 10) : 0;
      const p = match[3]?.toUpperCase();
      if (p === "PM" && h !== 12) h += 12;
      if (p === "AM" && h === 12) h = 0;
      return h + m / 60;
    };

    const exams = plan.commitments.filter(c => c.title === "Competitive Exam");
    const aStart = parse(exams[0].startTime);
    const aEnd = parse(exams[0].endTime);
    const bStart = parse(exams[1].startTime);
    const bEnd = parse(exams[1].endTime);
    expect(aStart < bEnd && bStart < aEnd).toBe(false);
  });

  it("carries confidence onto scheduled commitments", () => {
    const { plan } = scheduleDay(
      [],
      [
        { title: "Competitive Exam", constraints: [], confidence: 0.9 },
        { title: "Competitive Exam", constraints: [], confidence: 0.8 },
      ],
      [],
      []
    );

    const exams = plan.commitments.filter(c => c.title === "Competitive Exam");
    expect(exams[0].confidence).toBe(0.9);
    expect(exams[1].confidence).toBe(0.8);
  });
});