# 🌾 Vanijya (वाणिज्य)

> **National Agricultural Price Discovery, Direct Market Linkages & Verified Trading Portal**  
> *Smart India Hackathon 2026 | Problem Statement: SIH 26132*

---

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen?style=for-the-badge)](https://github.com/nithinpanuganti/Vanijya)
[![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen?style=for-the-badge)](https://github.com/nithinpanuganti/Vanijya)
[![Database](https://img.shields.io/badge/Database-MongoDB%20%2B%20GridFS-green?style=for-the-badge&logo=mongodb)](https://github.com/nithinpanuganti/Vanijya)
[![Workflow](https://img.shields.io/badge/Verification-Admin%20Approval%20Workflow-emerald?style=for-the-badge&logo=checkmarx)](https://github.com/nithinpanuganti/Vanijya)
[![Theme](https://img.shields.io/badge/Theme-Golden%20Yellow-amber?style=for-the-badge&color=f59e0b)](https://github.com/nithinpanuganti/Vanijya)
[![Languages](https://img.shields.io/badge/Languages-English%20%7C%20%E0%A4%B9%E0%A4%BF%E0%A4%82%E0%A4%A6%E0%A4%85%20%7C%20%E0%B0%A4%E0%B1%86%E0%B0%B2%E0%B1%81%E0%B0%97%E0%B1%81-yellow?style=for-the-badge)](https://github.com/nithinpanuganti/Vanijya)

---

## 🌟 Key Features & Architectural Highlights

```
                    ONE VANIJYA PORTAL
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
      PUBLIC MARKET DATA             COMMON LOGIN & SIGNUP
      (Agmarknet Benchmarks)              │
                                          ▼
                                ADMIN VERIFICATION DESK
                                          │
                         ┌────────────────┼────────────────┐
                         ▼                ▼                ▼
                      FARMER            BUYER            ADMIN
                         │                │                │
                    Command Center   Procurement Desk  Oversight Cockpit
                    Lots & Offers    Bids & Catalog    12-KPI Monitor
                    Direct Sales     Purchase Orders   Audit Trail
                    Profile Gate     Profile Gate      Registration Desk
                    GPS & Photo      GPS & Photo       Dossier Inspection
```

### 1. 🛡️ Secure Signup & Identity Verification Workflow (`/signup`)
- **Step 1: Account Persona Selection**: Choose between **🌾 Farmer / Producer** and **🏢 Institutional / Wholesale Buyer** (Admin accounts cannot be self-registered).
- **Step 2: Profile Photo Verification**:
  - Live HTML5 webcam snapshot (`navigator.mediaDevices.getUserMedia`) or drag-and-drop file upload (JPEG, PNG, WebP $\le 5\text{MB}$).
  - Persisted in MongoDB GridFS (`profile_photos` bucket) and rendered across user avatars and admin dossier review.
- **Step 3: Geolocation Coordination**:
  - Instant GPS location detection (`navigator.geolocation.getCurrentPosition`) saved as GeoJSON Point `[longitude, latitude]` with `2dsphere` spatial indexing.
  - Manual regional address fallback (State, District, Village / Warehouse Hub).
- **Step 4: Operational Credentials & KYC**:
  - **Farmers**: Primary Crop, Farm Size (Acres), KCC Number, APMC License.
  - **Buyers**: Organization, Contact Person, Business Type, Warehouse Location, GSTIN, FSSAI License.
  - **Live Password Strength Meter**: 5-point evaluation verifying 8+ characters, uppercase, lowercase, number, and special character rules.
- **Step 5: Registration Confirmation Screen**: Displays 🟡 **Pending Admin Verification**.
- **Login Enforcement**:
  - `PENDING` accounts are blocked with an approval status notification.
  - `REJECTED` accounts are blocked and display the administrator's specific rejection reason.
  - `APPROVED` accounts receive JWT session tokens and access their dashboard with a `🟢 Verified` badge.

### 2. 🏛️ Admin Applicant Verification Desk (`/dashboard` &rarr; Registration Requests)
- **4 Real-Time KPI Cards**: *Pending Farmers*, *Pending Buyers*, *Approved Today*, *Rejected Today*.
- **Interactive Applicant Directory**: Full-text search (name, phone, organization, district, state), role filters, and status filters.
- **Applicant Dossier Review Modal**: Complete inspection of applicant identity photo, GPS coordinates, and agricultural/commercial credentials before approval.
- **Structured Rejection Dialog**: Captures constructive rejection reasons logged to the user's permanent record.
- **Chronological Audit Trail**: Records `USER_REGISTERED`, `USER_APPROVED`, and `USER_REJECTED` audit events.

### 3. 🔔 Persistent Notification Center (`NotificationBell`)
- Real-time notification feed in the top navigation bar with unread badge count, dropdown panel, and background polling.
- **Automated Event Triggers**:
  - Sourcing bid placed &rarr; Farmer receives `BID_RECEIVED`.
  - Bid modified / cancelled &rarr; Farmer receives `BID_MODIFIED` / `BID_CANCELLED`.
  - Farmer accepts offer &rarr; Winning buyer receives `BID_ACCEPTED` & `PAYMENT_INITIATED`; competing bidders receive `BID_REJECTED`.
  - Payment settled &rarr; Farmer receives `PAYMENT_PAID`.
  - Registration submitted / approved / rejected &rarr; System notifications dispatched.

### 4. 🌾 Farmer Produce Management with Categorized Views
- "My Lots" area with category tabs: **All**, **Active Bidding (🔥)**, **Sold (✅)**, **Open (📋)**, and **Cancelled (❌)**.
- Dedicated views for Active Bidding lots (asking price, top bid, live incoming offers) and Sold contracts (buyer, contract total, payment status).
- 6 KPI dashboard summary cards dynamically calculated from backend data (*Active Bidding*, *Sold Lots*, *Pending Bids*, *Open Lots*, *Total Sales*, *Pending Payments*).

### 5. 🏢 Buyer Procurement & Bid Lifecycle Management
- **Live Bid Multiplier**: Real-time `Bid Rate × Quantity = Total Order Value` calculation on lot detail pages.
- **Self-Service Quantity Modification**: Update pending bid quantities ($0 < \text{newQuantity} \le \text{lot.quantity}$) with automated bounds checking.
- **Self-Service Bid Cancellation**: Withdraw pending bids (`PENDING` &rarr; `WITHDRAWN`) with audit logging.

### 6. 📊 Public Price Discovery (`/prices` — No Login Required)
- Live Agmarknet benchmark rates, 7-day Simple Moving Average (SMA) charts, volatility indicators, and regional Spatial Arbitrage calculator accessible without authentication.

### 7. 🌐 Trilingual Internationalization (i18n)
- 1-click instantaneous switching between **English**, **हिंदी (Hindi)**, and **తెలుగు (Telugu)** across all 17 routes, status badges, forms, and validation prompts.

### 8. 🍃 Modern MongoDB Data Layer (Local or Atlas)
- Robust Mongoose schemas with 2dsphere indexing, GridFS streaming bucket, atomic multi-document transaction handling, and auto-seeding demo data on fresh environment startup.

---

## 🧭 Application Endpoints

| Portal / Feature | URL | Description |
| :--- | :--- | :--- |
| **Unified Web Portal** | [**http://localhost:3000**](http://localhost:3000) | Public landing page with live mandi tickers & core features |
| **Public Price Discovery** | [**http://localhost:3000/prices**](http://localhost:3000/prices) | Live rates, 7-day trend chart & arbitrage (No login needed) |
| **Common Sign In** | [**http://localhost:3000/login**](http://localhost:3000/login) | Unified login with credential & approval check |
| **Unified Registration** | [**http://localhost:3000/signup**](http://localhost:3000/signup) | Photo capture, GPS location, password meter & KYC |
| **Smart Dashboard** | [**http://localhost:3000/dashboard**](http://localhost:3000/dashboard) | Role-aware cockpit (Farmer, Buyer, Admin Verification Desk) |
| **Farmer Lots & Bids** | [**http://localhost:3000/my-lots**](http://localhost:3000/my-lots) | Category tabs: All, Active Bidding, Sold, Open, Cancelled |
| **Buyer Active Bids** | [**http://localhost:3000/my-bids**](http://localhost:3000/my-bids) | Buyer bids management with Modify Quantity & Cancel Bid |
| **Marketplace Catalog** | [**http://localhost:3000/browse-lots**](http://localhost:3000/browse-lots) | Sourcing lots with live procurement value calculation |
| **Profile Management** | [**http://localhost:3000/profile**](http://localhost:3000/profile) | Identity photo, GPS location, and KYC completion gauge |
| **Backend API & Swagger Docs** | [**http://localhost:4000/api/docs**](http://localhost:4000/api/docs) | 33 NestJS REST APIs & Swagger interactive docs |
| **Backend Health Check** | [**http://localhost:4000/api/health**](http://localhost:4000/api/health) | Backend & MongoDB connection readiness status |

---

## 🔑 Pre-Configured Demo Credentials

| Persona | Name / Entity | Identifier | Password | Role & Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Farmer (किसान)** | Ramesh Patel | `9876543210` | `Farmer@123` | Nashik, Maharashtra (KCC Verified Producer) |
| **Buyer (व्यापारी)** | FreshCart Agro Ltd. | `buyer@freshcart.com` | `asdfcv321` | Mumbai, Maharashtra (Wholesale Sourcing) |
| **Admin (व्यवस्थापक)** | Vanijya System Admin | `admin@vanijya.gov.in` | `Admin@123` | Ministry of Agriculture Oversight |

---

## 🚀 Fresh Machine Setup Guide

Follow these simple steps to run Vanijya on a new or cloned machine:

### STEP 1: Install Node.js
Ensure **Node.js (v18 or v20+ LTS)** and **npm (v9 or v10+)** are installed on your machine.
Verify with: `node -v` and `npm -v`.

### STEP 2: Install / Start MongoDB or Create MongoDB Atlas Cluster
- **Local MongoDB**: Ensure your local MongoDB daemon is running (default port `27017`).
- **MongoDB Atlas**: Create a free cloud cluster and get your connection URI.

### STEP 3: Clone Repository
```bash
git clone https://github.com/nithinpanuganti/Vanijya.git
cd Vanijya
```

### STEP 4: Install Dependencies
```bash
npm install
```

### STEP 5: Create Backend Environment File
Copy the provided template to create your `.env` file:
```bash
cp apps/backend/.env.example apps/backend/.env
```
*(On Windows Command Prompt: `copy apps\backend\.env.example apps\backend\.env`)*

### STEP 6: Configure `MONGODB_URI`
Open `apps/backend/.env` and set your MongoDB connection string:
```env
# Local MongoDB example:
MONGODB_URI=mongodb://127.0.0.1:27017/vanijya

# OR MongoDB Atlas example:
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/vanijya?retryWrites=true&w=majority

JWT_SECRET=vanijya_super_secret_jwt_key_sih2026_national_trade
JWT_EXPIRES_IN=7d
PORT=4000
NODE_ENV=development
```

### STEP 7: Automatic Initial Seeding
When the backend starts and detects an empty database, it automatically seeds all demo accounts (Farmers, Buyers, Admin), crops, markets, prices, lots, bids, and notifications.

### STEP 8: Start Backend API
```bash
npm run start:dev --workspace=apps/backend
```
*Backend runs on [http://localhost:4000/api](http://localhost:4000/api) with Swagger at [http://localhost:4000/api/docs](http://localhost:4000/api/docs).*

### STEP 9: Start Unified Web Portal
In a new terminal:
```bash
npm run dev --workspace=apps/web
```
*Unified Web Portal opens at [http://localhost:3000](http://localhost:3000).*

---

## 🧪 Automated Testing

All automated unit, integration, and end-to-end transaction loop tests pass with 100% success rate:
```bash
npm test --workspace=@vanijya/backend
```

```
PASS src/e2e-live-loop.spec.ts
PASS src/prices/services/price-analytics.service.spec.ts
PASS src/notifications/notifications.service.spec.ts
PASS src/prices/prices.service.spec.ts
PASS src/lots/lots.service.spec.ts
PASS src/app.controller.spec.ts
PASS src/auth/auth.service.spec.ts
PASS src/admin/admin.service.spec.ts
PASS src/bids/bids.service.spec.ts

Test Suites: 9 passed, 9 total
Tests:       63 passed, 63 total
Snapshots:   0 total
```

---

## 📋 Judge Demonstration Walkthrough

```
1. Open Vanijya Portal (http://localhost:3000) & Click "Sign In" (/login)
   └─ Click "Create New Account" -> Opens /signup

2. Step 1: Choose Persona
   └─ Select [ 🌾 Farmer ] or [ 🏢 Buyer ]

3. Step 2: Live Photo & GPS Location
   └─ Take Live Webcam Snapshot or Upload Identity Photo (GridFS)
   └─ Click "Detect My Current Location" -> Acquires GPS Coordinates

4. Step 3: Fill Details & KYC
   └─ Name, Mobile (e.g. 9811223344), Password (with live strength gauge), Location & Crops
   └─ Click "Submit Application for Verification"

5. Step 4: View Confirmation Screen
   └─ Displays 🟡 "Pending Admin Verification"

6. Attempt Login before Approval
   └─ Go to /login -> Enter 9811223344 -> Sign In
   └─ Blocked with notice: "Your account is awaiting admin approval."

7. Login as System Administrator
   └─ Use admin@vanijya.gov.in / Admin@123 -> Sign In
   └─ Open "Registration Requests" tab in Admin Dashboard
   └─ Click "Review Application" -> Inspect Applicant Photo, GPS, and Credentials Dossier
   └─ Click "Approve User" (or "Reject Request" with constructive reason)

8. Login as Newly Approved User
   └─ Sign out of Admin -> Sign in with the newly approved Farmer credentials
   └─ Farmer reaches Command Center with "🟢 Verified Farmer" badge and profile avatar
```

---

## 🏛️ Smart India Hackathon 2026 Compliance

- **Problem Statement:** SIH 26132
- **Organization:** Ministry of Agriculture & Farmers Welfare
- **Theme:** Agriculture, FoodTech & Rural Development
- **Outcome:** Direct farmer price discovery, live photo capture & GridFS verification, GeoJSON location capture, complete registration & admin verification lifecycle, persistent multi-event notifications, and auditable national trade monitoring.
