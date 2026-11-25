// Glossary for learning mode. Terms and section numbers follow the thesis manuscript
// (Daftar Istilah and the numbering of Bab III-V); English terms stay English so the reader
// can search the literature with them.

export interface Term {
  term: string;
  en?: string;
  body: string;
  formula?: string;
  ref?: string;
}

export const GLOSSARY: Record<string, Term> = {
  // ---------------------------------------------------------------- input
  instance: {
    term: "Instans dan proyek", en: "instance",
    body: "Satu soal penjadwalan Brandimarte (MK01, ...) atau benchmark lain, dibaca sebagai proyek: job menjadi epic (fitur), operasi menjadi issue (tugas), mesin menjadi pengembang, waktu proses menjadi upaya.",
    ref: "Subbab 3.2.1",
  },
  capacity: {
    term: "Kapasitas pengembang", en: "capacity",
    body: "Batas beban kerja setiap pengembang. Pengali m (1,0 / 1,5 / 2,0) mengatur seberapa longgar batas itu.",
    formula: "cap_j = m × (Σ upaya nominal / banyak pengembang)", ref: "Subbab 3.2.1",
  },
  s0: {
    term: "Jadwal awal S0", en: "initial schedule",
    body: "Jadwal sebelum gangguan pertama, disusun dengan list scheduling: tugas yang siap diurutkan menurut tenggat, lalu diberikan ke pengembang layak dengan beban terkecil.",
    ref: "Subbab 3.2.3",
  },
  due: {
    term: "Tenggat d_i", en: "due date",
    body: "Batas waktu selesai tugas. Diturunkan dari S0: waktu selesai di S0 ditambah setengah upayanya, sehingga S0 sendiri tidak terlambat.",
    formula: "d_i = C_i + 0,5 × (C_i − S_i)", ref: "Subbab 3.2.3",
  },
  E: {
    term: "E, rata-rata upaya", en: "mean effort",
    body: "Rata-rata upaya tugas di S0. Dipakai sebagai satuan keterlambatan, supaya instans kecil dan besar sebanding.",
    formula: "E = Σ (C_i − S_i) di S0 / banyak tugas", ref: "Subbab 3.3.5",
  },
  seed: {
    term: "Seed episode", en: "episode seed",
    body: "Bilangan yang menentukan seluruh urutan gangguan. Seed yang sama memberi gangguan yang sama untuk semua metode, jadi metode dibandingkan pada soal yang sama. Seed validasi 5000 dan 5001; seed uji ditolak.",
    ref: "Subbab 3.4.2",
  },
  intensity: {
    term: "Intensitas gangguan", en: "disruption intensity",
    body: "Seberapa banyak gangguan. 0,15 = median data TAWOS; 0,05 dan 0,30 = sepertiga dan dua kali median.",
    formula: "m = intensitas / 0,15", ref: "Subbab 3.2.4",
  },
  // ---------------------------------------------------------------- disruptions
  disruption: {
    term: "Gangguan ξ_j", en: "disruption",
    body: "Peristiwa yang mengubah jadwal yang sedang berjalan. Ada lima jenis, dikalibrasi dari data Jira TAWOS: pekerjaan tidak terencana, revisi estimasi, rework, perubahan prioritas, pengembang tidak tersedia.",
    ref: "Subbab 3.2.4",
  },
  event: {
    term: "Kejadian", en: "event",
    body: "Sekelompok gangguan yang jatuh dalam satu E dari gangguan pertamanya. Semuanya ditangani dalam satu waktu keputusan, pada waktu anggota terakhir.",
    ref: "Subbab 3.2.4 dan 3.3.2",
  },
  subdecision: {
    term: "Sub-keputusan", en: "sub-decision",
    body: "Satu pilihan tingkat perbaikan untuk satu gangguan di dalam kejadian, diambil berurutan menurut datangnya gangguan.",
    ref: "Subbab 3.3.2",
  },
  aor: {
    term: "AOR, tingkat 0", en: "affected operations rescheduling",
    body: "Gangguan diterapkan dan tugas yang terdampak digeser ke kanan seperlunya. Antrean dan assignee tidak diubah, jadi hasilnya selalu layak dan tanpa perubahan.",
    ref: "Subbab 3.3.3",
  },
  affected: {
    term: "Affected set A_j", en: "affected set",
    body: "Tugas yang terkena gangguan ξ_j: sasaran langsung (tugas baru, tugas yang direvisi, tugas milik pengembang yang tidak tersedia) ditambah tugas yang tergeser lalu melewati tenggat.",
    ref: "Subbab 3.3.3",
  },
  // ---------------------------------------------------------------- repair
  ladder: {
    term: "Repair ladder", en: "repair ladder",
    body: "Empat tingkat perbaikan yang jangkauannya makin luas: L0 pertahankan AOR, L1 Resequence, L2 Reassign, L3 Partial rescheduling.",
    ref: "Subbab 3.3.4",
  },
  L1: { term: "L1 Resequence", body: "Memajukan tugas A_j yang belum mulai ke posisi menurut tenggat terdekat di antrean pengembangnya sendiri.", ref: "Subbab 3.3.4" },
  L2: { term: "L2 Reassign", body: "Memindahkan paling banyak tiga tugas A_j yang paling terlambat ke pengembang lain yang layak; pindahan diterima hanya bila keterlambatan total turun.", ref: "Subbab 3.3.4" },
  L3: { term: "L3 Partial rescheduling", body: "Mengeluarkan paling banyak delapan tugas belum mulai di sekitar t, lalu menyisipkannya kembali satu per satu, tenggat terdekat dulu.", ref: "Subbab 3.3.4" },
  mask: {
    term: "Mask", en: "action mask",
    body: "Penanda tingkat yang boleh dipilih: 1 bila operator tingkat itu punya calon perbaikan yang sah untuk A_j. Tingkat 0 selalu boleh.",
    ref: "Subbab 3.3.4",
  },
  feasibility: {
    term: "Kelayakan", en: "feasibility",
    body: "Syarat setiap pindahan: tugas belum selesai, pengembang punya keahlian dan tersedia, pendahulu sudah terjadwal, sisa beban dalam kapasitas.",
    ref: "Subbab 3.3.4",
  },
  // ---------------------------------------------------------------- value
  J: {
    term: "Nilai gabungan J", en: "linear scalarization",
    body: "Satu angka yang menimbang keterlambatan dan banyak perubahan. Makin kecil makin baik.",
    formula: "J = Tard / E + λ × U", ref: "Subbab 3.3.5",
  },
  tardiness: {
    term: "Keterlambatan total Tard", en: "tardiness",
    body: "Jumlah keterlambatan semua tugas; tugas yang selesai sebelum tenggat menyumbang 0.",
    formula: "Tard = Σ max(0, C_i − d_i)", ref: "Subbab 3.3.5",
  },
  U: {
    term: "Banyak perubahan U", en: "schedule changes",
    body: "Tugas yang pindah pengembang ditambah tugas yang harus dipindah posisinya di antrean. Memajukan satu tugas melewati sepuluh tugas lain dihitung satu perubahan, bukan sebelas.",
    formula: "U = tugas pindah pengembang + Σ (n − LIS)", ref: "Subbab 3.3.5",
  },
  lis: {
    term: "LIS", en: "longest increasing subsequence",
    body: "Barisan naik terpanjang dari posisi lama tugas yang tetap di pengembang yang sama. Tugas di dalam LIS tidak perlu disentuh; sisanya, n − LIS, adalah tugas yang pindah posisi.",
    ref: "Subbab 3.3.5",
  },
  lambda: {
    term: "Change penalty λ", en: "change penalty",
    body: "Harga satu perubahan jadwal di dalam J. λ kecil: perubahan murah, kejar keterlambatan. λ besar: jadwal dijaga tetap. Satu kebijakan menerima λ sebagai masukan (log λ). Nilai berlabel 0,3, 3, dan 30.",
    formula: "J = Tard / E + λ × U", ref: "Subbab 3.3.5 dan 3.4.2",
  },
  // ---------------------------------------------------------------- selector
  state: {
    term: "Keadaan 38 angka", en: "aggregated state",
    body: "Ringkasan yang dibaca selector: 9 angka tentang seluruh jadwal dan 29 angka tentang gangguan saat ini, A_j, pengembang, posisi di dalam kejadian, dan log λ. Panjangnya tidak bergantung pada besar proyek.",
    ref: "Subbab 3.3.6 dan 4.4.1",
  },
  normalize: {
    term: "Normalisasi", en: "standardization",
    body: "Setiap angka keadaan dikurangi rata-ratanya lalu dibagi simpangan bakunya (dihitung dari contoh teacher), lalu dipotong ke rentang −5 sampai 5. Hasilnya masukan jaringan.",
    formula: "z = clip((x − μ) / σ, −5, 5)", ref: "Subbab 3.3.7",
  },
  actor: {
    term: "Jaringan actor", en: "actor network",
    body: "MLP dua lapis tersembunyi berukuran 128 dengan aktivasi Tanh, milik MaskablePPO. Keluarannya empat logit, satu per tingkat.",
    formula: "h1 = tanh(W1·z + b1), h2 = tanh(W2·h1 + b2), logit = W3·h2 + b3", ref: "Subbab 3.3.7",
  },
  softmax: {
    term: "Softmax bermask", en: "masked softmax",
    body: "Logit tingkat yang tertutup mask dibuang; sisanya diubah menjadi peluang. Kebijakan dijalankan deterministik: tingkat dengan peluang terbesar yang diminta.",
    formula: "p_k = e^(z_k − z_max) / Σ e^(z − z_max)", ref: "Subbab 4.6.2",
  },
  selector: {
    term: "Selector", en: "selector, algorithm selection",
    body: "Bagian yang memilih tingkat perbaikan pada setiap sub-keputusan. Pada ARLS-PPO, selector-nya jaringan actor; pada pembanding, aturan atau model lain.",
    ref: "Subbab 3.3.7 dan 4.4.2",
  },
  guard: {
    term: "Guard", en: "guard",
    body: "Pemeriksaan sesudah selector memilih: tingkat yang diminta dicoba pada salinan jadwal, dan ditolak (kembali ke tingkat 0) bila J calon lebih besar daripada J sekarang.",
    formula: "terima bila J_calon ≤ J_sekarang + 10⁻⁹", ref: "Subbab 3.3.7 dan 4.4.3",
  },
  teacher: {
    term: "Teacher: Sequential Lookahead", en: "teacher, expert",
    body: "Aturan yang mencoba ketiga tingkat pada setiap sub-keputusan lalu memakai J terkecil. Lambat, tetapi menjadi contoh yang ditiru kebijakan.",
    ref: "Subbab 3.3.8 dan 4.5.1",
  },
  training: {
    term: "Pelatihan ARLS-PPO", en: "behavior cloning, DAgger, PPO",
    body: "Behavior cloning meniru pilihan teacher, satu putaran DAgger menambah contoh dari keadaan yang dikunjungi student, lalu 100.000 langkah PPO.",
    ref: "Subbab 3.3.8",
  },
  methods: {
    term: "Delapan metode", body: "ARLS-PPO; ARLS-PPO tanpa guard; ARLS-BC (sebelum tahap PPO); AOR; Sequential Lookahead; Fixed-L3 + guard; Random + guard; Boosting-IL + guard.",
    ref: "Subbab 3.4.1",
  },
  hard: {
    term: "Pelanggaran keras", en: "hard constraint violation",
    body: "Pelanggaran aturan jadwal yang membuat jadwal tidak sah, diperiksa oleh pemeriksa jadwal mandiri pada setiap keputusan. Indikator I-2 menuntut nol.",
    ref: "Subbab 3.4.3 dan 4.7.2",
  },
  p95: {
    term: "p95 waktu selector", body: "Persentil ke-95 waktu satu panggilan selector. Indikator I-1 menuntut di bawah 50 ms. Waktu adalah satu-satunya angka yang berubah dari run ke run.",
    ref: "Subbab 3.4.3",
  },
  determinism: {
    term: "Deterministik", body: "Dengan instans, kapasitas, intensitas, seed, λ, metode, dan berkas model yang sama, setiap angka episode sama persis. Hanya waktu (ms) yang berbeda. Tombol \"Jalankan ulang dan bandingkan\" membuktikannya.",
  },
  // ---------------------------------------------------------------- project-management view
  pm: {
    term: "Tampilan alat manajemen proyek", body: "Project = instans, Epic = job, Issue = tugas, Assignee = pengembang, Original estimate = upaya, Due = tenggat, Rank = posisi di antrean, History = gangguan dan perubahan yang dihitung. Nomor issue = id tugas + 1 dan Pengembang n = id + 1, karena naskah dan kode memakai id mulai dari 0.",
  },
  rank: { term: "Rank", body: "Posisi tugas di antrean pengembangnya. Perubahan rank dihitung lewat n − LIS." },
  phases: {
    term: "Tiga fase kejadian", body: "Sebelum gangguan → sesudah AOR (gangguan diterapkan, tingkat 0) → sesudah perbaikan (tingkat yang dipilih metode). Bayangan abu-abu di Timeline menunjukkan posisi pada fase sebelumnya.",
  },
};

export const TERM_ORDER = Object.keys(GLOSSARY);
