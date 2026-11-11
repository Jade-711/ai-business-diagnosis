import {readFileSync,writeFileSync} from 'node:fs';
import {normalizeKnowledgeOutput} from '../shared/knowledge-output.js';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url));
const base=JSON.parse(readFileSync(root+'v13-baseline.workflow.json'));
const clip=JSON.parse(readFileSync(root+'adapter-native-template.clipboard.json'));
const clone=structuredClone;
const get=id=>base.nodes.find(n=>n.id===id);
const stages={'110004':'understanding','310002':'explanation','410021':'repair','110009':'knowledge'};
const specs={};
for(const [id,stage] of Object.entries(stages)){
 const n=get(id),p=Object.fromEntries(n.data.inputs.llmParam.map(p=>[p.name,p.input?.value?.content]));
 specs[stage]={systemPrompt:p.systemPrompt,prompt:p.prompt,maxTokens:Number(p.maxTokens),outputs:clone(id==='310002'?n.data.outputs[0].schema.schema:n.data.outputs.filter(o=>o.name!=='reasoning_content'))};
}
const field=(name,type='string')=>({name,type,required:false});
const inputs=[{...field('stage'),required:true},...clone(get('100001').data.outputs.filter(o=>['question','pageContext','history'].includes(o.name))).map(o=>({...o,required:false})),field('materials'),field('validationErrors')];
const outputs=[...clone(get('110004').data.outputs),...clone(get('410021').data.outputs),...clone(get('110009').data.outputs),field('usageJson')];
const raw={string:1,integer:2,boolean:3,float:4,object:6,list:103};
function ref(o,id,name=o.name){const {name:unused,required,...schema}=clone(o);return {name:o.name,input:{...schema,value:{type:'ref',content:{source:'block-output',blockID:id,name},rawMeta:{type:o.type==='list'?(o.schema?.type==='object'?103:99):raw[o.type]}}}};}
const start=clone(clip.json.nodes.find(n=>n.type==='1'));
start.data.outputs=inputs;start.data.trigger_parameters=clone(inputs);
const prepare=clone(clip.json.nodes.find(n=>n.type==='5'));
prepare.id='120001';prepare.data.nodeMeta.title='准备原有提示词与 DeepSeek 请求';
prepare.data.nodeMeta.description='仅选择 v13 原有提示词并转换 API 请求；复杂问法识别 low；解释、补全和知识问答 none。';
prepare.data.inputs.inputParameters=inputs.map(o=>ref(o,'100001'));
prepare.data.outputs=[field('body')];
prepare.data.inputs.code=`const specs=${JSON.stringify(specs)};\nasync function main({params}: Args): Promise<Output> {\n const spec=specs[params.stage];\n if(!spec) throw new Error('未知的模型调用类型');\n const render=(text)=>text.replace(/{{(\\w+)}}/g,(_,key)=>typeof params[key]==='string'?params[key]:JSON.stringify(params[key]??''));\n const effort=params.stage==='understanding'?'low':'none';\n const request={model:'deepseek-flash',instructions:spec.systemPrompt+'\\n请仅输出有效 JSON 对象，按以下字段及类型返回，不输出内部思考草稿：'+JSON.stringify(spec.outputs),input:render(spec.prompt),text:{format:{type:'json_object'}},reasoning:{effort},max_output_tokens:spec.maxTokens+(effort==='low'?8192:0),store:false,...(effort==='none'?{temperature:0}:{})};\n return {body:JSON.stringify(request)};\n}`;
const http=clone(clip.json.nodes.find(n=>n.type==='45'));
const authTemplate=JSON.parse(readFileSync(root+'http-node-template.json')).data.inputs.auth;
http.id='120002';http.data.nodeMeta.title='调用自有 DeepSeek API';http.data.nodeMeta.description='原生 HTTP 直连 DeepSeek；在线填写 Bearer 鉴权，导入源不含密钥；自动重试为零。';
http.data.inputs={apiInfo:{method:'POST',url:'https://api.deepseek.com/responses'},body:{bodyType:'RAW_TEXT',bodyData:{rawText:'{{block_output_120001.body}}'}},headers:[{name:'Content-Type',input:{type:'string',value:{type:'literal',content:'application/json',rawMeta:{type:1}}}}],params:[],auth:clone(authTemplate),setting:{timeout:60,retryTimes:0},settingOnError:{}};
http.data.inputs.auth.authData.bearerTokenData[0].input.value.content='';
const parse=clone(prepare);parse.id='120003';parse.data.nodeMeta.title='解析原有输出与实际 token 用量';parse.data.nodeMeta.description='还原 v13 的命名输出；保留业务核查在主流程原有节点，实际用量供扣子 Trace 核对。';
parse.data.inputs.inputParameters=[ref(field('body'),'120002'),ref(field('statusCode','integer'),'120002'),ref(field('stage'),'100001')];parse.data.outputs=outputs;
parse.data.inputs.code=`const outputSchema=${JSON.stringify(outputs)};\n${normalizeKnowledgeOutput.toString()}\nasync function main({params}: Args): Promise<Output> {\n if(Number(params.statusCode)!==200) throw new Error('DeepSeek HTTP '+params.statusCode+'，模型调用未完成');\n const response=JSON.parse(params.body);\n if(response.status!=='completed') throw new Error(response.incomplete_details?.reason==='max_output_tokens'?'DeepSeek 输出达到 token 上限，回答被截断':'DeepSeek 未完整返回回答');\n const messages=(response.output||[]).filter(x=>x.type==='message'&&x.role==='assistant');\n const final=messages.filter(x=>x.phase==='final_answer');\n const content=(final.length?final:messages).flatMap(x=>x.content||[]);\n const text=content.filter(x=>x.type==='output_text').map(x=>x.text||'').join('');\n const answer=normalizeKnowledgeOutput(params.stage,JSON.parse(text));\n if(!answer||typeof answer!=='object'||Array.isArray(answer)) throw new Error('DeepSeek 输出不是 JSON 对象');\n const u=response.usage;\n if(!u||!Number.isFinite(u.total_tokens)||!Number.isFinite(u.input_tokens)||!Number.isFinite(u.output_tokens)) throw new Error('DeepSeek 未提供实际 token 用量');\n const empty=s=>s.type==='list'?[]:s.type==='object'?Object.fromEntries((s.schema||[]).map(f=>[f.name,empty(f)])):s.type==='boolean'?false:['integer','float'].includes(s.type)?0:'';\n const result=Object.fromEntries(outputSchema.map(s=>[s.name,empty(s)]));\n for(const s of outputSchema) if(s.name!=='usageJson'&&s.name!=='reasoning_content'&&Object.prototype.hasOwnProperty.call(answer,s.name)) result[s.name]=answer[s.name];\n result.usageJson=JSON.stringify({stage:params.stage,provider:'DeepSeek',model:response.model||'deepseek-flash',responseId:response.id,reasoningEffort:response.reasoning?.effort,inputTokens:u.input_tokens,outputTokens:u.output_tokens,totalTokens:u.total_tokens,cachedInputTokens:u.input_tokens_details?.cached_tokens||0,reasoningTokens:u.output_tokens_details?.reasoning_tokens||0});\n return result;\n}`;
const end=clone(clip.json.nodes.find(n=>n.type==='2'));
end.data.inputs={terminatePlan:'returnVariables',inputParameters:outputs.map(o=>ref(o,'120003'))};
const nodes=[start,prepare,http,parse,end];
for(let i=0;i<nodes.length;i++) {const n=nodes[i];n.meta.position={x:i*520,y:0};n._temp.bounds={x:i*520-180,y:0,width:360,height:i===3?400:180};n._temp.externalData={...n._temp.externalData,title:n.data.nodeMeta.title,description:n.data.nodeMeta.description};}
const graph={nodes,edges:nodes.slice(1).map((n,i)=>({sourceNodeID:nodes[i].id,targetNodeID:n.id}))};
const generated={...clip,json:graph,bounds:{x:-180,y:0,width:2440,height:600}};
writeFileSync(root+'adapter.workflow.json',JSON.stringify(graph,null,2)+'\n');
writeFileSync(root+'adapter.clipboard.json',JSON.stringify(generated));
writeFileSync(root+'deepseek-prompts.json',JSON.stringify(specs,null,2)+'\n');
const audit={baseline:'Coze v0.0.13 / git 7ee2294',adapterWorkflowId:clip.source.workflowId,nodes:nodes.map(n=>({id:n.id,type:n.type,title:n.data.nodeMeta.title})),edges:graph.edges,prompts:Object.fromEntries(Object.entries(specs).map(([stage,s])=>[stage,{sha256:createHash('sha256').update(s.systemPrompt+'\0'+s.prompt).digest('hex'),originalMaxTokens:s.maxTokens}])),credentialInSource:false};
writeFileSync(root+'adapter-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({nodes:nodes.length,edges:graph.edges.length,inputFields:inputs.map(o=>o.name),outputFields:outputs.map(o=>o.name),bytes:JSON.stringify(generated).length}));
