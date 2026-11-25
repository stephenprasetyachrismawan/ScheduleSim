# ScheduleSim

Simulator penjadwalan ulang proyek perangkat lunak dengan tampilan alat manajemen proyek
(List, Board, Form, dan Timeline). Simulator ini memperagakan metode **ARLS-PPO** dari tesis
*Mekanisme Dynamic Rescheduling Berbasis Proximal Policy Optimization dengan Representasi Keadaan
Teragregasi untuk Manajemen Proyek Perangkat Lunak* (Universitas Gadjah Mada, 2026).

*A project-management style simulator for the ARLS-PPO rescheduling method. Every scheduling
number comes from the thesis code and the locked models in
[arls-ppo](https://github.com/stephenprasetyachrismawan/arls-ppo).*

Coba langsung di **https://sch.stevewithcode.net**.

![Form kejadian: breadcrumb, pager, tiga langkah, angka dengan asalnya, dan jadwal](docs/tangkapan/06_sim_event.png)

## Selaras dengan tesis

ScheduleSim tidak punya logika penjadwalan sendiri. Backend memanggil `arls_ppo` dari submodule
`vendor/arls-ppo`, yang dikunci ke satu commit repositori kode tesis.

- **Kode episode sama dengan uji tesis.** Episode dijalankan dengan `cek_episode.run`, fungsi yang
  dipakai `buka_uji.py` saat data uji dibuka. Lingkungan, gangguan TAWOS, tangga perbaikan,
  38 angka keadaan, guard, J, dan pemeriksa jadwal semuanya dari kode itu.
- **Model sama dengan uji tesis.** Sebelum model dimuat, SHA-256 setiap berkas dibandingkan
  dengan dokumen kunci uji (19 November 2026); berkas yang berbeda ditolak. Statusnya tampil di
  bilah atas ("Model = kunci uji") dan di halaman Tentang metode.
- **Selisih 0,0.** Di repositori arls-ppo, hasil episode pada seed validasi sama persis dengan
  hasil validasi E15 yang tersimpan. Jejak yang ditampilkan simulator diuji tidak mengubah hasil
  untuk kedelapan metode.
- **Data uji tetap terkunci.** MK03, MK04, MK09, 35 benchmark uji, dan seed uji
  (10000-10009, 11000-11004) tidak bisa disimulasikan. Hasil ujinya hanya dibaca dari berkas hasil
  Bab V di halaman *Hasil uji tesis*.
- **Nama dan angka mengikuti naskah:**
  - nama metode: ARLS-PPO, ARLS-PPO tanpa guard, ARLS-BC, AOR, Sequential Lookahead,
    Fixed-L3 + guard, Random + guard, Boosting-IL + guard;
  - istilah teknis tetap bahasa Inggris seperti di naskah: guard, selector, teacher,
    change penalty (λ), affected set;
  - λ 0,1 / 0,3 / 1 / 3 / 10 / 30;
  - kapasitas 1,0 / 1,5 / 2,0;
  - intensitas 0,05 / 0,15 / 0,30;
  - waktu dalam jam model, tanpa kalender.

## Pemetaan tesis ke tampilan

| Tampilan | Tesis |
|---|---|
| Project | instans (MK latih, benchmark latih atau validasi, atau proyek sendiri) |
| Epic | job; tugas dari pekerjaan tidak terencana masuk Epic "Pekerjaan tidak terencana" |
| Issue | operasi (tugas) |
| Assignee | pengembang (mesin); tab *Pengembang layak* berisi upaya per pengembang |
| Original estimate | upaya pada pengembang yang ditugaskan (jam) |
| Due | tenggat d_i dari S0 (selesai + setengah upaya) |
| Status | To Do / In Progress / Done pada waktu t; Reopened sesudah review gagal |
| Rank | posisi di antrean pengembang |
| Riwayat | lima jenis gangguan dan setiap perubahan yang dihitung; banyaknya sama dengan U |

## Halaman

- **Proyek dan view.** Ada empat view yang bisa diganti dari ikon di kanan atas:
  - List: group by, urut kolom, total;
  - Board: swimlane per assignee;
  - Form: statusbar, tab, dan riwayat;
  - Timeline: baris per assignee atau per epic, tenggat, dan dependensi.
- **Belajar dari nol** (`/belajar`). Ada sembilan pelajaran pendek untuk pembaca yang baru mengenal topik ini.
  Satu pelajaran membahas satu konsep:
  1. tugas dan pengembang;
  2. jadwal awal dan tenggat;
  3. gangguan;
  4. gangguan masuk tanpa perbaikan;
  5. empat tingkat perbaikan;
  6. J dan LIS;
  7. change penalty λ;
  8. teacher, ARLS-PPO, dan guard;
  9. satu episode.

  Setiap langkah berisi penjelasan singkat, jadwal mini dengan tugas yang perlu diperhatikan, dan kotak *Perhatikan*.
  Setiap pelajaran ditutup dengan soal yang memberi umpan balik tanpa langsung membuka jawaban. Semua contoh memakai
  proyek fiktif Kedai kopi yang dijalankan dengan kode penelitian, jadi angkanya diambil dari run itu, bukan diketik
  tangan. Kemajuan belajar disimpan di browser.
- **Simulasi gangguan, dengan pola Odoo.** Setiap layar memuat satu rekaman, dan alamatnya menyimpan
  semua pengaturan. Muat ulang, tombol Back, dan tautan yang dibagikan selalu kembali ke rekaman yang sama.
  Bila server sudah lupa run itu, misalnya sesudah restart, halaman mengirim pengaturan yang sama lagi dan
  hasilnya langsung diambil dari cache. Rekaman bertingkat:
  - **Run**: proyek, kapasitas, intensitas, seed, dan λ, dengan tab Metode (J episode semua metode), tab
    Gangguan (sama untuk semua metode), dan tab Input episode (S0, tenggat, E, kapasitas);
  - **Metode dalam run**: daftar kejadian satu per baris, ditutup baris *Akhir episode*, dan semua perubahan;
  - **Kejadian**: pager `3 / 16` yang hanya memindah kejadian metode itu. Statusbar ① sebelum gangguan →
    ② gangguan masuk (belum diperbaiki; di naskah tingkat 0 atau AOR) → ③ sesudah perbaikan. Tombol
    *Bandingkan metode lain* membuka kejadian yang sama untuk metode lain. Tab yang tersedia: Jadwal,
    Gangguan, Keputusan, Perubahan, dan Log hitung. Tombol putar berjalan ① → ② → ③ dengan kecepatan yang
    bisa dipilih, dan kotak *Perhatikan* menandai tugas yang perlu dilihat;
  - **Akhir episode**: jadwal sesudah kejadian terakhir sampai semua tugas selesai (garis hijau di
    Timeline), Tard/E akhir, ΣU, dan J episode.

  Breadcrumb `Simulasi / run / metode / kejadian` selalu bisa diklik untuk naik.
- **Asal angka (↗).** Tanda ↗ di samping angka membuka lembar samping yang memuat:
  - rumusnya;
  - angka yang masuk, masing-masing bisa dibuka lebih dalam;
  - daftar yang dijumlah, dengan baris Σ di bawahnya, misalnya 55 tugas untuk E;
  - kode yang menghitungnya.

  Semua angka di lembar itu dibaca dari log angka arls-ppo dan tidak dihitung ulang di browser.
- **Data master sampai berkas mentah.** Setiap tugas punya form sendiri. Isinya:
  - nomor di layar (MK01-56) dan id di kode dan naskah (55);
  - job dan urutan operasinya;
  - pengembang yang layak beserta upayanya;
  - dependensinya;
  - letaknya di berkas mentah, misalnya `data/raw/MK01.json → jobs[0][0]` beserta isinya apa adanya.

  Tugas tidak terencana menunjuk gangguan yang membuatnya. Proyek, pengembang, dan job juga punya form
  sendiri. Endpoint `GET /api/projects/{key}/master` membaca berkas itu lewat loader yang sama dengan
  episode tesis.
- **Log hitung.** Tab di form kejadian yang menguraikan dari mana setiap angka berasal:
  - *Input*: kapasitas, S0 (dibangun ulang dari berkas instans dan dicek sama), tenggat
    d_i = C_i + 0,5 × (C_i − S_i), E sebagai jumlah dibagi banyak tugas, seed gangguan, parameter TAWOS,
    dan daftar gangguan yang ditarik ulang dari seed lalu dicek sama;
  - *Proses*, per kejadian: ① efek setiap gangguan, ② AOR, ③ alasan setiap tugas masuk A_j, lalu per
    sub-keputusan ④ ke-38 angka keadaan beserta rumus dan angka yang masuk, ⑤ normalisasi, ⑥ jaringan
    actor (dua lapis Tanh, logit, softmax bermask), ⑦ tingkat yang diminta, ⑧ J keempat tingkat
    (tugas terlambat, pindah pengembang, antrean lama dan baru dengan LIS), ⑨ guard, ⑩ hasil;
  - *Output*: Tard akhir / E, Σ U, dan J episode.

  Setiap angka dihitung arls-ppo (`trace_episode(..., explain=True)`) pada saat kode penelitian
  menghitung angka yang sama, lalu dicek sama persis; kejadian contoh Subbab 4.6 naskah terulang angka
  demi angka. Tombol *Jalankan ulang dan bandingkan* menghitung episode yang sama tanpa cache dan
  membandingkan semua angkanya; hanya waktu (ms) yang boleh berbeda. Log bisa disalin sebagai teks
  atau diunduh sebagai JSON.
- **Mode belajar.** Tombol di bilah atas, mati secara bawaan. Bila dinyalakan, tanda ⓘ di samping
  istilah dan angka membuka penjelasan singkat beserta rumus dan subbab naskahnya, dan form
  kejadian punya tur tujuh langkah. Halaman *Istilah* memuat semua penjelasan itu.
- **Manual.** Ada dua mode, dan keduanya dibandingkan dengan ARLS-PPO dan AOR pada gangguan yang sama:
  - *pilih tingkat*: Anda memilih L0-L3 untuk setiap gangguan;
  - *geser kartu*: Anda menggeser kartu di Board. Setiap geseran diperiksa dengan aturan
    kelayakan tesis, dan yang melanggar ditolak beserta kode aturannya.
- **Proyek sendiri.** Buat epic, issue, upaya per pengembang, dan tautan lewat form. Proyek ini
  melewati transformasi yang sama dengan instans tesis. Kebijakan dilatih pada tujuh instans
  Brandimarte, jadi proyek sendiri berada di luar data latihnya. Dua contoh fiktif (Toko daring,
  Kedai kopi) sudah tersedia.
- **Hasil uji tesis** dan **Tentang metode.** Halaman ini berisi:
  - klaim utama dengan selang 98,75%;
  - semua λ;
  - butir 1;
  - indikator I-1 dan I-2;
  - tabel hash model.

| Run | Metode dalam run | Bandingkan metode lain |
|---|---|---|
| ![Run](docs/tangkapan/11_run.png) | ![Metode dalam run](docs/tangkapan/12_method_run.png) | ![Bandingkan](docs/tangkapan/13_banding.png) |

| Asal angka | Akhir episode | Tugas MK01-56 = id 55 |
|---|---|---|
| ![Asal angka](docs/tangkapan/16_asal_angka.png) | ![Akhir episode](docs/tangkapan/17_akhir.png) | ![Tugas 55](docs/tangkapan/18_tugas_55.png) |

| Form tugas dan berkas mentah | Log hitung | Hasil uji |
|---|---|---|
| ![Tugas](docs/tangkapan/05_task.png) | ![Log hitung](docs/tangkapan/10_log_proses.png) | ![Hasil uji](docs/tangkapan/08_results.png) |

| Belajar dari nol | Satu langkah pelajaran |
|---|---|
| ![Daftar pelajaran](docs/tangkapan/15_belajar_daftar.png) | ![Pelajaran](docs/tangkapan/14_belajar_pelajaran.png) |

## Menjalankan

Kloning beserta submodule (berisi model, sekitar 70 MB):

```bash
git clone --recurse-submodules https://github.com/stephenprasetyachrismawan/ScheduleSim
cd ScheduleSim
```

**Lokal** (Python 3.11 atau lebih baru, Node 22):

```bash
./jalankan.sh            # lalu buka http://127.0.0.1:8000
```

Saat pertama dijalankan, skrip ini memasang pustaka dengan versi yang sama dengan run tesis (torch
CPU) dan membangun frontend.

**Docker:**

```bash
ARLS_PPO_COMMIT=$(git -C vendor/arls-ppo rev-parse --short=12 HEAD) docker compose up --build
```

Pengaturan lewat variabel lingkungan:

- `SCHEDULESIM_WORKERS`: banyak proses pekerja, bawaan 4;
- `SCHEDULESIM_DATA`: folder proyek sendiri dan cache hasil;
- `SCHEDULESIM_PUBLIC=1`: mode situs publik (dipakai di sch.stevewithcode.net). Setiap pengunjung
  paling banyak punya 2 simulasi berjalan, antrean bersama paling banyak 12 episode, proyek contoh
  hanya bisa dibaca, proyek pengunjung hanya bisa diubah oleh browser yang membuatnya (paling banyak
  60 issue dan 10 pengembang), dan cache dijaga di bawah 2 GB.

## Pengembangan

```bash
cd backend && .venv/bin/python -m pytest          # proyeksi, API, jejak episode nyata
cd frontend && npm run dev                        # Vite di :5173, proxy /api ke :8000
cd frontend && npm test                           # filter, isi pelajaran terhadap data run contoh
cd e2e && npx playwright test                     # view proyek, rekaman simulasi, asal angka, log hitung, belajar
cd e2e && SCHEDULESIM_PORT=8010 npx playwright test  # terhadap server kedua di port lain
```

Struktur:

| Folder | Isi |
|---|---|
| `vendor/arls-ppo` | submodule kode, model, dan hasil tesis (dikunci per commit) |
| `backend/schedulesim` | `projection` (tesis ke konsep PM), `runner` (proses pekerja dan cache), `api` (FastAPI), `catalog`, `store` |
| `frontend/src` | React + TypeScript: `odoo` (breadcrumb, pager, statusbar, smart button, notebook, Asal angka), `pages/sim` (run, metode, kejadian, akhir), `pages/master` (proyek, tugas, pengembang, job), `components/views` (List, Board, Gantt) |
| `e2e` | tes Playwright dan skrip tangkapan layar |

Tampilan bergaya alat manajemen proyek pada umumnya. Komponen, ikon, warna, dan nama ScheduleSim
dibuat sendiri, tanpa aset atau merek produk lain.

## Lisensi

MIT. Data instans dan model: lihat README [arls-ppo](https://github.com/stephenprasetyachrismawan/arls-ppo).
