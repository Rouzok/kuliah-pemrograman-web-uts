# Flight Tracker

Flight Tracker dikembangkan untuk melihat, mengikuti, dan menyimpan posisi pesawat di browser.

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

## Teknologi dan struktur proyek

- **React, Vite, dan React Router** untuk antarmuka dan navigasi.
- **Tailwind CSS, GSAP, dan Three.js** untuk tampilan, animasi, dan globe.
- **Hono** sebagai framework backend API dan **Bun** sebagai runtime server serta pelaksana skrip proyek.
- **Axios** pada browser dan server untuk mengakses OpenSky melalui API proyek.
- **MapLibre GL** untuk pengembangan Live Map.
- **pnpm** untuk memasang dependensi dan mengelola lockfile. Bun tidak digunakan sebagai pengelola dependensi.

Kode frontend berada di `client/`, sedangkan backend berada di `server/`. Keduanya menggunakan satu `package.json` dan `pnpm-lock.yaml` di root proyek. Backend saat ini menggunakan Hono pada Bun; Cloudflare Worker dan Wrangler sudah tidak digunakan.

Saat pengembangan, frontend dan backend berjalan terpisah. Untuk produksi, satu proses Bun menyajikan API dan hasil build frontend pada origin yang sama.

## Cara menjalankan di komputer

Siapkan **Node.js 22.22.0 atau lebih baru**, **Bun 1.4.2 atau lebih baru**, dan **pnpm 12.14.0**. Versi Bun proyek dicatat dalam `.bun-version`.

Jalankan pemasangan dependensi dari root proyek:

```sh
pnpm install --frozen-lockfile
```

Di PowerShell, salin contoh konfigurasi hanya jika file tujuan belum ada:

```powershell
if (!(Test-Path client/.env.development.local)) { Copy-Item client/.env.example client/.env.development.local }
if (!(Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
```

Jalankan frontend di terminal pertama:

```sh
pnpm dev
```

Jalankan backend di terminal kedua:

```sh
pnpm dev:server
```

