# Changelog

Semua perubahan penting pada TrackFlow dicatat di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
dan proyek ini mengikuti [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

_Belum ada perubahan yang menunggu rilis berikutnya._

---

## [0.2.1] - 2026-07-21

### Added
- Pembatasan panjang teks judul issue (truncation) pada menu system tray untuk mencegah layout menu terlalu lebar.
- Handler deteksi sleep/wake macOS untuk otomatis menutup dan membuat ulang instance widget peninjauan screenshot guna mencegah memori leak / rendering lag.

### Fixed
- Penyesuaian jarak (spacing) antara input password dan tombol masuk (Sign In) agar proporsional pada halaman login desktop.
- Sinkronisasi kemunculan ikon Dock macOS (regular vs accessory mode) sesuai dengan status tampil/sembunyi window utama.
- Perbaikan pemuatan gambar avatar profil pengguna pada halaman tracker desktop dengan mempertahankan prefix routing `/api/uploads`.

---

## [0.2.0] - 2026-07-20

> **Catatan:** entri ini disusun berdasarkan seluruh fitur yang dikerjakan sejak v0.1.0 — sesuaikan/pangkas daftar di bawah kalau ada item yang ternyata belum benar-benar termasuk dalam build v0.2.0 ini.

### Added — Manajemen Proyek
- Edit nama & deskripsi proyek/sub-proyek (Kode Proyek tetap immutable).
- Arsip proyek/sub-proyek (soft-delete) — data historis tetap utuh, proyek disembunyikan dari tampilan default.
- Hapus proyek permanen (hard-delete) khusus Admin, dengan konfirmasi mengetik ulang Kode Proyek.
- Tambah anggota proyek langsung saat membuat proyek baru (tidak perlu buka halaman terpisah).

### Added — Tampilan Tiket
- **Kanban view** — drag-and-drop kartu antar kolom status (via dnd-kit), tervalidasi terhadap pembatasan role per status.
- **Calendar view** — menampilkan tiket berdasarkan due date (via date-fns).

### Added — Administrasi Pengguna
- Admin dapat "Hapus Akun" pengguna — menonaktifkan login & memaksa logout seluruh sesi aktif (bukan menghapus data historis).

### Added — Notifikasi
- Sistem notifikasi realtime: anggota baru ditambahkan ke proyek, assignment tiket, mention (`@username`) di komentar, approval timesheet, override blok waktu.
- Ikon lonceng di topbar dengan badge unread count, update realtime via Socket.io.

### Added — Modul Dokumen
- Dokumen kini bermodel **kontainer** (judul, deskripsi, tipe dokumen) yang dapat memuat banyak file sekaligus, ditambahkan kapan saja — bukan lagi satu dokumen = satu file.
- Galeri thumbnail untuk file bergambar.
- Download presigned URL per file.

### Fixed
- Perbaikan performa Floating Widget terkait siklus sleep/wake macOS.

---

## [0.1.0] - 2026-07-18

Rilis pertama TrackFlow — mencakup web dashboard, backend, dan desktop client untuk macOS (Universal), Windows, dan Linux.

### Added — Autentikasi & Akses
- Login/registrasi via Better Auth (session cookie untuk web, Bearer token untuk desktop client).
- Model akses dua lapis: flag `isAdmin` (akses penuh lintas-proyek) + role per-proyek (Manager/Developer/Reporter-QA).
- Profil pengguna: username, foto profil, nomor telepon, jabatan, departemen, nomor induk karyawan, tanggal bergabung, status kepegawaian.
- Admin dapat menambahkan/mengatur anggota ke proyek manapun, termasuk proyek yang belum diikutinya sendiri.

### Added — Manajemen Proyek & Tiket
- Proyek & sub-proyek, masing-masing dengan **Kode Proyek** (`key`) unik dan penomoran issue independen (mis. `TRACK-1`, `AND-1`).
- Sistem tiket dengan tracker (Bug/Feature/Support) dan workflow status yang dapat dikustomisasi penuh (tambah/ubah/hapus/urutkan status per proyek), termasuk pembatasan status ke role tertentu (mis. hanya QA yang bisa set "Done").
- Issue Template — preset default untuk Bug (title pattern + 7 field terstruktur, field "Environment" ditandai wajib) sebagai filler judul & deskripsi.
- Tampilan tiket: **List**, **Kanban** (drag-and-drop antar kolom via dnd-kit, tervalidasi terhadap role), dan **Calendar** (berbasis due date, via date-fns).
- Edit tiket setelah dibuat (judul, deskripsi, assignee, priority, tanggal, lampiran).
- Lampiran file pada tiket (upload ke Cloudflare R2).
- **Issue Activity** — komentar ala forum, terbuka untuk seluruh anggota proyek apapun rolenya, dengan update realtime via Socket.io.

### Added — Time Tracking & Time Book
- Time Book: galeri screenshot, grafik aktivitas keyboard/mouse, log aplikasi aktif per blok waktu.
- Kontrol privasi: pekerja dapat menghapus blok waktu miliknya sendiri (otomatis unpaid).
- Override blok waktu oleh Admin (wajib alasan tertulis, notifikasi ke pekerja terdampak, audit log).
- Waktu manual (offline time) dengan approval Manager.
- Timesheet & alur approval per periode.
- Task default **"Activity (Tanpa Tiket)"** dengan deskripsi opsional, untuk mencatat waktu tanpa tiket spesifik.
- Retensi screenshot otomatis 12 bulan (R2 lifecycle rule).

### Added — Desktop Client (Tauri)
- Time tracking otomatis per blok 10 menit, screenshot acak, deteksi idle, deteksi aktivitas keyboard/mouse.
- Sinkronisasi otomatis ke server dengan buffer offline (SQLite lokal) dan retry.
- **Tray icon / menu bar** — aplikasi tetap berjalan di background saat window ditutup (termasuk saat Cmd+Q di macOS), quit sungguhan hanya lewat menu tray.
- **Floating Widget** — muncul setiap screenshot diambil, dengan countdown 15 detik (angka mundur + progress bar), tombol Preview (window terpisah, tidak menutup widget), Submit, dan Discard.
- Auto-updater dengan tanda tangan digital.
- Universal binary macOS (Apple Silicon + Intel), code signing & notarization via Apple Developer ID.

### Added — Pelaporan & Administrasi
- Laporan jam kerja harian/mingguan/bulanan, ekspor PDF/CSV.
- Halaman Admin: pengaturan aplikasi, manajemen user & role, data kepegawaian.
- Dark mode / light mode (toggle di menu profil).

### Added — Infrastruktur & CI/CD
- Backend NestJS + Drizzle ORM + PostgreSQL, Frontend Next.js + Shadcn UI, monorepo Turborepo, Docker Compose untuk dev environment.
- Deploy backend & frontend ke server produksi.
- Build desktop client 3-platform (macOS/Windows/Linux) sepenuhnya via GitHub Actions — tanpa perlu build manual lokal per OS.
- Draft release sebagai gerbang review manual sebelum publish ke seluruh karyawan.

### Known Limitations
- Windows code signing belum aktif (belum ada sertifikat Authenticode) — instalasi pertama di Windows akan menampilkan peringatan SmartScreen ("More info → Run anyway").
- Validasi kelengkapan field Issue Template (mis. Environment) bersifat pengingat visual saja, tidak divalidasi otomatis oleh backend.
- Kanban tidak mendukung reorder kartu dalam satu kolom yang sama (urutan mengikuti priority/tanggal dibuat).
- Calendar hanya menampilkan tiket dengan `due_date` terisi.
- Discard pada Floating Widget tidak tercatat di audit log (data memang tidak pernah terkirim ke server).

---

[Unreleased]: https://github.com/itshazlan/trackflow/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/itshazlan/trackflow/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/itshazlan/trackflow/releases/tag/v0.1.0
