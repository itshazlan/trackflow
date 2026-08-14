# Software Design Document (SDD) — Versi Lean Internal
## TrackFlow — Web Project Management & Desktop Time Tracker

| | |
|---|---|
| **Versi Dokumen** | 4.2 (Lean Internal) |
| **Status** | Draft |
| **Tanggal** | 14 Juli 2026 (revisi: Import Tiket dari Excel — tabel `issue_imports`, 3 endpoint (preview/commit/riwayat), `exceljs` di tech stack, sequence diagram §10.22, tanpa file persisten di server) |
| **Dokumen Terkait** | PRD_Lean_Internal.md |
| **Menggantikan** | SDD.md v1.1 (disimpan sebagai referensi bila di masa depan produk ini akan dikembangkan menjadi produk multi-klien) |

> Dokumen ini menyederhanakan model RBAC/organisasi & fitur override dari SDD v1.1, sambil mempertahankan dan mengonkretkan Issue Template. Tech stack MVP Lean (Drizzle, Better Auth, plain PostgreSQL, Docker Compose, Turborepo) dari revisi sebelumnya **tidak berubah**. Ringkasan perbandingan lengkap ada di §17.

---

## 1. Tujuan Dokumen

Menjadi acuan teknis tim engineering untuk membangun TrackFlow versi internal-kantor, mencakup arsitektur sistem, skema database, kontrak API, dan alur data kritis — dengan kompleksitas seminimal mungkin yang masih memenuhi kebutuhan riil.

---

## 2. Tech Stack

| Layer | Teknologi | Keterangan |
|---|---|---|
| Backend Server | Node.js + NestJS | REST API modular |
| ORM | Drizzle ORM | Ringan, type-safe, migrasi SQL-first via `drizzle-kit` |
| Autentikasi | Better Auth | Session, hashing password, refresh token bawaan |
| Realtime Layer | Socket.io | Adapter in-memory bawaan — cukup untuk single-instance |
| Frontend Web | Next.js (React) | Dashboard & Web Project Management |
| UI Component | Shadcn UI + TanStack Table | Konsistensi desain kelas Linear/Plane |
| Drag & Drop | `@dnd-kit/core` | Kanban view — drag kartu antar kolom status |
| Utilitas Tanggal | `date-fns` | Calendar view — grid bulan custom (bukan library kalender berat) |
| Parsing Excel | `exceljs` (backend) | Import Tiket dari Excel — baca/validasi file `.xlsx` di NestJS |
| Database Utama | PostgreSQL biasa | Tanpa TimescaleDB; index biasa sudah cukup di skala internal |
| Desktop Client | Tauri | Ringan, cross-platform, akses OS-level |
| File Storage | Cloudflare R2 | Screenshot & dokumen proyek |
| Monorepo Tooling | Turborepo | `apps/backend`, `apps/web`, `packages/shared-types` |
| Containerization | Docker + Docker Compose | Dev environment konsisten; produksi 1 container backend + 1 container web |

> Belum ada Redis/BullMQ/load balancer di tahap ini — lihat §12 & §14 untuk strategi pemrosesan sederhana dan jalur upgrade bila suatu saat dibutuhkan.

---

## 3. Arsitektur Sistem (High-Level)

```mermaid
flowchart TB
    subgraph Client Layer
        WEB["Web Dashboard (Next.js)"]
        DESK["Desktop Client (Tauri)"]
    end

    subgraph "Backend Container (Docker)"
        API["NestJS REST API"]
        AUTH["Better Auth"]
        WS["Socket.io Gateway (in-memory adapter)"]
        CRON["Scheduled Jobs (@nestjs/schedule)"]
    end

    subgraph Data Layer
        PG[(PostgreSQL)]
        R2[(Cloudflare R2)]
    end

    WEB -- REST/HTTPS --> API
    WEB -- WSS --> WS
    DESK -- REST/HTTPS (batch upload) --> API
    DESK -- WSS (status heartbeat) --> WS

    API --> AUTH
    API -- Drizzle ORM --> PG
    API -- presigned URL upload --> R2
    CRON --> PG
    CRON --> R2
    AUTH --> PG
```

Tidak ada entitas "organisasi" dalam arsitektur ini — seluruh instalasi melayani satu kantor, sehingga pengaturan aplikasi (`app_settings`) cukup berupa satu baris singleton, bukan model multi-tenant.

---

## 4. Arsitektur Backend (NestJS)

```
trackflow/
├── apps/
│   ├── backend/
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/              # Integrasi Better Auth
│   │       │   ├── users/              # Profil pengguna: username, foto, jabatan, departemen, isAdmin (additionalFields Better Auth)
│   │       │   ├── settings/            # app_settings (retensi, branding)
│   │       │   ├── projects/            # Proyek & sub-proyek
│   │       │   ├── memberships/         # Role per-proyek (manager/developer/reporter_qa)
│   │       │   ├── issues/               # Tiket
│   │       │   ├── issue-statuses/       # Workflow tiket (CRUD status, dapat ditambah/hapus)
│   │       │   ├── issue-templates/      # Preset template (Bug, dsb.)
│   │       │   ├── documents/            # Modul Documents & Files
│   │       │   ├── time-tracking/        # Time blocks
│   │       │   ├── screenshots/          # Upload & retrieval screenshot
│   │       │   ├── activity/             # Aktivitas keyboard/mouse & app log
│   │       │   ├── timesheets/            # Approval & manual time entry
│   │       │   ├── reports/               # Laporan PDF/CSV
│   │       │   └── notifications/         # Realtime notification via WS
│   │       ├── gateways/
│   │       │   └── realtime.gateway.ts
│   │       ├── scheduled/
│   │       │   └── retention-cleanup.job.ts   # opsional, lihat §13
│   │       ├── db/
│   │       │   ├── schema/                # Skema Drizzle per modul
│   │       │   └── migrations/
│   │       └── common/                     # Guards, interceptors, DTO validation
│   └── web/
├── packages/
│   ├── shared-types/
│   ├── ui/
│   └── config/
├── docker-compose.yml
└── turbo.json
```

### 4.1 Otorisasi — Satu Flag Admin + Role per Proyek

Berbeda dari draft sebelumnya (RBAC dua tingkat penuh dengan Owner/Admin/Member), versi Lean Internal cukup menggunakan **dua guard sederhana**:

| Guard | Sumber Data | Fungsi |
|---|---|---|
| `AdminGuard` | `user.isAdmin` | Melindungi endpoint administratif: pengaturan aplikasi, kelola user, override blok waktu siapa saja |
| `ProjectRoleGuard` | `project_memberships.role` (`manager`/`developer`/`reporter_qa`) | Melindungi endpoint operasional proyek (tiket, timesheet, dsb.) |

**Aturan resolusi akses:**
1. `AdminGuard` cukup memeriksa satu boolean — tidak perlu tabel keanggotaan organisasi terpisah dengan histori pemberian peran.
2. Admin memiliki **akses baca implisit** ke semua proyek (tanpa perlu didaftarkan sebagai member), sehingga bisa memantau seluruh tim.
3. Aksi tulis operasional (approve timesheet, ubah status tiket non-terbatas) tetap memerlukan role proyek eksplisit via `ProjectRoleGuard` — Admin tidak otomatis bisa mengerjakan tugas operasional Manager kecuali memang didaftarkan sebagai member proyek tersebut. **Pengecualian eksplisit:** endpoint `POST/PATCH /projects/:id/members` (menambah/mengubah anggota) tetap mengizinkan Admin meski **belum** terdaftar sebagai member proyek tersebut — karena mengelola keanggotaan tim lain adalah bagian dari peran administratif, bukan operasional harian proyek.
4. **Override blok waktu milik pekerja lain** memerlukan `AdminGuard` saja — **tidak ada lapisan izin granular per-Manager** (`can_override_timeblocks` dihapus dari draft sebelumnya), karena untuk tim internal kecil cukup satu titik kewenangan yang jelas dan mudah diaudit.

### 4.2 Autentikasi Desktop Client — Bearer Token (Bukan Cookie Session)

Better Auth secara default memakai **session cookie httpOnly**, cocok untuk `apps/web` (browser). Desktop client (Tauri) punya Rust core process yang jalan di background untuk sync tiap 10 menit — proses ini **tidak punya akses ke cookie jar WebView**, sehingga tidak bisa memakai mekanisme cookie yang sama. Keputusan: **Bearer token**, bukan cookie sharing.

**Alur:**
1. Aktifkan **Bearer plugin** Better Auth di konfigurasi backend (`betterAuth({ plugins: [bearer()] })`) — plugin resmi yang membuat Better Auth mengembalikan token di response `sign-in`, selain (atau sebagai ganti) set-cookie.
2. Desktop client memanggil `POST /api/auth/sign-in/email` seperti biasa; response menyertakan token sesi.
3. Token disimpan di **OS keychain**, bukan file plaintext/localStorage-equivalent — Tauri menyediakan plugin resmi untuk ini (mis. `tauri-plugin-stronghold` atau keychain-plugin native per-OS).
4. Setiap request dari Rust core (`reqwest`) menyertakan header `Authorization: Bearer <token>`, bukan mengandalkan cookie.
5. Guard `AdminGuard`/`ProjectRoleGuard` di backend **tidak berubah** — keduanya membaca sesi via `/api/auth/session`, yang kompatibel menerima sesi dari Bearer token maupun cookie tanpa perbedaan logic guard.

**Konsekuensi desain:**
- CORS/allow-list backend harus memasukkan origin desktop client (`tauri://localhost`, berbeda dari origin `apps/web`) — dicek terpisah dari header Authorization, tapi tetap wajib supaya request tidak ditolak sebelum sampai guard.
- Refresh token/expiry: desktop client perlu logic refresh token sendiri (Rust core), karena tidak ada browser yang otomatis mengelola cookie refresh — masuk sebagai bagian dari Sync Service (§6).
- Logout dari desktop client harus memanggil endpoint sign-out **dan** menghapus token dari keychain lokal — kalau hanya salah satu, sesi bisa "zombie" (token masih valid di server tapi UI mengira sudah logout, atau sebaliknya).

---

## 5. Arsitektur Frontend Web (Next.js)

- **Routing:** App Router Next.js (`/projects/:projectId/issues`, tanpa prefix `/org/:orgId` karena tidak ada konsep multi-organisasi). Menu **Issues** juga dapat diakses tanpa `projectId` (`/issues`) — lihat §5.1 untuk penjelasan dua state ini.
- **Data table tiket:** TanStack Table + Shadcn UI.
- **State realtime:** koneksi Socket.io di root layout, invalidate cache TanStack Query saat menerima event (`issue.updated`, `timeblock.synced`, `user.status_changed`).
- **Mode tampilan tiket:** List, Kanban, Calendar — ketiganya membaca dari endpoint `GET /projects/:id/issues` yang sama (tanpa parameter `view` mengubah bentuk response backend); pengelompokan per-status/per-tanggal dilakukan di frontend.
  - **Kanban:** `@dnd-kit/core` untuk drag-and-drop (bukan `react-beautiful-dnd`, sudah deprecated). Scope: kartu hanya bisa dipindah **antar kolom** (mengubah `status_id` via `PATCH /issues/:id/status`); **tidak ada** reorder posisi dalam satu kolom (FR-025a) — urutan kartu dalam kolom mengikuti `priority`/`created_at`. Validasi `restricted_to_role` dicek di frontend **sebelum** drop diizinkan (visual drop-disabled), dengan fallback revert + toast kalau backend tetap menolak (403).
  - **Calendar:** grid bulan dibangun sendiri dengan `date-fns` (bukan library kalender berat seperti FullCalendar/`react-big-calendar`, kebutuhan cukup "chip issue per tanggal"). Berbasis **`due_date` saja** (FR-025b) — tiket tanpa `due_date` tidak dikelompokkan ke tanggal manapun. Tidak ada drag-to-reschedule di versi ini; ubah `due_date` lewat form edit issue biasa.
  - Klik kartu/chip di Kanban maupun Calendar membuka drawer detail issue yang sama dengan List (FR-025c) — komponen drawer di-reuse, bukan dibuat ulang per view.
- **Pengaturan Workflow:** halaman admin/manager proyek untuk CRUD status tiket (drag-drop reorder, toggle "restricted to role").
- **Pengaturan Template:** halaman untuk mengelola Issue Template per proyek/global (form builder sederhana: daftar field + toggle wajib/opsional).

### 5.1 Penyatuan Menu Issues & "Tugas Saya" + Dropdown Proyek Inline (Revisi)

> **Revisi dari desain sebelumnya:** "Tugas Saya" semula direncanakan sebagai halaman/menu sidebar terpisah. Direvisi menjadi **state kedua dari menu Issues yang sama** (FR-150) — menghindari sidebar punya dua menu dengan konsep tumpang tindih.

- **Shared state `activeProjectId`:** disimpan di context/store frontend (mis. Zustand kecil atau React Context) **dan** di-persist ke `localStorage` (FR-153) — dipakai bersama oleh project switcher (kiri atas) dan seluruh item sidebar yang project-scoped (Issues, Time Book, Documents, Settings). Mengubah proyek aktif dari manapun memperbarui semuanya serentak (FR-152).
- **Menu Issues (2 state, satu komponen halaman):**
  - `activeProjectId` kosong → render mode agregasi (memanggil `GET /issues/mine`, dikelompokkan per proyek sebagai mini-board collapsible — logic ini **tidak berubah** dari desain "Tugas Saya" sebelumnya, cuma pindah lokasi pemanggilan).
  - `activeProjectId` terisi → render Issues per-proyek seperti biasa (memanggil `GET /projects/:id/issues`).
- **Menu Time Book, Documents, Settings — dropdown inline pengganti state disabled:**
  ```tsx
  function ProjectScopedNavItem({ icon, label, hrefSuffix }: Props) {
    const { activeProjectId, setActiveProject } = useActiveProject(); // shared store, sama dgn project switcher
    const { data: projects } = useProjects();

    if (!activeProjectId) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger>{icon} {label}</DropdownMenuTrigger>
          <DropdownMenuContent>
            {projects.map(p => (
              <DropdownMenuItem key={p.id} onClick={() => setActiveProject(p.id)}>
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    return <NavLink href={`/projects/${activeProjectId}${hrefSuffix}`}>{icon} {label}</NavLink>;
  }
  ```
  Dipakai untuk ketiga menu (Time Book, Documents, Settings) dengan komponen yang sama — cuma beda `hrefSuffix`/`icon`/`label`.
- **Tidak ada perubahan backend** untuk revisi ini — `GET /issues/mine` dan `GET /projects/:id/issues` sudah ada persis dari desain sebelumnya; yang berubah murni titik masuk & state management di sisi frontend.

---


## 6. Arsitektur Desktop Client (Tauri)

```mermaid
flowchart LR
    UI["Tauri WebView UI (Login, Start/Stop, pemilihan task)"]
    TRAY["Tray Icon Manager (menu bar)"]
    WIDGET["Floating Widget: screenshot-widget (countdown 15s)"]
    PREVIEW["Screenshot Preview: screenshot-preview (window terpisah)"]
    CORE["Rust Core Process"]
    AUTH["Auth/Token Manager (keychain)"]
    HOOK["OS-level Input Hook (keyboard/mouse count)"]
    CAP["Screenshot Capture Module"]
    LOCALDB["Local SQLite Buffer"]
    SYNC["Sync Service"]

    UI <--> CORE
    UI -- login/logout --> AUTH
    TRAY <--> CORE
    CORE --> HOOK
    CORE --> CAP
    CORE --> AUTH
    CAP -- screenshot diambil --> WIDGET
    WIDGET -- klik Preview: buka/tampilkan --> PREVIEW
    PREVIEW -- window ditutup: resume countdown --> WIDGET
    WIDGET -- Submit/Discard/countdown habis --> CORE
    HOOK --> LOCALDB
    CAP --> LOCALDB
    CORE -- hanya jika Submit --> LOCALDB
    LOCALDB --> SYNC
    SYNC -- ambil Bearer token --> AUTH
    SYNC -- "HTTPS batch upload + Authorization: Bearer <token>" --> API["Backend API"]
```

