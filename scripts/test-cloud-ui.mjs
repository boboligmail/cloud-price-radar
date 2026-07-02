import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright-core";

const port = Number(process.env.CLOUD_UI_TEST_PORT || 3299);
const baseUrl = `http://127.0.0.1:${port}`;
const evidenceDir = ".omo/evidence/cloud-price-radar";

mkdirSync(evidenceDir, { recursive: true });

const server = spawn(process.platform === "win32" ? "cmd.exe" : "npm", serverArgs(), {
  cwd: process.cwd(),
  detached: process.platform !== "win32",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += String(chunk);
});
server.stderr.on("data", (chunk) => {
  serverOutput += String(chunk);
});

try {
  await waitForServer(baseUrl);
  await runBrowserChecks();
  console.log(`cloud UI checks passed: ${baseUrl}`);
} finally {
  await stopServer(server.pid);
}

function serverArgs() {
  if (process.platform === "win32") return ["/d", "/s", "/c", `npm run start -- -p ${port}`];
  return ["run", "start", "--", "-p", String(port)];
}

async function runBrowserChecks() {
  const browser = await chromium.launch(browserLaunchOptions());
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/#vps`, { waitUntil: "load" });
    await assertVpsPage(page);
    await page.screenshot({ path: `${evidenceDir}/vps-desktop.png`, fullPage: true });

    await page.getByRole("tab", { name: /GPU 租赁/ }).click();
    await assertGpuPage(page);
    await page.screenshot({ path: `${evidenceDir}/gpu-desktop.png`, fullPage: true });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(`${baseUrl}/#gpu`, { waitUntil: "load" });
    await assertMobilePage(mobile);
    await mobile.screenshot({ path: `${evidenceDir}/gpu-mobile.png`, fullPage: true });
  } finally {
    await browser.close();
  }
}

async function assertVpsPage(page) {
  const bodyText = await page.locator("body").innerText();
  const headerText = await page.locator("header").innerText();
  assert(bodyText.includes("VPS 云服务器价格筛选"), "VPS hero title must match target copy");
  assert(bodyText.includes("按 CPU、内存、硬盘、地区和计费方式筛选，直接去官网核验。"), "VPS subtitle must match target copy");
  assert(headerText.includes("VPS 比价") && headerText.includes("GPU 租赁"), "header must expose VPS/GPU nav");
  assert(headerText.includes("最近更新时间："), "header must show recent update time");
  await assertHeaderContentAlignment(page);
  assert(!/卡网订阅|官网订阅|官方 API|中转 API|数据源|更新记录/.test(headerText), "header must not expose old ai-home navigation");
  assert(!bodyText.includes("当前筛选结果"), "right-side summary panel must not render");
  assert(!bodyText.includes("核验/进入"), "old official button copy must not render");
  assert(!bodyText.includes("商家 / CPU / 地区"), "search box placeholder must not render");
  assert(!bodyText.includes("CompareVPS"), "provider source label must not render");
  assert(!bodyText.includes("GB RAM"), "memory cells must not render GB RAM");
  assert(!bodyText.includes("Unknown"), "unknown CPU vendor must be localized");
  assert(!bodyText.includes("IPv4 included"), "network cells must not render IPv4 included noise");
  assert((await page.locator("fieldset").count()) === 0, "filter panel must use select/input controls, not segmented fieldsets");
  assert(await page.locator("th", { hasText: "CPU" }).count(), "VPS table must include CPU");
  assert(await page.locator("th", { hasText: "流量" }).count(), "VPS table must include traffic column");
  assert(await page.locator("th", { hasText: "带宽" }).count(), "VPS table must include bandwidth column");
  assert((await page.locator("th", { hasText: "流量/带宽" }).count()) === 0, "VPS table must not keep combined network column");
  assert((await page.locator("th", { hasText: "型号" }).count()) === 0, "VPS table must not include 型号 column");
  assert(bodyText.includes("官网直达"), "official button copy must be 官网直达");
  assert((await page.locator(".providerLogo").count()) > 0, "provider logo must render before provider names");

  await page.locator("label").filter({ hasText: "CPU 核数" }).locator("select").selectOption("2");
  await page.getByRole("button", { name: /筛选/ }).click();
  const rows = await tableRows(page);
  assert(rows.length > 0, "VPS CPU filter must keep visible rows");
  for (const row of rows) {
    assert(parseFirstNumber(row.cells[2]) >= 2, `VPS CPU filter leaked row: ${row.text}`);
    assert(!row.cells[5].includes("1 IPv4"), `VPS traffic column must not include IP address text: ${row.text}`);
    assert(/Gbps|未列出/.test(row.cells[6]), `VPS bandwidth column must show bandwidth only: ${row.text}`);
    assert(!row.cells[7].includes("United States"), `VPS region must be localized: ${row.text}`);
  }
  assertCompactBillingRows(rows, 8, "VPS");
}

