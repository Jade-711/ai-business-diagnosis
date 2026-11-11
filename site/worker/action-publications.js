// Shared, published action mappings. Reads do not invoke a model or Workflow.
function requireActionPublicationDB(db){if(!db?.prepare)throw Error('行动映射的服务端存储暂不可用');}
export async function readActionPublications(db){
 requireActionPublicationDB(db);
 const result=await db.prepare('SELECT scene_id, revision, payload FROM dashboard_action_publications ORDER BY scene_id').all();
 const scenes=Object.fromEntries((result.results||[]).map(r=>[r.scene_id,{...JSON.parse(r.payload),revision:r.revision}]));
 return {schemaVersion:1,revision:Object.values(scenes).reduce((n,p)=>Math.max(n,p.revision),0),scenes};
}
export function validateActionPublication(body){
 const fail=()=>{throw Error('行动映射配置无效，请核对策略、工具及建议文字');};
 const string=(v,max)=>typeof v==='string'&&v.length<=max;
 if(body?.schemaVersion!==1||!string(body.sceneId,160)||!body.sceneId||!['overview','live','video','shelf','creator'].includes(body.fieldKey)||!Array.isArray(body.strategies)||body.strategies.length>150||!Array.isArray(body.actions)||body.actions.length>150)fail();
 const actions=body.actions.map(a=>{
  if(!string(a.id,160)||!a.id||!string(a.name,160)||!a.name.trim())fail();
  const result={id:a.id,name:a.name};
  for(const key of ['description','conditions','category','fieldKey'])if(a[key]!==undefined){if(!string(a[key],4000))fail();result[key]=a[key];}
  return result;
 }),assets=new Set(actions.map(a=>a.id));
 if(assets.size!==actions.length)fail();
 const strategies=body.strategies.map(s=>{
  if(!string(s.id,160)||!s.id||!Array.isArray(s.actionIds)||s.actionIds.length>30||new Set(s.actionIds).size!==s.actionIds.length||s.actionIds.some(id=>!assets.has(id)))fail();
  const actionSubtitles=Object.fromEntries(s.actionIds.map(id=>{const text=s.actionSubtitles?.[id]??'';if(!string(text,4000))fail();return [id,text];}));
  return {id:s.id,actionIds:[...s.actionIds],actionSubtitles};
 });
 if(new Set(strategies.map(s=>s.id)).size!==strategies.length)fail();
 return {schemaVersion:1,sceneId:body.sceneId,fieldKey:body.fieldKey,active:body.active!==false,strategies,actions};
}
export async function saveActionPublication(db,body,now=Date.now()){
 const publication=validateActionPublication(body);requireActionPublicationDB(db);
 const old=await db.prepare('SELECT revision FROM dashboard_action_publications WHERE scene_id = ?').bind(publication.sceneId).first();
 const revision=Math.max(now,(old?.revision||0)+1);
 await db.prepare('INSERT INTO dashboard_action_publications (scene_id,revision,payload) VALUES (?,?,?) ON CONFLICT(scene_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload').bind(publication.sceneId,revision,JSON.stringify(publication)).run();
 return {...publication,revision};
}
