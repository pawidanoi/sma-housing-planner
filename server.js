const path = require('path');
const express = require('express');
const repo = require('./lib/repo');
const { runSeedIfEmpty } = require('./seed/run-seed');

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/state', async (req, res, next) => {
  try { res.json(await repo.getState()); } catch (err) { next(err); }
});

// ---- branches ----
app.post('/api/branches/replace', async (req, res, next) => {
  try {
    const list = req.body.branches;
    if (!Array.isArray(list)) return res.status(400).json({ error: 'branches must be an array' });
    await repo.replaceBranches(list);
    res.json(await repo.getState());
  } catch (err) { next(err); }
});
app.post('/api/branches/add', async (req, res, next) => {
  try {
    const b = req.body.branch;
    if (!b || !b.c || !b.n || typeof b.la !== 'number' || typeof b.lo !== 'number') {
      return res.status(400).json({ error: 'ต้องมีรหัสสาขา/ชื่อ/ละติจูด/ลองจิจูด' });
    }
    await repo.addBranch(b);
    res.json(await repo.getState());
  } catch (err) { next(err); }
});

// ---- hotels ----
app.post('/api/hotels/replace', async (req, res, next) => {
  try {
    const list = req.body.hotels;
    if (!Array.isArray(list)) return res.status(400).json({ error: 'hotels must be an array' });
    await repo.replaceHotels(list);
    res.json(await repo.getState());
  } catch (err) { next(err); }
});
app.post('/api/hotels/add', async (req, res, next) => {
  try {
    const h = req.body.hotel;
    if (!h || !h.n || typeof h.la !== 'number' || typeof h.lo !== 'number') {
      return res.status(400).json({ error: 'ต้องมีชื่อ/ละติจูด/ลองจิจูด' });
    }
    await repo.addHotel(h);
    res.json(await repo.getState());
  } catch (err) { next(err); }
});

// ---- employees ----
app.post('/api/employees/replace', async (req, res, next) => {
  try {
    const list = req.body.employees;
    if (!Array.isArray(list)) return res.status(400).json({ error: 'employees must be an array' });
    await repo.replaceEmployees(list);
    res.json(await repo.getState());
  } catch (err) { next(err); }
});
app.post('/api/employees/add', async (req, res, next) => {
  try {
    const e = req.body.employee;
    if (!e || !e.name) return res.status(400).json({ error: 'ต้องมีชื่อพนักงาน' });
    await repo.addEmployee(e);
    res.json(await repo.getState());
  } catch (err) { next(err); }
});

// ---- schedule ----
app.post('/api/schedule/bulk', async (req, res, next) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
    const known = await repo.branchCodeSet();
    let ok = 0, skip = 0;
    const skipCodes = [];
    for (const item of items) {
      const codes = Array.isArray(item.branches) ? item.branches : [];
      const validCodes = codes.filter(c => known.has(c));
      if (validCodes.length === 0 || !item.team || !item.work_start || !item.work_end) {
        skip++; skipCodes.push((codes[0] || '(ไม่มีรหัส)') + ' (ไม่พบในทะเบียนสาขา หรือข้อมูลไม่ครบ)');
        continue;
      }
      await repo.addScheduleItem({
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
    }
    res.json({ ok, skip, skipCodes, state: await repo.getState() });
  } catch (err) { next(err); }
});
app.patch('/api/schedule/:id', async (req, res, next) => {
  try {
    const { field, value } = req.body;
    if (field !== 'male' && field !== 'female') return res.status(400).json({ error: 'invalid field' });
    await repo.updateScheduleCount(req.params.id, field, value === null ? null : Number(value));
    res.json(await repo.getState());
  } catch (err) { next(err); }
});
app.delete('/api/schedule/:id', async (req, res, next) => {
  try {
    await repo.deleteScheduleItem(req.params.id);
    res.json(await repo.getState());
  } catch (err) { next(err); }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'internal error' });
});

const PORT = process.env.PORT || 3210;
runSeedIfEmpty()
  .then(() => {
    app.listen(PORT, () => console.log(`เครื่องมือวางแผนที่พักภาคสนาม รันที่ http://localhost:${PORT}`));
  })
  .catch(err => { console.error('Seed/startup failed:', err); process.exit(1); });
