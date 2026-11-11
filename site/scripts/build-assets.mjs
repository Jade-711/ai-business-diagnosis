import {readFile,writeFile,mkdir,readdir,rm,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
const assets={};
const sharedFrameworkPrompt=await readFile(path.join(root,'shared/framework-prompt.js'),'utf8');
await writeFile(path.join(root,'web/framework-prompt.js'),sharedFrameworkPrompt.replace(/^export /gm,''));
const merchantEvidence=await readFile(path.join(root,'shared/merchant-evidence.js'),'utf8');
await writeFile(path.join(root,'web/merchant-evidence.js'),merchantEvidence.replace(/^export /gm,''));
const merchantPriority=await readFile(path.join(root,'shared/merchant-priority.js'),'utf8');
await writeFile(path.join(root,'web/merchant-priority.js'),merchantPriority.replace(/^export /gm,''));
for(const name of ['scene-routing','scene-business-specs','scene-deployment','live-revenue-config','business-summary','published-actions','production-rules'])await writeFile(path.join(root,'web/'+name+'.js'),(await readFile(path.join(root,'shared/'+name+'.js'),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,''));
async function add(dir,relative=''){
 for(const item of await readdir(dir,{withFileTypes:true})){
  if(item.name.startsWith('.'))continue;
  const name=path.posix.join(relative,item.name),full=path.join(dir,item.name);
  if(item.isDirectory())await add(full,name);
  else{const ext=path.extname(name),bytes=await readFile(full),binary=!['.html','.js','.css','.svg','.json'].includes(ext);assets['/'+name]={body:bytes.toString(binary?'base64':'utf8'),binary,type:mime[ext]||'application/octet-stream'};}
 }
}
await add(path.join(root,'web'));
await rm(path.join(root,'dist'),{recursive:true,force:true});
await mkdir(path.join(root,'dist/server'),{recursive:true});await mkdir(path.join(root,'dist/.openai'),{recursive:true});
const contract=await readFile(path.join(root,'worker/resource-contract.js'),'utf8');
const strategyScope=(await readFile(path.join(root,'shared/strategy-scope.js'),'utf8')).replace(/^export /gm,'');
const sceneRouting=(await readFile(path.join(root,'shared/scene-routing.js'),'utf8')).replace(/^export /gm,'');
const productionContract=await readFile(path.join(root,'worker/production-contract.js'),'utf8');
const productionRuntime=await readFile(path.join(root,'worker/aidd-production-runtime.js'),'utf8');
const productionModels=await readFile(path.join(root,'worker/aidd-production-models.js'),'utf8');
const productionBudget=await readFile(path.join(root,'worker/aidd-budget.js'),'utf8');
const productionRequest=await readFile(path.join(root,'worker/aidd-model.js'),'utf8');
const frameworkTrial=await readFile(path.join(root,'worker/framework-trial.js'),'utf8');
const productionGenerationContract=await readFile(path.join(root,'worker/aidd-generation-contract.js'),'utf8');
const productionService=await readFile(path.join(root,'worker/aidd-production.js'),'utf8');
const snapshotService=(await readFile(path.join(root,'worker/dashboard-snapshots.js'),'utf8')).replace(/^export /gm,'');
const productionRules=await readFile(path.join(root,'shared/production-rules.js'),'utf8');
const productionBundle=[productionRules,sharedFrameworkPrompt,productionContract,productionRuntime,productionModels,productionGenerationContract,productionBudget,productionRequest,frameworkTrial,productionService].map(s=>s.replace(/^import .*;\r?\n/gm,'').replace(/export (async )?function /g,(_,asyncPart)=>`${asyncPart||''}function `).replace(/export const /g,'const ')).join('\n');
const publishedActionHelpers=(await readFile(path.join(root,'shared/published-actions.js'),'utf8')).replace(/^export /gm,'');
const actionPublicationService=(await readFile(path.join(root,'worker/action-publications.js'),'utf8')).replace(/^export /gm,'');
const publicDemoService=(await readFile(path.join(root,'worker/public-demo.js'),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const workflowProgressService=(await readFile(path.join(root,'shared/workflow-progress.js'),'utf8')).replace(/^export /gm,'');
const modelUsageService=(await readFile(path.join(root,'shared/model-usage.js'),'utf8')).replace(/^export /gm,'');
const source=(await readFile(path.join(root,'worker/index.js'),'utf8')).replace("import {summarizeModelUsage} from '../shared/model-usage.js';",()=>modelUsageService).replace("import {workflowProgressStages} from '../shared/workflow-progress.js';",()=>workflowProgressService).replace("import {configurationPayload,metricsPayload} from './resource-contract.js';",()=>sceneRouting+'\n'+strategyScope+'\n'+contract.replace(/^import .*;\r?\n/gm,'').replace(/export function /g,'function ')).replace("import {runAiddProduction,aiddModelConfigured} from './aidd-production.js';",()=>productionBundle).replace("import {readDashboardSnapshots,saveDashboardSnapshot,dashboardSnapshotQuestion,dashboardSnapshotSignature} from './dashboard-snapshots.js';",()=>snapshotService).replace("import {sanitizePublicDemoRequest,reservePublicDemoBudget} from './public-demo.js';",()=>publicDemoService).replace("import {readActionPublications,saveActionPublication} from './action-publications.js';",()=>actionPublicationService).replace("import {applyActionMappingPublications,applyActionMappingCatalog} from '../shared/published-actions.js';",()=>publishedActionHelpers);
const catalog=await readFile(path.join(root,'worker/demo-catalog.json'),'utf8');
await writeFile(path.join(root,'dist/server/index.js'),source.replace('const STATIC_ASSETS = {};',()=>`const STATIC_ASSETS = ${JSON.stringify(assets)};`).replace('const DEMO_CATALOG = {};',()=>`const DEMO_CATALOG = ${catalog};`));
await copyFile(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
console.log(`Built Worker with ${Object.keys(assets).length} embedded frontend assets`);
