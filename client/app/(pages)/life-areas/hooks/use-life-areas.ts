'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { LifeArea, LifeAreaDomain, LifeAreaLink } from '../types';

export function useLifeAreas() {
  const [areas, setAreas] = useState<LifeArea[]>([]);
  const [domains, setDomains] = useState<LifeAreaDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [areasRes, domainsRes] = await Promise.all([
        api.get<{ areas: LifeArea[] }>('/life-areas'),
        api.get<{ domains: LifeAreaDomain[] }>('/life-areas/domains'),
      ]);
      setAreas(areasRes.data?.areas ?? []);
      setDomains(domainsRes.data?.domains ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load life areas');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const create = useCallback(async (input: {
    slug: string; display_name: string; domain_type: string;
    icon?: string; color?: string;
  }) => {
    const res = await api.post<{ area: LifeArea }>('/life-areas', input);
    if (!res.data?.area) throw new Error('Failed to create area');
    const created = res.data.area;
    setAreas((prev) => [created, ...prev]);
    return created;
  }, []);

  const update = useCallback(async (id: string, patch: Partial<LifeArea>) => {
    const res = await api.patch<{ area: LifeArea }>(`/life-areas/${id}`, patch);
    if (!res.data?.area) throw new Error('Failed to update area');
    const updated = res.data.area;
    setAreas((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, []);

  const archive = useCallback(async (id: string) => {
    await api.delete(`/life-areas/${id}`);
    setAreas((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const getDetail = useCallback(async (id: string) => {
    const res = await api.get<{ area: LifeArea; links: LifeAreaLink[] }>(`/life-areas/${id}`);
    if (!res.data) throw new Error('Failed to load area detail');
    return res.data;
  }, []);

  return { areas, domains, isLoading, error, refresh, create, update, archive, getDetail };
}
