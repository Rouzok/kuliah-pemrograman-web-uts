# Flight Tracker

Flight Tracker dikembangkan untuk melihat,mengikuti,menyimpan posisi pesawat di browser.

**[Buka demo website](https://rouzok.github.io/kuliah-pemrograman-web-uts/)**

Demo menampilkan antarmuka website. Data pesawat belum tersedia pada demo karena belum terhubung ke layanan API.

## Fitur dan status pengembangan

| Halaman           | Alamat          | Status                                                                                                 |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| Profil perusahaan | `/`             | Tersedia, termasuk globe yang dapat menampilkan data pesawat saat API dikonfigurasi.                   |
| Live Map          | `/map`          | Halaman tersedia; peta pelacakan lengkap, tabel pesawat, dan pembaruan otomatisnya masih dikembangkan. |
| Airports          | `/map/airports` | Halaman tersedia; integrasi data bandara belum tersedia.                                               |
| Saved Aircraft    | `/map/saved`    | Daftar tersimpan, tombol Open dan Remove tersedia; tampilan detail masih berupa tampilan awal.         |

Daftar pesawat tersimpan menggunakan penyimpanan lokal browser, tanpa akun atau database. Pesawat dikenali melalui kode ICAO24, yaitu identitas pesawat yang terdiri dari enam karakter heksadesimal.

Globe pada profil perusahaan dapat menampilkan hingga delapan pesawat dari OpenSky dan memperbarui data setiap 30 detik saat aktif, terlihat, dan terhubung ke internet. Jika permintaan gagal, data sebelumnya tetap ditampilkan dan pembaruan menunggu pengguna mencoba kembali.

## Teknologi

- **React, Vite, dan React Router** untuk antarmuka dan navigasi.
- **Tailwind CSS, GSAP, dan Three.js** untuk tampilan, animasi, dan globe.
- **Axios dan Cloudflare Worker** untuk akses data OpenSky melalui layanan perantara API.
- **MapLibre GL** disiapkan untuk pengembangan Live Map; penyedia peta belum dikonfigurasi.

## Cara menjalankan di komputer

Siapkan **Node.js 22.22.0 atau lebih baru**, **Bun 1.4.2 atau lebih baru**, dan **pnpm 12.14.0**. Gunakan pnpm untuk memasang dependensi; Bun digunakan oleh skrip proyek.

Jalankan perintah berikut di folder proyek:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Buka **[http://localhost:5173](http://localhost:5173)**. Halaman dan tampilan awal dapat dibuka tanpa kredensial OpenSky.

### Mengaktifkan data pesawat (opsional)

Data pesawat memerlukan Cloudflare Worker yang berjalan terpisah dan kredensial OpenSky. Di PowerShell, salin contoh konfigurasi hanya jika file tujuan belum ada:

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
if (!(Test-Path proxy/.dev.vars)) { Copy-Item proxy/.dev.vars.example proxy/.dev.vars }
```

Isi `.env.local` dengan alamat Worker tanpa akhiran `/api`:

```dotenv
VITE_API_BASE_URL=http://localhost:8787
```

Isi `OPENSKY_CLIENT_ID` dan `OPENSKY_CLIENT_SECRET` di `proxy/.dev.vars` menggunakan kredensial OpenSky milik sendiri. Simpan kredensial hanya pada konfigurasi Worker; jangan memasukkannya ke variabel `VITE_*` atau file publik.

Biarkan `pnpm dev` tetap berjalan, lalu buka terminal kedua:

```sh
pnpm proxy:dev
```

Worker berjalan di **http://localhost:8787**. Browser meminta data melalui Worker, kemudian Worker menghubungi OpenSky. Respons pesawat disimpan sementara selama 30 detik, dan permintaan dibatasi 60 kali per menit per alamat IP. Kuota kredit OpenSky tetap digunakan bersama oleh seluruh pemakaian akun.

## Pengujian dan hasil build

| Perintah          | Kegunaan                                                     |
| ----------------- | ------------------------------------------------------------ |
| `pnpm test:api`   | Menguji klien API, identitas pesawat, dan penyimpanan lokal. |
| `pnpm test:globe` | Menguji geometri, pemilihan pesawat, dan pembaruan globe.    |
| `pnpm test:proxy` | Menguji Worker, autentikasi, pembatasan akses, dan cache.    |
| `pnpm build`      | Menghasilkan website siap hosting di folder `dist/`.         |
| `pnpm preview`    | Membuka hasil build di http://localhost:4173.                |

Pengujian otomatis menggunakan data uji. Autentikasi dan cakupan data OpenSky secara langsung belum terverifikasi. Integrasi AirportsAPI serta pengujian produksi, browser, dan perangkat masih perlu diselesaikan.

Frontend dipublikasikan melalui GitHub Pages. Worker perlu dikonfigurasi dan dipublikasikan secara terpisah agar data pesawat dapat digunakan pada website publik.
