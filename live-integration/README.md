# Secure Captcha Live Integration Demo

This directory contains live demonstration applications that integrate with the Secure Captcha Plugin staging server.

## 🔌 Staging Endpoint
**URL:** `https://secure-captcha-plugin.onrender.com`

## 🎯 Available Demos

### 1. Vanilla JavaScript Demo
**Location:** `/vanilla-js/index.html`

Standalone pure JavaScript implementation with no dependencies. This demo shows:
- ✅ Captcha generation from staging API
- ✅ Client-side verification flow
- ✅ Refresh functionality
- ✅ Responsive UI with Tailwind CSS
- ✅ Success/Error state handling
- ✅ Loading animations

### 2. React Demo (Coming Soon)
**Location:** `/react/`

Modern React component integration example.

## 🚀 Running the Demo

⚠️ **IMPORTANT:** You cannot open this file directly using `file://` protocol in browsers due to CORS security restrictions. You must run a local web server.

### Option 1: Using Python (most systems have this pre-installed)
```bash
cd live-integration/vanilla-js
python3 -m http.server 8080
```
Then open: http://localhost:8080

### Option 2: Using Node.js
```bash
npx serve live-integration/vanilla-js
```
Then open: http://localhost:3000

### Option 3: Using PHP
```bash
cd live-integration/vanilla-js
php -S localhost:8080
```

Once running:
1. The demo will automatically connect to the staging server
2. Enter your name, email, and solve the captcha
3. Submit the form to verify integration works

## 🔧 API Endpoints Used

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/captcha/generate` | Generate new captcha challenge |
| POST | `/api/captcha/verify` | Verify captcha answer |

## 📝 Notes
- This demo connects to the live staging environment
- Captcha challenges are real and verified on the server
- No local backend required - everything runs client-side