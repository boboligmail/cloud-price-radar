"use client";

import { Clock3, Cpu, RotateCcw, Search, Server } from "lucide-react";
import { useMemo, useState } from "react";
import { FilterSelect, Pagination, SearchBox } from "@/components/Controls";
import { CloudPriceTable } from "@/components/CloudPriceTable";
import type { CloudOffer, CloudOfferKind } from "@/lib/cloud-comparison";
import {
  billingOptions,
  emptyFilters,
  filterOffers,
  getGpuModelOptions,
  getRegionOptions,
  gpuCountOptions,
  hourlyOptions,
  monthlyOptions,
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
        <a className="brand" href="#vps" aria-label="cloud-price-radar 首页">
          cloud-price-radar
        </a>
        <nav className="topnav" aria-label="主导航">
          <button type="button" className={activeKind === "vps" ? "navItem active" : "navItem"} onClick={() => switchTab("vps")}>
            VPS 比价
          </button>
          <button type="button" className={activeKind === "gpu" ? "navItem active" : "navItem"} onClick={() => switchTab("gpu")}>
            GPU 租赁
          </button>
        </nav>
        <div className="updatedAt">
          <Clock3 size={16} />
          <span>最近更新时间：{formatUpdatedAt(updatedAt)}</span>
        </div>
      </header>

      <main className="pageShell">
        <section className="hero">
          <h1>云服务器与 GPU 租赁价格筛选器</h1>
          <p>按配置、地区、计费方式和风险快速找到可核验的低价方案。</p>
        </section>

        <section className="tabs" role="tablist" aria-label="云资源类型">
          <TabButton active={activeKind === "vps"} label="VPS 比价" count={tabTotals.vps} icon={<Server size={22} />} onClick={() => switchTab("vps")} />
          <TabButton active={activeKind === "gpu"} label="GPU 租赁" count={tabTotals.gpu} icon={<Cpu size={22} />} onClick={() => switchTab("gpu")} />
        </section>

        <section className="filterPanel" aria-label="筛选区">
          <SearchBox
            label="搜索"
            value={draftFilters.query}
            placeholder={activeKind === "vps" ? "商家 / CPU / 地区" : "商家 / 型号 / 显存"}
            onChange={(query) => updateDraft({ query })}
          />
          {activeKind === "vps" ? (
            <>
              <FilterSelect label="CPU 核数" value={draftFilters.cpuMin} options={vpsCpuOptions} onChange={(cpuMin) => updateDraft({ cpuMin })} />
              <FilterSelect label="内存" value={draftFilters.memoryMin} options={vpsMemoryOptions} onChange={(memoryMin) => updateDraft({ memoryMin })} />
              <FilterSelect label="硬盘空间" value={draftFilters.storageMin} options={storageOptions} onChange={(storageMin) => updateDraft({ storageMin })} />
              <FilterSelect label="地区" value={draftFilters.region} options={regionOptions} onChange={(region) => updateDraft({ region })} />
              <FilterSelect label="计费方式" value={draftFilters.billingMode} options={billingOptions} onChange={(billingMode) => updateDraft({ billingMode })} />
              <FilterSelect label="预算" value={draftFilters.monthlyMax} options={monthlyOptions} onChange={(monthlyMax) => updateDraft({ monthlyMax })} />
            </>
          ) : (
            <>
              <FilterSelect label="GPU 型号" value={draftFilters.gpuModel} options={gpuModelOptions} onChange={(gpuModel) => updateDraft({ gpuModel })} />
              <FilterSelect label="GPU 数量" value={draftFilters.gpuCountMin} options={gpuCountOptions} onChange={(gpuCountMin) => updateDraft({ gpuCountMin })} />
              <FilterSelect label="显存" value={draftFilters.vramMin} options={vramOptions} onChange={(vramMin) => updateDraft({ vramMin })} />
              <FilterSelect label="地区" value={draftFilters.region} options={regionOptions} onChange={(region) => updateDraft({ region })} />
              <FilterSelect label="计费方式" value={draftFilters.billingMode} options={billingOptions} onChange={(billingMode) => updateDraft({ billingMode })} />
              <FilterSelect label="小时价预算" value={draftFilters.hourlyMax} options={hourlyOptions} onChange={(hourlyMax) => updateDraft({ hourlyMax })} />
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

function TabButton({
  active,
  label,
  count,
  icon,
  onClick,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly count: number;
  readonly icon: React.ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <button type="button" role="tab" aria-selected={active} className={active ? "tabButton active" : "tabButton"} onClick={onClick}>
      {icon}
      <span>{label}</span>
      <small>{count} 条</small>
    </button>
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
