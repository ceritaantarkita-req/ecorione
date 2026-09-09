"use client";

import { useCallback, useEffect, useState } from "react";
import type { CoreMemory, SpacePage } from "@ecorione/shared-schema";

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as unknown;
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}: ${JSON.stringify(body)}`);
  return body as T;
}

export default function SpacePageView() {
  const [pages, setPages] = useState<SpacePage[]>([]);
  const [memory, setMemory] = useState<CoreMemory>({ blocks: [] });
  const [title, setTitle] = useState("");
  const [label, setLabel] = useState("preferences");
  const [description, setDescription] = useState("Preferensi pengguna");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [pageResult, memoryResult] = await Promise.all([
        fetch("/api/space/pages?scope=personal", { cache: "no-store" }),
        fetch("/api/space/core-memory?scope=personal&maxSensitivity=RESTRICTED", {
          cache: "no-store",
        }),
      ]);
      setPages((await readJson<{ pages: SpacePage[] }>(pageResult)).pages);
      setMemory(await readJson<CoreMemory>(memoryResult));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createPage(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length === 0) return;
    try {
      await readJson(
        await fetch("/api/space/pages", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: title.trim(), scope: "personal" }),
        }),
      );
      setTitle("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveMemory(event: React.FormEvent) {
    event.preventDefault();
    try {
      await readJson(
        await fetch(`/api/space/core-memory/${encodeURIComponent(label)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            description,
            value,
            scope: "personal",
            sensitivity: "INTERNAL",
            syncClass: "LOCAL_ONLY",
          }),
        }),
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: 32, fontFamily: "sans-serif" }}>
      <header style={{ marginBottom: 32 }}>
        <a href="/" style={{ color: "inherit" }}>
          ← Ai
        </a>
        <h1>Space</h1>
        <p>
          Catatan terstruktur dan editor teks memori inti. Core memory tetap disimpan oleh
          Context.
        </p>
      </header>
      {error !== null ? <p role="alert">{error}</p> : null}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <h2>Notes</h2>
          <form onSubmit={createPage} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Judul halaman"
              style={{ flex: 1, padding: 10 }}
            />
            <button type="submit">Buat</button>
          </form>
          <ul>
            {pages.map((page) => (
              <li key={page.id}>{page.title}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Core memory</h2>
          <div style={{ marginBottom: 16 }}>
            {memory.blocks.map((block) => (
              <button
                type="button"
                key={block.label}
                onClick={() => {
                  setLabel(block.label);
                  setDescription(block.description);
                  setValue(block.value);
                }}
                style={{ marginRight: 8, marginBottom: 8 }}
              >
                {block.label}
              </button>
            ))}
          </div>
          <form onSubmit={saveMemory} style={{ display: "grid", gap: 10 }}>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="label"
            />
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="deskripsi"
            />
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              rows={12}
              placeholder="Teks yang benar-benar disimpan sebagai core memory"
            />
            <button type="submit">Simpan ke Context</button>
          </form>
        </div>
      </section>
    </main>
  );
}
