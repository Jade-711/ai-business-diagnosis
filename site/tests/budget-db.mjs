import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function budgetDb(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(readFileSync(new URL('../drizzle/0000_aidd_ai_budget.sql',import.meta.url),'utf8'));
 return {sqlite,prepare(sql){return {bind(...args){return {async first(){return sqlite.prepare(sql).get(...args)??null;}};}};}};
}
