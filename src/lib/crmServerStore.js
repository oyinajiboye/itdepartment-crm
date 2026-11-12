import fs from "fs";
import path from "path";
import { INITIAL_CRM_DATA } from "../data/seedData";

const STORE_FILE = path.join("/tmp", "itd_crm_vercel_store.json");

function cloneInitial() {
  return JSON.parse(JSON.stringify(INITIAL_CRM_DATA));
}

export function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.companies)) {
        return parsed;
      }
    }
  } catch (err) {
    // Fallback to initial seed data if /tmp read fails
  }
  const initial = cloneInitial();
  saveStore(initial);
  return initial;
}

export function saveStore(state) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    // Ignore read-only filesystem errors if any
  }
  return state;
}

export function computeSummary(state) {
  const openTickets = (state.tickets || []).filter((t) => t.status !== "resolved").length;
  const onlineDevices = (state.devices || []).filter((d) => d.status === "online").length;
  return {
    total_companies: (state.companies || []).length,
    total_managers: (state.managers || []).filter((m) => m.role === "it_manager").length,
    total_devices: (state.devices || []).length,
    online_devices: onlineDevices,
    total_fixes_logged: (state.fix_logs || []).length,
    open_tickets: openTickets,
  };
}
