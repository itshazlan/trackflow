# Software Design Document (SDD) — Versi Lean Internal
## TrackFlow — Web Project Management & Desktop Time Tracker

| | |
|---|---|
| **Versi Dokumen** | 2.3 (Lean Internal) |
| **Status** | Draft |
| **Tanggal** | 14 Juli 2026 (revisi: Tray Icon/menu bar, Floating Widget preview/submit/discard, kolom `time_blocks.note` untuk default task Activity) |
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

- **Routing:** App Router Next.js (`/projects/:projectId/issues`, tanpa prefix `/org/:orgId` karena tidak ada konsep multi-organisasi).
- **Data table tiket:** TanStack Table + Shadcn UI.
- **State realtime:** koneksi Socket.io di root layout, invalidate cache TanStack Query saat menerima event (`issue.updated`, `timeblock.synced`, `user.status_changed`).
- **Mode tampilan tiket:** List, Kanban, Calendar — dari endpoint issues yang sama.
- **Pengaturan Workflow:** halaman admin/manager proyek untuk CRUD status tiket (drag-drop reorder, toggle "restricted to role").
- **Pengaturan Template:** halaman untuk mengelola Issue Template per proyek/global (form builder sederhana: daftar field + toggle wajib/opsional).

---

## 6. Arsitektur Desktop Client (Tauri)

