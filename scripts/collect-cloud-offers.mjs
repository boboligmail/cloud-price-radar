#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const today = new Date().toISOString().slice(0, 10);
const generatedAt = new Date().toISOString();
const compareVpsUrl = "https://www.comparevps.com/";
const cloudGpusUrl = "https://cloud-gpus.com/";

const trackedSources = [
  { id: "serverhunter", name: "ServerHunter", url: "https://www.serverhunter.com/" },
  { id: "vpsbenchmarks", name: "VPSBenchmarks", url: "https://www.vpsbenchmarks.com/" },
  { id: "comparevps", name: "CompareVPS", url: compareVpsUrl },
  { id: "getdeploying-vps", name: "GetDeploying VPS Prices", url: "https://getdeploying.com/reference/compute-prices" },
  { id: "getdeploying-gpu", name: "GetDeploying GPU Prices", url: "https://getdeploying.com/gpus" },
  { id: "cloud-gpus", name: "cloud-gpus.com", url: cloudGpusUrl },
  { id: "altstreet", name: "AltStreet GPU Price Comparison", url: "https://altstreet.investments/gpu/" },
];

const headers = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 cloud-price-radar-collector/1.0",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

await mkdir(dataDir, { recursive: true });

const sourceStates = new Map(trackedSources.map((source) => [source.id, { ...source, status: "pending", rows: 0, note: "" }]));
const offers = [];

await collectCompareVps();
await collectCloudGpus();
await probeUnparsedSources();

const sortedOffers = [...offers].sort(compareCloudOffers);
const vpsOffers = offers
  .filter((offer) => offer.kind === "vps")
  .sort((left, right) => left.monthlyEstimateUsd - right.monthlyEstimateUsd)
  .slice(0, 15);
const gpuOffers = offers
  .filter((offer) => offer.kind === "gpu")
  .sort((left, right) => left.priceUsd - right.priceUsd)
  .slice(0, 15);

const highlightOffers = [...vpsOffers, ...gpuOffers];

const databasePayload = {
  generatedAt,
  updatedAt: today,
  selection:
    `全量入库：本次从可公开解析的数据源采集 ${offers.length} 条云资源报价，页面默认全量展示，低价结果只作为排序和高亮参考。`,
  sources: [...sourceStates.values()],
  offers: sortedOffers,
  highlightOfferIds: highlightOffers.map((offer) => offer.id),
};

const pagePayload = {
  generatedAt,
  updatedAt: today,
  selection: databasePayload.selection,
  sourceSummary: databasePayload.sources,
  offers: sortedOffers,
};

await writeFile(path.join(dataDir, "cloud-offers-db.json"), `${JSON.stringify(databasePayload, null, 2)}\n`, "utf8");
await writeFile(path.join(dataDir, "cloud-offers.json"), `${JSON.stringify(pagePayload, null, 2)}\n`, "utf8");
await writeUpdateRecords(databasePayload);
await writeSqlite(databasePayload);

console.log(
  [
    "cloud offers collected",
    `all=${offers.length}`,
    `vps=${offers.filter((offer) => offer.kind === "vps").length}`,
    `gpu=${offers.filter((offer) => offer.kind === "gpu").length}`,
    `page=${sortedOffers.length}`,
  ].join(" "),
);

async function collectCompareVps() {
  const source = sourceStates.get("comparevps");
  try {
    const html = await fetchText(compareVpsUrl);
    const scriptPath = extractCompareVpsScript(html);
    const scriptUrl = new URL(scriptPath, compareVpsUrl).href;
    const script = await fetchText(scriptUrl);
    const providers = extractJsonParseVariable(script, "ui");
    const plans = extractJsonParseVariable(script, "mi");
    const providerById = new Map(providers.map((provider) => [provider.id, provider]));
    const normalized = plans
      .filter((plan) => plan.visible !== false)
      .filter((plan) => plan.server_type === "vps" || plan.server_type === "vds" || plan.server_type === "cloud")
      .map((plan) => normalizeCompareVpsPlan(plan, providerById.get(plan.provider_id)))
      .filter(Boolean);

    offers.push(...normalized);
    source.status = "parsed";
    source.rows = normalized.length;
    source.note = `已解析前端静态数据包，原始 plans=${plans.length}，页面使用可见 VPS/VDS/Cloud 行。`;
  } catch (error) {
    source.status = "failed";
    source.note = getErrorMessage(error);
  }
}

