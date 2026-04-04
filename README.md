# You

A single-page app that reveals what your browser exposes about you — your device, location, weather, and nearby radio stations. No backend, no API keys, no tracking.

## Features

- **Device Signature** — OS/platform (with icon), screen resolution, color depth
- **System Capabilities** — logical CPU cores, device memory, timezone
- **Browser Footprint** — user agent, language settings, cookie status, network status
- **Location & Weather** — IP geolocation via GeoJS, current conditions via Open-Meteo (auto-refreshes every minute, manual refresh available)
- **Local Radio** — top stations for your country via Radio Browser, sorted by proximity where available, with station favicon, homepage link, in-page audio player and volume control
- **Localized greeting** — says hello in your country's language and guesses common local names

## APIs used (all free, no keys required)

| Data | Source |
|---|---|
| IP geolocation | [GeoJS](https://get.geojs.io) → fallback [restcountries](https://restcountries.com) |
| Weather | [Open-Meteo](https://open-meteo.com) |
| Local greeting | [multilanguage-hello-json](https://github.com/novellac/multilanguage-hello-json) |
| Common names | [popular-names-by-country-dataset](https://github.com/sigpwned/popular-names-by-country-dataset) |
| Radio streams | [Radio Browser](https://www.radio-browser.info) |

## Development

```bash
npm run dev      # Start dev server with HMR
npm run build    # TypeScript check + production build
npm run preview  # Serve the production build locally
```

## Deployment

Built with `base: './'` in `vite.config.ts` for GitHub Pages compatibility. For a non-root path, set `base` to `'/REPO_NAME/'`.