```mermaid
flowchart LR
    UI["Tauri WebView UI (Login, Start/Stop, pemilihan task)"]
    TRAY["Tray Icon Manager (menu bar)"]
    WIDGET["Floating Widget (Preview/Submit/Discard)"]
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
    WIDGET -- Submit/Discard/timeout --> CORE
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
| **Floating Widget** | Window kedua (multi-window Tauri), always-on-top, tanpa border, pojok kanan bawah layar. Muncul setiap kali screenshot diambil: preview thumbnail + timer + tombol Preview/Submit/Discard. Auto-Submit jika tidak ada aksi ~90 detik (FR-090) — lihat §10.9 |
| **Auth/Token Manager** | Login via `/api/auth/sign-in/email` (Bearer plugin), simpan token di OS keychain (bukan file plaintext), sediakan token ke Sync Service tiap request, tangani refresh & logout (hapus dari keychain + panggil sign-out) — lihat §4.2 |
| **OS-level Input Hook** | Hitung klik/ketukan tanpa merekam konten (privasi) |
| **Screenshot Capture Module** | Screenshot pada detik acak + notifikasi shutter, hasil ditahan dulu menunggu keputusan di Floating Widget (bukan langsung lanjut ke buffer) |
| **Local SQLite Buffer** | Buffer offline sebelum berhasil diunggah. **Hanya diisi kalau widget di-Submit/timeout** — kalau di-Discard, data blok tersebut tidak pernah masuk ke buffer ini sama sekali (§10.9) |
| **Sync Service** | Ambil token dari Auth/Token Manager, sertakan sebagai header `Authorization: Bearer <token>` di tiap request, upload per blok selesai, retry dengan backoff. Jika server balas `401 Unauthorized` (token expired), pause sync → picu refresh via Auth/Token Manager → resume; jika refresh gagal, tampilkan prompt re-login di WebView UI |

**Prinsip privasi tidak berubah:** idle detection, tidak ada keylogging konten, randomisasi jadwal screenshot lokal.

**Prinsip keamanan token (baru):** token tidak pernah disimpan sebagai file teks biasa di disk maupun di `localStorage`-equivalent WebView — wajib lewat mekanisme keychain native OS (Keychain di macOS, Credential Manager di Windows, Secret Service di Linux), diakses lewat plugin Tauri resmi.

**Keputusan desain — konsekuensi Discard (default direkomendasikan & disetujui):** Discard pada Floating Widget membuat blok waktu **tidak pernah dikirim ke server sama sekali** — bukan dikirim lalu dihapus. Konsekuensi ke pekerja setara dengan hapus blok waktu self-service (FR-060/061, unpaid otomatis), namun **tanpa audit log** di `time_block_audit_logs`, karena secara teknis data tersebut memang tidak pernah eksis di sisi server (berbeda dari self-delete di Time Book yang menghapus data yang *sudah* tersimpan di database).

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
    ISSUE_STATUSES ||--o{ ISSUES : "current status"
    USERS ||--o{ ISSUES : "assigned to"
    ISSUES ||--o{ ISSUE_ATTACHMENTS : has
    ISSUES ||--o{ ISSUE_COMMENTS : has
    USERS ||--o{ ISSUE_COMMENTS : authors
    USERS ||--o{ TIME_BLOCKS : logs
    ISSUES ||--o{ TIME_BLOCKS : "tracked against"
    TIME_BLOCKS ||--o| SCREENSHOTS : has
    TIME_BLOCKS ||--o| ACTIVITY_LOGS : has
    TIME_BLOCKS ||--o{ TIME_BLOCK_AUDIT_LOGS : "logged in"
    USERS ||--o{ MANUAL_TIME_ENTRIES : submits
    USERS ||--o{ TIMESHEETS : has
    TIMESHEETS ||--o{ TIMESHEET_APPROVALS : "reviewed via"
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
| name | varchar | |
| description | text | |
| created_by | uuid (FK → users) | |
| created_at | timestamptz | |

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

#### `documents`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK) | |
| file_name | varchar | |
| r2_object_key | varchar | |
| uploaded_by | uuid (FK) | |
| uploaded_at | timestamptz | |

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
| body | text | |
| created_at | timestamptz | |
| updated_at | timestamptz nullable | Diisi saat komentar diedit — dipakai untuk menampilkan penanda "(diedit)" di UI |

> Guard: **siapapun member proyek** (peran manapun) atau Admin boleh baca & tulis komentar — sengaja tidak dibatasi role tertentu, berbeda dari transisi status tiket (FR-028). Edit hanya oleh penulis; hapus oleh penulis atau Admin (moderasi, FR-029).

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
| Projects | `/projects` | GET/POST | List & buat proyek — body POST wajib sertakan `key` (Kode Proyek unik, immutable) |
| Projects | `/projects/:id/sub-projects` | GET/POST | Kelola sub-proyek — sub-proyek juga wajib punya `key` sendiri, independen dari induk |
| Memberships | `/projects/:id/members` | GET/POST/PATCH | Undang & atur role anggota proyek — **Admin dapat mengakses meski belum jadi member proyek ini** (§4.1) |
| Issue Statuses | `/projects/:id/issue-statuses` | GET/POST/PATCH/DELETE | CRUD status workflow (termasuk reorder & set `restricted_to_role`) — **Manager/Admin** |
| Issues | `/projects/:id/issues` | GET/POST | List (view=list\|kanban\|calendar) & buat tiket — nomor issue (`number`) di-generate otomatis, atomik per proyek |
| Issues | `/issues/:id` | GET/PATCH/DELETE | Detail & update tiket (edit oleh Assignee/Manager/Admin) |
| Issues | `/issues/:id/status` | PATCH | Ubah status (dicek terhadap `restricted_to_role`) |
| Issue Attachments | `/issues/:id/attachments` | GET/POST | List & upload lampiran (presigned URL R2) |
| Issue Attachments | `/issues/:id/attachments/:attachmentId` | DELETE | Hapus lampiran (uploader atau Admin) |
| Issue Comments | `/issues/:id/comments` | GET/POST | List & tambah komentar — **anggota proyek peran manapun** boleh akses |
| Issue Comments | `/issues/:id/comments/:commentId` | PATCH/DELETE | Edit (penulis saja) / Hapus (penulis atau Admin untuk moderasi) |
| Templates | `/projects/:id/issue-templates` | GET/POST/PATCH | Kelola template (termasuk edit array `fields`) — **Manager/Admin** |
| Documents | `/projects/:id/documents` | GET/POST | Upload/list dokumen (presigned URL R2) |
| Time Tracking | `/time-blocks/sync` | POST | Endpoint utama sinkronisasi dari Desktop Client tiap 10 menit |
| Time Tracking | `/time-blocks/:id/screenshot` | POST | Upload screenshot (presigned URL) |
| Time Tracking | `/time-blocks/:id` | DELETE | Pekerja hapus blok waktu miliknya sendiri |
| Time Tracking | `/time-blocks/:id/override` | POST | **Admin only.** Body: `{ action: "delete"\|"mark_unpaid", reason: string }` |
| Manual Time | `/manual-time-entries` | GET/POST | Input & lihat waktu manual |
| Timesheets | `/timesheets` | GET | List timesheet per periode |
| Timesheets | `/timesheets/:id/approve` | POST | Approve/reject oleh Manager |
| Reports | `/reports/hours?format=pdf\|csv` | GET | Generate & unduh laporan |

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
  "priority": "high"
}
```
Backend **tidak lagi memvalidasi** kelengkapan field di dalam `description` (lihat §16 untuk trade-off). Backend hanya bertanggung jawab men-generate `number` secara atomik dan menyusun Issue ID tampilan `{projects.key}-{number}` (mis. `TRACK-142`) — lihat §10.6.

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
| `user.status_changed` | Server → Web | `{userId, status}` | Status kerja tim real-time |
| `issue.updated` | Server → Web | `{issueId, changes}` | Update Kanban/List tanpa refresh |
| `timeblock.synced` | Server → Web | `{userId, projectId, blockStart}` | Indikator "aktif bekerja" |
| `timesheet.approved` | Server → Web | `{timesheetId, status}` | Notifikasi ke Developer |
| `timeblock.overridden` | Server → Web | `{timeBlockId, actorId, targetUserId, action, reason}` | Notifikasi ke pekerja terdampak saat Admin override |
| `issue.comment_created` | Server → Web | `{issueId, commentId, authorId, bodyPreview}` | Update panel Aktivitas/Komentar secara realtime tanpa refresh |

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

