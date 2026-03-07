# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Vite HMR)
npm run build    # TypeScript check + production build to dist/
npm run preview  # Serve the production build locally
```

No test runner is configured.

## Architecture

Single-page React app (`src/App.tsx`) with all state and logic in one component. No routing, no state management library, no backend.

**Data flow on load** (sequential async waterfall in `loadData`):
1. `getFingerprint()` — synchronous browser API reads
2. `getLocation()` — IP geolocation via GeoJS, falls back to restcountries
3. `getGreeting()` + `getCommonNames()` — parallel, keyed on country from step 2
4. `getWeather()` — Open-Meteo API, keyed on coords from step 2
5. `getClosestPlaces()` + `getChannelsForPlace()` — Radio Garden via codetabs CORS proxy, triggers separately after `data.coords` is set

All external API calls are in `src/utils.ts`. No API keys required — all APIs are free/public.

**Weather codes**: `data.weather` is the raw `current_weather` object from Open-Meteo, containing `temperature`, `windspeed`, `weathercode` (WMO codes), and `is_day` (1/0).

**Styling**: Single CSS file `src/index.css`. 12-column CSS grid (`repeat(12, 1fr)`). Cards use stagger classes (`.stagger-1` through `.stagger-5`) for both grid-column span and animation delay.

**Icons**: lucide-react for UI icons, react-icons/fa for platform brand logos (`FaWindows`, `FaApple`, `FaLinux`, `FaAndroid`).

## Deployment

`vite.config.ts` uses `base: './'` for GitHub Pages compatibility. To deploy to a non-root path, change `base` to `'/REPO_NAME/'`.
