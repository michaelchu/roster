import mixpanelBrowser from 'mixpanel-browser';

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

let initialized = false;

export function initMixpanel() {
  if (!MIXPANEL_TOKEN || !import.meta.env.PROD) return;

  mixpanelBrowser.init(MIXPANEL_TOKEN, {
    autocapture: true,
    record_sessions_percent: 100,
    ignore_dnt: true,
  });
  initialized = true;
}

/** Safe Mixpanel wrapper that no-ops when the SDK is not initialized */
export const mixpanel = {
  identify: (id: string) => initialized && mixpanelBrowser.identify(id),
  reset: () => initialized && mixpanelBrowser.reset(),
  track: (event: string, properties?: Record<string, unknown>) =>
    initialized && mixpanelBrowser.track(event, properties),
  people: {
    set: (properties: Record<string, unknown>) =>
      initialized && mixpanelBrowser.people.set(properties),
  },
};
