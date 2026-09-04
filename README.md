# Paragon Supply Collaboration Hub — Front-End

Antarmuka portal pemasok dan konsol procurement, dibangun dari dokumen
*Flow: Registrasi, Review & Onboarding Supplier* v1.4.

Aplikasi ini **front-end saja**. Tidak ada backend, tidak ada panggilan jaringan.
Seluruh data hidup di memori selama sesi berlangsung, sehingga menyegarkan
halaman akan mengembalikan data contoh ke kondisi awal.

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # keluaran produksi ke dist/
npm run preview  # meninjau hasil build
npm test         # memeriksa transisi status & aturan validasi
```

Butuh Node 18 atau lebih baru.

## Akun demo

Kata sandi apa pun diterima; yang diperiksa hanya email atau ID akun.

**Konsol internal — `/internal/masuk`**

| Email | Role | Yang bisa dilakukan |
|---|---|---|
| `dewi.anggraini@paragon-corp.com` | Staf Procurement | Tinjau, setujui, tolak, undang pemasok, verifikasi dokumen |
| `rangga.prasetyo@paragon-corp.com` | Staf Procurement Admin | Semua di atas, ditambah jalur registrasi internal |
| `lestari.handayani@paragon-corp.com` | Manager Procurement | Menyetujui profil hasil registrasi internal |

**Portal pemasok — `/masuk`**

| ID akun | Kondisi |
|---|---|
| `SUP-PAC-0131` | Profil lengkap, menunggu verifikasi dokumen |
| `SUP-RAW-0118` | Pemasok aktif, bisa mengubah profil |

## Menelusuri kedua jalur

**Jalur A — undang pemasok**

1. Masuk sebagai Staf Procurement, buka antrian, pilih pengajuan berstatus menunggu.
2. Buka ketiga tab (tombol keputusan terkunci sampai semuanya dibuka), lalu setujui.
3. Tekan **Kirim undangan**. Salin ID akun dan kata sandi sementara dari dialog.
4. Keluar, masuk ke portal pemasok dengan ID akun tersebut, ganti kata sandi.
5. Isi kelima bagian profil, setujui kedua pernyataan pada layar persetujuan.
6. Masuk kembali sebagai staf, buka **Verifikasi dokumen**, setujui atau minta perbaikan.

**Jalur B — registrasi internal**

1. Masuk sebagai Staf Procurement **Admin**, setujui sebuah pengajuan.
2. Pilih **Mulai registrasi internal**, tentukan asal dokumen (email atau WhatsApp).
3. Isi kelima bagian, lalu **Ajukan ke manager**.
4. Keluar, masuk sebagai Manager Procurement, buka **Approval manager**.
5. Setujui — barulah akun dibuat dan undangan dikirim.
6. Masuk sebagai pemasok memakai ID akun tersebut untuk meninjau dan menyetujui.

Pengajuan `SUP-2026-0135` sudah berada pada status menunggu approval manager,
jadi langkah 4 bisa dicoba langsung tanpa mengisi ulang.

## Struktur

```
src/
  lib/          constants.js   status, role, enum, ambang teknis
                validation.js  aturan field generik
                profileRules.js validasi lima bagian profil (murni, teruji)
                format.js      tanggal, ID akun, masa berlaku
                mockData.js    data contoh mencakup setiap status
  store/        AppStore.jsx   reducer tunggal + seluruh aksi transisi status
  components/
    ui/         primitif: Button, Field, FileField, Modal, Toast, Tabs,
                Card, StatusBadge, DataList, SectionRail, EmptyState
    layout/     AuthShell, InternalLayout, SupplierLayout (+ CSS berdampingan)
    profile/    ProfileSectionForm (dipakai dua jalur), ProfileSummary
  pages/
    auth/       SupplierLogin, StaffLogin, ForgotPassword
    supplier/   RegisterWizard, ChangePassword, ProfileOnboarding,
                ConsentPage, SupplierStatus, ActiveProfile
    internal/   QueueDashboard, SubmissionReview, InternalRegistration,
                ManagerApprovals, DocumentVerification
  styles/       global.css — design token dan gaya dasar
scripts/        flow-check.mjs — pemeriksaan transisi status
```

## Aturan dari dokumen yang tercermin di kode

| Aturan | Letak |
|---|---|
| Tombol keputusan terkunci sampai ketiga tab dibuka | `SubmissionReview.jsx` |
| Jalur internal hanya untuk Procurement Admin | `AppStore.canUseInternalPath`, `SubmissionReview.jsx` |
| Jalur terkunci setelah dipilih | tidak ada aksi yang mengubah `onboardingPath` |
| Akun Jalur B baru dibuat setelah approval manager | `AppStore.managerApprove` |
| Kata sandi berlaku 7 hari sejak email terkirim | `format.passwordExpiryFrom`, diuji di `flow-check.mjs` |
| Dua kotak centang persetujuan, tidak pre-checked | `ConsentPage.jsx` |
| Verifikasi dokumen wajib sebelum aktif | `DocumentVerification.jsx` |
| NIK 16 digit, NPWP 16 digit dengan normalisasi 15→16 | `validation.js` |
| Unggahan PDF/JPG/PNG maksimal 2 MB | `validation.validateFile`, `FileField.jsx` |
| Termin pembayaran 7/15/30/45/60 Net Days | `constants.TERMS_OF_PAYMENT` |
| Maksimal 10 kontak, satu kontak utama | `ProfileSectionForm.jsx`, `profileRules.js` |
| Perubahan dokumen setelah aktif memicu verifikasi ulang | `ActiveProfile.jsx`, `AppStore.updateActiveProfile` |

## Catatan implementasi

- **Reminder otomatis** (bagian 4.9 dokumen) tidak dibuat karena penjadwalan
  email berada di sisi server. Yang tampak di antarmuka adalah peringatan masa
  berlaku kata sandi pada layar ganti kata sandi.
- **Berkas unggahan** hanya disimpan sebagai metadata (nama, ukuran, tipe).
  Validasi format dan ukuran tetap berjalan penuh.
- **Penyimpanan peramban** sengaja tidak dipakai agar demo selalu mulai dari
  kondisi yang sama dan tidak menahan data pribadi contoh di perangkat.
- **Aksesibilitas**: cincin fokus terlihat, galat field terhubung lewat
  `aria-describedby`, tab dinavigasi tombol panah, modal menahan fokus dan
  ditutup dengan Escape, notifikasi memakai live region, `prefers-reduced-motion`
  dihormati.