async function collectCloudGpus() {
  const source = sourceStates.get("cloud-gpus");
  try {
    const html = await fetchText(cloudGpusUrl);
    const rows = decodeCloudGpusRows(html);
    const normalized = rows.map(normalizeCloudGpuRow).filter(Boolean);

    offers.push(...normalized);
    source.status = "parsed";
    source.rows = normalized.length;
    source.note = "已解析页面 data-gpus 打包数据。";
  } catch (error) {
    source.status = "failed";
    source.note = getErrorMessage(error);
  }
}

async function probeUnparsedSources() {
  const ids = ["serverhunter", "vpsbenchmarks", "getdeploying-vps", "getdeploying-gpu", "altstreet"];
  for (const id of ids) {
    const source = sourceStates.get(id);
    try {
      const html = await fetchText(source.url);
      if (isChallengePage(html)) {
        source.status = "blocked";
        source.note = "机器抓取拿到挑战页或安全校验页，本次未绕过。";
      } else {
        source.status = "metadata_only";
        source.note = "页面可访问，但本次未实现稳定行级解析。";
      }
    } catch (error) {
      source.status = "failed";
      source.note = getErrorMessage(error);
    }
  }
}

function normalizeCompareVpsPlan(plan, provider) {
  if (!provider) return null;

  const monthlyEstimateUsd = estimateMonthlyUsd(plan);
  if (!Number.isFinite(monthlyEstimateUsd) || monthlyEstimateUsd <= 0) return null;

  const serverType = plan.server_type === "vds" ? "VDS" : "VPS";
  const productName = String(plan.name).toUpperCase().startsWith(serverType) ? plan.name : `${serverType} ${plan.name}`;
  const verifyUrl = absolutizeUrl(
    provider.affiliate_url_vps || provider.affiliate_url || provider.website || `/visit/${provider.slug}-vps`,
    compareVpsUrl,
  );
  const sourceUrl = `https://www.comparevps.com/hosting/${provider.slug}`;
  const bandwidth = plan.bandwidth_gb === "UNLIMITED" ? "不限量" : `${plan.bandwidth_gb} GB/月`;
  const port = plan.port_speed ? `${plan.port_speed} Gbps` : "端口速度未列出";
  const dedicatedIp = plan.dedicated_ip ? `；${plan.dedicated_ip}` : "";
  const setupFee = plan.setup_fee ? `；开通费 $${plan.setup_fee}` : "";
  const priceText = `${formatMoney(plan.currency, monthlyEstimateUsd)}/月`;

  return {
    id: `comparevps-${slugify(provider.slug)}-${slugify(plan.slug)}`,
    kind: "vps",
    provider: provider.name,
    product: productName,
    priceUsd: round(monthlyEstimateUsd),
    monthlyEstimateUsd: round(monthlyEstimateUsd),
    priceText,
    billing: buildCompareVpsBilling(plan),
    compute: `${plan.vcpu} vCPU${plan.cpu_vendor ? ` / ${plan.cpu_vendor}` : ""}`,
    memory: `${formatNumber(plan.ram_gb)} GB RAM`,
    storage: `${formatNumber(plan.storage_gb)} GB${plan.storage_type ? ` ${plan.storage_type}` : ""}`,
    network: `${bandwidth}；${port}${dedicatedIp}`,
    region: Array.isArray(plan.locations) ? plan.locations.slice(0, 4).join(" / ") : "地区未列出",
    risk: `下单前核验续费、IPv4、备份、地区库存和税费${setupFee}。`,
    sourceName: "CompareVPS",
    sourceUrl,
    verifyUrl,
    sourceType: "aggregator",
    lastChecked: today,
  };
}

