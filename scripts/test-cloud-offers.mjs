import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dataPath = join(root, "data", "cloud-offers-db.json");
const appPath = join(root, "src", "components", "CloudPriceApp.tsx");
const tablePath = join(root, "src", "components", "CloudPriceTable.tsx");
const formatterPath = join(root, "src", "lib", "cloud-offer-formatters.ts");
const filterPath = join(root, "src", "lib", "cloud-offer-filters.ts");

const payload = JSON.parse(readFileSync(dataPath, "utf8"));
const appSource = readFileSync(appPath, "utf8");
const tableSource = readFileSync(tablePath, "utf8");
const formatterSource = readFileSync(formatterPath, "utf8");
const filterSource = readFileSync(filterPath, "utf8");
const combinedSource = `${appSource}\n${tableSource}\n${formatterSource}\n${filterSource}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(Array.isArray(payload.offers), "cloud-offers-db.json must expose an offers array");
assert(payload.offers.length >= 500, `expected full offer database, got ${payload.offers.length}`);

const vpsOffers = payload.offers.filter((offer) => offer.kind === "vps");
const gpuOffers = payload.offers.filter((offer) => offer.kind === "gpu");
assert(vpsOffers.length >= 100, `expected at least 100 VPS offers, got ${vpsOffers.length}`);
assert(gpuOffers.length >= 100, `expected at least 100 GPU offers, got ${gpuOffers.length}`);

for (const offer of payload.offers) {
  assert(typeof offer.id === "string" && offer.id.length > 0, "offer id is required");
  assert(offer.kind === "vps" || offer.kind === "gpu", `invalid kind for ${offer.id}`);
  assert(typeof offer.provider === "string" && offer.provider.length > 0, `provider missing for ${offer.id}`);
  assert(typeof offer.priceText === "string" && offer.priceText.length > 0, `priceText missing for ${offer.id}`);
  assert(typeof offer.verifyUrl === "string" && offer.verifyUrl.startsWith("https://"), `verifyUrl missing for ${offer.id}`);
}

assert(gpuOffers.some((offer) => /spot/i.test(offer.billing)), "GPU dataset must include spot rows for risk coverage");
assert(gpuOffers.some((offer) => /reserved/i.test(offer.billing)), "GPU dataset must include reserved rows for risk coverage");
assert(gpuOffers.some((offer) => /ondemand/i.test(offer.billing)), "GPU dataset must include ondemand rows for risk coverage");
for (const offer of gpuOffers) {
  const billing = offer.billing.toLowerCase();
  if (billing.includes("spot")) assert(offer.risk.includes("抢占式"), `spot GPU risk must mention 抢占式: ${offer.id}`);
  if (billing.includes("reserved")) assert(offer.risk.includes("承诺期"), `reserved GPU risk must mention 承诺期: ${offer.id}`);
  if (billing.includes("ondemand")) assert(offer.risk.includes("按需"), `ondemand GPU risk must mention 按需: ${offer.id}`);
}

const forbiddenText = ["卡网订阅", "官网订阅", "官方 API", "中转 API", "当前筛选结果", "核验/进入", ">搜索<", "SearchBox", "searchControl"];
for (const text of forbiddenText) {
  assert(!combinedSource.includes(text), `standalone cloud UI must not include ${text}`);
}

const requiredVpsHeaders = ["商家", "CPU", "内存", "硬盘", "流量/带宽", "地区", "计费", "价格", "风险", "官网"];
for (const header of requiredVpsHeaders) {
  assert(tableSource.includes(`>${header}<`), `VPS table must include ${header}`);
}
assert(!tableSource.includes(">产品/机型<"), "VPS table must not include product/model column");
assert(!tableSource.includes(">配置明细<"), "table must not keep old configuration-details column");

const requiredGpuHeaders = ["型号", "GPU", "显存", "硬盘", "地区", "计费", "价格", "风险", "官网"];
for (const header of requiredGpuHeaders) {
  assert(tableSource.includes(`>${header}<`), `GPU table must include ${header}`);
}

for (const label of ["CPU 核数", "内存", "硬盘", "地区", "计费方式", "预算 (USD)", "GPU 型号", "GPU 数量", "显存", "小时价预算 (USD)", "重置", "筛选"]) {
  assert(combinedSource.includes(label), `filter UI must include ${label}`);
}

assert(tableSource.includes("官网直达"), "official button copy must be 官网直达");
assert(tableSource.includes("formatBilling(offer.billing)"), "billing column must use display formatter");
assert(formatterSource.includes("toChineseRegion"), "region column must use Chinese display formatter");
assert(filterSource.includes("getGpuModelOptions"), "GPU model options must come from real offer data");
assert(filterSource.includes("filterOffers"), "filter logic must be centralized");

console.log(`cloud price radar contract ok: ${payload.offers.length} offers (${vpsOffers.length} VPS, ${gpuOffers.length} GPU)`);
