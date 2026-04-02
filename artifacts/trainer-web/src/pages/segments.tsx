import {
  useListSegments,
  useListSegmentTypes,
  useCreateSegment,
  useCreateSegmentType,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, Plus, Tag } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

function AddSegmentDialog({ types, onSuccess }: { types: any[]; onSuccess: () => void }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    typeId: "",
    description: "",
    defaultDurationMinutes: "",
    defaultDistanceKm: "",
  });
  const mutation = useCreateSegment();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({
        data: {
          name: form.name,
          typeId: Number(form.typeId),
          description: form.description || undefined,
          defaultDurationMinutes: form.defaultDurationMinutes ? Number(form.defaultDurationMinutes) : undefined,
          defaultDistanceKm: form.defaultDistanceKm ? Number(form.defaultDistanceKm) : undefined,
        },
      });
      toast({ title: t("segments.createSuccess") });
      setOpen(false);
      onSuccess();
    } catch {
      toast({ title: t("segments.createFailed"), variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 me-2" /> {t("segments.addSegment")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Segment</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 5x1km Tempo" />
          </div>
          <div className="space-y-1">
            <Label>Type *</Label>
            <Select value={form.typeId} onValueChange={(v) => setForm({ ...form, typeId: v })}>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Segment instructions / template text..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Duration (min)</Label>
              <Input type="number" value={form.defaultDurationMinutes} onChange={(e) => setForm({ ...form, defaultDurationMinutes: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Distance (km)</Label>
              <Input type="number" step="0.1" value={form.defaultDistanceKm} onChange={(e) => setForm({ ...form, defaultDistanceKm: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !form.typeId}>
              {mutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddSegmentTypeDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const mutation = useCreateSegmentType();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({ data: { name, color } });
      toast({ title: "Segment type created" });
      setOpen(false);
      onSuccess();
      setName("");
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="h-4 w-4 mr-2" /> Add Type</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>New Segment Type</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Warm-up" />
          </div>
          <div className="space-y-1">
            <Label>Color</Label>
            <div className="flex items-center gap-3">
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 h-9 p-1" />
              <span className="text-sm text-muted-foreground">{color}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
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

export default function SegmentLibrary() {
  const { t } = useTranslation();
  const { data: segments, isLoading: segsLoading, refetch: refetchSegs } = useListSegments({});
  const { data: types, isLoading: typesLoading, refetch: refetchTypes } = useListSegmentTypes({});

  const typeMap = Object.fromEntries((types ?? []).map((type) => [type.id, type]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("segments.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("segments.subtitle")}</p>
      </div>

      <Tabs defaultValue="segments">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="segments">Segments ({segments?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="types">Types ({types?.length ?? 0})</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <AddSegmentTypeDialog onSuccess={refetchTypes} />
            <AddSegmentDialog types={types ?? []} onSuccess={refetchSegs} />
          </div>
        </div>

        <TabsContent value="segments" className="mt-4">
          {segsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : (segments ?? []).length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-2 text-muted-foreground">
              <Dumbbell className="h-10 w-10" />
              <p>{t("segments.noSegments")}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(segments ?? []).map((seg) => {
                const type = typeMap[seg.typeId];
                return (
                  <Card key={seg.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-sm leading-snug">{seg.name}</h3>
                        {type && (
                          <Badge
                            variant="secondary"
                            style={{ backgroundColor: (type.color ?? "#6b7280") + "22", color: type.color ?? "#6b7280" }}
                            className="text-xs shrink-0 ml-2"
                          >
                            {type.name}
                          </Badge>
                        )}
                      </div>
                      {seg.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{seg.description}</p>
                      )}
                      <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                        {seg.defaultDurationMinutes && <span>{seg.defaultDurationMinutes} min</span>}
                        {seg.defaultDistanceKm && <span>{seg.defaultDistanceKm} km</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="types" className="mt-4">
          {typesLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : (types ?? []).length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-2 text-muted-foreground">
              <Tag className="h-10 w-10" />
              <p>{t("segments.noTypes")}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(types ?? []).map((type) => (
                <Card key={type.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg shrink-0"
                      style={{ backgroundColor: (type.color ?? "#6b7280") + "22" }}
                    >
                      <div className="w-full h-full rounded-lg flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: type.color ?? "#6b7280" }} />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{type.name}</p>
                      <p className="text-xs text-muted-foreground">{type.color}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
