import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=name=>readFile(new URL('../web/'+name+'.js',import.meta.url),'utf8');
const source=await read('curated-catalog');
const catalog=JSON.parse(source.slice(source.indexOf('= ')+2).trim().replace(/;$/,''));
const metrics=catalog.metrics.filter(m=>['09','10','14'].some(suffix=>m.id==='research-metric-live-'+suffix));
const scene=catalog.scenes.find(s=>s.id==='research-scene-012');
const frame={id:'draft-live',assetId:'draft-live',sceneId:scene.id,name:'当前曝光框架',status:'待生效',draftText:'曝光下降先看本期与前期；来源原因需要明细。',goal:'定位覆盖与承接',scope:'商家',generation:1,version:3,metricIds:metrics.map(m=>m.id),actionIds:[],branches:[],caseId:'DEMO_10003',casePeriod:'week'};
async function context(){
 const store=new Map(),error={textContent:''};let timerCleared=false;
 const c=vm.createContext({Date,document:{addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},setInterval:()=>1,clearInterval:()=>{timerCleared=true;},FormData:class{constructor(values){this.values=values;}get(key){return this.values[key];}}});
 const app=await read('app');vm.runInContext(app.slice(0,app.indexOf('const NODES =')),c);
 vm.runInContext('const MERCHANT_FIELDS={};function toast(){};function render(){};function pill(value){return value;}function aiddInput(name,value){return value;}function aiddFind(type,id){return aiddData[type].find(item=>item.id===id);}function periodRange(){return "10.26—11.01";}',c);
 for(const name of ['aidd-data','production-usage','framework-ui','coze-client'])vm.runInContext(await read(name),c);
 c.fixture={scenes:[scene],metrics,actions:[],frameworks:[structuredClone(frame)],published:{},demoData:{metrics:catalog.demoData.metrics},catalog:true};
 vm.runInContext('aiddData=fixture;aiddUI.frameId="draft-live";function aiddCuratedSample(metric,period){return aiddData.demoData.metrics[metric.id]?.[period];}',c);
 c.document.querySelector=selector=>selector==='#frame-trial-error'?error:null;c.aiddIsOnline=()=>true;
 return {c,error,store,cleared:()=>timerCleared};
}
const evaluate=(c,expression)=>JSON.parse(vm.runInContext('JSON.stringify('+expression+')',c));
test('直播低曝光案例按三个当前资产提供本期与前期，与案例可选性及发送数据一致，未借旧商品点击率',async()=>{
 const {c}=await context();
 const options=evaluate(c,'aiddFrameCaseOptions(aiddSelectedFrame())');assert.ok(options.every(o=>o.available));
 const low=options.find(o=>o.sample.id==='DEMO_10003');assert.deepEqual(low.metricValues.map(m=>[m.id,m.value,m.previousValue]),metrics.map(m=>[m.id,{'09':260,'10':52,'14':20}[m.id.slice(-2)],{'09':1000,'10':200,'14':20}[m.id.slice(-2)]]));
 const payload=evaluate(c,`cozeProductionInput({sceneIds:['${scene.id}'],metricIds:${JSON.stringify(frame.metricIds)},actionIds:[]},{phase:'test',sample:SAMPLE.small,period:'week'})`);
 assert.deepEqual(payload.trialCases[0].metricValues,low.metricValues);assert.match(payload.trialCases[0].dataNote,/固定合成/);
 assert.equal(payload.trialCases[0].metricValues.find(m=>m.id.endsWith('-14')).value,20);
 assert.equal(evaluate(c,"aiddFrameCaseOptions(aiddSelectedFrame(),'day').find(o=>o.sample.id==='DEMO_10003').available"),true);
});
test('增加案例没有的指标时禁用选择并解释缺口，手填ID也在模型调用前拒绝',async()=>{
 const {c,error}=await context();
 vm.runInContext("aiddData.metrics.push({id:'custom',fieldKey:'live',name:'自然来源曝光人数',dataType:'Double'});aiddSelectedFrame().metricIds.push('custom')",c);
 const option=evaluate(c,"aiddFrameCaseOptions(aiddSelectedFrame()).find(o=>o.sample.id==='DEMO_10003')");assert.equal(option.available,false);assert.match(option.reasons.join('；'),/自然来源曝光人数/);
 let calls=0;c.cozeTrialFramework=async()=>{calls++;};
 await c.aiddRunFrameworkTrial({merchantId:'DEMO_10003',period:'week'});assert.equal(calls,0);assert.match(error.textContent,/自然来源曝光人数/);
});
test('试跑中显示实时耗时，模型失败仍保存真实用量并在试跑卡中呈现，不借上次生成的数字',async()=>{
 const {c,cleared}=await context();let during='';
 const receipt={schemaVersion:1,id:'failed-test',phase:'test',status:'failed',elapsedMs:12400,cozeTokens:0,modelUsage:{available:true,tokens:3200,inputTokens:2000,outputTokens:1200,callCount:1}};
 c.cozeReviewProduction=async()=>{during=c.aiddFrameTrialPanel(vm.runInContext('aiddSelectedFrame()',c));const error=new Error('模型引用未选指标');error.productionUsage=receipt;throw error;};
 await c.aiddRunFrameworkTrial({merchantId:'DEMO_10003',period:'week'});
 assert.match(during,/frame-trial-elapsed/);assert.match(during,/接口返回后显示/);assert.doesNotMatch(during,/3,200 Token/);
 const saved=evaluate(c,'aiddSelectedFrame()');assert.equal(saved.testing,undefined);assert.equal(saved.trialStartedAt,undefined);assert.equal(saved.trial,null);assert.equal(saved.productionUsage.test.modelUsage.tokens,3200);assert.equal(cleared(),true);
 const after=c.aiddFrameTrialPanel(saved);assert.match(after,/最近一次案例试跑 · 未完成/);assert.match(after,/12.4 秒/);assert.match(after,/3,200 Token/);
});
test('全部10个P0和26个P1框架在双周期至少有一个可选案例，跨场域关联指标不被过滤',async()=>{
 const {c}=await context();c.catalogFixture=catalog;
 vm.runInContext('aiddData=catalogFixture',c);
 const rows=evaluate(c,`aiddData.scenes.filter(s=>['P0','P1'].includes(s.priority)).flatMap(scene=>['week','day'].map(period=>{const frame=aiddData.frameworks.find(f=>f.sceneId===scene.id),sample=aiddFrameCases(frame,period)[0],payload=sample&&cozeProductionInput({sceneIds:[scene.id],metricIds:frame.metricIds,actionIds:frame.actionIds},{phase:'test',period,sample});return {scene:scene.name,priority:scene.priority,period,available:!!sample,selected:frame.metricIds.slice().sort(),submitted:payload?.trialCases[0].metricValues.map(m=>m.id).sort(),previous:payload?.trialCases[0].metricValues.every(m=>Number.isFinite(m.previousValue))};}))`);
 assert.equal(rows.length,72);assert.equal(rows.filter(row=>row.priority==='P0').length,20);
 for(const row of rows){assert.equal(row.available,true,row.scene+' '+row.period);assert.deepEqual(row.submitted,row.selected,row.scene+' '+row.period);assert.equal(row.previous,true,row.scene+' '+row.period);}
});
