import { Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { Notification } from "@/multispecies/types";

export function NotificationInbox(props: { notifications: Notification[]; onMarkRead: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Inbox
        </CardTitle>
        <CardDescription>Notifiche generate dagli alert.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[520px] overflow-y-auto">
          {props.notifications.slice(0, 80).map((n) => (
            <button
              key={n.id}
              type="button"
              className={cn("w-full text-left lp-panel px-3 py-2", n.readAt ? "opacity-70" : "")}
              onClick={() => props.onMarkRead(n.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{n.title}</div>
                  <div className="text-xs lp-muted truncate">{n.body}</div>
                </div>
                <div className="text-[11px] lp-muted whitespace-nowrap">{new Date(n.createdAt).toLocaleTimeString()}</div>
              </div>
            </button>
          ))}
          {props.notifications.length === 0 ? <div className="text-sm lp-muted">Nessuna notifica.</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

