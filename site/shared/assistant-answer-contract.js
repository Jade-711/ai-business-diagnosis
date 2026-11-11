// These functions are also embedded in the native workflow code nodes. Keep
// them standalone: the Coze sandbox does not import the website's modules.
export function assistantMetricObservations(result={}){
 const metrics=[...new Map([...(result.evidence||[]),...(result.metricAnalysis||[])].map(m=>[m.metricId,m])).values()];
 const number=v=>String(Number(v.toFixed(4)));
 const rows=metrics.filter(m=>Number.isFinite(m.value)&&m.unit&&!/待核验|原始值/.test(m.unit)).map(m=>{
  const previous=Number.isFinite(m.previousValue)?m.previousValue:null;
  let fact=`${m.label}本期${number(m.value)}${m.unit}`;
  if(previous!==null){
   if(m.value===previous)fact+=`，与前期持平`;
   else{
    const direction=m.value>previous?'上升':'下降';
    fact=`${m.label}由${number(previous)}${m.unit}${m.value>previous?'增至':'降至'}${number(m.value)}${m.unit}`;
    if(m.unit==='%')fact+=`，${direction}${number(Math.abs(m.value-previous))}个百分点${previous>0?'（相对'+direction+number(Math.abs((m.value-previous)/previous)*100)+'%）':''}`;
    else if(previous>0&&m.unit!=='分')fact+=`，相对${direction}${number(Math.abs((m.value-previous)/previous)*100)}%`;
   }
  }else fact+='，前期未提供，暂不判断变化';
  return {metricId:m.metricId,label:m.label,unit:m.unit,value:m.value,previousValue:previous,fact};
 });
 // The numerator and denominator are explicit published metrics. This is an
 // arithmetic observation, never a claim about the business cause.
 const amount=rows.find(m=>/^(成交金额|商品卡成交金额)$/.test(m.label));
 const orders=rows.find(m=>/^(成交订单数|商品卡成交订单数)$/.test(m.label));
 if(amount&&orders&&orders.value>0){
  const value=amount.value/orders.value;
  const previous=amount.previousValue!==null&&orders.previousValue>0?amount.previousValue/orders.previousValue:null;
  rows.push({metricId:'computed-per-order-amount',label:'每单成交金额',unit:'元',value,previousValue:previous,
   fact:previous===null?`每单成交金额为${number(value)}元（成交金额÷成交订单数），前期无法计算`:
    previous===value?`每单成交金额为${number(value)}元，与前期持平（成交金额÷成交订单数）`:
     `每单成交金额由${number(previous)}元变为${number(value)}元（成交金额÷成交订单数）`});
 }
 return rows;
}

export function assistantAnswerContext(calculation){
 const result=calculation.result||{},materials=calculation.materials||{};
 const requested=/目标|达标|达成|补差|缺口/.test(materials.question||'');
 const raw=result.goal||{},available=Number.isFinite(raw.actual)&&Number.isFinite(raw.target)&&raw.target>0;
 const goal=available?{...raw,rate:100*raw.actual/raw.target,gap:Math.max(0,raw.target-raw.actual),excess:Math.max(0,raw.actual-raw.target)}:null;
 const blockingMissing=(result.missing||[]).filter(x=>!/当前使用合成演示数据/.test(x));
 return {observations:assistantMetricObservations(result),goalRequested:requested,goalAvailable:available,goal,
  replyMode:requested?(available?'goal':'missing_goal'):(result.diagnosis||[]).length?'issues':blockingMissing.length?'missing_inputs':'no_issue',
  instruction:'observations是本轮已核验数值事实，frameworks是规则定义；未命中异常时不能把框架中的异常描述当成本店事实。目标缺失时请明确说明无法计算完成率和差额，并请求同周期目标。'};
}

export function assistantGoalFactText(goal){
 const n=v=>String(Number(v.toFixed(4)));
 const state=goal.actual===goal.target?'目标刚好达成':goal.actual>goal.target?`目标已超额完成，超出${n(goal.excess)}元`:'目标尚未达成';
 return `本周期成交${n(goal.actual)}元，目标${n(goal.target)}元，完成率${n(goal.rate)}%，差额${n(goal.gap)}元，${state}。`;
}

