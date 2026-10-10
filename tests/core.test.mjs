import test from 'node:test';import assert from 'node:assert/strict';
import {parseWeeks,weekAt,validateCourse,validateSettings,conflicts,toICS,validateEnvelope} from '../dist/core/model.js';import {importData} from '../dist/adapters/registry.js';import '../dist/adapters/zfsoft.js';
test('正方周次：区间、离散、单双周',()=>{assert.deepEqual(parseWeeks('1-8周(单),10,12-14(双)'),[1,3,5,7,10,12,14]);assert.deepEqual(parseWeeks('2-6周（双）'),[2,4,6]);assert.deepEqual(parseWeeks('1，3，5'),[1,3,5]);assert.throws(()=>parseWeeks('8-2'));assert.throws(()=>parseWeeks('1-100'));assert.throws(()=>parseWeeks('1-2abc'));assert.throws(()=>parseWeeks([]));});
test('学期周跨年与周一边界',()=>{assert.equal(weekAt('2026-12-28',new Date(2027,0,3,23)),1);assert.equal(weekAt('2026-12-28',new Date(2027,0,4)),2);assert.equal(weekAt('2026-09-07',new Date(2026,8,6)),0);assert.throws(()=>validateSettings({startDate:'2026-09-08'}));});
test('导入正方响应；失败时不静默丢课',()=>{const raw={kbList:[{kcmc:'高等数学',xqj:'2',jcs:'3-4',zcd:'1-16周(双)',cdmc:'A201',xm:'张老师'}]};const imported=importData(raw);assert.equal(imported.courses[0].start,3);assert.equal(imported.courses[0].weeks.length,8);assert.equal(importData({data:raw}).courses.length,1);assert.throws(()=>importData({kbList:[...raw.kbList,{kcmc:'坏数据',jcs:'??'}]}),/未导入任何数据/);assert.throws(()=>importData({kbList:[]}));});
test('课程校验及有交集的冲突',()=>{const a=validateCourse({name:'A',day:1,start:1,end:2,weeks:'1-4(单)'});const b=validateCourse({name:'B',day:1,start:2,end:3,weeks:'2-4(双)'});assert.equal(conflicts([a,b]).length,0);b.weeks=[3];assert.equal(conflicts([a,b]).length,1);assert.throws(()=>validateCourse({...a,end:13}));assert.throws(()=>validateCourse({...a,day:0}));});
test('时间设置禁止无效或重叠时间',()=>{const settings=validateSettings();settings.times[1]='08:30-09:15';assert.throws(()=>validateSettings(settings),/重叠/);});
test('备份迁移和日历按周展开',()=>{const c=validateCourse({name:'课程,一',day:1,start:1,end:2,weeks:'1-2',location:'A;201'});const settings=validateSettings({startDate:'2026-09-07'});const data=validateEnvelope(JSON.parse(JSON.stringify({version:1,courses:[c],settings})));assert.equal(data.courses.length,1);const ics=toICS(data.courses,settings);assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,2);assert.match(ics,/20260907T002000Z/);assert.match(ics,/SUMMARY:课程\\,一/);});


test('学校第N周格式、离散周和区间兼容，非法周次仍拒绝',()=>{
 assert.deepEqual(parseWeeks('第6周'),[6]);assert.deepEqual(parseWeeks('第1-第8周（单），第10周，第12-16周(双)'),[1,3,5,7,10,12,14,16]);
 assert.throws(()=>parseWeeks('第0周'));assert.throws(()=>parseWeeks('第61周'));assert.throws(()=>parseWeeks('第6周未知'));assert.throws(()=>parseWeeks('第8-第2周'));
});

test('捕获的混合周次记录整批解析，包含截图中的第6周记录',()=>{
 const raw={kbList:Array.from({length:12},(_,i)=>({kcmc:'解析测试'+i,xqj:i%7+1,jcs:'1-2',zcd:i<8?'1-16周':'第6周'}))};
 const value=importData(raw);assert.equal(value.courses.length,12);assert.deepEqual(value.courses[8].weeks,[6]);
});

test('周课表只更新查询周，保留其它周，并把同一课程周次重新合并',async()=>{
 const {prepareImport}=await import('../dist/core/import-plan.js');
 const old=[validateCourse({id:'old',name:'课程A',day:1,start:1,end:2,weeks:'1-16'}),validateCourse({name:'课程B',day:2,start:3,end:4,weeks:'1-16'})];
 const incoming=[validateCourse({name:'课程A',day:1,start:1,end:2,weeks:'1-16'}),validateCourse({name:'课程C',day:3,start:5,end:6,weeks:'第6周'})];
 const before=JSON.stringify(old),plan=prepareImport(old,{version:1,courses:incoming,sourceScope:{type:'week',weeks:[6]}});
 assert.equal(JSON.stringify(old),before);assert.match(plan.message,/只更新第 6 周/);
 assert.deepEqual(plan.value.courses.find(c=>c.name==='课程A').weeks,Array.from({length:16},(_,i)=>i+1));
 assert.deepEqual(plan.value.courses.find(c=>c.name==='课程B').weeks,[1,2,3,4,5,7,8,9,10,11,12,13,14,15,16]);
 assert.deepEqual(plan.value.courses.find(c=>c.name==='课程C').weeks,[6]);
 assert.equal(plan.records.length,2);
});

test('无法确认范围和周次不匹配的数据不允许覆盖；整学期仍整体预览',async()=>{
 const {prepareImport}=await import('../dist/core/import-plan.js');const c=validateCourse({name:'课程',day:1,start:1,end:2,weeks:'第6周'});
 assert.throws(()=>prepareImport([c],{courses:[c],sourceScope:{type:'unknown'}}),/尚未确认/);
 assert.throws(()=>prepareImport([c],{courses:[c],sourceScope:{type:'week',weeks:[7]}}),/不匹配/);
 assert.equal(prepareImport([c],{courses:[c],sourceScope:{type:'term'}}).value.courses.length,1);
});
