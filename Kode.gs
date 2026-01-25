// --- CONFIG ---
const SHEETS = { USERS: "users", TRANSAKSI: "transaksi", CONFIG: "config" };

function myFunction() {
  
}
// Code.gs - Multi Role Support

function doGet() {
  // Perhatikan ada .createTemplateFromFile (bukan createHtmlOutputFromFile)
  return HtmlService.createTemplateFromFile('index')
      .evaluate() // Ini penting agar script 'include' terbaca
      .setTitle('LuatLiat App')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

// --- FUNGSI HELPER: Cek Role berdasarkan Email ---
function getUserRole(email) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("users");
  var data = sheet.getDataRange().getValues();
  
  // Loop cari email
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] == email) { // Kolom C = Email
      return data[i][4];       // Kolom E = Role
    }
  }
  return "member"; // Default jika tidak ketemu
}

// --- FUNGSI CEK LOGIN (HASH) ---
function cekLogin(form) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("users");
  var data = sheet.getDataRange().getValues();
  
  var inputEmail = form.email.trim();
  var inputPass = form.password;
  var inputHash = hashString(inputPass);
  
  for (var i = 1; i < data.length; i++) {
    var dbEmail = String(data[i][2]).trim();
    var dbHash = String(data[i][3]).trim();
    var isActive = String(data[i][5]).toUpperCase();
    
    if (dbEmail == inputEmail && dbHash == inputHash && isActive == 'TRUE') {
      return {
        status: "sukses",
        nama: data[i][1], // Kolom B: Name
        email: dbEmail,
        role: data[i][4]  // Kolom E: Role (superadmin/bendahara/member)
      };
    }
  }
  return { status: "gagal", pesan: "Email/Password salah atau akun tidak aktif." };
}

function prosesGantiPassword(email, passLama, passBaru) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("users");
  var data = sheet.getDataRange().getValues();
  
  var hashLama = hashString(passLama);
  var hashBaru = hashString(passBaru);
  
  for (var i = 1; i < data.length; i++) {
    // Cek Email (Kolom C) dan Password Lama (Kolom D)
    if (data[i][2] == email && data[i][3] == hashLama) {
      // Update Password Baru di Kolom D (index 3 + 1 = 4)
      sheet.getRange(i + 1, 4).setValue(hashBaru);
      return "sukses";
    }
  }
  return "Password lama salah!";
}

// --- KONFIGURASI HARGA IURAN ---
var HARGA_IURAN = 50000; // Ganti sesuai nominal iuran bulanan organisasi Anda

// ... (Fungsi doGet, include, hashString biarkan sama) ...

// --- UPDATE FUNGSI SIMPAN ---
function simpanTransaksi(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("transaksi");
  
  var id = "TRX-" + new Date().getTime();
  var timestamp = new Date();
  var userRole = getUserRole(data.email);
  var status = (userRole === 'admin' || userRole === 'superadmin' || userRole === 'bendahara') ? "Completed" : "Pending";

  var approverEmail = (status === "Completed") ? data.email : "-";
  var approverName  = (status === "Completed") ? data.user_name : "-";
  
  var id = Utilities.getUuid();
  var nominal = parseInt(data.jumlah);
  
  // Ambil tahun dari input user, atau default ke tahun sekarang jika kosong
  var tahunIuran = data.tahun_iuran || waktu.getFullYear();
  
  sheet.appendRow([
    id,
    timestamp,
    data.jenis,
    data.kategori,
    nominal,
    status,
    data.user_name,
    approverName,
    timestamp,
    data.keterangan,
    "'"+data.bulan_dipilih,
    tahunIuran,
    data.email,
    approverEmail
  ]);
  
  return "Berhasil disimpan!";
}

