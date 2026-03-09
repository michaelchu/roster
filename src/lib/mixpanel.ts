import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

export function initMixpanel() {
  if (!MIXPANEL_TOKEN || !import.meta.env.PROD) return;

  mixpanel.init(MIXPANEL_TOKEN, {
    autocapture: true,
    record_sessions_percent: 100,
    ignore_dnt: true,
  });
}

export { mixpanel };
