import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dataPath = join(root, "data", "cloud-offers-db.json");

const payload = JSON.parse(readFileSync(dataPath, "utf8"));

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
  assert(typeof offer.compute === "string" && offer.compute.length > 0, `compute missing for ${offer.id}`);
  assert(typeof offer.memory === "string" && offer.memory.length > 0, `memory missing for ${offer.id}`);
  assert(typeof offer.storage === "string" && offer.storage.length > 0, `storage missing for ${offer.id}`);
  assert(typeof offer.network === "string" && offer.network.length > 0, `network missing for ${offer.id}`);
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

assert(vpsOffers.some((offer) => /IPv4/i.test(offer.risk)), "VPS dataset must include IPv4 risk coverage");
assert(vpsOffers.some((offer) => /United States|US|Germany|Netherlands|China/i.test(offer.region)), "VPS dataset must include region coverage");
assert(vpsOffers.some((offer) => /\d/.test(offer.network)), "VPS dataset must include network coverage");
assert(gpuOffers.some((offer) => /RTX|A100|H100|L40|4090|3090/i.test(`${offer.product} ${offer.compute}`)), "GPU dataset must include model coverage");

console.log(`cloud price radar contract ok: ${payload.offers.length} offers (${vpsOffers.length} VPS, ${gpuOffers.length} GPU)`);
