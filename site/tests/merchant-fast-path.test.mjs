import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {merchantFastResult} from '../worker/merchant-fast-path.js';
const catalog=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8'));
const baseline=JSON.parse(await readFile(new URL('./fixtures/published-diagnosis-baseline.json',import.meta.url),'utf8'));
const request=(question,more={})=>({question,sellerId:'DEMO_10001',pageContext:{fieldKey:'overview',period:'week'},...more});

test('20个P0双周期场景保留既有资产和原始数值，合成样本口径修正后的命中符合业务案例',()=>{
 assert.equal(baseline.length,20);
 for(const b of baseline){
  const fast=merchantFastResult(request(b.question),catalog);assert.ok(fast,b.question);
  const r=fast.result;
  assert.equal(r.status,b.status,b.question);assert.equal(r.execution.frameworkName,b.framework,b.question);
  assert.equal(r.execution.selectedStrategyIds.length,b.strategies+(['货架整体诊断框架','达人合作整体诊断框架'].includes(b.framework)?1:0),b.question);
  // Yesterday's refund ratio is now calculated from the aligned payment
  // cohort (6.2% on both dates); settlement-day commission no longer has an
  // artificial daily trend relative to transaction-day sales.
  const reviewedHits={'全店-整体交易诊断框架':b.question.includes('昨日')?1:2,'全店-整体流量诊断框架':1,'全店-整体转化诊断框架':1,'全店-商品供给诊断框架':1,'全店-服务体验诊断框架':4,'全店-用户经营诊断框架':1,'直播整体诊断框架':1,'短视频整体诊断框架':1,'货架整体诊断框架':1,'达人合作整体诊断框架':b.question.includes('昨日')?1:3};
  assert.equal(r.diagnosis.length,reviewedHits[b.framework],b.question);
  if(b.framework==='直播整体诊断框架')assert.equal(r.diagnosis[0].strategyId,'research-strategy-07-4');
  assert.deepEqual(r.evidence.map(e=>e.metricId).sort(),[...b.evidence].sort(),b.question);
  const metrics=catalog[r.context.fieldKey+':'+r.context.period].data.metrics;
  for(const e of r.metricAnalysis){const m=metrics.find(m=>m.id===e.metricId);assert.equal(e.value,m.value);assert.equal(e.unit,m.unit);assert.equal(e.previousValue,m.previousValue);}
  const approved=catalog[r.context.fieldKey+':'+r.context.period].config;
  for(const d of r.diagnosis){assert.equal(d.analysis.basis,'returned_evidence');assert.ok(d.analysis.facts.length);assert.equal(d.explanation,d.analysis.reason);assert.ok(d.actionIds.every(id=>approved.actions.some(a=>a.id===id)));}
 }
});

test('目标与查数不等待模型，明确新指标只返回对应证据、规则和行动',()=>{
 const goal=merchantFastResult(request('帮我分析近7天全店的目标差距'),catalog);
 assert.equal(goal.route,'goal_calculation');assert.equal(goal.result.metricAnalysis.find(m=>m.metricId==='research-metric-trade-01').value,190000);
 for(const intent of ['近7天直播的观看人数是多少','帮我分析近7天直播的观看人数变化的原因和改善建议']){
  const r=merchantFastResult(request(intent),catalog).result;
  assert.equal(r.context.fieldKey,'live');assert.equal(r.evidence.length,1);assert.equal(r.evidence[0].metricId,'research-metric-live-10');assert.equal(r.evidence[0].value,12000);assert.equal(r.evidence[0].previousValue,16000);
  if(r.branch==='diagnosis'){assert.equal(r.diagnosis.length,1);assert.deepEqual(r.actions.map(a=>a.name),['创建直播计划','直播投流']);}
 }
 for(const q of ['查一下近7天全店的经营数据','帮我分析近7天全店的成交金额与订单量同时回落，以及下一步应该怎么做','帮我分析近7天全店的支付日口径退款率上升，以及下一步应该怎么做'])assert.ok(merchantFastResult(request(q),catalog),q);
});
test('直播成交金额入口使用整体框架，指标取数与定义保持相同别名，进展数量与最终证据一致',()=>{
 const q='帮我分析近7天直播的成交金额变化的原因和改善建议',r=merchantFastResult(request(q),catalog);
 assert.equal(r.result.execution.frameworkName,'直播整体诊断框架');
 assert.equal(r.result.metricAnalysis.length,1);assert.equal(r.result.metricAnalysis[0].metricId,'research-metric-live-02');assert.equal(r.result.metricAnalysis[0].value,80000);
 const data=merchantFastResult(request('近7天直播的成交金额是多少'),catalog).result;
 assert.equal(data.status,'success');assert.equal(data.evidence.length,1);assert.equal(data.evidence[0].value,80000);
 const stage=merchantFastResult(request('分析近7天直播转化'),catalog),evidence=stage.updates.find(e=>e.kind==='evidence').metrics;
 assert.ok(evidence.length>0);assert.deepEqual(evidence.map(m=>m.metricId).sort(),[...new Set([...stage.result.evidence,...stage.result.metricAnalysis].map(m=>m.metricId))].sort());
});