| Komponen | Tanggung Jawab |
|---|---|
| **Rust Core Process** | Siklus blok waktu 10 menit, jadwal screenshot acak, orkestrasi state Start/Pause/Stop, dipicu juga dari Tray & Widget (bukan cuma window utama) |
| **Tray Icon Manager** | Icon di tray/menu bar OS (mis. macOS menu bar), menu cepat (status task+durasi, Pause/Resume, Buka Aplikasi, Keluar). Window utama **hide ke tray** saat ditutup (bukan quit), quit sungguhan hanya lewat menu tray — lihat §10.8 |
| **Floating Widget** | Window `screenshot-widget` (multi-window Tauri), always-on-top, tanpa border, pojok kanan bawah layar. Muncul setiap kali screenshot diambil dengan **countdown 15 detik** (angka mundur + progress bar): preview thumbnail + timer + tombol Preview/Submit/Discard. Tombol Preview membuka window **terpisah** (`screenshot-preview`) — countdown di-pause selama window itu terbuka, resume setelah ditutup (dengan cara apapun: close button, Cmd+W, atau Esc), **tanpa pernah ikut menutup widget**. Auto-Submit jika countdown mencapai 0 tanpa aksi (FR-090) — lihat §10.9 |
| **Screenshot Preview** | Window `screenshot-preview` — window biasa (ada title bar, bisa di-resize/close), menampilkan gambar screenshot ukuran penuh. **Sepenuhnya independen** dari Floating Widget — menutupnya (cara apapun) hanya memicu event resume countdown ke widget, tidak pernah menutup/menghapus widget itu sendiri |
| **Auth/Token Manager** | Login via `/api/auth/sign-in/email` (Bearer plugin), simpan token di OS keychain (bukan file plaintext), sediakan token ke Sync Service tiap request, tangani refresh & logout (hapus dari keychain + panggil sign-out) — lihat §4.2 |
| **OS-level Input Hook** | Hitung klik/ketukan tanpa merekam konten (privasi) |
| **Screenshot Capture Module** | Screenshot pada detik acak + notifikasi shutter, hasil ditahan dulu menunggu keputusan di Floating Widget (bukan langsung lanjut ke buffer) |
| **Local SQLite Buffer** | Buffer offline sebelum berhasil diunggah. **Hanya diisi kalau widget di-Submit/timeout** — kalau di-Discard, data blok tersebut tidak pernah masuk ke buffer ini sama sekali (§10.9) |
| **Sync Service** | Ambil token dari Auth/Token Manager, sertakan sebagai header `Authorization: Bearer <token>` di tiap request, upload per blok selesai, retry dengan backoff. Jika server balas `401 Unauthorized` (token expired), pause sync → picu refresh via Auth/Token Manager → resume; jika refresh gagal, tampilkan prompt re-login di WebView UI. **Juga bertanggung jawab kirim heartbeat** (`socket.emit('heartbeat', {status, projectId, issueId})`) tiap ~60 detik selama tracking aktif — terpisah dari siklus sync 10 menit, dipakai untuk Live Status (§10.18) |

**Prinsip privasi tidak berubah:** idle detection, tidak ada keylogging konten, randomisasi jadwal screenshot lokal.

**Prinsip keamanan token (baru):** token tidak pernah disimpan sebagai file teks biasa di disk maupun di `localStorage`-equivalent WebView — wajib lewat mekanisme keychain native OS (Keychain di macOS, Credential Manager di Windows, Secret Service di Linux), diakses lewat plugin Tauri resmi.

**Keputusan desain — konsekuensi Discard (default direkomendasikan & disetujui):** Discard pada Floating Widget menghapus file screenshot dari penyimpanan lokal, dan blok waktu terkait **tidak pernah dikirim ke server sama sekali** — bukan dikirim lalu dihapus. Konsekuensi ke pekerja setara dengan hapus blok waktu self-service (FR-060/061, unpaid otomatis), namun **tanpa audit log** di `time_block_audit_logs`, karena secara teknis data tersebut memang tidak pernah eksis di sisi server (berbeda dari self-delete di Time Book yang menghapus data yang *sudah* tersimpan di database).

---

## 7. Desain Basis Data

### 7.1 Entity Relationship Diagram (Ringkas)

```mermaid
erDiagram
    APP_SETTINGS ||--|| APP_SETTINGS : "singleton"
    USERS ||--o{ PROJECT_MEMBERSHIPS : has
    PROJECTS ||--o{ PROJECTS : "sub-project of"
    PROJECTS ||--o{ PROJECT_MEMBERSHIPS : has
    PROJECTS ||--o{ ISSUE_STATUSES : defines
    PROJECTS ||--o{ ISSUES : contains
    PROJECTS ||--o{ ISSUE_TEMPLATES : defines
    PROJECTS ||--o{ DOCUMENTS : stores
    DOCUMENTS ||--o{ DOCUMENT_FILES : contains
    ISSUE_STATUSES ||--o{ ISSUES : "current status"
    USERS ||--o{ ISSUES : "assigned to"
    ISSUES ||--o{ ISSUE_ATTACHMENTS : has
    ISSUES ||--o{ ISSUE_COLLABORATORS : has
    PROJECTS ||--o{ ISSUE_IMPORTS : "imported via"
    USERS ||--o{ ISSUE_IMPORTS : imports
    USERS ||--o{ ISSUE_COLLABORATORS : "collaborates on"
    ISSUES ||--o{ ISSUE_COMMENTS : has
    USERS ||--o{ ISSUE_COMMENTS : authors
    ISSUE_COMMENTS ||--o{ ISSUE_COMMENTS : "replies to"
    ISSUE_COMMENTS ||--o{ COMMENT_ATTACHMENTS : has
    ISSUES ||--o{ ISSUE_STATUS_HISTORY : "logged in"
    ISSUE_STATUSES ||--o{ ISSUE_STATUS_HISTORY : "referenced by"
    USERS ||--o{ TIME_BLOCKS : logs
    ISSUES ||--o{ TIME_BLOCKS : "tracked against"
    USERS ||--o| USER_LIVE_STATUS : "current status"
    TIME_BLOCKS ||--o| SCREENSHOTS : has
    TIME_BLOCKS ||--o| ACTIVITY_LOGS : has
    TIME_BLOCKS ||--o{ TIME_BLOCK_AUDIT_LOGS : "logged in"
    USERS ||--o{ MANUAL_TIME_ENTRIES : submits
    USERS ||--o{ TIMESHEETS : has
    TIMESHEETS ||--o{ TIMESHEET_APPROVALS : "reviewed via"
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ PUSH_SUBSCRIPTIONS : registers
    PROJECTS ||--o{ DISCORD_WEBHOOKS : "configured for"
    USERS ||--o{ RECENTLY_VIEWED_ISSUES : views
    ISSUES ||--o{ RECENTLY_VIEWED_ISSUES : "viewed via"
    USERS ||--o{ DISCORD_WEBHOOKS : configures
```

### 7.2 Definisi Tabel (PostgreSQL via Drizzle ORM)

#### `user` (dikelola oleh Better Auth, diperluas via `additionalFields`)
> Kolom inti disediakan otomatis oleh Better Auth. Kolom tambahan (username, foto profil sudah termasuk bawaan sebagai `image`, dan informasi kepegawaian) didaftarkan lewat konfigurasi `additionalFields` Better Auth — dengan Drizzle adapter, Better Auth otomatis menambahkannya sebagai kolom asli pada tabel `user`. **Tidak perlu tabel `user_profiles` terpisah** seperti draft sebelumnya — satu tabel jadi satu-satunya sumber data untuk seluruh info pengguna (Lean Internal: lebih sedikit tabel & join).

| Kolom | Tipe | Sumber | Keterangan |
|---|---|---|---|
| id | uuid (PK) | Better Auth (bawaan) | |
| email | varchar (unique) | Better Auth (bawaan) | |
| emailVerified | boolean | Better Auth (bawaan) | |
| name | varchar | Better Auth (bawaan) | Nama lengkap |
| image | varchar (nullable) | Better Auth (bawaan) | **Foto profil** — URL ke object di Cloudflare R2 (`profile-photos/{userId}.webp`); kolom ini hanya menyimpan referensi |
| createdAt | timestamptz | Better Auth (bawaan) | |
| username | varchar (unique) | `additionalFields` | Identitas ringkas untuk tampilan @mention/komentar di UI |
| phoneNumber | varchar (nullable) | `additionalFields` | Nomor telepon/WhatsApp untuk kontak kerja |
| position | varchar (nullable) | `additionalFields` | Jabatan (mis. "Backend Developer", "QA Engineer") |
| department | varchar (nullable) | `additionalFields` | Divisi/departemen (mis. "Engineering", "Product") |
| employeeId | varchar (unique, nullable) | `additionalFields` | Nomor induk karyawan (NIK internal), bila perusahaan memakainya |
| joinDate | date (nullable) | `additionalFields` | Tanggal bergabung — dipakai untuk laporan masa kerja |
| employmentStatus | enum(`active`,`inactive`,`on_leave`) default `active` | `additionalFields` | Status kepegawaian. `inactive` dipakai saat karyawan resign/off-boarding — akun **dinonaktifkan**, bukan dihapus, agar histori time_blocks/tiket miliknya tetap utuh |
| isAdmin | boolean default false | `additionalFields` | Satu-satunya flag otorisasi tingkat aplikasi (§4.1) — menggantikan hierarki Owner/Admin/Member |

> **Contoh konfigurasi Better Auth (ringkas):**
> ```ts
> betterAuth({
>   // ...
>   user: {
>     additionalFields: {
>       username: { type: "string", required: true, unique: true },
>       phoneNumber: { type: "string", required: false },
>       position: { type: "string", required: false },
>       department: { type: "string", required: false },
>       employeeId: { type: "string", required: false, unique: true },
>       joinDate: { type: "date", required: false },
>       employmentStatus: { type: "string", required: false, defaultValue: "active" },
>       isAdmin: { type: "boolean", required: false, defaultValue: false },
>     },
>   },
> });
> ```
> Seluruh tabel domain pada dokumen ini mereferensikan `user.id` (ditulis "FK → users" untuk konsistensi penamaan). Tabel pendukung `session`, `account`, `verification` tetap di-generate otomatis oleh Better Auth tanpa perubahan.

#### `app_settings` (menggantikan `organizations`)
> Singleton — hanya 1 baris untuk seluruh instalasi (tidak ada konsep multi-organisasi).

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| company_name | varchar | Untuk branding dashboard (opsional) |
| screenshot_retention_days | int default 365 | Retensi screenshot — standar 12 bulan |
| created_at | timestamptz | |

#### `projects`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| parent_project_id | uuid (FK → projects, nullable) | Struktur sub-project |
| key | varchar(10) (unique, global) | **Kode Proyek** — dipakai sebagai prefix Issue ID (mis. `TRACK-142`). Format: uppercase alfanumerik (`^[A-Z][A-Z0-9]{1,9}$`), **immutable** setelah proyek dibuat |
| issue_sequence | integer default 0 | Counter nomor issue berjalan untuk proyek ini — di-increment atomik di dalam transaksi yang sama dengan insert `issues` (lihat §10.6) |
| name | varchar | Dapat diedit kapan saja (FR-015) |
| description | text | Dapat diedit kapan saja (FR-015) |
| archived_at | timestamptz (nullable) | Diisi saat proyek diarsipkan (soft-delete, FR-016) — `NULL` berarti masih aktif |
| archived_by | uuid (FK → users, nullable) | Siapa yang mengarsipkan |
| created_by | uuid (FK → users) | |
| created_at | timestamptz | |

> **Soft-delete, bukan hard-delete, sebagai default "Hapus Proyek" (keputusan bisnis dikonfirmasi):** aksi "Hapus" yang terlihat pengguna sehari-hari mengisi `archived_at`/`archived_by` — seluruh data terkait (issues, time_blocks, dokumen, dst) **tetap utuh**, hanya disembunyikan dari tampilan default. Ini melindungi data jam kerja yang mungkin sudah dipakai untuk payroll/laporan historis. Hard-delete permanen tersedia sebagai aksi terpisah, Admin-only, lihat endpoint `DELETE /projects/:id` di §8.
>
> **Sub-project punya `key` dan `issue_sequence` sendiri, independen dari proyek induknya** (keputusan bisnis dikonfirmasi) — bukan berbagi satu urutan nomor dengan induknya. Contoh: proyek "Aplikasi Mobile" (`key=MOB`) dan sub-proyek "Android" (`key=AND`) masing-masing mulai penomoran dari 1: `MOB-1`, `AND-1`, dst — **bukan** `MOB-1`, `MOB-2` (Android) menyatu dengan induk. Keunikan `key` bersifat **global** di seluruh instalasi (termasuk lintas hierarki proyek/sub-proyek), karena single-tenant tidak punya scoping organisasi untuk membatasi keunikan hanya per-cabang.
>
> Catatan: kolom `organization_id` yang ada di draft sebelumnya **dihapus** — tidak relevan lagi tanpa entitas organisasi.

#### `project_memberships`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK) | |
| user_id | uuid (FK) | |
| role | enum(`manager`,`developer`,`reporter_qa`) | Role per-proyek |
| invited_at | timestamptz | |

> Kolom `can_override_timeblocks` pada draft sebelumnya **dihapus** — override kini murni berbasis `user.isAdmin` (lihat §4.1).

#### `issue_trackers` (referensi statis: Bug/Feature/Support)
| Kolom | Tipe |
|---|---|
| id | uuid (PK) |
| name | varchar |

#### `issue_statuses` (workflow — dapat ditambah/diubah/dihapus)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK) | Status bersifat per-proyek |
| name | varchar | Nama status (mis. New, In Progress, Testing, Ready to Deploy, Blocker, Done, atau custom seperti "In Review") |
| order_index | int | Urutan tampilan Kanban |
| restricted_to_role | enum(`manager`,`developer`,`reporter_qa`) nullable | **Disederhanakan dari `allowed_roles` jsonb** — cukup satu role pembatas opsional. `NULL` berarti status bebas diset anggota proyek manapun. Default: status "Done" di-seed dengan `restricted_to_role = reporter_qa` |
| is_final | boolean default false | **Baru** — menandai status ini dianggap "selesai" (FR-023a). Dipakai untuk hitung progress bar proyek (§7.13.3) dan deteksi tiket overdue (§7.13.1) — tidak menebak dari nama status karena nama bebas dikustomisasi. Status "Done" di-seed dengan `is_final = true`, status lain default `false` |

> Saat proyek baru dibuat, backend otomatis men-seed 6 baris default (New, In Progress, Testing, Ready to Deploy, Blocker, Done) via service logic — bukan hardcode di enum kolom, sehingga Manager/Admin tetap bebas menambah, mengganti nama, menghapus, atau mengurutkan ulang status tersebut kapan saja (FR-022).

#### `issues`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK) | |
| number | integer | Nomor urut dalam proyek/sub-proyek ini (bukan global) — digabung dengan `projects.key` menjadi Issue ID tampilan (mis. `TRACK-142`). **Unique constraint gabungan `(project_id, number)`** |
| tracker_id | uuid (FK → issue_trackers) | |
| status_id | uuid (FK → issue_statuses) | |
| title | varchar | |
| description | text | |
| assignee_id | uuid (FK → users, nullable) | |
| priority | enum(`low`,`medium`,`high`,`urgent`) | |
| start_date | date | |
| due_date | date | |
| estimated_hours | numeric | |
| created_by | uuid (FK) | |
| created_at | timestamptz | |

#### `issue_templates` (dipertahankan & dikonkretkan — kini berperan sebagai **generator teks**, bukan form terstruktur)
> **Perubahan desain:** template tidak lagi memicu form dinamis per-field dengan validasi backend. Kolom `fields` sekarang murni dipakai untuk **menyusun teks awal** pada `description` saat issue dibuat — setelah disusun, `description` adalah string biasa yang bebas diedit. Flag `required` pada tiap field kini bersifat **informasional saja** (ditampilkan sebagai penanda visual di teks yang di-generate), **tidak lagi ditegakkan sebagai validasi wajib oleh backend** — trade-off yang disengaja demi kesederhanaan (lihat §16).

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK, nullable) | `NULL` = template global, tersedia untuk semua proyek (FR-034) |
| tracker_id | uuid (FK → issue_trackers) | |
| name | varchar | Nama template (mis. "Bug Report Default") |
| title_pattern | varchar | Teks awal untuk input Title, disalin apa adanya (bukan template variabel lagi), mis. `[BUG] Nama Fitur - Nama Bug` |
| fields | jsonb | Daftar `{label, required, helperText}` berurutan, dipakai untuk menyusun teks awal `description` — **bukan** skema form dengan validasi |
| created_at | timestamptz | |

**Contoh isi kolom `fields` untuk template Bug default (di-seed otomatis saat instalasi):**
```json
[
  { "label": "Role User", "required": false },
  { "label": "Current Condition", "required": false },
  { "label": "Expected Result", "required": false },
  { "label": "Link Halaman", "required": false },
  { "label": "Step to Reproduce", "required": false },
  { "label": "Evidence", "required": false },
  { "label": "Environment", "required": true, "helperText": "Wajib diisi bug terjadi di mana" }
]
```

