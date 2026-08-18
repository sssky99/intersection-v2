import type { CapacitorConfig } from "@capacitor/cli";

const hostedAppUrl = "https://interv2.netlify.app";
const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim() || hostedAppUrl;
const isLocalDevelopment = serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "com.gyojiphap.app",
  appName: "교집합",
  webDir: "capacitor-web",
  server: {
    // Alpha builds use the existing Next.js server. Set CAPACITOR_SERVER_URL to
    // a LAN URL when testing uncommitted local changes on an emulator or device.
    url: serverUrl,
    cleartext: isLocalDevelopment,
    errorPath: "offline.html",
    allowNavigation: [
      new URL(serverUrl).hostname,
      "hvyrhwhxbtsgrgodgzms.supabase.co",
    ],
  },
  android: {
    backgroundColor: "#f8f6f1",
    allowMixedContent: isLocalDevelopment,
    appendUserAgent: " GyojiphapAndroid/0.1",
  },
};

export default config;
