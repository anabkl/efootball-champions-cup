import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const auth=readFileSync("supabase/migrations/202611180002_secure_username_auth.sql","utf8");
const workflow=readFileSync("supabase/migrations/202611180003_tournament_workflows.sql","utf8");
const competition=readFileSync("supabase/migrations/202611180005_standings_knockout_podium.sql","utf8");
describe("database authorization contracts",()=>{
  it("never lets signup metadata grant admin",()=>expect(auth).toContain("'PLAYER'"));
  it("checks admin privileges for lifecycle mutations",()=>{expect(workflow.match(/is_tournament_admin\(tid\)/g)?.length).toBeGreaterThanOrEqual(3)});
  it("hides draw data before tournament start",()=>{expect(competition).toContain("groups visible after start");expect(competition).toContain("matches visible after start")});
  it("keeps eliminated memberships instead of deleting profiles",()=>{expect(competition).toContain("competition_status='ELIMINATED'");expect(competition).not.toMatch(/delete from profiles/i)});
});
