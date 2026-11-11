import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {prepareWorkflowDiagnosis,finalizeWorkflowDiagnosis} from '../shared/workflow-diagnosis.js';
const catalog=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8'));
const graph=JSON.parse(await readFile(new URL('../workflow/main.workflow.json',import.meta.url),'utf8'));
async function execute(id,params){const n=graph.nodes.find(n=>n.id===id);const c=vm.createContext({URL});vm.runInContext(n.data.inputs.code.replace(/: Args/g,'').replace(/: Promise<Output>/g,''),c);return JSON.parse(JSON.stringify(await c.main({params})));}
const body=(field='overview',period='week',question='帮我分析近7天全店的经营表现')=>({question,context:{sellerId:'DEMO_10001',fieldKey:field,period,requestId:'demo',tags:['跃迁期']},configuration:catalog[field+':'+period].config,data:catalog[field+':'+period].data});
function modelFor(c){return {summary:c.materials.summaryRequired?'结论：本周期目标尚未达成，成交、流量和转化均有回落。\n依据：成交19万元，较前期下降11.6%；目标完成88.4%。\n原因：订单变少拉低了成交，每笔订单金额提高弥补了一部分下降；经营原因仍需核查。\n建议：先核对订单减少集中在哪些商品，确认商品信息存在问题后通过商品列表调整。':'本轮模型生成的具体经营结论',explanations:c.materials.issues.map(i=>({strategyId:i.strategyId,judgment:'模型针对本轮证据给出的判断',basis:i.facts.join('；'),uncertainty:'缺少商品和来源明细，经营根因仍待验证',actions:i.actions.slice(0,1).map(a=>({actionId:a.id,text:'模型针对该问题提出的具体动作',verification:'复看本次同口径指标'}))})),goalDiagnosis:{judgment:'目标尚未达成',basis:'目标与成交数据来自工作流返回',uncertainty:'具体经营原因需明细验证',plans:c.materials.goalActions.slice(0,1).map(a=>({title:'复盘有效做法',detail:'核对本轮数据后复盘商品和来源表现',actionId:a.id,verification:'复看同口径成交金额'}))}};}
test('工作流内明确问法无需语义模型，目标和查数正确分流，复杂问题仍进入模型识别',async()=>{
 for(const [q,branch] of [['帮我分析近7天全店的经营表现','diagnosis'],['帮我分析近7天全店的目标差距','diagnosis'],['近7天直播成交金额是多少','data'],['商品点击成交率是什么意思','knowledge']]){
  const r=await execute('410001',{question:q,sellerId:'DEMO_10001',pageContext:{fieldKey:'overview',period:'week'}});assert.equal(r.needsUnderstanding,false,q);assert.equal(r.branch,branch,q);
 }
 const r=await execute('410001',{question:'比较直播和短视频哪个值得继续投入',pageContext:{fieldKey:'overview',period:'week'}});assert.equal(r.needsUnderstanding,true);
});
test('取数和知识问答从任务选择直达各自节点，连线不经过诊断计算、解释或策略匹配',()=>{
 const router=graph.nodes.find(n=>n.id==='110006'),conditions=router.data.inputs.branches||router.data.inputs.conditions;
 for(const [branch,port,target] of [['data','true_1','110008'],['knowledge','true_2','110009']]){
  assert.ok(conditions.some(b=>b.condition.conditions.some(c=>c.right.input.value.content===branch)));
  assert.equal(graph.edges.find(e=>e.sourceNodeID===router.id&&e.sourcePortID===port).targetNodeID,target);
  const remaining=[target],seen=new Set();while(remaining.length){const id=remaining.pop();if(seen.has(id))continue;seen.add(id);remaining.push(...graph.edges.filter(e=>e.sourceNodeID===id).map(e=>e.targetNodeID));}
  for(const id of ['210002','310005','310002','310004','410021'])assert.equal(seen.has(id),false,branch+'不能进入诊断节点'+id);
 }
});
test('实际导入Coze的计算节点执行新配置，限定3个问题并保留完整数值依据和后续队列',async()=>{
 const p=body(),calculated=prepareWorkflowDiagnosis(p),r=await execute('310005',{calculationJson:JSON.stringify(calculated),materials:JSON.stringify(calculated.materials),question:p.question,context:p.context});const c=JSON.parse(r.calculationJson);
 assert.equal(c.result.diagnosis.length,3);assert.equal(r.explanationTasks.length,3);assert.equal(r.explanationTasks.filter(x=>JSON.parse(x.materials).includeSummary).length,1);assert.equal(JSON.parse(r.explanationTasks[0].materials).businessOverview.metrics.length,24);assert.ok(r.explanationTasks.slice(1).every(x=>!JSON.parse(x.materials).businessOverview));assert.ok(r.explanationTasks.every(x=>JSON.parse(x.materials).issues.length===1));assert.equal(c.result.pendingIssues.length,7);assert.match(c.materials.issues[0].name,/成交金额与订单量同时回落/);assert.ok(c.materials.issues[0].calculations.length);assert.equal(c.result.goal.actual,190000);assert.equal(c.result.goal.target,215000);
 const completed=await execute('310004',{calculationJson:r.calculationJson,outputs:[modelFor(c)]});assert.equal(completed.result.quality.validated,true);assert.equal(completed.result.workflowContract,1);assert.match(completed.result.diagnosis[0].reasonItems[0].text,/成交金额与订单量同时回落/);assert.equal(completed.result.workflow.basisOrigin,'tool_calculation');
});
test('补全后的说明和行动到达最终汇合，首次失败结果不能遮蔽复核结果',async()=>{
 const p=body(),calculated=prepareWorkflowDiagnosis(p);
 const prepared=await execute('310005',{calculationJson:JSON.stringify(calculated),materials:JSON.stringify(calculated.materials),question:p.question,context:p.context});
 const c=JSON.parse(prepared.calculationJson),good={...modelFor(c),usageJson:'[]'},bad={...good,explanations:[]};
 const initial=await execute('310004',{calculationJson:prepared.calculationJson,outputs:[bad]});
 const repaired=await execute('410022',{calculationJson:prepared.calculationJson,...good,previousUsageJson:'[]'});
 assert.equal(initial.passed,false);assert.equal(repaired.passed,true);
 const references=graph.nodes.find(n=>n.id==='110012').data.inputs.mergeGroups.find(g=>g.name==='result').variables;
 const merge=values=>references.map(v=>values[v.value.content.blockID]).find(value=>value!=null);
 const final=merge({'310004':initial.result,'410022':repaired.result});
 assert.equal(final.quality.validated,true);
 assert.ok(final.diagnosis.every(issue=>issue.explanation&&issue.actionItems.length));
 const firstPass=await execute('310004',{calculationJson:prepared.calculationJson,outputs:[good]});
 assert.deepEqual(merge({'310004':firstPass.result}),firstPass.result);
 const failedRepair=await execute('410022',{calculationJson:prepared.calculationJson,...bad,previousUsageJson:'[]'});
 assert.deepEqual(merge({'310004':initial.result,'410022':failedRepair.result}),failedRepair.result);
 assert.equal(failedRepair.passed,false);
});
test('直播成交下降20%的计算仍命中修订策略，模型解释不会改写规则和原始数值',()=>{
 const c=prepareWorkflowDiagnosis(body('live','week','帮我分析近7天直播成交金额下降20%的原因'));assert.equal(c.result.diagnosis[0].strategyId,'research-strategy-07-4');const calc=c.materials.issues[0].calculations.find(c=>c.kind==='live_revenue');assert.equal(calc.total,-20000);
 const r=finalizeWorkflowDiagnosis(c,modelFor(c));assert.equal(r.diagnosis.length,1);assert.equal(r.quality.validated,true);assert.equal(r.diagnosis[0].evidence.find(m=>m.metricId==='research-metric-live-02').value,80000);
});
test('不合法的问题、行动、空原因不会伪造成完整诊断，后续批次不重复已处理问题',()=>{
 const c=prepareWorkflowDiagnosis(body()),m=modelFor(c);m.explanations[0].actions[0].actionId='invented-action';m.explanations[1].basis='';m.explanations.push({strategyId:'invented-issue'});const r=finalizeWorkflowDiagnosis(c,m);assert.equal(r.quality.validated,false);assert.equal(r.status,'partial');assert.ok(r.quality.errors.length>=3);assert.equal(r.diagnosis[0].actionIds.length,0);assert.equal(r.diagnosis.length,3);
 const ids=c.result.diagnosis.map(x=>x.strategyId),next=prepareWorkflowDiagnosis({...body(),excludeStrategyIds:ids});assert.equal(next.result.diagnosis.length,3);assert.equal(next.result.pendingIssues.length,4);assert.ok(next.result.diagnosis.every(x=>!ids.includes(x.strategyId)));
});
test('目标计算由工作流提供，模型缺少目标行动时不能标记校验通过',()=>{
 const c=prepareWorkflowDiagnosis(body('overview','week','帮我分析近7天全店的目标差距'));assert.ok(c.result.goal.rate<100);assert.equal(c.result.goal.gap,25000);const m=modelFor(c);m.goalDiagnosis.plans=[];assert.equal(finalizeWorkflowDiagnosis(c,m).quality.validated,false);
});
test('曝光同步缩量不能偷换为付费导致整体下降，否定句与算术分解可以通过',()=>{
 const c=prepareWorkflowDiagnosis(body('video','week','分析近7天短视频-曝光')),m=modelFor(c);
 assert.equal(c.materials.goal,null);assert.deepEqual(c.materials.goalActions,[]);
 for(const text of ['当前短视频总曝光人数与付费曝光用户同步下降，导致整体曝光规模下滑，人均曝光频次保持稳定。','自然流量下降是本次曝光缩量的原因。']){
  m.explanations[0].judgment=text;assert.equal(finalizeWorkflowDiagnosis(c,m).quality.validated,false,text);
 }
 m.explanations[0].judgment='总覆盖与付费覆盖同步收缩；人均曝光次数持平，曝光次数随覆盖人数同步减少。';
 m.explanations[0].basis='总覆盖和付费覆盖同步收缩，不能认定停投造成整体曝光下降；自然流量是否下降尚未证实。';
 assert.equal(finalizeWorkflowDiagnosis(c,m).quality.validated,true);
 m.explanations[0].judgment='本周期短视频曝光未达成目标';assert.equal(finalizeWorkflowDiagnosis(c,m).quality.validated,false);
 m.explanations[0].judgment='总覆盖与付费覆盖同步收缩，具体来源根因待核。';
 m.summary='本周期短视频曝光未达成目标，曝光同比下降。';
 const scoped=finalizeWorkflowDiagnosis(c,m);assert.equal(scoped.quality.validated,true);assert.equal(scoped.answer,m.explanations[0].judgment);assert.doesNotMatch(scoped.answer,/同比|目标/);
 c.materials.summaryRequired=true;m.summary='付费投放减少导致整体曝光下降';assert.equal(finalizeWorkflowDiagnosis(c,m).quality.validated,false);
});

