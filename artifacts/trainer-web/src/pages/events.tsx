import {
  useListEvents,
  useCreateEvent,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, Plus, MapPin, Calendar, Clock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function AddEventDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    date: "",
    location: "",
    description: "",
    distance: "",
    eventType: "race" as string,
  });
  const mutation = useCreateEvent();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({
        data: {
          ...form,
          distance: form.distance ? Number(form.distance) : undefined,
        } as any,
      });
      toast({ title: "Event created" });
      setOpen(false);
      onSuccess();
      setForm({ name: "", date: "", location: "", description: "", distance: "", eventType: "race" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" /> Add Event</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label>Event Name *</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tel Aviv Marathon" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="race">Race</SelectItem>
                  <SelectItem value="group_run">Group Run</SelectItem>
                  <SelectItem value="training_camp">Training Camp</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City or venue" />
            </div>
            <div className="space-y-1">
              <Label>Distance (km)</Label>
              <Input type="number" step="0.1" value={form.distance} onChange={(e) => setForm({ ...form, distance: e.target.value })} placeholder="e.g. 42.2" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Event details..." rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function eventTypeColor(type: string) {
  switch (type) {
    case "race": return "default";
    case "group_run": return "secondary";
    case "training_camp": return "outline";
    default: return "outline";
  }
}

function eventTypeLabel(type: string) {
  switch (type) {
    case "race": return "Race";
    case "group_run": return "Group Run";
    case "training_camp": return "Training Camp";
    default: return type;
  }
}

export default function EventList() {
  const { data: events, isLoading, refetch } = useListEvents();
  const today = new Date().toISOString().slice(0, 10);

  const upcoming = (events ?? []).filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = (events ?? []).filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground mt-1">Races, group runs, and training camps</p>
        </div>
        <AddEventDialog onSuccess={refetch} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (events ?? []).length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2 text-muted-foreground">
          <Flag className="h-10 w-10" />
          <p>No events yet</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-muted-foreground mb-3 uppercase tracking-wide text-xs">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map((event) => (
                  <Card key={event.id} className="hover:shadow-sm transition-shadow border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-base">{event.name}</h3>
                            <Badge variant={eventTypeColor(event.eventType ?? "other") as any}>{eventTypeLabel(event.eventType ?? "other")}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(event.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {event.location}
                              </span>
                            )}
                            {event.distance && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {event.distance} km
                              </span>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{event.description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold text-primary">
                            {new Date(event.date).getDate()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.date).toLocaleDateString("en-US", { month: "short" })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-muted-foreground mb-3 uppercase tracking-wide text-xs">Past</h2>
              <div className="space-y-2 opacity-70">
                {past.map((event) => (
                  <Card key={event.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-medium text-sm">{event.name}</h3>
                          <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{new Date(event.date).toLocaleDateString()}</span>
                            {event.location && <span>· {event.location}</span>}
                            {event.distance && <span>· {event.distance} km</span>}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">{eventTypeLabel(event.eventType ?? "other")}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
