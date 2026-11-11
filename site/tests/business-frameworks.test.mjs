import test from 'node:test';
import assert from 'node:assert/strict';
import {auditBusinessCatalog,catalog,executeScene} from '../scripts/audit-business-frameworks.mjs';
import {configurationPayload,workflowInputPayload,videoExposureConsistencyErrors} from '../worker/resource-contract.js';
import {prepareWorkflowDiagnosis} from '../shared/workflow-diagnosis.js';
import {readFile} from 'node:fs/promises';
const runtime=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8'));
const scene=name=>catalog.scenes.find(s=>s.name===name),strategies=name=>catalog.strategies.filter(s=>s.sceneId===scene(name).id);
const change=(name,values)=>Object.fromEntries(Object.entries(values).map(([label,[value,previousValue]])=>{const id=catalog.metrics.find(m=>scene(name).metricIds.includes(m.id)&&m.originalName===label).id;return [id,{value,previousValue}];}));
const hits=(name,values)=>executeScene(scene(name),strategies(name),change(name,values)).ruleResults.filter(r=>r.triggered).map(r=>r.name);
test('逐场景审阅具体问题、行动与证据边界，穷举同组变化组合不存在重复命中',()=>{
 const report=auditBusinessCatalog();assert.deepEqual(report.errors,[]);assert.equal(report.scenes.length,91);assert.ok(report.checks.exclusiveAssignments>500);assert.equal(report.checks.evidenceBoundaries,114);
});
test('短视频曝光区分覆盖收缩、重复触达、付费同步收缩及来源待核，不用UV差值冒充自然流量',()=>{
 const n='短视频-曝光';
 assert.deepEqual(hits(n,{'曝光人数':[80,100],'曝光次数':[100,100],'付费渠道曝光用户数':[50,50]}),['曝光人数减少但曝光次数未减']);
 assert.deepEqual(hits(n,{'曝光人数':[80,100],'曝光次数':[80,100],'付费渠道曝光用户数':[40,50]}),['总曝光人数与付费曝光用户同时减少']);
 assert.deepEqual(hits(n,{'曝光人数':[80,100],'曝光次数':[80,100],'付费渠道曝光用户数':[50,50]}),['总曝光缩量但付费曝光用户未减']);
 assert.deepEqual(hits(n,{'曝光人数':[100,100],'曝光次数':[80,100],'付费渠道曝光用户数':[50,50]}),['覆盖人数未减但曝光次数减少']);
 const f=catalog.frameworks.find(f=>f.sceneId===scene(n).id);assert.match(f.prompt,/不能用总UV−付费UV当自然UV/);assert.match(f.prompt,/政策资格/);
 const paid=strategies(n).find(s=>/付费曝光用户同时/.test(s.name));assert.equal(paid.actionIds.length,1);assert.match(paid.actionSubtitles[paid.actionIds[0]],/只有.*确认后/);
});
test('货架加购双重流失不会再同时命中单独加购问题；未筛选货架数据时整体阻断',()=>{
 const n='货架-加购';assert.deepEqual(hits(n,{'商品点击人数':[100,100],'商品加购人数':[80,100],'加购成交转化率':[8,10]}),['加购人数与加购成交率同时下降']);
 assert.deepEqual(hits(n,{'商品点击人数':[100,100],'商品加购人数':[80,100],'加购成交转化率':[10,10]}),['点击未减但加购人数减少']);
 const payload=configurationPayload(catalog.published[scene(n).id].periods.week,'shelf','test',{question:'分析货架加购'});assert.ok(payload.errors.some(e=>/货架售卖方式筛选/.test(e)));
});
test('订单或点击效率未降也不会漏掉货架与达人合作的成交金额下降',()=>{
 assert.deepEqual(hits('货架整体',{'商品卡曝光次数':[100,100],'商品卡点击次数':[100,100],'点击成交率':[10,10],'商品卡成交金额':[80,100],'商品卡退款金额':[10,10]}),['点击与成交率未降但商品卡成交金额下降']);
 assert.deepEqual(hits('达人合作整体',{'成交金额':[80,100],'成交订单数':[100,100],'佣金支出金额(结算日)':[10,10],'成交退款率(金额)':[5,5],'短视频曝光次数':[100,100]}),['订单未减但合作成交金额下降']);
});
test('标题、视频时长、价格和佣金问题缺原始证据时只返回无法判断，不输出原因或行动',()=>{
 for(const n of ['直播-曝光-标题','短视频-观看-视频时长','短视频-成交-商品价格','达人合作-成交-佣金设置']){
  const s=scene(n),config=catalog.published[s.id].periods.week;
  const a=configurationPayload(config,s.fieldKey,'test',{question:'分析'+n,context:{sellerId:'DEMO_10001',fieldKey:s.fieldKey,period:'week'},businessEvidence:{sceneId:s.id,context:{sellerId:'OTHER',fieldKey:s.fieldKey,period:'week'},records:Object.fromEntries(s.requiredEvidence.map(k=>[k,'看起来已满足']))}});
  assert.ok(a.errors.length);const e=executeScene(s,strategies(n),{},a.errors);assert.equal(e.ruleResults.length,0);assert.equal(e.selectedFramework.id,config.frameworkDefinition.id);assert.ok(!e.validationErrors.includes('当前场景没有已生效的诊断配置'));
 }
 const length=catalog.frameworks.find(f=>f.sceneId===scene('短视频-观看-视频时长').id);assert.match(length.prompt,/3秒率不是完播率/);
 const commission=catalog.frameworks.find(f=>f.sceneId===scene('达人合作-成交-佣金设置').id);assert.match(commission.prompt,/必须先匹配订单与费率版本/);
});
test('全店服务具体分项命中时综合体验分只作汇总，不重复成为问题',()=>{
 const c=runtime['overview:week'],r=prepareWorkflowDiagnosis({question:'帮我分析近7天全店的经营表现',context:{sellerId:'DEMO_10001',fieldKey:'overview',period:'week'},configuration:c.config,data:c.data});
 assert.ok(![...r.result.diagnosis,...r.result.pendingIssues].some(d=>d.strategyId==='research-strategy-05-1'));
});
test('工作流实际取得每个问题的具体操作及复核方式，发布协议不退回通用工具介绍',()=>{
 const c=runtime['live:week'],p=workflowInputPayload(c.config,c.data,'live',{question:'分析近7天直播成交金额下降'});
 const r=prepareWorkflowDiagnosis({...p,question:'分析近7天直播成交金额下降',context:{sellerId:'DEMO_10001',fieldKey:'live',period:'week'}});
 assert.equal(r.materials.issues[0].strategyId,'research-strategy-07-4');assert.ok(r.materials.issues[0].actions.every(a=>a.verification&&a.purpose.length>20));assert.match(r.materials.issues[0].actions.find(a=>a.id==='research-action-03').purpose,/货盘|讲解/);
});
test('短视频曝光合成案例满足PV和UV口径，只有一条策略及其行动，完整计算重复触达',()=>{
 const c=runtime['video:week'],p=workflowInputPayload(c.config,c.data,'video',{question:'分析近7天短视频-曝光'});
 const r=prepareWorkflowDiagnosis({...p,question:'分析近7天短视频-曝光',context:{sellerId:'DEMO_10001',fieldKey:'video',period:'week'}});
 assert.deepEqual(r.result.diagnosis.map(x=>x.strategyId),['research-strategy-20-2']);
 assert.deepEqual(r.result.actions.map(x=>x.id),['research-action-26']);assert.deepEqual(r.materials.goalActions,[]);
 const freq=r.materials.issues[0].calculations.find(x=>x.kind==='exposure_frequency');assert.equal(freq.current,2);assert.equal(freq.previous,2);
 for(const period of ['week','day']){
  const rows=runtime['video:'+period].data.metrics;assert.deepEqual(videoExposureConsistencyErrors(rows),[]);
  const pv=rows.find(x=>x.id==='research-metric-video-06'),uv=rows.find(x=>x.id==='research-metric-video-07'),paid=rows.find(x=>x.id==='research-metric-video-21');
  for(let i=0;i<7;i++){assert.ok(pv.currentValues[i]>=uv.currentValues[i]);assert.ok(paid.currentValues[i]<=uv.currentValues[i]);}
 }
});
test('有数值但曝光次数小于人数、付费人数大于总人数时阻断诊断和行动',()=>{
 for(const [id,value,key] of [['research-metric-video-06',204,'value'],['research-metric-video-21',300000,'previousValue']]){
  const c=structuredClone(runtime['video:week']),m=c.data.metrics.find(x=>x.id===id);m[key]=value;
  const p=workflowInputPayload(c.config,c.data,'video',{question:'分析近7天短视频-曝光'}),r=prepareWorkflowDiagnosis({...p,question:'分析近7天短视频-曝光',context:{sellerId:'DEMO_10001',fieldKey:'video',period:'week'}});
  assert.equal(r.result.status,'missing_data');assert.deepEqual(r.result.diagnosis,[]);assert.deepEqual(r.result.actions,[]);assert.ok(r.result.missing.some(x=>x.includes('曝光口径不一致')));
 }
});