// --- UPDATE FUNGSI CEK STATUS (Membaca Kolom L) ---
function getStatusIuran(emailUser, namaUser, tahunRequest) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("transaksi");
  
  // Default: Array Kosong 13 elemen (Index 0-12)
  // Format Baru: Setiap elemen bukan angka lagi, tapi Object atau Null
  var result = new Array(13).fill(null); 
  
  if (!sheet) return result;

  var data = sheet.getDataRange().getValues();
  tahunRequest = parseInt(tahunRequest);

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    
    // Mapping Kolom (Sesuaikan Index jika bergeser)
    var tglRaw    = row[1];      // Kolom B: Tanggal Transaksi
    var jenis     = row[3];      // Kolom D
    var status    = row[5];      // Kolom F
    var pembuat   = row[6];      // Kolom G (Nama)
    var periode   = row[10];     // Kolom K
    var tahunDB   = row[11];     // Kolom L
    var emailDB   = row[12];     // Kolom M (Email)

    // Cek Pemilik (Hybrid: Email / Nama)
    var isMilikUser = (emailDB && emailDB === emailUser) || (!emailDB && pembuat === namaUser);

    if (isMilikUser && jenis === "Iuran" && parseInt(tahunDB) === tahunRequest) {
      
      var bulanArr = periode.toString().split(",");
      
      // Format Tanggal Cantik (Misal: "05 Jan")
      var tglStr = "";
      if (tglRaw instanceof Date) {
        tglStr = Utilities.formatDate(tglRaw, "GMT+7", "dd MMM");
      } else {
        tglStr = tglRaw.toString().substring(0, 6); // Fallback jika text
      }

      // --- LOGIKA PENGISIAN STATUS ---
      bulanArr.forEach(function(b) {
        var idx = parseInt(b);
        
        if (status === "Completed") {
          // Simpan Objek: Status 2 (Lunas) + Tanggal Bayar
          result[idx] = { code: 2, date: tglStr };
        } 
        else if (status === "Pending") {
          // Jika belum lunas (belum ada data atau statusnya pending), baru timpa
          if (!result[idx] || result[idx].code !== 2) {
             result[idx] = { code: 1, date: tglStr };
          }
        }
        // Rejected tetap null (biar putih)
      });
    }
  }
  
  return result;
}

function getSaldo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("transaksi");
  if (!sheet || sheet.getLastRow() < 2) return 0;
  
  var data = sheet.getDataRange().getValues();
  var total = 0;
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var jenis = row[2];
    var nominal = Number(row[4]);
    var status = row[5]; // Kolom F = Status
    
    // Hanya hitung jika Status = Completed
    if (status === "Completed") {
      if (jenis === "Masuk") total += nominal;
      else if (jenis === "Keluar") total -= nominal;
    }
  }
  
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(total);
}

function hashString(str) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str);
  var txtHash = '';
  for (i = 0; i < rawHash.length; i++) {
    var hashVal = rawHash[i];
    if (hashVal < 0) hashVal += 256;
    if (hashVal.toString(16).length == 1) txtHash += '0';
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

// --- FUNGSI BARU: AMBIL RIWAYAT MEMBER ---
function getRiwayatUser(username) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("transaksi");
  
  if (!sheet || sheet.getLastRow() < 2) return [];

  var data = sheet.getDataRange().getValues();
  var riwayat = [];
  
  // Loop data transaksi
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    
    // Cek: Apakah yang input adalah user ini? DAN Apakah jenisnya 'Masuk'?
    // Kolom G (index 6) = created_by
    // Kolom C (index 2) = Jenis
    if (row[6] == username && row[2] == "Masuk") {
      
      // Format Tanggal agar cantik (DD/MM/YYYY)
      var tgl = new Date(row[1]);
      var tglStr = Utilities.formatDate(tgl, Session.getScriptTimeZone(), "dd/MM/yyyy");
      
      // Ambil Bulan & Tahun untuk keperluan filter
      var bulan = tgl.getMonth() + 1; // Jan = 1
      var tahun = tgl.getFullYear();

      riwayat.push({
        tanggal: tglStr,
        bulan: bulan,
        tahun: tahun,
        kategori: row[3], // Kolom D
        nominal: row[4],  // Kolom E
        status: row[5],   // Kolom F
        ket: row[9]       // Kolom J (Keterangan)
      });
    }
  }
  
  // Urutkan dari yang terbaru (Descending)
  return riwayat.reverse();
}

// --- FUNGSI TAMBAHAN: INCLUDE FILE HTML ---
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