export function applyAssistantAnswerContract(calculation,model,result){
 const context=assistantAnswerContext(calculation),base=calculation.result;
 const workflow={...result.workflow,revision:'diagnosis-v6-grounded-facts-and-action-gate',judgmentOrigin:calculation.materials?.grounding?'published_rule_and_verified_math':undefined,basisOrigin:calculation.materials?.grounding?'tool_calculation':undefined,uncertaintyAndActionOrigin:'model_node'};
 if(context.replyMode==='missing_goal'){
  const amount=context.observations.find(m=>/^(成交金额|商品卡成交金额)$/.test(m.label));
  const known=amount?`本周期已知成交金额${Number(amount.value.toFixed(4))}元；`:'';
  const hasTarget=Number.isFinite(base.goal?.target)&&base.goal.target>0;
  const missing=hasTarget?'缺少同周期成交金额，无法计算目标完成率和差额。请补充同周期成交金额。':'本次未提供有效的目标金额，无法计算目标完成率和差额。请补充本周期目标金额，并确认目标适用周期与本轮一致。';
  return {...result,status:'missing_data',answer:known+missing,goal:undefined,goalDiagnosis:undefined,
   diagnosis:[],actions:[],pendingIssues:[],missing:[...new Set([...(result.missing||[]),missing])],
   quality:{validated:true,errors:[]},workflow:{...workflow,explanationOrigin:'data_requirement_gate',validated:true}};
 }
 if(context.replyMode==='goal'){
  const errors=[...(result.quality?.errors||[])],judgment=String(result.goalDiagnosis?.judgment||'');
  for(const match of judgment.matchAll(/(?:目标完成率|完成率|完成)\s*([\d.]+)%/g)){
   if(Math.abs(Number(match[1])-context.goal.rate)>.11)errors.push('目标判断中的完成率与工具计算不一致');
  }
  if(/undefined|NaN|Infinity|\bnull\b/.test(judgment))errors.push('目标判断包含无效数值');
  const claims=judgment.split(/[。；;！!]/).filter(s=>!/不能说|不能认定|并非|不是/.test(s));
  if(context.goal.actual>=context.goal.target&&claims.some(s=>/未达成|未完成|未达标/.test(s)))errors.push('工具结果已达标，目标判断不能称未达标');
  if(context.goal.actual<context.goal.target&&claims.some(s=>/目标已达成|目标已完成|已达标|超额/.test(s)))errors.push('工具结果未达标，目标判断不能称已达标');
  if(context.goal.actual===context.goal.target&&claims.some(s=>/超额/.test(s)&&!/未超额|没有超额/.test(s)))errors.push('目标刚好达成，不能称超额完成');
  const valid=errors.length===0;
  return {...result,goal:context.goal,answer:assistantGoalFactText(context.goal)+(valid?'':' 原因说明或行动尚未通过核验，请补齐资料后重新核查。'),
   status:valid?result.status:'partial',goalDiagnosis:valid?result.goalDiagnosis:undefined,actions:valid?result.actions:[],
   missing:[...new Set([...(result.missing||[]),...errors])],quality:{validated:valid,errors},workflow:{...workflow,validated:valid}};
 }
 if(context.replyMode==='no_issue'||context.replyMode==='missing_inputs'){
  const facts=context.observations.slice(0,8).map(m=>m.fact).join('；');
  const missing=(base.missing||[]).filter(x=>!/当前使用合成演示数据/.test(x));
  const boundary=missing.length?'本场景尚无法完成判断：'+missing.join('；')+'。':
   (base.handledStrategyIds||[]).length?'本轮没有新的待展开问题，已处理问题不重复展示。':
    '本轮已配置规则未发现需展开的异常；这不代表全部经营环节都正常，具体经营原因仍需明细验证。';
  return {...result,answer:(facts?facts+'。':'')+boundary,diagnosis:[],actions:[],goalDiagnosis:undefined,
   workflow:{...workflow,explanationOrigin:'verified_observation_gate'}};
 }
 return {...result,workflow};
}
