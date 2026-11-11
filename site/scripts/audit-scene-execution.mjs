import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {catalog,executeScene,auditBusinessCatalog} from './audit-business-frameworks.mjs';
import {prepareWorkflowDiagnosis,finalizeWorkflowDiagnosis} from '../shared/workflow-diagnosis.js';
import {workflowInputPayload,metricsPayload} from '../worker/resource-contract.js';
import {sceneEvidenceErrors} from '../shared/scene-routing.js';
const runtime=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8'));
const copy=x=>structuredClone(x),unique=xs=>[...new Set(xs)];
const refs=r=>r.children?unique(r.children.flatMap(refs)):[r.metricId];
const compare=(a,op,b)=>({'<':a<b,'<=':a<=b,'>':a>b,'>=':a>=b,'==':a===b,'!=':a!==b})[op];
const judge=(r,values)=>r.children?(r.join==='OR'?r.children.some(c=>judge(c,values)):r.children.every(c=>judge(c,values))):compare(values[r.metricId],r.op,100);
const combinations=ids=>Array.from({length:3**ids.length},(_,n)=>Object.fromEntries(ids.map(id=>{const value=[80,100,120][n%3];n=Math.floor(n/3);return [id,value];})));
const question=(scene,period)=>'请诊断'+(period==='week'?'近7天':'昨日')+'“'+scene.name+'”场景，说明指标拆解、具体问题、已确认与待验证的原因、行动建议和执行前提。';
const modelFor=c=>({summary:'测试用模型概述',explanations:c.materials.issues.map(i=>({strategyId:i.strategyId,judgment:'本轮仅确认已列明的指标变化，具体原因待核。',basis:i.facts.join('；')||'仅有汇总变化，不能确认具体经营原因。',uncertainty:'需取得同对象明细和可比对照，暂未确认具体原因。',actions:i.actions.slice(0,1).map(a=>({actionId:a.id,text:'先人工核对同对象明细；若确认相应配置问题，再用绑定工具执行已声明的调整。',verification:'保持对象、周期及归因一致，复核原指标及成交、退款与成本。'}))})),goalDiagnosis:{judgment:'',basis:'',uncertainty:'',plans:[]}});
export function auditSceneExecution(){
 const authored=auditBusinessCatalog(),report={revision:catalog.catalogRevision,scope:'全部场景逐一核查。规则逻辑案例、物理口径、输出反例与真实模型回执分别记录，不互相代替。',checks:{routing:0,missingEvidence:0,wrongEvidenceScope:0,missingValues:0,wrongDataScope:0,falseRules:0,missingOperands:0,zeroOperands:0,modelClaimGuards:0,actionGuards:0,fixtureObservations:0},logicalRuleAudit:authored.checks,scenes:[]};
 for(const scene of catalog.scenes){
  const strategies=catalog.strategies.filter(s=>s.sceneId===scene.id),record={id:scene.id,name:scene.name,framework:[],rules:[],modelAcceptance:'待修正上线后真实模型复跑',limitations:[]};
  for(const period of ['week','day']){
   const source=runtime[scene.fieldKey+':'+period],q=question(scene,period),context={sellerId:'DEMO_10001',fieldKey:scene.fieldKey,period,tags:[]};
   const payload=workflowInputPayload(source.config,source.data,scene.fieldKey,{question:q,context});
   for(const focus of ['','gmv','exposure','clickRate','payRate','research-metric-other-01']){
    const c=prepareWorkflowDiagnosis({...payload,question:q,context:{...context,metricKey:focus}});
    assert.equal(c.result.execution.frameworkId,catalog.published[scene.id].periods[period].frameworkDefinition.id,scene.name);
    assert.deepEqual(c.result.execution.selectedStrategyIds,strategies.map(s=>s.id),scene.name+' partial scene focus '+focus);
    assert.equal(c.materials.frameworks.length,1,scene.name);const f=c.materials.frameworks[0];
    assert.ok(f.decomposition.length&&f.drilldown&&f.branches.every(b=>b.minimumProblems?.length),scene.name+' incomplete model method');
    report.checks.routing++;
   }
   const c=prepareWorkflowDiagnosis({...payload,question:q,context});
   const emitted=[...c.result.diagnosis,...c.result.pendingIssues],ids=emitted.map(x=>x.strategyId);
   assert.equal(new Set(ids).size,ids.length,scene.name+' duplicate queue');
   const suppressed=new Set(emitted.flatMap(x=>strategies.find(s=>s.id===x.strategyId)?.suppressesStrategyIds||[]));
   assert.ok(ids.every(id=>!suppressed.has(id)),scene.name+' suppressed finding remains');
   record.framework.push({period,id:c.result.execution.frameworkId,selected:c.result.execution.selectedStrategyIds,hit:ids,status:c.result.status,missing:c.result.missing});
   const missing={...payload,data:{...payload.data,metrics:[]}},blocked=prepareWorkflowDiagnosis({...missing,question:q,context}),hostile=modelFor(blocked);
   hostile.summary='内容供给不足导致成交下降，应该立即加投并降价。';
   const safe=finalizeWorkflowDiagnosis(blocked,hostile);
   assert.equal(safe.diagnosis.length,0);assert.equal(safe.actions.length,0);assert.doesNotMatch(safe.answer,/应该立即|供给不足导致/);assert.equal(safe.workflow.explanationOrigin,'evidence_gate');report.checks.missingValues++;
   for(const change of [{period:period==='week'?'day':'week'},{fieldKey:scene.fieldKey==='live'?'video':'live'},{sellerId:'OTHER'},{completePeriods:false},{sameAttribution:false}]){
    const wrong=prepareWorkflowDiagnosis({...payload,data:{...payload.data,...change},question:q,context});assert.equal(wrong.result.diagnosis.length,0,scene.name+' wrong data scope');assert.ok(wrong.result.missing.some(x=>/不一致|不完整|不可比/.test(x)));report.checks.wrongDataScope++;
   }
   if(scene.requiredEvidence?.length){
    assert.equal(c.result.diagnosis.length,0,scene.name+' forced missing evidence diagnosis');
    const result=finalizeWorkflowDiagnosis(c,{...modelFor(c),summary:'标题模糊造成曝光下降，建议立即换标题。'});assert.equal(result.actions.length,0);assert.doesNotMatch(result.answer,/标题模糊造成/);report.checks.missingEvidence++;
    const valid={sceneId:scene.id,context,records:Object.fromEntries(scene.requiredEvidence.map(k=>[k,'合成证据占位，只验证作用域，不作为经校验的真实证据']))};
    for(const broken of [{...valid,sceneId:'OTHER'},{...valid,context:{...context,sellerId:'OTHER'}},{...valid,context:{...context,period:period==='week'?'day':'week'}},{...valid,context:{...context,fieldKey:'OTHER'}}]){
     assert.ok(sceneEvidenceErrors(scene,{context,sellerId:'DEMO_10001',businessEvidence:broken}).length);report.checks.wrongEvidenceScope++;
    }
   }
  }
  for(const s of strategies){
   const ids=refs(s.rule),values=combinations(ids),negative=values.find(v=>!judge(s.rule,v));assert.ok(negative,s.id+' missing negative witness');
   const changes=Object.fromEntries(Object.entries(negative).map(([id,value])=>[id,{value,previousValue:100}]));
   const pending=s.execution==='模型理解'||s.metricIds.some(id=>catalog.metrics.find(m=>m.id===id).unit==='待核验');
   assert.equal(executeScene(scene,[s],changes).ruleResults[0].matched,pending?null:false,s.id+' false rule');report.checks.falseRules++;
   for(const id of ids){for(const [kind,patch] of [['missing',{value:null,previousValue:null}],['zero',{value:0,previousValue:0}]]){
    const r=executeScene(scene,[s],{...changes,[id]:patch}).ruleResults[0];assert.equal(r.matched,null,s.id+' '+kind);assert.equal(r.triggered,false);report.checks[kind==='missing'?'missingOperands':'zeroOperands']++;
   }}
   for(const period of ['week','day']){
    const snap=catalog.published[scene.id].periods[period],published=snap.strategies.find(x=>x.id===s.id);assert.deepEqual(published.rule,s.rule);assert.deepEqual(published.actionMappings,s.actionMappings);assert.deepEqual(s.protocol.actions.map(a=>a.id),s.actionIds);
   }
   // Deliberately synthetic output-only adversarial case: it makes no claim
   // that a logical sign witness is a physically feasible merchant example.
   const issue={strategyId:s.id,name:s.name,decisionLevel:s.decisionLevel,facts:['仅核验同口径汇总变化，具体原因未证实。'],actions:s.actionMappings.map(a=>({id:a.id,name:catalog.actions.find(x=>x.id===a.id).name,capability:catalog.actions.find(x=>x.id===a.id).description,purpose:a.instruction,verification:a.verification}))};
   const testCase={result:{status:'success',diagnosis:[{strategyId:s.id,name:s.name,actionIds:s.actionIds,analysis:{facts:issue.facts}}],actions:catalog.actions.filter(a=>s.actionIds.includes(a.id)),missing:[]},materials:{question:'诊断'+scene.name,issues:[issue],goalActions:[],frameworks:[]}};
   for(const text of ['内容供给不足导致成交下降。','实际场次下降，符合缺播类问题特征。','内容触达减少未影响当前点击承接。','库存不足是本次下降的根因。','当前指标显著下降，已确认根因。']){
    const m=modelFor(testCase);m.explanations[0].judgment=text;const safe=finalizeWorkflowDiagnosis(testCase,m);assert.equal(safe.quality.validated,false,s.id+' unverified claim');assert.ok(!safe.diagnosis[0].actionIds.length);assert.ok(!safe.diagnosis[0].actionItems.length);assert.doesNotMatch(safe.answer,/供给不足导致|缺播类|未影响|库存不足|显著下降/);report.checks.modelClaimGuards++;
   }
   const unknown=modelFor(testCase);unknown.explanations[0].actions[0].actionId='UNKNOWN_ACTION';const safe=finalizeWorkflowDiagnosis(testCase,unknown);assert.equal(safe.quality.validated,false);assert.equal(safe.actions.length,0);report.checks.actionGuards++;
   record.rules.push({id:s.id,name:s.name,direction:s.direction,rule:s.metricRuleText,confirmation:s.confirmationRule,exclusiveGroup:s.exclusiveGroup,suppresses:s.suppressesStrategyIds||[],actions:s.actionMappings,missing:s.missingMetricOrEvidence,executionReadiness:s.executionReadiness,positiveStatus:pending?'缺证或单位待核验；未认定具体原因':'规则逻辑正例成立；真实模型效果另验',negativeStatus:'已验不命中',missingStatus:'已验无法判断且不推荐工具'});
  }
  if(scene.priority==='P2')record.limitations.push('素材／配置及经校验的证据执行器未接入，只验缺证保护；未宣称内容原因正向识别通过。');
  report.scenes.push(record);
 }
 for(const [key,p] of Object.entries(runtime)){
  assert.deepEqual(metricsPayload(p.data).errors,[],key+' invalid fixture');report.checks.fixtureObservations++;
  for(const series of ['currentValues'])for(let i=0;i<7;i++){
   const data={...p.data,metrics:p.data.metrics.map(m=>({...m,value:m[series]?.[i],previousValue:undefined}))};assert.deepEqual(metricsPayload(data).errors,[],key+' point '+i);report.checks.fixtureObservations++;
  }
 }
 return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const report=auditSceneExecution(),out=new URL('../../../output/all-scenes-acceptance-20261103/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('scene-execution-review.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({scenes:report.scenes.length,checks:report.checks,logicalRules:report.logicalRuleAudit}));
}
