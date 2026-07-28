/**
 * Variance against REAL MySQL, not SQLite.
 *
 * The unit tests pass on SQLite, which hands back DECIMAL as numbers. MySQL
 * returns them as STRINGS — precisely the difference that made the BOM roll-up
 * concatenate instead of add. So the four behaviours are re-checked here on UAT:
 * material actuals, labor actuals, a non-zero result, and dateFrom/dateTo
 * actually narrowing the list.
 */
import { chromium } from '@playwright/test';
const BASE='https://herbal-erp-test-uat.bmscloud.in.th';
const WO = Number(process.argv[2] || 26);

const b=await chromium.launch();
const p=await (await b.newContext()).newPage();
await p.request.post(`${BASE}/api/auth/login`,{data:{email:'admin@herbal-erp.com',password:'admin123'}});

const calc=await p.request.post(`${BASE}/api/accounting/variances/calculate`,{
  headers:{'Content-Type':'application/json'}, data:{workOrderId:WO}
});
console.log('calculate status:', calc.status());
const body=await calc.text();
console.log('calculate body:', body.slice(0,700));

const list=await p.request.get(`${BASE}/api/accounting/variances?workOrderId=${WO}&limit=50`);
const lj=await list.json().catch(()=>null);
const rows=lj?.data?.data||lj?.data||[];
console.log('\nrows for WO', WO, ':', Array.isArray(rows)?rows.length:'?');
for(const r of (Array.isArray(rows)?rows:[]).slice(0,6)){
  console.log(`  ${r.varianceType}: std=${r.standardValue} act=${r.actualValue} var=${r.varianceAmount} favorable=${r.isFavorable}`);
}
const nz=(Array.isArray(rows)?rows:[]).filter(r=>Number(r.varianceAmount)!==0);
console.log('non-zero variances:', nz.length, nz.length? '-> NOT the all-zero stub':'-> all zero');

// A concatenated DECIMAL would show up as an implausibly long digit string.
const bad=(Array.isArray(rows)?rows:[]).filter(r=>String(r.varianceAmount).replace(/[-.]/g,'').length>12);
console.log('concatenated-looking values:', bad.length?JSON.stringify(bad.slice(0,2)):'none');

// The date filter must genuinely narrow the result set.
const q=async(u)=>{const r=await p.request.get(`${BASE}${u}`);const j=await r.json().catch(()=>null);
  return j?.data?.total ?? (Array.isArray(j?.data)?j.data.length:null);};
const past=await q('/api/accounting/variances?dateFrom=2000-01-01&dateTo=2000-01-02&limit=100');
const wide=await q('/api/accounting/variances?dateFrom=2000-01-01&dateTo=2099-12-31&limit=100');
console.log('\ndate filter — 2000 window:', past, '| wide window:', wide);
console.log('filter applied:', (past===0 && wide>0) ? 'YES' : 'NO / inconclusive');

await b.close();
