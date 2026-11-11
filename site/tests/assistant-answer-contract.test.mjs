import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const graph=JSON.parse(await readFile(new URL('../workflow/main.workflow.json',import.meta.url),'utf8'));
async function execute(id,params){
 const code=graph.nodes.find(n=>n.id===id).data.inputs.code.replace(/: Args/g,'').replace(/: Promise<Output>/g,'');
 const sandbox=vm.createContext({});vm.runInContext(code,sandbox);
 return JSON.parse(JSON.stringify(await sandbox.main({params})));
}
function calculation(question,amount=120000,previous=100000,goal){
 const metrics=[{metricId:'amount',label:'成交金额',unit:'元',value:amount,previousValue:previous},
  {metricId:'orders',label:'成交订单数',unit:'单',value:1000,previousValue:1000},
  {metricId:'refund-rate',label:'金额退款率（支付日）',unit:'%',value:5,previousValue:5}];
 return {result:{context:{fieldKey:'overview',period:'week'},status:'success',answer:'旧目标完成率undefined%，差额undefined元。',diagnosis:[],evidence:metrics,metricAnalysis:metrics,actions:[],missing:[],goal},
  materials:{question,frameworks:[],issues:[],goalActions:[],scopeErrors:[]}};
}
async function prepared(c){return execute('310005',{calculationJson:JSON.stringify(c),materials:JSON.stringify(c.materials),context:c.result.context,question:c.materials.question});}
async function finalize(id,p,model){return execute(id,id==='310004'?{calculationJson:p.calculationJson,outputs:[{...model,usageJson:'[]'}]}:{calculationJson:p.calculationJson,...model,usageJson:'[]',previousUsageJson:'[]'});}
const empty={summary:'',explanations:[],goalDiagnosis:{judgment:'',basis:'',uncertainty:'',plans:[]}};

test('无命中时传递增长和持平事实，最终不显示模型虚构的下降或退款异常',async()=>{
 const p=await prepared(calculation('分析近7天全店整体交易是否存在成交回落问题。'));
 const material=JSON.parse(p.materials);
 assert.equal(material.answerContext.replyMode,'no_issue');
 assert.equal(material.answerContext.observations.find(m=>m.metricId==='amount').value,120000);
 for(const id of ['310004','410022']){
  const r=await finalize(id,p,{...empty,summary:'成交金额与订单同步回落，退款率上升'});
  assert.equal(r.passed,true);assert.match(r.result.answer,/100000元增至120000元/);
  assert.match(r.result.answer,/上升20%/);assert.match(r.result.answer,/成交订单数本期1000单，与前期持平/);
  assert.match(r.result.answer,/每单成交金额由100元变为120元/);
  assert.doesNotMatch(r.result.answer,/同步回落|退款率上升/);
  assert.match(r.result.answer,/不代表全部经营环节都正常/);assert.deepEqual(r.result.actions,[]);
 }
});
test('相等边界显示持平，无异常时不制造问题或行动',async()=>{
 const p=await prepared(calculation('诊断近7天全店整体交易，有没有成交回落？',100000));
 const r=await finalize('310004',p,{...empty,summary:'成交下降，退款恶化'});
 assert.equal(r.passed,true);assert.match(r.result.answer,/成交金额本期100000元，与前期持平/);
 assert.doesNotMatch(r.result.answer,/成交下降|退款恶化/);assert.deepEqual(r.result.diagnosis,[]);
});
test('已达标回答使用工具计算数值，目标刚好达成不会输出undefined或伪造补差',async()=>{
 const c=calculation('分析近7天全店成交目标完成情况。',100000,100000,{actual:100000,target:100000});
 c.materials.goalActions=[{id:'review'}];c.result.actions=[{id:'review'}];
 const p=await prepared(c),model={...empty,goalDiagnosis:{judgment:'本周期成交100000元，目标100000元，完成率100%，差额0元，目标已达成。',basis:'本期成交与目标金额相同。',uncertainty:'经营原因需对象明细。',plans:[{title:'复盘',detail:'核对同周期订单与商品结构。',actionId:'review',verification:'复核同口径指标。'}]}};
 for(const id of ['310004','410022']){
  const r=await finalize(id,p,model);
  assert.equal(r.passed,true);assert.match(r.result.answer,/完成率100%/);assert.match(r.result.answer,/差额0元/);
  assert.match(r.result.answer,/刚好达成/);assert.doesNotMatch(r.result.answer,/undefined|NaN|超额|未达成/);
  const withoutExtraAction=await finalize(id,p,{...model,goalDiagnosis:{...model.goalDiagnosis,plans:[]}});
  assert.equal(withoutExtraAction.passed,true);assert.deepEqual(withoutExtraAction.result.goalDiagnosis.plans,[]);
 }
 const rejected=await finalize('410022',p,{...model,goalDiagnosis:{...model.goalDiagnosis,judgment:'目标未达成，完成率80%'}});
 assert.equal(rejected.passed,false);assert.equal(rejected.result.status,'partial');assert.equal(rejected.result.goalDiagnosis,undefined);
});
test('目标缺失时请求同周期目标，保留已知金额并排除普通经营诊断替代回答',async()=>{
 const p=await prepared(calculation('分析近7天全店目标完成率和差距。',80000,100000));
 for(const id of ['310004','410022']){
  const r=await finalize(id,p,{...empty,summary:'订单变少导致成交下降20%'});
  assert.equal(r.passed,true);assert.equal(r.result.status,'missing_data');
  assert.match(r.result.answer,/80000元/);assert.match(r.result.answer,/未提供有效的目标金额/);
  assert.match(r.result.answer,/无法计算目标完成率和差额/);assert.match(r.result.answer,/请补充.*目标金额/);
  assert.match(r.result.answer,/周期/);assert.doesNotMatch(r.result.answer,/完成率80%|订单变少/);
  assert.deepEqual(r.result.actions,[]);assert.deepEqual(r.result.diagnosis,[]);
 }
});
