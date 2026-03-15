// src/utils.ts

function parseBrowser(ua: string): string {
  if (/Edg\/[\d.]+/.test(ua)) return `Edge ${ua.match(/Edg\/([\d]+)/)?.[1]}`;
  if (/OPR\/[\d.]+/.test(ua)) return `Opera ${ua.match(/OPR\/([\d]+)/)?.[1]}`;
  if (/SamsungBrowser\/[\d.]+/.test(ua)) return `Samsung Internet ${ua.match(/SamsungBrowser\/([\d]+)/)?.[1]}`;
  if (/Chrome\/[\d.]+/.test(ua)) return `Chrome ${ua.match(/Chrome\/([\d]+)/)?.[1]}`;
  if (/Firefox\/[\d.]+/.test(ua)) return `Firefox ${ua.match(/Firefox\/([\d]+)/)?.[1]}`;
  if (/Version\/[\d.]+/.test(ua) && /Safari/.test(ua)) return `Safari ${ua.match(/Version\/([\d]+)/)?.[1]}`;
  return 'Unknown';
}

function getGPUInfo(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || null;
    return gl.getParameter(gl.RENDERER) || null;
  } catch {
    return null;
  }
}

async function checkAdBlocker(): Promise<boolean> {
  const [cosmeticBlocked, surrogateBlocked] = await Promise.all([
    // 1. CSS cosmetic filter check — double-rAF ensures uBlock's injected CSS has been applied.
    new Promise<boolean>(resolve => {
      const el = document.createElement('div');
      el.className = 'adsbygoogle adsbox pub_300x250';
      el.style.cssText = 'display:block;position:absolute;left:-9999px;top:-9999px;height:1px;width:1px;';
      document.body.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        resolve(el.offsetHeight === 0 || getComputedStyle(el).display === 'none');
        el.remove();
      }));
    }),

    // 2. Surrogate content check — uBlock replaces adsbygoogle.js with a stub whose push()
    //    contains the literal string 'enable_page_level_ads' (readable surrogate logic).
    //    The real minified push is a tiny delegation wrapper with no such readable strings.
    //    'noopfn' is an internal uBlock helper that can never appear in Google's real code.
    new Promise<boolean>(resolve => {
      const s = document.createElement('script');
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      const t = setTimeout(() => { s.remove(); resolve(false); }, 3000);
      s.onerror = () => { clearTimeout(t); s.remove(); resolve(true); };
      s.onload = () => {
        clearTimeout(t); s.remove();
        const adsg = (window as any).adsbygoogle;
        const pushStr = typeof adsg?.push === 'function'
          ? adsg.push.toString().replace(/\s+/g, '')
          : '';
        resolve(
          pushStr === 'function(){}' ||                // current uBlock surrogate: empty push
          pushStr.includes('enable_page_level_ads') || // older surrogate variants
          pushStr.includes('noopfn')                   // older surrogate variants
        );
      };
      document.head.appendChild(s);
    }),
  ]);

  return cosmeticBlocked || surrogateBlocked;
}

export async function getFingerprint() {
  const nav = window.navigator as any;
  const conn = (navigator as any).connection;

  const adBlocker = await checkAdBlocker();

  return {
    gpu: getGPUInfo(),
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages.join(', '),
    platform: nav.platform,
    hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
    deviceMemory: nav.deviceMemory ? `${nav.deviceMemory} GB` : 'Unknown',
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    colorDepth: window.screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookiesEnabled: navigator.cookieEnabled,
    online: navigator.onLine,
    browser: parseBrowser(navigator.userAgent),
    referrer: document.referrer || null,
    connectionType: conn?.effectiveType || null,
    downlink: conn?.downlink ?? null,
    adBlocker,
  };
}

export async function getLocation(): Promise<{ lat: number, lon: number, countryCode?: string, country?: string, ip?: string, isp?: string, city?: string, region?: string, timezone?: string }> {
  const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
  if (!geoRes.ok) throw new Error('Failed to fetch from GeoJS API');

  const geoData = await geoRes.json();
  const countryCode = geoData.country_code;
  const country = geoData.country;
  const ip = geoData.ip || null;
  const isp = geoData.organization_name || (geoData.organization ? geoData.organization.replace(/^AS\d+\s+/, '') : null);
  const city = geoData.city || null;
  const region = geoData.region || null;
  const timezone = geoData.timezone || null;
  const lat = geoData.latitude ? parseFloat(geoData.latitude) : null;
  const lon = geoData.longitude ? parseFloat(geoData.longitude) : null;

  if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
    return { lat, lon, countryCode, country, ip, isp, city, region, timezone };
  }

  // Fallback: Fetch coordinates using restcountries API by country code
  if (countryCode) {
    const countryRes = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}`);
    const countryInfo = await countryRes.json();
    const coords = countryInfo[0].capitalInfo?.latlng || countryInfo[0].latlng || [0, 0];
    const countryName = countryInfo[0].name?.common || countryCode;
    // Note: timezone from restcountries might be an array, but we'll try to keep it simple
    const timezone = countryInfo[0].timezones?.[0] || null;
    return { lat: coords[0], lon: coords[1], countryCode, country: countryName, ip, isp, city, region, timezone };
  }

  throw new Error('Could not determine location from GeoJS API');
}

export async function getWeather(lat: number, lon: number) {
  // Using Open-Meteo API which is free and doesn't require an API key
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
  if (!res.ok) throw new Error('Failed to fetch weather');
  const data = await res.json();
  return data.current_weather;
}

export async function getGreeting(country: string) {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/novellac/multilanguage-hello-json/master/hello.json`);
    if (res.ok) {
      const data = await res.json();
      const match = Object.values(data).find((v: any) => v.country === country);
      if (match && (match as any).hello) {
        return (match as any).hello;
      }
    }
  } catch (err) {
    console.warn("Could not fetch greeting from multilanguage-hello-json", err);
  }
  return 'Hello';
}

