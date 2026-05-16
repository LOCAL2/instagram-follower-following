# Instagram Follower Tracker

ตรวจสอบว่าใครไม่ได้ follow กลับบน Instagram

## ⚠️ ข้อจำกัด CORS

Instagram API ต้องการ cookie จากการ login และอนุญาตให้เรียกได้จาก `www.instagram.com` เท่านั้น  
ดังนั้นจึงมี **2 วิธีใช้งาน**:

---

## วิธีที่ 1: Bookmarklet (แนะนำ — ใช้ได้ทันที)

วิธีนี้ inject UI panel เข้าไปใน Instagram โดยตรง ไม่ต้อง deploy อะไรเพิ่ม

### สร้าง Bookmarklet

```bash
node bookmarklet/generate.mjs
```

Copy ข้อความที่ขึ้นต้นด้วย `javascript:` แล้วสร้าง bookmark ใหม่ในเบราว์เซอร์ โดยวาง URL เป็นข้อความนั้น

### วิธีใช้

1. Login Instagram ที่ `https://www.instagram.com`
2. คลิก bookmark ที่สร้างไว้ — panel จะเด้งขึ้นมาด้านขวา
3. กรอก username แล้วกด **ตรวจสอบ**

---

## วิธีที่ 2: React App (สำหรับ dev / ทดสอบ)

ใช้ Vite proxy เพื่อ forward request ไปยัง Instagram  
**หมายเหตุ:** cookie ของ Instagram จะไม่ถูกส่งผ่าน proxy ดังนั้นผลลัพธ์อาจไม่ครบถ้วน

```bash
npm install
npm run dev
```

เปิด `http://localhost:5173`

---

## ฟีเจอร์

- แสดงรายชื่อคนที่ **ไม่ follow กลับ** (คุณ follow แต่เขาไม่ follow คุณ)
- แสดงรายชื่อคนที่ **คุณไม่ได้ follow กลับ** (เขา follow คุณแต่คุณไม่ follow เขา)
- รองรับ pagination อัตโนมัติ (account ที่มี follower เยอะ)
- Responsive ทั้ง PC และ mobile
- Dark mode อัตโนมัติ
- ข้อมูลทั้งหมดประมวลผลในเบราว์เซอร์ ไม่มีการส่งข้อมูลออกไปภายนอก
