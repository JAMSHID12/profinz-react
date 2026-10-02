import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { readFile, readdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
// Set PLAYWRIGHT_MODULE when using a shared Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const bundle = await build({ stdin: { contents: `
import React, {useState, useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {SearchableSelect,DatePicker,TimeSelect} from './src/components/pickers';
function App(){
 const [batch,setBatch]=useState(''),[date,setDate]=useState('2026-10-02'),[time,setTime]=useState('13:47'),[student,setStudent]=useState(''),[room,setRoom]=useState('');
 const search=useCallback(async q=>{window.searches.push(q);await new Promise(r=>setTimeout(r,q==='slow'?600:30));return [{value:q,label:'Student '+q}];},[]);
 return <main style={{padding:16,maxWidth:420}}><form onSubmit={e=>{e.preventDefault();window.saved=true;}}>
 <SearchableSelect required aria-label="Batch" value={batch} onChange={setBatch} options={[{value:1,label:'CMA USA Batch 1'},{value:2,label:'ACCA Batch 2'}]} />
 <DatePicker aria-label="Date" value={date} min="2026-10-02" max="2026-10-25" onChange={e=>setDate(e.target.value)} />
 <TimeSelect aria-label="Start time" value={time} min="13:46" onChange={e=>setTime(e.target.value)} />
 <SearchableSelect aria-label="Student" value={student} onChange={setStudent} options={[]} loadOptions={search} />
 <SearchableSelect aria-label="Room" value={room} onChange={setRoom} options={[]} allowCustom />
 <button type="submit">Save</button><output>{date} {time}</output></form></main>;
}
window.searches=[];createRoot(document.getElementById('root')).render(<App/>);
`, resolveDir:process.cwd(), loader:'tsx' }, bundle:true, write:false, format:'iife', loader:{'.css':'empty'}, define:{'process.env.NODE_ENV':'"production"'} });
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<div id="root"></div>');
 const assets=await readdir('dist/assets');const css=assets.find(name=>name.endsWith('.css'));
 await page.addStyleTag({content:await readFile('dist/assets/'+css,'utf8')});
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('combobox',{name:'Search Batch',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.saved),undefined,'required dropdown blocks submission');
 await page.getByRole('combobox',{name:'Search Batch',exact:true}).fill('missing');
 await page.getByText('No results found',{exact:true}).waitFor();
 await page.getByRole('combobox',{name:'Search Batch',exact:true}).fill('acca');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.getByRole('combobox',{name:'Batch',exact:true}).filter({hasText:'ACCA Batch 2'}).waitFor();
 assert.equal(await page.getByRole('option').count(),1441,'time keeps every minute');
 assert.equal(await page.locator('option[value="13:45"]').isDisabled(),true);
 assert.equal(await page.getByRole('combobox',{name:'Start time',exact:true}).inputValue(),'13:47');
 await page.getByRole('button',{name:'Date',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Thursday, October 1st, 2026',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Saturday, October 3rd, 2026',exact:true}).click();
 await page.getByText('2026-10-03 13:47',{exact:true}).waitFor();
 await page.getByRole('combobox',{name:'Student',exact:true}).click();
 const search=page.getByRole('combobox',{name:'Search Student',exact:true});
 await search.fill('slow');await page.waitForTimeout(350);await search.fill('new');await page.waitForTimeout(750);
 await page.getByRole('option',{name:'Student new',exact:true}).click();
 await page.getByRole('combobox',{name:'Student',exact:true}).filter({hasText:'Student new'}).waitFor();
 assert.equal((await page.evaluate(()=>window.searches)).includes('s'),false,'debounces requests');
 await page.getByRole('combobox',{name:'Room',exact:true}).click();await page.getByRole('combobox',{name:'Search Room',exact:true}).fill('Lab 3');await page.getByRole('option',{name:'Use “Lab 3”'}).click();
 await page.getByRole('combobox',{name:'Room',exact:true}).filter({hasText:'Lab 3'}).waitFor();
 await page.getByRole('button',{name:'Date',exact:true}).click();
 const bounds=await page.locator('[data-radix-popper-content-wrapper]').boundingBox();assert(bounds.x>=0 && bounds.x+bounds.width<=390,'calendar fits mobile');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Save',exact:true}).click();assert.equal(await page.evaluate(()=>window.saved),true);
 assert.deepEqual(errors,[]);console.log('Picker browser checks passed: required, local search, empty state, keyboard, selected label, date limits, minute precision, debounced/stale search, custom rooms, mobile fit.');
} finally {await browser.close();}
