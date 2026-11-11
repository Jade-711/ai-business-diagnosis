import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker from '../worker/index.js';
import {actionMappingPublication,applyActionMappingPublications,repairPublishedActionMappings} from '../shared/published-actions.js';
import {readActionPublications,saveActionPublication} from '../worker/action-publications.js';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
function db(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0001_dashboard_action_publications.sql',import.meta.url),'utf8'));
 return {sqlite,prepare(sql){let args=[];return {bind(...values){args=values;return this;},async run(){sqlite.prepare(sql).run(...args);return {};},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};}};}};
}
const origin='https://test.chatgpt.site',path='/api/dashboard/action-mappings';
const sample={schemaVersion:1,sceneId:'s1',fieldKey:'live',strategies:[{id:'strategy-1',actionIds:['tool-b','tool-a'],actionSubtitles:{'tool-b':'核查商品','tool-a':'核查开播'}}],actions:[{id:'tool-a',name:'开播工具',description:'开播作用'},{id:'tool-b',name:'商品工具',description:'商品作用'}]};
const post=(body,headers={})=>new Request(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body)});
test('发布映射持久化后由其他访客读取同一版本，草稿不上传，规则不变且不调用外部服务',async()=>{
 const DB=db(),env={DB,COZE_PUBLIC_DEMO:'1',COZE_ALLOWED_EMAIL:'owner@example.com'},owner={'oai-authenticated-user-email':'owner@example.com'},before=await worker.fetch(new Request(origin+path),env);assert.deepEqual((await before.json()).scenes,{});
 const result=await worker.fetch(post(sample,owner),env);assert.equal(result.status,200);
 const publication=(await result.json()).publication;assert.ok(publication.revision);
 const fresh=await(await worker.fetch(new Request(origin+path),env)).json();assert.deepEqual(fresh.scenes.s1,publication);
 const config={sceneId:'s1',active:true,strategies:[{id:'strategy-1',sceneId:'s1',rule:{metricId:'m',op:'<'},actionIds:['old']}],actions:[]},copy=applyActionMappingPublications(config,fresh.scenes);
 assert.deepEqual(copy.strategies[0].actionIds,['tool-b','tool-a']);assert.equal(copy.strategies[0].actionSubtitles['tool-b'],'核查商品');assert.deepEqual(copy.strategies[0].rule,config.strategies[0].rule);assert.deepEqual(config.strategies[0].actionIds,['old']);
 sample.strategies[0].actionSubtitles['tool-b']='未发布的本地草稿';assert.equal((await readActionPublications(DB)).scenes.s1.strategies[0].actionSubtitles['tool-b'],'核查商品');
 const cleared={...sample,strategies:[{id:'strategy-1',actionIds:[],actionSubtitles:{}}],actions:[]};await saveActionPublication(DB,cleared);assert.deepEqual((await readActionPublications(DB)).scenes.s1.strategies[0].actionIds,[]);
 DB.sqlite.close();
});
test('只有授权管理员可发布，拒绝跨站请求、未知工具及过量内容',async()=>{
 const DB=db(),env={DB,COZE_PUBLIC_DEMO:'1',COZE_ALLOWED_EMAIL:'owner@example.com'},owner={'oai-authenticated-user-email':'owner@example.com'};
 assert.equal((await worker.fetch(post(sample),env)).status,401);
 assert.equal((await worker.fetch(post(sample,{'oai-authenticated-user-email':'other@example.com'}),env)).status,403);
 assert.equal((await worker.fetch(post(sample,{...owner,origin:'https://elsewhere.example'}),env)).status,403);
 assert.equal((await worker.fetch(post({...sample,actions:[]},owner),env)).status,400);
 assert.equal((await worker.fetch(post({...sample,privateData:'x'.repeat(200001)},owner),env)).status,413);
 assert.deepEqual((await readActionPublications(DB)).scenes,{});
 DB.sqlite.close();
});
test('复核过的默认映射进入后台发布快照，保留人工改过的映射和完整场景结构',async()=>{
 const text=await readFile(new URL('../web/curated-catalog.js',import.meta.url),'utf8'),catalog=JSON.parse(text.split('const AIDD_CURATED_CATALOG = ')[1].trim().replace(/;$/,''));
 assert.equal(catalog.dashboardActionMappingVersion,1);
 const config=catalog.published['research-scene-001'].periods.week,s=config.strategies.find(s=>s.id==='research-strategy-01-3');
 assert.deepEqual(s.actionIds,['research-action-31']);assert.match(config.framework,/售后工作台/);
 assert.equal(catalog.scenes.length,91);assert.equal(catalog.strategies.length,228);
 const clone=JSON.parse(JSON.stringify(catalog));delete clone.dashboardActionMappingVersion;const custom=clone.strategies.find(s=>s.id==='research-strategy-01-3');custom.actionIds=[];assert.deepEqual(repairPublishedActionMappings(clone).strategies.find(s=>s.id===custom.id).actionIds,[]);
 assert.equal(actionMappingPublication(config).sceneId,'research-scene-001');
});
