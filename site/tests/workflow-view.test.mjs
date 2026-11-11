import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {prepareWorkflowDiagnosis,finalizeWorkflowDiagnosis} from '../shared/workflow-diagnosis.js';
const catalog=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8'));
const sources=await Promise.all(['business-summary','merchant-priority','merchant-report','goal-report','workflow-view'].map(n=>readFile(new URL('../web/'+n+'.js',import.meta.url),'utf8')));
const question='帮我分析近7天全店的经营表现',context={sellerId:'DEMO_10001',fieldKey:'overview',period:'week'},config=catalog['overview:week'].config;
function model(c){return {summary:'结论：本周期目标尚未达成，成交、流量和转化均有回落。\n依据：成交19万元，较前期下降11.6%；曝光减少9.1%，点击成交率下降1个百分点；目标完成88.4%。\n原因：订单变少拉低了成交，每笔订单金额提高弥补了一部分下降；经营原因仍需核查。\n建议：先核对订单减少集中的商品，若确认商品信息问题，再通过商品列表调整。',explanations:c.materials.issues.map(i=>({strategyId:i.strategyId,judgment:'该问题本轮模型判断',basis:'该问题本轮证据说明',uncertainty:'该问题待验证明细',actions:[{actionId:i.actions[0].id,text:'本轮模型给出的具体行动',verification:'本轮模型给出的复看指标'}]})),goalDiagnosis:{judgment:'模型判断目标尚未达成',basis:'模型引用目标与成交金额',uncertainty:'经营根因需明细验证',plans:c.materials.goalActions.length?[{title:'模型制定的行动',detail:'模型制定的具体步骤',actionId:c.materials.goalActions[0].id,verification:'模型指定的验证指标'}]:[]}};}
function runtime(){const c=vm.createContext({console,document:{addEventListener(){}},esc:v=>String(v??''),icon:()=>'',fieldData:()=>({name:'全店'}),periodName:()=> '近7天',curatedCoreMetricIds:()=>[],formattedMetric:(m,v)=>v.toLocaleString('zh-CN')+m.unit,merchantScopeInfo:()=>({text:'本次分析：全店 · 近7天'}),state:{view:'merchant',fieldKey:'overview',period:'week'},COZE_CONNECTION:{enabled:true,checked:true,configured:true,authorized:true},money:v=>v.toLocaleString('zh-CN')});for(const s of sources)vm.runInContext(s,c);c.merchantScopeInfo=()=>({text:'本次分析：全店 · 近7天'});return c;}
function result(q=question){const p=prepareWorkflowDiagnosis({question:q,context,configuration:config,data:catalog['overview:week'].data});if(!/目标/.test(q)){p.materials.summaryRequired=true;p.materials.businessOverview={context:p.result.context,metrics:p.result.metricAnalysis,goal:p.result.goal,priorities:p.materials.issues.map(i=>({name:i.name,facts:i.facts}))};}return finalizeWorkflowDiagnosis(p,model(p));}
test('工作流回复展示本轮模型原因与行动，不能被本地原因模板重写',()=>{
 const c=runtime();c.merchantEvidenceAnalysis=()=>{throw Error('禁止重写模型理由');};const r=result(),brief=c.buildMerchantBrief(r,question);assert.equal(brief.issues.length,3);assert.equal(brief.queue.remaining,7);assert.match(brief.verdict,/目标尚未达成/);assert.match(brief.text,/该问题本轮模型判断/);assert.match(brief.text,/本轮模型给出的具体行动/);assert.match(brief.text,/本轮模型给出的复看指标/);assert.equal(brief.issues[0].reasonItems.length,3);assert.ok(brief.issues[0].metrics.every(m=>m.value!=='未提供'));
});
test('目标回复只展示工作流的目标与模型计划，缺目标时不借用前端演示目标',()=>{
 const c=runtime(),q='帮我分析近7天全店的目标差距',r=result(q);assert.equal(r.quality.validated,true);const brief=c.buildMerchantGoalBrief(r,q);assert.equal(brief.target,215000);assert.equal(brief.valid,true);assert.match(brief.verdict,/全店.*目标.*88\.4%/);assert.match(brief.text,/模型判断目标尚未达成/);assert.equal(brief.plans[0].title,'模型制定的行动');r.goal=null;const missing=c.buildMerchantGoalBrief(r,q);assert.equal(missing.valid,false);assert.match(missing.verdict,/未取得完整目标资料/);assert.equal(missing.target,undefined);
});
test('有目标数字但模型解释未通过时明确提示未完成，不展示为完整AI目标诊断',()=>{
 const c=runtime(),q='帮我分析近7天全店的目标差距',r=result(q);r.quality={validated:false,errors:['目标行动未返回']};r.goalDiagnosis={judgment:'',basis:'',plans:[]};const brief=c.buildMerchantGoalBrief(r,q);assert.equal(brief.target,215000);assert.match(brief.note,/尚未完整返回.*目标行动未返回/);assert.equal(brief.plans.length,0);
});