> Backend menyusun teks awal `description` dari array ini, contoh hasil generate:
> ```
> Role User: 
> Current Condition: 
> Expected Result: 
> Link Halaman: 
> Step to Reproduce: 
> Evidence: 
> Environment: (wajib diisi bug terjadi di mana)
> ```
> Manager/Admin dapat mengedit array `fields` ini (tambah/hapus/ubah wajib-tidaknya, hanya memengaruhi teks & penanda yang di-generate) melalui UI pengaturan template (FR-033), tanpa perlu migrasi skema — cukup update baris jsonb.

#### `documents` (kontainer — mengadopsi pola Redmine, bukan lagi 1 baris = 1 file)
> Menu "Dokumen" di UI menampilkan **satu daftar tunggal** (tanpa tab/filter per kategori) — kolom `category` murni ditampilkan sebagai badge label untuk konteks visual. Setiap baris di sini adalah **kontainer** yang dapat memuat banyak file (lihat tabel `document_files` di bawah), bukan file itu sendiri.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK) | |
| title | varchar(255) | Judul Document (FR-041) |
| description | text (nullable) | Deskripsi opsional (FR-041) |
| category | enum(`project_doc`,`supporting_file`,`third_party`) default `project_doc` | Tipe Dokumen — dipilih wajib saat membuat Document, ditampilkan sebagai badge (FR-041, FR-043) |
| created_by | uuid (FK → users) | |
| created_at | timestamptz | |
| updated_at | timestamptz | Diperbarui saat title/description/category diedit (FR-046) |

#### `document_files` (banyak file per Document)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| document_id | uuid (FK → documents, `onDelete: cascade`) | Menghapus Document otomatis menghapus seluruh baris ini (FR-047) |
| file_name | varchar | |
| file_size_bytes | bigint | Untuk validasi soft-limit di frontend (rekomendasi maks. 50MB/file) |
| mime_type | varchar | Dipakai untuk memilih ikon tipe file di UI, dan menentukan apakah file ditampilkan di galeri thumbnail (FR-045) |
| r2_object_key | varchar | `project/{projectId}/documents/{documentId}/{fileId}-{fileName}` |
| uploaded_by | uuid (FK → users) | Per-file, karena file bisa ditambahkan orang berbeda di waktu berbeda ke Document yang sama (FR-042) |
| uploaded_at | timestamptz | |

> Index disarankan: `documents (project_id, created_at DESC)` dan `document_files (document_id, uploaded_at ASC)`.

#### `issue_collaborators` (Orang Tambahan Selain Assignee — Tidak Dihitung sebagai PIC)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| issue_id | uuid (FK → issues, `onDelete: cascade`) | |
| user_id | uuid (FK → users) | |
| added_by | uuid (FK → users) | Siapa yang menambahkan — sama dengan `user_id` kalau self-add (FR-026c) |
| added_at | timestamptz | |

> **Unique constraint** pada `(issue_id, user_id)` — satu orang tidak bisa jadi collaborator dobel di tiket yang sama.
>
> **Sengaja tidak dihitung** oleh: mode agregasi Issues (`/issues/mine`, FR-120), Workload Overview (`/projects/:id/workload`, FR-137), maupun Dashboard overdue count (`/dashboard/summary`, FR-130) — ketiganya tetap query murni berdasarkan `issues.assignee_id`, **tidak** ikut JOIN ke tabel ini (FR-026e). Collaborators tetap otomatis punya akses baca/komentar Issue Activity karena itu sudah terbuka untuk seluruh anggota proyek sejak awal (FR-028), tidak butuh mekanisme tambahan.

#### `issue_imports` (Audit Log — Import Tiket dari Excel)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK → projects) | |
| imported_by | uuid (FK → users) | |
| file_name | varchar | Nama file asli, murni untuk keterangan/audit |
| sheet_name | varchar | Nama sheet yang diproses (FR-168) |
| total_rows | int | Jumlah baris data (di luar header) yang dibaca dari file |
| success_rows | int | Jumlah baris yang berhasil menjadi tiket |
| error_rows | int | `total_rows - success_rows` |
| imported_at | timestamptz | |

> **Tidak ada tabel staging/temporary untuk file Excel** — file tidak pernah disimpan persisten di server (baik saat preview maupun commit). Browser menyimpan `File` object di state dan mengirim ulang saat sheet dipilih; endpoint commit menerima **data terstruktur hasil preview**, bukan file mentah lagi (lihat §10.22).

#### `issue_attachments`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| issue_id | uuid (FK → issues) | |
| file_name | varchar | |
| r2_object_key | varchar | `project/{projectId}/issues/{issueId}/attachments/{attachmentId}-{fileName}` |
| uploaded_by | uuid (FK → users) | |
| uploaded_at | timestamptz | |

#### `issue_comments` (Issue Activity — ala forum)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| issue_id | uuid (FK → issues) | |
| author_id | uuid (FK → users) | |
| parent_comment_id | uuid (FK → issue_comments, nullable) | `NULL` = komentar utama; terisi = reply (FR-029b). **Dibatasi 1 tingkat** — divalidasi di backend (bukan cuma UI): komentar yang direferensikan sebagai parent wajib punya `parent_comment_id = NULL` sendiri, dan wajib milik `issue_id` yang sama |
| body | text | |
| created_at | timestamptz | |
| updated_at | timestamptz nullable | Diisi saat komentar diedit — dipakai untuk menampilkan penanda "(diedit)" di UI |

> Guard: **siapapun member proyek** (peran manapun) atau Admin boleh baca & tulis komentar — sengaja tidak dibatasi role tertentu, berbeda dari transisi status tiket (FR-028). Edit hanya oleh penulis; hapus oleh penulis atau Admin (moderasi, FR-029).

#### `comment_attachments` (lampiran file pada komentar — mendukung tipe apa saja)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| comment_id | uuid (FK → issue_comments, `onDelete: cascade`) | Menghapus komentar otomatis menghapus seluruh lampirannya |
| file_name | varchar | |
| r2_object_key | varchar | `project/{projectId}/issues/{issueId}/comments/{commentId}/{attachmentId}-{fileName}` |
| mime_type | varchar | Tidak lagi divalidasi wajib `image/*` (FR-029a direvisi) — disimpan murni untuk keputusan render di frontend: `image/*` → thumbnail grid, tipe lain → kartu ikon+nama+tombol download |
| file_size_bytes | bigint | Soft-limit maks. 50MB, konsisten dengan modul lampiran Issue & Dokumen |
| uploaded_at | timestamptz | |

> **Keputusan scope:** hapus attachment individual tidak disediakan endpoint terpisah — attachment ikut terhapus (cascade) hanya saat komentar induknya dihapus.

#### `issue_status_history` (Log Perubahan Status — Immutable)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| issue_id | uuid (FK → issues, `onDelete: cascade`) | |
| old_status_id | uuid (FK → issue_statuses, nullable) | `NULL` = ini transisi pertama saat issue dibuat (belum ada status sebelumnya) |
| new_status_id | uuid (FK → issue_statuses) | |
| changed_by | uuid (FK → users) | |
| changed_at | timestamptz | |

> **Immutable by design (FR-029c):** tabel ini **tidak punya endpoint PATCH/DELETE sama sekali** — tidak untuk penulis, tidak untuk Admin. Ini murni audit trail perubahan status, berbeda dari `issue_comments` yang bisa diedit/dihapus. Diisi otomatis oleh service `updateIssueStatus()` yang sama dipakai List/Kanban/mode agregasi Issues — satu titik trigger, bukan diduplikasi di tiap tempat.

#### `time_blocks`
> Tabel PostgreSQL biasa dengan composite index `(user_id, block_start)` dan `(project_id, block_start)`.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | Pemilik blok waktu |
| project_id | uuid (FK) | |
| issue_id | uuid (FK, nullable) | `NULL` berarti blok waktu berkategori **"Activity"** (tanpa tiket spesifik), lihat kolom `note` |
| note | text (nullable) | Deskripsi bebas opsional, relevan khususnya saat `issue_id IS NULL` (FR-091/092) — ditampilkan di Time Book/Reports sebagai keterangan tambahan |
| block_start | timestamptz | |
| block_end | timestamptz | |
| is_deleted | boolean default false | |
| deleted_at | timestamptz nullable | |
| deleted_by | uuid (FK → users, nullable) | Pemilik sendiri (self) atau Admin (override) |
| deletion_type | enum(`self`,`admin_override`) nullable | Disederhanakan dari `manager_override` menjadi `admin_override`. **Catatan:** Discard di Floating Widget (§6, §10.9) **tidak** menghasilkan baris `time_blocks` sama sekali — bukan kasus `deletion_type` manapun di sini |
| deletion_reason | text nullable | Wajib untuk `admin_override`; opsional untuk `self` |
| is_paid | boolean | |
| synced_at | timestamptz | |
| purge_after | timestamptz (generated: `block_start + retention_days`) | |

#### `time_block_audit_logs`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| time_block_id | uuid (FK) | |
| action | enum(`self_delete`,`admin_override_delete`,`admin_override_mark_unpaid`) | |
| actor_id | uuid (FK → users) | |
| target_user_id | uuid (FK → users) | |
| reason | text | |
| created_at | timestamptz | |

#### `screenshots`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| time_block_id | uuid (FK) | |
| r2_object_key | varchar | |
| captured_at | timestamptz | |

#### `activity_logs`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| time_block_id | uuid (FK) | |
| keyboard_count | int | |
| mouse_count | int | |
| activity_level | enum(`none`,`low`,`medium`,`high`) | |
| active_app_name | varchar | |
| active_window_title | varchar | |

#### `user_live_status` (Live Status — snapshot, bukan tabel log historis)
| Kolom | Tipe | Keterangan |
|---|---|---|
| user_id | uuid (PK, FK → users) | Satu baris per user, **di-overwrite terus** — bukan diakumulasi/insert baru tiap heartbeat |
| status | enum(`active`,`idle`,`offline`) default `offline` | `idle` ditentukan **di sisi desktop client** berdasarkan ketiadaan input keyboard/mouse 5 menit (FR-141), bukan dihitung ulang di backend |
| project_id | uuid (FK → projects, nullable) | Proyek yang sedang di-tracking saat ini |
| issue_id | uuid (FK → issues, nullable) | `NULL` = sedang di task "Activity" tanpa tiket spesifik |
| last_heartbeat_at | timestamptz | Diperbarui tiap heartbeat masuk (~60 detik sekali) — dipakai cron fallback (§10.18) untuk deteksi koneksi terputus tanpa graceful disconnect |

> **Bukan pengganti `activity_logs`** — riwayat historis level aktivitas untuk keperluan payroll/laporan tetap sepenuhnya di `activity_logs` yang sudah ada, tidak berubah sama sekali. Tabel ini murni status kondisi terkini untuk tampilan realtime, tidak dipakai untuk laporan/audit apapun.

#### `manual_time_entries`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| project_id | uuid (FK) | |
| issue_id | uuid (FK, nullable) | |
| duration_minutes | int | |
| description | text | Wajib diisi |
| entry_date | date | |
| approval_status | enum(`pending`,`approved`,`rejected`) | |

#### `timesheets`
| Kolom | Tipe |
|---|---|
| id | uuid (PK) |
| user_id | uuid (FK) |
| project_id | uuid (FK) |
| period_start | date |
| period_end | date |
| total_minutes | int |
| status | enum(`draft`,`submitted`,`approved`,`rejected`) |

#### `timesheet_approvals`
| Kolom | Tipe |
|---|---|
| id | uuid (PK) |
| timesheet_id | uuid (FK) |
| reviewed_by | uuid (FK → users) |
| decision | enum(`approved`,`rejected`) |
| note | text |
| reviewed_at | timestamptz |

#### `notifications`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK → users) | Penerima notifikasi |
| type | enum(`project_member_added`,`issue_assigned`,`issue_collaborator_added`,`issue_mentioned`,`timesheet_approved`,`timeblock_overridden`) | Jenis notifikasi (FR-100–104, FR-101a) |
| title | varchar | |
| body | text | |
| entity_type | enum(`project`,`issue`,`timesheet`,`time_block`) | Dipakai bersama `entity_id` untuk navigasi "klik → buka halaman terkait" (FR-106) |
| entity_id | uuid | |
| is_read | boolean default false | |
| created_at | timestamptz | |

> Composite index pada `(user_id, is_read, created_at)` — query paling sering adalah "notifikasi belum dibaca milik user ini, urut terbaru" untuk badge counter & panel notifikasi.

#### `push_subscriptions` (Web Push — satu user bisa punya banyak baris)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK → users) | |
| endpoint | varchar | URL unik dari push service browser (FCM/Mozilla/dst) |
| p256dh_key | varchar | Dari `PushSubscription.toJSON().keys` |
| auth_key | varchar | |
| user_agent | varchar (nullable) | Opsional, untuk user bisa lihat "device mana saja yang subscribe" di halaman Profil |
| created_at | timestamptz | |

> **Multi-device by design (FR-106c):** satu user bisa punya banyak baris (laptop kantor, laptop rumah, browser berbeda) — semuanya menerima push secara paralel, tidak saling menggantikan. Baris dihapus otomatis kalau push service mengembalikan status `410 Gone`/`404` saat pengiriman (subscription sudah tidak valid — browser uninstall, cache cleared, dst), lihat §10.20.

#### `discord_webhooks` (Integrasi Discord — level aplikasi & level proyek)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK → projects, nullable) | `NULL` = webhook tingkat aplikasi (event `project_created`); terisi = webhook tingkat proyek (event `issue_created`), FR-110/111 |
| webhook_url | varchar | **Diperlakukan sebagai kredensial sensitif** — tidak pernah dikembalikan utuh ke frontend setelah tersimpan (FR-114), hanya status `configured: true` |
| events | jsonb | Array event yang diaktifkan (masing-masing dapat di-toggle independen), mis. `["project_created"]` (level aplikasi) atau `["issue_created", "issue_status_changed"]` (level proyek, FR-116) |
| created_by | uuid (FK → users) | |
| created_at | timestamptz | |

> **Catatan keamanan:** siapapun yang memegang `webhook_url` bisa mengirim pesan ke channel Discord terkait. Pertimbangkan enkripsi kolom ini di database (application-level encryption) jika kebutuhan keamanan meningkat di masa depan — untuk MVP, dianggap cukup dilindungi lewat guard endpoint (Admin/Manager only) dan tidak pernah di-expose ke response API.

#### `recently_viewed_issues` (Dilihat Baru-baru Ini)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK → users) | |
| issue_id | uuid (FK → issues, `onDelete: cascade`) | Menghapus issue otomatis membersihkan entrinya dari riwayat ini |
| viewed_at | timestamptz | Di-upsert (bukan insert baru) setiap kali issue yang sama dibuka lagi (FR-134) |

> **Unique constraint** pada `(user_id, issue_id)` — satu baris per kombinasi user+issue, di-`ON CONFLICT DO UPDATE viewed_at` saat dibuka ulang. Dibatasi **maksimal 10 baris per user** (trim baris tertua di luar 10 teratas setiap kali insert/update, lihat §10.18) — disimpan di server (bukan `localStorage`) supaya konsisten lintas device (FR-133).

> **Catatan indexing:** skema didefinisikan & di-migrasi via `drizzle-kit generate`/`drizzle-kit migrate`. Tanpa entitas organisasi, tidak ada kolom `organization_id` yang perlu di-index di tabel manapun — menyederhanakan seluruh query dibanding draft v1.1.

---

## 8. Desain API (Ringkasan Endpoint REST)

