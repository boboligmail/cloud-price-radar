import { normalizeRegion } from "@/lib/cloud-offer-filters";

export function formatBilling(value: string) {
  const withoutLeadingMonthly = value.replace(/^月付；\s*/, "");
  const localized = withoutLeadingMonthly
    .replace(/\bondemand\b/gi, "按需")
    .replace(/\bon-demand\b/gi, "按需")
    .replace(/\breserved\b/gi, "预留")
    .replace(/\bspot\b/gi, "抢占式")
    .replace(/\b(\d+)\s*year\b/gi, "$1 年")
    .replace(/\byear\b/gi, "年")
    .replace(/\bhour\b/gi, "小时")
    .replace(/\bsecond\b/gi, "秒")
    .replace(/\bmonth\b/gi, "月付");

  return localized || value;
}

export function toChineseRegion(value: string) {
  const normalized = value.trim();
  const label = regionLabels[normalized] ?? regionLabels[normalized.toUpperCase()];
  if (label) return label;

  const group = normalizeRegion(normalized);
  if (group === "us") return "美国";
  if (group === "europe") return "欧洲";
  if (group === "asia") return "亚洲";
  if (group === "china") return "中国";
  if (group === "global") return "全球多地";
  return normalized;
}

const regionLabels: Record<string, string> = {
  AU: "澳大利亚",
  Australia: "澳大利亚",
  Austria: "奥地利",
  BE: "比利时",
  BR: "巴西",
  CA: "加拿大",
  Canada: "加拿大",
  CH: "瑞士",
  China: "中国",
  DE: "德国",
  ES: "西班牙",
  "European Union": "欧盟",
  FI: "芬兰",
  FR: "法国",
  France: "法国",
  GB: "英国",
  Germany: "德国",
  HK: "香港",
  ID: "印度尼西亚",
  IE: "爱尔兰",
  IL: "以色列",
  IN: "印度",
  IT: "意大利",
  JP: "日本",
  KR: "韩国",
  Latvia: "拉脱维亚",
  Lithuania: "立陶宛",
  MY: "马来西亚",
  Mexico: "墨西哥",
  NL: "荷兰",
  Netherlands: "荷兰",
  PL: "波兰",
  SA: "沙特阿拉伯",
  SE: "瑞典",
  SG: "新加坡",
  Singapore: "新加坡",
  Spain: "西班牙",
  Sweden: "瑞典",
  TW: "台湾",
  US: "美国",
  "United Kingdom": "英国",
  "United States": "美国",
  ZA: "南非",
};
