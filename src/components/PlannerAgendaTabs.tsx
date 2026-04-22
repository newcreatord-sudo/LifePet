import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { useI18nStore } from "@/stores/i18nStore";

function preservedSearch(currentSearch: string) {
  const params = new URLSearchParams(currentSearch);
  const petId = params.get("petId");
  if (!petId) return "";
  const next = new URLSearchParams();
  next.set("petId", petId);
  return `?${next.toString()}`;
}

export function PlannerAgendaTabs() {
  const location = useLocation();
  const lang = useI18nStore((s) => s.lang);
  const search = preservedSearch(location.search);

  return (
    <div className="flex flex-wrap gap-2">
      <NavLink to={{ pathname: "/app/agenda", search }} className={({ isActive }) => cn("lp-chip", isActive && "lp-chip-active")}>
        {tr(lang, "Agenda", "Agenda")}
      </NavLink>
      <NavLink to={{ pathname: "/app/planner", search }} className={({ isActive }) => cn("lp-chip", isActive && "lp-chip-active")}>
        {tr(lang, "Planner", "Planner")}
      </NavLink>
    </div>
  );
}