| Modul | Endpoint | Method | Deskripsi |
|---|---|---|---|
| Auth | `/api/auth/sign-in/email` | POST | Login via Better Auth. Untuk Desktop Client, response menyertakan Bearer token (plugin aktif) selain cookie — dipakai `apps/web` |
| Auth | `/api/auth/sign-up/email` | POST | Registrasi via Better Auth |
| Auth | `/api/auth/sign-out` | POST | Logout — Desktop Client wajib panggil ini **dan** hapus token dari keychain lokal (§4.2) |
| Auth | `/api/auth/session` | GET | Sesi aktif (dipakai guard) — menerima baik cookie (`apps/web`) maupun header `Authorization: Bearer <token>` (Desktop Client) |
| Profil | `/users/me` | GET/PATCH | Lihat & update profil sendiri (username, foto, nomor telepon) — foto diunggah via presigned URL R2 seperti dokumen/screenshot |
| Profil | `/admin/users/:id/employment` | PATCH | Update data kepegawaian user lain (jabatan, departemen, employeeId, joinDate, employmentStatus) — **Admin only** |
| Admin | `/admin/settings` | GET/PATCH | Pengaturan aplikasi (`company_name`, `screenshot_retention_days`) — **Admin only** |
| Admin | `/admin/users` | GET/POST/PATCH | Kelola user & flag `is_admin` — **Admin only** |
| Admin | `/admin/users/:id` | DELETE | "Hapus Akun" — set `employmentStatus=inactive` + paksa logout seluruh sesi aktif (web & desktop). **Bukan hard delete** (FR-009a) — **Admin only** |
| Admin | `/admin/users/:id?force=true` | DELETE | Hard delete permanen — **ditolak (400)** jika user punya riwayat kerja apapun (issues/time_blocks/comments > 0), lihat FR-009b — **Admin only** |
| Projects | `/projects` | GET/POST | List & buat proyek — body POST wajib sertakan `key` (Kode Proyek unik, immutable), opsional `members: [{userId, role}]` untuk langsung menambahkan anggota (FR-019) |
| Projects | `/projects/:id` | PATCH | Edit `name`/`description` — **`key` tidak dapat diubah lewat endpoint ini** (FR-015) |
| Projects | `/projects/:id/archive` | PATCH | Arsipkan (soft-delete) — ditolak (400) jika masih ada sub-proyek aktif (FR-017) — Manager/Admin |
| Projects | `/projects/:id/restore` | PATCH | Kembalikan dari arsip — Manager/Admin |
| Projects | `/projects/:id` | DELETE | Hard delete permanen + cascade seluruh data terkait. Body wajib `{ confirmKey: string }` harus sama persis dengan `projects.key` — **Admin only** (FR-018) |
| Projects | `/projects/:id/sub-projects` | GET/POST | Kelola sub-proyek — sub-proyek juga wajib punya `key` sendiri, independen dari induk |
| Memberships | `/projects/:id/members` | GET/POST/PATCH | Undang & atur role anggota proyek — **Admin dapat mengakses meski belum jadi member proyek ini** (§4.1) |
| Issue Statuses | `/projects/:id/issue-statuses` | GET/POST/PATCH/DELETE | CRUD status workflow (termasuk reorder & set `restricted_to_role`) — **Manager/Admin** |
| Issues | `/projects/:id/issues` | GET/POST | List (view=list\|kanban\|calendar) & buat tiket — nomor issue (`number`) di-generate otomatis, atomik per proyek. Body POST menerima `collaboratorIds?: string[]` opsional (FR-026f), guard lebih longgar dari endpoint Collaborators pasca-create |
| Issues | `/issues/:id` | GET/PATCH | Detail & edit tiket — edit oleh Assignee, Manager proyek terkait, atau Admin (FR-026) |
| Issues | `/issues/:id` | DELETE | Hapus tiket — **guard lebih ketat dari edit**: hanya pembuat tiket (`createdBy === currentUser`, peran apapun), Manager proyek terkait, atau Admin. Assignee yang bukan pembuat **ditolak** (403) (FR-026a). `time_blocks.issue_id` milik tiket yang dihapus di-set `NULL` (jadi kategori "Activity"), **bukan** ikut dihapus — data payroll tetap utuh |
| Issues | `/issues/mine?view=list\|kanban\|calendar` | GET | Agregasi tiket assigned ke user saat ini lintas semua proyek yang diikuti — dipanggil frontend saat menu Issues dibuka **tanpa proyek aktif** (FR-150, §5.1). Response dikelompokkan per proyek (`list`/`kanban`) atau flat lintas-proyek (`calendar`) — lihat §10.17 untuk struktur detail (FR-120–125) |
| Issues | `/issues/:id/status` | PATCH | Ubah status (dicek terhadap `restricted_to_role`) — **otomatis mencatat baris ke `issue_status_history`** dalam transaksi yang sama (FR-029c) |
| Issue Collaborators | `/issues/:id/collaborators` | GET | List collaborator tiket ini — anggota proyek manapun |
| Issue Collaborators | `/issues/:id/collaborators` | POST `{userId}` | Tambah collaborator. Guard: kalau `userId !== currentUser` → sama dengan guard edit (Assignee/Manager/Admin, FR-026); kalau self-add → anggota proyek manapun (FR-026c) |
| Issue Collaborators | `/issues/:id/collaborators/:userId` | DELETE | Hapus collaborator. Guard: kalau `:userId === currentUser` → selalu boleh; kalau bukan → sama dengan guard edit (FR-026d) |
| Excel Import | `/projects/:id/issues/import/preview` | POST | Upload file `.xlsx` (multipart) + `sheetName?` opsional. Kalau file >1 sheet dan `sheetName` belum dikirim → response `{requiresSheetSelection: true, sheets: [...]}` tanpa parsing. Kalau `sheetName` terisi (atau file cuma 1 sheet) → validasi & parse tiap baris, kembalikan preview + daftar error (FR-160–170). **Manager/Admin only** |
| Excel Import | `/projects/:id/issues/import/commit` | POST | Body JSON (bukan file lagi) — `{rows: ParsedRow[], fileName, sheetName}` hasil preview yang sudah difilter ke baris valid. Insert tiap baris via logic penomoran atomik yang sama dengan create issue biasa (§10.6), dalam satu transaksi. **Manager/Admin only** |
| Excel Import | `/projects/:id/issues/imports` | GET | Riwayat import (audit) — siapa, kapan, nama file, jumlah berhasil/gagal (FR-171). **Manager/Admin only** |
| Issue Attachments | `/issues/:id/attachments` | GET/POST | List & upload lampiran (presigned URL R2) |
| Issue Attachments | `/issues/:id/attachments/:attachmentId` | DELETE | Hapus lampiran (uploader atau Admin) |
| Issue Comments | `/issues/:id/comments` | GET/POST | List & tambah komentar — **anggota proyek peran manapun** boleh akses. Body POST: `{ body, parentCommentId? }` — kalau `parentCommentId` diisi, backend validasi comment tersebut milik issue yang sama **dan** `parent_comment_id`-nya sendiri `NULL` (cegah reply-ke-reply, FR-029b) |
| Issue Activity | `/issues/:id/activity` | GET | **Baru** — agregasi komentar (`issue_comments`) + log status (`issue_status_history`) dalam satu response, diurutkan kronologis. Dipakai frontend untuk render panel Aktivitas penuh (menggantikan pemakaian langsung endpoint `/comments` di UI) — lihat §10.19 |
| Issue Comments | `/issues/:id/comments/:commentId` | PATCH/DELETE | Edit (penulis saja) / Hapus (penulis atau Admin untuk moderasi) |
| Comment Attachments | `/issues/:id/comments/:commentId/attachments` | POST | Presigned upload URL untuk lampiran (file apa saja). Body: `{ fileName, mimeType, fileSizeBytes }` — validasi hanya `fileSizeBytes <= 50MB`, **tidak** membatasi `mimeType` tertentu (FR-029a) |
| Comment Attachments | `/issues/:id/comments/:commentId/attachments/:attachmentId/confirm` | POST | Konfirmasi upload lampiran selesai |
| Comment Attachments | `/issues/:id/comments/:commentId/attachments/:attachmentId/download` | GET | Presigned download URL (kedaluwarsa singkat, mis. 5 menit) — wajib untuk lampiran non-gambar yang perlu diunduh eksplisit |
| Templates | `/projects/:id/issue-templates` | GET/POST/PATCH | Kelola template (termasuk edit array `fields`) — **Manager/Admin** |
| Documents | `/projects/:id/documents` | GET | List seluruh **Document** (kontainer) — tiap baris tampilkan `title`, `category`, `fileCount`, bukan file itu sendiri |
| Documents | `/projects/:id/documents` | POST | Buat Document baru: `{ title, description?, category }` — **belum ada file** di langkah ini (FR-041) |
| Documents | `/projects/:id/documents/:documentId` | GET | Detail 1 Document beserta **seluruh file** di dalamnya (array `files[]`, masing-masing dengan `uploadedBy`/`uploadedAt` sendiri) |
| Documents | `/projects/:id/documents/:documentId` | PATCH | Edit `title`/`description`/`category` — **tidak mengubah file** di dalamnya (FR-046). Guard: pembuat Document, Manager, atau Admin |
| Documents | `/projects/:id/documents/:documentId` | DELETE | Hapus Document **beserta seluruh file di dalamnya** (cascade, termasuk object R2). Guard: pembuat Document, Manager, atau Admin (FR-047) |
| Document Files | `/projects/:id/documents/:documentId/files` | POST | Request presigned **upload** URL untuk menambah 1 file baru ke Document yang sudah ada — dipakai baik saat pertama kali isi file maupun "+ Tambah File" belakangan (FR-042). Body: `fileName`, `mimeType`, `fileSizeBytes` (maks. 50MB) |
| Document Files | `/projects/:id/documents/:documentId/files/:fileId/confirm` | POST | Konfirmasi upload ke R2 selesai — baru setelah ini file dianggap resmi ada |
| Document Files | `/projects/:id/documents/:documentId/files/:fileId/download` | GET | Generate presigned **download** URL (bucket R2 private, kedaluwarsa singkat mis. 5 menit) (FR-044) |
| Document Files | `/projects/:id/documents/:documentId/files/:fileId` | DELETE | Hapus **1 file saja** — Document dan file lain di dalamnya tetap ada. Guard: pengunggah file tersebut, Manager, atau Admin (FR-048) |
| Time Tracking | `/time-blocks/sync` | POST | Endpoint utama sinkronisasi dari Desktop Client tiap 10 menit |
| Time Tracking | `/time-blocks/:id/screenshot` | POST | Upload screenshot (presigned URL) |
| Time Tracking | `/time-blocks/:id` | DELETE | Pekerja hapus blok waktu miliknya sendiri |
| Time Tracking | `/time-blocks/:id/override` | POST | **Admin only.** Body: `{ action: "delete"\|"mark_unpaid", reason: string }` |
| Manual Time | `/manual-time-entries` | GET/POST | Input & lihat waktu manual |
| Timesheets | `/timesheets` | GET | List timesheet per periode |
| Timesheets | `/timesheets/:id/approve` | POST | Approve/reject oleh Manager |
| Reports | `/reports/hours?format=pdf\|csv` | GET | Generate & unduh laporan |
| Notifications | `/notifications` | GET | List notifikasi milik user sendiri, paginated, filter `?unread=true` |
| Notifications | `/notifications/:id/read` | PATCH | Tandai satu notifikasi sebagai telah dibaca |
| Notifications | `/notifications/read-all` | PATCH | Tandai seluruh notifikasi milik user sebagai telah dibaca |
| Web Push | `/push/vapid-public-key` | GET | Kirim VAPID public key ke frontend, dipakai saat proses subscribe (FR-107) |
| Web Push | `/push/subscribe` | POST | Simpan `PushSubscription` object (endpoint + keys) dari browser — dipanggil setelah user aktifkan toggle & izin browser diberikan |
| Web Push | `/push/unsubscribe` | DELETE | Hapus subscription — dipanggil saat user matikan toggle, atau saat logout |
| Discord Integration | `/admin/integrations/discord` | GET/POST/DELETE | Webhook **tingkat aplikasi** (event `project_created`) — **Admin only**. Response GET tidak pernah sertakan `webhookUrl` utuh, hanya `{ configured: boolean, events: [] }` (FR-114) |
| Discord Integration | `/projects/:id/integrations/discord` | GET/POST/DELETE | Webhook **tingkat proyek** — mendukung 2 event independen: `issue_created` dan `issue_status_changed` (FR-116) — Manager/Admin |
| Discord Integration | `/projects/:id/integrations/discord/test` | POST | Kirim pesan percobaan ke channel yang dikonfigurasi, untuk verifikasi sebelum diandalkan (FR-113) |
| Dashboard | `/dashboard/summary` | GET | Ringkasan hari ini: total menit kerja hari ini, jumlah tiket overdue milik user, status tracking terkini (FR-130) |
| Recently Viewed | `/issues/:id/view` | POST | Catat/upsert bahwa issue ini baru dilihat user saat ini — dipanggil otomatis saat detail issue dibuka (FR-132–134) |
| Recently Viewed | `/issues/recently-viewed` | GET | 10 issue terakhir dilihat user ini, lintas proyek, urut terbaru |
| Project Progress | `/projects` | GET | **Diperluas** — tiap item disertai `issueStats: { total, completed }` berdasarkan `issue_statuses.is_final` (FR-135–136) |
| Workload | `/projects/:id/workload` | GET | Distribusi tiket per anggota proyek, dipecah per status + jumlah overdue — Manager proyek terkait atau Admin (FR-137–139) |
| Live Status | `/projects/:id/live-status` | GET | **Revisi total dari "Activity Ranking"** — status langsung (Aktif/Idle/Offline) seluruh anggota proyek beserta tugas yang sedang dikerjakan. Guard identik Workload Overview: Manager proyek terkait, atau Admin (FR-140–144) |

### 8.1 Contoh Payload — Buat Tiket dari Template Bug (Sebagai Filler Teks)

Langkah 1 — frontend ambil teks awal dari template (tidak menyentuh backend, cukup dari response `GET /projects/:id/issue-templates` yang sudah di-cache):
```
Title (prefill)       : [BUG] Nama Fitur - Nama Bug
Description (prefill) : Role User: 
                         Current Condition: 
                         Expected Result: 
                         Link Halaman: 
                         Step to Reproduce: 
                         Evidence: 
                         Environment: (wajib diisi bug terjadi di mana)
```

Langkah 2 — user mengedit teks tersebut secara bebas, lalu submit sebagai **title/description biasa** (tanpa `titleValues`/`fieldValues` terstruktur seperti draft sebelumnya):
```json
POST /projects/:id/issues
{
  "trackerId": "<uuid-tracker-bug>",
  "title": "[BUG] Login Page - Tombol submit tidak responsif",
  "description": "Role User: Karyawan (staff biasa)\nCurrent Condition: Tombol submit tidak bereaksi saat diklik di halaman login\nExpected Result: Form ter-submit dan redirect ke dashboard\nLink Halaman: https://app.trackflow.local/login\nStep to Reproduce: 1. Buka halaman login 2. Isi email & password 3. Klik Submit\nEvidence: https://r2.trackflow.local/docs/screenshot-bug-001.png\nEnvironment: Chrome 126, Windows 11, resolusi 1366x768",
  "assigneeId": "<uuid-user>",
  "priority": "high",
  "collaboratorIds": ["<uuid-user-2>", "<uuid-user-3>"]
}
```
Backend **tidak lagi memvalidasi** kelengkapan field di dalam `description` (lihat §16 untuk trade-off). Backend hanya bertanggung jawab men-generate `number` secara atomik dan menyusun Issue ID tampilan `{projects.key}-{number}` (mis. `TRACK-142`) — lihat §10.6.

**`collaboratorIds` bersifat opsional** (FR-026f) — kalau diisi, backend insert baris `issue_collaborators` untuk tiap ID dalam **transaksi yang sama** dengan insert `issues`, dan kirim notifikasi ke tiap collaborator (kecuali kalau `userId` sama dengan pembuat tiket). **Guard di endpoint ini lebih longgar** dari `POST /issues/:id/collaborators` pasca-create (FR-026c) — cukup guard create issue yang sudah ada (anggota proyek manapun), tidak perlu jadi Assignee/Manager/Admin terlebih dahulu karena pembuat sedang menetapkan kondisi awal tiketnya sendiri (lihat §10.21a).

### 8.2 Contoh Payload — Upload Lampiran & Tambah Komentar

```json
POST /issues/:id/attachments   // presigned URL request
{ "fileName": "screenshot-bug-001.png" }

POST /issues/:id/comments
{ "body": "Sudah saya cek, ternyata masalah di validasi form sisi client. Sedang saya perbaiki." }
```

### 8.3 Contoh Payload — Sinkronisasi Blok Waktu dari Desktop Client

```json
POST /time-blocks/sync
{
  "userId": "uuid",
  "projectId": "uuid",
  "issueId": "uuid",
  "note": null,
  "blockStart": "2026-07-14T09:00:00Z",
  "blockEnd": "2026-07-14T09:10:00Z",
  "activity": {
    "keyboardCount": 342,
    "mouseCount": 88,
    "activeAppName": "Visual Studio Code",
    "activeWindowTitle": "trackflow-backend — main.ts"
  }
}
```

**Varian — task default "Activity" tanpa tiket (FR-091/092):**
```json
POST /time-blocks/sync
{
  "userId": "uuid",
  "projectId": "uuid",
  "issueId": null,
  "note": "Riset library upload file untuk lampiran issue",
  "blockStart": "2026-07-14T09:10:00Z",
  "blockEnd": "2026-07-14T09:20:00Z",
  "activity": { "...": "..." }
}
```

---

## 9. Komunikasi Real-time (Socket.io)

