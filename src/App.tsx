import React, { useState, useEffect, useRef } from 'react';
import { getFingerprint, getLocation, getWeather, getGreeting, getCommonNames, getClosestPlaces, getChannelsForPlace } from './utils';
import { Globe, Droplets, Wind, Thermometer, Monitor, Cpu, Fingerprint, MapPin, Loader2, Compass, Layers, Radio, Play, Pause, Volume2, RefreshCw } from 'lucide-react';

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

  // Radio Garden State
  const [places, setPlaces] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
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
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Weather auto-refresh interval (1 minute)
  useEffect(() => {
    if (!data?.coords) return;

    const interval = setInterval(async () => {
      try {
        const w = await getWeather(data.coords.lat, data.coords.lon);
        setData((prev: any) => ({ ...prev, weather: w }));
        setWeatherTimestamp(new Date());
      } catch (e) {
        console.warn("Interval weather update failed", e);
      }
    }, 60000);

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

  // Load nearest radio places when coordinates are found
  useEffect(() => {
    if (data?.coords?.lat && data?.coords?.lon) {
      async function loadPlaces() {
        const closest = await getClosestPlaces(data.coords.lat, data.coords.lon);
        setPlaces(closest);
        if (closest.length > 0) {
          setSelectedPlace(closest[0].id);
        }
      }
      loadPlaces();
    }
  }, [data?.coords]);

  // Load channels when selected place changes
  useEffect(() => {
    if (selectedPlace) {
      const placeId = selectedPlace;
      async function loadChans() {
        const chs = await getChannelsForPlace(placeId);
        setChannels(chs);
        if (chs.length > 0) {
          setSelectedChannel(chs[0]);
        } else {
          setSelectedChannel(null);
        }
      }
      loadChans();
    }
  }, [selectedPlace]);

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
              style={{ color: 'var(--accent-purple)' }}
            >
              *
            </span>
          )}
          <span className="greeting">!</span>
        </h1>
        <p className="subtitle">Here is what we know about your connection context.</p>
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
              <span className="label">Platform</span>
              <span className="value">{data.fingerprint.platform}</span>
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
            <div className="detail-item">
              <span className="label">Timezone</span>
              <span className="value truncate">{data.fingerprint.timezone}</span>
            </div>
          </div>
        </section>

        <section className="card browser-card span-full stagger-4">
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
            </div>
          </div>
        </section>

        {places.length > 0 && (
          <section className="card radio-card span-full stagger-5">
            <div className="card-header">
              <Radio className="icon text-purple" />
              <h2>Local Radio Streams</h2>
            </div>
            <div className="card-body">
              <div className="radio-controls">
                <div className="radio-header-actions">
                  <select
                    className="radio-select"
                    value={selectedPlace || ''}
                    onChange={(e) => setSelectedPlace(e.target.value)}
                  >
                    {places.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.title}, {p.country} ({Math.round(p.distance)}km)
                      </option>
                    ))}
                  </select>
                </div>

                {channels.length > 0 ? (
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
                ) : (
                  <p className="no-channels">No channels found for this location.</p>
                )}

                {selectedChannel && (
                  <div className="player-container">
                    <button className="play-btn" onClick={togglePlay}>
                      {isPlaying ? <Pause className="text-purple" size={24} /> : <Play className="text-purple" size={24} />}
                    </button>
                    <div className="now-playing">
                      <span className="label">Now Playing</span>
                      <span className="value truncate">{selectedChannel.title}</span>
                    </div>
                    <div className="volume-control">
                      <Volume2 className="icon text-secondary" size={20} />
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
                    src={`https://radio.garden/api/ara/content/listen/${selectedChannel.id}/channel.mp3`}
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
