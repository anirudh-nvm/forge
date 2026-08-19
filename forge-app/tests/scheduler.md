# Scheduler Stress Test

**Date:** 2026-08-05
**Result:** 36/36 passed

---

## Category A — Fixed Events

| # | Input | Expected | Result |
|---|---|---|---|
| A1 | `College 9-5` | 1 event, 1 commitment | ✓ College 9:00-5:00 PM |
| A2 | `College 9-5\nMeeting 3-4` | 2 events, 2 commitments | ✓ College 9:00-5:00 PM, Meeting 3:00-4:00 PM |
| A3 | `Office till 6` | 1 event, 1 commitment | ✓ Office 10:00 AM-6:00 PM |
| A4 | `College until 5` | 1 event, 1 commitment | ✓ College 9:00 AM-5:00 PM |
| A5 | `Meeting from 3 to 5` | 1 event, 1 commitment | ✓ Meeting 3:00-5:00 PM |
| A6 | `Dentist at 6` | 1 event, 1 commitment | ✓ Dentist 6:00-7:00 PM |
| A7 | `College 9-17` | 1 event, 1 commitment | ✓ College 9:00-17:00 |
| A8 | `College 9-5\nMeeting 3-4\nGym 6-7` | 3 events, 3 commitments | ✓ All scheduled |
| A9 | `College 9am-5pm` | 1 event, 1 commitment | ✓ College 9:00 AM-5:00 PM |
| A10 | `College 9:00-17:00` | 1 event, 1 commitment | ✓ College 9:00 AM-5:00 PM |

---

## Category B — Flexible Tasks

| # | Input | Expected | Result |
|---|---|---|---|
| B1 | `Gym` | 1 task, 1 commitment | ✓ Gym 12:00-1:00 PM |
| B2 | `Gym\nStudy` | 2 tasks, 2 commitments | ✓ Gym + Study |
| B3 | `Workout` | 1 task (→ Gym) | ✓ Gym 12:00-1:00 PM |
| B4 | `Leetcode` | 1 task (→ DSA Practice) | ✓ DSA Practice 12:00-1:00 PM |
| B5 | `Exercise` | 1 task (→ Gym) | ✓ Gym 12:00-1:00 PM |
| B6 | `Need to hit the gym` | 1 task | ✓ Gym 12:00-1:00 PM |
| B7 | `I should study` | 1 task | ✓ Study 12:00-1:00 PM |

---

## Category C — Constraints

| # | Input | Expected | Result |
|---|---|---|---|
| C1 | `Gym before dinner` | 1 task, constraint: before Dinner | ✓ Gym 12:00-1:00 PM |
| C2 | `Study after college` | 1 task, constraint: after College | ✓ College 12:00-1:00 PM |
| C3 | `Gym before work` | 1 task, constraint: before Work | ✓ Gym 7:30-8:30 AM |
| C4 | `Walk after lunch` | 1 task, constraint: after Lunch | ✓ Lunch 1:00-2:00 PM |
| C5 | `Gym before dinner\nStudy after college` | 2 tasks, both constrained | ✓ Both scheduled |
| C6 | `College 9-5\nGym after college` | 1 event + 1 task | ✓ College 9:00-5:00, Gym 5:00-6:00 PM |
| C7 | `College 9-5\nDSA before dinner` | 1 event + 1 task | ✓ College 9:00-5:00, DSA 5:00-6:00 PM |

---

## Category D — Natural Language

| # | Input | Expected | Result |
|---|---|---|---|
| D1 | `Need to finish 5 Leetcode questions before dinner` | 1 task (DSA, qty 5, before Dinner) | ✓ DSA Practice 12:00-1:00 PM |
| D2 | `I'll be in college until around five` | 1 event | ✓ College 9:00 AM-5:00 PM |
| D3 | `College 9-5\nNeed to hit the gym\nDSA before dinner` | 1 event + 2 tasks | ✓ All 3 scheduled |
| D4 | `So basically I need to like go to the gym and stuff` | 1 task (fillers removed) | ✓ Gym 12:00-1:00 PM |
| D5 | `Tomorrow is packed` | 0 events, 0 tasks (ignored) | ✓ Empty schedule |
| D6 | `Maybe do DSA before dinner` | 1 task | ✓ DSA Practice 12:00-1:00 PM |
| D7 | `College 9-5\nNeed to hit the gym\nDSA 5 questions before dinner\nNeed to read 20 pages` | 1 event + 3 tasks | ✓ All 4 scheduled |

---

## Category E — Impossible / Edge Cases

| # | Input | Expected | Result |
|---|---|---|---|
| E1 | `College 9-5\nMeeting 2-4` | 2 events (overlapping) | ✓ Both kept as-is |
| E2 | `College 9-5\nGym before college` | Gym placed before 9 AM | ✓ Gym 7:30-8:30 AM, College 9:00-5:00 |
| E3 | `College 9-9\nGym\nDSA before dinner` | Full day, tasks fit around | ✓ College 9:00-9:00, DSA + Gym in free slots |
| E4 | `Dinner before lunch` | Task with constraint | ✓ Dinner 12:00-1:00 PM |
| E5 | `College 9-5\nGym\nStudy\nDSA\nLaundry\nShopping\nCooking` | 1 event + 6 tasks | ✓ 5 scheduled, overflow handled |

---

## Bugs Found & Fixed

| Bug | Description | Fix |
|---|---|---|
| A9 | `9am-5pm` not recognized as time range | Updated `hasExplicitTime` regex to handle AM/PM in hyphen format |
| Missing entities | `study`, `read`, `cooking`, `walk`, `call`, `run` not in dictionary | Added to EntityExtractor |
| College 6 AM | `applyDefaults` extracted "5" from "5:00 PM" instead of 17 | Added `parseTimeTo24h` helper |
| Chronological order | Commitments not sorted by startTime | Added `.sort()` before returning plan |

---

## Architecture Notes

- **Planning is independent of execution** — `currentTime` removed from scheduler
- **Occupied timeline built first** — free windows calculated before placing tasks
- **Score-based scheduling** — all valid slots evaluated, best chosen
- **Structured constraints** — scheduler never does string matching
- **Assertions before return** — `assertNoOverlap`, `assertFixedEventsProtected`, `assertChronological`