| Event | Arah | Payload Ringkas | Kegunaan |
|---|---|---|---|
| `user.status_changed` | Server → Web | `{userId, status: active\|idle\|offline}` | Status kerja tim real-time — dipicu oleh heartbeat desktop client tiap ~60 detik (§10.18), dipakai oleh halaman Live Status (FR-140–144) |
| `issue.updated` | Server → Web | `{issueId, changes}` | Update Kanban/List tanpa refresh |
| `timeblock.synced` | Server → Web | `{userId, projectId, blockStart}` | Indikator "aktif bekerja" |
| `timesheet.approved` | Server → Web | `{timesheetId, status}` | Notifikasi ke Developer |
| `timeblock.overridden` | Server → Web | `{timeBlockId, actorId, targetUserId, action, reason}` | Notifikasi ke pekerja terdampak saat Admin override |
| `issue.comment_created` | Server → Web | `{issueId, commentId, authorId, bodyPreview, parentCommentId, hasImages}` | Update panel Aktivitas/Komentar secara realtime tanpa refresh — `parentCommentId` dipakai frontend untuk menyisipkan reply ke bawah komentar induk yang tepat, bukan di akhir list |
| `issue.status_logged` | Server → Web | `{issueId, oldStatusName, newStatusName, changedBy, changedAt}` | Baris log status baru muncul realtime di panel Aktivitas siapapun yang sedang membuka issue tersebut, terlepas dari tampilan mana yang memicu perubahan (List/Kanban/mode agregasi Issues) |
| `notification.created` | Server → Web | `{id, type, title, body, entityType, entityId}` | Notifikasi baru (FR-100–104) — dikirim **hanya ke room pribadi penerima** (`user:{userId}`), bukan broadcast ke semua |

**Room per-user untuk notifikasi:** setiap koneksi Socket.io otomatis `socket.join('user:' + userId)` saat connect (identitas dari sesi Better Auth). Event `notification.created` di-emit ke room spesifik ini — memastikan notifikasi hanya sampai ke penerima yang dituju, bukan seluruh pengguna yang sedang online.

Desktop Client menggunakan gateway ini untuk heartbeat ringan; screenshot tetap lewat REST + presigned URL.

---

## 10. Alur Data Kritis (Sequence Diagrams)

### 10.1 Alur Time Tracking & Sinkronisasi

```mermaid
sequenceDiagram
    participant D as Desktop Client
    participant A as Backend API
    participant PG as PostgreSQL
    participant R2 as Cloudflare R2

    D->>D: Klik Start → mulai timer & jadwalkan screenshot acak
    loop Tiap 10 menit
        D->>D: Hitung keyboard/mouse count, ambil screenshot acak
        D->>A: POST /time-blocks/sync
        A->>PG: Insert time_block + activity_log (Drizzle ORM)
        A-->>D: 200 OK {timeBlockId}
        D->>A: POST /time-blocks/:id/screenshot
        A-->>D: presigned URL
        D->>R2: Upload langsung ke R2
        D->>A: Konfirmasi upload selesai
        A->>PG: Update record screenshots
    end
```

### 10.2 Alur Kontrol Privasi — Hapus Blok Waktu (Self)

```mermaid
sequenceDiagram
    participant U as Pekerja (Web)
    participant A as Backend API
    participant PG as PostgreSQL
    participant R2 as Cloudflare R2

    U->>A: DELETE /time-blocks/:id
    A->>A: Validasi: apakah blok milik user ini?
    A->>PG: Set is_deleted=true, is_paid=false, deleted_by=self
    A->>R2: Hapus object screenshot terkait
    A->>PG: Insert time_block_audit_logs (action=self_delete)
    A-->>U: 200 OK
```

### 10.3 Alur Workflow Tiket (Status Dapat Dikustomisasi)

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant A as Backend API
    participant PG as PostgreSQL
    participant QA as QA

    Dev->>A: PATCH /issues/:id/status {statusId: "Resolved"}
    A->>PG: SELECT restricted_to_role FROM issue_statuses WHERE id = :statusId
    Note over A: restricted_to_role = NULL → siapapun anggota proyek boleh set
    A-->>Dev: 200 OK
    QA->>A: PATCH /issues/:id/status {statusId: "Done"}
    A->>PG: SELECT restricted_to_role → "reporter_qa"
    A->>A: Cek role QA saat ini == reporter_qa? Ya → izinkan
    A-->>QA: 200 OK
    Note over A: Jika Developer mencoba set "Done" langsung → 403 Forbidden (role tidak cocok dengan restricted_to_role)
```

### 10.4 Alur Membuat Tiket dari Issue Template (Sebagai Filler Teks)

```mermaid
sequenceDiagram
    participant U as Pengguna (Web)
    participant A as Backend API
    participant PG as PostgreSQL

    U->>A: GET /projects/:id/issue-templates
    A->>PG: Query issue_templates (project_id ATAU project_id IS NULL untuk global)
    A-->>U: List template, termasuk "Bug Report Default"
    U->>U: Pilih template Bug → frontend isi Title & Description dari title_pattern + fields (di sisi client, tanpa panggil backend lagi)
    U->>U: Edit Title & Description secara bebas seperti teks biasa
    U->>A: POST /projects/:id/issues {trackerId, title, description, assigneeId, priority}
    A->>A: Generate nomor issue atomik (lihat §10.6) — TIDAK ada validasi kelengkapan field description
    A->>PG: Insert issues
    A-->>U: 201 Created {number, title}
```

### 10.5 Alur Override Blok Waktu oleh Admin

```mermaid
sequenceDiagram
    participant Adm as Admin
    participant A as Backend API
    participant PG as PostgreSQL
    participant W as Pekerja Terdampak (via WS)

    Adm->>A: POST /time-blocks/:id/override {action, reason}
    A->>A: AdminGuard: cek user.isAdmin = true
    alt bukan admin
        A-->>Adm: 403 Forbidden
    else admin
        A->>A: Validasi field "reason" wajib terisi
        A->>PG: Update time_blocks (deleted_by=Adm, deletion_type=admin_override, deletion_reason)
        A->>PG: Insert time_block_audit_logs (action=admin_override_delete)
        A-->>Adm: 200 OK
        A->>W: emit timeblock.overridden {actorId, action, reason}
    end
```

### 10.6 Alur Generate Nomor Issue Otomatis (Atomik per Proyek/Sub-proyek)

```mermaid
sequenceDiagram
    participant U as Pengguna (Web)
    participant A as Backend API
    participant PG as PostgreSQL

    U->>A: POST /projects/:id/issues {title, description, ...}
    A->>PG: BEGIN TRANSACTION
    A->>PG: UPDATE projects SET issue_sequence = issue_sequence + 1 WHERE id = :projectId RETURNING issue_sequence
    Note over A,PG: Row lock mencegah 2 request bersamaan dapat nomor yang sama
    A->>PG: INSERT issues (project_id, number = issue_sequence_baru, ...)
    A->>PG: COMMIT
    A-->>U: 201 Created {number, displayId: "{projects.key}-{number}"}
    Note over A: Sub-proyek punya project_id & issue_sequence sendiri — nomor TIDAK bersambung dengan proyek induk
```

### 10.7 Alur Komentar Issue Activity — Termasuk Reply & Lampiran File Universal (Realtime)

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant A as Backend API
    participant PG as PostgreSQL
    participant R2 as Cloudflare R2
    participant QA as QA (via WS)

    Note over Dev: Komentar utama, dengan lampiran file (gambar ATAU tipe lain, mis. PDF)
    Dev->>A: POST /issues/:id/comments {body}
    A->>A: Cek: pengirim member proyek manapun (role apapun) atau Admin?
    A->>PG: Insert issue_comments (parent_comment_id=NULL)
    A-->>Dev: 201 Created {commentId}
    Dev->>A: POST /issues/:id/comments/:commentId/attachments {fileName, mimeType, fileSizeBytes}
    A->>A: Validasi fileSizeBytes <= 50MB (mimeType TIDAK dibatasi tipe tertentu)
    A-->>Dev: presigned upload URL + attachmentId
    Dev->>R2: Upload file langsung ke R2
    Dev->>A: POST .../attachments/:attachmentId/confirm
    A->>PG: Insert comment_attachments (mimeType disimpan untuk keputusan render FE)
    A->>QA: emit issue.comment_created {commentId, parentCommentId=null, hasImages=true}
    Note over QA: Panel Aktivitas QA ter-update — file bertipe image/* dirender thumbnail, tipe lain dirender kartu ikon+nama+tombol download

    Note over QA: QA membalas komentar tersebut
    QA->>A: POST /issues/:id/comments {body, parentCommentId: commentId}
    A->>PG: Cek parentCommentId — milik issue yang sama? parent_comment_id-nya sendiri NULL?
    alt Parent adalah reply (sudah punya parent_comment_id)
        A-->>QA: 400 Bad Request ("Tidak bisa membalas balasan — reply dibatasi 1 tingkat")
    else Parent adalah komentar utama
        A->>PG: Insert issue_comments (parent_comment_id=commentId)
        A-->>QA: 201 Created
        A->>Dev: emit issue.comment_created {parentCommentId=commentId, hasImages=false}
        Note over Dev: Reply tersisip terindentasi di bawah komentar induk, bukan di akhir list
    end

    Note over Dev: Kapan saja setelahnya — download lampiran non-gambar
    Dev->>A: GET /issues/:id/comments/:commentId/attachments/:attachmentId/download
    A-->>Dev: presigned download URL (kedaluwarsa singkat, mis. 5 menit)
    Dev->>R2: Download langsung dari R2
```

### 10.8 Alur Tray Icon — Hide, Bukan Quit

```mermaid
sequenceDiagram
    participant U as Pengguna
    participant WIN as Window Utama
    participant TRAY as Tray Icon Manager
    participant CORE as Rust Core Process

    U->>WIN: Klik tombol close (X)
    WIN->>WIN: on_close_requested → event.prevent_default()
    WIN->>WIN: window.hide() (bukan keluar)
    Note over CORE: Timer & Sync Service tetap berjalan di background
    U->>TRAY: Klik icon tray
    TRAY-->>U: Tampilkan menu (status task+durasi, Pause/Resume, Buka Aplikasi, Keluar)
    alt Pilih "Buka Aplikasi"
        TRAY->>WIN: window.show()
    else Pilih "Keluar"
        TRAY->>CORE: Hentikan timer & Sync Service
        TRAY->>WIN: Tutup aplikasi sepenuhnya
    end
```

### 10.9 Alur Floating Widget — Countdown 15 Detik, Preview/Submit/Discard

```mermaid
sequenceDiagram
    participant CAP as Screenshot Capture Module
    participant CORE as Rust Core Process
    participant W as Widget (screenshot-widget)
    participant P as Preview (screenshot-preview)
    participant DB as Local SQLite Buffer
    participant SYNC as Sync Service

    CAP->>CORE: Screenshot diambil
    CORE->>W: Tampilkan widget (thumbnail + timer)
    CORE->>CORE: Mulai countdown 15 detik
    loop Tiap detik
        CORE->>W: emit countdown-tick(remaining)
        W-->>W: Update angka mundur + progress bar
    end

    alt Pengguna klik "Preview" (kapan saja sebelum countdown habis)
        W->>CORE: Pause countdown (simpan sisa detik)
        CORE->>P: Buka/tampilkan window screenshot-preview
        Note over W: Widget TETAP TERLIHAT, tidak ikut hilang
        P->>P: Pengguna menutup window (close/Cmd+W/Esc) — cara apapun
        P->>CORE: window "screenshot-preview" CloseRequested
        CORE->>W: Resume countdown dari sisa detik terakhir
        Note over W,P: Tidak ada kode yang memanggil close() ke widget dari handler ini
    else Pengguna klik "Submit" ATAU countdown mencapai 0
        W->>CORE: Konfirmasi Submit
        CORE->>P: Jika preview masih terbuka, tutup otomatis
        CORE->>DB: Simpan blok waktu + screenshot ke buffer lokal
        DB->>SYNC: Lanjut alur sync normal (§10.1)
        CORE->>W: Tutup widget
    else Pengguna klik "Discard"
        W->>CORE: Konfirmasi Discard
        CORE->>P: Jika preview masih terbuka, tutup otomatis
        CORE->>CORE: Hapus screenshot dari penyimpanan lokal & buang data blok waktu
        Note over DB: TIDAK ADA baris yang masuk ke Local SQLite Buffer — blok ini tidak pernah ada di server
        CORE->>W: Tutup widget
    end
```

### 10.10 Alur Drag-and-Drop Kanban (Validasi Client-Side + Fallback Server)

```mermaid
sequenceDiagram
    participant U as Pengguna
    participant FE as Frontend (dnd-kit)
    participant A as Backend API
    participant PG as PostgreSQL

    U->>FE: Mulai drag kartu issue
    FE->>FE: Cek restricted_to_role kolom target vs role user (data sudah di-cache dari GET issue-statuses)
    alt Role tidak cocok
        FE-->>U: Kolom target ditandai drop-disabled (visual saja, drop dicegah di sisi client)
    else Role cocok (atau kolom tidak dibatasi)
        U->>FE: Drop kartu ke kolom target
        FE->>FE: Optimistic update — pindahkan kartu di UI seketika
        FE->>A: PATCH /issues/:id/status {statusId}
        A->>PG: Cek ulang restricted_to_role (validasi tetap di server, tidak percaya client)
        alt Backend menolak (403) — mis. race condition role berubah
            A-->>FE: 403 Forbidden
            FE->>FE: Revert kartu ke kolom asal + tampilkan toast error
        else Backend mengizinkan
            A-->>FE: 200 OK
            Note over FE: Tidak ada perubahan tambahan — optimistic update sudah benar
        end
    end
```

**Prinsip penting:** validasi di frontend (langkah pertama) murni untuk **UX** (mencegah user drag ke kolom yang jelas-jelas akan ditolak) — validasi otoritatif tetap di backend (langkah kedua), karena frontend tidak pernah bisa dipercaya sepenuhnya untuk keputusan otorisasi.

### 10.11 Alur Arsip Proyek (Soft-Delete) & Hard Delete Permanen

```mermaid
sequenceDiagram
    participant M as Manager
    participant A as Backend API
    participant PG as PostgreSQL
    participant Adm as Admin

    M->>A: PATCH /projects/:id/archive
    A->>PG: Cek sub-proyek dengan archived_at IS NULL milik proyek ini
    alt Ada sub-proyek masih aktif
        A-->>M: 400 Bad Request ("Arsipkan sub-proyek terlebih dahulu")
    else Tidak ada sub-proyek aktif
        A->>PG: UPDATE projects SET archived_at=now(), archived_by=:userId
        A-->>M: 200 OK
        Note over PG: Seluruh data (issues, time_blocks, dst) TETAP UTUH — hanya disembunyikan dari tampilan default
    end

    Note over Adm: Kasus khusus — hard delete permanen
    Adm->>A: DELETE /projects/:id {confirmKey: "TRACK"}
    A->>PG: Bandingkan confirmKey dengan projects.key
    alt confirmKey tidak cocok
        A-->>Adm: 400 Bad Request ("Kode proyek tidak sesuai")
    else confirmKey cocok
        A->>PG: DELETE CASCADE (issues, time_blocks, documents, comments, dst)
        A-->>Adm: 200 OK
        Note over PG: Tidak dapat dikembalikan — berbeda dari archive di atas
    end
```

### 10.12 Alur Membuat Proyek Sekaligus Menambahkan Anggota

```mermaid
sequenceDiagram
    participant U as Pengguna
    participant A as Backend API
    participant PG as PostgreSQL

    U->>A: POST /projects {name, key, members: [{userId, role}, ...]}
    A->>PG: BEGIN TRANSACTION
    A->>PG: Insert projects
    A->>PG: Seed 6 issue_statuses default (§10.6 area)
    A->>PG: Insert project_memberships untuk tiap entry di "members"
    A->>A: Jika pembuat proyek tidak ada di "members" → tambahkan sebagai manager
    A->>PG: COMMIT
    A-->>U: 201 Created {project, members}
```

### 10.13 Alur Deaktivasi Akun ("Hapus Akun") & Notifikasi

```mermaid
sequenceDiagram
    participant Adm as Admin
    participant A as Backend API
    participant PG as PostgreSQL
    participant AUTH as Better Auth

    Adm->>A: DELETE /admin/users/:id
    A->>PG: Cek employmentStatus saat ini
    A->>PG: UPDATE user SET employmentStatus='inactive'
    A->>AUTH: Invalidasi seluruh session/token aktif user ini
    Note over AUTH: Berlaku untuk sesi web (cookie) maupun Bearer token desktop client
    A-->>Adm: 200 OK
    Note over PG: Data historis (issues, time_blocks, comments) TIDAK dihapus (FR-009a)

    Note over Adm: Kasus khusus — hard delete (hanya akun tanpa riwayat)
    Adm->>A: DELETE /admin/users/:id?force=true
    A->>PG: COUNT issues + time_blocks + issue_comments milik user ini
    alt Total > 0
        A-->>Adm: 400 Bad Request ("User punya riwayat kerja, nonaktifkan saja")
    else Total = 0
        A->>PG: DELETE user permanen
        A-->>Adm: 200 OK
    end
```

