'use strict';
const AIDD_CATALOG_BACKUPS='workflow-lab-aidd-catalog-backups-v1';
function aiddCatalogBackups(){try{const raw=localStorage.getItem(AIDD_CATALOG_BACKUPS)||'[]',value=typeof aiddStorageDecode==='function'?aiddStorageDecode(raw):JSON.parse(raw);return Array.isArray(value)?value:[];}catch{return [];}}
function aiddCuratedSample(metric,period){return aiddData?.catalog&&aiddData.demoData?.metrics?.[metric?.id]?.[period]||null;}
function aiddBackupCatalog(data,reason){
 const snapshots=aiddCatalogBackups();
 const backup={id:aiddId('catalog-backup'),createdAt:aiddNow(),reason,revision:data.catalogRevision||'previous',data:clone(data),legacyRaw:localStorage.getItem(STORAGE_KEY)};
 snapshots.push(backup);
 // Keep every replacement recoverable. If storage is full, abort replacement.
 localStorage.setItem(AIDD_CATALOG_BACKUPS,typeof aiddStorageEncode==='function'?aiddStorageEncode(snapshots):JSON.stringify(snapshots));
 return backup;
}
function aiddCuratedLegacy(data){
 const live=data.scenes.find(s=>s.fieldKey==='live'&&s.priority==='P0'),config=live&&data.published[live.id]?.periods?.week;
 if(!config)return;
 state.draft={...clone(state.draft),framework:config.framework,strategies:clone(config.strategies)};
 state.published={...clone(config),framework:config.framework,strategies:clone(config.strategies)};
 persist();
}
function aiddPrepareCuratedCatalog(saved){
 if(typeof AIDD_CURATED_CATALOG==='undefined')return saved;
 const revision=AIDD_CURATED_CATALOG.catalogRevision;
 if(saved?.catalogRevision===revision&&saved.dashboardActionMappingVersion!==1&&typeof repairPublishedActionMappings==='function'){
  try{aiddBackupCatalog(saved,'行动建议映射改为发布配置前备份');saved=repairPublishedActionMappings(saved);localStorage.setItem(AIDD_STORAGE,typeof aiddStorageEncode==='function'?aiddStorageEncode(saved):JSON.stringify(saved));}
  catch{toast('行动映射修正前备份未能保存，已保留原配置。');return saved;}
 }

 if(saved?.catalogRevision===revision&&saved.businessAcceptanceRepairVersion!==1&&typeof repairReviewedSceneCatalog==='function'){
  try{aiddBackupCatalog(saved,'全场景验收：证据及工具映射修正前备份');saved=repairReviewedSceneCatalog(saved);localStorage.setItem(AIDD_STORAGE,typeof aiddStorageEncode==='function'?aiddStorageEncode(saved):JSON.stringify(saved));}
  catch{toast('验收修正前备份未能保存，已保留原配置。');return saved;}
 }
 if(saved?.catalogRevision===revision){
  if(saved.demoData?.mode==='synthetic'&&saved.demoData.businessFixtureVersion!==AIDD_CURATED_CATALOG.demoData?.businessFixtureVersion){
   try{
    aiddBackupCatalog(saved,'全场景合成样本口径校正前备份');const next=clone(saved);
    for(const id of AIDD_CURATED_CATALOG.demoData.businessFixtureMetricIds||[])next.demoData.metrics[id]=clone(AIDD_CURATED_CATALOG.demoData.metrics[id]);
    for(const key of ['businessFixtureVersion','businessFixtureMetricIds','businessFixtureNote'])next.demoData[key]=clone(AIDD_CURATED_CATALOG.demoData[key]);
    localStorage.setItem(AIDD_STORAGE,typeof aiddStorageEncode==='function'?aiddStorageEncode(next):JSON.stringify(next));saved=next;
   }catch{toast('样本校正前备份未能保存，已保留原样本。');}
  }
  if(saved.demoData?.mode==='synthetic'&&saved.demoData.videoExposureFixtureVersion!==AIDD_CURATED_CATALOG.demoData?.videoExposureFixtureVersion){
   const next=clone(saved),ids=['research-metric-video-06','research-metric-video-07','research-metric-video-21'];
   next.demoData.fixtureHistory=[...(next.demoData.fixtureHistory||[]),{reason:'短视频曝光演示数据口径校正',metrics:Object.fromEntries(ids.map(id=>[id,clone(saved.demoData.metrics[id])]))}];
   for(const id of ids)next.demoData.metrics[id]=clone(AIDD_CURATED_CATALOG.demoData.metrics[id]);
   next.demoData.videoExposureFixtureVersion=AIDD_CURATED_CATALOG.demoData.videoExposureFixtureVersion;
   try{localStorage.setItem(AIDD_STORAGE,typeof aiddStorageEncode==='function'?aiddStorageEncode(next):JSON.stringify(next));saved=next;}
   catch{toast('演示样本更新未能保存，已保留原配置。');}
  }
  if(saved.catalog&&saved.sceneDeploymentVersion!==AIDD_CURATED_CATALOG.sceneDeploymentVersion&&typeof buildAllSceneDeployment==='function'){
   try{aiddBackupCatalog(saved,'全场景框架与策略补齐前备份');const next=buildAllSceneDeployment(saved.strategyScopeVersion===1?saved:shareCatalogStrategies(clone(saved)));localStorage.setItem(AIDD_STORAGE,typeof aiddStorageEncode==='function'?aiddStorageEncode(next):JSON.stringify(next));aiddCuratedLegacy(next);return aiddRepairLiveRevenue(next);}
   catch{toast('全场景发布前备份未能保存，已保留原配置。');return saved;}
  }
  if(saved.catalog&&saved.strategyScopeVersion!==1){
   try{aiddBackupCatalog(saved,'策略改为跨周期共用前备份');const next=shareCatalogStrategies(clone(saved));localStorage.setItem(AIDD_STORAGE,typeof aiddStorageEncode==='function'?aiddStorageEncode(next):JSON.stringify(next));aiddCuratedLegacy(next);return next;}
   catch{toast('策略合并前备份未能保存，已保留原配置。');return saved;}
  }
  if(saved.catalog)aiddCuratedLegacy(saved);return aiddRepairLiveRevenue(saved);
 }
 const next=clone(AIDD_CURATED_CATALOG);
 if(saved?.catalog&&next.businessFrameworkVersion===2&&saved.catalogRevision===next.catalog.sourceRevision){
  // Replace requested methods, while retaining user-maintained asset records.
  for(const key of ['metrics','actions','conditions']){
   const retained=new Map((saved[key]||[]).map(x=>[x.id,x]));
   next[key]=next[key].map(x=>({...x,...clone(retained.get(x.id)||{})}));
   next[key].push(...(saved[key]||[]).filter(x=>!next[key].some(n=>n.id===x.id)).map(clone));
  }
  for(const publication of Object.values(next.published))for(const snapshot of Object.values(publication.periods||{})){
   snapshot.metrics=snapshot.metrics.map(m=>clone(next.metrics.find(x=>x.id===m.id)||m));
   snapshot.actions=snapshot.actions.map(a=>clone(next.actions.find(x=>x.id===a.id)||a));
  }
 }
 try{
  if(saved)aiddBackupCatalog(saved,'诊断框架与策略业务重整前完整备份');
  localStorage.setItem(AIDD_STORAGE,typeof aiddStorageEncode==='function'?aiddStorageEncode(next):JSON.stringify(next));
  aiddCuratedLegacy(next);
 }catch(error){
  if(saved){toast('备份空间不足，已保留原资产，请先导出备份并释放浏览器空间。');return saved;}
  toast('浏览器未允许保存，本批资产仅在当前页面可用。');
 }
 return next;
}
function aiddRepairLiveRevenue(saved){
 if(!saved?.catalog||saved.liveRevenueDiagnosisVersion===1||typeof repairLiveRevenueCatalog!=='function')return saved;
 try{aiddBackupCatalog(saved,'直播成交金额下降诊断修正前备份');const next=repairLiveRevenueCatalog(saved);localStorage.setItem(AIDD_STORAGE,aiddStorageEncode(next));aiddCuratedLegacy(next);return next;}
 catch{toast('诊断修正前备份未能保存，已保留原配置。');return saved;}
}
function aiddCatalogBanner(){
 if(!aiddData.catalog)return '';
 const active=aiddData.frameworks.filter(f=>f.status==='生效中'&&aiddData.scenes.some(s=>s.id===f.sceneId&&s.priority==='P0')).length;
 return `<section class="card aidd-catalog-banner" aria-label="资产入库批次"><div><strong>${esc(aiddData.catalog.name)}</strong><p>${aiddData.scenes.length} 个场景 · ${aiddData.metrics.length} 个指标定义 · ${aiddData.actions.length} 个行动点 · P0框架生效 ${active} 个 · 策略生效 ${aiddData.strategies.filter(s=>s.status==='生效中').length} 条</p><small>按四层口径重整；指标和工具名称已核验。真实取数待接入，不能据此输出真实经营结论。</small></div><div class="row"><button class="text-btn" data-catalog-backup ${!aiddCatalogBackups().length?'disabled':''}>替换前备份</button></div></section>`;
}
function aiddShowCatalogBackup(){
 const backups=aiddCatalogBackups(),prior=backups.find(b=>b.revision==='previous')||backups[0];
 if(!prior){toast('当前浏览器没有替换前资产。');return;}
 aiddUI.catalogBackupId=prior.id;
 modal('替换前资产备份',esc(prior.createdAt),`<p>已保留替换前的完整场景、指标、行动点、诊断框架、诊断策略及发布快照。</p><p>${prior.data.scenes.length} 个场景 · ${prior.data.metrics.length} 个指标 · ${prior.data.actions.length} 个行动点 · ${prior.data.frameworks.length} 个框架 · ${prior.data.strategies.length} 条策略</p><p class="form-help">恢复会替换当前配置；恢复前也会备份当前配置，因此本次替换可撤销。</p>`,`${cancelModalBtn()}<button class="btn" data-catalog-download>下载完整备份</button><button class="btn" data-catalog-restore>恢复这份备份</button>`);
}
function aiddDownloadCatalogBackup(){
 const value=aiddCatalogBackups().find(b=>b.id===aiddUI.catalogBackupId);if(!value)return;
 const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download='aidd-assets-before-20261102.json';link.click();URL.revokeObjectURL(url);
}
function aiddRestoreCatalogBackup(){
 const value=aiddCatalogBackups().find(b=>b.id===aiddUI.catalogBackupId);if(!value)return;
 try{
  aiddBackupCatalog(aiddData,'恢复旧资产前备份当前配置');
  const restored=clone(value.data);restored.catalogRevision=AIDD_CURATED_CATALOG.catalogRevision;restored.catalog=null;restored.restoredFromBackup=value.id;
  localStorage.setItem(AIDD_STORAGE,typeof aiddStorageEncode==='function'?aiddStorageEncode(restored):JSON.stringify(restored));
  if(value.legacyRaw)localStorage.setItem(STORAGE_KEY,value.legacyRaw);
  const legacy=value.legacyRaw?JSON.parse(value.legacyRaw):null;if(legacy?.published&&legacy?.draft){state.published=clone(legacy.published);state.draft=clone(legacy.draft);}
  aiddData=restored;aiddUI.sceneId=restored.scenes[0]?.id;aiddUI.frameId=null;aiddUI.frameView='list';aiddUI.page=1;
  closeModal();render();toast('已恢复备份；恢复前的配置也已保留。');
 }catch{toast('备份或恢复未能保存，当前配置已保留。');}
}
document.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 if('catalogBackup'in b.dataset)aiddShowCatalogBackup();
 else if('catalogDownload'in b.dataset)aiddDownloadCatalogBackup();
 else if('catalogRestore'in b.dataset)aiddRestoreCatalogBackup();
});
