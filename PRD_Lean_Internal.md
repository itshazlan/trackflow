# Product Requirements Document (PRD) — Versi Lean Internal
## TrackFlow — Web Project Management & Desktop Time Tracker

| | |
|---|---|
| **Versi Dokumen** | 3.6 (Lean Internal) |
| **Status** | Draft |
| **Tanggal** | 14 Juli 2026 (revisi: Peringkat Aktivitas Time Book diganti total menjadi Live Status — daftar Aktif/Idle/Offline realtime, bukan lagi laporan skor historis) |
| **Dokumen Terkait** | SDD_Lean_Internal.md |
| **Menggantikan** | PRD.md v1.0 (disimpan sebagai referensi bila di masa depan produk ini akan dikembangkan menjadi produk multi-klien) |

> Dokumen ini adalah versi yang **disederhanakan** dari PRD v1.0, disesuaikan untuk kebutuhan **pemakaian internal satu kantor** (bukan produk SaaS yang dijual ke banyak perusahaan). Beberapa lapisan governance yang dirancang untuk skenario multi-pihak yang tidak saling percaya (SaaS) dihilangkan atau disederhanakan. Ringkasan perbandingan ada di §13.

---

## 1. Ringkasan Eksekutif

TrackFlow adalah sistem manajemen proyek berbasis web yang dipadukan dengan aplikasi *time tracker* desktop, dipakai secara internal oleh satu kantor untuk mengelola proyek, tiket, dan jam kerja tim (termasuk tim remote/outsourced) dengan bukti kerja (screenshot & aktivitas).

---

## 2. Latar Belakang & Masalah yang Diselesaikan

| Masalah | Solusi TrackFlow |
|---|---|
| Manajer tidak punya visibilitas real-time terhadap pekerjaan tim remote | Dashboard monitoring real-time + bukti kerja (screenshot & aktivitas) |
| Tools manajemen proyek dan time tracking terpisah | Satu platform terpadu: tiket, waktu kerja, dan laporan dalam satu tempat |
| Approval timesheet manual/berbasis spreadsheet | Approval timesheet terintegrasi dengan bukti kerja per blok waktu |
| Privasi pekerja terganggu oleh screenshot (data sensitif tertangkap) | Fitur hapus blok waktu 10 menit oleh pekerja sendiri (konsekuensi: waktu hangus) |
| Aktivitas di luar komputer (meeting luring, telepon klien) tidak tercatat | Input waktu manual (offline time) |
| Tiket bug ditulis tidak konsisten, sulit ditelusuri | Issue Template preset (khususnya Bug) agar laporan bug selalu lengkap |

---

## 3. Tujuan Produk

1. Satu platform yang menggabungkan manajemen proyek berbasis tiket dan pelacakan waktu kerja otomatis berbasis bukti.
2. Memberi Manager/Admin alat verifikasi objektif tanpa mengorbankan privasi dasar pekerja.
3. Alur kerja tiket yang jelas namun tetap bisa disesuaikan (tambah/ubah/hapus status) tanpa perlu sistem konfigurasi yang rumit.
4. Laporan jam kerja akurat, dapat diekspor untuk keperluan internal (payroll/evaluasi tim).
5. Pengalaman UI/UX modern setara Linear/Plane.

### Non-Goals
- Payroll/penggajian otomatis.
- Manajemen HR (cuti, absensi, kontrak).
- Native mobile app.
- **Dukungan multi-klien/multi-perusahaan** — produk ini didesain khusus untuk dipakai satu kantor saja (lihat §13 untuk konsekuensi desainnya).

---

## 4. Prinsip Desain "Lean Internal"

Karena TrackFlow dipakai oleh satu tim internal yang saling mengenal dan saling percaya (bukan banyak perusahaan asing yang perlu diisolasi satu sama lain), beberapa area sengaja **tidak** dirancang seketat produk SaaS komersial:

- **Tidak ada konsep "organisasi" sebagai entitas terpisah** — cukup satu set pengaturan aplikasi (branding, kebijakan retensi), bukan tabel relasional yang mendukung banyak organisasi.
- **Hak admin cukup 1 flag sederhana** (`is_admin`), bukan hierarki Owner/Admin/Member dengan pencatatan siapa-memberi-peran-ke-siapa.
- **Override/hapus blok waktu pekerja lain cukup dibatasi ke Admin saja** — tidak perlu sistem izin granular per-Manager, karena jumlah orang yang butuh kewenangan ini biasanya sangat sedikit (1–2 orang, misal IT/Ops lead).
- **Workflow tiket punya default yang jelas dan tetap bisa dikustomisasi** (tambah/hapus/ubah nama status), tapi aturan siapa-boleh-set-status-apa dibuat sesederhana mungkin: cukup satu pengecualian (misal "hanya QA yang bisa set Done"), bukan matriks role x status yang kompleks.

Prinsip ini mengurangi jumlah tabel, guard, dan endpoint yang perlu dibangun — mempercepat waktu pengembangan MVP secara signifikan tanpa mengurangi fitur inti yang benar-benar dibutuhkan tim internal.

---

## 5. Target Pengguna & Level Akses

| Persona | Level Akses | Kebutuhan Utama |
|---|---|---|
| **Admin** | Aplikasi (`is_admin = true`) | Kelola user & pengaturan aplikasi (mis. retensi screenshot), punya akses baca ke semua proyek, satu-satunya pihak yang bisa override/hapus blok waktu milik pekerja lain. Biasanya 1–2 orang (mis. IT/Ops lead, atau pemilik bisnis) |
| **Manager** | Per-Proyek | Memantau progres tim real-time, melihat total jam kerja, memverifikasi bukti kerja, menyetujui/menolak timesheet, mengatur status/workflow tiket pada proyek yang diampu |
| **Developer** | Per-Proyek | Melihat tugas yang ditugaskan, memastikan desktop client tersinkronisasi, memperbarui status tiket sesuai batasan |
| **QA (Quality Assurance)** | Per-Proyek | Memverifikasi tiket "Resolved", satu-satunya yang bisa mengubah status tiket menjadi "Done" (default rule, bisa diubah) |

> Seorang user bisa punya role proyek berbeda di proyek berbeda (mis. Manager di Proyek A, Developer di Proyek B), terlepas dari status `is_admin`-nya.

---

## 6. Ruang Lingkup

### 6.1 Dalam Lingkup
- Web app: manajemen proyek, tiket, time book, reporting.
- Desktop client (Tauri, Windows/macOS/Linux): time tracking, screenshot, activity logging, sync.
- Cloudflare R2 untuk file (screenshot & dokumen proyek).
- Ekspor laporan PDF/CSV.

