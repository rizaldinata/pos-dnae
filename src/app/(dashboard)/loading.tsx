import { Loader2 } from "lucide-react";

// Indikator navigasi App Router: muncul otomatis saat pindah halaman
// (route dynamic ini selalu menunggu render server, jadi boundary ini
// yang tampil selama muat — menghilangkan rasa "layar beku" antar halaman).
export default function DashboardLoading() {
  return (
    <div
      role="status"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <p className="text-sm">Memuat halaman...</p>
    </div>
  );
}