test('使用本次已发布快照和服务端数值，停用配置、缺失数据及零值不伪造成正常',()=>{
 const local=structuredClone(catalog),config=structuredClone(local['live:week'].config);
 config.strategies=config.strategies.map(s=>({...s,enabled:false}));
 const body=request('分析近7天直播整体经营',{runtimeConfigurations:{'live:week':config},data:{metrics:[{value:999999999}]}});
 let r=merchantFastResult(body,local).result;assert.equal(r.diagnosis.length,0);assert.equal(r.evidence.find(m=>m.metricId==='research-metric-live-10').value,12000);
 config.active=false;r=merchantFastResult(body,local).result;assert.equal(r.status,'missing_data');
 const data=request('近7天直播的观看人数是多少');local['live:week'].data.metrics.find(m=>m.id==='research-metric-live-10').value=null;
 r=merchantFastResult(data,local).result;assert.equal(r.status,'missing_data');assert.match(r.missing.join(''),/缺失/);
 local['live:week'].data.metrics.find(m=>m.id==='research-metric-live-10').value=0;r=merchantFastResult(data,local).result;assert.equal(r.status,'success');assert.equal(r.evidence[0].value,0);
});

test('模糊、额外维度、模型内容策略和真实商家请求保持原工作流，不偷换分析问题',()=>{
 for(const q of ['什么是商品点击率，怎么理解它？','分析近7天广州用户的观看人数','分析近7天直播标题为什么不好','预测直播下周成交额','对比近7天直播和短视频的经营表现','分析近7天直播观看人数和成交金额','帮我分析退款具体原因'])assert.equal(merchantFastResult(request(q),catalog),null,q);
 assert.equal(merchantFastResult(request('分析近7天直播经营表现',{sellerId:'REAL_SHOP'}),catalog),null);
 const local=structuredClone(catalog);local['live:week'].config.strategies.find(s=>s.sceneId==='research-scene-007').execution='模型理解';assert.equal(merchantFastResult(request('分析近7天直播整体经营'),local),null);
 local['live:week'].data.synthetic=false;assert.equal(merchantFastResult(request('近7天直播的观看人数是多少'),local),null);
 assert.equal(merchantFastResult(request('分析近7天直播整体经营',{runtimeConfigurations:{'live:week':null}}),catalog),null);
});

