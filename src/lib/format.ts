import type { Fixture, Group, Participant, Standing } from "@/types/tournament";

export function recommendFormats(count: number) {
  if (count < 6) return [];
  const candidates = [2, 3, 4, 5, 6, 8].filter((groups) => groups <= count / 3 && count % groups !== 1);
  return candidates.map((groups) => ({ groups, sizes: balancedSizes(count, groups), advancing: Math.min(groups * 2, nearestBracket(groups * 2)) }));
}
export function balancedSizes(total: number, groups: number) {
  const base = Math.floor(total / groups), extra = total % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < extra ? 1 : 0));
}
export function nearestBracket(n: number) { return 2 ** Math.floor(Math.log2(n)); }
export function createGroups(players: Participant[], groupCount: number, random = Math.random): Group[] {
  if (players.length < groupCount * 3) throw new Error("Each group requires at least three players.");
  const shuffled = [...players].sort(() => random() - 0.5);
  return balancedSizes(players.length, groupCount).map((size, index) => ({ id: `group-${index + 1}`, name: `Group ${String.fromCharCode(65 + index)}`, members: shuffled.splice(0, size) }));
}
export function createRoundRobinFixtures(groups: Group[]): Fixture[] {
  return groups.flatMap((group) => group.members.flatMap((home, i) => group.members.slice(i + 1).map((away) => ({ homeId: home.id, awayId: away.id, groupId: group.id, round: group.name }))));
}
export function calculateStandings(players: Participant[], results: { homeId: string; awayId: string; homeScore: number; awayScore: number }[]): Standing[] {
  const rows = new Map(players.map((p) => [p.id, { ...p, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }]));
  for (const result of results) { const h = rows.get(result.homeId), a = rows.get(result.awayId); if (!h || !a) continue; h.played++; a.played++; h.goalsFor += result.homeScore; h.goalsAgainst += result.awayScore; a.goalsFor += result.awayScore; a.goalsAgainst += result.homeScore; if (result.homeScore > result.awayScore) { h.wins++; h.points += 3; a.losses++; } else if (result.homeScore < result.awayScore) { a.wins++; a.points += 3; h.losses++; } else { h.draws++; a.draws++; h.points++; a.points++; } }
  return [...rows.values()].sort((a,b) => b.points-a.points || (b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst) || b.goalsFor-a.goalsFor || a.displayName.localeCompare(b.displayName));
}