// --- FUNGSI DEBUGGING (HANYA UNTUK CEK ERROR) ---
function debugCekData() {
  // Ganti ini sesuai data di Sheet Anda yang bermasalah
  var targetUser = "Ahmad Anggota"; 
  var targetTahun = "2024";

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("transaksi");
  var data = sheet.getDataRange().getValues();

  Logger.log("=== MULAI PENGECEKAN ===");
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    
    // Kita cek baris yang namanya cocok saja
    if (row[6] == targetUser) {
      Logger.log("--------------------------------");
      Logger.log("Ketemu Baris ke-" + (i+1));
      Logger.log("Jenis: " + row[2] + " | Kategori: " + row[3]);
      
      var tahunDiSheet = row[11]; // Kolom L
      var tahunDariTanggal = new Date(row[1]).getFullYear();
      var tahunFinal = tahunDiSheet ? tahunDiSheet : tahunDariTanggal;
      
      Logger.log("Tahun di Kolom L: " + tahunDiSheet);
      Logger.log("Tahun Final yang dibaca sistem: " + tahunFinal);
      Logger.log("Apakah Tahun cocok dengan " + targetTahun + "? : " + (tahunFinal == targetTahun));
      
      var periode = row[10]; // Kolom K
      Logger.log("Periode Bulan (Kolom K): " + periode);
      
      var status = row[5];
      Logger.log("Status: " + status + " (Harus 'Completed' untuk hijau)");
    }
  }
  Logger.log("=== SELESAI ===");
}

// --- FUNGSI BARU: REKAP PEMASUKAN GLOBAL PER KATEGORI ---
function getRekapPemasukan(username) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("transaksi");
  
  if (!sheet || sheet.getLastRow() < 2) return { total: 0, rincian: {} };

  var data = sheet.getDataRange().getValues();
  var stats = {}; // Objek untuk simpan per kategori (misal: {'Iuran': 50000, 'Donasi': 20000})
  var totalSemua = 0;

  // Loop data transaksi
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var jenis = row[2];    // Kolom C
    var kategori = row[3]; // Kolom D
    var nominal = Number(row[4]); // Kolom E
    var status = row[5];   // Kolom F
    var pembuat = row[6];

    // SYARAT: Jenis = Masuk DAN Status = Completed
    if (jenis === "Masuk" && status === "Completed" && pembuat === username) {
      
      // Jika kategori belum ada di list, buat jadi 0 dulu
      if (!stats[kategori]) {
        stats[kategori] = 0;
      }
      
      // Tambahkan nominal
      stats[kategori] += nominal;
      totalSemua += nominal;
    }
  }

  return {
    total: totalSemua,
    rincian: stats // Mengirim objek: { "Iuran": 1000000, "Donasi": 500000 }
  };
}

// --- FUNGSI UNTUK MENGAMBIL DAFTAR BULAN YANG TERKUNCI ---
function getLockedMonths(emailUser, namaUser, tahunRequest) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("transaksi");
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var lockedMonths = [];
  tahunRequest = parseInt(tahunRequest);

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    
    // Pastikan urutan index array benar:
    var jenis     = row[3]; 
    var status    = row[5];
    var pembuat   = row[6]; 
    var periode   = row[10];
    var tahunDB   = row[11];
    var emailDB   = row[12]; // Kolom M (Sekarang namanya 'email')

    // Cek Pemilik (Email atau Nama)
    var isMilikUser = (emailDB && emailDB === emailUser) || (!emailDB && pembuat === namaUser);

    if (isMilikUser && parseInt(tahunDB) === tahunRequest && jenis === "Iuran") {
      // Logic: Kunci jika BUKAN Rejected
      if (status !== "Rejected") {
         var bulanArr = periode.toString().split(",");
         bulanArr.forEach(function(b) { lockedMonths.push(parseInt(b)); });
      }
    }
  }
  return lockedMonths;
}

  // --- FUNGSI AMBIL DAFTAR TAHUN DARI CONFIG ---