### 6.2 Di Luar Lingkup
- Aplikasi mobile.
- Integrasi pihak ketiga (Slack, Jira, GitHub) — dipertimbangkan nanti.
- Fitur chat internal.
- Payroll/invoicing otomatis.
- **Dukungan multi-organisasi/multi-klien dalam satu instalasi.**

---

## 7. Kebutuhan Fungsional

### 7.1 Autentikasi & Akses

| ID | Requirement |
|---|---|
| FR-001 | Pengguna login menggunakan email & password (via Better Auth) |
| FR-002 | Admin (`is_admin=true`) dapat menambahkan user baru dan mengatur flag admin pada user lain |
| FR-003 | Setiap user yang ditambahkan ke sebuah proyek diberi salah satu role: **Manager**, **Developer**, atau **Reporter/QA** |
| FR-004 | Role proyek menentukan hak akses: Manager (kelola proyek, approve timesheet, atur status tiket), Developer (kerjakan tugas, submit waktu), Reporter/QA (verifikasi tiket) |
| FR-005 | Admin memiliki akses **baca dan tulis** implisit ke semua proyek untuk keperluan pengawasan maupun pengelolaan tim — termasuk menambahkan/mengubah role anggota pada proyek manapun — tanpa perlu didaftarkan sebagai member terlebih dahulu di proyek tersebut |

### 7.1.1 Profil Pengguna & Informasi Kepegawaian

| ID | Requirement |
|---|---|
| FR-006 | Setiap pengguna memiliki profil berisi: **username** (unik, wajib), **foto profil**, dan **email** (dari akun login) |
| FR-007 | Pengguna dapat melengkapi informasi kepegawaian esensial pada profilnya: nomor telepon, **jabatan**, **departemen/divisi** |
| FR-008 | Admin dapat melengkapi/mengubah data kepegawaian tambahan untuk user manapun: **nomor induk karyawan (employee ID)**, **tanggal bergabung**, dan **status kepegawaian** (Aktif/Tidak Aktif/Cuti). Kecuali username, seluruh informasi kepegawaian ini bersifat **opsional** — tidak menghambat penggunaan sistem bila belum lengkap diisi |
| FR-009 | Saat karyawan resign, akun diubah menjadi **Tidak Aktif** (bukan dihapus) — histori tiket, timesheet, dan time block miliknya tetap tersimpan utuh |
| FR-009a | Aksi **"Hapus Akun"** oleh Admin di UI menjalankan hal yang sama seperti FR-009: menonaktifkan login (`employmentStatus = inactive`) dan memaksa logout seluruh sesi aktif pengguna tersebut (web maupun desktop client) — **bukan menghapus baris data** pengguna |
| FR-009b | Penghapusan data pengguna secara permanen (hard delete) hanya diizinkan untuk akun yang **belum memiliki riwayat kerja sama sekali** (0 tiket, 0 time block, 0 komentar) — mis. akun testing yang tidak pernah dipakai. Untuk akun yang sudah punya riwayat kerja, sistem menolak permintaan hard delete dan mengarahkan ke nonaktifkan (FR-009a) |

### 7.2 Struktur Proyek & Sub-proyek

| ID | Requirement |
|---|---|
| FR-010 | Pengguna dengan hak sesuai dapat membuat proyek baru |
| FR-011 | Di dalam proyek, dapat dibuat Sub-project (mis. "Aplikasi Mobile" → "Android", "iOS") |
| FR-012 | Setiap proyek independen: anggota tim & modul aktif diatur terpisah per proyek |
| FR-013 | Saat membuat proyek (termasuk sub-proyek), pengguna mengisi **Kode Proyek** (project key) unik secara global — mis. `TRACK`, `MOB-AND` — dipakai sebagai prefix Issue ID (`{key}-{nomor}`, mis. `TRACK-142`). Kode bersifat **permanen** setelah proyek dibuat |
| FR-014 | **Setiap sub-proyek memiliki Kode Proyek dan penomoran issue sendiri, independen dari proyek induknya** — bukan berbagi satu urutan nomor dengan induknya (mis. proyek "Aplikasi Mobile" berkode `MOB` dan sub-proyek "Android" berkode `AND` masing-masing mulai dari nomor 1) |
| FR-015 | Nama dan deskripsi proyek/sub-proyek dapat **diedit** setelah dibuat oleh Manager proyek terkait atau Admin. **Kode Proyek (`key`) tidak dapat diubah** setelah dibuat (tetap immutable, FR-013) |
| FR-016 | Proyek/sub-proyek dapat **diarsipkan** (soft-delete) oleh Manager/Admin — data (tiket, jam kerja, laporan) tetap tersimpan utuh, proyek disembunyikan dari tampilan default namun tetap bisa dicari lewat filter "Tampilkan Terarsip" |
| FR-017 | Proyek dengan sub-proyek yang masih aktif **tidak dapat** diarsipkan sebelum seluruh sub-proyeknya diarsipkan terlebih dahulu |
| FR-018 | **Hanya Admin** yang dapat menghapus proyek secara **permanen** (hard delete, tidak dapat dikembalikan) — memerlukan konfirmasi dengan mengetik ulang Kode Proyek, disertai peringatan eksplisit bahwa seluruh tiket, jam kerja, dan laporan terkait akan hilang |
| FR-019 | Saat membuat proyek baru, pengguna dapat **langsung menambahkan anggota** beserta role masing-masing dalam satu langkah (tidak perlu membuka halaman "Anggota Proyek" secara terpisah setelahnya). Pembuat proyek otomatis menjadi Manager jika belum disertakan dalam daftar anggota |

### 7.3 Sistem Tiket & Workflow (Dapat Dikustomisasi)

