export interface EntityMatch {
  original: string;
  normalized: string;
  start: number;
  end: number;
}

const ENTITIES: Record<string, string> = {
  // ── Study ──────────────────────────────────────────────────────
  college: "College",
  class: "College",
  classes: "College",
  lecture: "College",
  lectures: "College",
  seminar: "College",
  cat: "Competitive Exam",
  jee: "Competitive Exam",
  gre: "Competitive Exam",
  upsc: "Competitive Exam",
  gate: "Competitive Exam",
  "civil services": "Competitive Exam",
  "entrance exam": "Competitive Exam",
  "competitive exam": "Competitive Exam",
  interview: "Interview",
  interviews: "Interview",
  assignment: "Assignment",
  assignments: "Assignment",
  homework: "Assignment",
  hw: "Assignment",
  revision: "Revision",
  revise: "Revision",
  revising: "Revision",
  "mock test": "Mock Test",
  "mock tests": "Mock Test",
  mocks: "Mock Test",
  research: "Research",
  studying: "Study",
  study: "Study",
  "case study": "Research",
  "current affairs": "Current Affairs",
  newspaper: "Current Affairs",
  "answer writing": "Answer Writing",
  "answer writing practice": "Answer Writing",
  pyq: "PYQs",
  pyqs: "PYQs",
  "previous year questions": "PYQs",
  prep: "Exam Prep",
  preparation: "Exam Prep",
  preparing: "Exam Prep",

  // ── Health ─────────────────────────────────────────────────────
  gym: "Gym",
  workout: "Gym",
  workouts: "Gym",
  exercise: "Gym",
  exercising: "Gym",
  walk: "Walk",
  walking: "Walk",
  walks: "Walk",
  run: "Run",
  running: "Run",
  runs: "Run",
  jog: "Run",
  jogging: "Run",
  yoga: "Yoga",
  stretch: "Stretch",
  stretching: "Stretch",
  mobility: "Stretch",
  meditation: "Meditation",
  meditate: "Meditation",
  "deep breathing": "Meditation",
  physio: "Physio",
  physiotherapy: "Physio",
  "physical therapy": "Physio",
  swim: "Swim",
  swimming: "Swim",
  sport: "Sport",
  sports: "Sport",
  tennis: "Sport",
  football: "Sport",
  cricket: "Sport",
  basketball: "Sport",
  badminton: "Sport",

  // ── Work ───────────────────────────────────────────────────────
  office: "Office",
  work: "Office",
  "work from home": "Office",
  wfh: "Office",
  email: "Email",
  emails: "Email",
  "check email": "Email",
  meeting: "Meeting",
  meetings: "Meeting",
  standup: "Standup",
  "stand up": "Standup",
  coding: "Coding",
  code: "Coding",
  programming: "Coding",
  "code review": "Coding",
  leetcode: "DSA Practice",
  dsa: "DSA Practice",
  design: "Design",
  designing: "Design",
  ui: "Design",
  ux: "Design",
  presentation: "Presentation",
  presenting: "Presentation",
  "presentation prep": "Presentation",
  "deep work": "Deep Work",
  "focus block": "Deep Work",
  admin: "Admin",
  paperwork: "Admin",
  "paper work": "Admin",
  project: "Project",
  projects: "Project",
  "side project": "Project",
  "client work": "Client Work",
  client: "Client Work",

  // ── Home ───────────────────────────────────────────────────────
  laundry: "Laundry",
  cooking: "Cooking",
  cook: "Cooking",
  "meal prep": "Cooking",
  groceries: "Groceries",
  grocery: "Groceries",
  "grocery shopping": "Groceries",
  "buy groceries": "Groceries",
  cleaning: "Cleaning",
  clean: "Cleaning",
  vacuum: "Cleaning",
  dishes: "Cleaning",
  "wash dishes": "Cleaning",
  bills: "Bills",
  bill: "Bills",
  "pay bills": "Bills",
  "home repair": "Home Repair",
  "repair work": "Home Repair",
  shopping: "Shopping",
  "grocery store": "Groceries",

  // ── Personal ───────────────────────────────────────────────────
  journal: "Journal",
  journaling: "Journal",
  read: "Reading",
  reading: "Reading",
  "read a book": "Reading",
  book: "Reading",
  family: "Family",
  "family time": "Family",
  "family call": "Family",
  friends: "Friends",
  friend: "Friends",
  hangout: "Friends",
  "hang out": "Friends",
  "call parents": "Call Parents",
  "call mom": "Call Parents",
  "call dad": "Call Parents",
  "call mother": "Call Parents",
  "call father": "Call Parents",
  "talk to parents": "Call Parents",
  coffee: "Coffee",
  "grab coffee": "Coffee",
  call: "Call",
  calls: "Call",
  "phone call": "Call",
  gaming: "Gaming",
  "video games": "Gaming",
  movie: "Movie",
  "watch movie": "Movie",
  netflix: "Movie",
  "call friend": "Friends",
  "call friends": "Friends",

  // ── Meals / recurring ──────────────────────────────────────────
  dinner: "Dinner",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dentist: "Dentist",
  appointment: "Appointment",
  appointments: "Appointment",
  "doctor appointment": "Appointment",
  taxes: "Finances",
  budgeting: "Finances",
  finance: "Finances",
  "financial planning": "Finances",
};

const sortedKeys = Object.keys(ENTITIES).sort((a, b) => b.length - a.length);

export function extractEntities(text: string): EntityMatch[] {
  const matches: EntityMatch[] = [];
  const lower = text.toLowerCase();

  for (const key of sortedKeys) {
    const regex = new RegExp(`\\b${key}\\b`, "gi");
    let match;
    while ((match = regex.exec(lower)) !== null) {
      const alreadyCovered = matches.some(
        m => match!.index >= m.start && match!.index < m.end
      );
      if (!alreadyCovered) {
        matches.push({
          original: match[0],
          normalized: ENTITIES[key],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}

export function resolveEntity(text: string): string | null {
  const matches = extractEntities(text);
  return matches.length > 0 ? matches[0].normalized : null;
}

export function entityCount(): number {
  return new Set(Object.values(ENTITIES)).size;
}