function getAppConfig() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("config");
  var data = sheet.getDataRange().getValues();
  
  // Default Config
  var config = {
    years: [new Date().getFullYear()],
    currentYear: new Date().getFullYear(),
    hargaIuran: 50000 // Default jaga-jaga jika sheet kosong
  };

  // Loop data config dari baris 2
  for (var i = 1; i < data.length; i++) {
    var key = data[i][0];
    var val = data[i][1];

    if (key === "list_tahun") {
      config.years = val.toString().split(",");
    }
    // --- BACA HARGA BARU ---
    if (key === "harga_iuran") {
      config.hargaIuran = parseInt(val); 
    }
  }
  
  return config;
}


  // --- FUNGSI AMBIL TRANSAKSI PENDING (UNTUK BENDAHARA) ---
  function getPendingTransactions() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("transaksi");
    if (!sheet) return [];
    
    var data = sheet.getDataRange().getValues();
    var pending = [];
    
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][5] === "Pending") {
        // FORMAT TANGGAL: DD MMM, YYYY (Contoh: 08 Jan, 2026)
        var tglRaw = new Date(data[i][1]);
        var formattedDate = Utilities.formatDate(tglRaw, "GMT+7", "dd MMM, yyyy");

        pending.push({
          row: i + 1,
          id: data[i][0],
          tanggal: formattedDate,
          kategori: data[i][3],
          nominal: data[i][4],
          nama: data[i][6],
          keterangan: data[i][9],
          periode: data[i][10] // Kita ambil kolom K (periode_bulan)
        });
      }
    }
    return pending;
  }

  function updateStatusTransaksi(row, statusBaru, namaApprover, emailApprover, alasan) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("transaksi");
    
    // Update Status (Kolom F / Index 6)
    sheet.getRange(row, 6).setValue(statusBaru);
    
    // Update Nama Approver (Kolom H / Index 8)
    sheet.getRange(row, 8).setValue(namaApprover);

    // UPDATE BARU: Simpan Email Approver (Kolom N / Index 14)
    // Agar unik dan tidak tertukar jika nama admin sama
    sheet.getRange(row, 14).setValue(emailApprover);
    
    // Jika ditolak, simpan alasan di Keterangan (Opsional, timpa keterangan lama atau tambah)
    if (alasan) {
      var ketLama = sheet.getRange(row, 10).getValue();
      sheet.getRange(row, 10).setValue(ketLama + " [Ditolak: " + alasan + "]");
    }
    
    return "Status berhasil diperbarui!";
  }

  // --- MANAJEMEN USER (KHUSUS SUPERADMIN) ---

// 1. Ambil semua data user
function getAllUsers() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("users");
  var data = sheet.getDataRange().getValues();
  var users = [];
  
  // Asumsi urutan kolom di Sheet 'users':
  // [0] ID, [1] Nama, [2] Email, [3] Password, [4] Role
  
  for (var i = 1; i < data.length; i++) {
    users.push({
      row: i + 1, // Simpan nomor baris untuk edit/hapus
      id: data[i][0],
      nama: data[i][1],
      email: data[i][2],
      password: data[i][3],
      role: data[i][4]
    });
  }
  return users;
}

// 2. Simpan User Baru atau Update User Lama
function simpanDataUser(form) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("users");
  
  // Cek apakah mode Edit (punya row) atau Baru
  if (form.rowId) {
    // --- UPDATE USER LAMA ---
    var rowIndex = parseInt(form.rowId);
    sheet.getRange(rowIndex, 2).setValue(form.nama); // Update Nama
    sheet.getRange(rowIndex, 3).setValue(form.email); // Update Email
    sheet.getRange(rowIndex, 5).setValue(form.role);  // Update Role
    
    // Update password hanya jika diisi (biar tidak mereset password lama jika kosong)
    if (form.password) {
      sheet.getRange(rowIndex, 4).setValue(form.password); 
    }
    
    return "Data user berhasil diperbarui!";
    
  } else {
    // --- BUAT USER BARU ---
    // Cek duplikasi email dulu
    var users = sheet.getDataRange().getValues();
    for(var i=1; i<users.length; i++){
      if(users[i][2] == form.email) throw new Error("Email sudah terdaftar!");
    }
    
    var newId = Utilities.getUuid();
    sheet.appendRow([
      newId,
      form.nama,
      form.email,
      form.password, // Password plaintext (sebaiknya di-hash di production)
      form.role
    ]);
    
    return "User baru berhasil ditambahkan!";
  }
}

// 3. Hapus User
function hapusDataUser(row) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("users");
  sheet.deleteRow(parseInt(row));
  return "User berhasil dihapus.";
}




  