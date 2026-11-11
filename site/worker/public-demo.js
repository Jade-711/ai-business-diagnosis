// Anonymous use is restricted to this published synthetic merchant. Provider
// credentials and asset production remain server-side and owner-authorized.
import {workflowInputPayload} from './resource-contract.js';
const publicVisitorLimits=new Map();
const publicFields=new Set(['overview','live','video','shelf','creator']);
const publicPeriods=new Set(['week','day']);
function publicContext(input={}){
 const fieldKey=input.fieldKey||'overview',period=input.period||'week';
 if(!publicFields.has(fieldKey)||!publicPeriods.has(period))throw Error('当前试用仅支持看板已有的场域和周期。');
 if(input.sellerId&&input.sellerId!=='DEMO_10001')throw Error('公开试用仅支持当前演示店铺。');
 return {fieldKey,period,metricKey:typeof input.metricKey==='string'?input.metricKey.slice(0,100):''};
}
export function sanitizePublicDemoRequest(body,catalog){
 if(body.sellerId&&body.sellerId!=='DEMO_10001')throw Error('公开试用仅支持当前演示店铺。');
 const pageContext=publicContext(body.pageContext||body.context),question=body.question;
 const history=(Array.isArray(body.history)?body.history:[]).slice(-12).filter(m=>['user','assistant'].includes(m?.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,4000),...(m.context?{context:publicContext(m.context)}:{})}));
 if(history.reduce((n,m)=>n+m.content.length,0)>24000)throw Error('本轮会话较长，请新开对话后继续。');
 const runtimeConfigurations=Object.fromEntries(Object.entries(catalog).map(([key,r])=>[key,workflowInputPayload(r.config,r.data,key.split(':')[0],{question,pageContext}).configuration]));
 const strategyIds=new Set(Object.values(catalog).flatMap(r=>(r.config?.strategies||[]).map(s=>s.id)));
 return {schemaVersion:1,question,sellerId:'DEMO_10001',pageContext,history,chatId:typeof body.chatId==='string'?body.chatId.slice(0,120):'',excludeStrategyIds:(Array.isArray(body.excludeStrategyIds)?body.excludeStrategyIds:[]).filter(id=>strategyIds.has(id)).slice(0,120),runtimeConfigurations};
}
export async function reservePublicDemoBudget(request,env,now=new Date()){
 // Per-visitor short-window control plus a durable shared daily ceiling. No
 // IP address or chat text is written to the public quota table.
 const visitor=request.headers.get('cf-connecting-ip')||'anonymous',at=now.getTime(),entry=publicVisitorLimits.get(visitor);
 if(entry&&at-entry.at<60000&&entry.count>=6)return {ok:false,status:429,error:'试用请求较频繁，请稍后再试。'};
 if(publicVisitorLimits.size>10000)for(const [key,value]of publicVisitorLimits)if(at-value.at>=60000)publicVisitorLimits.delete(key);
 if(!env.DB?.prepare)return {ok:false,status:503,error:'试用服务暂时不可用，请稍后再试。'};
 const configuredLimit=Number(env.COZE_PUBLIC_DAILY_LIMIT??300),limit=Number.isInteger(configuredLimit)&&configuredLimit>=0&&configuredLimit<=1000?configuredLimit:0;
 try{
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS public_workflow_budget (day TEXT PRIMARY KEY, request_count INTEGER NOT NULL, updated_at TEXT NOT NULL)').run();
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const row=await env.DB.prepare('INSERT INTO public_workflow_budget (day,request_count,updated_at) SELECT ?,1,? WHERE ?>0 ON CONFLICT(day) DO UPDATE SET request_count=public_workflow_budget.request_count+1,updated_at=excluded.updated_at WHERE public_workflow_budget.request_count<? RETURNING request_count').bind(day,now.toISOString(),limit,limit).first();
  if(!row)return {ok:false,status:429,error:'今日公开试用次数已用完，请明日再试。'};
  publicVisitorLimits.set(visitor,entry&&at-entry.at<60000?{at:entry.at,count:entry.count+1}:{at,count:1});
  return {ok:true};
 }catch{return {ok:false,status:503,error:'试用服务暂时不可用，请稍后再试。'};}
}
