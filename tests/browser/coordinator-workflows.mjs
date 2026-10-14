// Actual JSX; Supabase transport only is mocked. No real URL, users or file writes.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
const require=createRequire(import.meta.url),{chromium}=require(path.resolve('.client-review/node_modules/playwright'));
const output=path.resolve('.client-review/coordinator');await mkdir(output,{recursive:true});
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let server,browser;const passed=[],failed=[],errors=[];
try{
 server=await createServer({configFile:false,envFile:false,cacheDir:path.resolve('.client-review/node_modules/.vite-coordinator'),plugins:[{name:'isolated-coordinator',enforce:'pre',resolveId(source){if(/(?:^|\/)supabaseClient(?:\.js)?$/.test(source))return path.resolve('tests/browser/handover-client.js');}},react(),tailwind()],server:{host:'127.0.0.1',port:0}});await server.listen();
 const origin=server.resolvedUrls.local[0],executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
 const start=async(role)=>{await page.goto(`${origin}?role=${role}`);await page.getByRole('heading',{name:/Hi,/}).waitFor({timeout:30000});};
 const nav=name=>page.getByRole('button',{name,exact:true}).first().click();
 const region=()=>page.getByRole('region',{name:'Flexible submissions'});
 const type=()=>region().getByLabel('Document type',{exact:true});
 const files=()=>region().getByLabel('Files (required)');
 const submit=()=>region().getByRole('button',{name:'Submit complete file set',exact:true});
 const payload=[{name:'Evidence.pdf',mimeType:'application/pdf',buffer:Buffer.from('Synthetic PDF fixture')},{name:'Photo.png',mimeType:'image/png',buffer:Buffer.from('Synthetic PNG fixture')}];
 const run=async(name,task)=>{try{await task();passed.push(name);console.log(`PASS ${name}`);}catch(e){failed.push({name,error:e.message});console.log(`FAIL ${name}: ${e.message}`);}};
 await run('Actual requirement IDs, standard labels, distinct custom duplicates and clearance navigation',async()=>{
  await start('intern');
  await page.evaluate(()=>{for(const n of [911,912])window.__audit.state.documents.push({id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,intern_id:'00000000-0000-4000-8000-000000000101',name:'Portfolio',doc_type:`custom:${n}`,status:'Pending',upload_version:0,review_revision:0});window.__audit.save();});
  await nav('My Documents');await type().locator('option',{hasText:'Medical Certificate'}).waitFor({state:'attached'});
  assert.equal(await type().locator('option',{hasText:'Portfolio'}).count(),2);
  await type().selectOption(uid(300));assert.equal(await region().getByLabel('Document title',{exact:true}).count(),0);
  await region().getByRole('link',{name:'Go to clearance requirements'}).click();assert.equal(await page.locator('#intern-clearance-requirements').count(),1);
 });
 await run('Predefined name persists through complete file-set handler; clearance rows remain unchanged',async()=>{
  const before=await page.evaluate(()=>JSON.stringify(window.__audit.state.documents));
  await files().setInputFiles(payload);await submit().click();await page.getByRole('status').filter({hasText:'Complete file set submitted'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__audit.state.submissions[0].title),'MOA');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__audit.state.documents)),before);assert.equal(await type().inputValue(),'');
 });
 await run('Custom duplicate selected by UUID; partial upload failure retains type, description and files',async()=>{
  await type().selectOption(uid(912));await region().getByLabel('Description (optional)').fill('Draft remains on failure');await files().setInputFiles(payload);
  await page.evaluate(()=>sessionStorage.setItem('synthetic-partial-upload','true'));await submit().click();
  await region().getByRole('alert').filter({hasText:'second file failure'}).waitFor();
  assert.equal(await type().inputValue(),uid(912));assert.equal(await region().getByLabel('Description (optional)').inputValue(),'Draft remains on failure');assert.equal(await files().evaluate(e=>e.files.length),2);
  await page.evaluate(()=>sessionStorage.removeItem('synthetic-partial-upload'));await submit().click();await page.waitForFunction(()=>window.__audit.state.submissions.some(s=>s.title==='Portfolio'&&s.current_version>0));
  await page.waitForFunction(()=>document.querySelector('select[required]')?.value==='');
 });
 await run('Other requires custom title; file count/type validation and genuine draft-file replacement',async()=>{
  await type().selectOption('other');await submit().click();await region().getByRole('alert').filter({hasText:'Enter a document title'}).waitFor();
  await region().getByLabel('Document title',{exact:true}).fill('Other evidence');
  await files().setInputFiles(Array.from({length:11},(_,i)=>({...payload[0],name:`${i}.pdf`})));await submit().click();await region().getByRole('alert').filter({hasText:'Select 1–10 files'}).waitFor();
  await files().setInputFiles({name:'Program.exe',mimeType:'application/exe',buffer:Buffer.from('Synthetic rejected file')});await submit().click();await region().getByRole('alert').filter({hasText:'PDF'}).waitFor();
  await files().setInputFiles(payload[0]);assert.equal(await files().evaluate(e=>e.files.length),1);
 });
 await run('Failed option retrieval has Retry and preserves draft; confirmed empty leaves Other available',async()=>{
  await page.evaluate(()=>window.__audit.failRead='documents');await region().getByRole('button',{name:'Refresh document types'}).click();
  await region().getByRole('alert').filter({hasText:'documents transport rejection'}).waitFor();
  assert.equal(await region().getByLabel('Document title',{exact:true}).inputValue(),'Other evidence');assert.equal(await files().evaluate(e=>e.files.length),1);
  assert.equal(await region().getByText('No assigned document types. Choose Other document.',{exact:true}).count(),0);
  await page.evaluate(()=>{window.__audit.failRead='';window.__audit.state.documents=[];window.__audit.save();});
  await region().getByRole('button',{name:'Retry document types'}).click();await region().getByText('No assigned document types. Choose Other document.',{exact:true}).waitFor();
  assert.equal(await type().locator('option').count(),2);await submit().click();await page.waitForFunction(()=>window.__audit.state.submissions.some(s=>s.title==='Other evidence'&&s.current_version>0));
  await page.setViewportSize({width:390,height:650});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(output,'dropdown-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:900});
 });
 await run('Announcement failures preserve drafts; sending guard prevents repeated submission',async()=>{
  await start('instructor');await nav('Announcements');await page.locator('#announcement-subject').fill('Fixture notice');await page.locator('#announcement-message').fill('Intended fixture audience');
  await page.evaluate(()=>{window.__audit.holdAnnouncement=true;window.__audit.failMutation='announcements';});
  const send=page.getByRole('button',{name:'Send Announcement',exact:true});await send.click();await page.waitForFunction(()=>Boolean(window.__audit.releaseAnnouncement));
  await send.evaluate(e=>e.click());assert.equal(await page.evaluate(()=>window.__audit.announcementRequests.length),1);
  await page.evaluate(()=>{window.__audit.holdAnnouncement=false;window.__audit.releaseAnnouncement();});await page.getByRole('alert').filter({hasText:'Synthetic announcement rejection'}).waitFor();
  assert.equal(await page.locator('#announcement-subject').inputValue(),'Fixture notice');assert.equal(await page.locator('#announcement-message').inputValue(),'Intended fixture audience');
  assert.equal(await page.evaluate(()=>window.__audit.state.announcements.length),0);await page.evaluate(()=>window.__audit.failMutation='');
 });
 await run('Lost announcement reply retries same UUID after reassignment without duplicate send or audience change',async()=>{
  await page.locator('#announcement-recipients').selectOption(uid(101));await page.evaluate(()=>window.__audit.loseAnnouncementResponse=true);
  await page.getByRole('button',{name:'Send Announcement',exact:true}).click();await page.getByText('The outcome is unconfirmed.',{exact:false}).waitFor();
  assert.equal(await page.locator('#announcement-subject').isDisabled(),true);
  const initial=await page.evaluate(()=>structuredClone(window.__audit.state.announcements[0]));
  await page.evaluate(()=>{window.__audit.state.interns.find(i=>i.id.endsWith('000101')).instructor_id=null;window.__audit.save();});
  await page.getByRole('button',{name:'Refresh workspace',exact:true}).click();await page.getByRole('button',{name:'Refresh workspace',exact:true}).waitFor();
  await page.getByRole('button',{name:'Send Announcement',exact:true}).click();await page.getByRole('status').filter({hasText:'Announcement saved'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__audit.state.announcements.length),1);
  assert.deepEqual(await page.evaluate(()=>window.__audit.state.announcements[0]),initial);
  const requests=await page.evaluate(()=>window.__audit.announcementRequests);assert.equal(requests.at(-1).p_request_id,requests.at(-2).p_request_id);
  assert.equal(await page.locator('#announcement-subject').inputValue(),'');
  await start('intern');await page.getByText('Fixture notice',{exact:true}).waitFor();
 });
 await run('One-second attendance remains separate logged/verified; equivalent response timestamps verify and refresh',async()=>{
  await page.evaluate(()=>{const s=window.__audit.state;s.interns.find(i=>i.id.endsWith('000101')).instructor_id='00000000-0000-4000-8000-000000000002';
   s.attendance_logs=[{id:'00000000-0000-4000-8000-000000000971',intern_id:'00000000-0000-4000-8000-000000000101',log_date:'2026-10-01',time_in:'08:00:00',time_out:'08:00:01',clocked_in_at:'2026-10-01T00:00:00Z',clocked_out_at:'2026-10-01T00:00:01Z',hours:1/3600,verified:false,verified_by:null,accomplishment:'Synthetic short session'}];window.__audit.save();});
  await start('instructor');await page.evaluate(()=>window.__audit.offsetAttendanceResponse=true);await nav('DTR Review');
  await page.getByText('0.00 logged / 0.00 verified',{exact:true}).waitFor();await page.getByRole('button',{name:'Verify hours',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Closed attendance verified'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__audit.state.attendance_logs[0].hours),1/3600);
  assert.equal(await page.evaluate(()=>window.__audit.state.attendance_logs[0].verified),true);
  await page.getByRole('button',{name:'Verify hours',exact:true}).waitFor({state:'detached'});
 });
 await writeFile(path.join(output,'results.json'),JSON.stringify({transport:'mocked',passed,failed,errors},null,2));
 assert.deepEqual(errors,[]);if(failed.length)throw new Error(`${failed.length} Coordinator browser checks failed`);
}finally{await browser?.close();await server?.close();}