### 10.14 Alur Notifikasi (Mention & Realtime Delivery)

```mermaid
sequenceDiagram
    participant QA as QA
    participant A as Backend API
    participant PG as PostgreSQL
    participant WS as Socket.io Gateway
    participant Dev as Developer (via WS, room user:{id})

    QA->>A: POST /issues/:id/comments {body: "Cek dulu ya @developer1"}
    A->>PG: Insert issue_comments
    A->>A: Parse body dengan regex @(\w+), cocokkan ke username
    A->>PG: SELECT id FROM user WHERE username='developer1'
    A->>PG: Insert notifications (type=issue_mentioned, userId=developer1.id, entityType=issue, entityId)
    A->>WS: emit ke room user:{developer1.id} → notification.created
    WS->>Dev: Terima event, badge lonceng bertambah realtime
    Dev->>A: Klik notifikasi → PATCH /notifications/:id/read
    A->>PG: UPDATE notifications SET is_read=true
    Dev->>Dev: Navigasi ke issue terkait (entityType=issue, entityId)
```

### 10.15 Alur Buat Document, Tambah File, dan Download (Model Kontainer)

```mermaid
sequenceDiagram
    participant U as Pengguna
    participant A as Backend API
    participant PG as PostgreSQL
    participant R2 as Cloudflare R2

    Note over U: Langkah 1 — Buat Document (kontainer, belum ada file)
    U->>U: Isi Judul, Deskripsi opsional, pilih Tipe Dokumen
    U->>A: POST /projects/:id/documents {title, description, category}
    A->>PG: Insert documents
    A-->>U: 201 Created {documentId} — Document langsung muncul di daftar dengan fileCount=0

    Note over U: Langkah 2 — Tambah file (bisa langsung, atau kapan saja belakangan)
    U->>A: POST /projects/:id/documents/:documentId/files {fileName, mimeType, fileSizeBytes}
    A->>PG: Cek fileSizeBytes <= 50MB
    A-->>U: presigned upload URL + fileId
    U->>R2: Upload file langsung ke R2
    R2-->>U: Upload sukses
    U->>A: POST /projects/:id/documents/:documentId/files/:fileId/confirm
    A->>PG: Insert document_files (uploadedBy=user saat ini)
    A-->>U: 200 OK — file langsung muncul di detail Document, fileCount bertambah

    Note over U: Bisa diulang — anggota tim lain menambah file lain ke Document yang sama, kapan saja

    Note over U: Download — kapan saja setelahnya
    U->>A: GET /projects/:id/documents/:documentId/files/:fileId/download
    A->>A: Cek file memang milik documentId ini, dan documentId milik proyek ini
    A-->>U: presigned download URL (kedaluwarsa singkat, mis. 5 menit)
    U->>R2: Download langsung dari R2 menggunakan URL tersebut
```

**Alur hapus (2 skenario berbeda konsekuensi):**
- `DELETE /projects/:id/documents/:documentId` → hapus Document **beserta seluruh file di dalamnya** (cascade DB + hapus semua object R2 terkait).
- `DELETE /projects/:id/documents/:documentId/files/:fileId` → hapus **1 file saja**, Document dan file lain tetap utuh.

### 10.16 Alur Integrasi Discord — Konfigurasi & Trigger Notifikasi Issue Baru + Perubahan Status (Fire-and-Forget)

```mermaid
sequenceDiagram
    participant Adm as Admin/Manager
    participant DC as Discord (Channel)
    participant A as Backend API
    participant PG as PostgreSQL
    participant U as User Lain (buat proyek/issue)

    Note over Adm,DC: Setup — dilakukan sekali di sisi Discord terlebih dahulu
    Adm->>DC: Buat Webhook baru di pengaturan channel, salin URL
    Adm->>A: POST /projects/:id/integrations/discord {webhookUrl, events: ["issue_created"]}
    A->>PG: Insert discord_webhooks
    A-->>Adm: 201 Created {configured: true} — webhookUrl TIDAK dikembalikan ke response
    Adm->>A: POST /projects/:id/integrations/discord/test
    A->>DC: Kirim pesan percobaan
    DC-->>Adm: "✅ TrackFlow berhasil terhubung ke channel ini" muncul di Discord

    Note over U,DC: Trigger sesungguhnya — tidak boleh blocking/menggagalkan proses utama
    U->>A: POST /projects/:id/issues {title, ...}
    A->>PG: Insert issues (proses utama, SELALU berhasil terlepas dari status Discord)
    A-->>U: 201 Created
    A->>PG: Query discord_webhooks WHERE project_id=:id AND events CONTAINS 'issue_created'
    alt Webhook terkonfigurasi
        A->>DC: POST webhookUrl {embeds: [{title, url, color}]} — fire-and-forget, tanpa await blocking response ke U
        alt Discord API gagal/timeout
            A->>A: Log warning, TIDAK throw error — issue tetap berhasil dibuat
        end
    else Belum terkonfigurasi
        Note over A: Tidak ada notifikasi terkirim — tidak ada fallback ke webhook tingkat aplikasi (FR-112)
    end

    Note over U,DC: Trigger terpisah — perubahan status (FR-116), independen dari event issue_created
    U->>A: PATCH /issues/:id/status {statusId}
    A->>A: Validasi restricted_to_role (§10.3) — tidak terkait sama sekali dengan konfigurasi Discord
    A->>PG: Update issues.status_id (proses utama, SELALU berhasil terlepas dari status Discord)
    A-->>U: 200 OK
    A->>PG: Query discord_webhooks WHERE project_id=:id AND events CONTAINS 'issue_status_changed'
    alt Event ini terkonfigurasi (terpisah dari toggle issue_created)
        A->>DC: POST webhookUrl {embeds: [{title, description: "oldStatus → newStatus, oleh actor"}]}
    else Belum terkonfigurasi
        Note over A: Tidak terkirim — checkbox event ini independen, bisa nonaktif meski issue_created aktif
    end
```

**Prinsip penting:** insert `issues`/`projects` ke database **selalu dianggap selesai** sebelum proses kirim ke Discord dimulai — kegagalan Discord (channel dihapus, rate limit, downtime) tidak boleh pernah menggagalkan atau menunda response ke user (FR-115).

### 10.17 Alur Guard Hapus Tiket (Creator-Only) & Mode Agregasi Menu Issues (Tanpa Proyek Aktif)

```mermaid
sequenceDiagram
    participant Assignee as Developer (Assignee, bukan pembuat)
    participant Creator as Developer (Pembuat tiket)
    participant A as Backend API
    participant PG as PostgreSQL

    Assignee->>A: DELETE /issues/:id
    A->>PG: Cek issues.created_by vs currentUser.id
    A->>A: created_by != currentUser, dan role bukan manager/admin
    A-->>Assignee: 403 Forbidden ("Hanya pembuat tiket, Manager, atau Admin yang dapat menghapus")

    Creator->>A: DELETE /issues/:id
    A->>PG: Cek issues.created_by vs currentUser.id
    A->>A: created_by == currentUser → diizinkan
    A->>PG: UPDATE time_blocks SET issue_id=NULL WHERE issue_id=:id (data payroll TIDAK dihapus)
    A->>PG: DELETE issues (cascade: issue_comments, issue_attachments)
    A-->>Creator: 200 OK
```

```mermaid
sequenceDiagram
    participant U as Pengguna (buka menu Issues TANPA proyek aktif)
    participant A as Backend API
    participant PG as PostgreSQL

    U->>A: GET /issues/mine?view=kanban
    A->>PG: SELECT project_id FROM project_memberships WHERE user_id=:currentUser (atau semua proyek jika isAdmin)
    A->>PG: SELECT * FROM issues WHERE assignee_id=:currentUser AND project_id IN (:myProjectIds)
    A->>A: Group issues by project_id — proyek tanpa issue assigned DIKECUALIKAN dari response (FR-125)
    loop Tiap proyek yang punya >=1 issue assigned
        A->>PG: SELECT issue_statuses WHERE project_id=:projectId ORDER BY order_index
    end
    A-->>U: { projects: [{ projectId, projectKey, projectName, statuses, issues }, ...] }
    U->>U: Render mini-board Kanban per proyek, masing-masing collapsible, kolom sesuai statuses proyek tsb

    Note over U: Drag-and-drop pada mini-board mana pun tetap panggil endpoint yang sama
    U->>A: PATCH /issues/:id/status {statusId}
    Note over A: Validasi restricted_to_role identik dengan Kanban per-proyek (§10.10) — tidak ada logic baru

    Note over U: Begitu user pilih proyek dari switcher/dropdown manapun (§5.1)
    U->>U: activeProjectId ter-set → menu Issues otomatis beralih memanggil GET /projects/:id/issues (mode per-proyek biasa)
```

### 10.18 Alur 4 Fitur Visibilitas — Dashboard, Recently Viewed, Progress Bar, Workload

```mermaid
sequenceDiagram
    participant U as Pengguna
    participant M as Manager
    participant A as Backend API
    participant PG as PostgreSQL

    Note over U: 1. Dashboard Summary
    U->>A: GET /dashboard/summary
    A->>PG: SUM durasi time_blocks hari ini WHERE user_id, is_deleted=false
    A->>PG: COUNT issues WHERE assignee_id, status.is_final=false, due_date < now()
    A-->>U: { todayMinutes, overdueCount, activeTimerStatus }

    Note over U: 2. Recently Viewed — dipanggil setiap detail issue dibuka
    U->>A: POST /issues/:id/view
    A->>PG: INSERT ... ON CONFLICT (user_id, issue_id) DO UPDATE viewed_at=now()
    A->>PG: Trim baris di luar 10 teratas per user_id (hapus sisanya)
    U->>A: GET /issues/recently-viewed
    A-->>U: 10 issue terakhir, urut viewed_at DESC

    Note over U: 3. Progress Bar Proyek — bagian dari response list proyek
    U->>A: GET /projects
    A->>PG: JOIN issues+issue_statuses, GROUP BY project_id, hitung total & is_final=true
    A-->>U: [{ ...project, issueStats: { total, completed } }, ...]

    Note over M: 4. Workload Overview — Manager/Admin only
    M->>A: GET /projects/:id/workload
    A->>A: Cek role = manager (proyek ini) ATAU isAdmin
    A->>PG: SELECT semua project_memberships proyek ini (termasuk yang 0 tiket assigned)
    A->>PG: LEFT JOIN issues per anggota, GROUP BY user_id, status_id
    A-->>M: { members: [{ userId, totalAssigned, byStatus, overdueCount }, ...] }
```

### 10.18a Alur Live Status — Heartbeat Desktop Client & Fallback Deteksi Offline (Revisi dari Activity Ranking)

```mermaid
sequenceDiagram
    participant D as Desktop Client
    participant WS as Socket.io Gateway
    participant PG as PostgreSQL
    participant M as Manager (Live Status page)
    participant CRON as Cron Job (tiap 2 menit)

    Note over D: Selama tracking berjalan
    loop Tiap ~60 detik
        D->>D: Cek waktu sejak input event terakhir vs threshold 5 menit → tentukan status active/idle
        D->>WS: emit('heartbeat', {status, projectId, issueId})
        WS->>PG: UPSERT user_live_status (status, projectId, issueId, lastHeartbeatAt=now())
        WS->>M: emit user.status_changed {userId, status} — broadcast ke room project:{projectId}
        M->>M: Update badge realtime tanpa refresh
    end

    Note over D: Saat Stop tracking / quit aplikasi (graceful)
    D->>WS: emit('heartbeat', {status: 'offline'})
    WS->>PG: UPDATE user_live_status SET status='offline'
    WS->>M: emit user.status_changed {userId, status: 'offline'}

    Note over D: Saat koneksi terputus TANPA graceful disconnect (mis. jaringan putus, laptop mati mendadak)
    CRON->>PG: SELECT user_live_status WHERE last_heartbeat_at < now() - 3 menit AND status != 'offline'
    CRON->>PG: UPDATE SET status='offline' untuk baris yang stale
    CRON->>M: emit user.status_changed {userId, status: 'offline'} untuk tiap baris yang diupdate

    Note over M: Membuka halaman untuk pertama kali
    M->>WS: GET /projects/:id/live-status
    WS->>PG: SELECT project_memberships JOIN user_live_status (LEFT JOIN — anggota belum pernah tracking = default offline)
    WS-->>M: { members: [{ userId, status, currentTask, lastHeartbeatAt }, ...] }
```

**Prinsip penting:** `user_live_status` adalah **snapshot**, bukan log — tidak dipakai untuk laporan/audit historis apapun (itu tetap peran `activity_logs`). Cron fallback memastikan status tidak "tersangkut" Aktif/Idle selamanya kalau desktop client mati mendadak tanpa sempat kirim sinyal offline.

### 10.19 Alur Log Perubahan Status Tergabung di Issue Activity (Immutable)

```mermaid
sequenceDiagram
    participant Dev as Developer (dari Kanban/List/mode agregasi Issues)
    participant A as Backend API
    participant PG as PostgreSQL
    participant WS as Socket.io Gateway
    participant QA as QA (via WS, sedang buka panel Aktivitas)

    Dev->>A: PATCH /issues/:id/status {statusId: newStatusId}
    A->>A: Validasi restricted_to_role (§10.3/§10.10) — TIDAK BERUBAH dari sebelumnya
    A->>PG: BEGIN TRANSACTION
    A->>PG: UPDATE issues SET status_id=newStatusId
    A->>PG: INSERT issue_status_history (old_status_id, new_status_id, changed_by, changed_at)
    A->>PG: COMMIT
    A-->>Dev: 200 OK
    A->>WS: emit issue.status_logged {oldStatusName, newStatusName, changedBy, changedAt}
    WS->>QA: Baris log realtime tersisip di panel Aktivitas, kronologis di antara komentar yang ada

    Note over QA: Kapan saja setelahnya
    QA->>A: GET /issues/:id/activity
    A->>PG: Query issue_comments + issue_status_history untuk issue ini
    A->>A: Gabung kedua hasil, urutkan berdasarkan created_at/changed_at
    A-->>QA: [{ type: comment, ... }, { type: status_change, ... }, ...] — kronologis

    Note over A: Tidak ada endpoint PATCH/DELETE untuk issue_status_history — permanen untuk siapapun, termasuk Admin
```

### 10.20 Alur Web Push Notification — Subscribe & Pengiriman (Best-Effort)

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant SW as Service Worker (browser)
    participant A as Backend API
    participant PG as PostgreSQL
    participant PS as Push Service (FCM/Mozilla/dst)
    participant QA as QA (pemicu notifikasi)

    Note over Dev: Aktivasi — opt-in dari halaman Profil, BUKAN otomatis saat login
    Dev->>SW: Toggle "Aktifkan Push" → register('/sw.js')
    Dev->>Dev: Browser prompt izin native → user klik "Izinkan"
    Dev->>A: GET /push/vapid-public-key
    A-->>Dev: publicKey
    Dev->>SW: pushManager.subscribe({applicationServerKey: publicKey})
    SW-->>Dev: PushSubscription {endpoint, keys}
    Dev->>A: POST /push/subscribe {endpoint, keys}
    A->>PG: Insert push_subscriptions

    Note over Dev: Developer menutup SEMUA tab TrackFlow
    QA->>A: POST /issues/:id/comments {body: "@developer1 ..."}
    A->>PG: Insert notifications (proses yang sudah ada, TIDAK berubah)
    A->>PG: Query push_subscriptions WHERE user_id = developer1.id
    loop Tiap subscription milik Developer (bisa lebih dari satu device)
        A->>PS: sendNotification(endpoint, {title, body, url}) — fire-and-forget
        alt Push berhasil
            PS->>SW: Deliver push event (meski browser/tab tertutup)
            SW->>Dev: showNotification() — muncul di OS notification tray
        else Push gagal (410/404 — subscription tidak valid lagi)
            A->>PG: DELETE push_subscriptions (bersihkan otomatis)
        end
    end
    Dev->>SW: Klik notifikasi
    SW->>Dev: clients.openWindow(url) — browser terbuka langsung ke issue terkait
