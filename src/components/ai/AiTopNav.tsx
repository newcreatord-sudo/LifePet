import { NavLink } from "react-router-dom";
import { Camera, FileArchive, MessageSquare, Sparkles, Stethoscope, Video } from "lucide-react";
import { cn } from "@/lib/utils";

type AiNavKey = "chat" | "symptoms" | "photo" | "video" | "summary" | "saves";

const items: Array<{ key: AiNavKey; to: string; label: string; Icon: typeof Sparkles }> = [
  { key: "chat", to: "/app/ai/chat", label: "Chat", Icon: MessageSquare },
  { key: "symptoms", to: "/app/ai/symptoms", label: "Sintomi", Icon: Stethoscope },
  { key: "photo", to: "/app/ai/photo", label: "Foto", Icon: Camera },
  { key: "video", to: "/app/ai/video", label: "Video", Icon: Video },
  { key: "summary", to: "/app/ai/summary", label: "Riepilogo", Icon: Sparkles },
  { key: "saves", to: "/app/ai/saves", label: "Salvataggi", Icon: FileArchive },
];

export function AiTopNav({ active }: { active: AiNavKey }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const Icon = it.Icon;
        return (
          <NavLink
            key={it.key}
            to={it.to}
            className={({ isActive }) =>
              cn(
                "lp-chip inline-flex items-center gap-2",
                isActive || it.key === active ? "lp-chip-active" : ""
              )
            }
          >
            <Icon className="w-4 h-4" />
            {it.label}
          </NavLink>
        );
      })}
    </div>
  );
}

