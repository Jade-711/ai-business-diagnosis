// The producer and its editor use the same rule representation and validation.
// Normalization changes protocol aliases only, never thresholds or comparisons.
function normalizeProductionRule(rule){
 if(!rule||typeof rule!=='object')return rule;
 const next={...rule};
 if(Array.isArray(next.children)){
  if(next.children.length){next.children=next.children.map(normalizeProductionRule);return next;}
  if(String(next.metricId||'').trim())delete next.children;
 }
 if(next.rightType==='number')next.rightType='value';
 if(next.rightType==='metric'){
  if(next.factor===undefined&&next.rightNumber!==undefined)next.factor=next.rightNumber;
  // A comparison without arithmetic has the same neutral factor as the editor.
  if(next.factor===undefined&&(!next.rightCalc||next.rightCalc==='none'))next.factor=1;
 }
 return next;
}
function productionRuleMetricIds(rule){
 if(!rule||typeof rule!=='object')return [];
 if(Array.isArray(rule.children)&&rule.children.length)return [...new Set(rule.children.flatMap(productionRuleMetricIds))];
 return [...new Set([rule.metricId,...(rule.rightType==='metric'?[rule.rightMetricId]:[])].filter(Boolean))];
}
function validateProductionRule(rule,metrics,allowedIds,depth=0){
 if(!rule||typeof rule!=='object')return '请提供完整的指标规则';
 if(Array.isArray(rule.children)){
  if(depth>1)return '条件组最多支持两层嵌套';
  if(!rule.children.length)return '每个条件组至少需要一条条件';
  if(!['AND','OR'].includes(rule.join))return '规则条件组只支持 AND / OR';
  for(const child of rule.children){const error=validateProductionRule(child,metrics,allowedIds,depth+1);if(error)return error;}
  return null;
 }
 if(!allowedIds.includes(rule.metricId))return '规则引用了未选择或未关联到场景的指标';
 const metric=metrics.find(item=>item.id===rule.metricId);
 if(!metric||['String','Image'].includes(metric.dataType))return '数值规则需要选择数值指标';
 if(!['<','<=','>','>=','==','!='].includes(rule.op))return '规则比较符不受支持';
 const number=value=>value!==null&&value!==''&&value!==undefined&&Number.isFinite(Number(value));
 if(rule.rightType==='metric'){
  if(!allowedIds.includes(rule.rightMetricId))return '请选择已关联的右侧比较指标';
  if(!number(rule.factor))return '请填写右侧指标运算系数 factor';
  if(rule.rightNumber!==undefined&&Number(rule.rightNumber)!==Number(rule.factor))return '右侧运算参数不一致，请统一 factor 与 rightNumber';
  const right=metrics.find(item=>item.id===rule.rightMetricId);
  if(!right||right.unit!==metric.unit)return '左右指标单位不一致，请调整表达式';
 }else if(!['value','number',undefined,''].includes(rule.rightType))return '规则右侧类型只支持数值或指标';
 else if(!number(rule.value))return '请填写有效的规则阈值';
 if(rule.leftCalc==='/'&&Number(rule.leftNumber)===0||rule.rightType==='metric'&&rule.rightCalc==='/'&&Number(rule.factor)===0)return '除数不能为0';
 for(const side of ['left','right']){
  if(side==='right'&&rule.rightType!=='metric')continue;
  const transform=rule[side+'Transform']||'value',calc=rule[side+'Calc']||'none';
  const asset=metrics.find(item=>item.id===rule[side==='left'?'metricId':'rightMetricId']);
  if(!['value','previous','mean','peerMean','sameLevelMean','median'].includes(transform))return '指标比较变换不受支持';
  if(!['none','+','-','*','/'].includes(calc))return '指标运算符不受支持';
  if(side==='left'&&calc!=='none'&&!number(rule.leftNumber))return '请填写左侧指标运算系数';
  if(transform!=='value'&&asset?.derived!=='value')return '衍生指标不能重复套用均值或对比变换';
  const required={mean:'均值',peerMean:'同行均值',sameLevelMean:'同行同等级均值',median:'分位值'}[transform];
  if(required&&!asset?.derivations?.includes(required))return `请先在指标管理中启用${required}`;
 }
 return null;
}
