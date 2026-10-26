# VANTÉRA — Free Subdomain Deployment Guide

This guide explains how to deploy **VANTÉRA** to a 100% free hosting platform offering a clean subdomain without any "ai.studio" in the address.

---

## 1. Project Architecture & Requirements

- **Frontend**: React 19 SPA + Vite + Tailwind CSS v4 + Motion
- **Backend**: Node.js (v18+) with Express (`server.ts`)
- **Database**: Local atomic JSON store (`data/vantera_db.json`)
- **Authentication**: HMAC-SHA256 signed bearer tokens with salted password hashing
- **Port**: Automatic via `PORT` environment variable (defaults to 3000 / 10000)

---

## 2. Recommended Free Platform: Render (Render.com)

**URL format received**: `https://<your-subdomain>.onrender.com`  
*(e.g., `https://vantera.onrender.com` or `https://vantera-store.onrender.com`)*

### Why Render?
- 100% Free Web Service tier ($0 / month, no credit card required).
- Native Node.js environment; no Docker required.
- Free SSL/HTTPS certificate automatically provisioned.
- The project already contains `render.yaml` for zero-configuration setup.

### Step-by-Step Deployment Steps:

1. **Push your code to GitHub**:
   - Create a free GitHub repository (public or private), e.g., `vantera-store`.
   - Push this project code to GitHub:
     ```bash
     git init
     git add .
     git commit -m "VANTÉRA production release"
     git branch -M main
     git remote add origin https://github.com/<your-username>/vantera-store.git
     git push -u origin main
     ```

2. **Sign up at [Render.com](https://render.com)**:
   - Click **Get Started for Free** (sign up with GitHub).

3. **Create New Web Service**:
   - In the Render dashboard, click **New +** -> **Web Service**.
   - Select **Build and deploy from a Git repository**.
   - Connect your `vantera-store` GitHub repository.

4. **Settings (Render detects these automatically via `render.yaml`)**:
   - **Name**: `vantera` (or `vantera-store`) -> This sets your address (`vantera.onrender.com`)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan Type**: **Free** ($0/mo)

5. **Deploy**:
   - Click **Create Web Service**.
   - Render builds the frontend and starts the Express backend.
   - Once completed, your live URL appears at the top (e.g., `https://vantera.onrender.com`).

---

## 3. Alternative Free Platform: Koyeb (Koyeb.com)

**URL format received**: `https://<your-app>.koyeb.app`

1. Sign up for free at [koyeb.com](https://www.koyeb.com).
2. Click **Create App** -> **GitHub**.
3. Select your repository.
4. Koyeb detects the `Dockerfile` or Node buildpack automatically.
5. Set port to `3000`.
6. Click **Deploy**. Your app will be live at `https://vantera.koyeb.app`.

---

## 4. Preserved Features Checklist

- **Storefront**: Luxury dark aesthetic, product carousel, category filtering, cart drawer.
- **Customer Accounts**: Sign-up, sign-in, address book, personal order tracking.
- **Bank Transfer Checkout**: Zero-friction checkout with automated order reference generation.
- **CEO Dashboard**: Private portal at `/admin/dashboard` protected by server authorization, with live revenue, order fulfillment, supplier management, and bank account settings.
- **Zero "ai.studio" Branding**: Pure VANTÉRA identity ("Technology, Elevated.").
