// Transport metadata belongs to the workflow. Keep the model's actual answer;
// accept either documented business-object shape without generating a fallback.
export function normalizeKnowledgeOutput(stage,answer){
 if(stage!=='knowledge')return answer;
 if(!answer||typeof answer!=='object'||Array.isArray(answer))throw new Error('模型未返回经营知识对象');
 const valid=x=>x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.answer==='string'&&x.answer.trim();
 const boxed=valid(answer.result)?answer.result:null,flat=valid(answer)?answer:null;
 if(boxed&&flat&&boxed.answer.trim()!==flat.answer.trim())throw new Error('知识回答的内外层内容冲突');
 const body=boxed||flat;if(!body)throw new Error('模型未返回完整经营知识回答');
 return {...answer,result:{schemaVersion:1,status:'success',branch:'knowledge',answer:body.answer.trim(),dataMode:'demo',missing:Array.isArray(body.missing)?body.missing.filter(v=>typeof v==='string'):[]}};
}
