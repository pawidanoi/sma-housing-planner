const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const db = require('../lib/db');
const repo = require('../lib/repo');

function readCsv(file) {
  const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
  return parse(text, { columns: true, skip_empty_lines: true, bom: true });
}

function num(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function loadBranches() {
  return readCsv('branches.csv').map(row => ({
    c: row['รหัสสาขา'], n: row['ชื่อสาขา'], d: row['อำเภอ'] || '', pv: row['จังหวัด'] || '',
    la: num(row['ละติจูด']), lo: num(row['ลองจิจูด']), status: row['สถานะ'] || null,
  })).filter(b => b.c && b.n && b.la != null && b.lo != null);
}
function loadHotels() {
  return readCsv('hotels.csv').map(row => ({
    n: row['ชื่อที่พัก'], pr: num(row['ราคาต่อคืน']) || 0, d: row['อำเภอ'] || '', pv: row['จังหวัด'] || '',
    la: num(row['ละติจูด']), lo: num(row['ลองจิจูด']),
  })).filter(h => h.n && h.la != null && h.lo != null);
}
function loadEmployees() {
  return readCsv('employees.csv').map(row => ({
    code: row['รหัสพนักงาน'] || null, name: row['ชื่อพนักงาน'], team: row['ทีม/ตำแหน่ง'] || '',
    nickname: row['ชื่อเล่น'] || null, gender: row['เพศ'] || null, area_incharge: row['Areaดูแล'] || null,
    phone: row['เบอร์โทร'] || null, home_la: num(row['ละติจูดบ้าน']), home_lo: num(row['ลองจิจูดบ้าน']),
  })).filter(e => e.name);
}

function runSeedIfEmpty() {
  const branchCount = db.prepare('SELECT COUNT(*) c FROM branches').get().c;
  if (branchCount > 0) return; // already seeded (or already has real data) — never overwrite
  repo.replaceBranches(loadBranches());
  repo.replaceHotels(loadHotels());
  repo.replaceEmployees(loadEmployees());
  console.log('Seeded initial data from CSV files.');
}

if (require.main === module) {
  runSeedIfEmpty();
  console.log('Seed check complete.');
}

module.exports = { runSeedIfEmpty };