```

**Prinsip penting (konsisten dengan integrasi Discord §10.16):** kegagalan pengiriman push **tidak boleh** menggagalkan proses insert `notifications`/`issue_comments` itu sendiri — notification bell & data utama tetap berfungsi normal terlepas dari status push.

### 10.21 Alur Collaborators — Self-Add Bebas vs Tambah Orang Lain (Guard Berbeda)

```mermaid
sequenceDiagram
    participant QA as QA (bukan Assignee/Manager)
    participant Dev as Developer (Assignee tiket ini)
    participant A as Backend API
    participant PG as PostgreSQL
    participant Target as Developer Lain (ditambahkan)

    Note over QA: Self-add — "Ikuti Tiket Ini", tanpa guard edit
    QA->>A: POST /issues/:id/collaborators {userId: QA.id}
    A->>A: userId === currentUser → izinkan (FR-026c), cukup cek anggota proyek
    A->>PG: INSERT issue_collaborators (ON CONFLICT DO NOTHING — idempotent)
    A-->>QA: 200 OK
    Note over A: TIDAK kirim notifikasi — self-add tidak perlu memberi tahu diri sendiri

    Note over Dev,Target: Assignee menambahkan orang lain — guard sama dengan edit tiket
    Dev->>A: POST /issues/:id/collaborators {userId: Target.id}
    A->>A: userId !== currentUser → cek guard edit (Assignee/Manager/Admin, FR-026)
    A->>PG: INSERT issue_collaborators
    A->>PG: INSERT notifications (type=issue_collaborator_added, userId=Target.id)
    A-->>Dev: 200 OK
    A->>Target: emit notification.created (via Socket.io & push, jalur yang sudah ada)

    Note over QA: Skenario ditolak — Developer biasa (bukan Assignee/Manager) coba tambahkan ORANG LAIN
    QA->>A: POST /issues/:id/collaborators {userId: Target.id}
    A->>A: userId !== currentUser, DAN QA bukan Assignee/Manager/Admin
    A-->>QA: 403 Forbidden ("Hanya Assignee, Manager, atau Admin yang dapat menambahkan collaborator lain")

    Note over QA: Hapus diri sendiri — selalu boleh
    QA->>A: DELETE /issues/:id/collaborators/:QA.id
    A->>A: :userId === currentUser → selalu izinkan (FR-026d)
    A->>PG: DELETE issue_collaborators
    A-->>QA: 200 OK
```

**Catatan eksplisit — Collaborators tidak masuk hitungan fitur lain:** query `GET /issues/mine`, `GET /projects/:id/workload`, dan `GET /dashboard/summary` **tidak pernah** JOIN ke `issue_collaborators` — ketiganya tetap murni berdasarkan `issues.assignee_id` (FR-026e), tanpa perubahan logic apapun dari desain sebelumnya.

### 10.21a Alur Menetapkan Collaborators Sekaligus Saat Pembuatan Tiket (Guard Lebih Longgar)

```mermaid
sequenceDiagram
    participant Dev as Developer (anggota proyek manapun)
    participant A as Backend API
    participant PG as PostgreSQL
    participant C1 as Collaborator 1
    participant C2 as Collaborator 2

    Dev->>Dev: Isi form "Buat Tiket Baru" — pilih Assignee + 2 Collaborators dari multi-select
    Dev->>A: POST /projects/:id/issues {title, description, assigneeId, collaboratorIds: [C1.id, C2.id]}
    A->>A: Guard: anggota proyek manapun boleh create issue (TIDAK perlu jadi Assignee/Manager/Admin — beda dari FR-026c)
    A->>PG: BEGIN TRANSACTION
    A->>PG: Generate number atomik, INSERT issues (§10.6 — tidak berubah)
    A->>PG: INSERT issue_collaborators untuk tiap collaboratorIds (addedBy=Dev.id)
    A->>PG: COMMIT
    A-->>Dev: 201 Created {issue, collaborators}
    A->>C1: emit notification.created (type=issue_collaborator_added)
    A->>C2: emit notification.created (type=issue_collaborator_added)
    Note over A: Notifikasi TIDAK dikirim kalau salah satu collaboratorIds sama dengan Dev.id sendiri (self-add saat create)
```

**Perbedaan kunci dari §10.21:** endpoint ini (`POST /projects/:id/issues`) tidak pernah mengecek apakah pembuat adalah Assignee/Manager/Admin sebelum menambahkan Collaborators — karena pembuat **sedang menetapkan kondisi awal tiketnya sendiri**, bukan mengedit tiket yang sudah ada milik orang lain. Guard ketat FR-026c baru berlaku untuk penambahan Collaborator **setelah** tiket sudah tercipta, lewat endpoint `POST /issues/:id/collaborators` yang terpisah.

### 10.22 Alur Import Tiket dari Excel — Preview Multi-Sheet, Validasi, Commit

```mermaid
sequenceDiagram
    participant M as Manager
    participant FE as Frontend (state: File object)
    participant A as Backend API
    participant PG as PostgreSQL

    M->>FE: Pilih file .xlsx (3 sheet: "July 2026", "December 2025", "Ags 2024")
    FE->>A: POST /projects/:id/issues/import/preview (file, TANPA sheetName)
    A->>A: Validasi ekstensi .xlsx, mimetype, ukuran <=5MB
    A->>A: Load workbook — deteksi jumlah sheet
    A-->>FE: { requiresSheetSelection: true, sheets: ["July 2026", "December 2025", "Ags 2024"] }
    FE-->>M: Tampilkan dropdown pilih sheet

    M->>FE: Pilih "July 2026"
    FE->>A: POST /projects/:id/issues/import/preview (file YANG SAMA dari state, sheetName="July 2026")
    A->>A: Validasi header wajib ada (Module, Issues/Bugs Description, Tipe)
    A->>A: Validasi jumlah baris <=500
    A->>PG: Fetch issue_trackers + status pertama proyek (sekali, bukan per-baris)
    loop Tiap baris data
        A->>A: Validasi Module/Description wajib, Tipe cocok persis master, Priority enum, Target Date format
        A->>A: Compose title = "[{TIPE}] {Module} - {Description}"
    end
    A-->>FE: { totalRows: 30, validRows: 27, errorRows: 3, errors: [...], preview: [...] }
    FE-->>M: Tabel preview (hijau=valid, merah=error dengan pesan spesifik) + tombol "Unduh Laporan Error"

    M->>FE: Klik "Import 27 Tiket"
    FE->>A: POST /projects/:id/issues/import/commit {rows: [27 baris valid], fileName, sheetName}
    A->>A: Re-validasi ringan (trackerId memang masih ada di master — defense in depth)
    A->>PG: BEGIN TRANSACTION
    loop Tiap baris valid (27x)
        A->>PG: Generate number atomik + INSERT issues (reuse logic §10.6, assigneeId selalu NULL)
    end
    A->>PG: INSERT issue_imports (audit log: 30 total, 27 sukses, 3 gagal)
    A->>PG: COMMIT
    A-->>FE: { importedCount: 27, issueIds: [...] }
    FE-->>M: Toast "27 tiket berhasil diimpor" + refresh Issues list
```

**Prinsip penting:** file Excel **hanya diunggah ke server saat preview**, tidak pernah tersimpan persisten — endpoint commit menerima **data terstruktur** hasil preview (JSON), bukan file mentah lagi. Ini menghindari kebutuhan infrastruktur staging/temporary storage sama sekali, konsisten dengan filosofi Lean.

---

## 11. Keamanan & Privasi

| Aspek | Implementasi |
|---|---|
| Autentikasi | Better Auth — session cookie (httpOnly) untuk `apps/web`; **Bearer token** (via Bearer plugin) untuk Desktop Client, disimpan di OS keychain (§4.2, §6) |
| CORS | Backend allow-list origin `apps/web` **dan** origin Tauri (`tauri://localhost`, berbeda per-OS) — tanpa ini, request Desktop Client ditolak sebelum sampai guard |
| Akses data | Drizzle ORM — query ter-tipe, mengurangi risiko SQL injection |
| Otorisasi | `AdminGuard` (flag boolean) + `ProjectRoleGuard` (role per-proyek) — dua guard sederhana, bukan hierarki organisasi bertingkat |
| Enkripsi in-transit | HTTPS untuk REST, WSS untuk WebSocket |
| Enkripsi at-rest | Cloudflare R2 server-side encryption |
| Privasi input | Input hook hanya menghitung event, tidak menyimpan isi ketikan |
| Kontrol pekerja | Hapus blok waktu sendiri (self-service) |
| Kontrol Admin | Override blok waktu pekerja lain wajib alasan tertulis & memicu notifikasi — dibatasi ke Admin saja, bukan tiap Manager, agar mudah diaudit dengan sedikit titik kewenangan |
| Audit trail | Semua override & perubahan status tiket tercatat di `time_block_audit_logs` dengan pelaku & waktu |
| Retensi data | Screenshot dihapus otomatis setelah 12 bulan (§13) |
| Model instalasi | Single-tenant tanpa entitas organisasi — permukaan risiko lebih kecil dibanding model SaaS multi-tenant |
| Moderasi komunikasi | Issue Activity terbuka untuk semua anggota proyek (tanpa batasan role), namun Admin tetap dapat menghapus komentar siapapun untuk moderasi jika terjadi penyalahgunaan |
| Kredensial webhook eksternal | URL Discord Webhook diperlakukan sebagai kredensial sensitif — tidak pernah dikembalikan utuh ke frontend setelah tersimpan (FR-114), guard endpoint dibatasi Admin (app-level) / Manager-Admin (project-level) |
| Guard hapus vs edit tiket sengaja dibedakan | Edit (FR-026) melibatkan Assignee karena bersifat reversibel; Hapus (FR-026a) dibatasi ke pembuat/Manager/Admin karena bersifat destruktif — assignee yang bukan pembuat tidak boleh menghapus tiket yang bukan miliknya |
| Data komparatif antar-karyawan (Workload Overview, Live Status) | Dibatasi ketat: Manager hanya bisa lihat proyek yang dia kelola sendiri (bukan lintas semua proyek), Admin baru bisa lihat lintas proyek. Developer/QA/Reporter tidak punya akses ke kedua fitur ini sama sekali — mencegah kesalahpahaman "semua orang bisa lihat status semua orang" |
| Integritas audit trail status tiket | `issue_status_history` sengaja tidak memiliki endpoint PATCH/DELETE sama sekali (FR-029c) — berbeda dari `issue_comments` yang bisa diedit/dihapus penulis/Admin. Ini memastikan riwayat perubahan status tidak bisa dimanipulasi oleh siapapun, termasuk Admin |
| Push notification bersifat opt-in eksplisit | Tidak ada auto-prompt izin browser saat login (FR-107) — mencegah pola UX "spam permintaan izin" dan memastikan user sadar & menyetujui sebelum device-nya terdaftar untuk menerima push |
| Guard Collaborators sengaja asimetris (self-add bebas, tambah-orang-lain dibatasi) | Self-add murni opt-in personal (mirip "Watch" GitHub) sehingga tidak perlu guard edit; menambahkan **orang lain** tetap memerlukan otorisasi (Assignee/Manager/Admin) untuk mencegah sembarang anggota proyek "menyeret" orang lain ke tiket tanpa sepengetahuan mereka |
| Pengecualian guard Collaborators saat pembuatan tiket (FR-026f) | Saat `POST /projects/:id/issues`, siapapun pembuat tiket boleh menetapkan Collaborators awal tanpa guard Assignee/Manager/Admin — konsisten dengan pola FR-019 (tambah member saat membuat proyek baru): menetapkan kondisi awal sesuatu yang baru dibuat sendiri dianggap berbeda dari mengedit sesuatu yang sudah ada milik orang lain |
| Import Excel dibatasi Manager/Admin only, bukan anggota proyek manapun | Bulk operation berdampak besar (bisa insert ratusan tiket sekaligus) — berbeda dari create issue tunggal yang terbuka untuk semua anggota proyek (FR-020), sengaja lebih ketat |
| File Excel tidak pernah disimpan persisten di server | Baik saat preview maupun commit — menghindari kebutuhan infrastruktur staging/cleanup, dan mengurangi permukaan risiko kebocoran data dari file yang ter-upload |
| Proteksi data historis | Hard-delete proyek maupun user **selalu memerlukan konfirmasi eksplisit** (ketik ulang Kode Proyek untuk proyek; validasi 0 riwayat kerja untuk user) — mencegah kehilangan data payroll/laporan secara tidak sengaja. Default aksi "hapus" di UI adalah soft-delete/nonaktifkan, bukan hard-delete |

---

## 12. Strategi Pemrosesan & Sinkronisasi (Tanpa Redis/Queue)

*(Tidak berubah dari revisi MVP Lean sebelumnya — tetap relevan untuk versi internal ini.)*

| Kebutuhan | Pendekatan | Catatan Migrasi |
|---|---|---|
| Kompresi/thumbnail screenshot | Diproses langsung saat endpoint upload dipanggil (mis. `sharp`) | Pindahkan ke BullMQ + Redis jika latensi mulai terasa |
| Generate laporan PDF/CSV | Dieksekusi langsung di request `/reports/hours` | Pindahkan ke job async untuk skala besar |
| Retensi screenshot | Lihat §13 | — |
| Cache query yang sering diakses | Mengandalkan index PostgreSQL yang tepat | Redis cache bila terbukti jadi bottleneck |

---

## 13. Strategi Penyimpanan File & Retensi (Disederhanakan — 1 Mekanisme)

- Upload dari Desktop Client & Web langsung ke R2 via presigned URL (backend tidak jadi perantara file).
- Struktur object key: `project/{projectId}/screenshots/{timeBlockId}.webp` dan `project/{projectId}/documents/{documentId}/{fileName}` (tanpa prefix `org/{organizationId}/` karena tidak ada entitas organisasi).
- Format screenshot dikompresi WebP.

### 13.1 Retensi Screenshot (12 Bulan) — 1 Lapis Saja

Berbeda dari draft v1.1 yang memakai 2 lapis (R2 lifecycle rule + cron job), versi Lean Internal cukup **satu mekanisme**:

- **R2 Lifecycle Rule** (native, tanpa kode tambahan) — otomatis menghapus object di path `screenshots/` setelah `screenshot_retention_days` (default 365 hari).
- Referensi baris `screenshots` di database **tidak otomatis dibersihkan** oleh mekanisme ini — diterima sebagai trade-off MVP karena baris kosong/usang tidak signifikan membebani performa pada skala tim internal. Bisa dibersihkan manual sesekali, atau ditambah cron kecil (`retention-cleanup`, sudah disiapkan foldernya di §4) bila suatu saat dirasa perlu.

---

## 14. Skalabilitas & Performa

| Aspek | Pendekatan MVP | Jalur Upgrade Bila Diperlukan |
|---|---|---|
| `time_blocks`/`activity_logs` | PostgreSQL biasa + composite index | Migrasi ke TimescaleDB hypertable tanpa mengubah struktur kolom |
| Concurrency backend | Satu instance NestJS dalam satu container | Load balancer + multi-instance + Redis session/adapter |
| Laporan berat | Query langsung ke PostgreSQL | Read-replica PostgreSQL |
| Proses async | Sinkron/cron in-process (§12) | Redis + BullMQ |

---

## 15. Arsitektur Deployment

```mermaid
flowchart TB
    subgraph "Production (Docker)"
        BACKEND["Container: Backend (NestJS + Better Auth + Socket.io)"]
        WEBC["Container: Web (Next.js)"]
        PGPRIMARY[(PostgreSQL — 1 instance)]
    end
    R2["Cloudflare R2"]
    DESKTOP["Desktop Client (Tauri, terinstal di PC karyawan)"]

    WEBC --> BACKEND
    DESKTOP --> BACKEND
    BACKEND --> PGPRIMARY
    BACKEND -. presigned URL .-> R2
    DESKTOP -. direct upload .-> R2
```

### 15.1 Dev Environment (Docker Compose)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: trackflow
      POSTGRES_USER: trackflow
      POSTGRES_PASSWORD: trackflow
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  backend:
    build: ./apps/backend
    depends_on: [postgres]
    environment:
      DATABASE_URL: postgres://trackflow:trackflow@postgres:5432/trackflow
    ports: ["3000:3000"]

  web:
    build: ./apps/web
    depends_on: [backend]
    ports: ["3001:3000"]

volumes:
  pgdata:
