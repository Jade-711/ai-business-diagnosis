'use strict';
const ACTION_PUBLICATIONS={scenes:{},revision:0,reading:null,checkedAt:0};
const ACTION_PUBLICATION_CACHE='diagnosis-published-actions-v1';
try{const cache=JSON.parse(localStorage.getItem(ACTION_PUBLICATION_CACHE)||'null');if(cache?.schemaVersion===1&&cache.scenes){ACTION_PUBLICATIONS.scenes=cache.scenes;ACTION_PUBLICATIONS.revision=cache.revision||0;}}catch{}
function aiddActionMappingConfig(config){return applyActionMappingPublications(config,ACTION_PUBLICATIONS.scenes);}
function aiddApplyActionPublications(data){
 if(!data||data.schemaVersion!==1||!data.scenes)return false;
 const changed=JSON.stringify(ACTION_PUBLICATIONS.scenes)!==JSON.stringify(data.scenes);
 if(typeof aiddData!=='undefined'&&aiddData) aiddHydratePublishedActionMappings(data.scenes);
 ACTION_PUBLICATIONS.scenes=data.scenes;ACTION_PUBLICATIONS.revision=data.revision||0;ACTION_PUBLICATIONS.checkedAt=Date.now();
 if(changed&&typeof render==='function')render();return changed;
}
function aiddHydratePublishedActionMappings(publications){
 const mapping=s=>JSON.stringify({ids:s.actionIds||[],subtitles:s.actionSubtitles||{}});
 for(const [sceneId,publication]of Object.entries(publications)){
  const saved=aiddData.published[sceneId];if(!saved?.periods)continue;
  const prior=saved.periods.week||saved.periods.day;
  for(const current of publication.strategies||[]){
   const draft=aiddData.strategies.find(s=>s.id===current.id),old=prior.strategies?.find(s=>s.id===current.id);
   if(draft&&old&&mapping(draft)===mapping(old))Object.assign(draft,{actionIds:[...current.actionIds],actionSubtitles:{...current.actionSubtitles},actionMappings:current.actionIds.map(id=>({id,instruction:current.actionSubtitles[id]||''}))});
  }
  for(const asset of publication.actions||[]){
   const draft=aiddData.actions.find(a=>a.id===asset.id),old=prior.actions?.find(a=>a.id===asset.id),keys=['name','description','conditions','category','fieldKey'];
   if(!draft)aiddData.actions.push({...asset});else if(old&&keys.every(k=>draft[k]===old[k]))Object.assign(draft,asset);
  }
  for(const period of Object.keys(saved.periods))saved.periods[period]=applyActionMappingPublications(saved.periods[period],{[sceneId]:publication});
  const scene=aiddData.scenes.find(s=>s.id===sceneId);if(scene)scene.actionIds=[...new Set([...scene.actionIds,...(publication.actions||[]).map(a=>a.id)])];
 }
}
async function aiddRefreshActionPublications(force=false){
 if(ACTION_PUBLICATIONS.reading)return ACTION_PUBLICATIONS.reading;
 if(!force&&Date.now()-ACTION_PUBLICATIONS.checkedAt<30000)return;
 ACTION_PUBLICATIONS.reading=(async()=>{try{
  const response=await fetch('/api/dashboard/action-mappings',{cache:'no-store'});if(!response.ok)return;
  const data=await response.json();aiddApplyActionPublications(data);
  try{localStorage.setItem(ACTION_PUBLICATION_CACHE,JSON.stringify(data));}catch{}
 }catch{}finally{ACTION_PUBLICATIONS.checkedAt=Date.now();ACTION_PUBLICATIONS.reading=null;}})();
 return ACTION_PUBLICATIONS.reading;
}
async function aiddPublishActionMappings(snapshot){
 const response=await fetch('/api/dashboard/action-mappings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(actionMappingPublication(snapshot))});
 const data=await response.json();if(!response.ok)throw Error(data.error||'行动映射未能发布到服务端，请重试');
 aiddApplyActionPublications({schemaVersion:1,revision:Math.max(ACTION_PUBLICATIONS.revision,data.publication.revision),scenes:{...ACTION_PUBLICATIONS.scenes,[snapshot.sceneId]:data.publication}});
 try{localStorage.setItem(ACTION_PUBLICATION_CACHE,JSON.stringify({schemaVersion:1,revision:ACTION_PUBLICATIONS.revision,scenes:ACTION_PUBLICATIONS.scenes}));}catch{}
 return data.publication;
}
function aiddPublishedActionAssets(actions){
 const latest=new Map(Object.values(ACTION_PUBLICATIONS.scenes).sort((a,b)=>(a.revision||0)-(b.revision||0)).flatMap(p=>p.actions||[]).map(a=>[a.id,a]));
 return actions.map(a=>({...a,...(latest.get(a.id)||{})}));
}
function aiddPublishedToolAsset(name){
 const config=aiddRuntimeConfig(state.fieldKey,state.period,{allScenes:true});
 return config?.actions?.find(a=>a.id===name||a.name===name)||aiddData.actions.find(a=>a.id===name||a.name===name);
}
window.addEventListener('focus',()=>aiddRefreshActionPublications(true));
window.addEventListener('storage',event=>{
 if(event.key===ACTION_PUBLICATION_CACHE){try{aiddApplyActionPublications(JSON.parse(event.newValue));}catch{}}
 if(event.key===AIDD_STORAGE&&event.newValue){try{const data=aiddStorageDecode(event.newValue);if(data?.schema===2){aiddData=data;if(typeof render==='function')render();}}catch{}}
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')aiddRefreshActionPublications(true);});
window.setInterval?.(()=>{if(document.visibilityState==='visible')aiddRefreshActionPublications();},30000);
