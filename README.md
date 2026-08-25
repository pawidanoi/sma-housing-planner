# เครื่องมือวางแผนที่พักภาคสนาม SMA (สำหรับ AREA)

เครื่องมือคำนวณ/แดชบอร์ดช่วยตัดสินใจ **ไม่มีขั้นจอง/อนุมัติในระบบ** — ดูรายละเอียดสเปกฉบับเต็มใน
`HANDOFF-เครื่องมือวางแผนที่พักภาคสนาม.md` (แนบมาพร้อมโปรเจกต์นี้)

หน้าตา/พฤติกรรมยึดตาม `reference-mockup.html` ที่ผู้ใช้อนุมัติแล้วทุกประการ — ระบบนี้ต่างจาก mockup
ตรงที่มี **backend + ฐานข้อมูลจริง** แทนการเก็บข้อมูลใน memory ของเบราว์เซอร์ (รีเฟรชหน้าเว็บแล้วข้อมูล
หายเหมือน mockup เดิม) ทุกคนที่เปิดลิงก์เดียวกันเห็นข้อมูลชุดเดียวกัน

## สถาปัตยกรรม

- **Node.js + Express** เสิร์ฟทั้ง REST API (`/api/*`) และหน้าเว็บ (`public/`) จากโปรเซสเดียว
- **Postgres ผ่าน Supabase** (library `pg`) — ใช้ **project Supabase เดิมของระบบจองที่พัก** ที่ปิดไปแล้ว
  (แชร์บัญชี/โปรเจกต์เดียวกันเพราะแพลนฟรีจำกัดจำนวนโปรเจกต์) แต่ตารางทั้งหมดของระบบนี้อยู่ใน **Postgres
  schema แยกต่างหากชื่อ `housing_planner`** (ไม่ใช่ `public` ที่ระบบเดิมใช้) เพื่อไม่ให้ชื่อตาราง
  (`branches`/`hotels`/`employees`) ชนหรือปนกับข้อมูลเก่า — ดู `lib/db.js` (ค่าคงที่ `SCHEMA`)
- เชื่อมต่อผ่าน **Supabase connection pooler** (`*.pooler.supabase.com:6543`) ไม่ใช่ direct connection
  (`db.*.supabase.co:5432`) เพราะ hostname ตรงนั้นเป็น IPv6-only ในโปรเจกต์ใหม่ๆ ของ Supabase ซึ่งหลาย
  เครือข่าย/host (รวมถึงเครื่องที่ใช้พัฒนาโปรเจกต์นี้) ต่อผ่าน IPv6 ไม่ได้
- ตั้งใจ **ไม่ใช้ Vercel serverless functions** — โปรเจกต์เดิม (`sma-booking-backend`) เจอปัญหา Hobby
  plan จำกัด 12 functions ต่อ deployment มาก่อน (ดู HANDOFF §9) ระบบนี้เป็น Node process เดียวรันทั้งวัน
  จึงไม่ติดข้อจำกัดนั้นเลย — ต้อง deploy บน host ที่รัน persistent process ได้ (ดูหัวข้อ deploy ด้านล่าง)
  ข้อดีอีกอย่างของการใช้ Postgres ภายนอกคือ **ใช้ได้กับ Render free tier** ด้วย เพราะข้อมูลไม่ได้อยู่ใน
  disk ของ web service เอง (free tier ของ Render ไม่รองรับ persistent disk)
- ไม่มีระบบ login — ตรงตาม HANDOFF §3 (ผู้ใช้ไม่เคยขอ auth ตัดสินใจไว้แล้วว่าไม่ทำ auth scoping)

## รันเครื่อง local

ต้องมีไฟล์ `.env` (ไม่ commit เข้า git — กันไว้ใน `.gitignore` แล้ว) ที่มีบรรทัด:

