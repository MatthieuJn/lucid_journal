import { ActivityTimeline } from "@/components/ActivityTimeline";

export default function Home() {
  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-white">Lucid Journal</h1>
      <ActivityTimeline />
    </main>
  );
}
