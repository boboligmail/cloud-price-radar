import { ArrowUpRight } from "lucide-react";
import type { CloudOffer, CloudOfferKind } from "@/lib/cloud-comparison";
import { getGpuModel, normalizeRegion } from "@/lib/cloud-offer-filters";

type CloudPriceTableProps = {
  readonly kind: CloudOfferKind;
  readonly offers: readonly CloudOffer[];
  readonly startIndex: number;
};

export function CloudPriceTable({ kind, offers, startIndex }: CloudPriceTableProps) {
  if (offers.length === 0) {
    return <div className="emptyState">没有符合条件的结果，放宽筛选条件再试。</div>;
  }

  return (
    <div className="tableWrap">
      <table className={kind === "vps" ? "priceTable vpsTable" : "priceTable gpuTable"}>
        <thead>
          {kind === "vps" ? (
            <tr>
              <TableHead>#</TableHead>
              <TableHead>商家</TableHead>
              <TableHead>CPU</TableHead>
              <TableHead>内存</TableHead>
              <TableHead>硬盘</TableHead>
              <TableHead>流量/带宽</TableHead>
              <TableHead>地区</TableHead>
              <TableHead>计费</TableHead>
              <TableHead>价格</TableHead>
              <TableHead>风险</TableHead>
              <TableHead>官网</TableHead>
            </tr>
          ) : (
            <tr>
              <TableHead>#</TableHead>
              <TableHead>商家</TableHead>
              <TableHead>型号</TableHead>
              <TableHead>GPU</TableHead>
              <TableHead>显存</TableHead>
              <TableHead>硬盘</TableHead>
              <TableHead>地区</TableHead>
              <TableHead>计费</TableHead>
              <TableHead>价格</TableHead>
              <TableHead>风险</TableHead>
              <TableHead>官网</TableHead>
            </tr>
          )}
        </thead>
        <tbody>
          {offers.map((offer, index) =>
            kind === "vps" ? (
              <VpsRow key={offer.id} offer={offer} rowNumber={startIndex + index} />
            ) : (
              <GpuRow key={offer.id} offer={offer} rowNumber={startIndex + index} />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function VpsRow({ offer, rowNumber }: { readonly offer: CloudOffer; readonly rowNumber: number }) {
  return (
    <tr data-region-groups={getRegionGroups(offer)}>
      <IndexCell value={rowNumber} />
      <ProviderCell offer={offer} />
      <DataCell strong>{offer.config.compute}</DataCell>
      <DataCell strong>{offer.config.memory}</DataCell>
      <DataCell>{offer.config.storage}</DataCell>
      <DataCell>{offer.config.network}</DataCell>
      <DataCell>{formatRegions(offer)}</DataCell>
      <DataCell>{offer.billing}</DataCell>
      <PriceCell offer={offer} />
      <RiskCell label={offer.riskLabel} />
      <OfficialCell offer={offer} />
    </tr>
  );
}

function GpuRow({ offer, rowNumber }: { readonly offer: CloudOffer; readonly rowNumber: number }) {
  return (
    <tr data-region-groups={getRegionGroups(offer)}>
      <IndexCell value={rowNumber} />
      <ProviderCell offer={offer} />
      <DataCell strong>{getGpuModel(offer) || offer.product}</DataCell>
      <DataCell strong>{formatGpuCompute(offer.config.compute)}</DataCell>
      <DataCell strong>{offer.config.memory}</DataCell>
      <DataCell>{offer.config.storage}</DataCell>
      <DataCell>{formatRegions(offer)}</DataCell>
      <DataCell>{offer.billing}</DataCell>
      <PriceCell offer={offer} />
      <RiskCell label={offer.riskLabel} />
      <OfficialCell offer={offer} />
    </tr>
  );
}

function TableHead({ children }: { readonly children: React.ReactNode }) {
  return <th scope="col">{children}</th>;
}

function IndexCell({ value }: { readonly value: number }) {
  return <td className="indexCell">{value}</td>;
}

function ProviderCell({ offer }: { readonly offer: CloudOffer }) {
  return (
    <td className="providerCell">
      <strong>{offer.provider}</strong>
      <span>{offer.sourceName}</span>
    </td>
  );
}

function DataCell({ children, strong = false }: { readonly children: React.ReactNode; readonly strong?: boolean }) {
  return <td className={strong ? "dataCell strong" : "dataCell"}>{children}</td>;
}

function PriceCell({ offer }: { readonly offer: CloudOffer }) {
  return (
    <td className="priceCell">
      <strong>{offer.priceDisplay}</strong>
      <span>{offer.lastChecked}</span>
    </td>
  );
}

function RiskCell({ label }: { readonly label: string }) {
  return (
    <td>
      <span className={`riskTag ${riskClassName(label)}`}>{label}</span>
    </td>
  );
}

function OfficialCell({ offer }: { readonly offer: CloudOffer }) {
  return (
    <td>
      <a className="officialLink" href={offer.pricingUrl} target="_blank" rel="noreferrer" aria-label={`打开 ${offer.provider} 官网价格页`}>
        官网直达
        <ArrowUpRight size={13} />
      </a>
    </td>
  );
}

function formatRegions(offer: CloudOffer) {
  return offer.regions.length > 0 ? offer.regions.slice(0, 3).join(" / ") : "地区未列出";
}

function getRegionGroups(offer: CloudOffer) {
  return [...new Set(offer.regions.map(normalizeRegion).filter(Boolean))].join(" ");
}

function formatGpuCompute(value: string) {
  return value
    .replace(/0\.3333333333333333x/g, "1/3x")
    .replace(/0\.333333333333333x/g, "1/3x")
    .replace(/0\.5x/g, "1/2x");
}

function riskClassName(label: string) {
  if (label === "抢占中断") return "danger";
  if (label === "税费另算" || label === "IPv4 另付") return "warning";
  return "info";
}