| ID | Requirement |
|---|---|
| FR-020 | Tiket memiliki jenis (**Tracker**): Bug, Feature, Support |
| FR-021 | Setiap proyek baru otomatis mendapat set status default: `New → In Progress → Testing → Ready to Deploy → Blocker → Done` |
| FR-022 | Manager/Admin dapat **menambah, mengganti nama, menghapus, atau mengurutkan ulang** status pada proyeknya — workflow tidak mengunci ke set status bawaan |
| FR-023 | Setiap status **opsional** dapat dibatasi hanya boleh diset oleh satu role tertentu. Default: hanya **QA** yang boleh mengubah status menjadi **Done**; status lain bebas diset anggota proyek manapun. Aturan ini dapat diubah/dihapus per status oleh Manager/Admin |
| FR-023a | Setiap status dapat ditandai sebagai **status final** (mis. "Done") oleh Manager/Admin saat konfigurasi workflow. Penanda ini dipakai sistem untuk menghitung tiket "selesai" vs "belum selesai" (progress bar proyek, deteksi overdue) — status "Done" bawaan otomatis ditandai final saat proyek dibuat, status lain default tidak final |
| FR-024 | Atribut tiket: Assignee, Priority, Tanggal mulai, Tenggat waktu, Estimasi waktu |
| FR-025 | Tiket dapat ditampilkan sebagai List (default), Kanban, atau Calendar |
| FR-025a | **Kanban:** kartu dapat dipindah antar kolom (mengubah status) via drag-and-drop, tervalidasi terhadap `restricted_to_role` (FR-023). **Tidak ada** pengurutan ulang posisi kartu di dalam kolom yang sama — urutan dalam kolom mengikuti priority/tanggal dibuat, bukan urutan manual |
| FR-025b | **Calendar:** menampilkan tiket berdasarkan **tenggat waktu (`due_date`)** saja — bukan rentang tanggal mulai/selesai. Tiket **tanpa** `due_date` tidak muncul di Calendar (tetap muncul normal di List/Kanban) |
| FR-025c | Klik tiket di Kanban maupun Calendar membuka detail/edit tiket yang sama seperti dari List — bukan tampilan terpisah |
| FR-026 | Tiket dapat **diedit** setelah dibuat (judul, deskripsi, assignee, priority, tanggal, lampiran) oleh Assignee, Manager proyek terkait, atau Admin |
| FR-026a | Tiket dapat **dihapus** hanya oleh **pembuatnya sendiri** (peran apapun: Developer/QA/Manager, selama dia yang membuat tiket tersebut), atau oleh Manager proyek terkait/Admin. **Assignee yang bukan pembuat tidak dapat menghapus tiket** — ini guard yang lebih ketat dari edit (FR-026), sengaja dipisah karena hapus bersifat destruktif sedangkan edit tidak |
| FR-027 | Pengguna dapat **melampirkan file** pada tiket, baik saat pembuatan maupun setelahnya, disimpan di Cloudflare R2 |
| FR-028 | Setiap tiket memiliki panel **Aktivitas/Komentar** ala forum — **seluruh anggota proyek (peran manapun: Manager/Developer/Reporter-QA)** dapat menulis dan membaca komentar, tanpa dibatasi role tertentu (berbeda dari transisi status yang bisa dibatasi role) |
| FR-029 | Komentar dapat diedit/dihapus oleh penulisnya sendiri; Admin dapat menghapus komentar siapapun untuk keperluan moderasi |
| FR-029a | Pengguna dapat **melampirkan file apa saja** pada komentar (diunggah setelah teks komentar tersimpan). File bertipe **gambar** ditampilkan sebagai thumbnail di bawah teks (klik untuk lihat ukuran penuh); tipe file lain ditampilkan sebagai kartu (ikon + nama + ukuran) dengan tombol **unduh** |
| FR-029b | Pengguna dapat **membalas** komentar yang sudah ada — balasan ditampilkan terindentasi di bawah komentar induknya. **Reply dibatasi 1 tingkat** (tidak bisa membalas balasan) — cukup untuk menjawab komentar spesifik tanpa kompleksitas thread berlapis-lapis |
| FR-029c | Panel Aktivitas menampilkan **log perubahan status** tiket (mis. "Nama User mengubah status dari New ke In Progress") tergabung secara kronologis dengan komentar — dicatat otomatis setiap kali status tiket berubah, dari tampilan manapun (List/Kanban/Tugas Saya). Log ini bersifat **permanen dan tidak dapat diedit/dihapus oleh siapapun, termasuk Admin** — berbeda dari komentar biasa yang bisa dihapus (FR-029) |

### 7.4 Issue Template (Preset & Dapat Diperluas — Sebagai Filler Judul & Deskripsi)

> **Perubahan konsep:** template **tidak lagi** membuat form dinamis per-field dengan validasi wajib. Template kini murni mengisi **teks awal** pada input Title dan textarea Description — setelah itu keduanya adalah teks bebas biasa yang bisa diedit tanpa batasan struktur.

| ID | Requirement |
|---|---|
| FR-030 | Sistem menyediakan template default untuk tracker **Bug**, dipakai sebagai teks awal (filler) pada Title & Description, dengan pola judul dan daftar field berikut: |

**Template Default — Bug:**

```
Pola Judul: [BUG] {Nama Fitur} - {Nama Bug}

Field:
- Role User
- Current Condition
- Expected Result
- Link Halaman
- Step to Reproduce
- Evidence
- Environment  ← WAJIB diisi (menentukan bug terjadi di lingkungan/perangkat/browser mana)
```

| ID | Requirement |
|---|---|
| FR-031 | Saat memilih template, input **Title** terisi otomatis dengan pola judul template apa adanya (mis. `[BUG] Nama Fitur - Nama Bug`), dan textarea **Description** terisi otomatis dengan daftar field template sebagai teks — pengguna bebas mengedit kedua isian tersebut layaknya teks biasa |
| FR-032 | Field yang ditandai wajib pada template (mis. **Environment**) ditampilkan dengan penanda/keterangan pada teks Description sebagai pengingat visual, **namun tidak divalidasi otomatis oleh sistem** — Description bersifat teks bebas setelah di-prefill, sehingga kelengkapan pengisiannya menjadi tanggung jawab penulis, bukan gate teknis |
| FR-033 | Manager/Admin dapat menambahkan template baru untuk tracker lain (Feature/Support), atau mengedit/menghapus field pada template Bug default (misal menambah field baru, mengubah field mana yang ditandai wajib) |
| FR-034 | Template bersifat **per-proyek** secara default, namun dapat pula dibuat sebagai template global yang tersedia untuk semua proyek |

### 7.5 Modul Documents & Files

> **Perubahan model (mengadopsi pola Redmine):** "Document" kini adalah **kontainer** (punya Judul, Deskripsi, Tipe Dokumen sendiri) yang dapat memuat **banyak file sekaligus** — bukan lagi satu baris = satu file seperti draft sebelumnya. File dapat ditambahkan ke sebuah Document kapan saja, tidak harus semua sekaligus saat pembuatan.

