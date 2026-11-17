export type TournamentStatus = "DRAFT" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "DRAW_READY" | "DRAW_COMPLETED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type MemberStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "WITHDRAWN";
export type Participant = { id: string; displayName: string; efootballUsername: string; country?: string | null; team?: string | null };
export type Group = { id: string; name: string; members: Participant[] };
export type Fixture = { homeId: string; awayId: string; groupId?: string; round: string };
export type Standing = Participant & { played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; points: number };
