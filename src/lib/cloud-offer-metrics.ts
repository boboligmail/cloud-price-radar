import type { CloudOffer } from "@/lib/cloud-comparison";

export type CloudOfferMetrics = {
  readonly cpuCores: number;
  readonly memoryGb: number;
  readonly storageGb: number;
  readonly gpuCount: number;
  readonly vramGb: number;
};

export function getCloudOfferMetrics(offer: CloudOffer): CloudOfferMetrics {
  return {
    cpuCores: parseFirstNumber(offer.config.compute),
    memoryGb: parseCapacityGb(offer.config.memory),
    storageGb: parseCapacityGb(offer.config.storage),
    gpuCount: parseGpuCount(offer.config.compute),
    vramGb: parseCapacityGb(offer.config.memory),
  };
}

function parseGpuCount(value: string) {
  const fraction = value.match(/(\d+)\s*\/\s*(\d+)\s*x/i);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    return denominator > 0 ? numerator / denominator : 0;
  }

  const count = value.match(/(\d+(?:\.\d+)?)\s*x/i);
  if (count) return Number(count[1]);

  return parseFirstNumber(value);
}

function parseCapacityGb(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)\s*(tb|gb|mb)/i);
  if (!match) return parseFirstNumber(value);

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  if (unit === "tb") return amount * 1024;
  if (unit === "mb") return amount / 1024;
  return amount;
}

function parseFirstNumber(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}
