/* Visitor statistics with Google Analytics 4, only after the visitor agrees.
   Nothing from Google is loaded before "Приемам" (Consent Mode "basic"): no script,
   no cookie, no request. The choice is kept for 6 months, then asked again.
   Set GA_ID to the Measurement ID (G-XXXXXXXXXX) to switch it on; empty = no banner, no statistics. */

const GA_ID = '';
const CONSENT_KEY = 'statistika-v1';
const CONSENT_MAX_AGE = 182 * 24 * 3600 * 1000;          // about 6 months
const GA_COOKIE_SECONDS = 395 * 24 * 3600;               // 13 months, as regulators recommend

function consentChoice() {
  try {
    const c = JSON.parse(localStorage.getItem(CONSENT_KEY));
    if (c && typeof c.a === 'boolean' && Date.now() - c.t < CONSENT_MAX_AGE) return c.a;
  } catch (e) {}
  return null;
}
function saveConsent(a) {
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ a, t: Date.now() })); } catch (e) {}
}

window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
let gaLoaded = false;

function gaEnable() {
  if (!GA_ID) return;
  window['ga-disable-' + GA_ID] = false;
  if (gaLoaded) { gtag('consent', 'update', { analytics_storage: 'granted' }); return; }
  gaLoaded = true;
  // statistics only: everything for ads stays off
  gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
  gtag('consent', 'update', { analytics_storage: 'granted' });
  gtag('set', { allow_google_signals: false, allow_ad_personalization_signals: false });
  gtag('js', new Date());
  gtag('config', GA_ID, {
    send_page_view: false,                // the tabs are sent as page views by gaView()
    cookie_expires: GA_COOKIE_SECONDS,
    cookie_update: false,                 // the 13 months count from the first visit
    cookie_flags: 'SameSite=Lax;Secure'
  });
  const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  gtag('set', 'user_properties', { app_mode: standalone ? 'installed' : 'browser' });
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
  document.head.appendChild(s);
}
function gaDisable() {
  if (!GA_ID) return;
  window['ga-disable-' + GA_ID] = true;
  if (gaLoaded) gtag('consent', 'update', { analytics_storage: 'denied' });
  // remove the cookies Google Analytics may have set
  const paths = ['/', location.pathname.replace(/[^/]*$/, '')];
  const domains = ['', location.hostname, '.' + location.hostname];
  document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => /^_ga/.test(n)).forEach(n => {
    paths.forEach(p => domains.forEach(d => {
      document.cookie = n + '=; Max-Age=0; path=' + p + (d ? '; domain=' + d : '');
    }));
  });
}
const gaOn = () => !!GA_ID && consentChoice() === true;

/* a tab shown = a page view; finished exercises = events */
function gaView(name, title) {
  if (!gaOn()) return;
  const base = location.origin + location.pathname;
  gtag('event', 'page_view', { page_title: title || name, page_location: base + '#' + name, page_path: location.pathname + '#' + name });
}
function track(event, params) {
  if (!gaOn()) return;
  gtag('event', event, params || {});
}

/* ---------- banner ---------- */
function consentBanner(show) {
  const box = document.getElementById('consent');
  if (!box) return;
  box.hidden = !show;
  if (!show) return;
  const now = consentChoice();
  document.getElementById('consent-state').textContent = now === true ? 'Сега: позволено.' : now === false ? 'Сега: отказано.' : '';
}
function consentAnswer(yes) {
  saveConsent(yes);
  consentBanner(false);
  if (yes) {
    gaEnable();
    if (typeof currentView !== 'undefined') gaView(currentView, document.getElementById('tab-' + currentView)?.textContent);
  } else {
    gaDisable();
  }
  const settings = document.getElementById('consent-open');
  if (settings) settings.focus({ preventScroll: true });
}

(function initConsent() {
  const open = document.getElementById('consent-open');
  if (!GA_ID) {
    // statistics are off: no banner and no settings button (the privacy link stays)
    if (open) open.hidden = true;
    return;
  }
  if (open) open.hidden = false;
  document.getElementById('consent-yes').addEventListener('click', () => consentAnswer(true));
  document.getElementById('consent-no').addEventListener('click', () => consentAnswer(false));
  document.getElementById('consent-open').addEventListener('click', () => {
    consentBanner(true);
    document.getElementById('consent-no').focus({ preventScroll: true });
  });
  const c = consentChoice();
  if (c === true) gaEnable();
  else if (c === false) gaDisable();
  else consentBanner(true);
})();
