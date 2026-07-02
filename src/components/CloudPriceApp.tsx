"use client";

import { Clock3, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { BudgetRange, FilterSelect, Pagination } from "@/components/Controls";
import { CloudPriceTable } from "@/components/CloudPriceTable";
import type { CloudOffer, CloudOfferKind } from "@/lib/cloud-comparison";
import {
  billingOptions,
  emptyFilters,
  filterOffers,
  getGpuModelOptions,
  getRegionOptions,
  gpuCountOptions,
  storageOptions,
  vpsCpuOptions,
  vpsMemoryOptions,
  vramOptions,
  type CloudFilters,
} from "@/lib/cloud-offer-filters";

const pageSize = 25;

type CloudPriceAppProps = {
  readonly offers: readonly CloudOffer[];
  readonly updatedAt: string;
};

export function CloudPriceApp({ offers, updatedAt }: CloudPriceAppProps) {
  const [activeKind, setActiveKind] = useState<CloudOfferKind>(() => (typeof window !== "undefined" && window.location.hash === "#gpu" ? "gpu" : "vps"));
  const [draftFilters, setDraftFilters] = useState<CloudFilters>(emptyFilters);
  const [filters, setFilters] = useState<CloudFilters>(emptyFilters);
  const [page, setPage] = useState(1);

  const tabTotals = useMemo(
    () => ({
      vps: offers.filter((offer) => offer.kind === "vps").length,
      gpu: offers.filter((offer) => offer.kind === "gpu").length,
    }),
    [offers],
  );
  const gpuModelOptions = useMemo(() => getGpuModelOptions(offers), [offers]);
  const regionOptions = useMemo(() => getRegionOptions(offers), [offers]);
  const filteredOffers = useMemo(() => filterOffers(offers, activeKind, filters), [activeKind, filters, offers]);
  const pageCount = Math.max(1, Math.ceil(filteredOffers.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const startIndex = (safePage - 1) * pageSize;
  const visibleOffers = filteredOffers.slice(startIndex, startIndex + pageSize);

  const switchTab = (kind: CloudOfferKind) => {
    setActiveKind(kind);
    setPage(1);
    window.history.replaceState(null, "", kind === "gpu" ? "#gpu" : "#vps");
  };

  const updateDraft = (patch: Partial<CloudFilters>) => {
    setDraftFilters((current) => ({ ...current, ...patch }));
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setPage(1);
  };

  const resetFilters = () => {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
  };

  return (
    <>
      <header className="topbar">
        <div className="topbarInner">
          <a className="brand" href="#vps" aria-label="cloud-price-radar 首页">
            cloud-price-radar
          </a>
          <nav className="topnav" role="tablist" aria-label="云资源类型">
            <button type="button" role="tab" aria-selected={activeKind === "vps"} className={activeKind === "vps" ? "navItem active" : "navItem"} onClick={() => switchTab("vps")}>
              <span>VPS 比价</span>
              <small>{tabTotals.vps} 条</small>
            </button>
            <button type="button" role="tab" aria-selected={activeKind === "gpu"} className={activeKind === "gpu" ? "navItem active" : "navItem"} onClick={() => switchTab("gpu")}>
              <span>GPU 租赁</span>
              <small>{tabTotals.gpu} 条</small>
            </button>
          </nav>
          <div className="updatedAt">
            <Clock3 size={16} />
            <span>最近更新时间：{formatUpdatedAt(updatedAt)}</span>
          </div>
        </div>
      </header>

      <main className="pageShell">
        <section className="hero">
          <h1>{activeKind === "vps" ? "VPS 云服务器价格筛选" : "GPU 算力租赁价格筛选"}</h1>
          <p>
            {activeKind === "vps"
              ? "按 CPU、内存、硬盘、地区和计费方式筛选，直接去官网核验。"
              : "按型号、显存、GPU 数量、地区和小时价筛选，直接去官网核验。"}
          </p>
        </section>

        <section className="filterPanel" aria-label="筛选区">
          {activeKind === "vps" ? (
            <>
              <FilterSelect label="CPU 核数" value={draftFilters.cpuMin} options={vpsCpuOptions} onChange={(cpuMin) => updateDraft({ cpuMin })} />
              <FilterSelect label="内存" value={draftFilters.memoryMin} options={vpsMemoryOptions} onChange={(memoryMin) => updateDraft({ memoryMin })} />
              <FilterSelect label="硬盘" value={draftFilters.storageMin} options={storageOptions} onChange={(storageMin) => updateDraft({ storageMin })} />
              <FilterSelect label="地区" value={draftFilters.region} options={regionOptions} onChange={(region) => updateDraft({ region })} />
              <FilterSelect label="计费方式" value={draftFilters.billingMode} options={billingOptions} onChange={(billingMode) => updateDraft({ billingMode })} />
              <BudgetRange
                label="预算 (USD)"
                minValue={draftFilters.monthlyMin}
                maxValue={draftFilters.monthlyMax === "0" ? "" : draftFilters.monthlyMax}
                onMinChange={(monthlyMin) => updateDraft({ monthlyMin })}
                onMaxChange={(monthlyMax) => updateDraft({ monthlyMax })}
              />
            </>
          ) : (
            <>
              <FilterSelect label="GPU 型号" value={draftFilters.gpuModel} options={gpuModelOptions} onChange={(gpuModel) => updateDraft({ gpuModel })} />
              <FilterSelect label="GPU 数量" value={draftFilters.gpuCountMin} options={gpuCountOptions} onChange={(gpuCountMin) => updateDraft({ gpuCountMin })} />
              <FilterSelect label="显存" value={draftFilters.vramMin} options={vramOptions} onChange={(vramMin) => updateDraft({ vramMin })} />
              <FilterSelect label="地区" value={draftFilters.region} options={regionOptions} onChange={(region) => updateDraft({ region })} />
              <FilterSelect label="计费方式" value={draftFilters.billingMode} options={billingOptions} onChange={(billingMode) => updateDraft({ billingMode })} />
              <BudgetRange
                label="小时价预算 (USD)"
                minValue={draftFilters.hourlyMin}
                maxValue={draftFilters.hourlyMax === "0" ? "" : draftFilters.hourlyMax}
                onMinChange={(hourlyMin) => updateDraft({ hourlyMin })}
                onMaxChange={(hourlyMax) => updateDraft({ hourlyMax })}
              />
            </>
          )}
          <button type="button" className="secondaryButton" onClick={resetFilters}>
            <RotateCcw size={16} />
            重置
          </button>
          <button type="button" className="primaryButton" onClick={applyFilters}>
            <Search size={16} />
            筛选
          </button>
        </section>

        <section className="resultBar" aria-live="polite">
          <strong>{activeKind === "vps" ? "VPS 比价" : "GPU 租赁"}</strong>
          <span>筛选后 {filteredOffers.length} 条，当前第 {safePage} / {pageCount} 页</span>
        </section>

        <CloudPriceTable kind={activeKind} offers={visibleOffers} startIndex={startIndex + 1} />

        <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} />
      </main>
    </>
  );
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  })
    .format(date)
    .replace(/\//g, "-");
}
