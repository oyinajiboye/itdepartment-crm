# IT Department NG — Multi-Company Endpoint & Operations CRM (React / Next.js)

Centralized **Super Manager** and **IT Manager** operations dashboard built with **React 18 / Next.js 14 (App Router)**, styled in the **White (`#FFFFFF` / `#F3F3F1`), Black (`#0A0A0A`), and Dark Green (`#0F300F`)** brand identity.

## Features Included

1. **Super Manager & IT Manager Role Switcher**
   - **Super Manager Mode:** View all client companies, create new **IT Manager** accounts, onboard new **Client Companies** (generating unique `Company Code` enrollment keys such as `ITD-NEXUS-01`), and assign or reassign companies to specific IT Managers.
   - **IT Manager Mode:** Automatically scopes the entire dashboard (Companies, Laptops, 30-Fix Telemetry, Support Tickets, and HR / Website Tasks) to only the companies assigned to the active IT Manager.
2. **Client Companies & 1-Click `Company Code` Copy**
   - Displays every client company's unique `Company Code` (entered inside the Windows AI Support App via `⚙ Company Code`), assigned IT Manager, enrolled laptop count, open ticket count, and monthly retainer.
3. **Enrolled Laptops & Live 30-Fix Audit Log**
   - Tracks every company laptop enrolled via the Windows AI Support App (`device_id`, hostname, OS, IP, online/offline status) and records every automated fix run (`fix_id`, `fix_title`, `status`, duration, and `Company Code`), including offline fixes synced later.
4. **In-App Support Tickets & RustDesk Remote Desktop**
   - Displays tickets escalated directly from the Windows AI Support App, provides **1-click RustDesk ID copy**, and allows IT Managers to send **In-App Replies** and status updates (`open`, `in_progress`, `resolved`) directly back to the employee's Windows app.
5. **HR Onboarding / Offboarding & Website / Email Tasks**
   - Tracks corporate email provisioning, laptop enrollments, access revocations, and website/DNS/SSL tasks per company.

## Quick Start

### 1. Run the Next.js CRM Frontend
```bash
cd crm-nextjs
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

### 2. (Optional) Connect the Live Python FastAPI Backend
The Next.js CRM automatically connects to the FastAPI backend (`http://localhost:8080`) when running, and falls back to built-in seed data + `localStorage` persistence when offline.

To run the live FastAPI backend (which also receives live telemetry and tickets from the Windows AI Support App):
```bash
cd ../windows-app
uvicorn backend.server:app --reload --port 8080
```
