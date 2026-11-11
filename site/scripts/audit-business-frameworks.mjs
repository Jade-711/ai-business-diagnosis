import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {executeMerchantRules} from '../worker/merchant-kernel.js';
import {configurationPayload} from '../worker/resource-contract.js';
import {BUSINESS_SCENE_SPECS} from '../shared/scene-business-specs.js';
const root=new URL('../',import.meta.url);
export const catalog=JSON.parse((await readFile(new URL('web/curated-catalog.js',root),'utf8')).split('const AIDD_CURATED_CATALOG = ')[1].trim().replace(/;$/,''));
const refs=r=>r.children?[...new Set(r.children.flatMap(refs))]:[r.metricId];
// Independent oracle over change signs; used to find satisfiable examples and
// prove same-group conditions do not overlap, rather than copying a rule's op.
const compare=(a,op,b)=>({'<':a<b,'<=':a<=b,'>':a>b,'>=':a>=b,'==':a===b,'!=':a!==b})[op];
const judge=(r,values)=>r.children?(r.join==='OR'?r.children.some(c=>judge(c,values)):r.children.every(c=>judge(c,values))):compare(values[r.metricId],r.op,100);
function assignments(ids){return Array.from({length:3**ids.length},(_,n)=>Object.fromEntries(ids.map(id=>{const value=[80,100,120][n%3];n=Math.floor(n/3);return [id,value];})));}
export function executeScene(scene,strategies,changes={},errors=[]){
 const frame=catalog.published[scene.id].periods.week.frameworkDefinition;
 const definitions=catalog.metrics.filter(m=>scene.metricIds.includes(m.id));
 const values=definitions.map(m=>({id:m.id,label:m.originalName,unit:m.unit,value:100,previousValue:100,...changes[m.id]}));
 return executeMerchantRules({question:'分析'+scene.name,context:{sellerId:'SYNTHETIC_REVIEW',fieldKey:scene.fieldKey,period:'week',tags:[]},metricValues:values,metricDefinitions:definitions,frameworkCandidates:[frame],strategyCandidates:strategies.map(s=>({...s,merchantScope:''})),actionAssets:[],configurationErrors:errors});
}
export function auditBusinessCatalog(){
 const review={revision:catalog.catalogRevision,mode:'逐场景业务定义审阅、合成反例、互斥穷举及执行边界；非真实商家效果',scenes:[],checks:{satisfiableRules:0,missingInputCases:0,zeroBaselineCases:0,exclusiveAssignments:0,evidenceBoundaries:0},errors:[]};
 for(const scene of catalog.scenes){
  const frame=catalog.frameworks.find(f=>f.sceneId===scene.id),spec=BUSINESS_SCENE_SPECS[scene.name],strategies=catalog.strategies.filter(s=>s.sceneId===scene.id);
  assert.ok(spec,scene.name);assert.ok(frame.prompt.indexOf('一、指标拆解')<frame.prompt.indexOf('二、诊断方向'));assert.ok(frame.prompt.indexOf('二、诊断方向')<frame.prompt.indexOf('三、典型问题总结'));
  assert.ok(frame.decomposition.length&&frame.drilldown);assert.ok(frame.branches.every(b=>b.minimumProblems?.length));
  assert.doesNotMatch(frame.prompt,/环节变化核查|先比较.*再结合本场景其余指标/);
  const record={id:scene.id,name:scene.name,decomposition:frame.decomposition,drilldown:frame.drilldown,directions:frame.branches.map(b=>({name:b.name,minimumProblems:b.minimumProblems})),problems:[]};
  for(const s of strategies){
   assert.ok(s.actionMappings.length);assert.ok(s.actionMappings.every(a=>a.instruction.trim()&&a.verification.includes('复核')&&!/^(优化内容|改善经营|提升转化)[。！]?$/.test(a.instruction)),s.name+' has a generic action');
   assert.ok(s.missingMetricOrEvidence.length||s.pendingItems.length);assert.ok(s.metricRuleText&&s.confirmationRule);
   assert.ok(s.metricIds.every(id=>scene.metricIds.includes(id)));assert.ok(s.actionIds.every(id=>scene.actionIds.includes(id)));
   const metricIds=refs(s.rule),witness=assignments(metricIds).find(values=>judge(s.rule,values));assert.ok(witness,s.name+' has contradictory rule');
   const changes=Object.fromEntries(Object.entries(witness).map(([id,value])=>[id,{value,previousValue:100}]));
   const found=executeScene(scene,[s],changes).ruleResults[0];
   const pending=s.execution==='模型理解'||s.metricIds.some(id=>catalog.metrics.find(m=>m.id===id).unit==='待核验');
   assert.equal(found?.matched,pending?null:true,s.name);review.checks.satisfiableRules++;
   const first=metricIds[0];
   const missing=executeScene(scene,[s],{...changes,[first]:{value:null,previousValue:null}}).ruleResults[0];assert.equal(missing.matched,null,s.name);assert.equal(missing.triggered,false);review.checks.missingInputCases++;
   const zero=executeScene(scene,[s],{...changes,[first]:{value:0,previousValue:0}}).ruleResults[0];assert.equal(zero.matched,null,s.name);assert.equal(zero.triggered,false);review.checks.zeroBaselineCases++;
   if(s.execution==='模型理解'){assert.equal(found.triggered,false);assert.match(found.reason,/无法判断/);review.checks.evidenceBoundaries++;}
   record.problems.push({id:s.id,name:s.name,rule:s.metricRuleText,confirmation:s.confirmationRule,actions:s.actionMappings,missing:s.missingMetricOrEvidence,readiness:s.executionReadiness,satisfiableSyntheticCase:changes,observedResult:found.matched});
  }
  const groups=[...new Set(strategies.filter(s=>s.execution==='指标规则'&&s.exclusiveGroup).map(s=>s.exclusiveGroup))];
  for(const key of groups){const rows=strategies.filter(s=>s.exclusiveGroup===key),metricIds=[...new Set(rows.flatMap(s=>refs(s.rule)))];for(const values of assignments(metricIds)){const hits=rows.filter(s=>judge(s.rule,values));assert.ok(hits.length<=1,scene.name+' overlapping: '+hits.map(s=>s.name).join(' / '));review.checks.exclusiveAssignments++;}}
  if(scene.priority==='P2'){
   assert.ok(scene.requiredEvidence.length>=3);
   assert.equal(new Set(strategies.map(s=>s.evidenceCategory)).size,strategies.length);
   const config=catalog.published[scene.id].periods.week;
   const payload=configurationPayload(config,scene.fieldKey,'synthetic-review',{question:'分析'+scene.name,context:{sellerId:'SYNTHETIC_REVIEW',fieldKey:scene.fieldKey,period:'week'}});
   assert.ok(payload.errors.some(e=>e.includes('需补充')));
   const result=executeScene(scene,strategies,{},payload.errors);assert.equal(result.ruleResults.length,0);
  }
  review.scenes.push(record);
 }
 return review;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const report=auditBusinessCatalog(),out=new URL('../../../output/framework-business-rework-20261103/',import.meta.url);await mkdir(out,{recursive:true});
 await writeFile(new URL('business-review.json',out),JSON.stringify(report,null,2));
 console.log(JSON.stringify({scenes:report.scenes.length,problems:report.scenes.reduce((n,s)=>n+s.problems.length,0),checks:report.checks,errors:report.errors}));
}
