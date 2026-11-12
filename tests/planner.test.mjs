import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedKey,validatePackage,themeFromBackup} from '../dist/core/packages.js';

const key='course-compass.planner.v1', future=Date.UTC(2030,3,1,13), note='<b>带水杯</b>';
const plan={version:1,entries:[{id:'after',at:future+60000,title:' 慢跑 ',note},{id:'before',at:future,title:'领取快递',note:''}]};
const module=()=>import('../dist/core/planner.js');

test('完整备份保留个人规划，主题分享不包含标题或备注',()=>{
 assert.equal(allowedKey(key),true);
 const backup=validatePackage({format:'course-compass.backup',version:1,state:{[key]:JSON.stringify(plan)}});
 assert.deepEqual(JSON.parse(backup.state[key]).entries.map(x=>x.id),['before','after']);
 const theme=JSON.stringify(themeFromBackup(backup,'清爽'));
 assert.doesNotMatch(theme,/慢跑|领取快递|带水杯|planner/);
});
test('日期和钟点按设备本地时间解析，拒绝不存在的日期',async()=>{
 const {parsePlannerTime}=await module();
 const date=new Date(parsePlannerTime('2030-04-01','21:06'));
 assert.deepEqual([date.getFullYear(),date.getMonth(),date.getDate(),date.getHours(),date.getMinutes()],[2030,3,1,21,6]);
 assert.throws(()=>parsePlannerTime('2030-02-29','21:06'),/日期/);
 assert.throws(()=>parsePlannerTime('2030-04-01','24:00'),/时间/);
});
test('只改标题时保留导入日程的原始时间点',async()=>{
 const {parsePlannerTime}=await module();
 const original=new Date(2030,3,1,21,6,37,245).getTime();
 assert.equal(parsePlannerTime('2030-04-01','21:06',original),original);
 assert.equal(parsePlannerTime('2030-04-01','21:07',original),new Date(2030,3,1,21,7).getTime());
});
test('编辑为新的未来时间只替换对应条目，拒绝已经到期的保存',async()=>{
 const {upsertPlannerEntry}=await module();
 const edited=upsertPlannerEntry(plan,{id:'after',at:future+180000,title:' 校园慢跑 ',note},future);
 assert.deepEqual(edited.entries,[plan.entries[1],{id:'after',at:future+180000,title:'校园慢跑',note}]);
 assert.throws(()=>upsertPlannerEntry(plan,{id:'after',at:future,title:'旧日程',note},future),/之后/);
});
test('同一分钟内多条安排可一起提醒，已领取、开页前或太久前的不会弹出',async()=>{
 const {duePlannerEntries}=await module();
 const rows=[plan.entries[0],plan.entries[1],{id:'same',at:future,title:'买水果',note:''},{id:'old',at:future-7200000,title:'旧计划',note:''}];
 assert.deepEqual(duePlannerEntries(rows,future-86400000,future,new Set()).map(x=>x.id),['before','same']);
 assert.deepEqual(duePlannerEntries(rows,future-1,future,new Set(['before:'+future])).map(x=>x.id),['same']);
 assert.deepEqual(duePlannerEntries(rows,future,future+500,new Set()),[]);
});
test('损坏的规划或重复 ID 不会被当作可恢复的备份',async()=>{
 const {validatePlanner}=await module();
 assert.throws(()=>validatePlanner({version:1,entries:[plan.entries[0],plan.entries[0]]}),/重复/);
 assert.throws(()=>validatePlanner({version:1,entries:[{...plan.entries[0],at:String(future)}]}),/时间/);
 assert.throws(()=>validatePlanner({version:1,entries:[{...plan.entries[0],title:String.fromCharCode(1)}]}),/标题/);
 assert.throws(()=>validatePackage({format:'course-compass.backup',version:1,state:{[key]:JSON.stringify({version:1,entries:[{...plan.entries[0],title:'  '}]})}}),/标题/);
});
test('完整恢复会把已到期项标为历史，已打开的其他页面也不会补弹',async()=>{
 const {archiveRestoredPlans,duePlannerEntries,validatePlanner,upsertPlannerEntry}=await module();
 const imported=archiveRestoredPlans(plan,future);
 const rows=validatePlanner(JSON.parse(JSON.stringify(imported))).entries;
 assert.equal(rows[0].historical,true);
 assert.equal(rows[1].historical,undefined);
 assert.deepEqual(duePlannerEntries(rows,future-1,future,new Set()),[]);
 assert.deepEqual(duePlannerEntries(rows,future-1,future+60000,new Set()).map(x=>x.id),['after']);
 const edited=upsertPlannerEntry(imported,{...rows[0],at:future+120000},future);
 assert.equal(edited.entries.find(x=>x.id==='before').historical,undefined);
});
