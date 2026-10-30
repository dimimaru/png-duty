# PNG Duty PWA v0.1 — คู่มือติดตั้งจริง

นี่คือ **Static PWA จริง** (HTML + CSS + JavaScript แบบ ES Modules) ซึ่งเป็นแอปอ่านอย่างเดียว ไม่มี Backend, Cloudflare, D1, SQL, Login หรือขั้นตอน Build/NPM สำหรับการเผยแพร่

ข้อมูลต้นฉบับมี **ที่เดียว** คือ Google Sheets; IndexedDB ในมือถือมีหน้าที่เป็น **สำเนา Offline** เท่านั้น

## สิ่งที่ทำแล้ว

- หน้าเวรรวม: ER เช้า/บ่าย/ดึก และแผนกอื่นในเวลา/นอกเวลา (MED/SURG/OB-GYN/PED/PSY ฯลฯ)
- หน้า OPD: GP เช้า/บ่าย, Standby, กรอง Staff / Intern / ทั้งหมด (Intern เป็นทะเบียนตั้งต้น ยังต้องตรวจรายชื่อ)
- หน้ารายเดือน: เลือกเดือนและแผนก
- กรองแผนกและบันทึกค่าประจำเครื่อง
- เวลา 00:00–07:59: ER ดึกของวันก่อนอยู่ซ้าย, เช้าวันใหม่ตามมา; แผนกอื่นนอกเวลาเมื่อคืนอยู่ซ้าย ในเวลาวันใหม่อยู่ขวา
- เวลา 08:00: เริ่มรอบวันใหม่; สีเวรปัจจุบันสด เวรถัดไปอ่อน เวรที่ผ่านมาเทา
- ซิงก์เมื่อเปิดแอป/กลับเข้าแอป, ทุก ~5 นาทีระหว่างที่เปิดอยู่, ปุ่มรีเฟรช
- Offline: Service Worker เก็บไฟล์แอป และ IndexedDB เก็บตารางที่ซิงก์ล่าสุด
- หาก API ล้มเหลว จะยังคงใช้ข้อมูลที่ซิงก์ไว้ก่อนหน้า
- ป้าย **ซิงก์ล่าสุด** แสดงเฉพาะเวลาที่ API อ่านและบันทึกสำเร็จ ไม่ใช่เวลาจำลอง

## ข้อมูลต้นฉบับที่รองรับ

- `ALL เวร` — ดึงข้อมูลจาก A1:AO1100, วันอยู่คอลัมน์ A, ข้อมูลเริ่มแถว 5
- `All OPD GP` — ดึงข้อมูลจาก A1:P1100, วันอยู่คอลัมน์ B, ข้อมูลเริ่มแถว 2
- Mapping อยู่ใน `parser.js` ตรง `DUTY_MAP` และ `GP_MAP`
- ชีต OPD Staff ยังไม่เชื่อม เพราะยังไม่ได้รับตารางจริง
- **ข้อควรตรวจ**: ในไฟล์ต้นทางคอลัมน์จิตเวช AG/AH เป็น `A - Consult` และ `A - ER/รพช.` ซึ่งตั้งต้นไว้เป็นในเวลา แต่ต้องยืนยันกับผู้จัดเวรก่อนเปิดใช้งานจริง

## ขั้นตอน 1 — เตรียม Google Sheets

1. เปิดไฟล์ต้นฉบับใน Google Drive
2. **ยืนยันว่าเป็น Google Sheets แบบ Native** ไม่ใช่ .xlsx ที่กำลังเปิดผ่าน Google Sheets (ถ้าเป็น .xlsx ให้ใช้ File → Save as Google Sheets ก่อน)
3. ตรวจชื่อชีตให้ตรงกับ `ALL เวร` และ `All OPD GP` ทุกตัวอักษร
4. ตรวจว่าวันที่ในคอลัมน์ A และ B เป็นวันที่จริง และสูตรคืนค่าชื่อแพทย์ครบถ้วน
5. เมื่อตรวจแล้ว ให้กด **Share → General access → Anyone with the link → Viewer** (ตามนโยบายที่ได้รับอนุญาต)
6. จาก URL ตัวอย่าง `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit` คัดลอกข้อความที่อยู่ระหว่าง `/d/` กับ `/edit`

