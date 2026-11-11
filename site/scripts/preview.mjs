import http from 'node:http';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../dist/server/index.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
http.createServer(async(req,res)=>{try{
 const chunks=[];for await(const c of req)chunks.push(c);
 const request=new Request('http://127.0.0.1:4173'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks),duplex:'half'}:{})});
 const response=await worker.fetch(request,{});res.writeHead(response.status,Object.fromEntries(response.headers));
 if(response.body)for await(const chunk of response.body)res.write(chunk);res.end();
}catch{res.writeHead(500);res.end('Preview error');}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