test('保留明确提问、历史及页面范围优先级，未接周期必须澄清',()=>{
 const history=[{role:'assistant',content:'直播观看人数',context:{fieldKey:'live',period:'week',metricKey:'research-metric-live-10'}}];
 const r=merchantFastResult(request('那昨天直播的观看人数呢',{history}),catalog);assert.equal(r,null); // not a supported request shape: original semantic router decides
 const changed=merchantFastResult(request('分析昨日短视频整体经营',{history}),catalog).result;assert.equal(changed.context.fieldKey,'video');assert.equal(changed.context.period,'day');assert.equal(changed.context.metricKey,'');
 const inherited=merchantFastResult(request('这个指标是多少',{pageContext:{fieldKey:'live',period:'week',metricKey:'research-metric-live-10'}}),catalog).result;assert.equal(inherited.evidence[0].metricId,'research-metric-live-10');
 const stale=[{role:'assistant',content:'成交金额',context:{fieldKey:'live',period:'week',metricKey:'gmv'}}];
 const pageWins=merchantFastResult(request('这个指标是多少',{pageContext:{fieldKey:'live',period:'week',metricKey:'research-metric-live-10'},history:stale}),catalog).result;assert.equal(pageWins.evidence[0].metricId,'research-metric-live-10');
 const issueWins=merchantFastResult(request('帮我分析近7天直播成交金额回落，以及下一步应该怎么做',{history:[{role:'assistant',content:'观看人数',context:{fieldKey:'live',period:'week',metricKey:'exposure'}}]}),catalog).result;assert.equal(issueWins.diagnosis.length,1);assert.deepEqual(issueWins.execution.selectedStrategyIds,['research-strategy-07-4']);assert.equal(issueWins.metricAnalysis[0].metricId,'research-metric-live-02');
 assert.equal(merchantFastResult(request('分析近7天直播成交规模回落',{history}),catalog),null);
 assert.equal(merchantFastResult(request('分析全店整体交易和整体流量'),catalog),null);
 const broad=merchantFastResult(request('分析全店整体流量',{history}),catalog).result;assert.equal(broad.context.fieldKey,'overview');assert.match(broad.execution.frameworkName,/整体流量/);
 for(const q of ['分析近30天直播观看人数','分析今天直播整体经营','分析昨日和近7天全店表现']){const result=merchantFastResult(request(q),catalog).result;assert.equal(result.branch,'clarification');assert.match(result.answer,/周期|时间范围/);}
});

test('实际部署包的常规经营、目标和指标诊断全部调用工作流，失败不会降级为规则答案',async()=>{
 const built=await readFile(new URL('../dist/server/index.js',import.meta.url),'utf8'),worker=(await import('data:text/javascript;base64,'+Buffer.from(built).toString('base64'))).default;
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async url=>{calls++;assert.equal(url,'https://api.coze.cn/v1/workflow/stream_run');return new Response(JSON.stringify({data:{result:{schemaVersion:1,branch:'diagnosis',answer:'本轮工作流模型结论',workflowContract:1,workflow:{modelOutputReceived:true}}}}),{headers:{'content-type':'application/json'}});};
 const origin='https://qa.chatgpt.site',env={COZE_ALLOWED_EMAIL:'fast@example.com',COZE_API_TOKEN:'fake-only'};
 const req=(q,authorized=true)=>new Request(origin+'/api/diagnose',{method:'POST',headers:{origin,'content-type':'application/json',...(authorized?{'oai-authenticated-user-email':'fast@example.com'}:{})},body:JSON.stringify(request(q))});
 try{
  assert.equal((await worker.fetch(req('分析全店',false),env)).status,401);assert.equal(calls,0);
  for(const q of ['帮我分析近7天全店的经营表现','帮我分析近7天全店的目标差距','分析近7天直播成交金额下降20%的原因']){
   const stream=await(await worker.fetch(req(q),env)).text();assert.doesNotMatch(stream,/event: error/);
   const frame=stream.split('\n\n').find(x=>x.startsWith('event: result')),result=JSON.parse(frame.match(/^data: (.*)$/m)[1]);
   assert.equal(result.answer,'本轮工作流模型结论');assert.equal(result.performance.route,'coze_workflow');assert.equal(result.performance.modelInvoked,true);assert.equal(result.performance.workflowInvoked,true);assert.equal(result.performance.modelEvidenceSource,'workflow_model_output');
  }
  assert.equal(calls,3);globalThis.fetch=async()=>{throw Error('上游离线');};const failed=await(await worker.fetch(req('帮我分析近7天全店的经营表现'),env)).text();assert.match(failed,/event: error/);assert.doesNotMatch(failed,/event: result|published_rules/);
 }finally{globalThis.fetch=original;}
});
