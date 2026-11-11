// Native workflow helper: use tool-computed facts for quantitative statements.
// Missing model records are not filled in: the existing repair path must run.
export function groundAssistantModel(calculation,model){
 const g=calculation.materials?.grounding;if(!g)return model;
 const out={...model};
 out.explanations=(Array.isArray(model.explanations)?model.explanations:[]).map(m=>{
  const f=g.issues.find(f=>f.strategyId===m.strategyId);if(!f)return m;
  return {...m,judgment:m.judgment?.trim()?f.judgment:m.judgment,basis:m.basis?.trim()?f.basis:m.basis};
 });
 if(model.goalDiagnosis)out.goalDiagnosis={...model.goalDiagnosis,...(model.goalDiagnosis.judgment?.trim()&&g.goalJudgment?{judgment:g.goalJudgment}:{}),...(model.goalDiagnosis.basis?.trim()&&g.goalBasis?{basis:g.goalBasis}:{})};
 if(calculation.materials.summaryRequired){
  const lines=String(model.summary||'').trim().split('\n').filter(s=>s.trim());
  if(lines.length===4&&['结论','依据','原因','建议'].every((label,i)=>new RegExp('^'+label+'[：:]').test(lines[i]))){
   lines[0]='结论：'+g.summary.conclusion;lines[1]='依据：'+g.summary.basis;
   if(g.issues.some(i=>i.relation))lines[2]='原因：'+g.summary.reason+'具体经营原因仍需明细核实。';
   const first=out.explanations.find(e=>e.strategyId===calculation.result?.diagnosis?.[0]?.strategyId)?.actions?.find(a=>a.text?.trim());
   if(first)lines[3]='建议：'+first.text.trim();
   out.summary=lines.join('\n');
  }
 }
 return out;
}
export function validateAssistantModelSafety(calculation,model){
 const g=calculation.materials?.grounding;if(!g)return [];
 const errors=[];
 const check=(a,text)=>{
  text=String(text||'');if(!a||!text)return;
  const executable=/补排|调整|修正|修复|加投|投放|增加预算|降价|发布新品|新增商品|更换|小范围测试/.test(text);
  const condition=text.match(/(?:若|如果|仅当)(.*?)(?:再|后)/)?.[1]||text.match(/(?:确认|核实)([^；。]*?)后/)?.[1]||'';
  if(executable&&!/若|如果|确认|核实|仅当|满足/.test(text))errors.push(a.name+'：须先核查具体经营对象并确认执行前提');
  if(/直播计划/.test(a.name)&&/补排|调整.{0,8}时段/.test(text)&&(!/缺播|未完成.{0,6}计划|时段不足|时长不足/.test(condition)||/或.{0,12}(来源|观看|曝光)|(?:来源|观看|曝光).{0,12}或/.test(condition)))errors.push(a.name+'：只有核实缺播或有效时段不足后才补排；来源或观看收缩本身不满足前提。参考：'+a.instruction);
  if(/快分销/.test(a.name)&&executable&&!/匹配|货盘|交付|履约|合作内容/.test(condition))errors.push(a.name+'：须确认达人商品匹配、货盘或合作交付问题；订单下滑本身不是调整匹配的前提。参考：'+a.instruction);
  if(executable&&/秒杀|特卖/.test(a.name)&&/毛利|库存|资格/.test(a.instruction||'')){
   const absent=[[/毛利|利润|盈利/,/毛利|利润|盈利/,'毛利'],[/库存|履约/,/库存|履约|可供货/,'库存与履约'],[/资格|资质|准入/,/资格|资质|准入/,'活动资格']].filter(([required,pattern])=>required.test(a.instruction||'')&&!pattern.test(text)).map(([, ,label])=>label);
   if(absent.length)errors.push(a.name+'：执行活动调整前还须核验'+absent.join('、')+'，不能仅凭每单金额下降就调整活动。参考：'+a.instruction);
  }
  if(executable&&/投流|推广|金牛/.test(a.name)&&(!/预算|花费上限|成本上限/.test(text)||!/承接|转化|支付/.test(text)))errors.push(a.name+'：付费测试须先核对承接条件、预算或花费上限，不能以流量收缩直接触发投放。参考：'+a.instruction);
 };
 for(const m of model.explanations||[]){
  const f=g.issues.find(f=>f.strategyId===m.strategyId);if(!f)continue;
  for(const a of m.actions||[])check(f.actions.find(x=>x.id===a.actionId),a.text);
 }
 const bindings=[...(calculation.materials.goalActions||[]),...g.issues.flatMap(f=>f.actions)];
 for(const p of model.goalDiagnosis?.plans||[])check(bindings.find(a=>a.id===p.actionId),p.detail);
 const text=[model.summary,model.goalDiagnosis?.judgment,model.goalDiagnosis?.uncertainty,...(model.goalDiagnosis?.plans||[]).map(p=>p.detail),...(model.explanations||[]).flatMap(m=>[m.judgment,m.uncertainty,...(m.actions||[]).map(a=>a.text)])].filter(Boolean).join('；');
 for(const sentence of text.split(/[；。\n]/)){
  if(/商品列表(?:中|里)(?:(?!复看|复核|恢复|调整|更正|修正|随后|之后|然后|再)[^；。]){0,48}(?:成交件数|实付金额|订单明细|成交金额|佣金)|(?:从|在|通过|用)商品列表(?:中|里)?(?:取得|提供|调取|查询|导出|查看|核对)(?:(?!复看|复核|恢复|调整|更正|修正|随后|之后|然后|再)[^；。]){0,32}(?:订单明细|成交统计|成交金额|实付金额|佣金)/.test(sentence)&&!/不能|不提供|未声明|不支持/.test(sentence))errors.push('商品列表只声明查看和管理商品信息，未声明提供订单、实付金额、成交或佣金统计；这些明细须先从实际业务来源人工取得，再核对商品信息，不能说在商品列表中取得。');
  if(/(?:从|在|用|通过|调取|核查)商品列表.{0,40}(?:退款明细|支付日退款|退款统计|流量报表)|商品列表.{0,12}(?:提供|调取|查看|核对|查询).{0,24}(?:退款|渠道流量|用户画像)/.test(sentence)&&!/不能|不提供|未声明|不支持/.test(sentence))errors.push('商品列表仅查看/管理商品信息，不提供支付日退款明细或渠道报表；这些明细先人工取得，不得声称工具已提供。');
  for(const label of g.providedMetrics){
   const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   if(new RegExp('(?:缺少|未提供|尚缺)(?:本期|同周期)?'+escaped+'(?:[、，；。]|$)').test(sentence))errors.push(label+'本期与前期聚合值已提供；不能说缺失。可说明尚缺按商品、来源或场次的原始明细。');
  }
 }
 return [...new Set(errors)];
}
