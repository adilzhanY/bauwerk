import { Viewport } from "@/scene/Viewport";

export function App() {
  return (
    <div className="grid h-full grid-cols-[280px_1fr_300px] grid-rows-[1fr_40px]">
      <aside className="border-r border-border bg-panel" />
      <main className="relative bg-bg">
        <Viewport />
      </main>
      <aside className="border-l border-border bg-panel" />
      <footer className="col-span-3 border-t border-border bg-panel" />
    </div>
  );
}
