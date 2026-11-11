'use strict';
// Normalize rendered copy only. Asset IDs, input values, links, data attributes
// and the server's execution protocol retain their original bindings.
function neutralProductCopy(value){
 return String(value??'')
  .replace(/快手小店(?:商家工作台)?/g,'商家工作台')
  .replace(/快手电商|快手平台|快手/g,'平台')
  .replace(/生意通/g,'经营看板')
  .replace(/磁力金牛/g,'付费推广')
  .replace(/快分销/g,'分销平台')
  .replace(/AIDD[_\s-]*Production/gi,'配置生产流程')
  .replace(/AIDD[_\s-]*Execution/gi,'诊断执行流程')
  .replace(/\bAIDD(?=\b|[_-])/gi,'诊断配置')
  .replace(/\bAiDS\b/gi,'指标服务')
  .replace(/\bSYT(?=[_-])/gi,'DEMO')
  .replace(/\bcoze_workflow\b/gi,'工作流')
  .replace(/\bCoze\s*(?:工作流)?/gi,'工作流')
  .replace(/扣子/g,'工作流平台')
  .replace(/\bDeepSeek\b/gi,'分析模型')
  .replace(/\bMain_agent\b/g,'主工作流');
}
function neutralizeCopyNode(node){
 if(node.nodeType===3){
  if(node.parentElement?.closest('script,style,textarea,[contenteditable],[data-usage-account]'))return;
  const current=node.nodeValue,next=neutralProductCopy(current);
  if(next!==current)node.nodeValue=next;
  return;
 }
 if(node.nodeType!==1||node.matches('script,style,textarea,[contenteditable],[data-usage-account]'))return;
 for(const name of ['aria-label','title','alt','placeholder']){
  const current=node.getAttribute(name);if(current===null)continue;
  const next=neutralProductCopy(current);if(next!==current)node.setAttribute(name,next);
 }
 for(const child of node.childNodes)neutralizeCopyNode(child);
}
if(typeof MutationObserver==='function'&&document.documentElement){
 neutralizeCopyNode(document.documentElement);
 new MutationObserver(records=>{
  for(const record of records){
   if(record.type==='childList')for(const node of record.addedNodes)neutralizeCopyNode(node);
   else if(record.type==='characterData')neutralizeCopyNode(record.target);
   else if(record.type==='attributes'){
    const current=record.target.getAttribute(record.attributeName);if(current===null)continue;
    const next=neutralProductCopy(current);
    if(current!==next)record.target.setAttribute(record.attributeName,next);
   }
  }
 }).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','alt','placeholder']});
}
