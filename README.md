# VANTÉRA — Technology, Elevated.

An independent luxury e-commerce platform engineered for premium electronics, minimalist accessories, and elevated personal technology.

---

## 🌟 Overview & Architecture

VANTÉRA is a modern full-stack web application:

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Motion.
- **Backend**: Node.js (v18+) with Express (`server.ts`), featuring JSON REST API endpoints.
- **Database**: Atomic file-backed JSON engine (`data/vantera_db.json`) with automated seeding and recovery.
- **Authentication**: HMAC-SHA256 bearer token authentication, salted password hashing, and role-based access control (Customers vs CEO Admin).
- **Checkout**: Bank transfer and credit checkout system with automated transaction references.
- **CEO Dashboard**: Protected executive console (`/admin/dashboard`) with live revenue, order status management, inventory control, and supplier settings.

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev

# 3. Open in browser
# http://localhost:3000
```

---

## 📦 Deployment to Free Hosting Platforms

### Option A: Render (Recommended — 100% Free Subdomain)

1. **Upload your code to GitHub**:
   - Create a repository on GitHub (e.g. `vantera-store`).
   - Push your code to the repository:
     ```bash
     git init
     git add .
     git commit -m "VANTÉRA initial release"
     git branch -M main
     git remote add origin https://github.com/<your-username>/vantera-store.git
     git push -u origin main
     ```

2. **Deploy on Render**:
   - Go to [render.com](https://render.com) and sign in with GitHub.
   - Click **New +** > **Web Service**.
   - Select your repository.
   - Configure the service (Render auto-detects `render.yaml`):
     - **Name**: `vantera` (gives you `https://vantera.onrender.com`)
     - **Environment**: `Node`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Plan**: `Free`
   - Click **Deploy Web Service**.

### Option B: Koyeb (100% Free Subdomain)

1. Sign up for free at [koyeb.com](https://www.koyeb.com).
2. Click **Create App** > Select **GitHub**.
3. Choose your repository. Koyeb will detect the included `Dockerfile`.
4. Set port to `3000` and click **Deploy**.
5. Your store will be live at `https://<your-app>.koyeb.app`.

### Option C: Container Deployment (Docker / Fly.io / Railway)

A production-ready `Dockerfile` and `.dockerignore` are included in the root of the project:

```bash
docker build -t vantera .
docker run -p 3000:3000 vantera
```

---

## 🔒 Security & Environment Variables

Create a `.env` file in the root directory (based on `.env.example`):

| Variable | Description | Default (if not set) |
| :--- | :--- | :--- |
| `PORT` | HTTP port the server listens on | `3000` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `production` |
| `SESSION_SECRET` | Secret key used to sign authentication tokens | Auto-generated secure fallback |
| `CEO_PASSWORD` | Override password for the CEO administrative portal | Default seed password |

> **Note**: Passwords and session secrets are never committed to version control or exposed in frontend bundles.

---

## 📁 Project Directory Structure

```
├── DEPLOYMENT_GUIDE.md    # Detailed hosting and publishing guide
├── Dockerfile              # Container deployment recipe
├── package.json            # Node.js dependencies and scripts
├── public/                 # Static assets, product photography, icons
│   ├── favicon.svg
│   ├── manus-storage/      # High-definition product images
│   └── vantera-project.zip # Downloadable complete project bundle
├── render.yaml             # Render infrastructure blueprint
├── server/
│   └── db.ts               # Atomic JSON database manager
├── server.ts               # Express application and API router
├── src/
│   ├── App.tsx             # Root React application & routing
│   ├── components/         # Reusable UI components (Cart, Layout, Cards)
│   ├── contexts/           # Authentication & Shopping Cart contexts
│   ├── data/               # Product catalog, categories, brand copy
│   ├── hooks/              # Navigation and routing hooks
│   ├── lib/                # Testable business and commerce logic
│   └── pages/              # Storefront, Shop, Product, Admin pages
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build configuration
```

---

## 📜 License & Ownership

VANTÉRA © All rights reserved. Technology, Elevated.
