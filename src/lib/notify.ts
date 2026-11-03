import { isTauri } from "./settings";

let asked = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
    if (await isPermissionGranted()) return true;
    if (asked) return false;
    asked = true;
    const permission = await requestPermission();
    return permission === "granted";
  } catch {
    return false;
  }
}

export async function notifyNative(title: string, body: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    const { sendNotification } = await import("@tauri-apps/plugin-notification");
    sendNotification({ title, body });
  } catch {
    /* notification host missing */
  }
}
