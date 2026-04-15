import { describe, it, expect } from '@jest/globals';
import { buildRouterPrompt, parseRouterResponse } from '../services/life-area-intent-router.service.js';

describe('life-area intent router', () => {
  it('builds a prompt containing all active domain examplePhrases and existing areas', () => {
    const p = buildRouterPrompt({
      userMessage: 'I want a better job',
      existingAreas: [{ id: 'a1', display_name: 'My Career', domain_type: 'career' }],
    });
    expect(p).toContain('I want a better job');
    expect(p).toContain('My Career');
    expect(p).toContain('career');
    expect(p).toContain("I've been lazy about applying");
  });

  it('parses a well-formed JSON response', () => {
    const r = parseRouterResponse(
      JSON.stringify({ domainType: 'career', existingLifeAreaId: 'a1', confidence: 0.92 }),
    );
    expect(r).toEqual({ domainType: 'career', existingLifeAreaId: 'a1', confidence: 0.92 });
  });

  it('returns null for garbage JSON', () => {
    expect(parseRouterResponse('not json')).toBeNull();
    expect(parseRouterResponse('{"domainType":"not-a-domain"}')).toBeNull();
  });

  it('returns null when confidence below threshold (0.5)', () => {
    const r = parseRouterResponse(JSON.stringify({ domainType: 'career', confidence: 0.3 }));
    expect(r).toBeNull();
  });
});
