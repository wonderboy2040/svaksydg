# SVAKS - Somavamsha Aarya Kshthriya Samaj, Yadgir

Community management platform for member collections, expenditures, and samaj organization.

## 🚀 Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
# → Opens at http://localhost:5173

# 3. Build for production
npm run build
# → Outputs to dist/

# 4. Preview production build locally
npm run preview
```

## 📦 Deploy to Render.com (Recommended)

### Option A: Blueprint (Easiest — auto-configures everything)

1. Push this code to a GitHub repository
2. Go to https://dashboard.render.com
3. Click **New** → **Blueprint**
4. Select your GitHub repo
5. Render will auto-detect `render.yaml` and configure everything:
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
   - SPA routing: automatically handled
6. Click **Apply** — done!

### Option B: Manual configuration (if Blueprint doesn't work)

1. Go to https://dashboard.render.com → **New** → **Static Site**
2. Connect your GitHub repo
3. Configure:
   - **Name:** `svaks-yadgir`
   - **Branch:** `main` (or your default branch)
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`  ← ⚠️ THIS IS CRITICAL
4. Click **Create Static Site**
5. Wait for build to complete (2-3 minutes)
6. Your site will be live at `https://<your-site-name>.onrender.com`

### ⚠️ Common Render Issues & Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| Blank page / 404 on assets | Publish directory wrong | Set to `dist` (not `.` or repo root) |
| `/admin-login` shows 404 | No SPA fallback | Already fixed via `public/_redirects` |
| Build fails | Node version mismatch | Set Node version to 18+ in Render env: `NODE_VERSION=18` |
| Site loads but data doesn't | Google Sheets CORS | Ensure Apps Script is deployed with "Anyone" access |

## 📦 Deploy to Netlify

1. Go to https://app.netlify.com → **Add new site** → **Import from Git**
2. Select your GitHub repo
3. Configure:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Click **Deploy site**

`_redirects` file is already included for SPA routing.

## 📦 Deploy to Vercel

1. Go to https://vercel.com → **Add New** → **Project**
2. Import your GitHub repo
3. Vercel auto-detects Vite — just click **Deploy**

## 🔧 Configuration

Edit `src/config.js` to change:
- `ADMIN_PIN` — Change from `1234` to a secure PIN before production!
- `CLOUD_URL` — Your Google Apps Script Web App URL for cloud sync

## ✨ Features

- **Multi-language:** English / Hindi toggle (saved in localStorage)
- **Dark mode:** 🌙 toggle (saved in localStorage)
- **Cloud sync:** Real-time sync with Google Sheets (every 15 seconds)
- **Multi-device:** All admins see same data instantly
- **PDF reports:** Monthly collection/expenditure reports
- **CSV export:** Excel-compatible exports
- **WhatsApp reminders:** Send payment reminders to unpaid members
- **SMS reminders:** Open SMS app with prefilled message
- **Receipt printing:** 80mm thermal-printer friendly receipts
- **Notice sharing:** Share notices to WhatsApp groups
- **Photo gallery:** Album-based photo management
- **Responsive:** Works on mobile, tablet, and desktop
- **PWA-ready:** Installable on mobile home screen

## 🗂️ Project Structure

```
svaksydg/
├── public/
│   ├── _redirects          # SPA routing for Render/Netlify
│   ├── 404.html            # SPA fallback page
│   └── manifest.json       # PWA manifest
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── ErrorBoundary.jsx
│   │   ├── Loading.jsx
│   │   ├── Modal.jsx
│   │   ├── PDFExport.jsx
│   │   └── Toast.jsx
│   ├── pages/              # Route pages
│   │   ├── Home.jsx        # Public website
│   │   ├── AdminLogin.jsx  # PIN login
│   │   └── Admin.jsx       # Admin dashboard
│   ├── styles/             # CSS files
│   ├── utils/              # Helper modules
│   │   ├── reminder.js     # WhatsApp/SMS/Receipt helpers
│   │   └── useTheme.js     # Dark mode hook
│   ├── App.jsx             # Routes
│   ├── DataContext.jsx     # Cloud sync state management
│   ├── i18n.jsx            # Multi-language translations
│   ├── main.jsx            # Entry point
│   ├── config.js           # App configuration
│   └── utils.js            # Image URL helpers
├── index.html              # HTML template
├── vite.config.js          # Vite build config
├── render.yaml             # Render.com blueprint
└── package.json
```

## 🛠️ Tech Stack

- **React 19** + **Vite 6** — Frontend
- **React Router 7** — Client-side routing
- **Google Sheets + Apps Script** — Backend (free, serverless)
- **CSS Custom Properties** — Theming (light/dark mode)

## 📞 Support

For issues or questions, contact the SVAKS admin team.

---

🕉️ ॐ Sarve Bhavantu Sukhinah • Sarve Santu Niramayah 🕉️