**คำเตือนความเป็นส่วนตัว**: หากเปิดไฟล์ Google Sheets เป็น Public ผู้ที่มีลิงก์อาจเข้าถึงข้อมูลและแท็บอื่นในไฟล์นั้นได้ด้วย รวมถึงข้อมูลที่แอปไม่แสดง ต้องได้รับอนุญาตจากโรงพยาบาลก่อน และตรวจทั้งไฟล์ว่าไม่มีข้อมูลผู้ป่วย ข้อมูลบุคคล หรือข้อมูลภายในที่ไม่ควรเผยแพร่ หากไม่อนุญาตให้เปิดชีตต้นฉบับ Public จะต้องเปลี่ยนสถาปัตยกรรมให้มีตัวกลางอ่านข้อมูลที่ไม่เปิดเผยชีต

## ขั้นตอน 2 — เปิด Google Sheets API และสร้าง API Key

1. ไปที่ https://console.cloud.google.com/
2. Create Project เช่น `PNG-Duty-PWA`
3. เลือก APIs & Services → Library → Google Sheets API → Enable
4. เลือก APIs & Services → Credentials → Create credentials → API key
5. คลิก API Key ที่สร้าง แล้วตั้ง **API restrictions → Restrict key → Google Sheets API**
6. ตั้ง **Application restrictions → Websites**
7. หลังทราบ URL จาก GitHub Pages ในขั้นตอนที่ 3 ให้เพิ่มเว็บไซต์ที่อนุญาต เช่น `https://USERNAME.github.io` และ `https://USERNAME.github.io/*` หรือโดเมนจริงของคุณ
8. Save และรอการเปลี่ยนแปลงมีผลก่อนทดสอบ

**API Key ฝั่ง Browser มองเห็นได้ตามปกติ ไม่ใช่ Secret** ห้ามใช้ Service Account Private Key หรือ OAuth Client Secret ใน PWA โดยเด็ดขาด ต้อง Restrict API Key ตามข้อ 5–7 และตรวจการใช้งานจริง

## ขั้นตอน 3 — เผยแพร่แบบไม่มี Build ผ่าน GitHub Pages

1. สร้าง Repository ใหม่ใน https://github.com/ ตั้งชื่อ `png-duty` เลือก Public (สำหรับ GitHub Free)
2. แตก ZIP นี้ แล้วอัปโหลด **ไฟล์ทั้งหมดที่อยู่ในโฟลเดอร์ `png-duty-pwa`** ไปไว้ที่รากของ Repo (ไม่ใช่โฟลเดอร์ซ้อนอีกชั้น) ได้แก่ `index.html`, `app.js`, `parser.js`, `sw.js`, `assets/` ฯลฯ
3. เข้า Repo → Settings → Pages
4. ใน Build and deployment เลือก Source = **Deploy from a branch**
5. Branch = **main**, Folder = **/(root)** แล้วกด Save
6. รอให้ GitHub Pages ทำงาน แล้วเปิด `https://USERNAME.github.io/png-duty/`
7. จะเห็นโหมดสาธิตก่อนเชื่อมจริง นี่เป็นพฤติกรรมปกติ

**ไม่ต้อง `npm install` และไม่ต้อง `npm run build`** สำหรับเวอร์ชันนี้ `package.json` มีไว้สำหรับเรียกชุดทดสอบเท่านั้น

## ขั้นตอน 4 — เปิด Live Sync ให้ทุกคนใช้งานทันที

1. กลับไป Repo และเปิดไฟล์ `config.js`
2. แก้เป็น:

```js
export const DEFAULT_CONFIG = {
  spreadsheetId: 'SPREADSHEET_ID_จริง',
  apiKey: 'API_KEY_จริง'
};
```

3. Commit changes แล้วรอ GitHub Pages เผยแพร่เวอร์ชันใหม่
4. เปิดเว็บผ่าน Safari/Chrome (ให้เชื่อมอินเทอร์เน็ต) และกดปุ่มวงลูกศรด้านบนเพื่อซิงก์
5. ถ้าดึงข้อมูลสำเร็จ ป้าย `โหมดสาธิต` จะหายไปและเวลา `ซิงก์ล่าสุด` จะแสดงเวลาจริง
6. เมื่อ Google Sheets เปลี่ยน แอปจะโหลดใหม่เมื่อเปิดหรือทุก ~5 นาที **ขณะเปิดใช้งาน** ไม่ใช่ Real-time Push หรือรับประกันการ Sync เมื่อปิดแอป
7. หากขึ้น 403 ตรวจว่าแชร์ชีตเป็น Public, เปิด Sheets API, API Key จำกัด referrer ถูกโดเมน และ Key ยังใช้งานได้; หาก 404 ให้ตรวจ Spreadsheet ID และต้องเป็น Google Sheets แบบ Native

