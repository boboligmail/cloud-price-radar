import type { CloudOffer, CloudOfferKind } from "@/lib/cloud-comparison";
import { getCloudOfferMetrics } from "@/lib/cloud-offer-metrics";

export type CloudFilters = {
  readonly query: string;
  readonly cpuMin: string;
  readonly memoryMin: string;
  readonly storageMin: string;
  readonly region: string;
  readonly billingMode: string;
  readonly monthlyMax: string;
  readonly gpuModel: string;
  readonly gpuCountMin: string;
  readonly vramMin: string;
  readonly hourlyMax: string;
};

export const emptyFilters: CloudFilters = {
  query: "",
  cpuMin: "0",
  memoryMin: "0",
  storageMin: "0",
  region: "all",
  billingMode: "all",
  monthlyMax: "0",
  gpuModel: "all",
  gpuCountMin: "0",
  vramMin: "0",
  hourlyMax: "0",
};

export const vpsCpuOptions = [["0", "CPU 全部"], ["1", "1 核+"], ["2", "2 核+"], ["4", "4 核+"], ["8", "8 核+"]] as const;
export const vpsMemoryOptions = [["0", "内存全部"], ["1", "1 GB+"], ["2", "2 GB+"], ["4", "4 GB+"], ["8", "8 GB+"], ["16", "16 GB+"]] as const;
export const storageOptions = [["0", "硬盘不限"], ["20", "20 GB+"], ["50", "50 GB+"], ["100", "100 GB+"], ["200", "200 GB+"], ["500", "500 GB+"], ["1024", "1 TB+"]] as const;
export const monthlyOptions = [["0", "预算不限"], ["5", "$5/月内"], ["10", "$10/月内"], ["20", "$20/月内"], ["50", "$50/月内"]] as const;
export const gpuCountOptions = [["0", "GPU 数全部"], ["0.5", "半卡+"], ["1", "1 张+"], ["2", "2 张+"], ["4", "4 张+"], ["8", "8 张+"]] as const;
export const vramOptions = [["0", "显存全部"], ["8", "8 GB+"], ["16", "16 GB+"], ["24", "24 GB+"], ["48", "48 GB+"], ["80", "80 GB+"]] as const;
export const hourlyOptions = [["0", "小时价不限"], ["0.2", "$0.20/小时内"], ["0.5", "$0.50/小时内"], ["1", "$1/小时内"], ["2", "$2/小时内"], ["5", "$5/小时内"]] as const;
export const billingOptions = [["all", "计费不限"], ["month", "月付"], ["hour", "小时"], ["spot", "抢占式"]] as const;

export function filterOffers(offers: readonly CloudOffer[], kind: CloudOfferKind, filters: CloudFilters) {
  const keyword = filters.query.trim().toLowerCase();

  return offers
    .filter((offer) => {
      if (offer.kind !== kind) return false;
      if (keyword && !matchesKeyword(offer, keyword)) return false;
      if (filters.region !== "all" && !offer.regions.some((region) => normalizeRegion(region) === filters.region)) return false;
      if (!matchesBilling(offer.billing, filters.billingMode)) return false;

      const metrics = getCloudOfferMetrics(offer);
      if (kind === "vps") {
        return (
          metrics.cpuCores >= Number(filters.cpuMin) &&
          metrics.memoryGb >= Number(filters.memoryMin) &&
          metrics.storageGb >= Number(filters.storageMin) &&
          (Number(filters.monthlyMax) === 0 || offer.monthlyEstimateUsd <= Number(filters.monthlyMax))
        );
      }

      return (
        metrics.gpuCount >= Number(filters.gpuCountMin) &&
        (filters.gpuModel === "all" || getGpuModel(offer) === filters.gpuModel) &&
        metrics.vramGb >= Number(filters.vramMin) &&
        (Number(filters.hourlyMax) === 0 || offer.priceUsd <= Number(filters.hourlyMax))
      );
    })
    .sort((left, right) => {
      if (kind === "vps") return left.monthlyEstimateUsd - right.monthlyEstimateUsd;
      return left.priceUsd - right.priceUsd;
    });
}

