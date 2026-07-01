import cloudOfferPayload from "../../data/cloud-offers-db.json";
import cloudOfferUpdatePayload from "../../data/cloud-offer-update-records.json";

export type CloudOfferKind = "vps" | "gpu";

export type CloudOfferConfig = {
  readonly compute: string;
  readonly memory: string;
  readonly storage: string;
  readonly network: string;
  readonly note: string;
};

export type CloudOffer = {
  readonly id: string;
  readonly kind: CloudOfferKind;
  readonly provider: string;
  readonly product: string;
  readonly pricingUrl: string;
  readonly priceUsd: number;
  readonly monthlyEstimateUsd: number;
  readonly priceDisplay: string;
  readonly config: CloudOfferConfig;
  readonly billing: string;
  readonly sourceName: string;
  readonly regions: readonly string[];
  readonly riskLabel: string;
  readonly lastChecked: string;
};

type CloudOfferPayloadRow = {
  readonly id: string;
  readonly kind: CloudOfferKind;
  readonly provider: string;
  readonly product: string;
  readonly priceUsd: number;
  readonly monthlyEstimateUsd: number;
  readonly priceText: string;
  readonly billing: string;
  readonly compute: string;
  readonly memory: string;
  readonly storage: string;
  readonly network: string;
  readonly region: string;
  readonly risk: string;
  readonly sourceName: string;
  readonly verifyUrl: string;
  readonly lastChecked: string;
};

type CloudOfferPayload = {
  readonly updatedAt: string;
  readonly generatedAt: string;
  readonly offers: readonly CloudOfferPayloadRow[];
};

type CloudOfferUpdatePayload = {
  readonly records: readonly {
    readonly updatedAt: string;
    readonly generatedAt: string;
    readonly totalOffers: number;
    readonly vpsOffers: number;
    readonly gpuOffers: number;
  }[];
};

const offerData = cloudOfferPayload as CloudOfferPayload;
const updateData = cloudOfferUpdatePayload as CloudOfferUpdatePayload;

export const cloudOffers: readonly CloudOffer[] = offerData.offers.flatMap((offer) => {
  if (offer.kind !== "vps" && offer.kind !== "gpu") return [];

  return [
    {
      id: offer.id,
      kind: offer.kind,
      provider: offer.provider,
      product: offer.product,
      pricingUrl: offer.verifyUrl,
      priceUsd: offer.priceUsd,
      monthlyEstimateUsd: offer.monthlyEstimateUsd,
      priceDisplay: offer.priceText,
      config: {
        compute: offer.compute,
        memory: offer.memory,
        storage: offer.storage,
        network: offer.network,
        note: offer.risk,
      },
      billing: offer.billing,
      sourceName: offer.sourceName,
      regions: splitRegions(offer.region),
      riskLabel: toRiskLabel(offer.risk, offer.billing, offer.kind),
      lastChecked: offer.lastChecked,
    },
  ];
});

export const cloudComparisonSummary = {
  updatedAt: offerData.updatedAt,
  generatedAt: offerData.generatedAt,
  latestRecord: updateData.records[0],
} as const;

function splitRegions(value: string): readonly string[] {
  return value
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function toRiskLabel(value: string, billing: string, kind: CloudOfferKind) {
  const billingText = billing.toLowerCase();
  if (/spot|preempt|interrupt|抢占|竞价/.test(billingText)) return "抢占中断";
  if (/reserved|commit|year|承诺|预留/.test(billingText)) return "账号审核";

  const text = value.toLowerCase();
  if (/preempt|interrupt|抢占|竞价/.test(text)) return "抢占中断";
  if (/traffic|bandwidth|流量|带宽/.test(text)) return "另收流量";
  if (/ipv4|ip/.test(text)) return "IPv4 另付";
  if (/tax|税/.test(text)) return "税费另算";
  if (/region|地区/.test(text)) return "地区差价";
  if (/account|审核|承诺期/.test(text)) return "账号审核";
  if (/stock|inventory|库存/.test(text)) return "库存波动";
  return kind === "gpu" ? "库存波动" : "地区差价";
}
