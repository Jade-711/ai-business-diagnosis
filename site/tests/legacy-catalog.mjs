// Fixed legacy behavior remains testable after the deployed catalog is replaced.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=name=>readFile(new URL('../web/'+name+'.js',import.meta.url),'utf8');
const app=await read('app');
const context=vm.createContext({localStorage:{getItem:()=>null,setItem(){}},document:{addEventListener(){}},window:{addEventListener(){}}});
vm.runInContext(app.slice(0,app.indexOf('const NODES =')),context);
for(const name of ['merchant-data','merchant-ui','demo-coverage','aidd-data','framework-ui','coze-client'])vm.runInContext(await read(name),context);
// Keep legacy response fixtures independent of later portfolio demo targets.
vm.runInContext(`Object.entries({overview:{week:143000,day:20000},live:{week:60000,day:8000},video:{week:28000,day:4000},shelf:{week:35000,day:5000},creator:{week:20000,day:3000}}).forEach(([field,goal])=>MERCHANT_FIELDS[field].goal=goal);`,context);
vm.runInContext('initAidd()',context);
export const legacyDemoCatalog=JSON.parse(vm.runInContext(`JSON.stringify(Object.fromEntries(Object.keys(MERCHANT_FIELDS).flatMap(fieldKey=>['week','day'].map(period=>{const p=merchantLocalSnapshot('',{fieldKey,period});return [fieldKey+':'+period,{config:p.config,data:p.data}];}))))`,context));
