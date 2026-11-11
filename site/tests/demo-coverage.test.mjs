import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=name=>readFile(new URL('../web/'+name+'.js',import.meta.url),'utf8');
async function demo(){
 const context=vm.createContext({localStorage:{getItem:()=>null,setItem(){}},document:{addEventListener(){}},window:{addEventListener(){}}});
 const app=await read('app');vm.runInContext(app.slice(0,app.indexOf('const NODES =')),context);
 for(const name of ['merchant-data','merchant-ui','demo-coverage','production-rules','aidd-data','production-usage','aidd-ui','framework-prompt','framework-ui','strategy-ui','ai-strategy-ui','coze-client'])vm.runInContext(await read(name),context);
 vm.runInContext('initAidd()',context);return context;
}
test('已有浏览器只保存四类指标时，新增演示规则也取得对应资产',async()=>{
 const c=await demo();
 const result=vm.runInContext(`(()=>{
  const oldKeys=['gmv','exposure','clickRate','payRate'];
  aiddData.metrics=aiddData.metrics.filter(m=>oldKeys.includes(m.metricKey));
  const kept=new Set(aiddData.metrics.map(m=>m.id));
  for(const s of aiddData.scenes)s.metricIds=s.metricIds.filter(id=>kept.has(id));
  aiddData.demoCoverageVersion=1;aiddCompleteDemoCoverage(aiddData);
  const config=aiddRuntimeConfig('overview','week');
  return {version:aiddData.demoCoverageVersion,count:config.metrics.length,rows:aiddMerchantRows('overview','week',config).map(x=>x.title),valid:Object.keys(MERCHANT_FIELDS).every(f=>['week','day'].every(p=>{const x=aiddRuntimeConfig(f,p);return x.metrics.length>=Object.keys(MERCHANT_FIELDS[f].metrics).length*2;}))};
 })()`,c);
 assert.equal(result.version,2);assert.equal(result.count,14);assert.equal(result.valid,true);
 assert.ok(result.rows.includes('支付人数变化需核查'));assert.ok(result.rows.includes('支付订单数变化需核查'));
 assert.ok(!result.rows.includes('对标数据待补充'));
});
test('补齐演示资产保留主动下线场景和用户已编辑的指标',async()=>{
 const c=await demo();
 const result=vm.runInContext(`(()=>{const s=aiddData.scenes.find(s=>s.fieldKey==='video');s.status='已下线';const m=aiddData.metrics.find(m=>m.id==='overview-gmv-value');m.description='用户自定义口径';aiddData.demoCoverageVersion=1;aiddCompleteDemoCoverage(aiddData);return {offline:s.status,description:m.description};})()`,c);
 assert.equal(result.offline,'已下线');assert.equal(result.description,'用户自定义口径');
});
test('结构化模型的叶子条件带空children时，保留原判断并可在后台审核',async()=>{
 const c=await demo();
 const result=await vm.runInContext(`(async()=>{
  const metricIds=['live-exposure-value','live-clickRate-change'],actionIds=['action-live-0'];
  aiddProductionRequest=async()=>({status:'needs_review',candidate:[{sceneId:'scene-live',name:'联调候选',execution:'指标规则',metricIds,actionIds,rule:{join:'AND',children:[{metricId:metricIds[0],op:'>=',rightType:'number',value:5000,children:[]},{metricId:metricIds[1],op:'<=',rightType:'number',value:-15,children:[]}]}}]});
  const candidates=await cozeGenerateStrategies({sceneIds:['scene-live'],goal:'识别点击回落',scope:'跃迁期',metricIds,actionIds});
  const s=candidates[0];return {count:candidates.length,hit:aiddEvaluateRule(s.rule,aiddData.metrics,'week'),status:s.status,threshold:s.rule.children[1].value};
 })()`,c);
 assert.equal(result.count,1);assert.equal(result.hit,true);assert.equal(result.status,'待生效');assert.equal(result.threshold,-15);
});
test('空条件组仍被后台拒绝，不以默认规则替代模型候选',async()=>{
 const c=await demo();
 const error=vm.runInContext(`aiddValidateRule(cozeNormalizeRule({join:'AND',children:[]}),aiddScene('scene-live'))`,c);
 assert.equal(error,'每个条件组至少需要一条条件');
});
