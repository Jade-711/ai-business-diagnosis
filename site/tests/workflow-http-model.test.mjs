import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(new URL('../workflow/'+name,import.meta.url),'utf8'));
const adapter=read('adapter.workflow.json'),base=read('v13-baseline.workflow.json'),prompts=read('deepseek-prompts.json');
async function execute(id,params){const code=adapter.nodes.find(n=>n.id===id).data.inputs.code.replace(/: Args/g,'').replace(/: Promise<Output>/g,'');const c=vm.createContext({});vm.runInContext(code,c);return JSON.parse(JSON.stringify(await c.main({params})));}
const provider=(output,changes={})=>JSON.stringify({id:'response-1',status:'completed',model:'deepseek-flash',usage:{input_tokens:100,output_tokens:20,total_tokens:120,input_tokens_details:{cached_tokens:10},output_tokens_details:{reasoning_tokens:12}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(output)}]}],...changes});
test('四处请求使用v13原提示词，解释补全知识none、复杂识别low，含推理预算且无自动high',async()=>{
 for(const [id,stage,effort] of [['110004','understanding','low'],['310002','explanation','none'],['410021','repair','none'],['110009','knowledge','none']]){
  const old=Object.fromEntries(base.nodes.find(n=>n.id===id).data.inputs.llmParam.map(p=>[p.name,p.input?.value?.content]));
  assert.equal(prompts[stage].systemPrompt,old.systemPrompt);assert.equal(prompts[stage].prompt,old.prompt);
  const b=JSON.parse((await execute('120001',{stage,question:'诊断短视频',materials:'{"issues":[]}',history:[],validationErrors:'补充依据'})).body);
  assert.equal(b.model,'deepseek-flash');assert.equal(b.reasoning.effort,effort);assert.equal(b.store,false);assert.equal(b.text.format.type,'json_object');assert.ok(b.instructions.startsWith(old.systemPrompt));assert.equal(b.max_output_tokens,Number(old.maxTokens)+(effort==='low'?8192:0));assert.equal(Object.hasOwn(b,'temperature'),effort==='none');assert.ok(!JSON.stringify(b).includes('sk-'));
 }
 await assert.rejects(execute('120001',{stage:'invented'}),/未知/);
});
test('解析保留原业务输出、仅返回实际token统计，不返回思考草稿或额外范围字段',async()=>{
 const raw={summary:'本轮判断',explanations:[],sellerId:'invented',question:'invented',history:['invented']};
 const body=JSON.parse(provider(raw));body.output.unshift({type:'reasoning',content:[{type:'output_text',text:'PRIVATE'}]});
 const r=await execute('120003',{body:JSON.stringify(body),statusCode:200,stage:'explanation'});
 assert.equal(r.summary,raw.summary);assert.deepEqual(r.explanations,raw.explanations);assert.equal(r.reasoning_content,'');assert.ok(!Object.hasOwn(r,'sellerId'));assert.ok(!Object.hasOwn(r,'history'));assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
 const usage=JSON.parse(r.usageJson);assert.equal(usage.totalTokens,120);assert.equal(usage.cachedInputTokens,10);assert.equal(usage.reasoningTokens,12);assert.equal(usage.responseId,'response-1');
 const knowledge={answer:'原v13知识说明',diagnosis:[]};const k=await execute('120003',{body:provider({result:knowledge}),statusCode:200,stage:'knowledge'});assert.equal(k.result.answer,knowledge.answer);assert.deepEqual(k.result,{schemaVersion:1,status:'success',branch:'knowledge',answer:knowledge.answer,dataMode:'demo',missing:[]});
});
test('HTTP解析拒绝失败、截断、无实际用量、非法JSON和非对象回答',async()=>{
 for(const [body,status,pattern] of [['{}',403,/HTTP 403/],[provider({},{status:'incomplete'}),200,/未完整/],[provider({},{status:'incomplete',incomplete_details:{reason:'max_output_tokens'}}),200,/token 上限/],[provider({},{usage:null}),200,/实际 token/],[provider({},{output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'bad json'}]}]}),200,/JSON/],[provider([]),200,/JSON 对象/]]) await assert.rejects(execute('120003',{body,statusCode:status,stage:'explanation'}),pattern);
});
test('有final_answer时只解析最终回答，避免中间文本污染JSON',async()=>{
 const p=JSON.parse(provider({summary:'最终判断'}));p.output[0].phase='final_answer';p.output.unshift({type:'message',role:'assistant',phase:'commentary',content:[{type:'output_text',text:'中间内容'}]});
 assert.equal((await execute('120003',{body:JSON.stringify(p),statusCode:200,stage:'explanation'})).summary,'最终判断');
});

test('复杂识别保留推理额度，诊断解释禁用思考并保留原回答额度',async()=>{const body=JSON.parse((await execute('120001',{stage:'explanation',materials:'{}'})).body);assert.equal(body.reasoning.effort,'none');assert.equal(body.max_output_tokens,3072);const scope=JSON.parse((await execute('120001',{stage:'understanding',question:'复盘刚才的经营表现'})).body);assert.equal(scope.reasoning.effort,'low');assert.equal(scope.max_output_tokens,8704);});