| ID | Requirement |
|---|---|
| FR-040 | Modul Dokumen menyediakan **Document** sebagai kontainer berisi Judul, Deskripsi, dan Tipe Dokumen, yang dapat memuat banyak file sekaligus, disimpan di Cloudflare R2 |
| FR-041 | Saat membuat Document baru, pengguna mengisi Judul, Deskripsi (opsional), dan memilih **Tipe Dokumen**: **Dokumen Proyek**, **File Pendukung Aplikasi**, atau **Pihak Ketiga** — belum perlu mengunggah file di langkah ini |
| FR-042 | Setelah Document dibuat, pengguna dapat **menambahkan file ke dalamnya kapan saja** (saat pembuatan maupun belakangan), tidak dibatasi jumlah file per Document |
| FR-043 | Seluruh Document ditampilkan dalam **satu daftar** (tanpa tab/filter per Tipe Dokumen) — Tipe Dokumen ditampilkan sebagai **badge label** pada tiap baris, murni untuk konteks visual |
| FR-044 | Pengguna dapat **mengunduh** file individual di dalam sebuah Document |
| FR-045 | File bertipe gambar di dalam Document ditampilkan sebagai **galeri thumbnail** untuk pratinjau cepat |
| FR-046 | Document (judul/deskripsi/tipe) dapat **diedit** oleh pembuatnya, Manager proyek terkait, atau Admin |
| FR-047 | Menghapus Document akan menghapus **seluruh file di dalamnya** (cascade) — hanya dapat dilakukan oleh pembuat Document, Manager, atau Admin |
| FR-048 | **File individual** (bukan seluruh Document) dapat dihapus oleh pengunggah file tersebut, Manager, atau Admin — tanpa menghapus Document maupun file lain di dalamnya |

### 7.6 Time Book

| ID | Requirement |
|---|---|
| FR-050 | Manager/pekerja terkait dapat melihat galeri screenshot yang diambil tiap 10 menit |
| FR-051 | Di bawah tiap screenshot, ditampilkan grafik aktivitas keyboard & mouse (Tinggi/Sedang/Rendah/Tidak Ada) |
| FR-052 | Sistem menampilkan log aplikasi/judul jendela aktif pada blok waktu terkait |

### 7.7 Kontrol Privasi & Override Admin

| ID | Requirement |
|---|---|
| FR-060 | Pekerja dapat menghapus satu blok waktu (10 menit) miliknya sendiri jika terdapat data sensitif pada screenshot |
| FR-061 | Penghapusan oleh pekerja sendiri bersifat permanen, waktu blok tersebut otomatis unpaid |
| FR-062 | Sistem mencatat log setiap penghapusan blok waktu (waktu, pelaku) untuk transparansi |
| FR-063 | Pekerja dapat menambahkan waktu kerja manual (**Offline Time**) dengan deskripsi wajib diisi |
| FR-064 | Waktu manual memerlukan approval Manager sebelum dihitung sah |
| FR-065 | **Hanya Admin** (bukan Manager proyek biasa) yang dapat meng-override/menghapus blok waktu milik pekerja lain — cukup satu lapis kewenangan, tanpa perlu izin granular per-Manager |
| FR-066 | Setiap override oleh Admin wajib disertai alasan tertulis |
| FR-067 | Pekerja yang blok waktunya di-override menerima notifikasi otomatis (waktu, pelaku, alasan) |

### 7.8 Reporting

| ID | Requirement |
|---|---|
| FR-070 | Laporan jam kerja harian/mingguan/bulanan per proyek atau per pekerja |
| FR-071 | Ekspor laporan ke PDF dan CSV |
| FR-072 | Manager dapat approve/reject timesheet |

### 7.9 Desktop Client

| ID | Requirement |
|---|---|
| FR-080 | Login, pilih proyek & tugas, klik **Start** untuk mulai mencatat waktu per blok 10 menit |
| FR-081 | Screenshot diambil pada waktu acak dalam tiap interval 10 menit, dengan notifikasi visual/suara shutter |
| FR-082 | Aplikasi menghitung klik mouse & ketukan keyboard per blok, dikonversi ke level aktivitas (Tinggi/Sedang/Rendah/Tidak Ada) |
| FR-083 | Blok tanpa aktivitas sama sekali ditandai sebagai idle time |
| FR-084 | Aplikasi mencatat nama aplikasi/judul jendela aktif |
| FR-085 | Setiap blok selesai, data (screenshot, aktivitas, log aplikasi) otomatis diunggah ke server |
| FR-086 | Jika koneksi terputus, data disimpan lokal sementara dan diunggah otomatis saat online kembali |
| FR-087 | Aplikasi tetap berjalan di **tray/menu bar** OS (mis. macOS menu bar) saat window utama ditutup — bukan keluar sepenuhnya. Tray menampilkan status tracking saat ini (task aktif, durasi berjalan) dan menu cepat: Pause/Resume, Buka Aplikasi, Keluar |
| FR-088 | Setelah screenshot diambil, muncul **widget kecil** di pojok kanan bawah layar (always-on-top) dengan **countdown 15 detik** yang terlihat (angka mundur + progress bar), berisi: preview thumbnail, timer kerja berjalan, dan 3 aksi: **Preview** (lihat gambar penuh), **Submit** (kirim seperti biasa), **Discard** (batalkan blok waktu ini) |
| FR-088a | Window **Preview** (gambar penuh) bersifat independen dari widget — menutup window Preview (tombol close, Cmd+W, atau Esc) **tidak pernah** ikut menutup widget. Countdown **di-pause** selama Preview terbuka dan **dilanjutkan** dari sisa detik terakhir setelah Preview ditutup |
| FR-089 | **Discard** pada widget menghapus screenshot dari penyimpanan lokal, dan blok waktu tersebut **tidak pernah dikirim ke server** sama sekali — waktu tersebut otomatis tidak dihitung/tidak dibayar, setara konsekuensi hapus blok waktu (FR-060/FR-061), namun tanpa perlu audit log karena data memang tidak pernah sampai ke server |
| FR-090 | Widget otomatis dianggap **Submit** jika countdown mencapai 0 tanpa aksi, sehingga tidak menumpuk pengingat yang diabaikan |
| FR-091 | Jika belum ada tiket yang sedang dikerjakan, pengguna dapat memilih task default **"Activity (Tanpa Tiket)"** untuk tetap mencatat waktu kerja |
| FR-092 | Saat memilih "Activity", pengguna dapat mengisi **deskripsi singkat (opsional)** mengenai apa yang sedang dikerjakan |
| FR-093 | Blok waktu berkategori "Activity" ditampilkan dengan label **"Activity"** (bukan Issue ID kosong) di Time Book & Reports, disertai deskripsinya jika diisi |

### 7.10 Notifikasi

