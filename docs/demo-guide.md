# Vanijya (वाणिज्य) — Smart India Hackathon Demo Guide
**Problem Statement 26132:** Strengthening Market Linkages & Price Discovery for Farmers

---

## 1. System Launch & Preparation

### 1-Click Launch (Windows)
Double-click:
```bat
start-vanijya.bat
```
*Automatically clears port locks, starts Backend API on port 4000, starts Unified Web Portal on port 3000, and opens the browser.*

---

## 2. Pre-Configured Demo Credentials

On the unified login page ([`http://localhost:3000/login`](http://localhost:3000/login)):
1. Select a role tab to auto-fill demo credentials.
2. Click **"Sign In to Vanijya"**.

| Persona | Name / Entity | Identifier | Password | Role & Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Farmer (किसान)** | Ramesh Patel | `9876543210` | `Farmer@123` | Nashik, Maharashtra (KCC Verified Producer) |
| **Buyer (व्यापारी)** | FreshCart Agro Ltd. | `buyer@freshcart.com` | `asdfcv321` | Mumbai, Maharashtra (Wholesale Sourcing) |
| **Admin (व्यवस्थापक)** | Vanijya System Admin | `admin@vanijya.gov.in` | `Admin@123` | Ministry of Agriculture Oversight |

---

## 3. The 5-Step Golden Demo Flow

### Step 1: Public Price Discovery (No Login — 0:00 - 0:45)
1. Navigate to [`http://localhost:3000/prices`](http://localhost:3000/prices).
2. Point out **Today's Benchmark Rate (₹2,233/Qtl)**, **7-Day Moving Average (₹2,213/Qtl)**, and the **Lasalgaon Market Arbitrage (+₹96/Qtl Net Gain)**.
3. Highlight the **Best Selling Window** advisory ("Sell within next 24-48 Hours").

---

### Step 2: Farmer Produce Listing & Separated Categories (0:45 - 1:30)
1. Sign in as **Farmer** (`9876543210` / `Farmer@123`).
2. Point out the **6 Real KPI Cards** on the Farmer Dashboard (*Active Bidding*, *Sold*, *Pending Bids*, *Open Lots*, *Total Sales*, *Pending Payments*).
3. Click **"Publish New Crop Lot"** (`/create-lot`):
   - *Crop:* Tomato
   - *Quantity:* 100 Quintals
   - *Expected Price:* ₹2,200/Qtl
   - *Quality Grade:* Grade A
4. Go to **"My Lots"** (`/my-lots`):
   - Demonstrate the **Category Tabs**: `All`, `Active Bidding (🔥)`, `Sold (✅)`, `Open (📋)`, `Cancelled (❌)`.

---

### Step 3: Buyer Sourcing & Bidding (1:30 - 2:15)
1. Sign in as **Buyer** (`buyer@freshcart.com` / `asdfcv321`).
2. Open the Tomato lot in the **Marketplace** (`/browse-lots`).
3. View Farmer Expected Rate (**₹2,200/Qtl**) and Farm-Gate Location.
4. Submit a bid of **₹2,200/Qtl for 100 Qtl**.
5. Go to **"My Bids"** (`/my-bids`):
   - **Modify Quantity:** Click `Modify Quantity` $\rightarrow$ change from 100 Qtl to **80 Qtl** $\rightarrow$ submit $\rightarrow$ audit trail logs the change.
   - **Cancel Bid:** Place a test offer on another lot and click `Cancel Bid` $\rightarrow$ confirmation modal $\rightarrow$ status changes to **WITHDRAWN** ("Bid Cancelled by Buyer").

---

### Step 4: Farmer Acceptance & Real-Time Category Movement (2:15 - 2:45)
1. Switch back to **Farmer** $\rightarrow$ Go to **"My Lots"** (`/my-lots`).
2. Click the **"Active Bidding"** tab $\rightarrow$ The lot is highlighted with a live badge showing the top offer (₹2,200/Qtl for 80 Qtl).
3. Click **"View Offers & Details"** $\rightarrow$ Accept the offer.
4. The lot automatically transitions to **SOLD**:
   - Returns to "My Lots" $\rightarrow$ click **"Sold & Finalized"** tab $\rightarrow$ lot is categorized under SOLD with contract total ₹1,76,000.

---

### Step 5: Admin National Monitoring & Live Audit Trail (2:45 - 3:15)
1. Sign in as **Admin** (`admin@vanijya.gov.in` / `Admin@123`).
2. Access the **Unified Monitoring Cockpit** (`/dashboard`):
   - **Real-Time KPI Cards:** Active Bidding Lots, Sold Lots, Modified Bids, Cancelled Bids, Traded GMV.
   - **Lots Monitor Tab:** Inspect all listings with farmer asking rates and status.
   - **Bids Monitor Tab:** Review all bidding activity with modification history.
   - **User Directories:** Farmer & Buyer directories with verified sales and procurement volumes.
   - **Live Audit Stream:** Real-time chronological audit trail capturing `LOT_CREATED`, `BID_PLACED`, `QUANTITY_MODIFIED`, `BID_CANCELLED`, and `BID_ACCEPTED`.
