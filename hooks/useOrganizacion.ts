'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  type Organizacion,
  type UsuarioOrganizacion,
  listarMisOrganizaciones,
  getOrganizacionActiva,
  setOrganizacionActiva,
  inicializarOrganizacion,
} from '@/lib/security/org-context';
import { useAuth } from '@/hooks/useAuth';

interface UseOrganizacionState {
  orgs: UsuarioOrganizacion[];
  orgActiva: Organizacion | null;
  orgActivaId: string | null;
  loading: boolean;
  cambiarOrg: (orgId: string) => void;
  recargar: () => Promise<void>;
}

export function useOrganizacion(): UseOrganizacionState {
  const { user } = useAuth(false);
  const [orgs, setOrgs] = useState<UsuarioOrganizacion[]>([]);
  const [orgActivaId, setOrgActivaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!user?.email) {
      setOrgs([]);
      setOrgActivaId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const lista = await listarMisOrganizaciones(user.email);
    setOrgs(lista);
    if (lista.length > 0) {
      await inicializarOrganizacion(user.email);
    }
    setOrgActivaId(getOrganizacionActiva());
    setLoading(false);
  }, [user?.email]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setOrgActivaId(detail?.orgId ?? null);
    };
    window.addEventListener('vg:org-changed', onChange);
    return () => window.removeEventListener('vg:org-changed', onChange);
  }, []);

  const cambiarOrg = useCallback((orgId: string) => {
    setOrganizacionActiva(orgId);
  }, []);

  const orgActiva = orgs.find(o => o.organizacion_id === orgActivaId)?.organizacion ?? null;

  return {
    orgs,
    orgActiva,
    orgActivaId,
    loading,
    cambiarOrg,
    recargar: cargar,
  };
}
