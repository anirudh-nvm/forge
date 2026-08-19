const GITHUB_API = "https://api.github.com";
const GITHUB_GQL = "https://api.github.com/graphql";

export type GitHubProfile = {
  login: string;
  name: string;
  avatarUrl: string;
  publicRepos: number;
  followers: number;
};

export type ContributionDay = {
  date: string;
  count: number;
};

export type ContributionStreak = {
  currentStreak: number;
  longestStreak: number;
  totalContributions: number;
  recentDays: ContributionDay[];
};

export type GitHubActivity = {
  type: "commit" | "pr" | "issue";
  title: string;
  repo: string;
  date: string;
  url: string;
};

export type GitHubData = {
  profile: GitHubProfile | null;
  streak: ContributionStreak;
  recentActivity: GitHubActivity[];
  syncedAt: string;
};

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchProfile(token?: string): Promise<GitHubProfile | null> {
  try {
    const res = await fetch(`${GITHUB_API}/user`, {
      headers: authHeaders(token),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      login: data.login,
      name: data.name ?? data.login,
      avatarUrl: data.avatar_url,
      publicRepos: data.public_repos,
      followers: data.followers,
    };
  } catch {
    return null;
  }
}

export async function fetchContributions(
  username: string,
  token?: string
): Promise<ContributionStreak> {
  try {
    if (!token) {
      return await fetchContributionsFromRest(username);
    }
    return await fetchContributionsFromGQL(username, token);
  } catch {
    return { currentStreak: 0, longestStreak: 0, totalContributions: 0, recentDays: [] };
  }
}

async function fetchContributionsFromRest(username: string): Promise<ContributionStreak> {
  const res = await fetch(
    `${GITHUB_API}/users/${encodeURIComponent(username)}/events?per_page=100`,
    { headers: authHeaders() }
  );
  if (!res.ok) {
    return { currentStreak: 0, longestStreak: 0, totalContributions: 0, recentDays: [] };
  }

  const events = await res.json();
  const dayMap = new Map<string, number>();

  for (const event of events) {
    if (event.type === "PushEvent") {
      const date = event.created_at.split("T")[0];
      dayMap.set(date, (dayMap.get(date) ?? 0) + event.payload.size);
    }
  }

  return buildStreak(dayMap);
}

async function fetchContributionsFromGQL(
  username: string,
  token: string
): Promise<ContributionStreak> {
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const from = yearAgo.toISOString().split("T")[0];

  const query = `
    query($login: String!, $from: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch(GITHUB_GQL, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login: username, from } }),
  });

  if (!res.ok) {
    return { currentStreak: 0, longestStreak: 0, totalContributions: 0, recentDays: [] };
  }

  const data = await res.json();
  const calendar = data.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) {
    return { currentStreak: 0, longestStreak: 0, totalContributions: 0, recentDays: [] };
  }

  const dayMap = new Map<string, number>();
  const allDays: ContributionDay[] = [];

  for (const week of calendar.weeks) {
    for (const day of week.contributionDays) {
      dayMap.set(day.date, day.contributionCount);
      allDays.push({ date: day.date, count: day.contributionCount });
    }
  }

  allDays.sort((a, b) => b.date.localeCompare(a.date));

  return {
    ...buildStreak(dayMap),
    totalContributions: calendar.totalContributions,
    recentDays: allDays.slice(0, 14),
  };
}

function buildStreak(dayMap: Map<string, number>): ContributionStreak {
  const sorted = [...dayMap.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[0].localeCompare(a[0]));

  if (sorted.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalContributions: 0, recentDays: [] };
  }

  let currentStreak = 0;
  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  while (dayMap.get(checkDate.toISOString().split("T")[0])) {
    currentStreak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let longestStreak = 0;
  let streak = 0;
  let prevDate = "";

  for (const [date] of sorted) {
    if (prevDate) {
      const prev = new Date(prevDate);
      const curr = new Date(date);
      const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
      } else {
        streak = 1;
      }
    } else {
      streak = 1;
    }
    longestStreak = Math.max(longestStreak, streak);
    prevDate = date;
  }

  const totalContributions = [...dayMap.values()].reduce((a, b) => a + b, 0);

  const recentDays: ContributionDay[] = [];
  const d = new Date();
  for (let i = 0; i < 14; i++) {
    const key = d.toISOString().split("T")[0];
    recentDays.push({ date: key, count: dayMap.get(key) ?? 0 });
    d.setDate(d.getDate() - 1);
  }

  return { currentStreak, longestStreak, totalContributions, recentDays };
}

export async function fetchRecentActivity(
  username: string,
  token?: string
): Promise<GitHubActivity[]> {
  try {
    const res = await fetch(
      `${GITHUB_API}/users/${encodeURIComponent(username)}/events?per_page=30`,
      { headers: authHeaders(token) }
    );
    if (!res.ok) return [];

    const events = await res.json();
    const activities: GitHubActivity[] = [];

    for (const event of events) {
      if (event.type === "PushEvent") {
        for (const commit of event.payload.commits ?? []) {
          activities.push({
            type: "commit",
            title: commit.message.split("\n")[0],
            repo: event.repo.name,
            date: event.created_at,
            url: commit.url,
          });
        }
      } else if (event.type === "PullRequestEvent") {
        activities.push({
          type: "pr",
          title: event.payload.pull_request.title,
          repo: event.repo.name,
          date: event.created_at,
          url: event.payload.pull_request.html_url,
        });
      } else if (event.type === "IssuesEvent") {
        activities.push({
          type: "issue",
          title: event.payload.issue.title,
          repo: event.repo.name,
          date: event.created_at,
          url: event.payload.issue.html_url,
        });
      }
    }

    return activities.slice(0, 20);
  } catch {
    return [];
  }
}

export async function syncGitHub(
  username: string,
  token?: string
): Promise<GitHubData> {
  const [profile, streak, recentActivity] = await Promise.all([
    fetchProfile(token),
    fetchContributions(username, token),
    fetchRecentActivity(username, token),
  ]);

  return {
    profile,
    streak,
    recentActivity,
    syncedAt: new Date().toISOString(),
  };
}