function normalizeCloudGpuRow(row, index) {
  const priceUsd = parseMoney(row.price_per_hour_usd_currency);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

  const acceleratorCount = parseAcceleratorCount(row);
  const model = String(row.accelerator_model || row.accelerator_model_group || "GPU");
  const totalMemory = Number(row.total_accelerator_memory_gb) || Number(row.accelerator_vram_gb) * acceleratorCount;
  const countries = Array.isArray(row.countries) ? row.countries.slice(0, 6).join(" / ") : "地区未列出";
  const commitment = row.commitment ? String(row.commitment) : "hour";
  const provisioning = row.provisioning ? String(row.provisioning) : String(row.provisioning_model || "market");
  const summary = row.summary ? String(row.summary) : `${acceleratorCount}x ${model}`;

  return {
    id: `cloud-gpus-${slugify(row.provider)}-${slugify(row.accelerator_id || model)}-${index}`,
    kind: "gpu",
    provider: String(row.provider || "Unknown"),
    product: `${summary} / ${provisioning}`,
    priceUsd: round(priceUsd),
    monthlyEstimateUsd: round(priceUsd * 730),
    priceText: `$${round(priceUsd).toFixed(2)}/小时`,
    billing: `${provisioning} / ${commitment}`,
    compute: `${acceleratorCount}x ${model}`,
    memory: totalMemory ? `${formatNumber(totalMemory)} GB VRAM` : "显存未列出",
    storage: row.instance_type_label ? String(row.instance_type_label) : "未列出",
    network: `${countries}；${row.include_p2p === "Yes" ? "支持 P2P" : "P2P 未标注"}`,
    region: countries,
    risk: buildGpuRisk(provisioning, commitment),
    sourceName: "cloud-gpus.com",
    sourceUrl: cloudGpusUrl,
    verifyUrl: absolutizeUrl(String(row.target_url || cloudGpusUrl), cloudGpusUrl),
    sourceType: "aggregator",
    lastChecked: today,
  };
}

function extractCompareVpsScript(html) {
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+index-[^"]+\.js)"/g)];
  const script = scripts.at(-1)?.[1];
  if (!script) throw new Error("CompareVPS index script not found.");
  return script;
}

function extractJsonParseVariable(script, variableName) {
  const marker = `${variableName}=JSON.parse(`;
  const start = script.indexOf(marker);
  if (start === -1) throw new Error(`${variableName} JSON.parse payload not found.`);
  const quoteStart = start + marker.length;
  const quote = script[quoteStart];
  if (quote !== "'" && quote !== "`") throw new Error(`${variableName} payload quote not recognized.`);

  let cursor = quoteStart + 1;
  let escaped = false;
  while (cursor < script.length) {
    const char = script[cursor];
    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === quote) {
      const raw = script.slice(quoteStart + 1, cursor);
      const jsonText = Function(`return ${quote}${raw}${quote}`)();
      return JSON.parse(jsonText);
    }
    cursor += 1;
  }

  throw new Error(`${variableName} payload terminator not found.`);
}

function decodeCloudGpusRows(html) {
  const match = html.match(/data-gpus="([\s\S]*?)"/);
  if (!match) throw new Error("cloud-gpus data-gpus payload not found.");

  const decoded = decodeHtml(match[1]);
  const packed = JSON.parse(decoded);
  const values = packed[0];
  const memo = new Map();

  function decodeToken(token) {
    return decodeValue(decodeBase62(token));
  }

  function decodeValue(index) {
    if (memo.has(index)) return memo.get(index);
    const raw = values[index];
    if (typeof raw !== "string") return raw;
    if (raw.startsWith("n|")) return decodePackedNumber(raw.slice(2));
    if (raw.startsWith("a|")) {
      const output = [];
      memo.set(index, output);
      for (const token of raw.slice(2).split("|").filter(Boolean)) output.push(decodeToken(token));
      return output;
    }
    if (raw.startsWith("o|")) {
      const output = {};
      memo.set(index, output);
      const parts = raw.slice(2).split("|");
      const keys = decodeToken(parts[0]);
      for (let partIndex = 1; partIndex < parts.length; partIndex += 1) {
        output[keys[partIndex - 1]] = decodeToken(parts[partIndex]);
      }
      return output;
    }
    return raw;
  }

  return values
    .map((value, index) => {
      if (typeof value !== "string" || !value.startsWith("o|Y|")) return null;
      const row = decodeValue(index);
      if (!row || typeof row !== "object" || !row.provider || !row.price_per_hour_usd_currency) return null;
      return row;
    })
    .filter(Boolean);
}

