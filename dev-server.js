const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

function readFile(filename) {
  const extensions = ['', '.html'];
  for (const ext of extensions) {
    const filepath = path.join(__dirname, filename + ext);
    if (fs.existsSync(filepath)) {
      return fs.readFileSync(filepath, 'utf-8');
    }
  }
  return `<!-- include not found: ${filename} -->`;
}

function processIncludes(html) {
  return html.replace(/<\?!=\s*include\(['"](\w+)['"]\)\s*;?\s*\?>/g, (match, filename) => {
    const content = readFile(filename);
    return processIncludes(content);
  });
}

const MOCK_SCRIPT = `
<script>
(function() {
  var google = window.google || {};
  google.script = google.script || {};
  google.script.run = new Proxy({}, {
    get: function(target, prop) {
      if (prop === 'withSuccessHandler') {
        return function(cb) {
          return new Proxy({}, {
            get: function(t2, fn) {
              if (fn === 'withFailureHandler') {
                return function(errCb) {
                  return new Proxy({}, {
                    get: function(t3, fn2) {
                      return function() {
                        console.log('[Mock GAS] Called: ' + fn2, arguments);
                        mockGasCall(fn2, Array.from(arguments), cb, errCb);
                      };
                    }
                  });
                };
              }
              return function() {
                console.log('[Mock GAS] Called: ' + fn, arguments);
                mockGasCall(fn, Array.from(arguments), cb, function(){});
              };
            }
          });
        };
      }
      if (prop === 'withFailureHandler') {
        return function(errCb) {
          return new Proxy({}, {
            get: function(t2, fn) {
              if (fn === 'withSuccessHandler') {
                return function(cb) {
                  return new Proxy({}, {
                    get: function(t3, fn2) {
                      return function() {
                        console.log('[Mock GAS] Called: ' + fn2, arguments);
                        mockGasCall(fn2, Array.from(arguments), cb, errCb);
                      };
                    }
                  });
                };
              }
              return function() {
                console.log('[Mock GAS] Called: ' + fn, arguments);
                mockGasCall(fn, Array.from(arguments), function(){}, errCb);
              };
            }
          });
        };
      }
      return function() {
        console.log('[Mock GAS] Called: ' + prop, arguments);
        mockGasCall(prop, Array.from(arguments), function(){}, function(){});
      };
    }
  });
  window.google = google;

  function mockGasCall(fn, args, successCb, failureCb) {
    setTimeout(function() {
      switch(fn) {
        case 'cekLogin':
          var form = args[0];
          if (form && form.email === 'demo@luatliat.com' && form.password === 'demo123') {
            successCb({ status: 'sukses', nama: 'Demo User', email: 'demo@luatliat.com', role: 'bendahara' });
          } else if (form && form.email === 'admin@luatliat.com' && form.password === 'admin123') {
            successCb({ status: 'sukses', nama: 'Admin', email: 'admin@luatliat.com', role: 'superadmin' });
          } else {
            successCb({ status: 'gagal', pesan: 'Email/Password salah atau akun tidak aktif.' });
          }
          break;
        case 'getSaldo':
          successCb('Rp 1.250.000');
          break;
        case 'getAppConfig':
          successCb({ years: ['2024', '2025', '2026'], currentYear: 2026, hargaIuran: 50000 });
          break;
        case 'getStatusIuran':
          var result = new Array(13).fill(null);
          result[1] = { code: 2, date: '15 Jan' };
          result[2] = { code: 2, date: '12 Feb' };
          result[3] = { code: 1, date: '05 Mar' };
          successCb(result);
          break;
        case 'getLockedMonths':
          successCb([1, 2, 3]);
          break;
        case 'getRiwayatUser':
          successCb([
            { tanggal: '15/01/2026', bulan: 1, tahun: 2026, kategori: 'Iuran', nominal: 50000, status: 'Completed', ket: 'Iuran Januari' },
            { tanggal: '12/02/2026', bulan: 2, tahun: 2026, kategori: 'Iuran', nominal: 50000, status: 'Completed', ket: 'Iuran Februari' }
          ]);
          break;
        case 'getRekapPemasukan':
          successCb({ total: 350000, rincian: { 'Iuran': 250000, 'Donasi': 100000 } });
          break;
        case 'simpanTransaksi':
          successCb('Berhasil disimpan!');
          break;
        case 'getPendingTransactions':
          successCb([
            { row: 5, id: 'TRX-001', tanggal: '20 Feb, 2026', kategori: 'Iuran', nominal: 50000, nama: 'Ahmad', keterangan: 'Iuran Maret', periode: '3' }
          ]);
          break;
        case 'getAllUsers':
          successCb([
            { row: 2, id: '1', nama: 'Admin', email: 'admin@luatliat.com', role: 'superadmin' },
            { row: 3, id: '2', nama: 'Demo User', email: 'demo@luatliat.com', role: 'bendahara' },
            { row: 4, id: '3', nama: 'Ahmad', email: 'ahmad@test.com', role: 'member' }
          ]);
          break;
        case 'prosesGantiPassword':
          successCb('sukses');
          break;
        case 'updateStatusTransaksi':
          successCb('Status berhasil diperbarui!');
          break;
        case 'simpanDataUser':
          successCb('Data user berhasil diperbarui!');
          break;
        case 'hapusDataUser':
          successCb('User berhasil dihapus.');
          break;
        default:
          console.warn('[Mock GAS] No mock for: ' + fn);
          successCb(null);
      }
    }, 300);
  }
})();
</script>
`;

app.get('/', (req, res) => {
  let html = readFile('index');
  html = processIncludes(html);
  html = html.replace('</body>', MOCK_SCRIPT + '\n</body>');
  res.type('html').send(html);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'LuatLiat dev server running' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LuatLiat dev server running at http://localhost:${PORT}`);
  console.log('Mock accounts:');
  console.log('  - demo@luatliat.com / demo123 (bendahara)');
  console.log('  - admin@luatliat.com / admin123 (superadmin)');
});
