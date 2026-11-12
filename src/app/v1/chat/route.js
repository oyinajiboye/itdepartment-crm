import { NextResponse } from "next/server";
import { loadStore, saveStore } from "../../../lib/crmServerStore";

const FIX_CATALOG = [
  {
    id: "fix_internet",
    title: "Complete 'No Internet' Auto-Repair (Step-by-Step)",
    description:
      "Switches on disabled Wi-Fi/network adapters, restarts wireless services, turns off stuck proxies, renews IP, and flushes DNS.",
    keywords: [
      "no internet",
      "internet not working",
      "cannot connect",
      "offline",
      "network error",
      "net no dey work",
      "wifi connected but no internet",
    ],
  },
  {
    id: "wifi_repair",
    title: "Switch On & Restart Wi-Fi Adapter / Driver",
    description:
      "Starts the Windows WLAN service, switches on the Wi-Fi adapter if disabled, and restarts the wireless driver.",
    keywords: [
      "wifi",
      "wi-fi",
      "wireless",
      "not seeing wifi",
      "wifi missing",
      "wifi disappeared",
      "wifi off",
    ],
  },
  {
    id: "flush_dns",
    title: "Refresh Website Address Cache (Flush DNS)",
    description: "Clears and re-registers the Windows DNS cache.",
    keywords: ["dns", "website not opening", "site not loading", "nxdomain"],
  },
  {
    id: "renew_ip",
    title: "Renew IP Address (Fix 'Unidentified Network')",
    description:
      "Releases and renews your computer's IP address from the router (DHCP).",
    keywords: ["unidentified network", "valid ip", "renew ip", "dhcp", "169.254"],
  },
  {
    id: "disable_proxy",
    title: "Turn Off Stuck Proxy / VPN Block",
    description: "Turns off a stuck Windows proxy setting that blocks websites.",
    keywords: ["proxy", "vpn broke internet", "err_proxy"],
  },
  {
    id: "print_spooler",
    title: "Fix Stuck Printer & Clear Print Queue",
    description:
      "Restarts the Windows Print Spooler service and clears stuck print jobs.",
    keywords: ["printer", "printing", "print queue", "spooler", "cannot print"],
  },
  {
    id: "scanner_fix",
    title: "Fix Office Scanner Not Scanning (Restart WIA)",
    description: "Restarts the Windows Image Acquisition (WIA) service.",
    keywords: ["scanner", "scan", "cannot scan", "wia"],
  },
  {
    id: "usb_rescan",
    title: "Fix Unrecognized USB Flash Drive, Mouse or Keyboard",
    description: "Scans for hardware changes across all USB ports.",
    keywords: ["usb", "flash drive", "pen drive", "mouse not working"],
  },
  {
    id: "bluetooth_fix",
    title: "Restart Bluetooth Service & Adapter",
    description: "Restarts the Windows Bluetooth support service.",
    keywords: ["bluetooth", "airpods", "wireless mouse", "cannot pair"],
  },
  {
    id: "audio_fix",
    title: "Fix 'No Sound' / Silent Speakers or Headphones",
    description: "Restarts Windows Audio and Audio Endpoint services.",
    keywords: ["no sound", "sound not working", "audio", "speaker", "cannot hear"],
  },
  {
    id: "mic_camera_fix",
    title: "Fix Microphone or Webcam Not Working",
    description:
      "Restarts Camera Frame Server and opens Microphone Privacy settings.",
    keywords: ["microphone", "mic", "camera", "webcam", "cannot hear me"],
  },
  {
    id: "teams_zoom_fix",
    title: "Fix Frozen Microsoft Teams or Zoom & Clear Cache",
    description: "Closes stuck Teams/Zoom processes and clears call cache.",
    keywords: ["teams", "zoom", "google meet", "meeting stuck"],
  },
  {
    id: "display_fix",
    title: "Detect Second Monitor / Projector (Display Switch)",
    description: "Forces Windows to re-detect external HDMI/VGA monitors.",
    keywords: ["projector", "second monitor", "hdmi", "extend screen"],
  },
  {
    id: "clear_temp",
    title: "Free Up Disk Space (Clean Temporary Files)",
    description: "Safely deletes temporary files in your user temp folder.",
    keywords: ["disk full", "storage full", "no space", "c drive full", "temp"],
  },
  {
    id: "empty_recycle_bin",
    title: "Empty Recycle Bin to Recover Storage",
    description: "Empties the Recycle Bin to reclaim disk space.",
    keywords: ["recycle bin", "empty trash", "trash full"],
  },
  {
    id: "top_memory",
    title: "Find Heavy Programs Making the Laptop Slow",
    description: "Lists the top memory-consuming programs running right now.",
    keywords: ["slow", "lagging", "hanging", "high ram", "system dey hang"],
  },
  {
    id: "restart_explorer",
    title: "Restart Frozen Taskbar, Start Menu or Desktop",
    description: "Restarts Windows Explorer cleanly.",
    keywords: ["taskbar frozen", "start menu", "desktop frozen", "icons missing"],
  },
  {
    id: "close_hung_office",
    title: "Close Frozen 'Not Responding' Apps (Excel, Word, Outlook)",
    description: "Safely closes any program stuck in 'Not Responding' state.",
    keywords: ["not responding", "excel frozen", "word frozen", "outlook frozen"],
  },
  {
    id: "onedrive_reset",
    title: "Fix OneDrive / SharePoint Files Not Syncing",
    description: "Resets and restarts the Microsoft OneDrive sync engine.",
    keywords: ["onedrive", "sharepoint", "sync pending", "files not syncing"],
  },
  {
    id: "browser_fix",
    title: "Fix Chrome or Edge Spinning / Clear Safe Web Cache",
    description: "Clears temporary browser cache (keeps passwords safe).",
    keywords: ["chrome", "edge", "browser slow", "webpage spinning"],
  },
  {
    id: "fix_clock_ssl",
    title: "Fix Wrong Date & Time ('Your Clock is Behind' Error)",
    description: "Synchronizes the Windows system clock with internet time.",
    keywords: ["clock is behind", "wrong time", "ssl error", "certificate error"],
  },
  {
    id: "windows_update_reset",
    title: "Fix Stuck or Failing Windows Update",
    description: "Resets stuck Windows Update services and cache.",
    keywords: ["windows update", "update stuck", "update failed"],
  },
  {
    id: "keyboard_keys_fix",
    title: "Fix Keyboard Typing Weirdly (Turn Off Sticky/Filter Keys)",
    description: "Turns off Sticky Keys and Filter Keys traps.",
    keywords: ["sticky keys", "filter keys", "keyboard beeping", "keyboard not typing"],
  },
  {
    id: "power_battery_fix",
    title: "Check Battery Health & Restore Balanced Power Plan",
    description: "Restores Balanced Power Plan and checks battery charge.",
    keywords: ["battery", "power plan", "not charging", "draining fast"],
  },
  {
    id: "defender_quick_scan",
    title: "Run Quick Virus & Malware Scan (Windows Defender)",
    description: "Runs an immediate Windows Defender quick scan.",
    keywords: ["virus", "malware", "defender", "trojan", "antivirus"],
  },
  {
    id: "system_info",
    title: "Show Full Computer Specs, Disk Health & Uptime",
    description: "Displays Windows version, RAM, disk health, and uptime.",
    keywords: ["system info", "specs", "computer details", "disk health"],
  },
];

export async function POST(request) {
  const body = await request.json();
  const msg = (body.message || "").toLowerCase();

  if (body.device_id && body.company_code) {
    try {
      const state = await loadStore();
      const idx = state.devices.findIndex(
        (d) => d.device_id === body.device_id
      );
      if (idx >= 0) {
        state.devices[idx].last_seen = new Date().toISOString();
        if (body.sysinfo) state.devices[idx].sysinfo = body.sysinfo;
        await saveStore(state);
      }
    } catch {}
  }

  for (const fix of FIX_CATALOG) {
    if (fix.keywords.some((kw) => msg.includes(kw))) {
      return NextResponse.json({
        reply: `I recommend running: ${fix.title}. ${fix.description}`,
        fix_id: fix.id,
        needs_technician: false,
      });
    }
  }

  return NextResponse.json({
    reply:
      "I could not match that to a safe automated fix. You can browse all 30 built-in fixes above or click 'Escalate to Assigned IT Manager' so your engineer can assist you via RustDesk.",
    fix_id: null,
    needs_technician: true,
  });
}

