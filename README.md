# ⚡ TickRadar v2.0

> **Real-Time Indian Stock Market (NSE) Quantitative Intelligence & Screening Platform**

TickRadar is a high-performance, real-time market scanner and analytics workstation designed for the Indian equity markets (NSE). Powered by **React 19, TypeScript, Express, Vite, and Tailwind CSS v4**, TickRadar provides streaming tick-by-tick price analytics, technical indicator screeners, institutional deal tracking, and derivatives intelligence with multi-tier broker data feeds and automatic simulation fallback.

---

## 🚀 Key Modules

### 1. 📊 Market Pulse & Macro Sentiment
- **Real-Time Market Breadth**: Live Advance/Decline ratio calculated dynamically across 2,000+ NSE equity stocks.
- **PCR Sentiment Gauge**: Strike-weighted Put-Call Ratio for Nifty 50 and Bank Nifty.
- **Sector Performance Treemap**: Live sector breakdown across Nifty IT, Auto, Pharma, Metal, and Banking universes.

### 2. ⚡ Live Market Movers Scanner
- **Multi-Timeframe Scanning**: Real-time gainers and losers across 1m, 5m, 15m, 30m, 1h, Daily, Weekly, Monthly, and Year-to-Date (YTD).
- **Circuit Breaker Detection**: Auto-flags stocks near or locked at Upper/Lower circuit limit bands (2%, 5%, 10%, 20%).
- **Relative Volume (RVOL) & Gap Trackers**: Detect unusual volume surge (2x, 5x, 10x) and morning opening gaps.
- **Interactive Quick Charts & Sparklines**: Instant visual price trend previews and deep links to TradingView & Zerodha.

### 3. 🔍 Quantitative Multi-Factor Screener
- **Technical Indicator Filters**: Filter stocks by RSI (14) overbought/oversold bands and 20/50/200 Exponential Moving Average (EMA) crossovers.
- **Custom Rule Engine**: Compose multi-dimensional conditions dynamically in the browser.

### 4. 🐋 Institutional & Whale Deal Tracker
- **Bulk & Block Deals**: Real-time tracking of FII, DII, and Promoter transactions.
- **Value & Quantity Breakdown**: Inspect deal sizes in Crores (₹ Cr) with entity-level categorization.

### 5. 🎯 F&O & Derivatives Intelligence
- **Open Interest (OI) Classification**: Automatic categorization into **Long Buildup**, **Short Buildup**, **Short Covering**, and **Long Unwinding**.
- **Sentiment Thermometer**: Macro market bias indicator based on composite derivatives positioning.

### 6. 📈 Multi-Chart Split Workspace
- **Side-by-Side Comparison**: Split chart grid layouts (1x1, 2x1, 2x2) for concurrent multi-stock monitoring.
- **Multi-Stock Comparator**: Overlay multiple tickers simultaneously.

---

## 🏛️ System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    REACT 19 SPA (Frontend)                  │
│       Market Pulse • Live Movers • Screener • Charts        │
└──────────────────────────────┬──────────────────────────────┘
                               │ Dynamic HTTP / REST API
┌──────────────────────────────▼──────────────────────────────┐
│             EXPRESS NODE.JS PROXY SERVER (server.ts)        │
│          In-Memory Streaming Cache • Rate Limiting          │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
┌──────────────▼─────────────┐   ┌─────────────▼──────────────┐   ┌───────────────────────────┐
│   Angel One (SmartAPI)     │   │      Fyers API v2          │   │   Simulated Data Engine   │
│  WebSocket V2 (2,000+ EQ)  │   │   Polling Fallback (3s)    │   │  Deterministic Fallback   │
└────────────────────────────┘   └────────────────────────────┘   └───────────────────────────┘
```

### Data Feed Priority Order

1. **Angel One SmartAPI (WebSocket)**: Streaming tick data across the entire NSE Cash universe (~2,000+ equities).
2. **Fyers API (Polling, 3s)**: High-speed polling fallback for liquid universe.
3. **Simulated Random-Walk Engine**: Built-in mock feed guaranteeing zero downtime even without broker API keys.

The active feed status (`ANGEL` | `FYERS` | `SAMPLE`) is always broadcast via `/api/status/data-source` and indicated in the UI.

---

## 📦 Prerequisites

- **Node.js**: `^22.14.0`
- **NPM**: `^10.9.0`

---

## 🛠️ Quick Start

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/tickradar.git
cd tickradar
npm install
```

### 2. Configure Environment (Optional)

Copy the example environment file:

```bash
cp .env.example .env
```

If you have Angel One or Fyers credentials, add them to `.env`:

```env
PORT=3100

# Angel One SmartAPI
ANGEL_API_KEY=your_smartapi_key
ANGEL_CLIENT_CODE=your_client_code
ANGEL_PASSWORD=your_password
ANGEL_TOTP_SECRET=your_totp_secret

# Fyers (Fallback)
FYERS_ACCESS_TOKEN=your_fyers_token
```

> **Note**: If credentials are left blank, TickRadar runs automatically on its built-in simulated data engine.

### 3. Launch Development Server

```bash
npm run dev
```

Open **[http://localhost:3100](http://localhost:3100)** in your browser.

---

## 🚀 Deploy to Render

TickRadar is ready for one-click deployment to [Render](https://render.com) as a **Web Service**:

1. **Create Web Service** on Render and connect your GitHub repository.
2. Configure settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. Under the **Environment Variables** tab, add your credentials (from `.env.example`):
   - `NODE_ENV` = `production`
   - `ANGEL_API_KEY` = `<your_api_key>`
   - `ANGEL_CLIENT_CODE` = `<your_client_code>`
   - `ANGEL_PASSWORD` = `<your_password>`
   - `ANGEL_TOTP_SECRET` = `<your_totp_secret>`
   *(Or leave empty to use the built-in simulated data engine)*
4. Click **Deploy Web Service**!

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts dev server on port 3100 with Vite middleware |
| `npm run build` | Builds frontend bundle (`dist/`) and bundles server with esbuild |
| `npm start` | Runs production server bundle (`dist/server.cjs`) |
| `npm run lint` | Type-checks the entire project via `tsc --noEmit` |
| `npm run format` | Auto-formats code with Prettier |
| `npm run format:check` | Verifies code formatting compliance |

---

## 🌐 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/smartapi/live-gainers-losers` | Top movers with universe, timeframe, circuit, price & RVOL filters |
| `GET` | `/api/smartapi/market-breadth` | Live Advance/Decline counts, ratios, sector performance, and PCR |
| `GET` | `/api/smartapi/fno-buildup` | Classifies liquid F&O stocks by OI buildup type |
| `GET` | `/api/smartapi/screener` | Multi-factor quantitative screener (RSI 14, EMAs) |
| `GET` | `/api/smartapi/status` | Angel One connectivity & auth status |
| `POST` | `/api/smartapi/sync-symbols` | Downloads and refreshes the Angel One Scrip Master |
| `GET` | `/api/fyers/status` | Fyers token connectivity status |
| `GET` | `/api/status/data-source` | Active live feed identifier (`ANGEL`, `FYERS`, `SAMPLE`) |

---

## 🛡️ License & Disclaimer

This project is licensed under the [MIT License](LICENSE).

**Disclaimer**: *TickRadar is built for educational, research, and technical analysis purposes. It does not constitute financial, investment, or trading advice.*