async function writeSqlite(payload) {
  const dbPath = path.join(dataDir, "cloud-offers.sqlite");
  if (existsSync(dbPath)) rmSync(dbPath);

  try {
    const sqlite = await import("node:sqlite");
    const db = new sqlite.DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        status TEXT NOT NULL,
        rows INTEGER NOT NULL,
        note TEXT NOT NULL
      );
      CREATE TABLE offers (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        provider TEXT NOT NULL,
        product TEXT NOT NULL,
        price_usd REAL NOT NULL,
        monthly_estimate_usd REAL NOT NULL,
        price_text TEXT NOT NULL,
        billing TEXT NOT NULL,
        compute TEXT NOT NULL,
        memory TEXT NOT NULL,
        storage TEXT NOT NULL,
        network TEXT NOT NULL,
        region TEXT NOT NULL,
        risk TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        verify_url TEXT NOT NULL,
        last_checked TEXT NOT NULL
      );
    `);

    const insertSource = db.prepare(
      "INSERT INTO sources (id, name, url, status, rows, note) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const source of payload.sources) {
      insertSource.run(source.id, source.name, source.url, source.status, source.rows, source.note);
    }

    const insertOffer = db.prepare(`
      INSERT INTO offers (
        id, kind, provider, product, price_usd, monthly_estimate_usd, price_text, billing,
        compute, memory, storage, network, region, risk, source_name, source_url, verify_url, last_checked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const offer of payload.offers) {
      insertOffer.run(
        offer.id,
        offer.kind,
        offer.provider,
        offer.product,
        offer.priceUsd,
        offer.monthlyEstimateUsd,
        offer.priceText,
        offer.billing,
        offer.compute,
        offer.memory,
        offer.storage,
        offer.network,
        offer.region,
        offer.risk,
        offer.sourceName,
        offer.sourceUrl,
        offer.verifyUrl,
        offer.lastChecked,
      );
    }
    db.close();
  } catch (error) {
    await writeFile(path.join(dataDir, "cloud-offers.sqlite.error.txt"), `${getErrorMessage(error)}\n`, "utf8");
  }
}

async function writeUpdateRecords(payload) {
  const historyPath = path.join(dataDir, "cloud-offer-update-records.json");
  const previousRecords = existsSync(historyPath)
    ? JSON.parse(await readFile(historyPath, "utf8")).records
    : [];
  const sources = payload.sources.reduce(
    (counts, source) => {
      if (source.status === "parsed") counts.parsed += 1;
      if (source.status === "blocked") counts.blocked += 1;
      if (source.status === "failed") counts.failed += 1;
      if (source.status === "metadata_only") counts.metadataOnly += 1;
      return counts;
    },
    { parsed: 0, blocked: 0, failed: 0, metadataOnly: 0 },
  );
  const nextRecord = {
    generatedAt: payload.generatedAt,
    updatedAt: payload.updatedAt,
    totalOffers: payload.offers.length,
    vpsOffers: payload.offers.filter((offer) => offer.kind === "vps").length,
    gpuOffers: payload.offers.filter((offer) => offer.kind === "gpu").length,
    sources,
  };
  const records = [nextRecord, ...previousRecords.filter((record) => record.generatedAt !== nextRecord.generatedAt)].slice(0, 30);
  await writeFile(historyPath, `${JSON.stringify({ records }, null, 2)}\n`, "utf8");
}

