// Single source of truth for the lead pipeline. The admin no longer juggles
// quote_requests.status AND quotes.status independently: a lead's phase is
// derived from whatever has actually happened (offer drafted, sent, accepted,
// project created…). One funnel, automatically updated.

export type Phase = "nieuw" | "gesprek" | "offerte" | "akkoord" | "project" | "verloren";

export const PHASE_ORDER: Phase[] = ["nieuw", "gesprek", "offerte", "akkoord", "project", "verloren"];

export const PHASE_LABEL: Record<Phase, string> = {
  nieuw: "Nieuw",
  gesprek: "In gesprek",
  offerte: "Offerte open",
  akkoord: "Akkoord",
  project: "Project",
  verloren: "Verloren",
};

export const PHASE_BADGE: Record<Phase, { bg: string; fg: string }> = {
  nieuw: { bg: "var(--brass)", fg: "var(--cream)" },
  gesprek: { bg: "var(--gold)", fg: "var(--charcoal)" },
  offerte: { bg: "var(--cream-deep)", fg: "var(--charcoal)" },
  akkoord: { bg: "var(--charcoal)", fg: "var(--gold)" },
  project: { bg: "#1e4a2a", fg: "var(--cream)" },
  verloren: { bg: "var(--cream-deep)", fg: "var(--oxide)" },
};

export type RequestStatus = "new" | "contacted" | "quoted" | "won" | "lost";
export type QuoteStatus = "concept" | "verstuurd" | "akkoord" | "afgewezen";

export type PhaseInputs = {
  requestStatus?: RequestStatus | null;
  quotes?: Array<{ status: QuoteStatus }>;
  hasProject?: boolean;
};

/**
 * Derive the pipeline phase from the underlying records.
 *
 * Priority (most-progressed wins):
 * 1. Project exists  → project
 * 2. Any quote 'akkoord' OR request.status='won' → akkoord
 * 3. Request.status='lost' OR (quotes exist and all are 'afgewezen') → verloren
 * 4. Any quote 'concept' or 'verstuurd' → offerte
 * 5. Request.status='contacted' → gesprek
 * 6. Default → nieuw
 */
export function derivePhase({ requestStatus, quotes = [], hasProject = false }: PhaseInputs): Phase {
  if (hasProject) return "project";
  if (requestStatus === "won") return "akkoord";
  if (quotes.some((q) => q.status === "akkoord")) return "akkoord";
  if (requestStatus === "lost") return "verloren";
  if (quotes.length > 0 && quotes.every((q) => q.status === "afgewezen")) return "verloren";
  if (quotes.some((q) => q.status === "concept" || q.status === "verstuurd")) return "offerte";
  if (requestStatus === "contacted" || requestStatus === "quoted") return "gesprek";
  return "nieuw";
}