import assert from 'node:assert/strict';
import test from 'node:test';
import { ACHIEVEMENTS, TIER_XP, achievementCatalog, levelFromXp, longestProtectedStreak, validTimeZone } from '../lib/achievements.mjs';

test('the primary collection contains exactly 40 unique achievements', () => {
  assert.equal(ACHIEVEMENTS.length, 40);
  assert.equal(new Set(ACHIEVEMENTS.map(item => item.id)).size, 40);
  assert.deepEqual(
    Object.fromEntries(Object.entries(Object.groupBy(ACHIEVEMENTS, item => item.category)).map(([key, items]) => [key, items.length])),
    { PROFILE: 2, LIBRARY: 5, COMPLETED: 5, EPISODES: 5, RATINGS: 5, COMMUNITY: 5, GENRES: 5, STREAK: 5, ORGANIZATION: 3 },
  );
});

test('every tier awards the fixed Nexus XP amount', () => {
  assert.deepEqual(TIER_XP, { BRONZE: 20, SILVER: 50, GOLD: 100, PLATINUM: 200, DIAMOND: 400 });
  for (const item of ACHIEVEMENTS) assert.equal(item.xp, TIER_XP[item.tier]);
});

test('locked and unlocked cards use instruction and accomplishment copy', () => {
  const items = achievementCatalog();
  assert.equal(items.find(item => item.id === 'completed-anime-legend').description, 'Conclua 50 animes.');
  assert.equal(items.find(item => item.id === 'completed-anime-legend').unlockedDescription, 'Concluiu 50 animes.');
  assert.ok(items.every(item => item.unlockedDescription && item.unlockedDescription !== item.description));
});

test('only the three long-term milestones unlock profile titles', () => {
  assert.deepEqual(
    achievementCatalog().filter(item => item.rewardTitle).map(item => [item.title, item.rewardTitle]),
    [['Enciclopédia Viva', 'Enciclopédia Viva'], ['Banca Examinadora', 'Crítico do Nexus'], ['Lenda da Comunidade', 'Voz do Nexus']],
  );
});

test('monthly streak protection bridges one missed day in each month', () => {
  assert.equal(longestProtectedStreak(['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-05']), 5);
  assert.equal(longestProtectedStreak(['2026-09-01', '2026-09-03', '2026-09-05']), 3);
  assert.equal(longestProtectedStreak(['2026-08-30', '2026-09-01', '2026-09-02', '2026-09-04']), 6);
  assert.equal(longestProtectedStreak(['2026-09-01', '2026-09-05']), 1);
});

test('Nexus level progression exposes a stable next threshold', () => {
  assert.deepEqual(levelFromXp(0), { level: 1, name: 'Nível Nexus 1', xp: 0, levelFloor: 0, nextXp: 30 });
  assert.deepEqual(levelFromXp(1200), { level: 7, name: 'Nível Nexus 7', xp: 1200, levelFloor: 1080, nextXp: 1470 });
});

test('activity timezones must be valid IANA names', () => {
  assert.equal(validTimeZone('America/Cuiaba'), 'America/Cuiaba');
  assert.equal(validTimeZone('not-a-zone'), null);
});
