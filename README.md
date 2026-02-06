# Apple TV Web Remote

A modular, responsive, and premium web-based remote control for Apple TV. Built with a **React** frontend and a **Python/FastAPI** backend using the `pyatv` library.

![Apple TV Remote Preview](https://via.placeholder.com/800x450/000000/007aff?text=Apple+TV+Web+Remote+Interface)

## Features

- **Premium iOS Aesthetic:** A sleek, dark-mode interface inspired by the native iOS remote and Control Center.
- **Multi-Protocol Support:** Persistent pairing for **Companion** (Control), **MRP** (Metadata), and **AirPlay**.
- **Chained Pairing:** A streamlined setup flow that automatically queues all required service pairings in one sequence.
- **Live Metadata & Artwork:** Real-time "Now Playing" information with high-quality artwork and iOS-style scrolling for long titles.
- **Atmospheric Background:** Immersive artwork bleed effect that tints the interface based on what's playing.
- **App Launcher:** Integrated application drawer with search functionality and official app icons fetched from the iTunes API.
- **Favorites Sidebar:** A dedicated, low-profile sidebar for your most-used apps for instant switching.
- **Auto-Reconnect:** Robust WebSocket management that automatically recovers connection if the server restarts.
- **Docker Ready:** Easy deployment with multi-stage builds and configurable persistence.

## Tech Stack

- **Frontend:** React, Vite, Lucide Icons, CSS Modules.
- **Backend:** Python 3.12, FastAPI, `pyatv` 0.17.0, `aiosqlite`.
- **Database:** SQLite for persistent device pairings and favorite apps.
- **Deployment:** Docker, Docker Compose.

---

## Getting Started (Production / Docker)

The easiest way to run the full application is using Docker.

### Prerequisites
- Docker and Docker Compose installed.
- **Host Networking:** The container must run in `host` network mode to allow mDNS/Bonjour discovery of Apple TVs.

### Quick Start
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd remote
   ```

2. **Build and start:**
   ```bash
   docker compose up -d --build
   ```

3. **Access the app:**
   Open your browser and navigate to `http://localhost:8000`.

### Docker Configuration
You can customize the deployment via environment variables in `docker-compose.yml`:
- `PUID` / `PGID`: Set the user/group ID the app runs as (to match host file permissions).
- `DATABASE_PATH`: Customize the location of the SQLite database.

---

## Development Setup

If you want to modify the code, you can run the front and backend separately.

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Access the development UI:
   `http://localhost:5173` (Note: The frontend is configured to proxy requests to the backend at port 8000).

---

## Usage Tips

- **Initial Pairing:** When a new device is discovered, click "Pair Now." You may be asked for multiple PINs in a row (e.g., first for Control, then for Metadata). This is expected and ensures full functionality.
- **Missing Metadata:** If you only see playback controls but no song title, click the "Pair Now" notice under your device in the sidebar to add the Metadata (MRP) service.
- **Mobile Support:** The UI is fully responsive. On mobile, use the burger menu in the top-left to switch between devices.
- **App Icons:** Icons are fetched automatically based on the App Store's database. Built-in system apps (like Settings) will use high-quality letter placeholders.

## License
MIT