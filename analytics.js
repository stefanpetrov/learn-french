/* Visitor statistics with Google Analytics 4, only after the visitor agrees.
   Nothing from Google is loaded before "Приемам" (Consent Mode "basic"): no script,
   no cookie, no request. The choice is kept for 6 months, then asked again.

   Set GA_ID to the Measurement ID (G-XXXXXXXXXX) to switch it on; empty = no banner, no statistics.
   Before setting it, in Google Analytics (privacy.html relies on these settings):
   - Admin → Account settings → Account details → Data sharing settings: untick everything
     (Google is then only a processor, as privacy.html says);
   - Admin → Data streams → (web stream) → Enhanced measurement: OFF (gaView() sends the page views);
   - Admin → Data collection: Google signals OFF;
   - Admin → Data retention: event and user data 2 months, "Reset user data on new activity" OFF.
   If the banner text, the purposes or these settings change in substance, rename CONSENT_KEY
   (statistika-v2 …) so that everybody is asked again. */

const GA_ID = 'G-1LZNKXXKV6';
const CONSENT_KEY = 'statistika-v1';
const CONSENT_VERSION = '2026-10-25';
const CONSENT_MAX_AGE = 182 * 24 * 3600 * 1000;          // about 6 months
const GA_COOKIE_SECONDS = 395 * 24 * 3600;               // 13 months, as regulators recommend
const APP_PATH = location.pathname.replace(/[^/]*$/, ''); // /learn-french/

function consentChoice() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw === null) return null;
    const c = JSON.parse(raw);
    const age = c && typeof c.t === 'number' ? Date.now() - c.t : -1;
    if (c && typeof c.a === 'boolean' && age >= 0 && age < CONSENT_MAX_AGE) return c.a;
  } catch (e) {}
  // expired or broken: forget it (other tabs get a storage event and ask again too)
  try { localStorage.removeItem(CONSENT_KEY); } catch (e) {}
  return null;
}
function saveConsent(a) {
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ a, t: Date.now(), v: CONSENT_VERSION })); } catch (e) {}
}
// the answer in this page, also when the browser does not let us store it
let consentNow = consentChoice();

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
    cookie_domain: location.hostname,     // so gaDisable() can always delete them
    cookie_path: APP_PATH,                // this app only
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
  const paths = ['/', APP_PATH];
  const domains = ['', location.hostname, '.' + location.hostname];
  document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => /^_ga/.test(n)).forEach(n => {
    paths.forEach(p => domains.forEach(d => {
      document.cookie = n + '=; Max-Age=0; path=' + p + (d ? '; domain=' + d : '');
    }));
  });
}
// only while gtag.js runs in this page, so nothing is queued ahead of the consent and config commands
const gaOn = () => gaLoaded && consentNow === true;

/* a tab shown = a page view; finished exercises = events */
function gaView(name, title) {
  if (!gaOn()) return;
  gtag('event', 'page_view', { page_title: title || name, page_location: location.origin + APP_PATH + '#' + name });
}
function track(event, params) {
  if (!gaOn()) return;
  gtag('event', event, params || {});
}
// the tab on screen right now (app.js defines currentView)
function gaViewCurrent() {
  if (typeof currentView !== 'undefined') gaView(currentView, document.getElementById('tab-' + currentView)?.textContent);
}
// the random number in the _ga cookie, so a visitor can quote it to ask for their data
function gaClientId() {
  const m = document.cookie.match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)/);
  return m ? m[1] : '';
}

/* ---------- banner ---------- */
let consentReturn = null;   // the control that opened the banner; null when it was shown on load

/* keep room under the open banner, so content and focused controls never hide behind it */
function consentSpace() {
  const box = document.getElementById('consent');
  const open = !!box && !box.hidden;
  const h = open ? Math.ceil(box.getBoundingClientRect().height) + 24 : 0;
  document.documentElement.style.setProperty('--consent-h', h + 'px');
  document.documentElement.classList.toggle('consent-open', open);
}
function consentBanner(show) {
  const box = document.getElementById('consent');
  if (!box) return;
  box.hidden = !show;
  if (show) {
    const id = consentNow === true ? gaClientId() : '';
    document.getElementById('consent-state').textContent = consentNow === true
      ? 'Сега статистиката е включена.' + (id ? ' Номерът ти в статистиката: ' + id + '.' : '')
      : consentNow === false ? 'Сега статистиката е изключена.' : '';
    box.querySelector('.consent-text').scrollTop = 0;   // the state line first
  }
  consentSpace();
}
// hide the banner; if focus was in it, give it back to the button that opened it
// (a banner shown on load just closes)
function consentClose() {
  const box = document.getElementById('consent');
  const had = !!box && !box.hidden && box.contains(document.activeElement);
  consentBanner(false);
  const back = consentReturn;
  consentReturn = null;
  if (had && back && !back.hidden) back.focus({ preventScroll: true });
}
// start or stop Google Analytics after consentNow changed from `was`
function consentApply(was) {
  if (consentNow === true) {
    gaEnable();
    if (was !== true) gaViewCurrent();   // count the tab on screen once, not again on every "Приемам"
  } else {
    gaDisable();
  }
}
function consentAnswer(yes) {
  const was = consentNow;
  consentNow = yes;
  saveConsent(yes);
  consentApply(was);
  consentClose();
}
function consentOpen(from) {
  consentReturn = from || null;
  consentBanner(true);
  document.getElementById('consent-no').focus({ preventScroll: true });
}

(function initConsent() {
  const openers = document.querySelectorAll('[data-consent-open]');
  // statistics are off: no banner and no settings buttons (the privacy links stay)
  openers.forEach(b => { b.hidden = !GA_ID; });
  if (!GA_ID) return;
  document.getElementById('consent-yes').addEventListener('click', () => consentAnswer(true));
  document.getElementById('consent-no').addEventListener('click', () => consentAnswer(false));
  openers.forEach(b => b.addEventListener('click', () => consentOpen(b)));
  const box = document.getElementById('consent');
  if ('ResizeObserver' in window) new ResizeObserver(consentSpace).observe(box);
  else window.addEventListener('resize', consentSpace);
  // the exercises move focus without scrolling: keep a focused control out from under the open banner
  document.addEventListener('focusin', e => {
    const el = e.target;
    if (box.hidden || box.contains(el)) return;
    requestAnimationFrame(() => {        // after the exercise's own scrollIntoView
      if (box.hidden || document.activeElement !== el) return;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > box.getBoundingClientRect().top) el.scrollIntoView({ block: 'nearest' });
    });
  });
  // a choice made in another tab of this browser (or in the app installed from it) applies here at once
  window.addEventListener('storage', e => {
    if (e.key !== CONSENT_KEY && e.key !== null) return;
    const was = consentNow;
    consentNow = consentChoice();
    consentApply(was);
    if (consentNow === null) consentBanner(true);
    else consentClose();
  });
  if (consentNow === true) gaEnable();
  else {
    gaDisable();                          // also removes cookies left from an expired choice
    if (consentNow === null) consentBanner(true);
  }
  // privacy.html links here to change the choice
  if (location.hash === '#statistika') {
    history.replaceState(null, '', location.pathname + location.search);
    consentOpen(document.querySelector('.privacy-links [data-consent-open]'));
  }
})();
