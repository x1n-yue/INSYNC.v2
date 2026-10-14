// Actual React and generated artifacts, with only Supabase transport replaced.
// Optional --production builds/serves a separate ignored fixture bundle. No env/live HTTP.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer,build,preview} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import {unzipSync,strFromU8} from 'fflate';
const require=createRequire(import.meta.url),{chromium}=require(path.resolve('.client-review/node_modules/playwright'));
const production=process.argv.includes('--production'),folder=production?'handover-production':'handover';
const output=path.resolve(`.client-review/${folder}`);await mkdir(output,{recursive:true});
const config={configFile:false,envFile:false,cacheDir:path.resolve('.client-review/node_modules/.vite-handover'),plugins:[{name:'isolated-handover',enforce:'pre',resolveId(source){if(/(?:^|\/)supabaseClient(?:\.js)?$/.test(source))return path.resolve('tests/browser/handover-client.js');}},react(),tailwind()],server:{host:'127.0.0.1',port:0},build:{outDir:path.join(output,'bundle'),emptyOutDir:false},preview:{host:'127.0.0.1',port:0}};
let server,browser;const passed=[],failed=[],errors=[],artifacts=[];
try {
  if(production){await build(config);server=await preview(config);}else{server=await createServer(config);await server.listen();}
  const origin=server.resolvedUrls.local[0],executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
  const start=async(role,extra='')=>{await page.goto(`${origin}?role=${role}${extra}`);await page.getByRole('heading',{name:/Hi,/}).waitFor({timeout:30000});};
  const nav=name=>page.getByRole('button',{name,exact:true}).first().click();
  const run=async(name,task)=>{try{await task();passed.push(name);console.log(`PASS ${name}`);}catch(e){failed.push({name,error:e.message});console.log(`FAIL ${name}: ${e.message}`);}};
  const saveExport=async(key,format)=>{
    const receipt=page.waitForEvent('download');receipt.catch(()=>{});await page.getByRole('button',{name:`Export ${key} ${format==='xlsx'?'Excel':format.toUpperCase()}`,exact:true}).click();
    const download=await receipt;assert.equal(await download.failure(),null);const file=path.join(output,download.suggestedFilename());await download.saveAs(file);
    const bytes=await readFile(file);artifacts.push({file,key,format,size:bytes.length});
    if(format==='csv'){const text=bytes.toString('utf8');assert.match(text,/INSync/);assert.match(text,/Informational system-generated report/);}
    if(format==='xlsx'){const files=unzipSync(bytes);assert.ok(files['xl/workbook.xml']);assert.match(strFromU8(files['xl/worksheets/sheet1.xml']),/Page &amp;P of &amp;N/);assert.ok(Object.keys(files).some(f=>f.startsWith('xl/media/')));}
    if(format==='pdf'){assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
      // Independent parser installed in the local validation environment, not an app dependency.
      const details=JSON.parse(execFileSync('python',['-c',"import pymupdf,json,sys; d=pymupdf.open(sys.argv[1]); print(json.dumps({'pages':len(d),'text':' '.join(p.get_text() for p in d),'images':sum(len(p.get_images()) for p in d)}))",file],{encoding:'utf8',windowsHide:true}));
      assert.ok(details.pages>=1);assert.ok(details.images>=1);assert.match(details.text,/Informational system-generated report/);assert.match(details.text,/Page 1 of/);assert.match(details.text,/Generated \(Asia\/Manila\)/);
      assert.equal((details.text.match(/Generated \(Asia\/Manila\)/g)||[]).length,details.pages,'one branded metadata header per PDF page, including multiple tables');
      if(key==='class')assert.match(details.text,/SID-65/); // Complete roster reaches PDF pages after the visible UI page.
    }
    return file;
  };
  await run('Recovery request validates, prevents duplicates, preserves truthful failure and conditional email wording',async()=>{
    await page.goto(`${origin}?role=intern&login=1`);await page.getByRole('button',{name:'Forgot password?',exact:true}).click();
    await page.getByRole('button',{name:'Send recovery link',exact:true}).click();assert.equal(await page.evaluate(()=>window.__audit.resetRequests),0);
    await page.getByLabel('Email address',{exact:false}).fill('fixture@example.invalid');
    await page.evaluate(()=>{window.__audit.holdRecovery=true;window.__audit.recoveryFailure=true;});
    await page.getByRole('button',{name:'Send recovery link',exact:true}).click();await page.waitForFunction(()=>Boolean(window.__audit.releaseRecovery));
    await page.locator('form').evaluate(f=>{f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
    assert.equal(await page.evaluate(()=>window.__audit.resetRequests),1);
    await page.evaluate(()=>{window.__audit.holdRecovery=false;window.__audit.releaseRecovery();});
    await page.getByRole('alert').filter({hasText:'Synthetic recovery delivery failure'}).waitFor();
    await page.evaluate(()=>{window.__audit.recoveryFailure=false;});await page.getByRole('button',{name:'Send recovery link',exact:true}).click();
    await page.getByRole('heading',{name:'Check your email'}).waitFor();assert.match(await page.getByRole('status').first().innerText(),/eligible/i);
  });
  await run('Restored recovery session remains outside role dashboard; mismatch/failure preserve fields; successful update signs out',async()=>{
    await page.goto(`${origin}?role=intern&auth=recovery`);await page.getByRole('heading',{name:'Set a new password'}).waitFor();assert.equal(await page.locator('.dashboard-shell').count(),0);
    await page.getByLabel('New password',{exact:false}).first().fill('synthetic-password');await page.locator('#recovery-confirm').fill('other-password');
    await page.getByRole('button',{name:'Update password',exact:true}).click();await page.getByRole('alert').filter({hasText:'Passwords do not match'}).waitFor();assert.equal(await page.evaluate(()=>window.__audit.passwordUpdates),0);
    await page.locator('#recovery-confirm').fill('synthetic-password');await page.evaluate(()=>window.__audit.recoveryFailure=true);
    await page.getByRole('button',{name:'Update password',exact:true}).click();await page.getByRole('alert').filter({hasText:'Synthetic password update failure'}).waitFor();assert.equal(await page.locator('#recovery-password').inputValue(),'synthetic-password');
    await page.evaluate(()=>window.__audit.emit('SIGNED_IN',{user:{id:'00000000-0000-4000-8000-000000000102'}}));
    await page.waitForFunction(()=>document.getElementById('recovery-password')?.value==='');assert.equal(await page.locator('#recovery-confirm').inputValue(),'');
    await page.evaluate(()=>window.__audit.emit('SIGNED_IN',{user:{id:'00000000-0000-4000-8000-000000000101'}}));
    await page.locator('#recovery-password').fill('synthetic-password');await page.locator('#recovery-confirm').fill('synthetic-password');
    await page.evaluate(()=>window.__audit.recoveryFailure=false);await page.getByRole('button',{name:'Update password',exact:true}).click();await page.getByRole('heading',{name:'Password updated'}).waitFor();
    await page.getByRole('button',{name:'Return to sign in',exact:true}).click();await page.getByRole('heading',{name:'Welcome back'}).waitFor();assert.ok(!page.url().includes('auth=recovery'));
  });
  await run('Expired recovery link has reachable return control on short mobile screens',async()=>{
    await page.setViewportSize({width:375,height:480});await page.goto(`${origin}?role=intern&login=1&auth=recovery#error=access_denied`);
    await page.getByRole('alert').filter({hasText:'Recovery link unavailable'}).waitFor();await page.getByRole('button',{name:'Return to sign in',exact:true}).click();await page.getByRole('heading',{name:'Welcome back'}).waitFor();await page.setViewportSize({width:1440,height:900});
  });
  await run('Admin creates distinct custom requirements, rejects a failed attempt, preserves draft and reconciles retry',async()=>{
    await start('admin');await nav('Interns');await page.getByRole('button',{name:'Manage requirements',exact:true}).first().click();
    const dialog=page.getByRole('dialog');await dialog.getByLabel('Custom requirement name').fill('Portfolio');await dialog.getByRole('button',{name:'Add custom requirement',exact:true}).click();
    await dialog.getByLabel('Custom requirement name').waitFor();await page.waitForFunction(()=>window.__audit.state.documents.some(d=>d.name==='Portfolio'));
    await dialog.getByLabel('Custom requirement name').fill('Portfolio');await dialog.getByRole('button',{name:'Add custom requirement',exact:true}).click();await page.waitForFunction(()=>window.__audit.state.documents.filter(d=>d.name==='Portfolio').length===2);
    await dialog.getByLabel('Custom requirement name').fill('Retain draft');await page.evaluate(()=>window.__audit.failMutation='admin_add_requirement');await dialog.getByRole('button',{name:'Add custom requirement',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(await dialog.getByLabel('Custom requirement name').inputValue(),'Retain draft');
    await page.evaluate(()=>window.__audit.failMutation='');await dialog.getByRole('button',{name:'Add custom requirement',exact:true}).click();await page.waitForFunction(()=>window.__audit.state.documents.filter(d=>d.name==='Retain draft').length===1);
    await dialog.getByRole('button',{name:/^Close Requirements/}).click();
  });
  await run('Intern dropdown distinguishes duplicate requirement names and preserves full clearance counts',async()=>{
    await start('intern');await nav('My Documents');const selector=page.getByLabel('Choose clearance requirement');await selector.waitFor();
    const values=await selector.locator('option').evaluateAll(options=>options.filter(o=>o.textContent.startsWith('Portfolio')).map(o=>o.value));assert.equal(values.length,2);assert.notEqual(values[0],values[1]);
    await selector.selectOption(values[0]);assert.equal(await page.getByText('Portfolio',{exact:true}).count(),1);assert.match(await page.locator('.dashboard-content').innerText(),/0\/7 Approved/);
  });
  await run('Admin explicitly sets current year; failed save preserves choice, success retains assignments and old year',async()=>{
    await start('admin');await page.evaluate(()=>{window.__audit.state.academic_years.push({id:'00000000-0000-4000-8000-000000000040',label:'2027–2028',is_current:false,archived_at:null});window.__audit.save();});await start('admin');await nav('Master Data');
    await page.getByRole('button',{name:'Set 2027–2028 as current year',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Set current academic year'});
    await page.evaluate(()=>window.__audit.failMutation='admin_set_current_year');await dialog.getByRole('button',{name:'Confirm current year',exact:true}).click();await page.getByRole('alert').filter({hasText:'Synthetic current year rejection'}).waitFor();assert.equal(await dialog.count(),1);
    await page.evaluate(()=>window.__audit.failMutation='');await dialog.getByRole('button',{name:'Confirm current year',exact:true}).click();await page.getByText('2027–2028 (Current)',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__audit.state.academic_years.filter(y=>y.is_current).length),1);assert.equal(await page.evaluate(()=>window.__audit.state.interns.length),65);
  });
  await run('Admin refresh repopulates untouched assignment inputs while retaining actual dirty drafts',async()=>{
    await start('admin');await nav('Interns');const target=page.getByLabel('Required Hours',{exact:true}).first();
    await page.evaluate(()=>{window.__audit.state.interns[0].required_hours=499;window.__audit.save();});await page.getByRole('button',{name:'Refresh data',exact:true}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(i=>i.value==='499'));
    assert.equal(await target.inputValue(),'499');await target.fill('500');
    await page.evaluate(()=>{window.__audit.state.interns[0].required_hours=501;window.__audit.save();});await page.getByRole('button',{name:'Refresh data',exact:true}).click();
    await target.waitFor();assert.equal(await target.inputValue(),'500');
  });
  await run('Instructor verifies closed hours; failure preserves unverified record, success refreshes metrics; intern sees review on focus',async()=>{
    await start('instructor');await page.evaluate(()=>{const s=window.__audit.state;s.attendance_logs=[{id:'00000000-0000-4000-8000-000000000999',intern_id:'00000000-0000-4000-8000-000000000101',log_date:'2026-10-01',time_in:'08:00:00',time_out:'16:00:00',clocked_in_at:'2026-10-01T00:00:00.000Z',clocked_out_at:'2026-10-01T08:00:00.000Z',hours:8,verified:false,verified_by:null,accomplishment:'Fixture logged shift'}];window.__audit.save();});
    await start('instructor');await nav('DTR Review');await page.getByRole('cell',{name:'Oct 1, 2026',exact:true}).waitFor();await page.evaluate(()=>window.__audit.failMutation='verify_attendance');await page.getByRole('button',{name:'Verify hours',exact:true}).click();await page.getByRole('alert').filter({hasText:'Synthetic verification rejection'}).waitFor();assert.equal(await page.evaluate(()=>window.__audit.state.attendance_logs[0].verified),false);
    await page.evaluate(()=>window.__audit.failMutation='');await page.getByRole('button',{name:'Verify hours',exact:true}).click();await page.getByRole('cell',{name:'Verified',exact:true}).waitFor();
    await start('intern');assert.match(await page.locator('.dashboard-content').innerText(),/Verified: 8\.00/);
    await page.evaluate(()=>{window.__audit.state.attendance_logs[0].verified=false;window.__audit.state.attendance_logs[0].verified_by=null;window.dispatchEvent(new Event('focus'));});
    await page.getByText(/Verified: 0\.00/).waitFor();
  });
  await run('First legacy-file replacement retains original metadata and scoped private file action without current approval',async()=>{
    await start('intern');await page.evaluate(()=>{const d=window.__audit.state.documents.find(d=>d.doc_type==='moa');Object.assign(d,{file_path:`${d.intern_id}/legacy-original.pdf`,file_name:'Original.pdf',status:'Approved',upload_version:0,note:'Original legacy explanation',reviewed_by:null,reviewed_at:null});window.__audit.state.objects[d.file_path]=true;window.__audit.save();});
    await start('instructor');await nav('Intern Documents');await page.locator('#document-intern').selectOption('00000000-0000-4000-8000-000000000101');await page.getByText(/0\/7 confirmed current approvals/).waitFor();assert.equal(await page.getByRole('button',{name:'Revoke',exact:true}).count(),0);
    await start('intern');await nav('My Documents');await page.getByLabel('Choose clearance requirement').selectOption('00000000-0000-4000-8000-000000000300');
    await page.locator('input[type=file]').last().setInputFiles({name:'Replacement.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF isolated fixture')});
    await page.getByRole('status').filter({hasText:'Upload finalized; pending review'}).waitFor();await page.getByRole('button',{name:'File & review history',exact:true}).click();
    const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'Legacy file · Original.pdf',exact:true}).waitFor();assert.match(await dialog.innerText(),/Stored legacy status: Approved.*Evidence unverified/s);assert.match(await dialog.innerText(),/Original legacy explanation/);
    const legacy=dialog.getByRole('article').filter({has:page.getByRole('heading',{name:'Legacy file · Original.pdf',exact:true})});await legacy.getByRole('button',{name:'View file',exact:true}).click();await legacy.getByRole('link',{name:'Open prepared file',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__audit.state.documents.find(d=>d.doc_type==='moa').status),'Pending');await page.keyboard.press('Escape');
  });
  for(const role of ['intern','instructor']) {
    await run(`${role}: all report categories produce PDF, genuine Excel and CSV through real UI download handlers`,async()=>{
      await start(role);await nav('Reports');
      for(const key of role==='intern'?['dtr','performance','weekly','documents']:['class','evaluations','clearance','risk'])for(const format of ['pdf','xlsx','csv'])await saveExport(key,format);
    });
  }
  await run('Reports validate dates, preserve filters, export every matching roster page and fail honestly with retry',async()=>{
    await start('instructor');await nav('Reports');await page.locator('#instructor-report-range').selectOption('custom');await page.getByRole('button',{name:'Export class CSV',exact:true}).click();await page.getByRole('alert').filter({hasText:/Select valid start/}).waitFor();
    await page.getByLabel('From (Manila)',{exact:true}).fill('2026-10-01');await page.getByLabel('Through (inclusive)',{exact:true}).fill('2026-10-01');const file=await saveExport('class','csv');assert.match((await readFile(file)).toString('utf8'),/SID-65/);
    await page.evaluate(()=>window.__audit.failRead='attendance_logs');await page.getByRole('button',{name:'Export class CSV',exact:true}).click();await page.getByRole('alert').filter({hasText:'Synthetic attendance_logs transport rejection'}).waitFor();
    await page.evaluate(()=>window.__audit.failRead='');await saveExport('class','csv');
    await page.locator('#report-roster-search').fill('SID-65');const scoped=await saveExport('class','csv');const scopedText=(await readFile(scoped)).toString('utf8');assert.match(scopedText,/SID-65/);assert.ok(!scopedText.includes('"SID-1"'));
    await page.locator('#report-roster-search').fill('');await page.locator('#report-roster-section').selectOption('00000000-0000-4000-8000-000000000021');
    const sectionFile=await saveExport('class','csv'),sectionText=(await readFile(sectionFile)).toString('utf8');assert.match(sectionText,/SID-64/);assert.ok(!sectionText.includes('"SID-65"'));
  });
  await run('Admin audit matching-filter exports produce branded PDF, Excel and CSV',async()=>{
    await start('admin');await nav('Audit Logs');for(const format of ['pdf','xlsx','csv'])await saveExport('audit',format);
  });
  await page.screenshot({path:path.join(output,'final.png'),fullPage:true});assert.deepEqual(errors,[]);
}finally{
  await writeFile(path.join(output,'results.json'),JSON.stringify({mode:production?'production bundle, mocked transport':'development, mocked transport',passed,failed,errors,artifacts,limits:'Remote requests blocked. No live Supabase/Auth email/Storage delivery/deployment verification.'},null,2));
  await browser?.close();if(server?.close)await server.close();else if(server?.httpServer)await new Promise(r=>server.httpServer.close(r));
}
if(failed.length)process.exitCode=1;
