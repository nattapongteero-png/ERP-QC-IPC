/**
 * Click the "รวมต้นทุนจาก BOM" button for real and read the toast.
 *
 * The API test proves the endpoint works; it cannot prove the BUTTON is wired
 * to it, is clickable, or that the user is told what happened. Chrome-engine
 * click + toast text is the only way to know.
 */
import { chromium } from '@playwright/test';
const BASE='https://herbal-erp-test-uat.bmscloud.in.th';
const lang=process.argv[2]||'th';
const b=await chromium.launch();
const c=await b.newContext({viewport:{width:1920,height:1000},locale:lang==='en'?'en-US':'th-TH'});
await c.addCookies([{name:'locale',value:lang,domain:'herbal-erp-test-uat.bmscloud.in.th',path:'/'}]);
const p=await c.newPage();
const problems=[];
p.on('console',m=>{if(m.type()==='error')problems.push('CONSOLE: '+m.text().slice(0,160));});
p.on('pageerror',e=>problems.push('JS ERROR: '+e.message.slice(0,160)));
let api=null;
p.on('response',async r=>{if(r.url().includes('/standard-costs/rollup')){let t='';try{t=(await r.text()).slice(0,300)}catch{}api={s:r.status(),t};}});

await p.request.post(`${BASE}/api/auth/login`,{data:{email:'admin@herbal-erp.com',password:'admin123'}});
await p.goto(`${BASE}/accounting/standard-costs`,{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(3000);

const btn=p.locator('[data-testid="rollup-btn"]');
console.log('rollup button found:', await btn.count());
const box=await btn.boundingBox();
console.log('button box:', JSON.stringify(box));
console.log('label:', JSON.stringify((await btn.innerText()).trim()));

try{ await btn.click({timeout:10000}); console.log('CLICKED ok'); }
catch(e){ console.log('NOT CLICKABLE:', String(e).split('\n')[0].slice(0,140)); }

await p.waitForTimeout(4000);
// DevExtreme notify() renders into .dx-toast-content
const toast=p.locator('.dx-toast-content, .dx-toast-message');
const tc=await toast.count();
console.log('toast shown:', tc>0 ? JSON.stringify((await toast.first().innerText()).trim()) : 'NONE');
await p.screenshot({path:`rollup-${lang}.png`, fullPage:false});
console.log('API called:', api? `${api.s} ${api.t}` : 'NO API CALL');
console.log(problems.length? 'problems:\n  '+[...new Set(problems)].slice(0,5).join('\n  ') : 'no console/JS errors');
await b.close();