test('退款绝对量的明确否定句不会被当成肯定断言，肯定断言仍被拒绝',()=>{
 const c=prepareWorkflowDiagnosis(body()),m=modelFor(c),i=c.materials.issues.find(i=>/退款率/.test(i.name)),explanation=m.explanations.find(x=>x.strategyId===i.strategyId);
 explanation.judgment='退款比例上升，绝对金额尚待核实';
 explanation.basis='退款率由4.8%升至6.2%，不能等同于退款金额或订单绝对量增加。';
 assert.equal(finalizeWorkflowDiagnosis(c,m).quality.validated,true);
 explanation.basis='退款金额增加，但不能证明具体经营原因。';
 assert.equal(finalizeWorkflowDiagnosis(c,m).quality.validated,false);
});

test('质量校验拒绝比例推断同一批商品、口径误称与未核实直接发新品，流程只在失败时补全一次',()=>{
 const c=prepareWorkflowDiagnosis(body()),m=modelFor(c);m.explanations[0].basis='订单变化带来客单价上升';m.explanations[1].strategyId=c.result.diagnosis[1].strategyId;m.explanations[1].judgment='原有动销商品中20%不再成交';c.result.diagnosis[1].name='商品动销率回落';m.explanations[1].actions[0].text='筛选商品准备发布新品';const r=finalizeWorkflowDiagnosis(c,m);assert.equal(r.quality.validated,false);assert.ok(r.quality.errors.some(e=>e.includes('客单价')));assert.ok(r.quality.errors.some(e=>e.includes('商品集合明细')));assert.ok(r.quality.errors.some(e=>e.includes('确认条件')));assert.ok(graph.nodes.find(n=>n.id==='410020'));assert.ok(graph.nodes.find(n=>n.id==='410021'));assert.ok(graph.edges.some(e=>e.sourceNodeID==='410020'&&e.sourcePortID==='true'&&e.targetNodeID==='110012'));assert.ok(graph.edges.some(e=>e.sourceNodeID==='410020'&&e.sourcePortID==='false'&&e.targetNodeID==='410021'));assert.equal(graph.edges.filter(e=>e.targetNodeID==='410021').length,1);
});
