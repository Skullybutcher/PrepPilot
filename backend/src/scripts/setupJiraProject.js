// Phase 0: Run once to create the quarter epics in Jira from roadmap.config.json.
// Usage: npm run setup:jira
//
// NOTE: This assumes the Jira project itself (with key JIRA_PROJECT_KEY) already
// exists — Jira Cloud project creation via API needs admin scopes that vary by
// site, so it's simpler to create the project once by hand in the Jira UI first
// (Projects > Create Project > Kanban/Scrum, set the key to match .env), then run
// this script to populate it.

import { createIssue } from '../jira/client.js';
import roadmap from '../config/roadmap.config.json' with { type: 'json' };

async function main() {
  console.log(`Creating ${roadmap.quarters.length} quarter epics...`);

  for (const quarter of roadmap.quarters) {
    const trackList = Object.keys(quarter.tracks).join(', ');
    const epic = await createIssue({
      summary: `${quarter.id}: ${quarter.name}`,
      issueType: "10005", // Epic
      labels: ['preppilot'],
      description: `Weeks ${quarter.startWeek}-${quarter.endWeek}. Tracks: ${trackList}`,
    });
    console.log(`  Created ${epic.key} — ${quarter.id}: ${quarter.name}`);

    console.log(`  Creating stories for tracks: ${trackList}...`);

    // Create one Story per track within this quarter, for weekly-goal tracking.
    for (const [trackName, trackConfig] of Object.entries(quarter.tracks)) {
      const story = await createIssue({
        summary: `${trackName} — ${quarter.id}`,
        issueType: "10040", // Story
        parentKey: epic.key,
        labels: [trackName, 'preppilot'],
        description: `${trackConfig.focus} (~${trackConfig.weeklyHours} hrs/week)`,
      });
      console.log(`    Created ${story.key} — ${trackName} story`);
    }
  }

  console.log('\nDone. Daily subtasks will be created under these stories by generateDailyTodos.js.');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
