import {reserveAiddBudget} from './aidd-budget.js';

export async function requestAiddModel(options){
 const maxAttempts=options.maxAttempts===1?1:2;
 const calls=[];let retryReason='';
 for(let attempt=0;attempt<maxAttempts;attempt++){
  // Some schema-constrained responses contain malformed nesting at the boundary
  // between the parsed framework and the case results. On the single retry use
  // JSON-object mode with the same schema in the prompt; all business/reference
  // validation still runs before a report can be saved.
  const format=attempt&&options.format.type==='json_schema'?{type:'json_object'}:options.format;
  try{
   const response=await requestAiddModelOnce({...options,format,onUsage:usage=>calls.push(usage),input:options.input+(attempt?'\n上次返回未通过响应协议检查：'+retryReason+'。请仅根据同一份原始资料与本次JSON Schema重新输出完整、有效的JSON对象。审核稿的指标、阈值、逻辑关系不可擅改，不补造缺失证据。只返回Schema列出的字段；使用双引号并正确转义，禁止注释、尾逗号或额外文本。'+(options.retrySchema?'\nJSON Schema：'+JSON.stringify(options.retrySchema):''):'')});
   const parsed=options.validateResult?options.validateResult(response.parsed):response.parsed;
   return {...response,parsed,modelUsage:summarizeAiddModelUsage(calls)};
  }
  catch(error){if(attempt+1<maxAttempts&&['AIDD_MODEL_INVALID_JSON','AIDD_MODEL_INVALID_PROTOCOL'].includes(error.code)&&!options.signal?.aborted){retryReason=error.message.slice(0,500);options.onRetry?.();continue;}error.modelUsage=summarizeAiddModelUsage(calls);throw error;}
 }
}
function summarizeAiddModelUsage(calls){
 const last=calls.at(-1)||{},available=calls.length>0&&calls.every(call=>call.available);
 const result={provider:'DeepSeek',model:last.model,reasoningEffort:last.reasoningEffort,available,callCount:calls.length,calls,durationMs:calls.reduce((sum,call)=>sum+call.durationMs,0),...(last.budget?{budget:last.budget}:{})};
 if(available)for(const key of ['tokens','inputTokens','outputTokens','reasoningTokens','cachedInputTokens']){
  if(calls.every(call=>Number.isSafeInteger(call[key])))result[key]=calls.reduce((sum,call)=>sum+call[key],0);
 }
 return result;
}
async function requestAiddModelOnce({env,systemPrompt,input,format,maxTokens,operation,phase,route,reasoningEffort='low',signal,fetchModel=fetch,onUsage}){
 if(!['none','low','high'].includes(reasoningEffort))throw new Error('模型推理档位配置无效。');
 const model=env.DEEPSEEK_MODEL?.trim()||'deepseek-flash';
 const budget=await reserveAiddBudget(env,{model,instructions:systemPrompt,input:input+(format.type==='json_schema'?JSON.stringify(format):''),maxOutputTokens:maxTokens});
 let response;const startedAt=Date.now();
 try{response=await fetchModel('https://api.deepseek.com/responses',{method:'POST',signal,headers:{'content-type':'application/json',authorization:'Bearer '+env.DEEPSEEK_API_KEY.trim()},body:JSON.stringify({model,instructions:systemPrompt,input,text:{format},reasoning:{effort:reasoningEffort},...(reasoningEffort==='none'?{temperature:0}:{}),max_output_tokens:maxTokens,store:false})});}
 catch{onUsage({provider:'DeepSeek',model,reasoningEffort,available:false,durationMs:Date.now()-startedAt,budget});throw new Error('DeepSeek 模型连接失败，请稍后重试。');}
 if(!response.ok)onUsage({provider:'DeepSeek',model,reasoningEffort,available:false,durationMs:Date.now()-startedAt,budget});
 if(!response.ok)throw new Error(response.status===401||response.status===403?'DeepSeek 接口鉴权失败，请检查 API Key 与模型访问权限。':response.status===402?'DeepSeek API 余额不足，请检查服务账户余额。':response.status===404?'DeepSeek 模型不可用，请核对服务端模型配置。':response.status===429?'DeepSeek 速率受限，请稍后重试。':'DeepSeek 模型调用未完成，请稍后重试。');
 let payload;try{payload=await response.json();}catch{onUsage({provider:'DeepSeek',model,reasoningEffort,available:false,durationMs:Date.now()-startedAt,budget});throw new Error('DeepSeek 未返回有效响应，原有诊断资产未修改。');}
 const durationMs=Date.now()-startedAt;
 const u=payload?.usage,valid=value=>Number.isSafeInteger(value)&&value>=0;
 const available=!!u&&[u.total_tokens,u.input_tokens,u.output_tokens].every(valid)&&u.input_tokens+u.output_tokens===u.total_tokens;
 const modelUsage={provider:'DeepSeek',model,reasoningEffort,available,durationMs,budget,...(typeof payload?.id==='string'?{responseId:payload.id}:{}),...(available?{tokens:u.total_tokens,inputTokens:u.input_tokens,outputTokens:u.output_tokens}:{})};
 if(available&&valid(u.output_tokens_details?.reasoning_tokens)&&u.output_tokens_details.reasoning_tokens<=u.output_tokens)modelUsage.reasoningTokens=u.output_tokens_details.reasoning_tokens;
 if(available&&valid(u.input_tokens_details?.cached_tokens)&&u.input_tokens_details.cached_tokens<=u.input_tokens)modelUsage.cachedInputTokens=u.input_tokens_details.cached_tokens;
 onUsage(modelUsage);
 if(Number.isFinite(u?.total_tokens))console.info('AIDD模型响应',{operation,phase,route,model,tokens:u.total_tokens,durationMs});
 if(payload?.status==='incomplete'&&payload.incomplete_details?.reason==='max_output_tokens')throw new Error('DeepSeek 返回的候选内容被截断，未保存为完整结果，请缩小本次生产范围。');
 if(payload?.status!=='completed')throw new Error('DeepSeek 尚未返回完整生产结果，原有诊断资产未修改。');
 const messages=(Array.isArray(payload.output)?payload.output:[]).filter(item=>item.type==='message'&&item.role==='assistant');
 const finalMessages=messages.filter(message=>message.phase==='final_answer');
 const selectedMessages=finalMessages.length?finalMessages:messages;
 const parts=selectedMessages.flatMap(message=>Array.isArray(message.content)?message.content:[]);
 const outputText=parts.filter(part=>part.type==='output_text'&&typeof part.text==='string').map(part=>part.text).join('');
 if(!selectedMessages.length||selectedMessages.some(message=>message.status&&message.status!=='completed')||parts.some(part=>part.type==='refusal')||!outputText)throw new Error('DeepSeek 未返回可用的生产结果。');
 // A single enclosing JSON fence is presentation only. Do not extract a JSON
 // fragment from prose or repair its contents; normal validation still applies.
 const fencedJSON=outputText.trim().match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
 const jsonText=fencedJSON?fencedJSON[1]:outputText;
 let parsed;try{parsed=JSON.parse(jsonText);}catch(parseError){
  const position=Number(parseError.message.match(/position (\d+)/)?.[1]);
  const structuralContext=Number.isFinite(position)?outputText.slice(Math.max(0,position-35),position+35).replace(/[^{}\[\]:,"\\\s]/g,'x'):'';
  console.warn('AIDD模型格式检查未通过',{operation,phase,format:format.type,characters:outputText.length,blank:!outputText.trim(),fenced:/^\s*```/.test(outputText),outputTokens:payload.usage?.output_tokens,messageCount:messages.length,finalMessageCount:finalMessages.length,...(Number.isFinite(position)?{position,structuralContext}:{})});
  const error=new Error('本次 AI 结果未完整返回，原有内容已保留，请重试。');error.code='AIDD_MODEL_INVALID_JSON';throw error;
 }
 return {parsed,modelUsage};
}
