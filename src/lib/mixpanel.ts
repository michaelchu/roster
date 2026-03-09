import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

export function initMixpanel() {
  if (!MIXPANEL_TOKEN) return;

  mixpanel.init(MIXPANEL_TOKEN, {
    autocapture: true,
    record_sessions_percent: 100,
  });
}

export { mixpanel };