async function assertHeaderContentAlignment(page) {
  const positions = await page.evaluate(() => {
    const brand = document.querySelector(".brand")?.getBoundingClientRect();
    const hero = document.querySelector(".hero")?.getBoundingClientRect();
    const filterPanel = document.querySelector(".filterPanel")?.getBoundingClientRect();
    return {
      brandLeft: brand?.left ?? null,
      heroLeft: hero?.left ?? null,
      filterLeft: filterPanel?.left ?? null,
    };
  });

  assert(positions.brandLeft !== null && positions.heroLeft !== null && positions.filterLeft !== null, "layout alignment targets must render");
  assert(Math.abs(positions.brandLeft - positions.heroLeft) <= 2, `header brand must align with hero: ${JSON.stringify(positions)}`);
  assert(Math.abs(positions.brandLeft - positions.filterLeft) <= 2, `header brand must align with filter panel: ${JSON.stringify(positions)}`);
}

async function assertGpuPage(page) {
  const bodyText = await page.locator("body").innerText();
  assert(bodyText.includes("GPU 算力租赁价格筛选"), "GPU hero title must match target copy");
  assert(bodyText.includes("按型号、显存、GPU 数量、地区和小时价筛选，直接去官网核验。"), "GPU subtitle must match target copy");
  assert(await page.locator("th", { hasText: "型号" }).count(), "GPU table must include model column");
  assert(await page.locator("th", { hasText: "显存" }).count(), "GPU table must include VRAM column");
  assert(!bodyText.includes("当前筛选结果"), "GPU page must not render right-side summary panel");
  assert(bodyText.includes("官网直达"), "GPU official button copy must be 官网直达");

  const gpuModelSelect = page.locator("label").filter({ hasText: "GPU 型号" }).locator("select");
  const gpuModelOptions = await gpuModelSelect.locator("option").allTextContents();
  assert(gpuModelOptions.some((text) => /RTX 3090|RTX 4090|A100|H100/.test(text)), "GPU model filter must expose real model options");
  const selectable = gpuModelOptions.find((text) => /RTX 3090|A100|H100/.test(text));
  if (selectable) {
    await gpuModelSelect.selectOption({ label: selectable });
    await page.getByRole("button", { name: /筛选/ }).click();
    const model = selectable.replace(/\s\(\d+\)$/, "");
    const rows = await tableRows(page);
    assert(rows.length > 0, "GPU model filter must keep visible rows");
    for (const row of rows) {
      assert(row.cells[2].includes(model), `GPU model filter leaked row: ${row.text}`);
    }
    assertCompactBillingRows(rows, 7, "GPU model");
  }

  await page.getByRole("button", { name: /重置/ }).click();
  const v100Option = gpuModelOptions.find((text) => /V100/.test(text));
  if (v100Option) {
    await gpuModelSelect.selectOption({ label: v100Option });
    await page.getByRole("button", { name: /筛选/ }).click();
    const rows = await tableRows(page);
    assert(rows.length > 0, "GPU V100 filter must keep visible rows");
    assertCompactBillingRows(rows, 7, "GPU V100");
  }

  await page.getByRole("button", { name: /重置/ }).click();
  await page.locator("label").filter({ hasText: "计费方式" }).locator("select").selectOption("spot");
  await page.getByRole("button", { name: /筛选/ }).click();
  const spotRows = await tableRows(page);
  assert(spotRows.length > 0, "GPU spot filter must keep visible rows");
  for (const row of spotRows) {
    assert(row.cells[7].includes("抢占式"), `GPU spot filter leaked billing row: ${row.text}`);
    assert(row.cells[9] === "抢占中断", `GPU spot risk label must be 抢占中断: ${row.text}`);
  }
  assertCompactBillingRows(spotRows, 7, "GPU spot");

  await page.getByRole("button", { name: /重置/ }).click();
  await page.locator("label").filter({ hasText: "地区" }).locator("select").selectOption("us");
  await page.getByRole("button", { name: /筛选/ }).click();
  const usRows = await tableRows(page);
  assert(usRows.length > 0, "GPU US region filter must keep visible rows");
  for (const row of usRows) {
    assert(row.regionGroups.split(/\s+/).includes("us"), `GPU US region filter leaked row: ${row.text}`);
    assert(!row.cells[6].includes("United States"), `GPU region must be localized: ${row.text}`);
  }

  const nextButton = page.getByRole("button", { name: "下一页" });
  if (await nextButton.isEnabled()) {
    await nextButton.click();
    assert((await page.locator("body").innerText()).includes("当前第 2 /"), "pagination must move forward");
  }
}