**หมายเหตุ**: ในหน้า Settings ที่มีให้ไว้สำหรับการทดสอบ หากผู้ใช้กรอกเองจะบันทึกค่าสำหรับเครื่องนั้น และอาจแทนการตั้งค่าใน `config.js` ได้ เมื่อเผยแพร่จริงให้ตั้ง `config.js` เป็นหลัก ไม่จำเป็นต้องให้ผู้ใช้เข้า Settings

## ขั้นตอน 5 — ติดตั้ง iPhone / Android

### iPhone
1. เปิด URL GitHub Pages ด้วย Safari
2. กด **Share** (ไอคอนแชร์)
3. เลือก **Add to Home Screen / เพิ่มไปยังหน้าจอโฮม** แล้วกด Add
4. เปิดผ่านไอคอน PNG Duty
5. ทดลองเชื่อมเน็ตและซิงก์สำเร็จก่อน จากนั้นเปิด Airplane Mode แล้วเปิดแอปอีกครั้งเพื่อทดสอบ Offline

### Android
1. เปิด URL GitHub Pages ด้วย Chrome
2. เปิดเมนู ⋮ → **Install app** หรือ **Add to Home screen**
3. ยืนยันการเพิ่มไอคอน
4. ทดลอง Offline เช่นเดียวกับ iPhone

Offline จะใช้ได้หลังเคยเปิดแอปผ่าน HTTPS และดาวน์โหลดไฟล์/ข้อมูลสำเร็จแล้ว ระบบปฏิบัติการอาจลบ Cache เมื่อพื้นที่ไม่เพียงพอ จึงต้องกลับมาออนไลน์เพื่อ Sync ใหม่เป็นระยะ

## ขั้นตอน 6 — ทดสอบความถูกต้องก่อนเปิด Public จริง

- วันที่ 30–31 ต.ค. 2569 และ 4 พ.ย. 2569 เทียบชื่อกับ Google Sheets แถวจริง
- MED ในเวลา/นอกเวลา, OB-GYN แยก OB/Gyne, PSY แยกเด็กและผู้ใหญ่ ต้องตรวจ Mapping ให้ตรงหน้าที่จริง
- ชื่อหลายคนที่คั่น `/` ต้องแสดงได้หลายชื่อ
- ตรวจเวลา 15:59 → 16:00, 22:59 → 23:00, 23:59 → 00:00 และ 07:59 → 08:00
- เมื่อเลือกวันย้อนหลังด้วย Date Picker ต้องไม่ดึงข้อมูลข้ามวันแบบโหมด Auto
- ลองไม่มีเน็ต ตรวจว่าเปิดแอปและอ่านเวรจาก IndexedDB ได้
- ตรวจว่าเวลาซิงก์ล่าสุดเปลี่ยนเฉพาะเมื่อซิงก์สำเร็จ

## วิธีแก้ไข/บำรุงรักษา

- `config.js`: เชื่อม Spreadsheet ID และ API Key
- `parser.js`: Mapping ตาราง, ตำแหน่งย่อย, รายชื่อ Intern ตั้งต้น
- `schedule.js`: รอบเวลา 08:00/16:00/23:00/00:00 และการข้ามวัน
- `app.js`: หน้าจอ, ตัวกรอง, Sync, Offline
- `style.css`: ความกว้าง ฟอนต์ สี ระยะห่าง
- `sw.js`: Cache แอป
- `tests/parser.test.mjs`: ชุดทดสอบ ใช้ `npm test` ได้ถ้ามี Node.js

### ขอบเขตที่ยังไม่ทำ

- ยังไม่ได้เชื่อม Google Sheets จริง (ไม่มี API Key และการเปิด Public จากผู้ใช้)
- ยังไม่ได้เพิ่มชีต OPD Staff และทะเบียนแพทย์ Staff แบบครบถ้วน
- Mapping จิตเวช AG/AH และการจำแนก Staff/Intern ต้องยืนยัน
- ไม่มีระบบแจ้งเตือน Push, Login, แก้/แลกเวร, ประวัติแก้ไข หรือ Database บน Server

---

เอกสาร Google อย่างเป็นทางการ:
- https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchGet
- https://docs.cloud.google.com/docs/authentication/api-keys
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
