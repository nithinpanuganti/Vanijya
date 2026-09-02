# Vanijya (वाणिज्य) — Production Deployment & Database Configuration Guide
**SIH Problem Statement 26132 — Strengthening Market Linkages & Price Discovery for Farmers**

---

## 1. MongoDB Database Setup Options

Vanijya uses **MongoDB** as its single, persistent source of truth with the official **MongoDB native Node.js driver (`mongodb`)**, dedicated Repository Architecture, GeoJSON 2dsphere spatial indexing, native `GridFSBucket` binary streaming for verification photos, and atomic multi-document transaction sessions.

### Option A: Local MongoDB (Development / Local Server)
1. **Install MongoDB Community Server**:
   - **Windows**: `winget install MongoDB.Server` or download from [mongodb.com](https://www.mongodb.com/try/download/community)
   - **Ubuntu / Debian**:
     ```bash
     sudo apt-get install gnupg curl
     curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
     echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
     sudo apt-get update
     sudo apt-get install -y mongodb-org
     sudo systemctl start mongod
     sudo systemctl enable mongod
     ```
2. **Configure Environment Variable**:
   In `apps/backend/.env`:
   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/vanijya
   ```

---

### Option B: MongoDB Atlas (Managed Cloud Cluster)
1. **Create an Atlas Cluster**:
   - Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
   - Create a shared cluster (e.g., M0 Free Tier).
   - Under **Database Access**, create a database user with read/write privileges.
   - Under **Network Access**, whitelist your deployment server IP (or `0.0.0.0/0` for cloud PaaS platforms).
2. **Obtain Connection String**:
   - Click **Connect** &rarr; **Drivers** (Node.js).
   - Copy the SRV connection URI.
3. **Configure Environment Variable**:
   In `apps/backend/.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/vanijya?retryWrites=true&w=majority
   ```

---

## 2. Cloud Platform Deployment (Render / Railway / AWS / Vercel)

### Backend API Service (Render / Railway / AWS EC2):
- **Build Command**:
  ```bash
  npm install && npm run build:backend
  ```
- **Start Command**:
  ```bash
  node apps/backend/dist/main.js
  ```
- **Environment Variables**:
  - `MONGODB_URI`: `mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/vanijya?retryWrites=true&w=majority`
  - `JWT_SECRET`: `vanijya_super_secret_jwt_key_sih2026_national_trade`
  - `JWT_EXPIRES_IN`: `7d`
  - `PORT`: `4000` (or dynamic platform port)
  - `NODE_ENV`: `production`

### Frontend Unified Web Portal (Vercel / AWS Amplify):
- **Root Directory**: Monorepo Root (or `apps/web`)
- **Framework Preset**: `Next.js`
- **Build Command**: `npm run build:web`
- **Start Command**: `npm run start --workspace=apps/web`
- **Environment Variables**:
  - `NEXT_PUBLIC_API_URL`: URL of your deployed Backend API (e.g. `https://api.vanijya.gov.in/api`)

---

## 3. Self-Hosted Linux Server Deployment (Ubuntu / PM2)

1. **System Preparation & Build**:
   ```bash
   git clone https://github.com/nithinpanuganti/Vanijya.git
   cd Vanijya
   npm install
   npm run build
   ```

2. **Configure Environment**:
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   nano apps/backend/.env
   ```

3. **Process Management with PM2**:
   ```bash
   # Install PM2 globally
   npm install -g pm2

   # Start Backend API
   pm2 start apps/backend/dist/main.js --name "vanijya-backend"

   # Start Web Portal
   pm2 start npm --name "vanijya-web" -- run start --workspace=apps/web

   # Save PM2 process list across reboots
   pm2 save
   pm2 startup
   ```

---

## 4. Environment Variables Reference

| Variable | Service | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `MONGODB_URI` | Backend | **Yes** | MongoDB Connection URI (Local or Atlas) | `mongodb://127.0.0.1:27017/vanijya` or `mongodb+srv://...` |
| `JWT_SECRET` | Backend | **Yes** | Cryptographic JWT signing secret | `vanijya_super_secret_jwt_key_sih2026` |
| `JWT_EXPIRES_IN` | Backend | No | Session expiration window (Default: `7d`) | `7d` |
| `PORT` | Backend | No | Backend HTTP listening port (Default: `4000`) | `4000` |
| `NODE_ENV` | Backend | No | Execution environment | `production` / `development` |
| `NEXT_PUBLIC_API_URL` | Web | **Yes** | Public Backend API base endpoint | `http://localhost:4000/api` |

---

## 5. Health & Diagnostic Verification

Verify the deployment readiness by querying the health endpoint:
```bash
curl http://localhost:4000/api/health
```

**Healthy Output (`200 OK`):**
```json
{
  "status": "ok",
  "database": "connected",
  "service": "vanijya-backend",
  "timestamp": "2026-09-02T12:00:00.000Z",
  "sihProblemStatement": "26132 - Strengthening Market Linkages & Price Discovery for Farmers"
}
```

**Degraded Output (`503 Service Unavailable`):**
```json
{
  "status": "degraded",
  "database": "disconnected",
  "message": "MongoDB connection is unavailable. Ensure MONGODB_URI is configured and the database service is running.",
  "service": "vanijya-backend",
  "timestamp": "2026-09-02T12:00:00.000Z"
}
```
