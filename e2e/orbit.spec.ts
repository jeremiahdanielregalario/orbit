import {test,expect} from '@playwright/test';
import {zipSync,strToU8} from 'fflate';
const row=(value:string)=>({string_list_data:[{value,timestamp:1704067200}]});
const zip=(followers:string[],following:string[])=>zipSync({'connections/followers_and_following/followers_1.json':strToU8(JSON.stringify(followers.map(row))),'connections/followers_and_following/following.json':strToU8(JSON.stringify({relationships_following:following.map(row)}))});
async function upload(page:import('@playwright/test').Page,followers:string[],following:string[]){await page.getByRole('button',{name:'Import archive',exact:true}).first().click();await page.locator('input[type=file]').setInputFiles({name:'instagram.zip',mimeType:'application/zip',buffer:Buffer.from(zip(followers,following))});await expect(page.getByRole('dialog')).not.toBeVisible();}
test('demo, search, guide and responsive layout',async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/'); await page.getByRole('button',{name:'Explore a demo'}).click();await expect(page.getByText('DEMO DATA',{exact:true})).toBeVisible();
 await page.screenshot({path:`test-results/${testInfo.project.name}-overview.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Connections',exact:false}).filter({has:page.locator('svg')}).first().click();
 await page.getByRole('textbox',{name:'Search usernames'}).fill('no_such_account');await expect(page.getByText('No matching connections')).toBeVisible();
 await page.getByRole('button',{name:'Import guide',exact:true}).click();await expect(page.getByText('JSON format',{exact:true})).toBeVisible();expect(errors).toEqual([]);
});
test('ZIP import, CSV download, snapshots, comparison and deletion stay local',async({page})=>{
 const external:string[]=[]; page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:5173'))external.push(r.url());});await page.goto('/');
 await upload(page,['alice','bob'],['alice','charlie']);await expect(page.getByText('@charlie',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'View all 1'}).click();await expect(page.getByText('@charlie',{exact:true})).toBeVisible();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();expect((await download).suggestedFilename()).toBe('orbit-not-following-back.csv');
 await page.getByRole('button',{name:'Compare snapshots',exact:true}).click();await page.getByRole('textbox',{name:'Snapshot label'}).fill('account · earlier');await page.getByRole('button',{name:'Save snapshot',exact:true}).click();
 await upload(page,['alice','dana'],['alice','charlie']);await page.getByRole('button',{name:'Compare snapshots',exact:true}).click();await page.getByRole('textbox',{name:'Snapshot label'}).fill('account · later');await page.getByRole('button',{name:'Save snapshot',exact:true}).click();
 await page.getByLabel('Earlier export',{exact:true}).selectOption({label:'account · earlier'});await page.getByLabel('Later export',{exact:true}).selectOption({label:'account · later'});await expect(page.getByText('@dana',{exact:true})).toBeVisible();await expect(page.getByText('@bob',{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Compare snapshots',exact:true}).click();await expect(page.getByText('account · earlier',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Privacy & storage',exact:true}).click();await page.getByRole('button',{name:'Clear all Orbit data on this device'}).click();expect(await page.evaluate(()=>localStorage.getItem('orbit-snapshots'))).toBeNull();expect(external).toEqual([]);
});
test('missing follower data produces a helpful error',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Import archive',exact:true}).first().click();await page.locator('input[type=file]').setInputFiles({name:'following.json',mimeType:'application/json',buffer:Buffer.from('{"relationships_following":[]}')});await expect(page.getByRole('alert')).toContainText('Missing followers');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();});
