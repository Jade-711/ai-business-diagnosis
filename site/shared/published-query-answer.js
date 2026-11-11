// Use only published definitions and the current request's data snapshot.
// All explicit, non-overlapping metric mentions are retained.
export function requestedMetricIds(definitions, question, context={},routingAlias=()=> '') {
 const mentions=[];
 for(const metric of definitions){
  const names=[...new Set([metric.originalName,metric.label,metric.name?.split('｜').at(-1)].filter(Boolean))];
  for(const name of names){
   let at=question.indexOf(name);
   while(at>=0){mentions.push({id:metric.id,at,end:at+name.length});at=question.indexOf(name,at+name.length);}
  }
 }
 mentions.sort((a,b)=>(b.end-b.at)-(a.end-a.at)||a.at-b.at);
 const chosen=[];
 for(const m of mentions)if(!chosen.some(x=>m.at<x.end&&x.at<m.end))chosen.push(m);
 if(chosen.length)return [...new Set(chosen.sort((a,b)=>a.at-b.at).map(x=>x.id))];
 const pointer=String(question||'').replace(/[\s，。！？?；!]/g,'');
 const inheritedReference=/^(?:那|那么|继续|接着|再|请|帮我|看|查|查一下|查询|一下)*(?:这一块|这一项|这一部分|这个|这项|昨日|昨天|近7天|最近7天|近一周)(?:呢|吗|的数值|数值|是多少|多少|怎么样|看一下|查一下)*$/.test(pointer);
 if(/这个指标|这项指标|该指标|当前指标/.test(question)||inheritedReference){
  if(!context.metricKey)return [];
  return definitions.filter(m=>m.id===context.metricKey||m.metricKey===context.metricKey||routingAlias(m.originalName||m.label||m.name?.split('｜').at(-1)||'')===context.metricKey).map(m=>m.id);
 }
 if(/\bGMV\b|成交额/i.test(question))return definitions.filter(m=>/^(成交金额|商品卡成交金额)$/.test(m.originalName||m.label||m.name?.split('｜').at(-1)||'')).map(m=>m.id);
 return [];
}

export function publishedQueryAnswer(definitions, values, requestedIds, context, inputErrors=[]) {
 const fields={overview:'全店',live:'直播',video:'短视频',shelf:'货架',creator:'达人合作'};
 const periods={week:'近7天',day:'昨日'};
 const scope=(fields[context.fieldKey]||context.fieldKey||'')+(periods[context.period]||context.period||'');
 const definitionsById=new Map(definitions.map(m=>[m.id,m]));
 const valuesById=new Map(values.filter(m=>m.derived==='value').map(m=>[m.id,m]));
 const errors=[...inputErrors], evidence=[], lines=[];
 if(!requestedIds.length)errors.push('本次所问指标未进入可查询的已发布配置，无法提供已核验数值；请补充准确指标名称或先接入该指标。');
 for(const id of requestedIds){
  const definition=definitionsById.get(id),row=valuesById.get(id);
  const label=definition?.originalName||definition?.label||definition?.name?.split('｜').at(-1)||id;
  const unit=definition?.unit||row?.unit||'';
  const unavailable=(!unit||/待核验|原始值/.test(unit))?'单位待核验，暂不能提供可验收数值':['String','Image'].includes(definition?.dataType)?'当前查询仅提供已接入的数值指标':'';
  const current=!unavailable&&Number.isFinite(row?.value)?row.value:null;
  const previous=Number.isFinite(row?.previousValue)?row.previousValue:null;
  evidence.push({metricId:id,label,value:current,unit,previousValue:previous});
  if(unavailable){errors.push(label+'：'+unavailable);lines.push(label+'：'+unavailable);}
  else if(current===null){errors.push(label+'本期数据缺失，无法提供具体数值。');lines.push(label+'：本期数据缺失');}
  else lines.push(label+'：'+current+unit);
 }
 return {schemaVersion:1,status:errors.length?'missing_data':'success',branch:'data',context,dataMode:'demo',
  evidence,metricAnalysis:evidence,diagnosis:[],actions:[],missing:[...new Set(errors)],
  answer:scope+'：'+(lines.length?lines.join('；')+'。':'')+(errors.length?[...new Set(errors)].join('；'):''),
  workflowContract:1,workflow:{contract:1,revision:'query-v2-published-metrics',explanationOrigin:'data_node',validated:true}};
}
