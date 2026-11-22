import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { LEVEL_NAMES, LEVEL_SHORT, Ladder, Spinner } from "../components/atoms";

const LEVEL_TEXT = [
  "Tidak mengubah apa pun sesudah AOR. AOR menggeser tugas terdampak seperlunya dan mempertahankan antrean serta assignee setiap pengembang, jadi hasilnya selalu layak.",
  "Memajukan tugas A_j yang belum mulai ke posisi menurut tenggat terdekat di antrean pengembangnya.",
  "Memindahkan paling banyak tiga tugas A_j yang paling lambat ke pengembang dan posisi lain; pindahan diterima hanya bila keterlambatan total turun.",
  "Mengeluarkan paling banyak delapan tugas belum mulai di sekitar t, lalu menyisipkannya kembali satu per satu, tenggat terdekat dulu; hasilnya dibuang bila keterlambatan total naik.",
];

export default function MethodPage() {
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: Infinity });
  return (
    <div className="page">
      <div className="crumbs">Tesis</div>
      <div className="page__head"><h1 className="page__title">Tentang metode</h1></div>
      <div className="prose">
        <p>ScheduleSim menjalankan kode yang sama dengan pengujian tesis <em>Mekanisme Dynamic Rescheduling Berbasis
          Proximal Policy Optimization dengan Representasi Keadaan Teragregasi untuk Manajemen Proyek Perangkat
          Lunak</em> (Universitas Gadjah Mada, 2026). Metode usulannya ARLS-PPO, resep E15 E9c.</p>
        <h2 className="section-title">Satu kejadian</h2>
        <p>Gangguan yang datang dalam rentang satu rata-rata upaya tugas digabung menjadi satu kejadian. Semua
          gangguan kejadian itu lebih dulu diterapkan dengan AOR. Lalu, untuk setiap gangguan d_j menurut urutan
          datangnya, dibentuk himpunan terdampak A_j: tugas yang langsung terkena ditambah tugas yang waktu
          selesainya mundur dan melewati tenggat. Pemilih kemudian memilih satu tingkat perbaikan untuk A_j.</p>
        {LEVEL_NAMES.map((name, lv) => (
          <div key={lv} className="dis"><Ladder level={lv} size={1.2} />
            <span><strong>{LEVEL_SHORT[lv]} · {name}.</strong> {LEVEL_TEXT[lv]}</span></div>
        ))}
        <p>Setiap pindahan tugas harus menjaga tugas belum selesai, keahlian dan ketersediaan pengembang,
          pendahulu yang sudah terjadwal, dan sisa beban dalam kapasitas. Pemeriksaan yang sama menjadi mask:
          tingkat tanpa calon ditutup, dan tingkat 0 selalu terbuka.</p>
        <h2 className="section-title">Satu ukuran dengan satu harga perubahan</h2>
        <div className="formula">J = Tard / E + λ · U,  U = tugas pindah pengembang + (n − LIS)</div>
        <p>E adalah rata-rata upaya tugas di S0, dan LIS adalah barisan naik terpanjang dari posisi lama tugas yang
          tetap di pengembang yang sama. J episode = keterlambatan akhir / E + λ dikali jumlah perubahan.</p>
        <h2 className="section-title">Pemilih ARLS-PPO</h2>
        <p>Kebijakan MaskablePPO (MLP 128×128, Tanh) membaca 38 angka teragregasi: 9 tentang seluruh jadwal dan 29
          tentang gangguan saat ini dan A_j. Penjaga menolak tingkat yang membuat J lebih buruk daripada jadwal
          sekarang. Kebijakan dilatih dengan behaviour cloning dari guru Sequential Lookahead, satu putaran DAgger
          (86.832 baris), lalu 100.000 langkah PPO.</p>
      </div>

      <h2 className="section-title">
        {meta.data?.models_match_test_lock ? <ShieldCheck size={18} color="var(--success)" /> : <ShieldAlert size={18} color="var(--danger)" />}
        Berkas model dan dokumen kunci uji
      </h2>
      <p className="page__sub" style={{ margin: "0 0 10px" }}>Saat dibuka, backend menghitung SHA-256 setiap berkas model di
        submodule arls-ppo (commit <span className="mono">{meta.data?.arls_ppo_commit ?? "…"}</span>) dan membandingkannya
        dengan bagian 2 dokumen kunci uji yang disetujui 19 November 2026. Metode yang berkasnya berbeda ditolak.</p>
      {!meta.data ? <Spinner /> : (
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>Berkas</th><th>SHA-256 kunci uji</th><th>Status</th></tr></thead>
            <tbody>
              {meta.data.models.map((f) => (
                <tr key={f.path}><td className="mono">{f.path}</td><td className="mono small">{f.expected}</td>
                  <td>{f.ok ? <span className="lozenge lozenge--done">cocok</span>
                    : <span className="lozenge lozenge--reop">{f.actual ? "berbeda" : "hilang"}</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="section-title">Delapan metode yang dilaporkan</h2>
      <div className="table-wrap" style={{ maxWidth: 720 }}>
        <table className="grid">
          <thead><tr><th>Nama di naskah</th><th>Kode</th><th>Belajar</th><th>Penjaga</th></tr></thead>
          <tbody>
            {meta.data?.methods.map((m) => (
              <tr key={m.code}><td><strong>{m.name}</strong></td><td className="mono small">{m.code}</td>
                <td>{m.learned ? "ya" : "tidak"}</td><td>{m.guard ? "ya" : "tidak"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
