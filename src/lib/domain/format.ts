const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function nextWeekday(name: string, from = new Date()): string {
  const target = WEEKDAYS.indexOf(
    name.toLowerCase() as (typeof WEEKDAYS)[number],
  );
  if (target < 0) return from.toISOString().slice(0, 10);
  const result = new Date(from);
  const delta = (target - from.getDay() + 7) % 7 || 7;
  result.setDate(from.getDate() + delta);
  return result.toISOString().slice(0, 10);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "Date unset";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(hhmm: string | null): string {
  if (!hhmm) return "Time unset";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatClock(startTime: string | null, offsetMinutes: number): string {
  const base = startTime ?? "19:00";
  const [h, m] = base.split(":").map(Number);
  const total = h * 60 + m + offsetMinutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return formatTime(
    `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
  );
}

export function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
