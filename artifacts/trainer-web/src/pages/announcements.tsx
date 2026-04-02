import {
  useListAnnouncements,
  useCreateAnnouncement,
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
import { Megaphone, Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const AUDIENCES = ["all", "paid", "free"] as const;

function AddAnnouncementDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", audience: "all" as string });
  const mutation = useCreateAnnouncement();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({ data: form as any });
      toast({ title: "Announcement created" });
      setOpen(false);
      onSuccess();
      setForm({ title: "", content: "", audience: "all" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" /> New Announcement</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Announcement title" />
          </div>
          <div className="space-y-1">
            <Label>Content *</Label>
            <Textarea required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write your announcement..." rows={4} />
          </div>
          <div className="space-y-1">
            <Label>Audience</Label>
            <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trainees</SelectItem>
                <SelectItem value="paid">Paid Only</SelectItem>
                <SelectItem value="free">Free Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Posting..." : "Post"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AnnouncementList() {
  const { data: announcements, isLoading, refetch } = useListAnnouncements();

  const sorted = [...(announcements ?? [])].sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
          <p className="text-muted-foreground mt-1">Broadcast messages to your trainees</p>
        </div>
        <AddAnnouncementDialog onSuccess={refetch} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2 text-muted-foreground">
          <Megaphone className="h-10 w-10" />
          <p>No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((ann) => (
            <Card key={ann.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-base">{ann.title}</h3>
                  <Badge variant={ann.audience === "all" ? "default" : ann.audience === "paid" ? "secondary" : "outline"} className="shrink-0">
                    {ann.audience === "all" ? "All" : ann.audience === "paid" ? "Paid" : "Free"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                {ann.createdAt && (
                  <p className="text-xs text-muted-foreground mt-3">{new Date(ann.createdAt).toLocaleDateString()}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
