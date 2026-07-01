import { CloudPriceApp } from "@/components/CloudPriceApp";
import { cloudComparisonSummary, cloudOffers } from "@/lib/cloud-comparison";

export const revalidate = 3600;

export default function Home() {
  return <CloudPriceApp offers={cloudOffers} updatedAt={cloudComparisonSummary.generatedAt} />;
}
