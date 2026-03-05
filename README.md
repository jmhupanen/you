# Fingerprint App

A beautiful, responsive web application that displays browser fingerprinting data, current geolocation, and weather. Built with React, Vite, and Lucide icons.

## Features
- **Browser Fingerprint**: Detects OS, resolution, browser language, CPU cores, memory, and more.
- **Location & Weather**: Fetches precise geolocation and looks up current weather using Open-Meteo.
- **Premium Design**: Dark mode UI, glassmorphism, glowing micro-animations, and responsive grid layout.

## Deploy to GitHub Pages

This app is configured to be seamlessly deployed to GitHub Pages.

1. Initialize git and commit your files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Link your GitHub repository:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   ```

3. To deploy, the easiest method is using the `gh-pages` package:
   ```bash
   npm install -D gh-pages
   ```
   Add the following scripts to your `package.json`:
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```
   If your repo is not a user page (i.e. not `username.github.io`), ensure you update `vite.config.ts` replacing `base: './'` with `base: '/YOUR_REPO_NAME/'`.

4. Deploy!
   ```bash
   npm run deploy
   ```

## Development
Run locally:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```