export async function getCommonNames(countryCode: string) {
  let maleName = 'John';
  let femaleName = 'Jane';
  try {
    const res = await fetch('https://raw.githubusercontent.com/sigpwned/popular-names-by-country-dataset/master/common-forenames-by-country.csv');
    if (res.ok) {
      const text = await res.text();
      const lines = text.split('\n');
      let foundM = false;
      let foundF = false;

      for (const line of lines) {
        if (line.startsWith(countryCode + ',')) {
          const parts = line.split(',');
          if (parts.length >= 12) {
            const index = parts[7];
            const gender = parts[9];
            const name = parts[11].trim();

            if (index === '1') {
              if (gender === 'M' && !foundM) {
                maleName = name;
                foundM = true;
              }
              if (gender === 'F' && !foundF) {
                femaleName = name;
                foundF = true;
              }
            }
          }
        }
        if (foundM && foundF) break;
      }
    }
  } catch (err) {
    console.warn("Could not fetch common names from CSV", err);
  }
  return { maleName, femaleName };
}

// Helper to calculate distance between two coordinates in kilometers
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function getClosestPlaces(lat: number, lon: number, limit = 5) {
  try {
    const targetUrl = encodeURIComponent('https://radio.garden/api/ara/content/places');
    const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${targetUrl}`);
    if (!res.ok) throw new Error('Fetch places failed');
    const data = await res.json();

    // API returns geo as [longitude, latitude]
    const placesWithDistance = data.data.list.map((place: any) => ({
      ...place,
      distance: haversineDistance(lat, lon, place.geo[1], place.geo[0])
    }));

    placesWithDistance.sort((a: any, b: any) => a.distance - b.distance);
    return placesWithDistance.slice(0, limit);
  } catch (err) {
    console.error("Error fetching Radio Garden places", err);
    return [];
  }
}

export async function getChannelsForPlace(placeId: string) {
  try {
    const targetUrl = encodeURIComponent(`https://radio.garden/api/ara/content/page/${placeId}/channels`);
    const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${targetUrl}`);
    if (!res.ok) throw new Error('Fetch channels failed');
    const data = await res.json();

    // Channel data is deeply nested in the response
    const channels = data?.data?.content?.[0]?.items || [];

    return channels.map((item: any) => {
      // The Codetabs proxy sometimes nests the actual station data inside a `page` key vs direct flat items.
      const entry = item.page || item;

      // Ensure we have an href or url string
      const linkTarget = entry.href || entry.url;
      if (!linkTarget || typeof linkTarget !== 'string') return null;

      const id = linkTarget.split('/').pop();
      // Titles from Radio Garden APIs can be polluted with newlines and carriage returns, so strip them down.
      const title = (entry.title || "Unknown Station").replace(/[\r\n]+/g, '').trim();

      return {
        id,
        title,
        href: linkTarget
      };
    }).filter((c: any) => c && c.id);
  } catch (err) {
    console.error("Error fetching Radio Garden channels", err);
    return [];
  }
}

export const countryToLang: Record<string, string> = {
  // Common mappings (ISO 3166-1 alpha-2 to BCP 47 language tags)
  'US': 'en-US', 'GB': 'en-GB', 'AU': 'en-AU', 'CA': 'en-CA', 'IE': 'en-IE', 'NZ': 'en-NZ',
  'FR': 'fr-FR', 'DE': 'de-DE', 'IT': 'it-IT', 'ES': 'es-ES', 'PT': 'pt-PT', 'NL': 'nl-NL',
  'SE': 'sv-SE', 'NO': 'no-NO', 'DK': 'da-DK', 'FI': 'fi-FI', 'EE': 'et-EE', 'LV': 'lv-LV',
  'LT': 'lt-LT', 'PL': 'pl-PL', 'CZ': 'cs-CZ', 'HU': 'hu-HU', 'RO': 'ro-RO', 'BG': 'bg-BG',
  'GR': 'el-GR', 'RU': 'ru-RU', 'UA': 'uk-UA', 'TR': 'tr-TR', 'IL': 'he-IL', 'EG': 'ar-EG',
  'SA': 'ar-SA', 'AE': 'ar-AE', 'IN': 'hi-IN', 'ZA': 'en-ZA', 'CN': 'zh-CN', 'TW': 'zh-TW',
  'JP': 'ja-JP', 'KR': 'ko-KR', 'MX': 'es-MX', 'AR': 'es-AR', 'CO': 'es-CO', 'BR': 'pt-BR',
  'CH': 'de-CH', 'AT': 'de-AT', 'BE': 'nl-BE', 'ID': 'id-ID', 'MY': 'ms-MY', 'TH': 'th-TH',
  'VN': 'vi-VN', 'PH': 'tl-PH'
};

export function getLanguageFromCountryCode(countryCode?: string): string | undefined {
  if (!countryCode) return undefined;
  return countryToLang[countryCode.toUpperCase()];
}