function assertCompactBillingRows(rows, billingIndex, label) {
  for (const row of rows) {
    const billing = row.cells[billingIndex] ?? "";
    assert(!/(?:month|year|week|day|minute|second|hour|reserved|ondemand|spot)/i.test(billing), `${label} billing must be localized: ${row.text}`);
    assert(!billing.includes("月付"), `${label} billing must use compact month copy: ${row.text}`);
    assert(!billing.includes("年合约"), `${label} billing must use compact year copy: ${row.text}`);
    assert(!billing.startsWith("月付；"), `${label} billing must not keep leading 月付: ${row.text}`);
  }
}

async function assertMobilePage(page) {
  const bodyText = await page.locator("body").innerText();
  const headerText = await page.locator("header").innerText();
  assert(headerText.includes("最近更新时间："), "mobile header must show update time");
  assert(!/卡网订阅|官网订阅|官方 API|中转 API|数据源|更新记录/.test(headerText), "mobile header must be cloud-only");
  assert(bodyText.includes("GPU 租赁"), "mobile page must expose GPU tab");
  assert(bodyText.includes("官网直达"), "mobile rows must expose official direct links");
}

async function waitForServer(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await delay(500);
    }
  }
  throw new Error(`cloud UI server did not become ready. Output:\n${serverOutput}`);
}

async function stopServer(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
      killer.on("exit", resolve);
      killer.on("error", resolve);
    });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    process.kill(pid, "SIGTERM");
  }
}

function browserLaunchOptions() {
  const executablePath = findBrowserExecutable();
  if (executablePath) return { executablePath, headless: true };
  return { channel: "chrome", headless: true };
}

function findBrowserExecutable() {
  const candidates =
    process.platform === "win32"
      ? [
          "C:/Program Files/Google/Chrome/Application/chrome.exe",
          "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
          "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
          "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        ]
      : [
          "/usr/bin/google-chrome-stable",
          "/usr/bin/google-chrome",
          "/usr/bin/chromium-browser",
          "/usr/bin/chromium",
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ];

  return candidates.find((candidate) => existsSync(candidate));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function tableRows(page) {
  return page.locator("tbody tr").evaluateAll((rows) =>
    rows.map((row) => ({
      text: row.textContent?.replace(/\s+/g, " ").trim() ?? "",
      regionGroups: row.getAttribute("data-region-groups") ?? "",
      cells: [...row.querySelectorAll("td")].map((cell) => cell.textContent?.replace(/\s+/g, " ").trim() ?? ""),
    })),
  );
}

function parseFirstNumber(value) {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}