export function getGpuModelOptions(offers: readonly CloudOffer[]): readonly (readonly [string, string])[] {
  const counts = new Map<string, number>();
  for (const offer of offers) {
    if (offer.kind !== "gpu") continue;
    const model = getGpuModel(offer);
    if (!model) continue;
    counts.set(model, (counts.get(model) ?? 0) + 1);
  }

  return [
    ["all", "型号全部"],
    ...[...counts.entries()]
      .sort(([leftModel, leftCount], [rightModel, rightCount]) => rightCount - leftCount || leftModel.localeCompare(rightModel))
      .map(([model, count]) => [model, `${model} (${count})`] as const),
  ] as const;
}

export function getRegionOptions(offers: readonly CloudOffer[]): readonly (readonly [string, string])[] {
  const regions = new Set<string>();
  for (const offer of offers) {
    for (const region of offer.regions) {
      const normalized = normalizeRegion(region);
      if (normalized) regions.add(normalized);
    }
  }

  const preferred = ["us", "europe", "asia", "china", "germany", "singapore", "global"];
  const options = preferred.filter((region) => regions.has(region)).map((region) => [region, toRegionLabel(region)] as const);
  return [["all", "地区全部"], ...options] as const;
}

export function getGpuModel(offer: CloudOffer) {
  const text = `${offer.config.compute} ${offer.product}`;
  const match = text.match(/\b(RTX\s?\d{4}|GTX\s?\d{4}|A\d{2,4}|H\d{3,4}|L\d{1,2}|T\d|V\d{3}|B\d{3,4}|MI\d{2,3}X?)\b/i);
  if (!match) return "";
  return match[1]?.toUpperCase().replace(/(RTX|GTX)\s?(\d)/, "$1 $2") ?? "";
}

function matchesKeyword(offer: CloudOffer, keyword: string) {
  return `${offer.provider} ${offer.product} ${offer.config.compute} ${offer.config.memory} ${offer.sourceName}`.toLowerCase().includes(keyword);
}

function matchesBilling(billing: string, mode: string) {
  const normalized = billing.toLowerCase();
  if (mode === "all") return true;
  if (mode === "month") return /month|monthly|月付|按月/.test(normalized);
  if (mode === "hour") return /hour|hourly|按小时|小时/.test(normalized);
  if (mode === "spot") return /spot|preempt|interrupt|抢占|竞价/.test(normalized);
  return false;
}

export function normalizeRegion(value: string) {
  const text = value.trim().toLowerCase();
  if (!text) return "";
  if (["us", "usa"].includes(text) || /\bunited states\b|美国|new york|los angeles|california|virginia|dallas|chicago/.test(text)) return "us";
  if (
    ["gb", "uk", "de", "fr", "nl", "pl", "it", "es", "fi", "ie", "be", "se", "ch"].includes(text) ||
    /\beu\b|\beurope\b|germany|france|netherlands|poland|italy|spain|finland|ireland|belgium|sweden|欧洲|德国|荷兰|芬兰|英国/.test(text)
  ) {
    return "europe";
  }
  if (
    ["sg", "jp", "hk", "kr", "in", "my", "id", "tw"].includes(text) ||
    /singapore|japan|hong kong|asia|tokyo|seoul|india|malaysia|indonesia|taiwan|亚洲|新加坡|日本|香港|韩国|印度/.test(text)
  ) {
    return "asia";
  }
  if (text === "cn" || /china|mainland|中国|大陆/.test(text)) return "china";
  if (/global|multiple|world|多地|全球/.test(text)) return "global";
  return "";
}

function toRegionLabel(value: string) {
  if (value === "us") return "美国";
  if (value === "europe") return "欧洲";
  if (value === "asia") return "亚洲";
  if (value === "china") return "中国";
  if (value === "global") return "全球多地";
  return value;
}
