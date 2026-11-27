import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getSelectedPartnerId, setSelectedPartnerId } from './api.js';
import { useAuth } from './auth.jsx';

const PartnerContext = createContext(null);

export function PartnerProvider({ children }) {
  const { user } = useAuth();
  const [partners, setPartners] = useState([]);
  const [selectedId, setSelectedId] = useState(() => getSelectedPartnerId());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return [];
    setLoading(true);
    try {
      const { data } = await api('/partners');
      setPartners(data);
      return data;
    } catch {
      setPartners([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!partners.length) return;
    const saved = getSelectedPartnerId();
    const valid = partners.find((p) => p.id === saved);
    const chosen = valid || partners[0];
    if (chosen && chosen.id !== selectedId) setSelectedId(chosen.id);
    if (chosen) setSelectedPartnerId(chosen.id);
  }, [partners, selectedId]);

  const selectPartner = useCallback((id) => {
    setSelectedId(id);
    setSelectedPartnerId(id);
  }, []);

  const createPartner = useCallback(async (body) => {
    const { data } = await api('/partners', { method: 'POST', body });
    setPartners((prev) => [...prev, data]);
    selectPartner(data.id); // header + dashboard switch immediately
    refresh().catch(() => {}); // reconcile balances in the background
    return data;
  }, [refresh, selectPartner]);

  const updatePartner = useCallback(async (id, body) => {
    const { data } = await api(`/partners/${id}`, { method: 'PATCH', body });
    setPartners((prev) => prev.map((item) => (item.id === id ? data : item)));
    refresh().catch(() => {});
    return data;
  }, [refresh]);

  const partner = partners.find((p) => p.id === selectedId) || null;
  const value = useMemo(() => ({
    partners, partner, selectedId, loading,
    selectPartner, createPartner, updatePartner, refresh,
  }), [partners, partner, selectedId, loading, selectPartner, createPartner, updatePartner, refresh]);

  return <PartnerContext.Provider value={value}>{children}</PartnerContext.Provider>;
}

export function usePartner() {
  const context = useContext(PartnerContext);
  if (!context) throw new Error('usePartner must be used inside PartnerProvider');
  return context;
}
