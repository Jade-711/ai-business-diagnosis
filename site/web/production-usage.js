'use strict';

function aiddSaveProductionUsage(asset,result){
 const record=result?.productionUsage;if(!record||record.schemaVersion!==1)return asset;
 asset.productionUsage={...asset.productionUsage,[record.phase]:clone(record)};
 return asset;
}
function aiddProductionDuration(ms){return Number.isFinite(ms)&&ms>=0?(ms/1000).toLocaleString('zh-CN',{minimumFractionDigits:1,maximumFractionDigits:1})+' 秒':'未记录';}
function aiddProductionTokens(value){return Number.isSafeInteger(value)&&value>=0?value.toLocaleString('zh-CN'):'未返回';}
function aiddProductionUsageHTML(asset,compact=false){
 const records=asset?.productionUsage||{},generation=records.generate;
 if(compact)return `<small class="aidd-cell-note production-usage-compact" data-usage-account>${generation?`生成 ${esc(aiddProductionDuration(generation.elapsedMs??generation.durationMs))} · DeepSeek ${generation.modelUsage?.available?aiddProductionTokens(generation.modelUsage.tokens):'未返回'}${generation.modelUsage?.available?' Token':''}${generation.status==='failed'?' · 未完成':''}`:'生成耗时 / Token：未记录'}</small>`;
 const items=['generate','confirm','test'].map(phase=>records[phase]).filter(Boolean);
 if(!items.length)return '<p class="form-help production-usage-empty">生产耗时 / Token：未记录。历史记录不补估算值。</p>';
 return `<section class="production-usage" data-usage-account aria-label="生产耗时与 Token 用量">${items.map(record=>{
  const usage=record.modelUsage||{},known=usage.available===true,token=known?aiddProductionTokens(usage.tokens):'未返回',label={generate:'最近一次生成',confirm:'最近一次审核解析',test:'最近一次案例试跑'}[record.phase]||'本次生产';
  const details=known?`输入 ${aiddProductionTokens(usage.inputTokens)} · 输出 ${aiddProductionTokens(usage.outputTokens)}${Number.isSafeInteger(usage.reasoningTokens)?`（含推理 ${aiddProductionTokens(usage.reasoningTokens)}）`:''}${Number.isSafeInteger(usage.cachedInputTokens)?` · 缓存命中 ${aiddProductionTokens(usage.cachedInputTokens)}（已含在输入中）`:''}`:'接口未完整返回实际 Token 用量，不估算为 0。';
  return `<div class="production-usage-item"><div class="production-usage-heading"><strong>${label}${record.status==='failed'?' · 未完成':''}</strong><span>生产耗时 <b>${esc(aiddProductionDuration(record.elapsedMs??record.durationMs))}</b></span><span>DeepSeek <b>${token}${known?' Token':''}</b></span><span>Coze <b>${aiddProductionTokens(record.cozeTokens)} Token</b></span></div><p>${details}${Number.isSafeInteger(usage.callCount)?` · API 请求 ${usage.callCount} 次${usage.callCount>1?'（含重试）':''}`:''}${record.assetCount>1?` · 本次请求共生成 ${record.assetCount} 条候选，用量为整次请求合计`:''}</p></div>`;
 }).join('')}<p class="production-usage-note">DeepSeek 为 API 实际用量；生产直连模型，不经过 Coze。耗时从提交到收到完整结果，审核等待时间不计入。</p></section>`;
}
