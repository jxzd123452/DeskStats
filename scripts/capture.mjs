import { mkdir } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const base = process.env.DESKSTATS_URL ?? "http://127.0.0.1:1420";
const outDir = path.resolve("docs");
await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1"],
  defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
});

async function shoot(name, query) {
  const page = await browser.newPage();
  await page.goto(`${base}/?${query}`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1");
  await page.evaluate(() => document.fonts.ready);
  await new Promise((resolve) => setTimeout(resolve, 400));
  await page.screenshot({ path: path.join(outDir, name), type: "png" });
  await page.close();
  console.log("wrote", name);
}

await shoot("overview-dark.png", "shot=1&theme=dark&lang=en&page=overview&tick=72");
await shoot("overview-light.png", "shot=1&theme=light&lang=en&page=overview&tick=72");
await shoot("processes.png", "shot=1&theme=dark&lang=en&page=processes&tick=72");
await shoot("cpu-detail.png", "shot=1&theme=dark&lang=en&page=cpu&tick=72");
await shoot("overview-dark-zh.png", "shot=1&theme=dark&lang=zh&page=overview&tick=72");

const gifPage = await browser.newPage();
await gifPage.goto(`${base}/?theme=dark&lang=en&page=overview&interval=500&tick=60`, {
  waitUntil: "networkidle0",
});
await gifPage.waitForFunction(() => document.documentElement.dataset.ready === "1");
await gifPage.evaluate(() => document.fonts.ready);
const frameDir = "/tmp/deskstats-frames";
await mkdir(frameDir, { recursive: true });
for (let i = 0; i < 24; i += 1) {
  await gifPage.screenshot({ path: path.join(frameDir, `frame-${String(i).padStart(2, "0")}.png`) });
  await new Promise((resolve) => setTimeout(resolve, 160));
}
await browser.close();
console.log("frames ready");