### 10.7 Alur Komentar Issue Activity (Realtime)

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant A as Backend API
    participant PG as PostgreSQL
    participant QA as QA (via WS)

    Dev->>A: POST /issues/:id/comments {body}
    A->>A: Cek: pengirim member proyek manapun (role apapun) atau Admin?
    A->>PG: Insert issue_comments (author_id, body)
    A-->>Dev: 201 Created
    A->>QA: emit issue.comment_created {issueId, commentId, authorId, bodyPreview}
    Note over QA: Panel Aktivitas QA ter-update tanpa refresh jika issue yang sama sedang terbuka
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

### 10.9 Alur Floating Widget — Preview/Submit/Discard

```mermaid
sequenceDiagram
    participant CAP as Screenshot Capture Module
    participant W as Floating Widget
    participant CORE as Rust Core Process
    participant DB as Local SQLite Buffer
    participant SYNC as Sync Service

    CAP->>W: Screenshot diambil → tampilkan widget (thumbnail + timer + tombol)
    alt Pengguna klik "Preview"
        W->>W: Buka window preview ukuran penuh
        Note over W: Widget tetap terbuka menunggu keputusan Submit/Discard
    else Pengguna klik "Submit" ATAU timeout ~90 detik
        W->>CORE: Konfirmasi Submit
        CORE->>DB: Simpan blok waktu + screenshot ke buffer lokal
        DB->>SYNC: Lanjut alur sync normal (§10.1)
        W->>W: Widget hilang
    else Pengguna klik "Discard"
        W->>CORE: Konfirmasi Discard
        CORE->>CORE: Buang data blok waktu & file screenshot lokal
        Note over DB: TIDAK ADA baris yang masuk ke Local SQLite Buffer — blok ini tidak pernah ada di server
        W->>W: Widget hilang
    end
```

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
| Permission OS untuk Tray Icon & Floating Widget (mis. window always-on-top, skip taskbar) berbeda perilaku antar OS | Uji eksplisit di minimal 2 OS (sudah jadi bagian kriteria selesai Slice 23); siapkan fallback UI sederhana jika API tray tidak tersedia di suatu platform |

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
