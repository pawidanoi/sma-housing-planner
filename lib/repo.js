const { pool, SCHEMA } = require('./db');

const T = {
  branches: `${SCHEMA}.branches`,
  hotels: `${SCHEMA}.hotels`,
  employees: `${SCHEMA}.employees`,
  schedule: `${SCHEMA}.schedule_items`,
};

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
    id: r.id, team: r.team, branches: r.branches,
    work_start: r.work_start, work_end: r.work_end, stay_start: r.stay_start, stay_end: r.stay_end,
    male: r.male, female: r.female, job_type: r.job_type || null, needs_burmese: !!r.needs_burmese,
  };
}

async function getState() {
  const [branches, hotels, employees, schedule] = await Promise.all([
    pool.query(`SELECT * FROM ${T.branches} ORDER BY code`),
    pool.query(`SELECT * FROM ${T.hotels} ORDER BY id`),
    pool.query(`SELECT * FROM ${T.employees} ORDER BY id`),
    pool.query(`SELECT * FROM ${T.schedule} ORDER BY created_at`),
  ]);
  return {
    branches: branches.rows.map(branchToApi),
    hotels: hotels.rows.map(hotelToApi),
    employees: employees.rows.map(employeeToApi),
    schedule: schedule.rows.map(scheduleToApi),
  };
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function replaceBranches(list) {
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM ${T.branches}`);
    for (const b of list) {
      await client.query(
        `INSERT INTO ${T.branches} (code,name,district,province,lat,lng,status) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [b.c, b.n, b.d || '', b.pv || '', b.la, b.lo, b.status || null]
      );
    }
  });
}
async function addBranch(b) {
  await pool.query(
    `INSERT INTO ${T.branches} (code,name,district,province,lat,lng,status) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (code) DO UPDATE SET name=$2, district=$3, province=$4, lat=$5, lng=$6, status=$7`,
    [b.c, b.n, b.d || '', b.pv || '', b.la, b.lo, b.status || null]
  );
}

async function replaceHotels(list) {
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM ${T.hotels}`);
    for (const h of list) {
      await client.query(
        `INSERT INTO ${T.hotels} (name,price,district,province,lat,lng) VALUES ($1,$2,$3,$4,$5,$6)`,
        [h.n, h.pr || 0, h.d || '', h.pv || '', h.la, h.lo]
      );
    }
  });
}
async function addHotel(h) {
  await pool.query(
    `INSERT INTO ${T.hotels} (name,price,district,province,lat,lng) VALUES ($1,$2,$3,$4,$5,$6)`,
    [h.n, h.pr || 0, h.d || '', h.pv || '', h.la, h.lo]
  );
}

async function replaceEmployees(list) {
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM ${T.employees}`);
    for (const e of list) {
      await client.query(
        `INSERT INTO ${T.employees} (code,name,team,nickname,gender,area_incharge,phone,home_lat,home_lng) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [e.code || null, e.name, e.team || '', e.nickname || null, e.gender || null, e.area_incharge || null, e.phone || null, e.home_la ?? null, e.home_lo ?? null]
      );
    }
  });
}
async function addEmployee(e) {
  await pool.query(
    `INSERT INTO ${T.employees} (code,name,team,nickname,gender,area_incharge,phone,home_lat,home_lng) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [e.code || null, e.name, e.team || '', e.nickname || null, e.gender || null, e.area_incharge || null, e.phone || null, e.home_la ?? null, e.home_lo ?? null]
  );
}

async function addScheduleItem(s) {
  await pool.query(
    `INSERT INTO ${T.schedule} (id,team,branches,work_start,work_end,stay_start,stay_end,male,female,job_type,needs_burmese)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [s.id, s.team, JSON.stringify(s.branches), s.work_start, s.work_end, s.stay_start, s.stay_end,
      s.male ?? null, s.female ?? null, s.job_type || null, !!s.needs_burmese]
  );
}
async function updateScheduleCount(id, field, value) {
  if (field !== 'male' && field !== 'female') throw new Error('invalid field');
  await pool.query(`UPDATE ${T.schedule} SET ${field} = $1 WHERE id = $2`, [value, id]);
}
async function deleteScheduleItem(id) {
  await pool.query(`DELETE FROM ${T.schedule} WHERE id = $1`, [id]);
}

async function branchCodeSet() {
  const res = await pool.query(`SELECT code FROM ${T.branches}`);
  return new Set(res.rows.map(r => r.code));
}

module.exports = {
  getState,
  replaceBranches, addBranch,
  replaceHotels, addHotel,
  replaceEmployees, addEmployee,
  addScheduleItem, updateScheduleCount, deleteScheduleItem,
  branchCodeSet,
};
