# LiveScanner: Advanced Multi-Source Market Intelligence Platform

## Overview
**LiveScanner** is a real-time Indian Stock Market (NSE/BSE) intelligence platform built with **TypeScript, Node.js (Express), React, and Tailwind CSS**. It aggregates price data, technical indicators, option analytics, and market catalysts using **100% free endpoints and APIs**.

---

## Technical Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │           REACT FRONTEND (Vite / SPA)        │
                               │  - Granular Universe Scope Selector          │
                               │  - Multi-Timeframe Gainers & Losers          │
                               │  - TradingView Lightweight Candlestick Charts│
                               │  - Sector Advance/Decline & PCR Dashboard    │
                               └──────────────────────┬───────────────────────┘
                                                      │ HTTP / WebSocket
                               ┌──────────────────────▼───────────────────────┐
                               │         EXPRESS NODE.JS PROXY SERVER         │
                               │               (server.ts / PORT 3100)        │
                               └──────┬───────────────────┬───────────────────┘
                                      │                   │
               ┌──────────────────────┴──────┐     ┌──────┴──────────────────────┐
               │                             │     │                             │
    ┌──────────▼──────────┐       ┌──────────▼─────┴─────┐        ┌──────────────▼─────────────┐
    │  ANGEL ONE SMARTAPI │       │   NSE PUBLIC JSON    │        │      YAHOO FINANCE         │
    │  - Real-time LTP    │       │   - Put-Call Ratio   │        │  - Market Cap Filters      │
    │  - Scrip Master     │       │   - F&O Ban List     │        │  - P/E & Fundamental Ratios│
    │  - OHLC & Volume    │       │   - Sector Heatmap   │        │  - Historical Base Prices  │
    └─────────────────────┘       └──────────────────────┘        └────────────────────────────┘
```

---

## Core Feature Modules

### 1. Granular Universe & Index Selection Filter
* **Nifty 50**: Top 50 Indian bluechip stocks.
* **Bank Nifty**: Major banking & financial institutions (`HDFCBANK`, `ICICIBANK`, `SBIN`, `KOTAKBANK`, `AXISBANK`, etc.).
* **Nifty IT**: Information technology heavyweights (`TCS`, `INFY`, `HCLTECH`, `WIPRO`, `TECHM`, etc.).
* **Nifty Auto & Pharma**: Sector specific stock buckets.
* **F&O Only Universe**: Filter strictly for the ~180 liquid Future & Options stocks.
* **All NSE Universe**: Complete scan across ~2,000+ listed cash equity stocks.

### 2. Technical Scanners (SmartAPI + Historical Calculation Engine)
* **Multi-Timeframe Gainers & Losers**: 1m, 5m, 15m, Intraday, Weekly, Monthly, and Year-to-Date (YTD).
* **Relative Volume (RVOL) Shockers**: Highlights stocks trading at >2x, 5x, 10x relative to 10-day SMA volume.
* **Gap Up & Gap Down Trackers**: Morning momentum scanner catching open price vs yesterday close gaps.
* **NR7 (Narrow Range 7)**: Volatility compression identification prior to breakouts.
* **52-Week High & Low Proximity**: Stocks within 1%–2% of 52-week or all-time highs (ATH).

### 3. Derivatives & Sentiment Dashboard (NSE Free Endpoints)
* **Put-Call Ratio (PCR)**: Live Nifty & BankNifty strike-weighted PCR tracking overbought/oversold levels.
* **Open Interest (OI) Build-up Classifier**:
  - *Long Buildup*: Price UP + OI UP
  - *Short Buildup*: Price DOWN + OI UP
  - *Short Covering*: Price UP + OI DOWN
  - *Long Unwinding*: Price DOWN + OI DOWN
* **F&O Ban List & MWPL Monitor**: Daily banned securities and warning flags for stocks approaching 95% MWPL limit.

### 4. Catalyst Engine & News Aggregator
* **RSS Financial Stream**: Aggregated news feeds from Moneycontrol, Economic Times, and Livemint.
* **Ticker News Overlay**: Clicking a stock symbol opens ticker-specific news headlines.

### 5. Visual UI & Mobile Strategy
* **TradingView Lightweight Charts**: Interactive candlestick charts with EMAs (9, 20, 50, 200) and VWAP.
* **Progressive Web App (PWA)**: Installable on mobile devices with Service Worker offline caching.
* **Cross-Platform Mobile App (React Native / Expo)**: Shared API integration for mobile push notifications.

---

## How to Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Start dev server on Port 3100
PORT=3100 npm run dev
```

Server URL: `http://localhost:3100`
