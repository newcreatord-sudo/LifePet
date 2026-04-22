import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ConfirmStyles } from "@/components/confirm";
import { ExternalLink, PhoneCall, ShieldPlus } from "lucide-react";

export function PetVetCard({
  vetClinicName,
  setVetClinicName,
  vetPhone,
  setVetPhone,
  vetEmergencyPhone,
  setVetEmergencyPhone,
  vetAddress,
  setVetAddress,
}: {
  vetClinicName: string;
  setVetClinicName: (v: string) => void;
  vetPhone: string;
  setVetPhone: (v: string) => void;
  vetEmergencyPhone: string;
  setVetEmergencyPhone: (v: string) => void;
  vetAddress: string;
  setVetAddress: (v: string) => void;
}) {
  const safePhone = vetPhone.trim();
  const safeEmergency = vetEmergencyPhone.trim();
  const safeAddress = vetAddress.trim();

  return (
    <Card className="relative overflow-hidden">
      <div className="lp-card-accent" aria-hidden="true" />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Veterinario</CardTitle>
            <CardDescription>Contatti pronti per emergenze e promemoria.</CardDescription>
          </div>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(var(--lp-warn),0.12)", border: "1px solid rgba(var(--lp-warn),0.30)" }}>
            <ShieldPlus className="w-5 h-5" style={{ color: "rgb(var(--lp-primary-700))" }} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          {safePhone ? (
            <a href={`tel:${safePhone}`} className="lp-btn-secondary inline-flex items-center gap-2">
              <PhoneCall className="w-4 h-4" />
              Chiama
            </a>
          ) : null}
          {safeEmergency ? (
            <a href={`tel:${safeEmergency}`} className="lp-btn-primary px-3 py-2 text-xs inline-flex items-center gap-2" style={ConfirmStyles.dangerButtonStyle}>
              <PhoneCall className="w-4 h-4" />
              Emergenza
            </a>
          ) : null}
          {safeAddress ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(safeAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn-icon inline-flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Maps
            </a>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs lp-muted mb-1">Clinica</div>
            <input value={vetClinicName} onChange={(e) => setVetClinicName(e.target.value)} className="lp-input" />
          </label>
          <label className="block">
            <div className="text-xs lp-muted mb-1">Telefono</div>
            <input value={vetPhone} onChange={(e) => setVetPhone(e.target.value)} placeholder="+39…" className="lp-input" />
          </label>
          <label className="block">
            <div className="text-xs lp-muted mb-1">Telefono emergenza</div>
            <input value={vetEmergencyPhone} onChange={(e) => setVetEmergencyPhone(e.target.value)} placeholder="+39…" className="lp-input" />
          </label>
          <label className="block">
            <div className="text-xs lp-muted mb-1">Indirizzo</div>
            <input value={vetAddress} onChange={(e) => setVetAddress(e.target.value)} className="lp-input" />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