| ID | Requirement |
|---|---|
| FR-100 | Pengguna menerima notifikasi saat **ditambahkan sebagai anggota proyek baru** |
| FR-101 | Pengguna menerima notifikasi saat **ditugaskan (assignee) pada tiket baru** |
| FR-102 | Pengguna menerima notifikasi saat **di-mention** (`@username`) pada komentar Issue Activity |
| FR-103 | Pemilik timesheet menerima notifikasi saat timesheet-nya **disetujui/ditolak** oleh Manager |
| FR-104 | Pekerja menerima notifikasi saat blok waktunya **di-override** oleh Admin |
| FR-105 | Notifikasi tampil di ikon lonceng pada topbar dengan indikator jumlah belum dibaca, diperbarui **real-time** tanpa perlu refresh halaman |
| FR-106 | Klik notifikasi menandainya sebagai telah dibaca dan mengarahkan pengguna langsung ke halaman/entitas terkait (proyek, tiket, timesheet, atau blok waktu yang dimaksud) |
| FR-106a | Pengguna dapat mengaktifkan **Push Notification** secara opt-in lewat toggle di halaman Profil — browser meminta izin native saat diaktifkan, **bukan** otomatis meminta izin saat login/buka aplikasi |
| FR-106b | Push notification tetap sampai ke pengguna meski tab/browser TrackFlow **sepenuhnya tertutup** — mencakup event notifikasi esensial yang sama seperti FR-100–104 |
| FR-106c | Satu pengguna dapat mengaktifkan push di **lebih dari satu perangkat/browser sekaligus** (mis. laptop kantor dan laptop rumah) — semuanya menerima notifikasi secara paralel |
| FR-106d | Push notification **tidak berfungsi di Safari iOS** kecuali aplikasi sudah ditambahkan ke Home Screen terlebih dahulu — batasan ini ditampilkan sebagai catatan informatif di halaman Profil, bukan dianggap sebagai bug |

### 7.11 Integrasi Pihak Ketiga (Discord Webhook)

| ID | Requirement |
|---|---|
| FR-110 | Admin dapat menghubungkan **Discord Webhook tingkat aplikasi** untuk menerima notifikasi setiap kali **proyek baru dibuat** |
| FR-111 | Manager/Admin dapat menghubungkan **Discord Webhook tingkat proyek** (terpisah dari tingkat aplikasi) untuk menerima notifikasi setiap kali **tiket baru dibuat** pada proyek tersebut |
| FR-112 | Proyek yang belum mengonfigurasi webhook-nya sendiri **tidak** menerima notifikasi Discord untuk tiket baru — tidak ada fallback otomatis ke webhook tingkat aplikasi, supaya tidak ambigu proyek mana masuk ke channel mana |
| FR-113 | Tersedia tombol **"Test Koneksi"** untuk mengirim pesan percobaan ke channel Discord yang dikonfigurasi, sebelum webhook diandalkan sungguhan |
| FR-114 | URL Webhook Discord **tidak pernah ditampilkan ulang** setelah tersimpan (hanya status "Terhubung" yang ditampilkan) — diperlakukan sebagai kredensial sensitif |
| FR-115 | Kegagalan mengirim notifikasi ke Discord (mis. channel dihapus, webhook tidak valid) **tidak boleh menggagalkan** proses pembuatan proyek/tiket itu sendiri |
| FR-116 | Manager/Admin dapat mengaktifkan event **"Status Issue Berubah"** secara terpisah dari event "Issue Baru Dibuat" pada webhook tingkat proyek — notifikasi mencakup status lama, status baru, dan siapa yang mengubahnya. Dua event ini dapat diaktifkan/nonaktifkan independen satu sama lain, supaya tim bisa menyesuaikan tingkat "kebisingan" notifikasi sesuai kebutuhan |

### 7.12 Tugas Saya (Agregasi Tiket Lintas Proyek)

| ID | Requirement |
|---|---|
| FR-120 | Setiap pengguna memiliki halaman **"Tugas Saya"** yang menampilkan seluruh tiket yang **ditugaskan (assignee)** kepadanya, dikumpulkan dari **semua proyek** yang dia ikuti dalam satu tempat |
| FR-121 | Halaman ini mendukung mode tampilan **List, Kanban, dan Calendar** — sama seperti tampilan tiket per-proyek |
| FR-122 | Pada mode **List dan Kanban**, tiket dikelompokkan sebagai **mini-board terpisah per proyek**, masing-masing dapat **di-collapse/expand** secara independen. Mini-board Kanban tiap proyek menggunakan **kolom status milik proyek itu sendiri** (termasuk status kustom yang berbeda antar proyek) |
| FR-123 | Pada mode **Calendar**, seluruh tiket dari semua proyek ditampilkan dalam **satu kalender gabungan** (bukan kalender terpisah per proyek), dengan tiap tiket diberi penanda visual (badge/warna) sesuai kode proyek asalnya |
| FR-124 | Drag-and-drop pada mini-board Kanban di halaman ini mengubah status tiket dengan validasi yang **sama persis** seperti di tampilan Kanban per-proyek (termasuk pembatasan status ke role tertentu) |
| FR-125 | Proyek yang tidak memiliki tiket assigned ke pengguna tersebut **tidak ditampilkan** sebagai mini-board kosong — hanya proyek dengan minimal satu tiket assigned yang muncul |

### 7.13 Fitur Visibilitas Tambahan

#### 7.13.1 Widget "Ringkasan Hari Ini" (Dashboard)

| ID | Requirement |
|---|---|
| FR-130 | Halaman **Dashboard** menjadi halaman utama setelah login, menampilkan: total jam kerja hari ini, jumlah tiket overdue milik pengguna, dan status tracking terkini (sedang bekerja/idle) |
| FR-131 | Klik jumlah tiket overdue mengarahkan pengguna ke halaman "Tugas Saya" dengan filter overdue otomatis aktif |

#### 7.13.2 "Dilihat Baru-baru Ini"

| ID | Requirement |
|---|---|
| FR-132 | Sistem mencatat 10 tiket terakhir yang dibuka pengguna (lintas proyek), dapat diakses lewat dropdown di topbar |
| FR-133 | Riwayat ini tersimpan di server (bukan hanya di browser/device), sehingga konsisten meski pengguna berpindah perangkat |
| FR-134 | Membuka tiket yang sama berulang kali tidak menghasilkan duplikat entri — hanya memperbarui urutannya ke posisi terbaru |

#### 7.13.3 Progress Bar Penyelesaian Proyek

| ID | Requirement |
|---|---|
| FR-135 | Project switcher dan kartu proyek menampilkan **progress bar** perbandingan jumlah tiket berstatus final terhadap total tiket proyek tersebut (mis. "12/20") |
| FR-136 | Proyek tanpa tiket sama sekali tidak menampilkan progress bar (bukan progress bar kosong) |

#### 7.13.4 Workload Overview (Manager)

| ID | Requirement |
|---|---|
| FR-137 | Manager/Admin dapat melihat halaman **Workload Overview** per proyek — menampilkan seluruh anggota proyek beserta jumlah tiket yang ditugaskan kepada masing-masing, dipecah per status, termasuk jumlah overdue |
| FR-138 | Anggota tanpa tiket assigned sama sekali **tetap ditampilkan** (dengan angka nol) — supaya Manager dapat melihat siapa yang belum memiliki penugasan |
| FR-139 | Klik pada suatu angka di halaman ini mengarahkan ke tampilan Kanban/List proyek yang sudah terfilter sesuai anggota dan status terkait |

