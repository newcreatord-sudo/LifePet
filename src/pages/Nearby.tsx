import { PageHeader } from "@/components/ui/PageHeader";
import { NearbyPanel } from "@/components/nearby/NearbyPanel";

export default function Nearby() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Servizi vicino a te"
        description="Cerca veterinari, toelettature, pensioni e pet shop mentre sei in viaggio o vicino casa."
        imagePrompt="minimal clean illustration, map with paw pins and small clinic building icon, premium, airy, no text, no watermark"
      />

      <NearbyPanel mapMode="inline" />
    </div>
  );
}