Buka **[http://localhost:5273](http://localhost:5273)**. Backend API berjalan di **http://localhost:8787**. Halaman dan tampilan awal dapat dibuka tanpa kredensial OpenSky; data pesawat memerlukan konfigurasi berikut.

### Konfigurasi frontend dan data pesawat

File `client/.env.development.local` berisi alamat publik backend tanpa akhiran `/api`:

```dotenv
VITE_API_BASE_URL=http://localhost:8787
```

File ini khusus untuk pengembangan sehingga tidak mengarahkan build produksi ke localhost. Jangan menyimpan kredensial atau token OpenSky dalam variabel `VITE_*` atau file frontend.

Isi `OPENSKY_CLIENT_ID` dan `OPENSKY_CLIENT_SECRET` pada `server/.env` menggunakan kredensial OpenSky milik sendiri. File tersebut diabaikan oleh Git. Kredensial kosong atau tidak tersedia menghasilkan respons kesalahan konfigurasi yang aman ketika data diminta.

Pastikan pengaturan nonrahasia pada `server/.env` sesuai dengan port pengembangan:

```dotenv
ALLOWED_ORIGINS=http://localhost:5273,http://localhost:4173
PORT=8787
HOST=localhost
TRUSTED_PROXY_IPS=
```

`ALLOWED_ORIGINS` berisi origin yang diizinkan secara persis, dipisahkan koma. Jika port frontend berubah, sesuaikan origin ini dan mulai ulang backend. Frontend dan backend memakai port berbeda selama pengembangan.

Browser meminta data melalui backend Hono, kemudian backend menghubungi OpenSky. Respons pesawat yang berhasil disimpan sementara selama 30 detik, dan permintaan dibatasi 60 kali per 60 detik per alamat IP sebelum pemeriksaan cache atau akses provider.

Cache respons, pembatasan permintaan, dan token OAuth tersimpan dalam memori proses Bun. Status tersebut hilang saat server dimulai ulang dan tidak dibagikan antarproses atau replika. Kuota kredit OpenSky tetap digunakan bersama oleh seluruh pemakaian akun.

## Pengujian dan hasil build

| Perintah            | Kegunaan                                                                         |
| ------------------- | -------------------------------------------------------------------------------- |
| `pnpm test`         | Menjalankan seluruh pengujian frontend dan backend.                              |
| `pnpm test:api`     | Menguji klien API, identitas pesawat, dan penyimpanan lokal.                     |
| `pnpm test:globe`   | Menguji geometri, pemilihan pesawat, dan pembaruan globe.                        |
| `pnpm test:map`     | Menjalankan pengujian Live Map yang tersedia.                                    |
| `pnpm test:server`  | Menguji Hono, OAuth, CORS, cache, pembatasan permintaan, IP, dan penyajian file. |
| `pnpm test:proxy`   | Alias kompatibilitas untuk `pnpm test:server`.                                   |
| `pnpm build`        | Menghasilkan frontend di folder `client/dist/`.                                  |
| `pnpm preview`      | Menampilkan frontend hasil build di http://localhost:4173.                       |
| `pnpm start`        | Menjalankan server produksi Bun untuk API dan frontend hasil build.              |
| `pnpm smoke:server` | Memeriksa server hasil build yang sedang berjalan tanpa memanggil provider.      |

`pnpm preview` hanya menjalankan frontend. Jika membutuhkan data OpenSky saat preview, jalankan backend secara terpisah dan gunakan origin API melalui `VITE_API_BASE_URL` ketika membuat build preview.

Jalankan `pnpm smoke:server` setelah `pnpm build` dan `pnpm start`. Pemeriksaan ini menggunakan http://localhost:8787 dan preflight dari http://localhost:5273, sehingga origin tersebut perlu diizinkan pada server yang diuji. Variabel `SMOKE_BASE_URL` dapat mengganti alamat target. Pemeriksaan live opsional melalui `pnpm smoke:server --live` hanya meminta satu viewport kecil dan maksimal satu pesawat yang dikembalikan.

Pengujian otomatis menggunakan data uji. Hasilnya tidak membuktikan autentikasi atau cakupan OpenSky secara langsung. Integrasi AirportsAPI serta pengujian produksi, browser, dan perangkat masih perlu diselesaikan.

## Menjalankan di produksi

Dari root proyek:

```sh
pnpm build
pnpm start
```

Server Bun menyajikan API dan file `client/dist/` pada origin yang sama. Server produksi memerlukan hasil build terlebih dahulu. Tanpa pengaturan lain, alamat lokalnya adalah http://localhost:8787.

Untuk konfigurasi satu origin ini, jangan isi atau kosongkan `VITE_API_BASE_URL` saat build produksi agar browser menggunakan origin website. Jangan memasukkan alamat localhost ke build publik.

Gunakan hosting yang mendukung proses Bun. Konfigurasikan kredensial OpenSky melalui environment server, origin HTTPS website melalui `ALLOWED_ORIGINS`, serta `PORT` sesuai kebutuhan hosting. Nilai bawaan `HOST` adalah localhost; gunakan `HOST=0.0.0.0` jika diperlukan untuk menerima koneksi melalui jaringan hosting atau container.

Jika menggunakan reverse proxy, `TRUSTED_PROXY_IPS` hanya boleh berisi IP proxy langsung yang dipercaya. Proxy tersebut harus mengganti `X-Forwarded-For` dengan satu alamat IP klien yang valid. Nilai bawaan kosong membuat backend menggunakan IP koneksi langsung.

Hanya hasil build frontend yang disajikan sebagai file publik. Rute frontend dapat dibuka langsung, sedangkan rute API yang tidak dikenal tetap menghasilkan JSON 404 dan aset yang hilang tetap menghasilkan 404.

Tautan demo GitHub Pages di atas merupakan demo frontend statis. Backend Bun memerlukan hosting tersendiri yang mendukung runtime tersebut. Workflow CI saat ini menjalankan pengujian, build, pemeriksaan server, dan mengunggah artefak aplikasi; tidak melakukan deployment otomatis.
