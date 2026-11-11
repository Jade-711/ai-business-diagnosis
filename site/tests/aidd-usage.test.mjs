import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {requestAiddModel} from '../worker/aidd-model.js';
import {produceAiddAsset} from '../worker/aidd-production.js';
import {budgetDb} from './budget-db.mjs';

const env=()=>({DEEPSEEK_API_KEY:'private-test-key',DB:budgetDb()});
const usage=(input=100,output=40)=>({input_tokens:input,output_tokens:output,total_tokens:input+output,input_tokens_details:{cached_tokens:20},output_tokens_details:{reasoning_tokens:10}});
const response=(value,u=usage(),status='completed')=>new Response(JSON.stringify({id:'response-test',status,usage:u,...(status==='incomplete'?{incomplete_details:{reason:'max_output_tokens'}}:{}),output:[{type:'message',role:'assistant',content:[{type:'output_text',text:typeof value==='string'?value:JSON.stringify(value)}]}]}));
const options=fetchModel=>({env:env(),systemPrompt:'系统规则',input:'本次资料',format:{type:'json_schema',schema:{}},maxTokens:1024,operation:'generate_framework',phase:'generate',route:'framework',fetchModel});

test('生产统计取 API 实际输入输出，推理与缓存属于子集，不重复加到总 Token',async()=>{
 const result=await requestAiddModel(options(async()=>response({ok:true})));
 const u=result.modelUsage;assert.equal(u.available,true);assert.equal(u.tokens,140);assert.equal(u.inputTokens,100);assert.equal(u.outputTokens,40);assert.equal(u.reasoningTokens,10);assert.equal(u.cachedInputTokens,20);assert.equal(u.callCount,1);assert.ok(u.durationMs>=0);
 assert.doesNotMatch(JSON.stringify(u),/private-test-key|系统规则|本次资料/);
});
test('JSON 重试合计全部请求的实际用量，保留每次 API 凭据',async()=>{
 let count=0;const result=await requestAiddModel(options(async()=>++count===1?response('{',usage(100,40)):response({ok:true},usage(200,60))));
 assert.equal(result.modelUsage.tokens,400);assert.equal(result.modelUsage.inputTokens,300);assert.equal(result.modelUsage.outputTokens,100);assert.equal(result.modelUsage.reasoningTokens,20);assert.equal(result.modelUsage.callCount,2);assert.equal(result.modelUsage.calls.length,2);
});
test('缺失或矛盾的 usage 不报成零，也不将最后一次成功的用量冒充整次生产用量',async()=>{
 for(const u of [undefined,{...usage(),total_tokens:999}]){
  const payload=await response({ok:true}).json();payload.usage=u;
  const result=await requestAiddModel(options(async()=>new Response(JSON.stringify(payload))));
  assert.equal(result.modelUsage.available,false);assert.equal(result.modelUsage.tokens,undefined);
 }
 let count=0;const result=await requestAiddModel(options(async()=>{
  if(++count===1){const p=await response('{').json();delete p.usage;return new Response(JSON.stringify(p));}
  return response({ok:true});
 }));
 assert.equal(result.modelUsage.callCount,2);assert.equal(result.modelUsage.available,false);assert.equal(result.modelUsage.tokens,undefined);assert.equal(result.modelUsage.calls[1].tokens,140);
});
test('已计费的截断或候选校验失败仍提供用量和生产耗时，调用前阻止则明确零次',async()=>{
 const metric={id:'m',name:'指标',unit:'次'},scene={id:'s',metricIds:['m'],actionIds:[]};
 const input={operation:'generate_framework',productionInput:{phase:'generate',frameworkName:'框架',scenes:[scene],metrics:[metric],actions:[],scope:'商家',goal:'核查指标'}};
 for(const [fetchModel,tokens] of [[async()=>response({},usage(),'incomplete'),140],[async()=>response({bad:true}),280]]){
  await assert.rejects(()=>produceAiddAsset(input,env(),{fetchModel}),error=>{
   assert.equal(error.productionUsage.status,'failed');assert.equal(error.productionUsage.modelUsage.tokens,tokens);assert.equal(error.productionUsage.cozeTokens,0);assert.ok(error.productionUsage.durationMs>=0);return true;
  });
 }
 const rejected=await produceAiddAsset({...input,productionInput:{...input.productionInput,metrics:[]}},env(),{fetchModel:()=>{throw Error('不得调用');}});
 assert.equal(rejected.productionUsage.modelUsage.callCount,0);assert.equal(rejected.productionUsage.modelUsage.tokens,0);
});

const rulesSource=(await readFile(new URL('../shared/production-rules.js',import.meta.url),'utf8')).replace(/^export /gm,'');
const frontend=await readFile(new URL('../web/production-usage.js',import.meta.url),'utf8');
const client=await readFile(new URL('../web/coze-client.js',import.meta.url),'utf8');
const storage=await readFile(new URL('../web/catalog-storage.js',import.meta.url),'utf8');
function context(){
 const c=vm.createContext({Date,Response,TextDecoder,document:{addEventListener(){}},clone:value=>JSON.parse(JSON.stringify(value)),esc:value=>String(value).replaceAll('<','&lt;')});
 vm.runInContext(rulesSource+'\n'+frontend+'\n'+storage+'\n'+client,c);return c;
}
const receipt=(phase='generate',id='request-1')=>({schemaVersion:1,id,phase,status:'completed',durationMs:10234,elapsedMs:11000,cozeTokens:0,assetCount:1,modelUsage:{available:true,provider:'DeepSeek',tokens:140,inputTokens:100,outputTokens:40,reasoningTokens:10,cachedInputTokens:20,callCount:1}});