#### 7.13.5 Live Status: Daftar Aktif & Idle (Manager Only)

> **Revisi dari desain sebelumnya:** fitur ini semula dirancang sebagai laporan historis (skor aktivitas mingguan/bulanan). Direvisi total menjadi **status langsung (live)** — Manager melihat siapa yang sedang aktif/idle di desktop client **saat ini juga**, bukan laporan agregat dari periode lalu.

| ID | Requirement |
|---|---|
| FR-140 | Manager/Admin dapat melihat **status langsung** (live) seluruh anggota proyek — apakah sedang **Aktif**, **Idle**, atau **Offline** di desktop client saat ini, beserta tugas yang sedang dikerjakan (Issue ID atau "Activity") |
| FR-141 | Status **Idle** ditentukan otomatis oleh desktop client berdasarkan ketiadaan aktivitas keyboard/mouse selama **5 menit** — terpisah dari siklus sinkronisasi 10 menit, sehingga status yang ditampilkan benar-benar terkini (bukan basi sampai 10 menit) |
| FR-142 | Status **Offline** ditampilkan otomatis maksimal **2 menit** setelah desktop client ditutup atau kehilangan koneksi — baik lewat pemberitahuan eksplisit (Stop tracking/quit aplikasi) maupun deteksi otomatis jika tidak ada sinyal dalam jangka waktu tertentu |
| FR-143 | Admin dapat melihat status langsung lintas seluruh proyek; Manager hanya dapat melihat status langsung untuk proyek yang dia kelola — guard identik dengan Workload Overview (FR-137–139) |
| FR-144 | Daftar status diperbarui **secara realtime** tanpa perlu refresh halaman, termasuk anggota yang belum pernah membuka desktop client sama sekali (ditampilkan sebagai Offline sejak awal) |

---

## 8. Kebutuhan Non-Fungsional

| Kategori | Requirement |
|---|---|
| **Performa** | Dashboard memuat data proyek < 2 detik untuk proyek dengan hingga 10.000 tiket |
| **Ketersediaan** | Cukup satu instance backend untuk skala tim internal; target uptime wajar (tidak perlu SLA enterprise) |
| **Keamanan** | Screenshot & aktivitas terenkripsi saat transit dan saat disimpan |
| **Privasi** | Pekerja punya kontrol hapus blok waktu sensitif tanpa campur tangan admin |
| **Kompatibilitas Desktop** | Windows, macOS, Linux |
| **Real-time** | Status online/aktif pekerja ter-update dalam hitungan detik |
| **Auditability** | Perubahan status tiket, approval timesheet, dan override blok waktu tercatat dengan pelaku & waktu |
| **Retensi Data** | Screenshot disimpan standar **12 bulan**, dihapus otomatis setelahnya |

---

## 9. Alur Pengguna Utama

### 9.1 Developer Mengerjakan Tugas Harian
1. Login desktop client → pilih proyek & tugas → klik Start.
2. Setiap 10 menit, data (waktu, screenshot, aktivitas) tersinkronisasi otomatis.
3. Klik Stop saat selesai/istirahat.
4. Di akhir minggu, ajukan timesheet (otomatis terisi dari tracking + entri manual jika ada).

### 9.2 Membuat Tiket Bug dari Template
1. QA/Developer membuka "Buat Tiket Baru" → pilih Tracker **Bug** → pilih template default.
2. Input Title otomatis terisi pola `[BUG] Nama Fitur - Nama Bug`; textarea Description otomatis terisi daftar field (Role User, Current Condition, Expected Result, Link Halaman, Step to Reproduce, Evidence, Environment).
3. Pengguna mengedit kedua isian tersebut secara bebas seperti teks biasa — field yang ditandai wajib (Environment) hanya diberi keterangan pengingat, **tidak memblokir submit** jika belum diisi.
4. Tiket tersimpan dengan Issue ID otomatis mengikuti kode proyek (mis. `TRACK-142`).

### 9.3 Manager Mengatur Ulang Workflow Tiket Proyek
1. Manager membuka pengaturan proyek → "Status Tiket".
2. Melihat daftar status default (New, In Progress, Testing, Ready to Deploy, Blocker, Done).
3. Menambahkan status baru (mis. "In Review"), menghapus status yang tidak relevan, atau mengubah urutannya.
4. Opsional: membatasi status tertentu hanya bisa diset role tertentu (default sudah ada untuk "Done" → QA).

### 9.4 Admin Meng-override Blok Waktu
1. Admin membuka Time Book pekerja tertentu, menemukan blok waktu yang perlu dikoreksi (mis. laporan dari pekerja bahwa ada kesalahan sistem).
2. Admin memilih "Override Blok Waktu", mengisi alasan wajib.
3. Sistem menandai blok sesuai aksi (hapus/tandai unpaid), mencatat log, dan mengirim notifikasi ke pekerja terkait.

### 9.5 Berkolaborasi di Issue Activity
1. Developer membuka tiket yang sedang dikerjakan, membuka panel "Aktivitas".
2. Menulis komentar (mis. progres, pertanyaan ke QA), melampirkan tangkapan layar sebagai bukti — komentar beserta gambar langsung terlihat oleh **seluruh anggota proyek**, apapun rolenya.
3. QA klik "Balas" pada komentar tersebut untuk menjawab spesifik komentar itu (bukan komentar baru terpisah) — balasan tampil terindentasi di bawahnya, tanpa perlu keluar dari halaman tiket, seperti thread forum.
4. Developer mengubah status tiket dari Kanban ke "Testing" — baris log otomatis muncul di panel Aktivitas yang sama ("Developer mengubah status dari In Progress ke Testing"), tergabung kronologis dengan komentar-komentar sebelumnya.
5. Jika ada komentar yang perlu dihapus (mis. salah kirim), penulisnya sendiri atau Admin dapat menghapusnya — baris log status tidak bisa dihapus siapapun.

### 9.6 Admin Menambahkan Anggota ke Proyek Manapun
1. Admin membuka proyek milik tim lain (yang Admin sendiri belum terdaftar sebagai member).
2. Karena akses baca-tulis implisit (FR-005), Admin tetap bisa membuka halaman "Anggota Proyek" dan menambahkan user baru beserta role-nya, tanpa perlu didaftarkan sebagai member terlebih dahulu.

