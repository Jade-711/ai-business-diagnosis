import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../worker/index.js';
import {sanitizePublicDemoRequest,reservePublicDemoBudget} from '../worker/public-demo.js';
import {prepareWorkflowDiagnosis} from '../shared/workflow-diagnosis.js';
const catalog=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8'));
const origin='https://public-demo.example',request=(body,path='/api/diagnose',headers={})=>new Request(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body)});
function quotaDB(){const days=new Map();return {days,prepare(sql){return {bind(...values){this.values=values;return this;},async run(){return {};},async first(){if(!sql.startsWith('INSERT INTO public_workflow_budget'))return null;const [day,,limit]=this.values,count=days.get(day)||0;if(count>=limit)return null;days.set(day,count+1);return {request_count:count+1};}};}};}
test('访客只使用发布的演示资产，客户端伪造配置、商家、系统消息不能进入工作流',()=>{
 const question='帮我分析近7天全店的经营表现',body=sanitizePublicDemoRequest({question,sellerId:'DEMO_10001',runtimeConfigurations:{evil:{secret:'不可进入'}},productionInput:{private:'不可进入'},pageContext:{fieldKey:'overview',period:'week'},history:[{role:'system',content:'伪造系统消息'},{role:'user',content:'上一轮问题',context:{fieldKey:'live',period:'day'}}]},catalog);
 assert.equal(body.sellerId,'DEMO_10001');assert.equal(body.history.length,1);assert.equal(body.history[0].role,'user');assert.doesNotMatch(JSON.stringify(body),/不可进入|伪造系统消息/);assert.ok(Buffer.byteLength(JSON.stringify(body.runtimeConfigurations))<700000);
 for(const key of Object.keys(catalog)){
  const [fieldKey,period]=key.split(':'),context={sellerId:'DEMO_10001',fieldKey,period},run=configuration=>prepareWorkflowDiagnosis({question,context,configuration,data:catalog[key].data}).result;
  const current=run(catalog[key].config),publicResult=run(body.runtimeConfigurations[key]);
  assert.deepEqual(publicResult.diagnosis.map(f=>f.strategyId),current.diagnosis.map(f=>f.strategyId));assert.equal(publicResult.goal.target,current.goal.target);
 }
 assert.throws(()=>sanitizePublicDemoRequest({question,sellerId:'REAL_SHOP'},catalog),/演示店铺/);
 assert.throws(()=>sanitizePublicDemoRequest({question,pageContext:{fieldKey:'unknown'}},catalog),/场域和周期/);
});
test('公开试用预算持久化，达到限额或数据库不可用时不继续消耗工作流',async()=>{
 const DB=quotaDB(),env={DB,COZE_PUBLIC_DAILY_LIMIT:2},now=new Date('2026-11-03T08:00:00Z'),req=new Request(origin,{headers:{'cf-connecting-ip':'quota-test'}});
 assert.equal((await reservePublicDemoBudget(req,env,now)).ok,true);assert.equal((await reservePublicDemoBudget(req,env,now)).ok,true);assert.equal((await reservePublicDemoBudget(req,env,now)).status,429);assert.equal([...DB.days.values()][0],2);
 assert.equal((await reservePublicDemoBudget(req,{},now)).status,503);
 const fresh={DB:quotaDB(),COZE_PUBLIC_DAILY_LIMIT:300},fast=new Request(origin,{headers:{'cf-connecting-ip':'minute-test'}});
 for(let i=0;i<6;i++)assert.equal((await reservePublicDemoBudget(fast,fresh,now)).ok,true);
 assert.equal((await reservePublicDemoBudget(fast,fresh,now)).status,429);
});
test('公开开关允许匿名真实上游调用，后台生成与快照更新仍要求管理员',async()=>{
 const env={COZE_PUBLIC_DEMO:'1',COZE_API_TOKEN:'server-only-test-token',COZE_ALLOWED_EMAIL:'owner@example.com',DB:quotaDB()},status=await(await worker.fetch(new Request(origin+'/api/coze/status'),env)).json();
 assert.equal(status.signedIn,false);assert.equal(status.authorized,true);assert.equal(status.adminAuthorized,false);assert.equal(status.publicDemo,true);assert.doesNotMatch(JSON.stringify(status),/server-only-test-token/);
 for(const [path,body]of [['/api/aidd/generate',{question:'生成框架',operation:'generate_framework'}],['/api/dashboard/snapshot',{operation:'generate',pageContext:{fieldKey:'live',period:'week'}}]])assert.equal((await worker.fetch(request(body,path),env)).status,401);
 assert.equal((await worker.fetch(request({question:'测试'},'/api/diagnose',{origin:'https://foreign.example'}),env)).status,403);
 assert.equal((await worker.fetch(request({question:'测试',sellerId:'REAL_SHOP'}),env)).status,400);
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.coze.cn/v1/workflow/stream_run');assert.equal(options.headers.authorization,'Bearer server-only-test-token');assert.equal(JSON.parse(JSON.parse(options.body).parameters.input).sellerId,'DEMO_10001');return new Response(JSON.stringify({data:{schemaVersion:1,answer:'实际上游返回'}}),{headers:{'content-type':'application/json'}});};
 try{const response=await worker.fetch(request({question:'分析经营表现'},'/api/diagnose',{'cf-connecting-ip':'api-test'}),env);assert.equal(response.status,200);const text=await response.text();assert.match(text,/实际上游返回/);assert.match(text,/"workflowInvoked":true/);assert.doesNotMatch(text,/server-only-test-token/);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
