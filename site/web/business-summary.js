// Parse the model's merchant-facing summary; never generate a local conclusion.
function parseBusinessSummary(text){
 const rows=String(text||'').trim().replace(/\r/g,'').split('\n').filter(line=>line.trim()).map(line=>line.trim().replace(/^[-*#\d.、\s]+/,'').replaceAll('**',''));
 const labels=['结论','依据','原因','建议'];
 if(rows.length!==labels.length)return null;
 const parts=rows.map((line,index)=>{const match=line.match(/^(结论|依据|原因|建议)\s*[:：]\s*(.+)$/);return match&&match[1]===labels[index]?{label:match[1],text:match[2].trim()}:null;});
 return parts.every(part=>part?.text)?parts:null;
}
function validateBusinessSummary(text,overview={}){
 const parts=parseBusinessSummary(text),errors=[];
 if(!parts)return ['经营小结须按结论、依据、原因、建议各一行完整返回'];
 if(parts.some(part=>part.text.length>100)||parts.reduce((sum,part)=>sum+part.text.length,0)>300)errors.push('经营小结过长，请精简为四句');
 if(/负向|正向|抵消|对称分解|贡献度|贡献率|归因分解/.test(text))errors.push('经营小结须用商家易懂的表达，避免负向、正向、抵消或分解术语');
 const available=(overview.metrics||[]).filter(m=>Number.isFinite(m.value)&&Number.isFinite(m.previousValue));
 if(available.some(m=>m.unit!=='%'&&/曝光|观看人数|触达/.test(m.label))&&!/流量|曝光|观看|触达/.test(parts[0].text))errors.push('有流量证据时，综合结论不能只概括成交');
 if(available.some(m=>m.unit==='%'&&/转化率|成交率/.test(m.label))&&!/转化|成交率|成交效率|购买效率/.test(parts[0].text))errors.push('有转化证据时，综合结论须概括转化表现');
 if(/针对性调整|进一步优化|综合施策/.test(parts[3].text))errors.push('经营小结的建议须明确核查对象、确认条件和具体动作，不能只说针对性调整');
 const goal=overview.goal,hasGoal=Number.isFinite(goal?.actual)&&Number.isFinite(goal?.target)&&goal.target>0;
 if(hasGoal){
  if(!/目标|达标|达成|完成/.test(parts[0].text))errors.push('经营小结的综合结论须说明目标是否达成');
  const achieved=goal.actual>=goal.target;
  if(achieved&&/目标.{0,6}(尚未达成|未完成|未达标)|尚未.{0,4}(完成|达成).{0,4}目标|仍有目标缺口/.test(text))errors.push('目标已达成，经营小结不能说尚未达标或仍有缺口');
  if(!achieved&&/目标已(?:达成|完成)|已经达标|已超额完成/.test(text))errors.push('目标尚未达成，经营小结不能说已达标');
  for(const match of text.matchAll(/(?:目标完成率?|完成率|完成)\s*([\d.]+)%/g))if(Math.abs(Number(match[1])-100*goal.actual/goal.target)>.11)errors.push('经营小结的目标完成率与本轮数据不一致');
 }
 return errors;
}