```

### 15.2 Struktur Monorepo (Turborepo)

Tidak berubah dari revisi sebelumnya — `turbo.json` mengatur pipeline `build`/`dev`/`lint`/`db:migrate` lintas `apps/backend` dan `apps/web`, dengan `packages/shared-types` menjaga konsistensi tipe DTO.

### 15.3 CI/CD Build Desktop Client (3-Platform via GitHub Actions)

Berbeda dari backend/frontend web (deploy manual ke server saat ini), Desktop Client **dibangun sepenuhnya lewat CI** — bukan di-build lokal per platform di laptop developer. Keputusan ini diambil karena cross-compile Rust/Tauri dari satu mesin (mis. macOS Apple Silicon) ke Windows/Linux sangat menyulitkan dan rawan gagal; GitHub Actions menyediakan runner native per-OS (`macos-latest`, `windows-latest`, `ubuntu-22.04`) yang masing-masing adalah mesin sungguhan dengan toolchain aslinya.

```mermaid
flowchart TB
    TAG["git push tag v*"] --> GH["GitHub Actions Trigger"]
    GH --> M["Job: macos-latest"]
    GH --> W["Job: windows-latest"]
    GH --> L["Job: ubuntu-22.04"]

    M --> MB["Build universal binary\n(aarch64 + x86_64 via lipo)"]
    MB --> MS["Code sign + Notarize\n(Apple Developer ID)"]
    W --> WB["Build native x86_64"]
    WB --> WS["Code sign (Authenticode)\n— opsional bila sertifikat tersedia"]
    L --> LB["Build native x86_64\n(.deb + .AppImage)"]

    MS --> DRAFT["GitHub Release (draft)"]
    WS --> DRAFT
    LB --> DRAFT
    DRAFT -->|"tinjau manual\n(smoke test per-OS)"| PUB["Publish Release"]
    PUB --> UPDATER["Auto-updater manifest\n(latest.json)"]
```

**Keputusan desain kunci:**

| Keputusan | Detail |
|---|---|
| **Build 100% via CI, bukan build lokal per platform** | Developer (Anda) hanya perlu bekerja dari satu mesin (macOS Apple Silicon); push tag Git memicu build native paralel di 3 runner OS berbeda sekaligus |
| **macOS: Universal Binary, bukan 2 file terpisah** | `--target universal-apple-darwin` menggabungkan `aarch64-apple-darwin` (Apple Silicon) + `x86_64-apple-darwin` (Intel) jadi **satu** `.app` via `lipo` — karyawan Intel maupun Apple Silicon install file yang sama, tidak perlu dipilihkan manual |
| **Windows & Linux: build native, bukan cross-compile** | Masing-masing dikompilasi di runner OS aslinya (`windows-latest`, `ubuntu-22.04`), menghasilkan `.msi`/`.exe` (NSIS) untuk Windows dan `.deb` + `.AppImage` untuk Linux |
| **Code signing terintegrasi di pipeline yang sama** | Sertifikat macOS (Developer ID + notarization) dan Windows (Authenticode) diambil dari GitHub Secrets, diproses otomatis oleh `tauri-apps/tauri-action`. Untuk distribusi internal, signing bersifat **opsional** (bisa dilewati bila sertifikat belum tersedia), dengan trade-off peringatan Gatekeeper/SmartScreen saat instalasi pertama |
| **Release dibuat sebagai `draft`, bukan langsung publish** | `releaseDraft: true` — artifact ter-upload ke GitHub Release tapi **belum terlihat publik / belum memicu auto-updater** sampai seseorang meninjau dan klik "Publish" manual. Ini gerbang review terakhir sebelum rilis sampai ke seluruh karyawan — konsisten dengan prinsip "build sukses ≠ teruji" (§14, kriteria selesai Slice 23) |
| **Testing tetap butuh device fisik minimal 1x per rilis per OS** | CI menjamin *build berhasil*, bukan *aplikasi berjalan mulus* di OS tersebut (mis. permission dialog macOS Intel, versi WebView2 lama di Windows kantor tertentu, dependency `libwebkit2gtk` di distro Linux tertentu) — smoke test manual tetap wajib sebelum publish, idealnya oleh 1 orang per platform sebelum rollout ke seluruh tim |

**Dua skema signing yang berjalan independen, jangan tertukar:**
- **Code signing OS** (Apple Developer ID / Windows Authenticode) — memverifikasi ke OS bahwa installer berasal dari sumber tepercaya, mencegah peringatan Gatekeeper/SmartScreen.
- **Update signing Tauri** (`TAURI_SIGNING_PRIVATE_KEY`, dari `tauri signer generate` — Slice 24) — skema tanda tangan internal Tauri sendiri untuk memverifikasi keaslian file update sebelum auto-updater menginstalnya. **Tetap wajib** ada terlepas dari apakah code signing OS dipakai atau tidak.

---

## 16. Batasan Teknis & Risiko

| Risiko | Mitigasi |
|---|---|
| Volume screenshot besar → biaya storage | Kompresi WebP + R2 lifecycle rule 12 bulan (§13.1) |
| Beban tulis tinggi ke PostgreSQL tanpa queue | Batching insert per blok 10 menit; pantau metrik koneksi DB sebagai sinyal upgrade ke Redis/BullMQ |
| Satu container backend = *single point of failure* | Diterima sebagai trade-off MVP; mitigasi: health check + auto-restart, backup PostgreSQL terjadwal |
| Referensi `screenshots` di DB tidak otomatis terhapus setelah file di-purge R2 | Diterima untuk skala internal; dapat ditambah cron pembersih ringan nanti bila diperlukan |
| Admin (flag `isAdmin` pada tabel `user`) berpotensi jadi *single point of failure* administratif | Disarankan minimal 2 user dengan `isAdmin=true` sejak awal |
| Kolom kepegawaian (`employeeId`, `department`, dsb.) diisi tidak konsisten oleh HR/Admin | Validasi ringan di form (mis. format employeeId), namun tidak wajib diisi semua — hanya `username` yang wajib & unik |
| Kesalahan pengisian field Issue Template (selain Environment) tidak divalidasi wajib | Diterima sebagai trade-off kecepatan; Manager dapat mengubah field mana saja jadi wajib via pengaturan template kapan saja |
| `key` proyek harus unik secara global (termasuk lintas sub-proyek) — makin banyak proyek, makin mudah terjadi konflik kode singkat | Validasi uniqueness real-time saat pengisian form (cek via API saat blur), sarankan konvensi penamaan internal (mis. selalu awali sub-proyek dengan kode induk + suffix) |
| Description issue kini teks bebas — konsistensi laporan bug (semua field terisi) bergantung sepenuhnya pada kedisiplinan penulis, bukan validasi sistem | Diterima sebagai trade-off kesederhanaan; dapat dipantau manual oleh Manager/QA, atau ditambah linter/reminder ringan di masa depan jika kualitas laporan menurun |
| Discard di Floating Widget tidak tercatat di audit log (karena data memang tidak pernah sampai ke server) — Admin tidak bisa melihat riwayat berapa kali/kapan seorang pekerja men-discard screenshot | Diterima sebagai trade-off kesederhanaan sesuai keputusan desain (§6); jika suatu saat dibutuhkan visibilitas ini, opsi lanjutan: kirim event count-only (tanpa gambar) ke server saat discard, tanpa menyimpan screenshot itu sendiri |
| Proyek yang diarsipkan menumpuk seiring waktu tanpa pernah dibersihkan (soft-delete tidak pernah otomatis jadi hard-delete) | Diterima sebagai trade-off keamanan data — pertumbuhan tabel `projects`/`issues` dari proyek terarsip relatif kecil dibanding `time_blocks`/`screenshots`; hard-delete manual tetap tersedia untuk Admin bila memang perlu membersihkan proyek uji coba |
| Parsing `@username` pada komentar bisa gagal cocok kalau username mengandung karakter di luar `\w` (mis. titik, strip) | Batasi format `username` saat registrasi/edit profil ke alfanumerik + underscore saja (dicek di validasi form), konsisten dengan pola regex mention |
| Lampiran komentar tanpa batas ukuran bisa membengkakkan storage R2 tanpa terkontrol | Terapkan soft-limit yang sama seperti lampiran issue/dokumen (mis. maks. 50MB/file), divalidasi di frontend sebelum upload |
| Tanpa validasi `mimeType`, lampiran komentar berpotensi disalahgunakan untuk unggah file executable/berbahaya | Terapkan mitigasi yang sama seperti lampiran Issue/Dokumen — antivirus scan opsional di sisi R2/backend jika kebutuhan keamanan meningkat; untuk MVP internal, diterima sebagai trade-off karena hanya anggota proyek terautentikasi yang bisa upload |
| URL Discord Webhook bocor (mis. ter-commit ke git, ter-log tanpa sengaja) memungkinkan pihak luar mengirim pesan ke channel tersebut | Jangan pernah log `webhook_url` mentah di server log; response API tidak pernah mengembalikannya utuh (FR-114); revoke & buat webhook baru di Discord jika dicurigai bocor |
| Discord API down/rate-limited saat volume pembuatan proyek/tiket tinggi | Diterima sebagai fire-and-forget (§10.16) — kegagalan tidak memengaruhi fungsi inti TrackFlow; tidak ada retry queue di MVP ini (bisa ditambah BullMQ nanti jika keandalan notifikasi jadi kebutuhan kritis) |
| `/issues/mine?view=kanban` berpotensi N+1 query kalau user tergabung di banyak proyek (query `issue_statuses` per proyek dalam loop) | Diterima untuk skala tim internal (jumlah proyek per user biasanya kecil); optimasi ke satu query `WHERE project_id IN (...)` bisa dilakukan belakangan kalau jumlah proyek per user bertambah signifikan |
| Menghapus tiket melepas ikatan `time_blocks.issue_id` ke `NULL` — riwayat waktu kerja jadi "Activity" tanpa konteks tiket aslinya | Diterima sebagai trade-off yang disengaja (lebih baik dari kehilangan data payroll sepenuhnya); pertimbangkan menyimpan judul tiket asli sebagai teks di `time_blocks.note` sebelum penghapusan jika jejak konteks dirasa penting nanti |
| Live Status berpotensi terasa seperti pengawasan berlebihan ("dipantau real-time terus-menerus") kalau tidak dikomunikasikan dengan baik ke tim | Ini murni saran penggunaan (bukan pembatasan teknis) — dokumentasikan ke Manager bahwa fitur ini untuk koordinasi kerja (mis. tahu siapa yang sedang available), bukan alat pengawasan mikro; status Idle bukan berarti pelanggaran, bisa jadi sedang meeting/telepon di luar aplikasi |
| Heartbeat tiap 60 detik dari seluruh desktop client menambah beban koneksi Socket.io persisten | Untuk skala tim internal, dampaknya minor (payload sangat kecil); kalau jumlah user membesar signifikan, pertimbangkan interval lebih jarang (mis. 90-120 detik) sebelum menambah infrastruktur |
| Status bisa "tersangkut" Aktif/Idle kalau baik graceful disconnect maupun cron fallback sama-sama gagal (skenario langka) | Cron job §10.18a berjalan tiap 2 menit sebagai jaring pengaman kedua — risiko status basi maksimal terbatas pada jendela waktu tersebut |
| User berpotensi bingung kenapa tiket yang dia jadi Collaborator tidak muncul di Tugas Saya/Workload Overview | Beri label/tooltip yang jelas di UI (mis. "Collaborator — bukan penanggung jawab utama") saat menampilkan daftar Collaborators, supaya perbedaan dengan Assignee tidak ambigu bagi pengguna |
| Commit import 500 baris sekaligus (insert loop per-baris dalam 1 transaksi) berpotensi lambat/timeout pada volume maksimal | Diterima untuk skala tim internal — 500 baris adalah batas atas yang jarang tercapai; kalau jadi masalah nyata, pertimbangkan batch insert (`INSERT ... VALUES (...), (...)`) alih-alih loop sekuensial, dengan tetap mempertahankan penomoran atomik per baris |
| Kolom "Assign To" diterima di file tapi diam-diam tidak diproses (FR-165) — berpotensi bikin user mengira assignee sudah terisi otomatis | Tampilkan catatan eksplisit di UI modal import ("Assignee akan ditugaskan manual setelah import") supaya tidak jadi asumsi keliru; pratinjau juga tidak menampilkan kolom Assignee terisi apapun |
| Validasi Tipe yang ketat tanpa sinonim (FR-163) berarti file dengan banyak baris "Enhancement" (pola umum di notulen tim) akan menghasilkan banyak error sekaligus | Diterima sebagai keputusan sengaja — mencegah pemetaan otomatis yang bisa salah kategori data secara diam-diam; user diarahkan menyeragamkan istilah di sumber data sebelum import |
| Progress bar proyek (`GET /projects`) menambah beban query JOIN+GROUP BY di endpoint yang sering diakses (project switcher) | Untuk skala tim internal, dampaknya minor; kalau jumlah proyek/tiket membesar signifikan, pertimbangkan cache hasil agregasi dengan TTL pendek (mis. 60 detik) alih-alih hitung ulang tiap request |
| Push notification tidak berfungsi di Safari iOS kecuali app di-"Add to Home Screen" (FR-106d) | Diterima sebagai keterbatasan platform (bukan bug); ditampilkan sebagai catatan informatif di halaman Profil supaya user paham, bukan mengira fitur rusak |
| `push_subscriptions` bisa menumpuk baris basi kalau device di-uninstall/browser di-reset tanpa sempat unsubscribe | Dibersihkan otomatis saat pengiriman gagal dengan status 410/404 (§10.20) — tidak perlu job pembersihan terjadwal terpisah untuk MVP |
| Validasi "reply dibatasi 1 tingkat" hanya berarti kalau ditegakkan di backend, bukan cuma disembunyikan di UI | Endpoint POST comments **wajib** cek `parent_comment_id` milik parent yang direferensikan — tolak (400) kalau parent tersebut sendiri sudah punya parent (lihat §10.7) |
| Permission OS untuk Tray Icon & Floating Widget (mis. window always-on-top, skip taskbar) berbeda perilaku antar OS | Uji eksplisit di minimal 2 OS (sudah jadi bagian kriteria selesai Slice 23); siapkan fallback UI sederhana jika API tray tidak tersedia di suatu platform |
| Tanpa code signing (belum ada sertifikat berbayar), karyawan mendapat peringatan Gatekeeper (macOS)/SmartScreen (Windows) saat instalasi pertama | Diterima sebagai trade-off distribusi internal; instruksikan "klik kanan → Buka" (macOS) atau "More info → Run anyway" (Windows) — revisit beli sertifikat kalau tim membesar atau keluhan meningkat |
| Release dibuat sebagai draft (§15.3) berpotensi lupa di-publish, karyawan tidak menerima update yang sudah dites | Jadikan bagian dari checklist rilis manual: build via CI → smoke test → publish — jangan anggap selesai hanya karena CI hijau |

---

## 17. Lampiran: Perbandingan Model Data v1.1 (Full) vs v2.0 (Lean Internal)

| Aspek | v1.1 (Full / siap SaaS) | v2.0 (Lean Internal — dokumen ini) |
|---|---|---|
| Tenant | Tabel `organizations` (entitas) | `app_settings` (singleton, tanpa entitas) |
| Otorisasi administratif | `organization_memberships` (owner/admin/member + granted_by/granted_at) | `user.isAdmin` (1 boolean, via `additionalFields` Better Auth — bukan tabel terpisah) |
| Data profil & kepegawaian | Tidak dirancang eksplisit di v1.1 | Diperluas langsung di tabel `user` (username, foto, jabatan, departemen, employeeId, joinDate, employmentStatus) via `additionalFields` |
| Override blok waktu | `project_memberships.can_override_timeblocks` (opt-in per-Manager) + endpoint audit lintas-proyek khusus | `user.isAdmin` saja, audit log sederhana |
| Workflow tiket | `issue_statuses.allowed_roles` (jsonb, banyak role per status) | `issue_statuses.restricted_to_role` (1 role opsional per status) |
| Issue Template | `default_fields` generik tanpa contoh konkret | `fields` jsonb terisi preset Bug konkret (title pattern + 7 field, 1 wajib) |
| Retensi screenshot | R2 lifecycle rule + cron job (2 lapis) | R2 lifecycle rule saja (1 lapis) |
| Prefix object key R2 | `org/{organizationId}/project/{projectId}/...` | `project/{projectId}/...` |

**Kapan perlu "naik kelas" kembali ke model v1.1?**
- Jika TrackFlow akan dipakai lebih dari satu perusahaan/klien dalam satu instalasi.
- Jika suatu saat butuh mendelegasikan hak override ke beberapa Manager tertentu (bukan hanya Admin), bukan sekadar all-or-nothing.
- Jika satu status tiket perlu diizinkan untuk **lebih dari satu** role sekaligus (model `restricted_to_role` tunggal tidak lagi cukup).

Karena struktur data tetap dirancang mirip (nama tabel, relasi inti), migrasi ke v1.1 nantinya bersifat penambahan kolom/tabel, bukan perombakan total.