### 9.7 Meninjau Screenshot via Widget (Preview/Submit/Discard)
1. Desktop client mengambil screenshot otomatis di waktu acak dalam blok 10 menit berjalan.
2. Widget kecil muncul di pojok kanan bawah layar dengan countdown 15 detik berjalan (angka mundur + progress bar): thumbnail screenshot, timer kerja tetap berjalan, tombol Preview/Submit/Discard.
3. Pekerja klik **Preview** untuk melihat gambar penuh di window terpisah — countdown otomatis berhenti sementara selama window ini terbuka.
4. Menutup window Preview (cara apapun) → widget tetap ada, countdown lanjut dari sisa detik terakhir.
5. Kalau tidak masalah → klik **Submit** (atau dibiarkan hingga countdown habis → otomatis submit) → blok waktu terkirim seperti biasa.
6. Kalau ada data sensitif tertangkap → klik **Discard** → screenshot terhapus dari penyimpanan lokal, blok waktu tersebut tidak pernah terkirim ke server, waktu otomatis hangus.

### 9.8 Mencatat Waktu Tanpa Tiket (Default Activity)
1. Pekerja belum memiliki tiket spesifik untuk dikerjakan saat ini (mis. sedang riset umum, technical debt kecil).
2. Di dropdown pemilihan task, pilih **"Activity (Tanpa Tiket)"**.
3. Isi deskripsi singkat opsional (mis. "Riset library upload file") atau biarkan kosong.
4. Klik Start seperti biasa — waktu tetap tercatat dan tersinkron, muncul di Time Book berlabel "Activity".

### 9.9 Mengelola Siklus Hidup Proyek (Edit, Arsip, Hapus Permanen)
1. Manager membuka proyek → edit nama/deskripsi lewat modal (Kode Proyek tetap tampil read-only).
2. Proyek yang sudah tidak aktif → Manager klik "Arsipkan Proyek" — kalau masih ada sub-proyek aktif, sistem menolak dan meminta arsipkan sub-proyek dulu.
3. Proyek terarsip tidak lagi muncul di daftar utama, tapi tetap bisa ditemukan lewat filter "Tampilkan Terarsip" untuk kebutuhan laporan historis.
4. Jika benar-benar perlu dihapus permanen (kasus khusus, mis. proyek dibuat keliru): Admin membuka "Danger Zone", mengetik ulang Kode Proyek untuk konfirmasi, lalu menghapus — disertai peringatan bahwa seluruh data terkait akan hilang tanpa bisa dikembalikan.

### 9.10 Admin Menonaktifkan Akun Pengguna
1. Admin membuka halaman Users & Roles, memilih user yang resign/tidak aktif lagi.
2. Klik "Hapus Akun" — sistem menonaktifkan login user tersebut (bukan menghapus datanya) dan langsung memaksa logout sesi aktifnya di web maupun desktop client.
3. Seluruh riwayat tiket, timesheet, dan time block milik user tersebut tetap utuh dan terlihat di laporan.

### 9.11 Menerima & Menindaklanjuti Notifikasi
1. Developer di-mention (`@developer1`) oleh QA di komentar sebuah tiket.
2. Ikon lonceng di topbar developer tersebut langsung menampilkan badge angka baru, tanpa perlu refresh.
3. Developer klik ikon lonceng, melihat notifikasi mention tersebut, klik untuk langsung dibawa ke tiket dan komentar terkait.
4. Notifikasi otomatis tertandai telah dibaca.

### 9.12 Mengelola Dokumen Proyek
1. Manager membuka menu "Dokumen" pada proyek, klik "Document Baru".
2. Mengisi Judul, Deskripsi opsional, dan memilih Tipe Dokumen (Dokumen Proyek/File Pendukung Aplikasi/Pihak Ketiga) — Document tersimpan meski belum ada file di dalamnya.
3. Di halaman detail Document yang baru dibuat, klik "Tambah File" untuk mengunggah satu atau beberapa file ke dalamnya.
4. Document tersebut langsung terlihat di daftar tunggal bersama Document lain, dibedakan lewat badge Tipe Dokumen.
5. Beberapa hari kemudian, anggota tim lain membuka Document yang sama dan menambahkan file revisi tambahan — tanpa perlu membuat Document baru.
6. Anggota tim mengunduh file yang dibutuhkan; file bergambar langsung terlihat sebagai thumbnail pratinjau.
7. Kalau ada file yang keliru diunggah, pengunggahnya sendiri (atau Manager/Admin) dapat menghapus file tersebut tanpa memengaruhi file lain di Document yang sama.

### 9.13 Menghubungkan Notifikasi ke Discord
1. Admin membuat webhook baru di pengaturan channel Discord kantor, menyalin URL-nya.
2. Di Admin Settings TrackFlow, Admin menempelkan URL tersebut pada bagian "Integrasi Discord", memilih event "Proyek Baru Dibuat", lalu klik "Test Koneksi" — muncul pesan percobaan di channel Discord sebagai konfirmasi.
3. Manager sebuah proyek melakukan hal serupa di pengaturan proyeknya sendiri, mengaktifkan event "Issue Baru Dibuat" dan/atau "Status Issue Berubah" secara independen, menghubungkannya ke channel Discord tim proyek tersebut.
4. Sejak saat itu, setiap proyek baru dibuat → pesan otomatis muncul di channel Discord tingkat aplikasi; setiap tiket baru dibuat atau statusnya berubah (sesuai event yang diaktifkan) di proyek yang sudah dikonfigurasi → pesan muncul di channel Discord proyek tersebut.

### 9.14 Menghapus Tiket yang Dibuat Sendiri
1. Developer membuat sebuah tiket, menugaskan ke Developer lain sebagai assignee.
2. Developer lain (assignee) membuka tiket tersebut — tombol "Hapus" tidak terlihat sama sekali baginya, karena bukan pembuatnya.
3. Developer pembuat tiket membuka tiket yang sama — tombol "Hapus" tersedia, karena dia pembuatnya.
4. Manager proyek terkait tetap bisa menghapus tiket siapapun di proyeknya, terlepas dari siapa pembuatnya.

### 9.15 Melihat Semua Tugas Lintas Proyek
1. Developer yang tergabung di 3 proyek berbeda membuka menu "Tugas Saya".
2. Melihat 3 mini-board terpisah (satu per proyek yang punya tiket assigned kepadanya), masing-masing dengan kolom status sesuai konfigurasi proyeknya sendiri.
3. Collapse salah satu mini-board proyek yang sedang tidak jadi fokus — proyek lain tetap terlihat penuh.
4. Drag satu tiket antar kolom status di salah satu mini-board — berfungsi sama seperti Kanban per-proyek biasa.
5. Beralih ke mode Calendar — melihat seluruh tenggat waktu dari ketiga proyek dalam satu kalender, dibedakan lewat badge warna per proyek.

