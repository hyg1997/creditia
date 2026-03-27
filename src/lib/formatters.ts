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
  const d = typeof date === "string" ? new Date(date) : date;
  // Use UTC to avoid timezone offset shifting the date by 1 day
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
