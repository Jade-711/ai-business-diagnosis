// Only the deepest explicitly requested scene executes. Broad merchant views
// retain P0 coverage, so parent and child strategies cannot double-diagnose.
export function selectDiagnosticScenes(scenes,question='',fieldKey='',strategies=[],metrics=[]){
 const normalize=value=>String(value||'').replace(/[\s\-—·：:]/g,'').replaceAll('的','');
 const q=normalize(question),available=scenes.filter(s=>!fieldKey||s.fieldKey===fieldKey),depth=s=>s.level==='要素'?3:s.level==='环节'?2:s.level==='场域'?1:0;
 const name=s=>s.sceneName||s.name||'',fieldName={overview:'全店',live:'直播',video:'短视频',shelf:'货架',creator:'达人合作'};
 const named=strategies.find(s=>s.name&&q.includes(normalize(s.name))&&available.some(f=>(f.sceneId||f.id)===s.sceneId&&(f.priority==='P0'||!f.level)));
 if(named)return {scenes:available.filter(f=>(f.sceneId||f.id)===named.sceneId),explicit:true,ambiguous:false,missing:[]};
 const namedMetrics=metrics.filter(m=>m.originalName&&q.includes(normalize(m.originalName))).sort((a,b)=>b.originalName.length-a.originalName.length);
 // A field plus a metric name is not an explicit request for a deeper scene:
 // “直播的成交金额” must not match the incidental “直播成交” prefix.
 let scopeQuestion=q;for(const m of namedMetrics)scopeQuestion=scopeQuestion.replaceAll(normalize(m.originalName),'');
 let matches=available.filter(s=>scopeQuestion.includes(normalize(name(s).replace(/诊断框架$|分析框架$/,''))));
 const elements=available.filter(s=>depth(s)===3&&(scopeQuestion.includes(fieldName[s.fieldKey])||s.fieldKey===fieldKey)&&scopeQuestion.includes(normalize(name(s).split('-').at(-1))));
 if(elements.length)matches=elements;
 // An explicitly named business stage wins over a metric mentioned for
 // comparison. Metric-only requests still use the ownership fallback below.
 if(namedMetrics.length&&matches.filter(s=>depth(s)===Math.max(...matches.map(depth))).length>1)matches=matches.filter(s=>(s.metricIds||[]).some(id=>namedMetrics.filter(m=>m.originalName===namedMetrics[0].originalName).some(m=>m.id===id)));
 if(!matches.length&&scopeQuestion.includes(fieldName[fieldKey])&&/转化/.test(scopeQuestion))matches=available.filter(s=>s.level==='环节'&&name(s)===fieldName[fieldKey]+'-成交');
 if(!matches.length&&namedMetrics.length){
  const ids=namedMetrics.filter(m=>m.originalName===namedMetrics[0].originalName).map(m=>m.id),owns=s=>(s.metricIds||[]).some(id=>ids.includes(id));
  if(!available.some(s=>(s.priority==='P0'||!s.level)&&owns(s))){
   const owners=available.filter(s=>s.level==='环节'&&owns(s)),namedOwners=owners.filter(s=>q.includes(normalize(name(s))));
   matches=namedOwners.length?namedOwners:owners;
  }
 }
 if(matches.length){const deepest=Math.max(...matches.map(depth)),selected=matches.filter(s=>depth(s)===deepest);if(selected.length>1&&deepest>0)return {scenes:[],explicit:true,ambiguous:true,missing:['请先选择一个具体场景：'+selected.map(name).join('、')]};return {scenes:selected,explicit:true,ambiguous:false,missing:[]};}
 return {scenes:available.filter(s=>s.priority==='P0'||!s.level),explicit:false,ambiguous:false,missing:[]};
}

export function sceneEvidenceErrors(scene,request={}){
 if(!scene?.requiredEvidence?.length)return [];
 const supplied=request.businessEvidence;
 const context=supplied?.context||{},expected=request.context||request.pageContext||request;
 const sellerId=request.sellerId||expected.sellerId,period=expected.period||request.period,fieldKey=expected.fieldKey||request.fieldKey;
 const sameScope=supplied?.sceneId===(scene.sceneId||scene.id)&&context.fieldKey===scene.fieldKey&&(!fieldKey||context.fieldKey===fieldKey)&&sellerId&&context.sellerId===sellerId&&period&&context.period===period;
 const missing=scene.requiredEvidence.filter(key=>!sameScope||typeof supplied.records?.[key]!=='string'||!supplied.records[key].trim());
 return missing.map(key=>'本场景需补充：'+key);
}

// Read the method from the approved snapshot, never from an editor draft.
// Older snapshots retained only text; preserve that text's current definition.
export function publishedFrameworkMethod(frame={}){
 const text=String(frame.text||'');
 const breakdown=text.match(/1\. 基础拆解\n([\s\S]*?)\n2\. 下钻顺序（漏斗）/);
 const order=text.match(/2\. 下钻顺序（漏斗）\n([\s\S]*?)\n3\. 判断前提/);
 return {...frame,decomposition:breakdown?breakdown[1].split('\n').map(s=>s.replace(/^\d+\)\s*/, '').trim()).filter(Boolean):frame.decomposition||[],drilldown:order?order[1].trim():frame.drilldown||''};
}
