const path = require('path');
const express = require('express');
const repo = require('./lib/repo');
const db = require('./lib/db');
const { runSeedIfEmpty } = require('./seed/run-seed');

runSeedIfEmpty();

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function branchCodeSet() {
  return new Set(db.prepare('SELECT code FROM branches').all().map(r => r.code));
}

app.get('/api/state', (req, res) => {
  res.json(repo.getState());
});

// ---- branches ----
app.post('/api/branches/replace', (req, res) => {
  const list = req.body.branches;
  if (!Array.isArray(list)) return res.status(400).json({ error: 'branches must be an array' });
  repo.replaceBranches(list);
  res.json(repo.getState());
});
app.post('/api/branches/add', (req, res) => {
  const b = req.body.branch;
  if (!b || !b.c || !b.n || typeof b.la !== 'number' || typeof b.lo !== 'number') {
    return res.status(400).json({ error: 'ต้องมีรหัสสาขา/ชื่อ/ละติจูด/ลองจิจูด' });
  }
  repo.addBranch(b);
  res.json(repo.getState());
});

// ---- hotels ----
app.post('/api/hotels/replace', (req, res) => {
  const list = req.body.hotels;
  if (!Array.isArray(list)) return res.status(400).json({ error: 'hotels must be an array' });
  repo.replaceHotels(list);
  res.json(repo.getState());
});
app.post('/api/hotels/add', (req, res) => {
  const h = req.body.hotel;
  if (!h || !h.n || typeof h.la !== 'number' || typeof h.lo !== 'number') {
    return res.status(400).json({ error: 'ต้องมีชื่อ/ละติจูด/ลองจิจูด' });
  }
  repo.addHotel(h);
  res.json(repo.getState());
});

// ---- employees ----
app.post('/api/employees/replace', (req, res) => {
  const list = req.body.employees;
  if (!Array.isArray(list)) return res.status(400).json({ error: 'employees must be an array' });
  repo.replaceEmployees(list);
  res.json(repo.getState());
});
app.post('/api/employees/add', (req, res) => {
  const e = req.body.employee;
  if (!e || !e.name) return res.status(400).json({ error: 'ต้องมีชื่อพนักงาน' });
  repo.addEmployee(e);
  res.json(repo.getState());
});

// ---- schedule ----
app.post('/api/schedule/bulk', (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
  const known = branchCodeSet();
  let ok = 0, skip = 0;
  const skipCodes = [];
  items.forEach(item => {
    const codes = Array.isArray(item.branches) ? item.branches : [];
    const validCodes = codes.filter(c => known.has(c));
    if (validCodes.length === 0 || !item.team || !item.work_start || !item.work_end) {
      skip++; skipCodes.push((codes[0] || '(ไม่มีรหัส)') + ' (ไม่พบในทะเบียนสาขา หรือข้อมูลไม่ครบ)');
      return;
    }
    repo.addScheduleItem({
      id: item.id || ('S' + Date.now() + Math.random().toString(36).slice(2, 7)),
      team: item.team,
      branches: validCodes,
      work_start: item.work_start,
      work_end: item.work_end,
      stay_start: item.stay_start || item.work_start,
      stay_end: item.stay_end || item.work_end,
      male: item.male ?? null,
      female: item.female ?? null,
      job_type: item.job_type || null,
      needs_burmese: !!item.needs_burmese,
    });
    ok++;
  });
  res.json({ ok, skip, skipCodes, state: repo.getState() });
});
app.patch('/api/schedule/:id', (req, res) => {
  const { field, value } = req.body;
  if (field !== 'male' && field !== 'female') return res.status(400).json({ error: 'invalid field' });
  repo.updateScheduleCount(req.params.id, field, value === null ? null : Number(value));
  res.json(repo.getState());
});
app.delete('/api/schedule/:id', (req, res) => {
  repo.deleteScheduleItem(req.params.id);
  res.json(repo.getState());
});

const PORT = process.env.PORT || 3210;
app.listen(PORT, () => console.log(`เครื่องมือวางแผนที่พักภาคสนาม รันที่ http://localhost:${PORT}`));
