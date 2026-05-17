export type ActivitySource = "pc" | "android";

export interface ActivityEvent {
  id?: string;
  source: ActivitySource;
  bucket_id: string;
  event_id: number;
  timestamp: string;       // ISO 8601
  duration_seconds: number;
  app: string | null;
  title: string | null;
  raw_data: Record<string, unknown>;
  created_at?: string;
}

export interface TimelineSlot {
  hour: number;
  events: ActivityEvent[];
}