function compareCloudOffers(left, right) {
  if (left.kind !== right.kind) return left.kind === "vps" ? -1 : 1;
  if (left.kind === "vps") return left.monthlyEstimateUsd - right.monthlyEstimateUsd;
  return left.priceUsd - right.priceUsd;
}

async function fetchText(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

function estimateMonthlyUsd(plan) {
  const exchangeRateEurUsd = 1.1;
  const currencyMultiplier = plan.currency === "EUR" ? exchangeRateEurUsd : 1;
  if (Array.isArray(plan.pricing_options) && plan.pricing_options.length > 0) {
    const monthlyValues = plan.pricing_options.map((option) => {
      const optionMultiplier = option.currency === "EUR" ? exchangeRateEurUsd : 1;
      if (option.type === "hourly") return Number(option.pricePerUnit) * 730 * optionMultiplier;
      if (option.type === "yearly") return (Number(option.pricePerUnit) / (Number(option.quantity) || 1) / 12) * optionMultiplier;
      return (Number(option.pricePerUnit) / (Number(option.quantity) || 1)) * optionMultiplier;
    });
    return Math.min(...monthlyValues.filter(Number.isFinite));
  }
  if (plan.billing_cycle === "hourly") return Number(plan.price) * 730 * currencyMultiplier;
  if (plan.billing_cycle === "yearly") return (Number(plan.price) / 12) * currencyMultiplier;
  return Number(plan.price) * currencyMultiplier;
}

function buildCompareVpsBilling(plan) {
  const cycle = plan.billing_cycle === "hourly" ? "小时计费折算月价" : "月付";
  if (!Array.isArray(plan.pricing_options) || plan.pricing_options.length === 0) return cycle;
  const options = plan.pricing_options.map((option) => {
    if (option.type === "hourly") return `$${option.pricePerUnit}/小时`;
    if (option.type === "yearly") return `${option.quantity} 年合约`;
    return `${option.quantity} 月付`;
  });
  return `${cycle}；${options.join(" / ")}`;
}

function decodePackedNumber(value) {
  try {
    if (!value.includes(".")) return decodeBase62(value);
    const [whole, decimal] = value.split(".");
    return Number(`${decodeBase62(whole)}.${decodeBase62(decimal)}`);
  } catch {
    return value;
  }
}

function decodeBase62(value) {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = 0;
  for (const char of value) {
    const digit = alphabet.indexOf(char);
    if (digit === -1) throw new Error(`invalid base62 digit ${char}`);
    result = result * alphabet.length + digit;
  }
  return result;
}

function parseAcceleratorCount(row) {
  const floatValue = Number(row.num_accelerators_float);
  if (Number.isFinite(floatValue) && floatValue > 0) return floatValue;

  const numerator = Number(row.num_accelerators_numerator);
  const denominator = Number(row.num_accelerators_denominator);
  if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) return numerator / denominator;
  if (Number.isFinite(numerator) && numerator > 0) return numerator;

  return 1;
}

function buildGpuRisk(provisioning, commitment) {
  const billing = `${provisioning} ${commitment}`.toLowerCase();
  if (/spot|preempt|interrupt/.test(billing)) return "抢占式价格，可能中断；下单前核验库存、地区和附加费用。";
  if (/reserved|year|month|week|day/.test(billing)) return "承诺期价格；下单前核验期限、库存、地区和附加费用。";
  return "按需价格；下单前核验库存、地区和附加费用。";
}

function parseMoney(value) {
  return Number(String(value).replace(/[^0-9.]/g, ""));
}

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return Number.isInteger(number) ? String(number) : String(round(number));
}

function formatMoney(currency, value) {
  const prefix = currency === "EUR" ? "€" : "$";
  return `${prefix}${round(value).toFixed(2)}`;
}

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function absolutizeUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return baseUrl;
  }
}

function slugify(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isChallengePage(html) {
  const lower = html.toLowerCase();
  return lower.includes("just a moment") || lower.includes("cf-challenge") || lower.includes("challenge-platform");
}

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