### 9.16 Memulai Hari Lewat Dashboard
1. Developer login, langsung melihat halaman Dashboard: jam kerja hari ini masih 0, 2 tiket overdue, status "Idle".
2. Klik angka "2 tiket overdue" → diarahkan ke Tugas Saya dengan filter overdue otomatis aktif.
3. Mulai tracking dari desktop client — status di Dashboard berubah jadi "Sedang Bekerja" saat halaman dibuka ulang.

### 9.17 Berpindah Cepat Antar Tiket yang Sering Dibuka
1. QA membuka beberapa tiket berbeda dari proyek berbeda sepanjang hari untuk verifikasi bug.
2. Ingin kembali ke tiket yang dibuka 20 menit lalu — klik ikon "Dilihat Baru-baru Ini" di topbar.
3. Menemukan tiket tersebut di urutan teratas, klik untuk kembali langsung tanpa perlu mencari ulang lewat daftar proyek.

### 9.18 Memantau Kemajuan Proyek Sekilas
1. Manager membuka project switcher untuk memilih proyek yang ingin dibuka.
2. Melihat progress bar di bawah nama tiap proyek (mis. "8/15" pada proyek A, "20/20" pada proyek B) — langsung tahu proyek B sudah selesai semua tanpa perlu membuka Kanban-nya.

### 9.19 Meninjau Distribusi Beban Kerja Tim
1. Manager membuka halaman Workload Overview pada proyeknya.
2. Melihat satu anggota dengan 8 tiket "In Progress" sementara anggota lain hanya 1 — indikasi beban tidak merata.
3. Klik angka "8" pada kolom In Progress milik anggota tersebut → Kanban proyek langsung terfilter menampilkan hanya tiket miliknya di status itu.

### 9.20 Memantau Status Langsung Tim
1. Manager membuka halaman Live Status pada proyeknya.
2. Melihat sebagian besar anggota berstatus 🟢 Aktif dengan tugas masing-masing tertera, satu anggota 🟡 Idle sudah 6 menit.
3. Beberapa saat kemudian, anggota yang Idle mulai mengetik lagi — badge otomatis berubah jadi 🟢 Aktif tanpa Manager perlu refresh halaman.
4. Menjelang jam pulang kantor, satu per satu anggota menutup desktop client — badge mereka berubah jadi ⚪ Offline dalam hitungan menit.

### 9.21 Mengaktifkan Push Notification
1. Developer membuka halaman Profil, menemukan toggle "Aktifkan Notifikasi Push".
2. Mengaktifkan toggle — browser menampilkan prompt izin notifikasi native, Developer klik "Izinkan".
3. Menutup seluruh tab TrackFlow, lanjut bekerja di aplikasi lain.
4. QA me-mention Developer tersebut di komentar sebuah tiket — notifikasi push muncul di notification tray OS meski TrackFlow sedang tidak terbuka sama sekali.
5. Klik notifikasi push tersebut → browser terbuka langsung menuju tiket dan komentar yang dimaksud.

---

## 10. Metrik Keberhasilan

| Metrik | Target Indikatif |
|---|---|
| Tingkat adopsi harian desktop client | > 90% hari kerja |
| Rata-rata waktu approval timesheet | < 24 jam setelah periode berakhir |
| Kelengkapan pengisian field Environment pada laporan bug | Dipantau manual (tidak lagi divalidasi otomatis sejak template disederhanakan jadi filler teks) |
| Waktu rata-rata muat dashboard | < 2 detik |

---

## 11. Asumsi & Batasan

- **Dipakai oleh satu kantor/tim saja** — tidak perlu isolasi data multi-organisasi.
- Jumlah Admin (`is_admin=true`) biasanya sangat sedikit (1–2 orang) dan dipercaya penuh oleh perusahaan.
- Pekerja memiliki koneksi internet yang cukup stabil untuk sinkronisasi berkala (dengan fallback offline queue).
- Screenshot & data aktivitas tunduk pada kebijakan privasi/ketenagakerjaan internal perusahaan.
- Screenshot memiliki masa retensi standar 12 bulan.

---

## 12. Roadmap Fase Pengembangan (Indikatif)

| Fase | Cakupan |
|---|---|
| **MVP** | Auth (Better Auth) & role proyek, Proyek & Sub-proyek (dengan Kode Proyek & penomoran issue independen, edit/arsip/hapus permanen, tambah member saat create), Sistem tiket + status default (list view) + guard hapus tiket khusus pembuat, Issue Template Bug preset (filler judul/deskripsi), Edit issue, Lampiran issue, Issue Activity (komentar ala forum), Halaman Tugas Saya (agregasi lintas proyek), Desktop Client (tracking + screenshot + sync + tray icon + widget preview/submit/discard + default task Activity), Time Book dasar, Reporting PDF/CSV, Notifikasi esensial (member baru, assignment, mention, approval, override) |
| **Fase 2** | Kanban & Calendar view, kustomisasi status tiket (tambah/hapus/urutkan), template tambahan (Feature/Support), kontrol privasi (hapus blok waktu sendiri), override Admin, offline time manual, Dashboard Ringkasan Hari Ini, Dilihat Baru-baru Ini, Progress Bar Proyek, Workload Overview, **Live Status Aktif/Idle Tim**, Web Push Notification |
| **Fase 3** | Notifikasi lanjutan (email), **integrasi Discord (webhook — notifikasi proyek/tiket baru)**, dashboard analitik lanjutan |

---

## 13. Lampiran: Perbandingan dengan Versi Sebelumnya (v1.0 Full)

| Aspek | v1.0 (Full / siap SaaS) | v2.0 (Lean Internal — dokumen ini) |
|---|---|---|
| Model tenant | Entitas `organizations` terpisah | Satu set pengaturan aplikasi, tanpa entitas organisasi |
| Hak administratif | Owner/Admin/Member (3 level + histori pemberian peran) | 1 flag `is_admin` |
| Override blok waktu | Opt-in per-Manager, endpoint audit khusus lintas-proyek | Admin-only, audit log sederhana |
| Workflow tiket | `allowed_roles` (bisa banyak role per status) | 1 role pembatas opsional per status (cukup untuk kasus "QA-only Done") |
| Issue Template | Generik, tanpa contoh konkret | Preset Bug konkret (title pattern + 7 field, 1 wajib) |

> **Kapan perlu kembali ke v1.0?** Jika suatu saat TrackFlow akan dipakai lebih dari satu perusahaan (multi-klien), atau membutuhkan delegasi hak override yang lebih granular ke banyak Manager berbeda, model v1.0 sudah siap sebagai jalur upgrade tanpa perlu didesain ulang dari nol.
