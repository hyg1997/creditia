const mxnFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMXN(amount: number): string {
  return mxnFormatter.format(amount);
}

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDate(date: Date | string): string {
  if (typeof date === "string") {
    // If already formatted as DD/MM/YYYY, return as-is
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;
    // ISO string — parse and format
    const d = new Date(date);
    const day = d.getUTCDate().toString().padStart(2, "0");
    const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    return `${day}/${month}/${d.getUTCFullYear()}`;
  }
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
