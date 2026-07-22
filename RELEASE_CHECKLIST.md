# Release Checklist — TrackFlow Desktop

Panduan langkah-demi-langkah untuk merilis versi baru Desktop Client. Ikuti urutan ini setiap kali — jangan lompat langkah smoke test walau CI sudah hijau semua (build sukses ≠ teruji).

---

## 0. Sebelum Mulai (Sekali Saja per Mesin/Repo)

Cek ini hanya perlu diverifikasi ulang kalau ada perubahan tim/akun, bukan tiap rilis:

- [ ] Secret GitHub masih valid: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
- [ ] Sertifikat Apple belum mendekati expired (cek `Expiration Date` di [developer.apple.com/account/resources/certificates/list](https://developer.apple.com/account/resources/certificates/list))
- [ ] `APPLE_PASSWORD` masih app-specific password yang valid (app-specific password bisa di-revoke sewaktu-waktu dari appleid.apple.com)

> ⚠️ **Gotcha yang pernah terjadi:** sertifikat Apple **wajib bertipe "Developer ID Application"**, bukan "Development" atau "Distribution". Kalau di kolom "Certificate Type" tertulis selain itu, notarization akan gagal dengan pesan `"The binary is not signed with a valid Developer ID certificate"`. Tipe ini hanya bisa dibuat oleh akun dengan role **Account Holder/Admin** — akun role Member biasanya tidak diberi opsi ini sama sekali di portal.

---

## 1. Update Versi & Changelog

- [ ] Update versi di `apps/desktop/src-tauri/tauri.conf.json` (`"version": "0.x.x"`)
- [ ] Update versi di `apps/desktop/src-tauri/Cargo.toml` (harus sama persis)
- [ ] Pindahkan isi `## [Unreleased]` di `CHANGELOG.md` menjadi entri versi baru dengan tanggal hari ini, kosongkan lagi bagian Unreleased
- [ ] Commit perubahan ini:
  ```bash
  git add apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml CHANGELOG.md
  git commit -m "chore: bump version to v0.x.x"
  git push origin main
  ```

---

## 2. (Opsional) Uji Coba Workflow Dulu via `workflow_dispatch`

Kalau ada perubahan pada `release.yml` sendiri, atau ini rilis pertama setelah lama tidak build — uji dulu tanpa buat tag:

- [ ] Tab **Actions** → workflow "Release Desktop" → **Run workflow** → pilih branch `main`
- [ ] Tunggu ketiga job selesai, cek satu-satu tidak ada yang merah

Kalau sudah terbiasa dan tidak ada perubahan workflow, langkah ini boleh dilewati — langsung ke tag.

---

## 3. Push Tag untuk Trigger Build Sungguhan

- [ ] Tag harus **persis sama** dengan versi di `tauri.conf.json`/`Cargo.toml` (prefix `v`):
  ```bash
  git tag v0.x.x
  git push origin v0.x.x
  ```
- [ ] Buka tab **Actions**, pastikan job `macos-latest`, `windows-latest`, `ubuntu-22.04` semuanya jalan
- [ ] Tunggu semua selesai (macOS paling lama karena ada notarization — bisa 3-10 menit tambahan menunggu Apple)

---

## 4. Cek Draft Release di GitHub

- [ ] Tab **Releases** → cari draft `v0.x.x` (belum publik, sesuai desain `releaseDraft: true`)
- [ ] Pastikan **3 artifact** ada: `.dmg`/`.app.tar.gz` (macOS universal), `.msi`/`.exe` (Windows), `.deb` + `.AppImage` (Linux)
- [ ] Pastikan `latest.json` (manifest updater) juga ter-generate

---

## 5. Smoke Test Manual — WAJIB, Jangan Skip

Download & install artifact di device fisik (atau minta bantuan rekan untuk OS yang tidak Anda punya).

### macOS
- [ ] Install → buka **tanpa** klik-kanan "Buka" (kalau masih muncul warning Gatekeeper, ada yang salah di signing/notarization)
- [ ] Login → tutup app dengan **Cmd+Q** → app hilang dari Dock **tapi tray icon tetap ada** dan timer tetap jalan (bukan quit total)
- [ ] Klik tray icon → menu muncul dengan status task + durasi berjalan
- [ ] Klik "Keluar" dari menu tray → app benar-benar berhenti total

### Windows
- [ ] Install → **wajib** muncul peringatan SmartScreen (diharapkan, karena signing di-skip) → cek "More info → Run anyway" berfungsi
- [ ] Ulangi cek dasar: login, tray icon, start/stop timer

### Linux
- [ ] `.AppImage`: `chmod +x` lalu jalankan langsung
- [ ] `.deb`: install via `dpkg -i` atau package manager, cek dependency ter-resolve otomatis
- [ ] Ulangi cek dasar: login, tray icon, start/stop timer

### Semua Platform (Fungsional Inti)
- [ ] Login → sesi tetap tersimpan setelah restart app (token keychain berfungsi)
- [ ] Pilih proyek & tiket → Start tracking → tray icon berubah state idle → active
- [ ] Tunggu siklus 10 menit (atau percepat interval khusus untuk testing) → screenshot diambil, **Floating Widget** muncul di pojok kanan bawah
- [ ] Widget: countdown 15 detik berjalan mundur dengan benar
- [ ] Klik **Preview** → window gambar penuh terbuka, countdown pause
- [ ] Tutup window Preview (coba tombol X, lalu ulangi test dengan Cmd+W/Esc) → **widget tetap ada**, countdown resume dari sisa detik
- [ ] Klik **Submit** → data muncul benar di Time Book web (screenshot, aktivitas, log aplikasi)
- [ ] Ambil screenshot baru → klik **Discard** → pastikan blok waktu ini **tidak muncul** di Time Book web (bukan muncul lalu hilang)
- [ ] Pilih task **"Activity (Tanpa Tiket)"** → isi deskripsi opsional → data tersinkron dengan label "Activity" di Time Book
- [ ] Matikan koneksi internet di tengah tracking → nyalakan lagi → data tetap ter-upload (tidak hilang)
- [ ] **(macOS, regresi)** Biarkan app jalan 1-2 jam sambil dipakai normal (boleh sambil app berat lain terbuka) → scroll/kursor **di seluruh sistem, bukan cuma di Trackflow**, tetap mulus tanpa delay yang makin terasa seiring waktu

---

## 6. Uji Auto-Updater (Detail — Wajib Sekali di Awal, Berkala Setelahnya)

Lakukan prosedur detail ini terutama kalau: rilis pertama kali menguji updater, atau ada perubahan pada konfigurasi `TAURI_SIGNING_PRIVATE_KEY`/endpoint updater.

### Persiapan
- [ ] Pastikan versi **"lama"** (baseline) sudah **di-publish** (bukan draft) dan **terinstall manual** di 1 device test
- [ ] Catat versi baseline ini (mis. `v0.2.0`)

### Buat Versi Target
- [ ] Buat perubahan kecil apa saja di kode (cukup untuk membedakan versi secara visual, mis. ubah 1 teks di UI)
- [ ] Bump versi jadi versi berikutnya (mis. `v0.2.1`) — ikuti Langkah 1-5 checklist ini seperti biasa
- [ ] **Pastikan `TAURI_SIGNING_PRIVATE_KEY` yang dipakai sama persis** dengan yang dipakai membangun versi baseline — kalau key ini pernah di-regenerate di antara kedua build, versi baseline **tidak akan pernah bisa** memverifikasi update dari versi target (gagal dengan galat signature invalid, bukan soal jaringan)
- [ ] Publish versi target ini (bukan draft)

### Verifikasi Update Berjalan
- [ ] Buka aplikasi versi **baseline** yang sudah terinstall (jangan install versi target secara manual)
- [ ] Trigger cek update (otomatis saat start, atau lewat menu kalau ada tombol manual "Check for Updates")
- [ ] Pastikan muncul notifikasi update tersedia, proses download & install berjalan
- [ ] Buka ulang aplikasi → pastikan versi sudah berubah ke versi target, **tanpa** reinstall manual sama sekali
- [ ] Cek data lokal (sesi login, dsb) tetap utuh setelah update — tidak ter-reset

---

## 7. Publish Release

- [ ] Setelah semua smoke test di atas lolos → tab **Releases** → buka draft `v0.x.x` → **Edit** → **Publish release**
- [ ] Auto-updater baru aktif mulai titik ini — bukan otomatis begitu CI selesai di langkah 3

---

## 8. Rollout Bertahap (Jangan Langsung ke Semua Orang)

- [ ] Broadcast dulu ke **2-3 orang** representasi tiap OS yang tersedia di tim
- [ ] Pantau minimal beberapa hari — cek keluhan terkait antivirus kantor, versi OS lama, permission macOS (Accessibility/Screen Recording) yang belum di-grant
- [ ] Kalau aman → broadcast ke seluruh kantor

---

## Referensi Cepat — Masalah yang Pernah Terjadi

| Gejala | Penyebab | Solusi |
|---|---|---|
| Notarization gagal: `"not signed with a valid Developer ID certificate"` | Sertifikat bertipe "Development"/"Distribution", bukan "Developer ID Application" | Cek tipe di portal Apple Developer; kalau opsi tidak tersedia untuk role Anda, minta Account Holder generate-kan atau naikkan role ke Admin |
| Notarization gagal: `"signature does not include a secure timestamp"` | Gejala sekunder dari masalah sertifikat di atas — bukan masalah terpisah | Sama seperti di atas |
| Job Windows/Linux gagal karena file `.pfx`/`.p12` tidak ditemukan | Secret signing belum diisi tapi step import belum dihapus dari `release.yml` | Isi secret, atau hapus step & env terkait platform tersebut |
| Sudut Floating Widget terlihat putih (bukan transparan) | `transparent`/`shadow` tidak di-set eksplisit di window builder (config statis tidak otomatis berlaku untuk window dinamis) | Set eksplisit di `WebviewWindowBuilder`; di macOS juga wajib aktifkan `tauri.macOSPrivateApi: true` di level `app`, bukan cuma level window |
| Timer/progress bar widget tidak bergerak | State di-hitung sendiri di frontend dengan stale closure, atau event `countdown-tick` tidak ter-emit berkala dari Rust core | Pastikan source of truth tunggal dari Rust core, gunakan functional update di React |
| Assets/build sudah ada untuk versi X, tapi `CHANGELOG.md` masih di versi lama | Langkah 1 (update changelog) terlewat sebelum tag di-push | Tambahkan entri retroaktif untuk versi X sebelum publish; jadikan kebiasaan: **selalu** commit changelog di commit yang sama dengan bump versi, sebelum `git tag` |
| Auto-updater gagal dengan galat terkait signature/verifikasi, padahal build sukses & artifact ada | `TAURI_SIGNING_PRIVATE_KEY` berbeda antara build versi lama (baseline) dan versi baru (target) — versi lama tidak punya public key yang cocok untuk verifikasi | Pastikan secret signing key **tidak pernah diganti** setelah rilis pertama; kalau terpaksa ganti, seluruh user harus reinstall manual sekali (update dari key lama ke key baru tidak bisa lewat auto-updater) |
| Dock icon macOS tidak muncul sama sekali walau window aktif | `activationPolicy: "accessory"` (atau `set_activation_policy` di Rust) membuat app jadi "menu bar only" secara permanen — bukan soal window aktif/tidak | Kalau memang mau Dock icon muncul saat window aktif (pola Slack/Discord), switch `ActivationPolicy::Regular`/`Accessory` secara dinamis mengikuti show/hide window, bukan di-set statis sekali di awal |
| Scroll/kursor **seluruh sistem** (bukan cuma di Trackflow) terasa stutter halus setelah app jalan lama (1 jam+), makin parah kalau sistem sedang berat, hilang instan begitu Trackflow di-quit | Global input hook `rdev` bikin live `CGEventTap` macOS — walau mode `ListenOnly`, OS tetap perlu round-trip sinkron ke proses Trackflow tiap event scroll/mouse; kalau proses telat merespons, delay ini kerasa system-wide | Diganti polling pasif `CGEventSourceCounterForEventType` (lihat `spawn_activity_poller` di `lib.rs`, khusus macOS) — sudah tidak berada di jalur pengiriman event sama sekali. Kalau gejala serupa muncul lagi, cek dulu apakah ada hook/tap baru yang ditambahkan ke jalur ini sebelum curiga ke tempat lain |
| `WindowServer` (Activity Monitor) makin berat CPU/port count-nya selama app jalan lama | Dependency `xcap` versi sangat lama (`0.0.12`) + capture screenshot jalan di tokio worker thread reusable tanpa `autoreleasepool`, jadi resource Objective-C-nya numpuk terus | Upgrade `xcap` ke versi terbaru + bungkus capture dengan `objc2::rc::autoreleasepool`. Kalau curiga leak serupa di kode macOS lain yang jalan di background task (bukan main thread), cek apakah sudah dibungkus autorelease pool |

---

## Checklist Cepat (Ringkasan)

```
[ ] Bump versi (tauri.conf.json + Cargo.toml, harus sama)
[ ] Update CHANGELOG.md (jangan sampai drift dari versi assets yang sudah dibuild!)
[ ] Commit & push
[ ] git tag v0.x.x && git push origin v0.x.x
[ ] Cek 3 job CI hijau semua
[ ] Cek draft release + 3 artifact + latest.json ada
[ ] Smoke test manual: macOS, Windows, Linux
[ ] (Wajib di awal, berkala setelahnya) Uji auto-updater: install baseline lama → publish versi baru → verifikasi update otomatis
[ ] Publish draft release
[ ] Rollout ke 2-3 orang dulu, baru broadcast penuh
```
