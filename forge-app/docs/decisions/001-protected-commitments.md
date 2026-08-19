# Decision: Protected Commitments


## Problem


When users add tasks to their day, most productivity apps treat them as suggestions. Users can easily skip, reschedule, or ignore commitments. This erodes trust in the system and in oneself.


## Options Considered


1. **Flexible scheduling** — Let users move or delete commitments freely
2. **Locked commitments** — Once added, commitments cannot be changed until the day is over
3. **Protected commitments** — Commitments are locked but can be adjusted with explicit confirmation


## Decision


We chose **protected commitments**. Once a commitment is part of today's plan, it is locked by default. Users can adjust it, but only through explicit actions that acknowledge the change.


## Reasoning


- A commitment is a promise to yourself
- Making it easy to break defeats the purpose
- Friction creates awareness
- The system should feel protective, not restrictive


## Trade-offs


- Users may feel frustrated when they can't easily change plans
- Some flexibility is lost
- Requires clear UI to explain why commitments are locked


## Future Impact


This decision shapes how AI generates plans. The system will prioritize protecting existing commitments before adding new ones. It also influences how we handle scheduling conflicts and plan adjustments.
