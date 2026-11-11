// Saved Workflow results. Reading these never invokes a Workflow or a model.
const DASHBOARD_SNAPSHOT_REVISION='workflow-v0.0.12-display-v1';
export function dashboardSnapshotQuestion(field,period){
 const time=period==='day'?'昨日':'近7天',name={overview:'全店',live:'直播',video:'短视频',shelf:'货架',creator:'达人合作'}[field];
 // Fixed display copy is assembled from the saved structured results. Do not
 // ask the model to also write an unused free-text business-summary field.
 return field==='overview'?`帮我进行${time}全店诊断`:`帮我分析${time}${name}的经营问题`;
}
function canonicalSnapshotValue(value){
 if(Array.isArray(value))return value.map(canonicalSnapshotValue);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalSnapshotValue(value[key])]));
 return value;
}
export async function dashboardSnapshotSignature(config,data){
 const bytes=new TextEncoder().encode(JSON.stringify(canonicalSnapshotValue({revision:DASHBOARD_SNAPSHOT_REVISION,config,data})));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function dashboardSnapshotTable(db){
 if(!db)throw Error('看板快照存储尚未配置');
 await db.prepare('CREATE TABLE IF NOT EXISTS dashboard_workflow_snapshots (id TEXT PRIMARY KEY, owner TEXT NOT NULL, field_key TEXT NOT NULL, period TEXT NOT NULL, signature TEXT NOT NULL, generated_at INTEGER NOT NULL, result TEXT NOT NULL)').run();
}
export async function readDashboardSnapshots(db,owner,configurations,catalog){
 await dashboardSnapshotTable(db);
 const snapshots={};
 await Promise.all(Object.entries(configurations||{}).filter(([key])=>catalog[key]).map(async([key,config])=>{
  const signature=await dashboardSnapshotSignature(config,catalog[key].data),id=owner+'|'+key+'|'+signature;
  const row=await db.prepare('SELECT generated_at, result FROM dashboard_workflow_snapshots WHERE id = ?').bind(id).first();
  if(row)snapshots[key]={origin:'workflow_snapshot',signature,generatedAt:row.generated_at,result:JSON.parse(row.result)};
 }));
 return {snapshots};
}
export async function saveDashboardSnapshot(db,owner,body,result,catalog){
 const {fieldKey,period}=body.pageContext||{},key=fieldKey+':'+period,config=body.runtimeConfigurations?.[key];
 if(!catalog[key]||!config)throw Error('本次工作流结果未完整通过核验：配置缺失');
 if(result.workflowContract!==1||result.workflow?.modelOutputReceived!==true)throw Error('本次工作流结果未完整通过核验：缺少真实模型返回记录');
 if(result.context?.fieldKey!==fieldKey||result.context?.period!==period)throw Error(`本次工作流结果未完整通过核验：返回范围为${result.context?.fieldKey}/${result.context?.period}，请求为${fieldKey}/${period}`);
 if(result.quality?.validated!==true)throw Error('本次工作流结果未完整通过核验：'+(result.quality?.errors||[]).slice(0,4).join('；'));
 await dashboardSnapshotTable(db);
 const signature=await dashboardSnapshotSignature(config,catalog[key].data),generatedAt=Date.now();
 await db.prepare('INSERT OR REPLACE INTO dashboard_workflow_snapshots (id, owner, field_key, period, signature, generated_at, result) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(owner+'|'+key+'|'+signature,owner,fieldKey,period,signature,generatedAt,JSON.stringify(result)).run();
 return {origin:'workflow_snapshot',signature,generatedAt};
}
