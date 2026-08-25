const db = require('./db');

// --- mapping helpers: DB rows <-> the short-key shape the frontend uses (matches the
// confirmed mockup: branches={c,n,d,pv,la,lo}, hotels={n,pr,d,pv,la,lo}) ---

function branchToApi(r) {
  return { c: r.code, n: r.name, d: r.district || '', pv: r.province || '', la: r.lat, lo: r.lng, status: r.status || null };
}
function hotelToApi(r) {
  return { n: r.name, pr: r.price || 0, d: r.district || '', pv: r.province || '', la: r.lat, lo: r.lng };
}
function employeeToApi(r) {
  return {
    id: r.id, code: r.code || null, name: r.name, team: r.team || '', nickname: r.nickname || null,
    gender: r.gender || null, area_incharge: r.area_incharge || null, phone: r.phone || null,
    home_la: r.home_lat, home_lo: r.home_lng,
  };
}
function scheduleToApi(r) {
  return {
    id: r.id, team: r.team, branches: JSON.parse(r.branches),
    work_start: r.work_start, work_end: r.work_end, stay_start: r.stay_start, stay_end: r.stay_end,
    male: r.male, female: r.female, job_type: r.job_type || null, needs_burmese: !!r.needs_burmese,
  };
}

function getState() {
  return {
    branches: db.prepare('SELECT * FROM branches').all().map(branchToApi),
    hotels: db.prepare('SELECT * FROM hotels').all().map(hotelToApi),
    employees: db.prepare('SELECT * FROM employees').all().map(employeeToApi),
    schedule: db.prepare('SELECT * FROM schedule_items ORDER BY created_at').all().map(scheduleToApi),
  };
}

function replaceBranches(list) {
  const insert = db.prepare('INSERT INTO branches (code,name,district,province,lat,lng,status) VALUES (?,?,?,?,?,?,?)');
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM branches').run();
    list.forEach(b => insert.run(b.c, b.n, b.d || '', b.pv || '', b.la, b.lo, b.status || null));
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
}
function addBranch(b) {
  db.prepare('INSERT OR REPLACE INTO branches (code,name,district,province,lat,lng,status) VALUES (?,?,?,?,?,?,?)')
    .run(b.c, b.n, b.d || '', b.pv || '', b.la, b.lo, b.status || null);
}

function replaceHotels(list) {
  const insert = db.prepare('INSERT INTO hotels (name,price,district,province,lat,lng) VALUES (?,?,?,?,?,?)');
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM hotels').run();
    list.forEach(h => insert.run(h.n, h.pr || 0, h.d || '', h.pv || '', h.la, h.lo));
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
}
function addHotel(h) {
  db.prepare('INSERT INTO hotels (name,price,district,province,lat,lng) VALUES (?,?,?,?,?,?)')
    .run(h.n, h.pr || 0, h.d || '', h.pv || '', h.la, h.lo);
}

function replaceEmployees(list) {
  const insert = db.prepare('INSERT INTO employees (code,name,team,nickname,gender,area_incharge,phone,home_lat,home_lng) VALUES (?,?,?,?,?,?,?,?,?)');
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM employees').run();
    list.forEach(e => insert.run(e.code || null, e.name, e.team || '', e.nickname || null, e.gender || null, e.area_incharge || null, e.phone || null, e.home_la ?? null, e.home_lo ?? null));
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
}
function addEmployee(e) {
  db.prepare('INSERT INTO employees (code,name,team,nickname,gender,area_incharge,phone,home_lat,home_lng) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(e.code || null, e.name, e.team || '', e.nickname || null, e.gender || null, e.area_incharge || null, e.phone || null, e.home_la ?? null, e.home_lo ?? null);
}

function addScheduleItem(s) {
  db.prepare(`INSERT INTO schedule_items (id,team,branches,work_start,work_end,stay_start,stay_end,male,female,job_type,needs_burmese)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(s.id, s.team, JSON.stringify(s.branches), s.work_start, s.work_end, s.stay_start, s.stay_end,
      s.male ?? null, s.female ?? null, s.job_type || null, s.needs_burmese ? 1 : 0);
}
function updateScheduleCount(id, field, value) {
  if (field !== 'male' && field !== 'female') throw new Error('invalid field');
  db.prepare(`UPDATE schedule_items SET ${field} = ? WHERE id = ?`).run(value, id);
}
function deleteScheduleItem(id) {
  db.prepare('DELETE FROM schedule_items WHERE id = ?').run(id);
}

module.exports = {
  getState,
  replaceBranches, addBranch,
  replaceHotels, addHotel,
  replaceEmployees, addEmployee,
  addScheduleItem, updateScheduleCount, deleteScheduleItem,
};
