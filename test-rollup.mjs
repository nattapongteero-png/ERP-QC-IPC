import { chromium } from '@playwright/test';
const BASE='https://herbal-erp-test-uat.bmscloud.in.th';
const b=await chromium.launch();
const c=await b.newContext({viewport:{width:1920,height:1000},locale:'th-TH'});
const p=await c.newPage();
await p.request.post(`${BASE}/api/auth/login`,{data:{email:'admin@herbal-erp.com',password:'admin123'}});
const r=await p.request.post(`${BASE}/api/accounting/standard-costs/rollup`,{
  headers:{'Content-Type':'application/json'}, data:{}
});
console.log('STATUS:', r.status());
console.log('BODY:', (await r.text()).slice(0,900));
await b.close();
