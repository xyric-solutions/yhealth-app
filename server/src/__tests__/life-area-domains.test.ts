import { describe, it, expect } from '@jest/globals';
import { LIFE_AREA_DOMAINS, getDomainByType, listDomainTypes } from '../config/life-area-domains.js';

describe('life-area-domains registry', () => {
  it('includes career, relationships, creativity, spirituality, finance, fitness, learning, custom', () => {
    const types = listDomainTypes();
    for (const t of ['career', 'relationships', 'creativity', 'spirituality', 'finance', 'fitness', 'learning', 'custom']) {
      expect(types).toContain(t);
    }
  });

  it('marks only career as flagship', () => {
    const flagships = LIFE_AREA_DOMAINS.filter((d) => d.isFlagship);
    expect(flagships.map((d) => d.type)).toEqual(['career']);
  });

  it('getDomainByType returns null for unknown type', () => {
    expect(getDomainByType('nonexistent' as never)).toBeNull();
  });

  it('every domain has at least one examplePhrase for intent routing', () => {
    for (const d of LIFE_AREA_DOMAINS) {
      expect(d.examplePhrases.length).toBeGreaterThan(0);
    }
  });
});
