# 📘 Slush Dating - Developer Manual

Welcome to the Slush Dating project! This comprehensive guide covers the entire technical architecture, infrastructure, and development workflows. It is designed to help new developers understand how everything connects — from the code on your laptop to the live servers.

---

## 🏗️ Project Architecture (Monorepo)

The project is structured as a **monorepo** with three main components:

| Component | Directory | Description | Technology Stack |
|-----------|-----------|-------------|------------------|
| **Web App** | `apps/web/` | The main website & PWA | React + Vite + TypeScript |
| **Native App** | `apps/native/` | iOS & Android mobile app | React Native + Expo |
| **Backend API** | `packages/server/` | The core logic & database | Node.js + Express + MongoDB |

---

## 🌍 Server Infrastructure

We run **two completely isolated environments** on our VPS (`slushdating.com`). This ensures that testing on staging never breaks production.

### 🏭 Production Environment
*   **URL**: `https://www.slushdating.com/app`
*   **API Endpoint**: `https://www.slushdating.com/api`
*   **Git Branch**: `main`
*   **Server Path**: `/root/slush-app/server/`
*   **Port**: `5001`
*   **Database**: `slush_production` (MongoDB Atlas)
*   **PM2 Process**: `slush-server`
*   **Asset Path**: `/root/slush-app/dist/`

### 🚧 Staging Environment
*   **URL**: `https://staging.slushdating.com`
*   **API Endpoint**: `https://staging.slushdating.com/api`
*   **Git Branch**: `develop`
*   **Server Path**: `/root/slush-staging/server/`
*   **Port**: `5002`
*   **Database**: `slush_staging` (MongoDB Atlas)
*   **PM2 Process**: `slush-server-staging`
*   **Asset Path**: `/root/slush-staging/dist/`

> **Note**: Staging is a mirror of production but runs on a different port and uses a different database.

---

## 🔒 Security & Networking

### SSL Certificates (HTTPS)
We use **Let's Encrypt** SSL certificates for both domains. They are auto-renewing.
*   `slushdating.com` (Production)
*   `staging.slushdating.com` (Staging)

### Nginx Configuration
**Nginx** acts as a reverse proxy, sitting in front of our Node.js applications. It handles SSL termination and routing.

*   **Production Config**: `/etc/nginx/sites-available/www-slushdating-com`
    *   Routes `https://www.slushdating.com/api/*` → `localhost:5001`
    *   Routes `https://www.slushdating.com/socket.io/*` → `localhost:5001`
    *   Serves static files from `/root/slush-app/dist/`
*   **Staging Config**: `/etc/nginx/sites-available/staging-slushdating-com`
    *   Routes `https://staging.slushdating.com/api/*` → `localhost:5002`
    *   Routes `https://staging.slushdating.com/socket.io/*` → `localhost:5002`
    *   Serves static files from `/root/slush-staging/dist/`

---

## 🔌 Backend Setup & API

The backend is built with **Node.js** and **Express**.

### Key Technologies
*   **Database**: MongoDB (via Mongoose). Connection strings are in `.env` files.
*   **Real-time**: Socket.IO for chat, notifications, and video calling signaling.
*   **Video**: Agora.io for video calls.
*   **Documentation**: Swagger (OpenAPI).

### 📖 API Documentation (Swagger)
You can view the interactive API documentation live:
*   **Staging Docs**: [https://staging.slushdating.com/api-docs](https://staging.slushdating.com/api-docs)
*   **Production Docs**: [https://www.slushdating.com/api-docs](https://www.slushdating.com/api-docs)

This UI lets you test endpoints directly from the browser!

### folder structure `packages/server/`
*   `models/`: Mongoose schemas (User, Event, Match, Message).
*   `routes/`: API route controllers (`auth.js`, `events.js`, `matches.js`).
*   `middleware/`: Auth verification and error handling.
*   `index.js`: Main entry point.

---

## 🚀 Deployment Workflows (CI/CD)

We use **GitHub Actions** to automate deployments. You rarely need to touch the server manually.

### 1. Deploying to Staging
**Trigger**: Push code to the `develop` branch.
**Workflow**: `.github/workflows/deploy-staging.yml`
**Process**:
1.  Git detects changes (Web, Server, or Native).
2.  **Web**: Builds React app and copies to `/root/slush-staging/dist`.
3.  **Server**: Copies code to `/root/slush-staging/server` and restarts `slush-server-staging`.
4.  **Native**: Does not auto-deploy to stores, but builds artifacts.

### 2. Deploying to Production
**Trigger**: Push code to the `main` branch.
**Workflow**: `.github/workflows/deploy-production.yml`
**Process**:
1.  **Web**: Builds React app and copies to `/root/slush-app/dist`.
2.  **Server**: Copies code to `/root/slush-app/server` and restarts `slush-server`.

---

## 🛠️ Server Troubleshooting

If you need to SSH into the server:
```bash
ssh root@slushdating.com
# Password: (Ask admin)
```

### Essential Commands
We use **PM2** to manage our Node.js processes.

| Command | Description |
|---------|-------------|
| `pm2 list` | Show all running processes and their status. |
| `pm2 logs` | Stream logs for all processes. |
| `pm2 logs slush-server-staging` | View logs for Staging backend only. |
| `pm2 logs slush-server` | View logs for Production backend only. |
| `pm2 restart slush-server-staging` | Restart Staging backend (e.g., to pick up env changes). |
| `pm2 restart slush-server` | Restart Production backend. |
| `pm2 monit` | Visual dashboard of CPU/Memory usage. |

### Checking Database Connection
Check the logs to see if the server connected successfully:
```bash
pm2 logs slush-server-staging --lines 20
# Look for: "✅ Connected to MongoDB successfully"
# Look for: "🌍 Using STAGING database"
```

---

## 💻 Local Development Setup

To run everything on your machine:

1.  **Install Dependencies**
    ```bash
    npm run install:all
    ```

2.  **Start Web App**
    ```bash
    npm run web:dev
    # Opens at http://localhost:5173
    ```

3.  **Start Native App**
    ```bash
    npm run native:start
    # Press 'i' for iOS simulator, 'a' for Android
    ```

4.  **Start Server**
    ```bash
    npm run server:dev
    # Runs on http://localhost:5001
    ```

Make sure you have `.env` files set up in `apps/web` and `packages/server`! See `env-example.txt` for reference.
