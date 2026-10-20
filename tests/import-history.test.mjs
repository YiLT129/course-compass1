import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCourse,validateSettings} from '../dist/core/model.js';
import {compareImports,validateImportHistory,createImportHistory,prepareUndo,commitTimetableImport,undoTimetableImport,recoverImport,IMPORT_JOURNAL,TIMETABLE_KEY,IMPORTED_AT_KEY} from '../dist/core/import-history.js';
const A=validateCourse({id:'a',name:'课程A',day:1,start:1,end:2,weeks:'1-16',teacher:'老师',location:'101'}),B=validateCourse({...A,id:'b',name:'课程B',day:3,start:3,end:4});
const schedule=courses=>({version:1,settings:validateSettings({startDate:'2026-08-31'}),courses,demo:false});
const at='2026-10-20T04:00:00.000Z';
function memory(initial={}){const values=new Map(Object.entries(initial));return {values,getItem:k=>values.get(k)??null,setItem(k,v){values.set(k,String(v));},removeItem:k=>values.delete(k)};}
function persistence(initial=null){let history=initial,pending=null;return {history:async()=>history,pending:async()=>pending,putPending:async v=>{pending=structuredClone(v);},clearPending:async()=>{pending=null;},finish:async v=>{history=structuredClone(v);pending=null;}};}
const current=value=>({schedule:JSON.stringify(value),lastImport:at});
test('导入变化按实际排课统计，不受新 ID 与重复记录影响',()=>{
 assert.deepEqual(compareImports([A,A],[{...A,id:'new'},B]),{same:1,added:1,removed:1});
 assert.deepEqual(compareImports([A],[{...A,location:'202'}]),{same:0,added:1,removed:1});
});
test('只保留五次概要和最后一次完整撤回记录，清理未知字段',()=>{
 let history=null;for(let i=0;i<8;i++)history=createImportHistory(history,current(schedule([A])),current(schedule([B])),{id:'i'+i,at,school:null,label:'导入'+i});
 assert.equal(history.entries.length,5);assert.equal(history.undo.id,'i7');assert.equal(history.entries[0].label,'导入7');
 history.entries[0].password='secret';history.undo.cookie='secret';assert.ok(!JSON.stringify(validateImportHistory(history)).includes('secret'));
 assert.throws(()=>validateImportHistory({...history,entries:[...history.entries,history.entries[0]]}),/格式/);
});
test('撤回保留导入后手动修改的作息，不接受课程被编辑或换学校',()=>{
 const before=current(schedule([A])),after=current(schedule([B])),history=createImportHistory(null,before,after,{at,school:'school-a'}),edited=schedule([B]);edited.settings.term='自己改的学期';
 const result=prepareUndo(history,current(edited),'school-a',at),restored=JSON.parse(result.next.schedule);
 assert.equal(restored.courses[0].name,'课程A');assert.equal(restored.settings.term,'自己改的学期');assert.equal(result.history.undo,null);
 assert.throws(()=>prepareUndo(history,current(schedule([{...B,location:'303'}])),'school-a'),/其他修改/);
 assert.throws(()=>prepareUndo(history,after,'school-b'),/切换学校/);
});
test('确认导入和撤回仅写课表与同步时间，私人笔记与单次修改保持原值',async()=>{
 const storage=memory({[TIMETABLE_KEY]:JSON.stringify(schedule([A])),[IMPORTED_AT_KEY]:'2026-10-19T04:00:00.000Z','course-compass.demo.prefs':'{"weekend":true}','course-compass.personalization.v1':'private-note','course-compass.overrides.v1':'private-override'}),driver=persistence();let applied=0;
 await commitTimetableImport({storage,persistence:driver,value:schedule([B]),apply:()=>{applied++;return true;},at});
 assert.equal(JSON.parse(storage.getItem(TIMETABLE_KEY)).courses[0].name,'课程B');assert.equal((await driver.history()).entries[0].summary.added,1);
 await undoTimetableImport({storage,persistence:driver,apply:()=>{applied++;return true;}});
 assert.equal(JSON.parse(storage.getItem(TIMETABLE_KEY)).courses[0].name,'课程A');assert.equal(storage.getItem(IMPORTED_AT_KEY),'2026-10-19T04:00:00.000Z');
 assert.equal(storage.getItem('course-compass.demo.prefs'),'{"weekend":true}');assert.equal(storage.getItem('course-compass.personalization.v1'),'private-note');assert.equal(storage.getItem('course-compass.overrides.v1'),'private-override');assert.equal(applied,2);
});
test('配额预检与写入失败均不覆盖旧撤回记录，回滚已写的学校课程',async()=>{
 const oldHistory=createImportHistory(null,current(schedule([A])),current(schedule([B])),{at}),raw=JSON.stringify(schedule([A])),storage=memory({[TIMETABLE_KEY]:raw}),driver=persistence(oldHistory),set=storage.setItem;
 storage.setItem=(k,v)=>{if(k.endsWith('.probe'))throw Error('QuotaExceeded');set(k,v);};
 await assert.rejects(commitTimetableImport({storage,persistence:driver,value:schedule([B]),apply:()=>true,at}),/空间不足/);assert.deepEqual(await driver.history(),oldHistory);assert.equal(storage.getItem(TIMETABLE_KEY),raw);
 let fail=true;storage.setItem=(k,v)=>{if(k===TIMETABLE_KEY&&fail){fail=false;throw Error('QuotaExceeded');}set(k,v);};
 await assert.rejects(commitTimetableImport({storage,persistence:driver,value:schedule([B]),apply:()=>true,at}),/QuotaExceeded/);assert.equal(storage.getItem(TIMETABLE_KEY),raw);assert.deepEqual(await driver.history(),oldHistory);assert.equal(storage.getItem(IMPORT_JOURNAL),null);
});
test('界面应用失败或 IDB 提交失败都恢复旧课表；重启恢复未完成事务',async()=>{
 const raw=JSON.stringify(schedule([A])),storage=memory({[TIMETABLE_KEY]:raw}),driver=persistence();
 await assert.rejects(commitTimetableImport({storage,persistence:driver,value:schedule([B]),apply:()=>false,at}),/重新读取/);assert.equal(storage.getItem(TIMETABLE_KEY),raw);assert.equal(await driver.history(),null);
 driver.finish=async()=>{throw Error('IDB quota');};await assert.rejects(commitTimetableImport({storage,persistence:driver,value:schedule([B]),apply:()=>true,at}),/IDB quota/);assert.equal(storage.getItem(TIMETABLE_KEY),raw);
 await driver.putPending({id:'interrupted',before:{schedule:raw,lastImport:null}});storage.setItem(IMPORT_JOURNAL,'interrupted');storage.setItem(TIMETABLE_KEY,JSON.stringify(schedule([B])));
 assert.equal(await recoverImport(storage,driver),true);assert.equal(storage.getItem(TIMETABLE_KEY),raw);assert.equal(storage.getItem(IMPORT_JOURNAL),null);
});
test('首次导入也可撤回；完整恢复进行中不开始新导入',async()=>{
 const storage=memory(),driver=persistence();await commitTimetableImport({storage,persistence:driver,value:schedule([A]),apply:()=>true,at});
 const restored=await undoTimetableImport({storage,persistence:driver,apply:()=>true});assert.equal(restored.schedule,null);assert.equal(storage.getItem(TIMETABLE_KEY),null);
 storage.setItem('course-compass.restore-journal.v1','pending');await assert.rejects(commitTimetableImport({storage,persistence:driver,value:schedule([A]),at}),/恢复/);
});
