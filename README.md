# Intelligent Food Surplus Redistribution Platform

A full-stack food redistribution system connecting food donors (restaurants, caterers, grocery stores) with recipients (shelters, community kitchens) and volunteers through automated max-flow allocation, exact-bundle subset matching, and optimized delivery routing.

---

## Architecture Overview

- **Frontend**: React 19, Vite, Vanilla CSS design system, Leaflet/OpenStreetMap (`http://localhost:5173`)
- **Backend**: Node.js, Express, Zod validation, Jest (`http://localhost:4000`)
- **Database & Auth**: Supabase (PostgreSQL with Row-Level Security, Supabase Auth)
- **Algorithms**:
  - Edmonds-Karp / Dinic Max-Flow bipartite matching for surplus allocation
  - Backtracking subset-sum optimization for exact batch bundles
  - Floyd-Warshall hub-to-hub shortest distance matrix & Haversine formula
  - Nearest-neighbor delivery route optimization & priority sorting

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **Git**

---

## Quick Start (Local Setup)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd food-redistribution
```

### 2. Configure Environment Variables

The project consists of two separate sub-applications: `backend/` and `frontend/`. Both require their respective `.env` files.

#### A. Backend Configuration (`backend/.env`)
Create `backend/.env` (you can copy from `backend/.env.example`):
```bash
cp backend/.env.example backend/.env
```
Fill in the values:
```env
PORT=4000
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
```
*(Get the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from your project admin or the Supabase Dashboard under Settings > API).*

#### B. Frontend Configuration (`frontend/.env`)
Create `frontend/.env` (you can copy from `frontend/.env.example`):
```bash
cp frontend/.env.example frontend/.env
```
Fill in the values:
```env
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_API_URL=http://localhost:4000/api
```
*(Note: `VITE_API_URL` points to the local backend Express API).*

---

### 3. Install Dependencies

Install packages in both directories:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

cd ..
```

---

### 4. Start the Application

You will need **two terminal tabs/windows**:

#### Terminal 1 — Backend API
```bash
cd backend
npm run dev
```
- The backend starts at: **`http://localhost:4000`**
- Health check available at: **`http://localhost:4000/api/health`**

#### Terminal 2 — Frontend App
```bash
cd frontend
npm run dev
```
- The frontend will launch at: **`http://localhost:5173`**
- Open **`http://localhost:5173`** in your browser.

---

## User Roles & Testing Workflows

The platform supports 4 distinct user roles:

1. **Donor (`donor`)**:
   - Create surplus food donations (category, quantity, unit, preparation time, expiry time, location pin).
   - Track donation statuses (`AVAILABLE`, `PARTIALLY_ALLOCATED`, `FULLY_ALLOCATED`, `EXPIRED`, `CANCELLED`).
   - Cancel donations before allocation or expiry.

2. **Recipient (`recipient`)**:
   - Submit food requests (category, quantity, urgency 1–5, needed-by deadline, location pin).
   - Track request fulfillment and cancel open requests.

3. **Volunteer (`volunteer`)**:
   - Access "My Delivery Routes" to view assigned multi-stop pickup and drop-off journeys.
   - Mark individual route stops as completed in sequential order.

4. **Admin (`admin`)**:
   - Access the **Admin Console** with 3 operational tabs:
     - **Overview**: System-wide analytics KPI cards, all donations, all requests, and recent run history.
     - **Allocation**: Run automated bipartite matching, review proposed allocations, and Confirm or Discard runs.
     - **Logistics**: Generate optimized volunteer delivery routes and use the Exact Bundle Finder (subset-sum optimization).

> **Note on Admin Accounts**: For security, self-signup only permits registering as `donor`, `recipient`, or `volunteer`. To create an Admin user, sign up through the UI or Supabase Auth, then change their `role` to `'admin'` in the `profiles` table in Supabase.

---

## Helpful Commands

### Running Backend Unit & Route Tests
```bash
cd backend
npm test
```
Runs Jest test suites covering algorithms (max-flow, hub distances, priority sort, subset bundle, route optimizer, quickselect) and Express routes.

### Building Frontend for Production
```bash
cd frontend
npm run build
```

### Resetting Test Activity Data
To clear out test activity (donations, requests, allocations, runs, routes, stops) while preserving user profiles, hubs, and hub network topology:
```bash
cd backend
node scripts/resetActivityData.js
```
