import { LIFE_AREA_DOMAINS, type LifeAreaDomainType, listDomainTypes } from '../config/life-area-domains.js';
import { lifeAreasService, type LifeArea } from './life-areas.service.js';
import { logger } from './logger.service.js';

export interface RouterResult {
  domainType: LifeAreaDomainType;
  existingLifeAreaId?: string;
  confidence: number;
}

export interface RouterContext {
  userMessage: string;
  existingAreas: Pick<LifeArea, 'id' | 'display_name' | 'domain_type'>[];
}

const CONFIDENCE_THRESHOLD = 0.5;
const SELF_IMPROVEMENT_HINTS = [
  /\bwant to\b/i,
  /\bshould\b/i,
  /\bi('ve|\s+have)\s+been\s+(lazy|bad|slacking|struggling)/i,
  /\bneed to\b/i,
  /\bhelp me\b/i,
  /\b(start|stop)\s+/i,
];

export function hasSelfImprovementIntent(message: string): boolean {
  return SELF_IMPROVEMENT_HINTS.some((re) => re.test(message));
}

export function buildRouterPrompt(ctx: RouterContext): string {
  const domainsBlock = LIFE_AREA_DOMAINS.map(
    (d) =>
      `- ${d.type}: ${d.description} Examples: ${d.examplePhrases.map((p) => `"${p}"`).join(', ')}`,
  ).join('\n');

  const existingBlock = ctx.existingAreas.length
    ? ctx.existingAreas.map((a) => `- ${a.id}: "${a.display_name}" (domain: ${a.domain_type})`).join('\n')
    : '(none yet)';

  return `You are an intent router for a self-improvement coaching app. Route the user's message into a life-area domain.

Registered domains:
${domainsBlock}

User's existing life areas:
${existingBlock}

User message:
"""${ctx.userMessage}"""

Respond with STRICT JSON only, no prose. Schema:
{"domainType":"<one of: ${listDomainTypes().join('|')}>","existingLifeAreaId":"<uuid or omit>","confidence":<0..1>}

If the message is NOT about self-improvement, respond with {"domainType":"custom","confidence":0}.
If it clearly matches an existing life area, include its id.`;
}

export function parseRouterResponse(raw: string): RouterResult | null {
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const domainType = o.domainType;
  const confidence = typeof o.confidence === 'number' ? o.confidence : 0;
  if (typeof domainType !== 'string') return null;
  if (!listDomainTypes().includes(domainType as LifeAreaDomainType)) return null;
  if (confidence < CONFIDENCE_THRESHOLD) return null;
  const existingLifeAreaId = typeof o.existingLifeAreaId === 'string' ? o.existingLifeAreaId : undefined;
  return { domainType: domainType as LifeAreaDomainType, existingLifeAreaId, confidence };
}

export interface RoutingChip {
  lifeAreaId: string;
  lifeAreaName: string;
  domainType: LifeAreaDomainType;
  wasAutoCreated: boolean;
  alternatives: { type: LifeAreaDomainType; displayName: string }[];
}

/**
 * Safe to fail — any error returns null and coach reply proceeds normally.
 */
export async function routeCoachIntent(params: {
  userId: string;
  userMessage: string;
  llm: (prompt: string) => Promise<string>;
}): Promise<RoutingChip | null> {
  try {
    if (!hasSelfImprovementIntent(params.userMessage)) return null;

    const existingAreas = (await lifeAreasService.list(params.userId)).map((a) => ({
      id: a.id, display_name: a.display_name, domain_type: a.domain_type,
    }));

    const prompt = buildRouterPrompt({ userMessage: params.userMessage, existingAreas });
    const raw = await params.llm(prompt);
    const parsed = parseRouterResponse(raw);
    if (!parsed) return null;

    let lifeAreaId: string;
    let lifeAreaName: string;
    let wasAutoCreated = false;

    if (parsed.existingLifeAreaId && existingAreas.some((a) => a.id === parsed.existingLifeAreaId)) {
      const hit = existingAreas.find((a) => a.id === parsed.existingLifeAreaId)!;
      lifeAreaId = hit.id;
      lifeAreaName = hit.display_name;
    } else {
      const domain = LIFE_AREA_DOMAINS.find((d) => d.type === parsed.domainType)!;
      const slug = `${domain.type}-${Date.now().toString(36)}`;
      const created = await lifeAreasService.create(params.userId, {
        slug,
        display_name: domain.displayName,
        domain_type: domain.type,
      });
      lifeAreaId = created.id;
      lifeAreaName = created.display_name;
      wasAutoCreated = true;
    }

    const alternatives = LIFE_AREA_DOMAINS
      .filter((d) => d.type !== parsed.domainType)
      .map((d) => ({ type: d.type, displayName: d.displayName }));

    return { lifeAreaId, lifeAreaName, domainType: parsed.domainType, wasAutoCreated, alternatives };
  } catch (err) {
    logger.warn('[life-area-intent-router] routing failed (non-fatal):', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
