import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const code=await readFile(new URL('../dist/server/index.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
test('Worker打包后每个前端脚本与源文件逐字一致，保留美元符号和转义',async()=>{
 for(const name of await readdir(new URL('../web/',import.meta.url))){
  if(!/\.(js|css|html)$/.test(name))continue;
  const response=await worker.fetch(new Request('https://example.chatgpt.site/'+name));
  assert.equal(response.status,200);assert.equal(await response.text(),await readFile(new URL('../web/'+name,import.meta.url),'utf8'),name);
 }
});
