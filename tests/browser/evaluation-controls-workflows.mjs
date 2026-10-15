// Render real App/JSX locally, with synthetic Auth/PostgREST and blocked remote requests.
import { createRequire } from 'node:module';
import { mkdir,writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
const require=createRequire(import.meta.url),{chromium}=require(path.resolve('.client-review/node_modules/playwright'));
const output=path.resolve('.client-review/evaluation-improvements');await mkdir(output,{recursive:true});
const owner='00000000-0000-4000-8000-000000000101';
let server,browser;const passed=[],errors=[],shots=[];
try {
  server=await createServer({configFile:false,envFile:false,cacheDir:path.resolve('.client-review/node_modules/.vite-evaluation-controls'),plugins:[{name:'isolated-evaluation-controls',enforce:'pre',resolveId(source){if(/(?:^|\/)supabaseClient(?:\.js)?$/.test(source))return path.resolve('tests/browser/supervisor-client.js');}},react(),tailwind()],server:{host:'127.0.0.1',port:0}});await server.listen();
  const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const context=await browser.newContext({viewport:{width:1920,height:1080}});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
  const origin=server.resolvedUrls.local[0],nav=name=>page.getByRole('button',{name,exact:true}).first().click();
  const start=async role=>{await page.goto(`${origin}?role=${role}`);await page.getByRole('heading',{name:role==='supervisor'?'Assigned Interns':/Hi,/}).waitFor({timeout:30000});};
  const run=async(name,fn)=>{await fn();passed.push(name);console.log(`PASS ${name}`);};
  const screenshot=async(name,reset=true)=>{if(reset)await page.locator('#dashboard-main').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(output,`${name}.png`),fullPage:true,animations:'disabled'});shots.push(name);};
  const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('#dashboard-main').scrollWidth<=document.querySelector('#dashboard-main').clientWidth+1));
  const layout=async()=>{
    await page.locator('#dashboard-main').evaluate(e=>e.scrollTop=0);
    const v=await page.evaluate(()=>{
      const wrapper=document.querySelector('.supervisor-page'),header=wrapper.querySelector('.page-header'),description=wrapper.querySelector('.page-description'),tabs=wrapper.querySelector('.evaluation-tabs'),results=wrapper.querySelector('.evaluation-results'),sidebar=document.querySelector('.desktop-sidebar'),bar=document.querySelector('.workspace-bar');
      return {padding:parseFloat(getComputedStyle(wrapper).paddingLeft),header:header.getBoundingClientRect().left,description:description.getBoundingClientRect().left,tabs:tabs?.getBoundingClientRect().left,results:results.getBoundingClientRect().left,top:header.getBoundingClientRect().top,barBottom:bar.getBoundingClientRect().bottom,sidebarRight:getComputedStyle(sidebar).display==='none'?0:sidebar.getBoundingClientRect().right};
    });
    assert.ok(v.padding>=16&&v.padding<=32);assert.ok(v.header>=v.sidebarRight+16);assert.ok(v.top>=v.barBottom+19);assert.ok(Math.abs(v.header-v.description)<1);assert.ok(Math.abs(v.header-v.results)<1);if(v.tabs!==undefined)assert.ok(Math.abs(v.header-v.tabs)<1);await noOverflow();
  };
  const rating=(region,criterion,value)=>region.getByRole('radiogroup',{name:new RegExp(criterion)}).getByRole('radio',{name:new RegExp(`^${value} `)});
  const sourceEditor=()=>page.getByRole('region',{name:'Supervisor evaluation editor'}),reviewEditor=()=>page.getByRole('region',{name:'Coordinator evaluation editor'});
  let sourceId,previewText;
  await run('Wide Supervisor layout uses shared padding, aligned edges, scoped search and integrated empty state',async()=>{
    await start('supervisor');await layout();await screenshot('assigned-desktop');await nav('Evaluations');await page.getByText('No evaluations yet',{exact:true}).waitFor();await layout();
    assert.ok(await page.getByLabel('Search evaluations',{exact:true}).evaluate(e=>e.getBoundingClientRect().width<=360));
    assert.equal(await page.getByRole('navigation',{name:'evaluations pages',exact:true}).count(),0);assert.equal(await page.locator('.evaluation-tabs').getByRole('button',{name:'New Evaluation',exact:true}).count(),0);
    await screenshot('empty-desktop-expanded');await nav('Collapse sidebar');await layout();await screenshot('empty-desktop-collapsed');await nav('Expand sidebar');
  });
  await run('Source radio groups support keyboard navigation, one choice, incomplete drafts and restoration',async()=>{
    await page.getByRole('button',{name:'New Evaluation',exact:true}).first().click();const region=sourceEditor();await region.getByLabel('Assigned Intern',{exact:true}).selectOption(owner);
    assert.equal(await region.getByRole('button',{name:'Submit to Coordinator',exact:true}).isDisabled(),true);
    const first=rating(region,'Punctuality & Attendance',1);await first.focus();await page.keyboard.press('ArrowRight');await rating(region,'Punctuality & Attendance',2).waitFor();
    assert.equal(await rating(region,'Punctuality & Attendance',2).isChecked(),true);assert.equal(await region.getByRole('radiogroup',{name:/Punctuality/}).locator('input:checked').count(),1);
    assert.equal(await region.getByRole('radiogroup').count(),4);assert.equal(await region.locator('input[type=radio]').count(),20);
    assert.equal(await rating(region,'Punctuality & Attendance',2).evaluate(e=>getComputedStyle(e.nextElementSibling).outlineStyle),'solid');await screenshot('new-rating-keyboard-focus',false);
    await region.getByLabel('Personal feedback',{exact:true}).fill('PRIVATE SOURCE: original supervisor notes.');await region.getByRole('button',{name:'Save Draft',exact:true}).click();await page.waitForFunction(()=>window.__audit.state.supervisor_evaluations.length===1);
    await region.getByRole('button',{name:'Close editor',exact:true}).click();await start('supervisor');await nav('Evaluations');await page.getByRole('button',{name:'Open Draft',exact:true}).click();
    assert.equal(await rating(sourceEditor(),'Punctuality & Attendance',2).isChecked(),true);assert.equal(await sourceEditor().getByLabel('Personal feedback').inputValue(),'PRIVATE SOURCE: original supervisor notes.');
    assert.equal(await sourceEditor().getByRole('button',{name:'Submit to Coordinator',exact:true}).isDisabled(),true);
  });
  await run('New/Edit source form and read-only submitted detail fit desktop, tablet and phone',async()=>{
    for(const [criterion,value] of [['Punctuality & Attendance',3],['Task Performance & Quality',5],['Professional Conduct',4],['Communication Skills',2]])await rating(sourceEditor(),criterion,value).check();
    for(const width of [1920,768,375]){await page.setViewportSize({width,height:900});await layout();await screenshot(`edit-source-${width}`);await sourceEditor().getByRole('button',{name:'Save Draft',exact:true}).scrollIntoViewIfNeeded();await noOverflow();await screenshot(`edit-source-actions-${width}`,false);}
    await page.setViewportSize({width:1920,height:1080});await sourceEditor().getByRole('button',{name:'Submit to Coordinator',exact:true}).click();await page.waitForFunction(()=>window.__audit.state.supervisor_evaluations[0].status==='Submitted to Coordinator');sourceId=await page.evaluate(()=>window.__audit.state.supervisor_evaluations[0].id);
    await nav('Submitted History');await page.getByRole('button',{name:'View submitted evaluation',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Submitted evaluation'});await dialog.getByText('PRIVATE SOURCE: original supervisor notes.',{exact:true}).waitFor();assert.equal(await dialog.locator('input,textarea,select').count(),0);
    for(const width of [1920,768,375]){await page.setViewportSize({width,height:900});await noOverflow();assert.ok(await dialog.locator('.dialog-panel').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await screenshot(`submitted-detail-${width}`,false);}
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  });
  await run('Coordinator defaults copy actual source ratings; standard review saves and restores without typing',async()=>{
    await page.setViewportSize({width:1920,height:1080});await start('instructor');await nav('Evaluations');await page.getByRole('button',{name:'Review and simplify',exact:true}).click();const region=reviewEditor();
    for(const [criterion,value] of [['Punctuality & Attendance',3],['Task Performance & Quality',5],['Professional Conduct',4],['Communication Skills',2]])assert.equal(await rating(region,criterion,value).isChecked(),true);
    await region.getByLabel('Quality work',{exact:true}).check();await region.getByLabel('Teamwork',{exact:true}).check();assert.equal(await region.getByLabel('Work quality',{exact:true}).isDisabled(),true);
    await region.getByLabel('No additional concerns',{exact:true}).check();assert.equal(await region.getByLabel('Further development needed',{exact:true}).isDisabled(),true);
    await region.getByLabel('Maintain good practices',{exact:true}).check();await region.getByLabel('Meeting expectations',{exact:true}).check();
    assert.equal(await region.getByLabel('Additional Remarks (optional)',{exact:true}).inputValue(),'');assert.equal(await region.getByLabel('Student-facing summary',{exact:true}).count(),0);
    await region.getByRole('button',{name:'Save Draft',exact:true}).click();await page.waitForFunction(()=>window.__audit.state.evaluation_reviews[0].feedback_mode==='selected');await region.getByRole('button',{name:'Close editor',exact:true}).click();
    await start('instructor');await nav('Evaluations');await nav('Coordinator Drafts');await page.getByRole('button',{name:'Review and simplify',exact:true}).click();assert.equal(await reviewEditor().getByLabel('Teamwork',{exact:true}).isChecked(),true);assert.equal(await reviewEditor().getByLabel('Meeting expectations',{exact:true}).isChecked(),true);
    for(const width of [1920,768,375]){await page.setViewportSize({width,height:1000});await reviewEditor().getByRole('button',{name:'Preview Intern Evaluation',exact:true}).scrollIntoViewIfNeeded();await noOverflow();await screenshot(`coordinator-feedback-${width}`,false);}
    await page.setViewportSize({width:1920,height:1080});await reviewEditor().getByRole('button',{name:'Preview Intern Evaluation',exact:true}).click();previewText=await page.getByRole('region',{name:'Intern-facing preview'}).locator('div.space-y-3').textContent();await screenshot('coordinator-preview',false);
    await reviewEditor().getByRole('button',{name:'Publish to Intern',exact:true}).click();await page.waitForFunction(()=>window.__audit.state.evaluation_reviews[0].status==='Published to Intern');
  });
  await run('Intern sees the exact preview, without original/private feedback or retired correction controls',async()=>{
    await start('intern');await nav('My Evaluations');const summary=page.getByText('The intern is meeting the expectations discussed in this review.',{exact:true});await summary.waitFor();
    assert.equal(await summary.locator('xpath=../..').textContent(),previewText);assert.equal(await page.getByText('PRIVATE SOURCE: original supervisor notes.',{exact:true}).count(),0);
    await nav('My Attendance');assert.equal(await page.getByText('Time Log Exception Request',{exact:true}).count(),0);
  });
  await run('Each adjusted criterion requires explicit reasons; Other and remarks persist across reload',async()=>{
    await start('supervisor');await nav('Evaluations');await page.getByRole('button',{name:'New Evaluation',exact:true}).first().click();await sourceEditor().getByLabel('Assigned Intern',{exact:true}).selectOption(owner);
    for(const c of ['Punctuality & Attendance','Task Performance & Quality','Professional Conduct','Communication Skills'])await rating(sourceEditor(),c,4).check();await sourceEditor().getByRole('button',{name:'Submit to Coordinator',exact:true}).click();await page.waitForFunction(()=>window.__audit.state.supervisor_evaluations.length===2&&window.__audit.state.supervisor_evaluations[1].status==='Submitted to Coordinator');
    await start('instructor');await nav('Evaluations');await page.getByRole('button',{name:'Review and simplify',exact:true}).click();const region=reviewEditor();
    await rating(region,'Punctuality & Attendance',5).check();await rating(region,'Communication Skills',5).check();await region.getByLabel('Making steady progress',{exact:true}).check();
    assert.equal(await region.getByRole('button',{name:'Save Draft',exact:true}).isDisabled(),true);await region.getByLabel('Reviewed attendance evidence',{exact:true}).check();assert.equal(await region.getByRole('button',{name:'Save Draft',exact:true}).isDisabled(),true);
    await region.getByRole('group',{name:/Communication Skills: original/}).getByLabel('Other',{exact:true}).check();await region.getByLabel('Explain Communication Skills adjustment').fill('Reviewed the documented communication evidence.');await region.getByLabel('Additional Remarks (optional)').fill('Additional student guidance remains saved.');
    await region.getByRole('button',{name:'Save Draft',exact:true}).click();await page.waitForFunction(()=>window.__audit.state.evaluation_reviews.some(r=>r.additional_remarks==='Additional student guidance remains saved.'));
    await start('instructor');await nav('Evaluations');await nav('Coordinator Drafts');await page.getByRole('button',{name:'Review and simplify',exact:true}).click();assert.equal(await reviewEditor().getByLabel('Additional Remarks (optional)').inputValue(),'Additional student guidance remains saved.');assert.equal(await reviewEditor().getByLabel('Explain Communication Skills adjustment').inputValue(),'Reviewed the documented communication evidence.');
  });
  await run('No assignments, failed reads, loading and filtered/populated pagination use contained states',async()=>{
    await start('supervisor');await page.evaluate(()=>window.__audit.noInterns=true);await page.getByRole('button',{name:'Refresh assigned interns',exact:true}).click();await page.getByText('No assigned interns',{exact:true}).waitFor();await screenshot('no-assigned-interns');await nav('Evaluations');await page.getByText('No assigned interns',{exact:true}).waitFor();await nav('Submitted History');await page.getByText('No Active interns are currently assigned to you.',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'New Evaluation',exact:true}).first().isDisabled(),true);await screenshot('history-with-no-assignments');
    await page.evaluate(()=>{window.__audit.noInterns=false;window.__audit.failRead='supervisor_evaluations';});await page.getByRole('button',{name:'Refresh evaluations',exact:true}).click();await page.getByRole('alert').filter({hasText:'Evaluation records unavailable'}).waitFor();await screenshot('evaluation-error');
    await page.evaluate(()=>{window.__audit.failRead='';window.__audit.holdRead='supervisor_evaluations';});await page.getByRole('button',{name:'Refresh evaluations',exact:true}).click();await page.getByRole('status').filter({hasText:'Loading evaluations'}).waitFor();await screenshot('evaluation-loading');await page.evaluate(()=>{window.__audit.holdRead='';window.__audit.releaseReads.splice(0).forEach(fn=>fn());});
    await page.evaluate(()=>{for(let n=0;n<12;n++)window.__audit.state.supervisor_evaluations.push({id:`00000000-0000-4000-8000-${String(900+n).padStart(12,'0')}`,intern_id:'00000000-0000-4000-8000-000000000101',supervisor_id:'00000000-0000-4000-8000-000000000009',company_id:'00000000-0000-4000-8000-000000000010',criteria:{punctuality:4,performance:4,conduct:4,communication:4},overall_score:80,feedback:'Saved synthetic private draft',version:2,evaluation_date:'2026-10-14',created_at:new Date().toISOString(),status:'Supervisor Draft'});window.__audit.save();});
    await start('supervisor');await nav('Evaluations');await page.getByRole('button',{name:'Open Draft',exact:true}).first().waitFor();assert.equal(await page.locator('.evaluation-results').getByRole('navigation',{name:'evaluations pages',exact:true}).count(),1);await screenshot('populated-drafts');
    await page.getByLabel('Search evaluations',{exact:true}).fill('no-matching-record');await page.getByText('No search results',{exact:true}).waitFor();assert.equal(await page.getByRole('navigation',{name:'evaluations pages',exact:true}).count(),0);await screenshot('filtered-empty');await page.getByRole('button',{name:'Clear search',exact:true}).click();
  });
  await run('200% zoom-equivalent reflow preserves collapsed/expanded alignment and usable rating groups',async()=>{
    const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setDeviceMetricsOverride',{width:960,height:540,deviceScaleFactor:2,mobile:false});await layout();await screenshot('zoom-200-expanded');await nav('Collapse sidebar');await layout();await screenshot('zoom-200-collapsed');
    await page.getByRole('button',{name:'Open Draft',exact:true}).first().click();await sourceEditor().getByRole('radio').first().focus();await page.keyboard.press('ArrowRight');await noOverflow();await screenshot('zoom-200-editor-focus',false);await sourceEditor().getByRole('button',{name:'Save Draft',exact:true}).scrollIntoViewIfNeeded();await screenshot('zoom-200-editor-actions',false);
    await cdp.send('Emulation.clearDeviceMetricsOverride');
  });
  assert.deepEqual(errors,[]);await writeFile(path.join(output,'results.json'),JSON.stringify({passed,errors,shots,sourceId,zoom:'960×540 CSS pixels at 2× device scale: reflow equivalent to 200% on 1920×1080; browser toolbar zoom itself is not automated'},null,2));
} finally {await browser?.close();await server?.close();}