```
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

เอาค่านี้จาก Supabase dashboard → ปุ่ม **Connect** → เลือกโหมด **Transaction pooler** (ไม่ใช่ direct
connection ธรรมดา ด้วยเหตุผลข้างบน)

```bash
npm install
npm run seed      # ครั้งแรกเท่านั้น — สร้าง schema/ตาราง + import ข้อมูลจาก seed/*.csv (รันซ้ำได้ปลอดภัย ข้ามถ้ามีข้อมูลอยู่แล้ว)
npm run dev
```

(`npm run dev` โหลด `.env` ให้อัตโนมัติผ่าน Node's `--env-file` — บน Render/production ใช้ `npm start`
ธรรมดาแทน เพราะ `DATABASE_URL` จะถูกตั้งเป็น environment variable จริงโดย platform ไม่ต้องพึ่งไฟล์ `.env`)

เปิด http://localhost:3210 — ตั้ง `PORT` ผ่าน environment variable ได้ถ้าต้องการเปลี่ยนพอร์ต

## Deploy จริง (Render)

เพราะฐานข้อมูลอยู่ที่ Supabase (ภายนอก) ไม่ใช่ไฟล์ในเครื่อง Render จึงใช้ **free tier ธรรมดาได้เลย** ไม่
ต้องเสียเงินซื้อ persistent disk:

1. Push โค้ดนี้ขึ้น GitHub repo (ทำแล้วที่ `github.com/pawidanoy/sma-housing-planner`)
2. สร้าง **Web Service** ใหม่ใน Render ผูกกับ repo นี้
   - Build command: `npm install`
   - Start command: `node server.js`
3. เพิ่ม environment variable **`DATABASE_URL`** เป็นค่าเดียวกับใน `.env` local (ไปตั้งใน Render
   dashboard → service นี้ → Environment)
4. Deploy — ครั้งแรกจะ seed ข้อมูลอัตโนมัติเพราะ `server.js` เรียก `runSeedIfEmpty()` ก่อน listen
   (เหมือน local)
5. **ข้อควรรู้ของ Render free tier:** เว็บจะ "หลับ" หลังไม่มีคนใช้ ~15 นาที พอมีคนเข้าใหม่จะใช้เวลา
   ปลุกขึ้นมาสัก 30-60 วินาที (ไม่กระทบข้อมูล เพราะข้อมูลอยู่ที่ Supabase ไม่ใช่ในตัว service)

## ข้อมูลตั้งต้น (seed)

ไฟล์ `seed/*.csv` มาจากทะเบียนจริงที่แนบมากับ HANDOFF (230 สาขา, 207 ที่พัก, 114 พนักงาน) — `npm run
seed` จะ import เฉพาะตอนตาราง `housing_planner.branches` ว่างเปล่าเท่านั้น ไม่ทับข้อมูลจริงที่มีอยู่แล้ว
ถ้าต้องการล้างแล้วเริ่มใหม่ ต้องลบข้อมูลใน schema `housing_planner` เองผ่าน Supabase SQL Editor
(**ห้ามรันคำสั่งลบกับ schema `public`** เพราะเป็นข้อมูลของระบบจองที่พักเดิม)

## ช่องว่างที่ยังไม่ปิด (สืบทอดจาก HANDOFF §10 + ที่เพิ่มระหว่างสร้างระบบจริง)

1. **ทะเบียนสาขาอาจไม่ครบ 100%** — ตอน seed มี 230 แห่ง แต่เคยมีบันทึกว่ามี 245 สาขาจริง ถ้าอัพโหลด
   แผนงานแล้วเจอรหัสสาขาที่ระบบไม่รู้จัก จะข้ามแถวนั้นและแจ้งรหัสที่หาไม่เจอ (ไม่ fail เงียบ) — แก้ได้
   โดยอัพโหลดทะเบียนสาขาฉบับสมบูรณ์กว่าผ่าน "ทะเบียนข้อมูลอ้างอิง" ในแท็บภาพรวม
2. **พนักงาน 53/114 คนยังไม่มีพิกัดบ้าน** — เครื่องมือ "บ้านใกล้สาขา" ข้ามคนกลุ่มนี้ (โชว์ "ไม่มีพิกัดบ้าน"
   ไม่ใช่เดาค่า) ต้องเก็บพิกัดเพิ่มแล้วอัพโหลดทะเบียนพนักงานใหม่
3. **อ่านได้แค่ sheet แรกของไฟล์ Excel เสมอ** (`wb.SheetNames[0]`) — ถ้าไฟล์มีหลาย sheet ต้องแยกเป็นไฟล์
   เดียวต่อ sheet ก่อนอัพโหลด
4. **ไม่มี field-level validation ละเอียด** (เบอร์โทรผิดรูปแบบ, ชื่อซ้ำ ฯลฯ) — เช็คแค่ฟิลด์จำเป็นครบ/
   พิกัดเป็นตัวเลขไหม
5. **Multi-user sync เป็นแบบ manual refresh** ไม่ใช่ real-time — ทุกคนแก้ข้อมูลชุดเดียวกันในฐานข้อมูล
   กลางเสมอ แต่ต้องกด "🔄 รีเฟรชข้อมูลล่าสุด" เพื่อดึงการเปลี่ยนแปลงจากคนอื่นเข้ามาที่หน้าจอตัวเอง
6. **ไม่มี auth** — ใครมีลิงก์แก้ข้อมูลได้หมด (ตรงตามที่ตัดสินใจไว้ใน HANDOFF §3) ถ้าต้องการจำกัดสิทธิ์
   ในอนาคตต้องคุยเพิ่มว่าจะทำระดับไหน
