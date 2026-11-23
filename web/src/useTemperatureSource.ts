import { useEffect, useState } from 'react';
import { sessionFetch } from './Access';

export function indoorTemperatureKey(enabled: boolean, key: string): string {
  return enabled && key === 'indoorTemperature' ? 'mqttHouseTemperature' : key;
}

export function useTemperatureSource(active = true) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let request = 0;
    const load = async () => {
      const current = ++request;
      try {
        const response = await sessionFetch('/api/v1/settings/plant-model', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && current === request) setEnabled(data.configuration?.houseTemperature?.enabled === true);
      } catch { /* Keep the last confirmed source during a connection failure. */ }
    };
    void load();
    const timer = setInterval(() => void load(), 30000);
    window.addEventListener('cockpit-temperature-changed', load);
    window.addEventListener('cockpit-session-changed', load);
    return () => {
      controller.abort(); clearInterval(timer);
      window.removeEventListener('cockpit-temperature-changed', load);
      window.removeEventListener('cockpit-session-changed', load);
    };
  }, [active]);
  return enabled;
}
