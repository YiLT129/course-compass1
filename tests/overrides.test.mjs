import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCourse,validateSettings} from '../dist/core/model.js';
import {sessionsFor,scheduleClock} from '../dist/core/sessions.js';
import {OVERRIDES_KEY,courseFingerprint,effectiveCourses,occurrenceKey,overrideFor,readOverrides,resetOverride,saveOverrides,upsertOverride,validateOverrides} from '../dist/core/overrides.js';
const settings=validateSettings({startDate:'2026-08-31',totalWeeks:16});
const course=(fields={})=>({...validateCourse({id:'school-random-id',name:'电力系统分析',teacher:'舒老师',day:1,start:1,end:4,location:'A101',weeks:[1,2,3],...fields}),source:'school'});
const context={schoolId:'gzist-zfsoft',week:2,period:2};
function record(c=course(),extra={}){return {...occurrenceKey(c,settings,context),cancelled:false,location:'B205',updatedAt:1,...extra};}
test('单次教室修改只影响对应周的一节，原始课表与来源信息保持不变',()=>{
 const raw=[course()],before=JSON.stringify(raw),effective=effectiveCourses(raw,settings,[record()],'gzist-zfsoft');
 assert.equal(JSON.stringify(raw),before);assert.equal(sessionsFor(effective,1)[1].location,'A101');assert.equal(sessionsFor(effective,3)[1].location,'A101');
 const current=sessionsFor(effective,2);assert.deepEqual(current.map(c=>c.location),['A101','B205','A101','A101']);
 assert.equal(current[1].id,raw[0].id);assert.equal(current[1].source,'school');assert.equal(current[1].sourceStart,1);assert.equal(current[1].sourceEnd,4);assert.equal(current[1].occurrenceDate,'2026-09-07');
 assert.ok(effective.length<8,'only the affected week is split');
});
test('教务重导入产生新 ID、教室或周次范围变化，单次修改仍可匹配',()=>{
 const changed=course({id:'refreshed-id',location:'New school room',weeks:[2,3]});const list=sessionsFor(effectiveCourses([changed],settings,[record()],'gzist-zfsoft'),2);
 assert.equal(list[1].id,'refreshed-id');assert.equal(list[1].location,'B205');assert.equal(list[0].location,'New school room');
 assert.equal(list[1].localOverride.date,'2026-09-07');assert.equal(courseFingerprint(course({name:' 电力系统 分析 '})),courseFingerprint(course()));
});
test('停课仅取消一节，今日列表保留标记，当前与下一节跳过取消项',()=>{
 const effective=effectiveCourses([course()],settings,[record(course(),{cancelled:true,location:null})],'gzist-zfsoft');
 const during=scheduleClock(effective,settings,new Date('2026-09-07T09:20:00'));
 assert.equal(during.current.length,0);assert.equal(during.next[0].period,3);assert.equal(during.today.length,4);assert.equal(during.today[1].cancelled,true);
 const before=scheduleClock(effective,settings,new Date('2026-09-07T09:05:00'));assert.equal(before.next[0].period,3);
 assert.equal(scheduleClock(effective,settings,new Date('2026-09-07T10:20:00')).current[0].period,3);
 assert.equal(scheduleClock(effective,settings,new Date('2026-08-31T09:20:00')).current[0].period,2);
});
test('单次改动按学校、学期起点、日期和老师隔离，未匹配记录不被删除',()=>{
 const original=[course()],entries=[record()];
 assert.strictEqual(effectiveCourses(original,settings,entries,'manual'),original);
 const otherTerm={...settings,startDate:'2027-08-30'};assert.strictEqual(effectiveCourses(original,otherTerm,entries,'gzist-zfsoft'),original);
 const other=course({teacher:'另一位老师'});assert.strictEqual(effectiveCourses([other],settings,entries,'gzist-zfsoft')[0],other);
 assert.equal(entries.length,1);assert.equal(entries[0].location,'B205');
 const personal={...course(),personal:true};assert.strictEqual(effectiveCourses([personal],settings,entries,'gzist-zfsoft')[0],personal);
});
test('重置仅删除所选一次调整，再次显示最新教务教室',()=>{
 let state=upsertOverride([],record());const another=record(course(),{period:3,location:'C306'});state=upsertOverride(state,another);
 state=resetOverride(state,record());assert.equal(state.entries.length,1);assert.equal(state.entries[0].period,3);
 const list=sessionsFor(effectiveCourses([course({location:'Updated'})],settings,state,'gzist-zfsoft'),2);
 assert.equal(list[1].location,'Updated');assert.equal(list[2].location,'C306');assert.equal(overrideFor(state,course(),settings,context),null);
});
test('本机保存只包含校验字段，覆盖同一次记录，读取保持独立',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
 assert.deepEqual(readOverrides(storage),{version:1,entries:[]});let state=upsertOverride([],{...record(),password:'not copied'});
 state=upsertOverride(state,record(course(),{location:'D401'}));saveOverrides(state,storage);assert.equal(state.entries.length,1);
 assert.equal(readOverrides(storage).entries[0].location,'D401');assert.ok(!data.get(OVERRIDES_KEY).includes('password'));
 data.set(OVERRIDES_KEY,'broken');assert.throws(()=>readOverrides(storage),/无法读取/);
});
test('拒绝不存在的日期、越界节次、错配星期、重复记录及课程目录伪造的日期',()=>{
 const check=item=>validateOverrides({version:1,entries:[item]});
 assert.throws(()=>check(record(course(),{date:'2026-02-30'})));assert.throws(()=>check(record(course(),{period:13})));
 assert.throws(()=>check(record(course(),{date:'2026-09-08'})),/星期/);assert.throws(()=>check(record(course(),{fingerprint:'["x","t",0,false]'})));
 assert.throws(()=>validateOverrides({version:1,entries:[record(),record()]}),/重复/);
 assert.throws(()=>occurrenceKey(course(),settings,{...context,week:undefined}),/具体课块/);
 assert.throws(()=>occurrenceKey(course(),settings,{...context,week:16}),/具体课块/);
 assert.throws(()=>check(record(course(),{cancelled:false,location:null})),/没有有效/);
});
