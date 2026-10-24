# AccessMate 📖✨

> **Empowering Independence through Accessible Reading, Bilingual OCR & Speech Technology.**

[![Node.js Version](https://img.shields.io/badge/Node.js-20%2B%20%7C%2022%20LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Overview

**AccessMate** is an assistive document reading and text-to-speech platform designed for individuals with visual impairments, dyslexia, or language learning needs. 

It transforms printed documents, receipts, prescriptions, and books into digital, editable text and reads them aloud in both **English** and **Hindi (Devanagari)** with natural speech synthesis.

---

## 🚀 Key Features

* **🎙️ Voice Command Control (Hands-Free PC & Mobile)**:
  * Click the **Voice Control** button to activate hands-free listening.
  * Pick documents from your phone or PC folder (*"Open file"* / *"Pick document"*).
  * Automatically restore your previous document (*"Pick up my last image"*).
  * Control speech playback (*"Read aloud"*, *"Pause"*, *"Stop"*), run OCR (*"Extract text"*), save documents, and change color themes hands-free.
* **🔤 Bilingual In-Browser OCR**:
  * Extract printed text from images (PNG, JPG) and PDF documents.
  * Powered by client-side Tesseract.js — **documents and photos stay private on your device** and are never sent to external AI servers.
* **🔊 Natural Text-to-Speech (TTS)**:
  * Multilingual speech synthesis with voice selection, speed adjustments (0.5×–2.0×), volume, and pitch controls.
* **🎨 Fully Adaptive Tri-Mode Visual Interface**:
  * **Light Mode**: Crisp, high-contrast dark text on clean light paper cards (>7:1 contrast ratio).
  * **Dark Mode**: Soft, non-glaring obsidian palette designed to prevent eye strain.
  * **High Contrast Mode**: WCAG AAA-compliant pure black & white with yellow accents.
* **🔒 Secure User Account & Cloud Sync**:
  * Save extracted texts directly to your personal account.
  * Authentication with bcrypt password hashing and secure `HttpOnly`, `SameSite` cookies.
  * Embedded SQLite database running in crash-resilient WAL mode.
* **🌐 Bilingual Translation**:
  * Instant translation between English and Hindi with speech playback.

---

## 🛠️ Tech Stack

* **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, Tesseract.js, PDF.js
* **Backend**: Node.js 20+ / 24, Express, SQLite (`node:sqlite` & `better-sqlite3`), JSON Web Tokens (JWT), Bcrypt.js
* **Security**: Rate limiting, CSRF verification, origin validation, sanitization

---

## 📦 Getting Started Locally

### Prerequisites
* **Node.js**: Version 20+ (Node 22 LTS or Node 24 recommended)
* **npm**: Version 9+

### Quick Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Himanshudhm987/AccessMate.git
   cd AccessMate
   ```

2. **Configure Environment Variables**:
   Copy the template file in the `server` directory:
   ```bash
   # On Windows (PowerShell):
   cp server/.env.example server/.env

   # On macOS/Linux:
   cp server/.env.example server/.env
   ```
   Open `server/.env` and ensure `JWT_SECRET` has a strong secret (at least 32 characters).

3. **Install Dependencies**:
   Install root, client, and server dependencies in one command:
   ```bash
   npm run install:all
   ```

4. **Launch the Development Servers**:
   ```bash
   npm run dev
   ```

5. **Open in Browser**:
   * Frontend: [http://localhost:5173](http://localhost:5173)
   * Backend API: [http://localhost:5000](http://localhost:5000)

---

## 🌐 Free 1-Click Live Deployment (Render.com)

AccessMate is pre-configured with a Render Blueprint (`render.yaml`) for **100% free web hosting**:

1. Fork or push this repository to your GitHub account (`https://github.com/Himanshudhm987/AccessMate.git`).
2. Go to **[Render.com](https://render.com/)** and sign in with GitHub (Free, no credit card required).
3. Click **New +** at the top right and select **Blueprint**.
4. Connect your `AccessMate` repository and click **Apply**.
5. Render will automatically build the client, start the unified Express server with native SQLite, and provide you with a live `https://accessmate-xxxx.onrender.com` URL that works on any browser (Desktop & Mobile)!

---

## 🏛️ Project Architecture

```text
AccessMate/
├── client/                     # Vite + React Frontend Application
│   ├── src/
│   │   ├── components/         # Modals, tools, health monitors & animations
│   │   ├── utils/              # OCR engine, PDF renderer & API helpers
│   │   ├── App.jsx             # Main interactive application UI
│   │   └── index.css           # Adaptive theme engine (Light/Dark/Contrast)
│   └── vite.config.js          # Reverse-proxy forwarding /api to port 5000
│
├── server/                     # Node.js + Express Backend API
│   ├── data/                   # Auto-generated SQLite database (git-ignored)
│   ├── routes/                 # Auth, documents, system telemetry endpoints
│   ├── middleware/             # JWT auth & security filters
│   └── server.js               # Express application entry point
│
└── package.json                # Root orchestrator with concurrently scripts
```

---

## 🛡️ Privacy & Security Design

* **Privacy First**: Optical Character Recognition runs inside the user's browser via WebAssembly. Images and camera captures are never uploaded to the server unless text is explicitly saved by a logged-in user.
* **Credentials & Passwords**: Passwords are salted and hashed with bcrypt (12 rounds).
* **Session Protection**: JWT authentication tokens are transmitted inside secure, HTTP-only, SameSite cookies to mitigate XSS and credential extraction risks.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🌟 Overview

**AccessMate** is an assistive document reading and text-to-speech platform designed for individuals with visual impairments, dyslexia, or language learning needs. 

It transforms printed documents, receipts, prescriptions, and books into digital, editable text and reads them aloud in both **English** and **Hindi (Devanagari)** with natural speech synthesis.

---

## 🚀 Key Features

* **🎙️ Voice Command Control (Hands-Free PC & Mobile)**:
  * Click the **Voice Control** button to activate hands-free listening.
  * Pick documents from your phone or PC folder (*"Open file"* / *"Pick document"*).
  * Automatically restore your previous document (*"Pick up my last image"*).
  * Control speech playback (*"Read aloud"*, *"Pause"*, *"Stop"*), run OCR (*"Extract text"*), save documents, and change color themes hands-free.
* **🔤 Bilingual In-Browser OCR**:
  * Extract printed text from images (PNG, JPG) and PDF documents.
  * Powered by client-side Tesseract.js — **documents and photos stay private on your device** and are never sent to external AI servers.
* **🔊 Natural Text-to-Speech (TTS)**:
  * Multilingual speech synthesis with voice selection, speed adjustments (0.5×–2.0×), volume, and pitch controls.
* **🎨 Fully Adaptive Tri-Mode Visual Interface**:
  * **Light Mode**: Crisp, high-contrast dark text on clean light paper cards (>7:1 contrast ratio).
  * **Dark Mode**: Soft, non-glaring obsidian palette designed to prevent eye strain.
  * **High Contrast Mode**: WCAG AAA-compliant pure black & white with yellow accents.
* **🔒 Secure User Account & Cloud Sync**:
  * Save extracted texts directly to your personal account.
  * Authentication with bcrypt password hashing and secure `HttpOnly`, `SameSite` cookies.
  * Embedded SQLite database running in crash-resilient WAL mode.
* **🌐 Bilingual Translation**:
  * Instant translation between English and Hindi with speech playback.

---

## 🛠️ Tech Stack

* **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, Tesseract.js, PDF.js
* **Backend**: Node.js 20+ / 24, Express, SQLite (`node:sqlite` & `better-sqlite3`), JSON Web Tokens (JWT), Bcrypt.js
* **Security**: Rate limiting, CSRF verification, origin validation, sanitization

---

## 📦 Getting Started Locally

### Prerequisites
* **Node.js**: Version 20+ (Node 22 LTS or Node 24 recommended)
* **npm**: Version 9+

### Quick Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Himanshudhm987/AccessMate.git
   cd AccessMate
   ```

2. **Configure Environment Variables**:
   Copy the template file in the `server` directory:
   ```bash
   # On Windows (PowerShell):
   cp server/.env.example server/.env

   # On macOS/Linux:
   cp server/.env.example server/.env
   ```
   Open `server/.env` and ensure `JWT_SECRET` has a strong secret (at least 32 characters).

3. **Install Dependencies**:
   Install root, client, and server dependencies in one command:
   ```bash
   npm run install:all
   ```

4. **Launch the Development Servers**:
   ```bash
   npm run dev
   ```

5. **Open in Browser**:
   * Frontend: [http://localhost:5173](http://localhost:5173)
   * Backend API: [http://localhost:5000](http://localhost:5000)

---

## 🌐 Free 1-Click Live Deployment (Render.com)

AccessMate is pre-configured with a Render Blueprint (`render.yaml`) for **100% free web hosting**:

1. Fork or push this repository to your GitHub account (`https://github.com/Himanshudhm987/AccessMate.git`).
2. Go to **[Render.com](https://render.com/)** and sign in with GitHub (Free, no credit card required).
3. Click **New +** at the top right and select **Blueprint**.
4. Connect your `AccessMate` repository and click **Apply**.
5. Render will automatically build the client, start the unified Express server with native SQLite, and provide you with a live `https://accessmate-xxxx.onrender.com` URL that works on any browser (Desktop & Mobile)!

---

## 🏛️ Project Architecture

```text
AccessMate/
├── client/                     # Vite + React Frontend Application
│   ├── src/
│   │   ├── components/         # Modals, tools, health monitors & animations
│   │   ├── utils/              # OCR engine, PDF renderer & API helpers
│   │   ├── App.jsx             # Main interactive application UI
│   │   └── index.css           # Adaptive theme engine (Light/Dark/Contrast)
│   └── vite.config.js          # Reverse-proxy forwarding /api to port 5000
│
├── server/                     # Node.js + Express Backend API
│   ├── data/                   # Auto-generated SQLite database (git-ignored)
│   ├── routes/                 # Auth, documents, system telemetry endpoints
│   ├── middleware/             # JWT auth & security filters
│   └── server.js               # Express application entry point
│
└── package.json                # Root orchestrator with concurrently scripts
```

---

## 🛡️ Privacy & Security Design

* **Privacy First**: Optical Character Recognition runs inside the user's browser via WebAssembly. Images and camera captures are never uploaded to the server unless text is explicitly saved by a logged-in user.
* **Credentials & Passwords**: Passwords are salted and hashed with bcrypt (12 rounds).
* **Session Protection**: JWT authentication tokens are transmitted inside secure, HTTP-only, SameSite cookies to mitigate XSS and credential extraction risks.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

