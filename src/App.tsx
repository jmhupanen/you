import { useState, useEffect, useRef } from 'react';
import { getFingerprint, getLocation, getWeather, getGreeting, getCommonNames, getLocalStations, getLanguageFromCountryCode } from './utils';
import { Globe, Wind, Thermometer, Monitor, Cpu, MapPin, Loader2, Radio, Play, Pause, Volume2, VolumeX, RefreshCw, Network, Compass, BatteryCharging, Battery, Clock, Moon, Sun, ShieldAlert } from 'lucide-react';
import { FaWindows, FaApple, FaLinux, FaAndroid } from 'react-icons/fa';

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  const props = { size: 16, style: { marginRight: '0.35rem', flexShrink: 0 } };
  if (p.includes('win')) return <FaWindows {...props} />;
  if (p.includes('mac') || p.includes('iphone') || p.includes('ipad')) return <FaApple {...props} />;
  if (p.includes('android')) return <FaAndroid {...props} />;
  if (p.includes('linux')) return <FaLinux {...props} />;
  return null;
}

function getWeatherSymbol(weathercode: number, isDay: number): string {
  if (weathercode === 0) return isDay ? '☀️' : '🌙';
  if (weathercode <= 2) return isDay ? '🌤️' : '🌙';
  if (weathercode === 3) return '☁️';
  if (weathercode <= 48) return '🌫️';
  if (weathercode <= 57) return '🌦️';
  if (weathercode <= 67) return '🌧️';
  if (weathercode <= 77) return '❄️';
  if (weathercode <= 82) return '🌧️';
  if (weathercode <= 86) return '🌨️';
  return '⛈️';
}

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Weather Refresh State
  const [weatherTimestamp, setWeatherTimestamp] = useState<Date | null>(null);
  const [isWeatherUpdating, setIsWeatherUpdating] = useState(false);
  const lastWeatherSlot = useRef<number>(-1);

  const currentWeatherSlot = () => Math.floor((Math.floor(Date.now() / 1000) - 30) / 900);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Time state
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Battery State
  const [battery, setBattery] = useState<{ level: number, charging: boolean } | null>(null);

  // Orientation State
  const [orientation, setOrientation] = useState<{ alpha: number; beta: number; gamma: number } | null>(null);
  const [orientationSupport, setOrientationSupport] = useState<'checking' | 'available' | 'needs-permission' | 'denied' | 'unavailable'>('checking');

  // Radio State
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.15);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const fp = await getFingerprint();
        let weather = null;
        let coords = null;
        let greeting = 'Hello';
        let hasPredictedName = false;

        try {
          coords = await getLocation();
          if (coords.country && coords.countryCode) {
            const [fetchedGreeting, names] = await Promise.all([
              getGreeting(coords.country),
              getCommonNames(coords.countryCode)
            ]);
            greeting = `${fetchedGreeting}, ${names.maleName}/${names.femaleName}`;
            hasPredictedName = true;
          }
          weather = await getWeather(coords.lat, coords.lon);
        } catch (err: any) {
          console.warn("Could not fetch location/weather", err);
        }

        setData({
          fingerprint: fp,
          greeting,
          hasPredictedName,
          weather,
          coords
        });
        if (weather) {
          setWeatherTimestamp(new Date());
          lastWeatherSlot.current = currentWeatherSlot();
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Weather auto-refresh: poll every 30s, fetch only when a new 15-min slot begins (:00:30, :15:30, :30:30, :45:30)
  useEffect(() => {
    if (!data?.coords) return;

    const interval = setInterval(async () => {
      if (currentWeatherSlot() <= lastWeatherSlot.current) return;
      lastWeatherSlot.current = currentWeatherSlot();
      try {
        const w = await getWeather(data.coords.lat, data.coords.lon);
        setData((prev: any) => ({ ...prev, weather: w }));
        setWeatherTimestamp(new Date());
      } catch (e) {
        console.warn("Interval weather update failed", e);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [data?.coords]);

  const handleManualWeatherRefresh = async () => {
    if (!data?.coords || isWeatherUpdating) return;
    setIsWeatherUpdating(true);
    try {
      const w = await getWeather(data.coords.lat, data.coords.lon);
      setData((prev: any) => ({ ...prev, weather: w }));
      setWeatherTimestamp(new Date());
    } catch (e) {
      console.warn("Manual weather update failed", e);
    } finally {
      setIsWeatherUpdating(false);
    }
  };

  // Battery monitoring
  useEffect(() => {
    let bm: any = null;
    const updateBattery = () => {
      if (bm) {
        setBattery({
          level: bm.level,
          charging: bm.charging
        });
      }
    };

    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((batteryManager: any) => {
        bm = batteryManager;
        updateBattery();
        bm.addEventListener('levelchange', updateBattery);
        bm.addEventListener('chargingchange', updateBattery);
      }).catch((e: any) => console.warn("Battery API error", e));
    }

    return () => {
      if (bm) {
        bm.removeEventListener('levelchange', updateBattery);
        bm.removeEventListener('chargingchange', updateBattery);
      }
    };
  }, []);

  // Load local radio stations when coordinates are found
  useEffect(() => {
    if (data?.coords?.lat && data?.coords?.lon && data?.coords?.countryCode) {
      async function loadStations() {
        const stations = await getLocalStations(data.coords.countryCode, data.coords.lat, data.coords.lon);
        setChannels(stations);
        if (stations.length > 0) setSelectedChannel(stations[0]);
      }
      loadStations();
    }
  }, [data?.coords]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Audio play failed", e));
      }
    }
  };

  // Handle selected channel auto-play effectively if already playing
  useEffect(() => {
    if (audioRef.current && selectedChannel && isPlaying) {
      audioRef.current.play().catch(e => {
        console.error("Audio play failed", e);
        setIsPlaying(false);
      });
    }
  }, [selectedChannel]);

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, selectedChannel]);

  // Orientation: detect support on mount
  useEffect(() => {
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      setOrientationSupport('unavailable');
      return;
    }
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      setOrientationSupport('needs-permission');
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const probe = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null || e.beta !== null || e.gamma !== null) {
        setOrientationSupport('available');
        window.removeEventListener('deviceorientation', probe);
        clearTimeout(timer);
      }
    };
    window.addEventListener('deviceorientation', probe);
    timer = setTimeout(() => {
      window.removeEventListener('deviceorientation', probe);
      setOrientationSupport(prev => prev === 'checking' ? 'unavailable' : prev);
    }, 3000);
    return () => { clearTimeout(timer); window.removeEventListener('deviceorientation', probe); };
  }, []);

  // Orientation: live listener once available
  useEffect(() => {
    if (orientationSupport !== 'available') return;
    const handler = (e: DeviceOrientationEvent) => {
      setOrientation({ alpha: e.alpha ?? 0, beta: e.beta ?? 0, gamma: e.gamma ?? 0 });
    };
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, [orientationSupport]);

  const requestOrientationPermission = async () => {
    try {
      const result = await (DeviceOrientationEvent as any).requestPermission();
      setOrientationSupport(result === 'granted' ? 'available' : 'denied');
    } catch {
      setOrientationSupport('denied');
    }
  };

  if (loading) {
    return (
      <div className="loader-container">
        <Loader2 className="spinner" size={48} />
        <h2>Analyzing your digital footprint...</h2>
      </div>
    );
  }

  if (error) {
    return <div className="error-container"><h2>Error</h2><p>{error}</p></div>;
  }

  return (
    <div className="dashboard">
      <header className="header">
        <div className="header-bg-glow"></div>
        <h1>
          <span className="greeting">{data.greeting}</span>
          {data.hasPredictedName && (
            <span
              className="name-tooltip-trigger"
              data-tooltip="or whatever your name is"
            >
              *
            </span>
          )}
          <span className="greeting">!</span>
        </h1>
        <p className="subtitle">Every website you visit knows this about you.</p>
      </header>

      <main className="grid">
        {data.weather && (
          <section className="card weather-card stagger-1">
            <div className="card-bg-pulse"></div>
            <div className="card-header" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Thermometer className="icon text-orange" />
                <h2>Current Weather</h2>
              </div>
              <button
                onClick={handleManualWeatherRefresh}
                className="refresh-btn"
                disabled={isWeatherUpdating}
                title="Refresh Weather"
              >
                <RefreshCw size={18} className={`text-orange ${isWeatherUpdating ? 'spinning' : ''}`} />
              </button>
            </div>
            <div className="card-body" style={{ width: '100%' }}>
              <div className="weather-main">
                <span className="weather-symbol">{getWeatherSymbol(data.weather.weathercode, data.weather.is_day)}</span>
                <span className="temp">{data.weather.temperature}&deg;C</span>
                <span className="wind"><Wind size={16} /> {data.weather.windspeed} km/h</span>
              </div>
              <div className="location-info">
                <MapPin size={16} />
                <span>{data.coords?.countryCode ? `${data.coords.countryCode} · ` : ''}Lat: {data.coords?.lat.toFixed(2)}, Lon: {data.coords?.lon.toFixed(2)}</span>
              </div>
              {weatherTimestamp && (
                <div className="timestamp-info" style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Last updated: {weatherTimestamp.toLocaleTimeString()}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="card datetime-card stagger-1">
          <div className="card-header">
            <Clock className="icon text-orange" />
            <h2>Local Time</h2>
          </div>
          <div className="card-body">
            {(() => {
              const tz = data.coords?.timezone || data.fingerprint?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
              let timeString = '';
              let dateString = '';
              let timeZoneName = '';
              let hour = 12;

              try {
                const locationLang = getLanguageFromCountryCode(data.coords?.countryCode);
                const locale = locationLang || 'en-US';

                const partsStr = new Intl.DateTimeFormat('en-US', {
                  timeZone: tz,
                  hour: 'numeric',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                }).format(currentTime);
                hour = parseInt(partsStr.split(':')[0], 10);

                timeString = new Intl.DateTimeFormat(locale, {
                  timeZone: tz,
                  hour: 'numeric',
                  minute: '2-digit',
                  second: '2-digit'
                }).format(currentTime);

                dateString = new Intl.DateTimeFormat(locale, {
                  timeZone: tz,
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }).format(currentTime);

                timeZoneName = new Intl.DateTimeFormat(locale, {
                  timeZone: tz,
                  timeZoneName: 'long'
                }).format(currentTime).split(', ')[1] || tz;
              } catch (e) {
                // Fallback if timezone is invalid
                timeString = currentTime.toLocaleTimeString();
                dateString = currentTime.toLocaleDateString();
                timeZoneName = tz;
              }

              let timeOfDayGreeting = 'Hello';
              if (hour >= 5 && hour < 12) timeOfDayGreeting = 'Good Morning';
              else if (hour >= 12 && hour < 17) timeOfDayGreeting = 'Good Afternoon';
              else if (hour >= 17 && hour < 22) timeOfDayGreeting = 'Good Evening';
              else timeOfDayGreeting = 'Good Night';

              const getOffsetMs = (date: Date, tzId: string) => {
                const fmt = new Intl.DateTimeFormat('en-US', {
                  timeZone: tzId,
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                  hour12: false
                });
                const p = Object.fromEntries(fmt.formatToParts(date).map(({ type, value }) => [type, value]));
                return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - date.getTime();
              };
              const year = currentTime.getFullYear();
              const janOffset = getOffsetMs(new Date(year, 0, 1), tz);
              const julOffset = getOffsetMs(new Date(year, 6, 1), tz);
              const nowOffset = getOffsetMs(currentTime, tz);
              const isSummerTime = janOffset !== julOffset && nowOffset !== Math.min(janOffset, julOffset);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{timeOfDayGreeting}!</span>
                    <span style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{timeString}</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{dateString}</span>
                  </div>
                  <div className="details-grid">
                    <div className="detail-item">
                      <span className="label">Timezone</span>
                      <span className="value">{timeZoneName}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Summer Time Status</span>
                      <span className="value" style={{ color: isSummerTime ? 'var(--accent-orange)' : 'var(--text-secondary)' }}>
                        {isSummerTime ? 'Active (DST)' : 'Inactive / Standard'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

        {/* Unless geolocation fails, show info. If fails, show fallback message */}
        {!data.weather && (
          <section className="card weather-card warning-card stagger-1">
            <div className="card-header">
              <MapPin className="icon text-yellow" />
              <h2>Location Data</h2>
            </div>
            <div className="card-body">
              <p>Geolocation access was denied or unavailable. Weather features are disabled.</p>
            </div>
          </section>
        )}

        <section className="card device-card stagger-2">
          <div className="card-header">
            <Monitor className="icon text-blue" />
            <h2>Device Signature</h2>
          </div>
          <div className="card-body details-grid">
            <div className="detail-item">
              <span className="label">OS Theme</span>
              <span className="value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
                {isDarkMode ? 'Dark' : 'Light'}
              </span>
            </div>
            <div className="detail-item">
              <span className="label">Platform</span>
              <span className="value" style={{ display: 'flex', alignItems: 'center' }}><PlatformIcon platform={data.fingerprint.platform} />{data.fingerprint.platform}</span>
            </div>
            <div className="detail-item">
              <span className="label">Resolution</span>
              <span className="value">{data.fingerprint.screenResolution}</span>
            </div>
            <div className="detail-item">
              <span className="label">Color Depth</span>
              <span className="value">{data.fingerprint.colorDepth}-bit</span>
            </div>
          </div>
        </section>

        <section className="card perf-card stagger-3">
          <div className="card-header">
            <Cpu className="icon text-purple" />
            <h2>System Capabilities</h2>
          </div>
          <div className="card-body details-grid">
            <div className="detail-item">
              <span className="label">Logical Cores</span>
              <span className="value">{data.fingerprint.hardwareConcurrency}</span>
            </div>
            <div className="detail-item">
              <span className="label">Device Memory</span>
              <span className="value">{data.fingerprint.deviceMemory}</span>
            </div>
            {battery && (
              <div className="detail-item">
                <span className="label">Battery</span>
                <span className="value" style={{
                  color: battery.charging || battery.level >= 0.8 ? 'var(--accent-green)' : (battery.level <= 0.2 ? '#ef4444' : 'var(--accent-yellow)'),
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {battery.charging ? <BatteryCharging size={18} /> : <Battery size={18} />}
                  {Math.round(battery.level * 100)}% {battery.charging ? '(Charging)' : ''}
                </span>
              </div>
            )}
            <div className="detail-item">
              <span className="label">Timezone</span>
              <span className="value truncate">{data.fingerprint.timezone}</span>
            </div>
            {data.fingerprint.gpu && (
              <div className="detail-item full-width">
                <span className="label">GPU</span>
                <span className="value">{data.fingerprint.gpu}</span>
              </div>
            )}
          </div>
        </section>

        <section className="card connection-card stagger-4">
          <div className="card-header">
            <Network className="icon text-green" />
            <h2>Connection</h2>
          </div>
          <div className="card-body details-grid">
            {data.coords?.ip && (
              <div className="detail-item">
                <span className="label">IP Address</span>
                <span className="value code-like">{data.coords.ip}</span>
              </div>
            )}
            {data.coords?.isp && (
              <div className="detail-item">
                <span className="label">ISP</span>
                <span className="value truncate">{data.coords.isp}</span>
              </div>
            )}
            {data.coords?.city && (
              <div className="detail-item">
                <span className="label">City</span>
                <span className="value">{data.coords.city}{data.coords.region ? `, ${data.coords.region}` : ''}</span>
              </div>
            )}
            {data.fingerprint.connectionType && (
              <div className="detail-item">
                <span className="label">Link Type</span>
                <span className="value">{data.fingerprint.connectionType.toUpperCase()}{data.fingerprint.downlink != null ? ` · ${data.fingerprint.downlink} Mbps` : ''}</span>
              </div>
            )}
          </div>
        </section>

        <section className="card orientation-card stagger-5">
          <div className="card-header">
            <Compass className="icon text-blue" />
            <h2>Device Orientation</h2>
          </div>
          <div className="card-body">
            {orientationSupport === 'checking' && (
              <div className="orientation-unavailable"><p>Detecting orientation sensor...</p></div>
            )}
            {orientationSupport === 'needs-permission' && (
              <div className="orientation-permission">
                <p className="orientation-permission-text">This device has a gyroscope, but iOS requires permission to read it.</p>
                <button className="orientation-btn" onClick={requestOrientationPermission}>Enable Gyroscope</button>
              </div>
            )}
            {orientationSupport === 'denied' && (
              <div className="orientation-unavailable"><p>Gyroscope access was denied. Reload the page and tap "Allow" to enable it.</p></div>
            )}
            {orientationSupport === 'unavailable' && (
              <div className="orientation-unavailable"><p>No orientation sensor detected on this device.</p></div>
            )}
            {orientationSupport === 'available' && (
              <div className="orientation-live">
                <div className="orientation-visuals">
                  {/* Compass */}
                  <div className="compass-container">
                    <div className="compass-ring" style={{ transform: `rotate(${orientation?.alpha ?? 0}deg)` }}>
                      <svg viewBox="0 0 160 160" width="160" height="160">
                        <circle cx="80" cy="80" r="76" fill="none" className="compass-outer-ring" strokeWidth="1.5" />
                        {[0, 90, 180, 270].map(deg => {
                          const rad = (deg - 90) * Math.PI / 180;
                          return <line key={deg} x1={80 + 68 * Math.cos(rad)} y1={80 + 68 * Math.sin(rad)} x2={80 + 76 * Math.cos(rad)} y2={80 + 76 * Math.sin(rad)} className="compass-tick-major" strokeWidth="2" />;
                        })}
                        {[45, 135, 225, 315].map(deg => {
                          const rad = (deg - 90) * Math.PI / 180;
                          return <line key={deg} x1={80 + 71 * Math.cos(rad)} y1={80 + 71 * Math.sin(rad)} x2={80 + 76 * Math.cos(rad)} y2={80 + 76 * Math.sin(rad)} className="compass-tick-minor" strokeWidth="1.5" />;
                        })}
                        {([['N', 0, null], ['E', 90, null], ['S', 180, null], ['W', 270, null]] as [string, number, null][]).map(([label, deg]) => {
                          const rad = (deg - 90) * Math.PI / 180;
                          return <text key={label} x={80 + 56 * Math.cos(rad)} y={80 + 56 * Math.sin(rad)} textAnchor="middle" dominantBaseline="central" className={label === 'N' ? 'compass-cardinal-north' : 'compass-cardinal-minor'} fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif">{label}</text>;
                        })}
                        <g>
                          <polygon points="80,22 74,80 86,80" fill="#ef4444" opacity="0.9" />
                          <polygon points="80,138 74,80 86,80" className="compass-needle-south" opacity="0.9" />
                          <circle cx="80" cy="80" r="5" className="compass-center" strokeWidth="1" />
                        </g>
                      </svg>
                    </div>
                    <div className="compass-heading">{Math.round(orientation?.alpha ?? 0)}°</div>
                  </div>

                  {/* Bubble Level */}
                  <div className="level-container">
                    <div className="level-title">Tilt Level</div>
                    <div className="level-arena">
                      <div className="level-crosshair-h" />
                      <div className="level-crosshair-v" />
                      <div className="level-target" />
                      {(() => {
                        const xPx = (Math.max(-45, Math.min(45, orientation?.gamma ?? 0)) / 45) * 56;
                        const yPx = (Math.max(-45, Math.min(45, orientation?.beta ?? 0)) / 45) * 56;
                        const centered = Math.abs(orientation?.gamma ?? 99) < 5 && Math.abs(orientation?.beta ?? 99) < 5;
                        return <div className={`level-bubble${centered ? ' level-bubble--centered' : ''}`} style={{ transform: `translate(calc(-50% + ${xPx}px), calc(-50% + ${yPx}px))` }} />;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Numeric readouts */}
                <div className="orientation-readouts">
                  <div className="readout-item">
                    <span className="readout-label">Heading (α)</span>
                    <span className="readout-value text-blue">{Math.round(orientation?.alpha ?? 0)}°</span>
                    <span className="readout-sub">Compass</span>
                  </div>
                  <div className="readout-item">
                    <span className="readout-label">Front/Back (β)</span>
                    <span className="readout-value text-purple">{(orientation?.beta ?? 0).toFixed(1)}°</span>
                    <span className="readout-sub">Pitch</span>
                  </div>
                  <div className="readout-item">
                    <span className="readout-label">Left/Right (γ)</span>
                    <span className="readout-value text-orange">{(orientation?.gamma ?? 0).toFixed(1)}°</span>
                    <span className="readout-sub">Roll</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="card browser-card stagger-6">
          <div className="card-header">
            <Globe className="icon text-green" />
            <h2>Browser Footprint</h2>
          </div>
          <div className="card-body">
            <div className="detail-item full-width">
              <span className="label">User Agent</span>
              <span className="value code-like">{data.fingerprint.userAgent}</span>
            </div>
            <div className="details-grid mt-4">
              <div className="detail-item">
                <span className="label">Browser</span>
                <span className="value">{data.fingerprint.browser}</span>
              </div>
              <div className="detail-item">
                <span className="label">Primary Language</span>
                <span className="value">{data.fingerprint.language}</span>
              </div>
              <div className="detail-item">
                <span className="label">Accepted Languages</span>
                <span className="value truncate">{data.fingerprint.languages}</span>
              </div>
              <div className="detail-item">
                <span className="label">Cookies Enabled</span>
                <span className="value">{data.fingerprint.cookiesEnabled ? 'Yes' : 'No'}</span>
              </div>
              <div className="detail-item">
                <span className="label">Network Status</span>
                <span className="value">
                  <span className={`status-dot ${data.fingerprint.online ? 'online' : 'offline'}`}></span>
                  {data.fingerprint.online ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Ad Blocker / Filter</span>
                <span className="value" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: data.fingerprint.adBlocker ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
                  {data.fingerprint.adBlocker && <ShieldAlert size={16} />}
                  {data.fingerprint.adBlocker ? 'Detected (Active)' : 'Not Detected'}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Referred From</span>
                <span className="value" style={{ wordBreak: 'break-all' }}>{data.fingerprint.referrer || 'Direct'}</span>
              </div>
            </div>
          </div>
        </section>

        {channels.length > 0 && (
          <section className="card radio-card stagger-7">
            <div className="card-header">
              <Radio className="icon text-purple" />
              <h2>Local Radio Streams</h2>
            </div>
            <div className="card-body">
              <div className="radio-controls">
                <div className="channel-list">
                  {channels.map(c => (
                    <button
                      key={c.id}
                      className={`channel-btn ${selectedChannel?.id === c.id ? 'active' : ''}`}
                      onClick={() => setSelectedChannel(c)}
                    >
                      {c.title}
                    </button>
                  ))}
                </div>

                {selectedChannel && (
                  <div className="player-container">
                    <button className="play-btn" onClick={togglePlay}>
                      {isPlaying ? <Pause className="text-purple" size={24} /> : <Play className="text-purple" size={24} />}
                    </button>
                    <div className="now-playing">
                      <span className="label">Now Playing</span>
                      <div className="now-playing-title">
                        {selectedChannel.favicon && (
                          <img src={selectedChannel.favicon} alt="" className="station-favicon" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        {selectedChannel.homepage ? (
                          <a href={selectedChannel.homepage} target="_blank" rel="noopener noreferrer" className="value truncate station-homepage-link">{selectedChannel.title}</a>
                        ) : (
                          <span className="value truncate">{selectedChannel.title}</span>
                        )}
                      </div>
                    </div>
                    <div className="volume-control">
                      {volume === 0 ? (
                        <VolumeX className="icon text-secondary" size={20} />
                      ) : (
                        <Volume2 className="icon text-secondary" size={20} />
                      )}
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="volume-slider"
                      />
                    </div>
                  </div>
                )}

                {selectedChannel && (
                  <audio
                    ref={audioRef}
                    src={selectedChannel.streamUrl}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
