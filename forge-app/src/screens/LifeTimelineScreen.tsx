import { useState, useEffect } from "react";
import Screen from "../components/ui/Screen";
import { Title, Body } from "../components/ui/Typography";
import LifeTimeline from "../components/intelligence/LifeTimeline";
import { useForge } from "../context/ForgeContext";
import { detectMilestones } from "../memory/MilestoneEngine";
import type { Milestone } from "../memory/MilestoneEngine";
import { StorageEngine } from "../storage/StorageEngine";

export default function LifeTimelineScreen() {
  const { trustScore } = useForge();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [experiments, observations, reflections, archives] = await Promise.all([
          StorageEngine.loadExperiments(),
          StorageEngine.loadObservations(),
          StorageEngine.loadReflectionMemory(),
          StorageEngine.loadDayArchives(),
        ]);

        const detected = detectMilestones({
          trustScore,
          experiments,
          observations,
          reflections,
          dayArchiveCount: archives.length,
          totalSessions: trustScore.history.length,
          firstUseDate: archives.length > 0 ? archives[0].date : undefined,
          now: new Date(),
        });

        setMilestones(detected);
      } catch {
        setMilestones([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [trustScore]);

  if (loading) {
    return (
      <Screen>
        <Body>loading your story...</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <LifeTimeline milestones={milestones} />
    </Screen>
  );
}
