import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RESOURCE_TYPES = ["Video", "Article", "PDF", "Website", "AI Resource"] as const;

type ResourceType = (typeof RESOURCE_TYPES)[number];

type Resource = {
  id: string;
  title: string;
  description: string;
  type: ResourceType;
  url: string;
  source?: "user" | "ai";
  saved?: boolean;
};

type AiResourceItem = {
  id?: string | number;
  title?: string;
  description?: string;
  type?: string;
  url?: string;
};

const TYPE_FILTERS: { label: string; value: ResourceType | "all" | "saved" }[] = [
  { label: "All", value: "all" },
  { label: "Saved", value: "saved" },
  { label: "Videos", value: "Video" },
  { label: "Articles", value: "Article" },
  { label: "PDFs", value: "PDF" },
  { label: "Websites", value: "Website" },
  { label: "AI Resources", value: "AI Resource" },
];

export default function LearningResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ResourceType | "all" | "saved">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ResourceType | "Video">("Video");
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    // Seed with a few example resources so the grid isn't empty on first load
    setResources([
      {
        id: "seed-1",
        title: "Intro to Active Recall",
        description: "Short video explaining how to study using active recall.",
        type: "Video",
        url: "https://www.youtube.com/results?search_query=active+recall+study+technique",
        source: "user",
        saved: true,
      },
      {
        id: "seed-2",
        title: "Focused Study Sessions Guide",
        description: "Article on structuring deep work blocks for learning.",
        type: "Article",
        url: "https://www.google.com/search?q=how+to+structure+focused+study+sessions",
        source: "user",
        saved: true,
      },
      {
        id: "seed-3",
        title: "Khan Academy: Study Skills",
        description: "Khan Academy collection on study skills and effective learning.",
        type: "Website",
        url: "https://www.khanacademy.org/search?page_search_query=study+skills",
        source: "user",
        saved: true,
      },
    ]);

    // Load user-saved resources from backend so they persist across sessions
    (async () => {
      try {
        const res = await fetch("/api/resources", { method: "GET" });
        if (!res.ok) return;
        const data: AiResourceItem[] = await res.json();
        const mapped: Resource[] = (data || []).map((item) => ({
          id: `db-${item.id ?? ""}`,
          title: item.title ?? "Saved resource",
          description: item.description ?? "User-saved learning resource.",
          type: (item.type && RESOURCE_TYPES.includes(item.type as ResourceType)
            ? (item.type as ResourceType)
            : "AI Resource"),
          url: item.url ?? "#",
          source: "user",
          saved: true,
        }));
        if (mapped.length) {
          setResources((prev) => {
            const seen = new Set(prev.map((r) => `${r.title}-${r.url}`));
            const merged = mapped.filter((r) => !seen.has(`${r.title}-${r.url}`));
            return [...merged, ...prev];
          });
        }
      } catch (e) {
        console.error(e);
      }
    })();

    // Also load any locally-saved resources (for users without backend or when offline)
    try {
      const raw = localStorage.getItem("learnnova_saved_resources");
      if (raw) {
        const parsed: AiResourceItem[] = JSON.parse(raw);
        const mapped: Resource[] = (parsed || []).map((item) => ({
          id: `local-${item.id ?? `${item.title}-${item.url}`}`,
          title: item.title ?? "Saved resource",
          description: item.description ?? "User-saved learning resource.",
          type: (item.type && RESOURCE_TYPES.includes(item.type as ResourceType)
            ? (item.type as ResourceType)
            : "AI Resource"),
          url: item.url ?? "#",
          source: "user",
          saved: true,
        }));
        if (mapped.length) {
          setResources((prev) => {
            const seen = new Set(prev.map((r) => `${r.title}-${r.url}`));
            const merged = mapped.filter((r) => !seen.has(`${r.title}-${r.url}`));
            return [...merged, ...prev];
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const filteredResources = useMemo(() => {
    const q = search.toLowerCase().trim();
    return resources.filter((r) => {
      const matchesType =
        activeFilter === "all"
          ? true
          : activeFilter === "saved"
          ? !!r.saved
          : activeFilter === "AI Resource"
          ? r.type === "AI Resource" || r.source === "ai"
          : r.type === activeFilter;
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [resources, search, activeFilter]);

  const clearForm = () => {
    setTitle("");
    setUrl("");
    setDescription("");
    setType("Video");
  };

  const handleAddResource = () => {
    if (!title.trim() || !url.trim()) return;
    const next: Resource = {
      id: `local-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || "User-added learning resource.",
      type: (type || "Video") as ResourceType,
      url: url.trim(),
      source: "user",
      saved: true,
    };
    setResources((prev) => [next, ...prev]);
    clearForm();
    setAddOpen(false);
  };

  const handleAiSuggest = async () => {
    try {
      setLoadingAi(true);
      const topic = search.trim();
      const url = topic ? `/api/resources/ai?topic=${encodeURIComponent(topic)}` : "/api/resources/ai";
      const res = await fetch(url, {
        method: "GET",
      });
      if (!res.ok) throw new Error("Failed to fetch AI resources");
      const data = await res.json();
      const items: AiResourceItem[] = Array.isArray(data) ? data : data.items || [];
      const incoming: Resource[] = items.map((item, idx) => ({
        id: (item.id != null ? String(item.id) : undefined) ?? `ai-${Date.now()}-${idx}`,
        title: item.title ?? "AI Suggested Resource",
        description: item.description ?? "Suggested by LearnNova AI.",
        type: (item.type && RESOURCE_TYPES.includes(item.type as ResourceType)
          ? (item.type as ResourceType)
          : "AI Resource"),
        url: item.url ?? "#",
        source: "ai",
        saved: false,
      }));
      setResources((prev) => {
        const seen = new Set(prev.map((r) => `${r.title}-${r.url}`));
        const deduped = incoming.filter((r) => !seen.has(`${r.title}-${r.url}`));
        return [...deduped, ...prev];
      });
    } catch (e) {
      // In this UI we fail silently; production app should surface a toast
      console.error(e);
    } finally {
      setLoadingAi(false);
    }
  };

  const openInNewTab = (link: string) => {
    if (!link) return;
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const saveResource = async (id: string) => {
    // Find the resource in local state
    const target = resources.find((r) => r.id === id);
    if (!target) return;

    // Optimistically mark as saved in UI
    setResources((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              saved: true,
            }
          : r
      )
    );

    // Persist to backend (best-effort)
    try {
      await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: target.title,
          description: target.description,
          type: target.type,
          url: target.url,
        }),
      });
    } catch (e) {
      console.error(e);
    }

    // Also persist to localStorage so it survives reloads even without backend
    try {
      const raw = localStorage.getItem("learnnova_saved_resources");
      const arr: AiResourceItem[] = raw ? JSON.parse(raw) : [];
      const key = `${target.title}-${target.url}`;
      const existingKeys = new Set(arr.map((r) => `${r.title}-${r.url}`));
      if (!existingKeys.has(key)) {
        arr.push({
          id: target.id,
          title: target.title,
          description: target.description,
          type: target.type,
          url: target.url,
        });
        localStorage.setItem("learnnova_saved_resources", JSON.stringify(arr));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteResource = (id: string) => {
    const target = resources.find((r) => r.id === id);
    setResources((prev) => prev.filter((r) => r.id !== id));

    // Remove from localStorage if it was persisted there
    if (!target) return;
    try {
      const raw = localStorage.getItem("learnnova_saved_resources");
      if (!raw) return;
      const arr: AiResourceItem[] = JSON.parse(raw);
      const filtered = arr.filter(
        (r) => `${r.title}-${r.url}` !== `${target.title}-${target.url}`
      );
      localStorage.setItem("learnnova_saved_resources", JSON.stringify(filtered));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-5xl px-4 pt-24 pb-12 space-y-6">
        <header className="space-y-2 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white drop-shadow-sm">
            Learning Resource Aggregator
          </h1>
          <p className="text-sm md:text-base text-[#FFBB94] dark:text-[#FB9590] max-w-2xl mx-auto md:mx-0">
            Discover videos, articles, PDFs, websites, and AI-recommended study materials in one place to support your LearnNova study sessions.
          </p>
        </header>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by title, topic, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#4C1D3D]/70 border-pink-700/60 text-[#FFBB94] placeholder-pink-200 focus-visible:ring-[#FFBB94] focus-visible:ring-offset-0"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAiSuggest}
              disabled={loadingAi}
              className="border-pink-700/60 text-[#FFBB94] hover:bg-[#852E4E]/60 hover:text-white"
            >
              {loadingAi ? "Fetching AI Resources..." : "AI Suggest Resources"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setActiveFilter(f.value as ResourceType | "all")}
              className={
                "text-xs md:text-sm px-3 py-1 rounded-full border transition-colors " +
                (activeFilter === f.value
                  ? "bg-[#852E4E] text-[#FFBB94] border-pink-700/80 shadow-sm"
                  : "bg-[#4C1D3D]/70 border-pink-700/40 text-pink-100 hover:bg-[#852E4E]/60")
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <section className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredResources.map((r) => (
            <article
              key={r.id}
              className="group relative flex flex-col rounded-2xl border bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20 hover:shadow-2xl hover:shadow-pink-900/30 transition-all overflow-hidden"
            >
              <div className="flex-1 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium text-sm md:text-base line-clamp-2 text-pink-100">
                    {r.title}
                  </h3>
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[10px] md:text-[11px] uppercase tracking-wide border-[#FFBB94]/70 text-[#FFBB94] bg-[#852E4E]/60"
                  >
                    {r.type}
                  </Badge>
                </div>
                <p className="text-xs md:text-sm text-pink-100/80 line-clamp-3">
                  {r.description}
                </p>
              </div>
              <div className="flex items-center justify-between px-4 pb-3 pt-1 text-[11px] text-pink-200/80">
                <span>{r.source === "ai" ? "AI" : ""}</span>
                <div className="flex items-center gap-2">
                  {r.source === "ai" && !r.saved && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveResource(r.id)}
                      className="h-7 px-3 text-xs border-[#FFBB94]/70 text-[#FFBB94] hover:bg-[#852E4E]/40"
                    >
                      Save
                    </Button>
                  )}
                  {r.source === "ai" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteResource(r.id)}
                      className="h-7 px-3 text-xs border-pink-700/70 text-pink-100 hover:bg-[#852E4E]/40"
                    >
                      Delete
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openInNewTab(r.url)}
                    className="h-7 px-3 text-xs bg-gradient-to-r from-[#852E4E] to-[#FFBB94] text-white hover:opacity-95"
                  >
                    Open
                  </Button>
                </div>
              </div>
            </article>
          ))}

          {filteredResources.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-pink-700/60 bg-[#4C1D3D]/70 p-6 text-center text-sm text-pink-100">
              No resources match your search yet. Try adjusting your filters or using
              <span className="font-medium"> AI Suggest Resources</span> to get started.
            </div>
          )}
        </section>
      </div>

      {/* Floating Add Resource button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setAddOpen(true)}
          className="rounded-full shadow-lg bg-gradient-to-r from-[#4C1D3D] to-[#FFBB94] text-white px-5 h-11 text-sm font-medium hover:opacity-95"
        >
          Add Resource
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) clearForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a learning resource</DialogTitle>
            <DialogDescription>
              Store links to content you want to revisit during your LearnNova sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="lr-title">Title</Label>
              <Input
                id="lr-title"
                placeholder="e.g. Spaced Repetition Explained"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lr-url">URL</Label>
              <Input
                id="lr-url"
                type="url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lr-description">Description</Label>
              <Input
                id="lr-description"
                placeholder="Optional short note about why this is useful."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as ResourceType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { clearForm(); setAddOpen(false); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddResource}
                disabled={!title.trim() || !url.trim()}
                className="bg-gradient-to-r from-[#4C1D3D] to-[#FFBB94] text-white hover:opacity-95"
              >
                Save resource
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
