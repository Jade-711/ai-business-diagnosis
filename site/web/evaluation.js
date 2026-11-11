'use strict';
const EVAL_STATE={records:[],running:false,controller:null};
const evalElement=id=>document.getElementById(id);
function evalExport(){return {schemaVersion:1,source:'published Site evaluation UI',location:location.origin,recordedAt:new Date().toISOString(),userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},records:EVAL_STATE.records};}
function evalSync(){evalElement('results').value=JSON.stringify(evalExport(),null,2);}
function evalAnswer(result){return [result.answer,...(result.diagnosis||[]).flatMap(d=>[d.name,...(d.reasonItems||[]).map(x=>x.label+'：'+x.text),...(d.actionItems||[]).map(x=>'建议：'+x.text+'；复看：'+x.verification)]),...(result.goalDiagnosis?.plans||[]).map(p=>p.title+'：'+p.detail+'；复看：'+p.verification)].filter(Boolean).join('\n');}
evalElement('run').onclick=async()=>{
 if(EVAL_STATE.running)return;
 let rows;try{rows=JSON.parse(evalElement('requests').value);if(!Array.isArray(rows)||!rows.length)throw Error();}catch{evalElement('status').textContent='请粘贴有效的测试请求数组';return;}
 EVAL_STATE.running=true;evalElement('run').disabled=true;evalElement('stop').disabled=false;
 for(const row of rows){
  if(!EVAL_STATE.running)break;
  const request=row.request||row,caseId=row.caseId||request.chatId;
  EVAL_STATE.controller=new AbortController();evalElement('status').textContent='正在运行 '+caseId;
  const startedAt=new Date().toISOString(),started=performance.now(),visibleAtStart=document.visibilityState==='visible';
  try{
   const key=evalElement('key').value;
   const result=await requestAppStream('/api/evaluation/run',request,{signal:EVAL_STATE.controller.signal,headers:key?{'x-evaluation-key':key}:{},onProgress:text=>{evalElement('status').textContent=caseId+' · '+text;}});
   evalElement('answer').textContent=evalAnswer(result);
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   EVAL_STATE.records.push({caseId,request,startedAt,completedAt:new Date().toISOString(),uiCompleteMs:performance.now()-started,visibleAtStart,visibleAtEnd:document.visibilityState==='visible',success:true,result});
  }catch(error){EVAL_STATE.records.push({caseId,request,startedAt,completedAt:new Date().toISOString(),uiCompleteMs:performance.now()-started,visibleAtStart,visibleAtEnd:document.visibilityState==='visible',success:false,error:error.message});}
  evalSync();evalElement('status').textContent='已完成 '+EVAL_STATE.records.length+' 条';
 }
 EVAL_STATE.running=false;EVAL_STATE.controller=null;evalElement('run').disabled=false;evalElement('stop').disabled=true;evalElement('status').textContent='本批结束，共保存 '+EVAL_STATE.records.length+' 条实际记录';
};
evalElement('stop').onclick=()=>{EVAL_STATE.running=false;EVAL_STATE.controller?.abort();};
evalElement('copy').onclick=async()=>{await navigator.clipboard.writeText(JSON.stringify(evalExport()));evalElement('status').textContent='已复制实际结果';};
evalElement('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(evalExport(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ai-eval-browser-performance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