test('生成与审核解析分别持久保存，刷新解码后仍显示实际耗时与两类 Token',()=>{
 const c=context(),asset={};c.aiddSaveProductionUsage(asset,{productionUsage:receipt()});c.aiddSaveProductionUsage(asset,{productionUsage:receipt('confirm','parse-2')});
 const saved=c.aiddStorageDecode(c.aiddStorageEncode(asset));assert.equal(saved.productionUsage.generate.id,'request-1');assert.equal(saved.productionUsage.confirm.id,'parse-2');
 const html=c.aiddProductionUsageHTML(saved);assert.match(html,/最近一次生成/);assert.match(html,/最近一次审核解析/);assert.match(html,/11.0 秒/);assert.match(html,/140 Token/);assert.match(html,/Coze <b>0 Token/);assert.match(html,/含推理 10/);assert.doesNotMatch(html,/170 Token/);
 assert.match(c.aiddProductionUsageHTML({},true),/未记录/);
 const unknown=receipt();unknown.modelUsage={available:false,callCount:1};assert.match(c.aiddProductionUsageHTML({productionUsage:{generate:unknown}}),/未完整返回实际 Token/);
});
test('框架与策略接收同一份服务端用量，重新生成清除旧稿解析统计，多候选不平摊虚构 Token',async()=>{
 const c=context();c.aiddIsOnline=()=>true;c.aiddFrameProductionInput=()=>({});c.aiddFrameScene=()=>({fieldKey:'video'});c.aiddNow=()=>'';
 c.aiddProductionRequest=async()=>({status:'needs_review',candidate:{id:'frame',branches:[],draftText:'新稿'},draftText:'新稿',productionUsage:receipt()});
 const frame={id:'frame',generation:1,productionUsage:{confirm:receipt('confirm')}};await c.cozeBuildFrameDraft(frame);
 assert.equal(frame.productionUsage.generate.modelUsage.tokens,140);assert.equal(frame.productionUsage.confirm,undefined);
 c.cozeProductionInput=()=>({});c.aiddStrategyTemplate=()=>'';c.aiddData={scenes:[{id:'s'}]};c.aiddBuildSceneCandidate=()=>({});let id=0;c.aiddId=()=>String(++id);c.aiddValidateStrategy=()=>'';c.aiddFind=()=>null;
 const shared=receipt();shared.assetCount=2;c.aiddProductionRequest=async()=>({status:'needs_review',candidate:[{id:'a',sceneId:'s',actionIds:[]},{id:'b',sceneId:'s',actionIds:[]}],productionUsage:shared});
 const strategies=await c.cozeGenerateStrategies({sceneIds:['s'],goal:'目标',scope:'商家'});
 assert.equal(strategies.length,2);assert.equal(strategies[0].productionUsage.generate.id,strategies[1].productionUsage.generate.id);assert.equal(strategies[1].productionUsage.generate.modelUsage.tokens,140);assert.match(c.aiddProductionUsageHTML(strategies[0]),/整次请求合计/);
});
test('SSE 结果和失败事件均传递生产凭据，并记录浏览器提交到完整返回的耗时',async()=>{
 const c=context();c.fetch=async()=>new Response('event: result\ndata: '+JSON.stringify({productionUsage:receipt()})+'\n\n',{headers:{'content-type':'text/event-stream'}});
 const result=await c.cozeRequest({operation:'generate_framework'});assert.ok(result.productionUsage.elapsedMs>=0);assert.equal(result.productionUsage.modelUsage.tokens,140);
 const failed={...receipt(),status:'failed'};c.fetch=async()=>new Response('event: error\ndata: '+JSON.stringify({error:'结果截断',productionUsage:failed})+'\n\n',{headers:{'content-type':'text/event-stream'}});
 await assert.rejects(()=>c.cozeRequest({operation:'generate_strategies'}),error=>error.message==='结果截断'&&error.productionUsage.modelUsage.tokens===140);
});

test('完整JSON仅包一层代码块时直接校验，不因包装重试；附带说明或破损JSON仍拒绝',async()=>{
 for(const wrapper of [text=>'```json\n'+text+'\n```',text=>'```\n'+text+'\n```']){
  let calls=0;const result=await requestAiddModel(options(async()=>{calls++;return response(wrapper('{"ok":true}'));}));
  assert.equal(result.parsed.ok,true);assert.equal(calls,1);assert.equal(result.modelUsage.tokens,140);
 }
 for(const text of ['这是结果\n```json\n{"ok":true}\n```','```json\n{"ok":true}\n```\n附带说明','```json\n{"ok":\n```']){
  let calls=0;await assert.rejects(()=>requestAiddModel(options(async()=>{calls++;return response(text);})),/未完整返回/);assert.equal(calls,2);
 }
});
