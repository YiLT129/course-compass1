import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCourse,validateSettings,DEFAULT_TIMES} from '../dist/core/model.js';
import {sessionsFor,blocksFor,scheduleClock} from '../dist/core/sessions.js';
import {effectiveCourses,occurrenceKey} from '../dist/core/overrides.js';
const settings=validateSettings({startDate:'2026-08-31',totalWeeks:16});
const course=(extra={})=>validateCourse({id:'electrical',name:'电力系统分析',day:1,start:1,end:2,weeks:[1,3],location:'A101',...extra});
const clock=(time,courses=[course()],config=settings)=>scheduleClock(courses,config,new Date(time));
test('连排仅在展示层拆成独立节次，ID、周次及源课表保持不变',()=>{const original=course(),before=JSON.stringify(original),list=sessionsFor([original],1);assert.deepEqual(list.map(c=>[c.id,c.period,c.start,c.end,c.sourceStart,c.sourceEnd]),[['electrical',1,1,1,1,2],['electrical',2,2,2,1,2]]);assert.notEqual(list[0].sessionKey,list[1].sessionKey);assert.equal(JSON.stringify(original),before);assert.equal(sessionsFor([original],2).length,0);});
test('第1节按08:20开始、09:05结束；课间不能算作正在上课',()=>{assert.equal(clock('2026-08-31T08:19:59').current.length,0);assert.equal(clock('2026-08-31T08:20:00').current[0].period,1);assert.equal(clock('2026-08-31T09:04:59').current[0].period,1);const gap=clock('2026-08-31T09:05:00');assert.equal(gap.current.length,0);assert.equal(gap.onBreak,true);assert.equal(gap.next[0].period,2);assert.equal(gap.next[0].time,'09:15–10:00');});
test('下一节开始切换到第2节，10点后不继续显示已结束课程',()=>{assert.equal(clock('2026-08-31T09:15:00').current[0].period,2);assert.equal(clock('2026-08-31T09:59:59').current[0].period,2);assert.equal(clock('2026-08-31T10:00:00').current.length,0);assert.equal(clock('2026-08-31T10:00:00').onBreak,false);});
test('晚课21:00相接时只高亮第12节',()=>{const r=clock('2026-08-31T21:00:00',[course({start:11,end:12})]);assert.equal(r.current.length,1);assert.equal(r.current[0].period,12);assert.equal(r.current[0].time,'21:00–21:40');});
test('使用已保存的自定义作息，不依赖默认8点20',()=>{const times=[...DEFAULT_TIMES];times[0]='08:00-08:45';times[1]='08:55-09:40';const custom=validateSettings({...settings,times});assert.equal(clock('2026-08-31T08:01:00',[course()],custom).current[0].period,1);assert.equal(clock('2026-08-31T08:50:00',[course()],custom).onBreak,true);});
test('单双周、星期、学期边界及无课程时不伪造当前课程',()=>{assert.equal(clock('2026-09-07T08:30:00').current.length,0);assert.equal(clock('2026-09-01T08:30:00').current.length,0);assert.equal(clock('2026-08-30T08:30:00').withinTerm,false);assert.equal(clock('2026-12-21T08:30:00',[course({weeks:[17]})]).next.length,0);assert.equal(clock('2026-08-31T08:30:00',[]).current.length,0);});
test('周日正确找到周一的第1节，周末课程也按节判断',()=>{const sunday=clock('2026-09-06T23:59:00',[course({weeks:[2]})]);assert.equal(sunday.next[0].date,'2026-09-07');assert.equal(sunday.next[0].period,1);assert.equal(clock('2026-09-05T14:05:00',[course({day:6,start:5,end:6})]).current[0].period,5);});
test('重叠安排同时保留，不随意选一门覆盖',()=>{const r=clock('2026-08-31T09:20:00',[course(),course({id:'other',name:'另一门课程',start:2,end:3})]);assert.equal(r.current.length,2);assert.deepEqual(new Set(r.current.map(c=>c.period)),new Set([2]));});
test('课表块按10分钟以内的连堂间隔合并，20分钟休息处分开且不修改源记录和左侧作息',()=>{
 const original=course({end:4}),before=JSON.stringify(original),timesBefore=[...settings.times],blocks=blocksFor([original],1,1,settings.times);
 assert.deepEqual(blocks.map(c=>[c.period,c.start,c.end,c.periods,c.sessionKey]),[[1,1,2,[1,2],'electrical@1-2'],[3,3,4,[3,4],'electrical@3-4']]);
 assert.deepEqual(blocks.map(c=>[c.sourceStart,c.sourceEnd]),[[1,4],[1,4]]);
 assert.equal(JSON.stringify(original),before);assert.deepEqual(settings.times,timesBefore);assert.equal(sessionsFor([original],1).length,4);
});
test('展示分组采用已保存作息，10分钟合并、11分钟分开、0分钟相接也合并',()=>{
 const times=[...DEFAULT_TIMES];times[0]='08:00-08:45';times[1]='08:55-09:40';times[2]='09:51-10:36';times[3]='10:36-11:21';
 const custom=validateSettings({...settings,times});
 assert.deepEqual(blocksFor([course({end:4})],1,1,custom.times).map(c=>[c.start,c.end]),[[1,2],[3,4]]);
 assert.deepEqual(blocksFor([course({start:11,end:12})],1).map(c=>[c.start,c.end]),[[11,12]]);
});
test('大课块仍保留真实课间和逐小节当前课程判断',()=>{
 const original=course({end:4});assert.equal(blocksFor([original],1).length,2);
 const breakTime=clock('2026-08-31T09:05:00',[original]);assert.equal(breakTime.current.length,0);assert.equal(breakTime.onBreak,true);assert.equal(breakTime.next[0].period,2);
 assert.equal(clock('2026-08-31T09:15:00',[original]).current[0].period,2);assert.equal(clock('2026-08-31T10:20:00',[original]).current[0].period,3);
});
test('同名重叠课程、不同源课程、不同星期和未排课周次不会合并丢失',()=>{
 const originals=[course({end:4}),course({id:'another',start:2,end:3}),course({id:'tuesday',day:2})];
 const blocks=blocksFor(originals,1);
 assert.equal(blocks.length,5);assert.equal(blocks.filter(c=>c.id==='another').length,2);assert.deepEqual(blocks.filter(c=>c.id==='tuesday').map(c=>c.periods),[[1,2]]);
 assert.equal(blocksFor(originals,2).length,0);assert.equal(blocksFor(originals,1,7).length,0);
});
test('单节换教室或停课后保留边界，不与未改动的连堂小节合并',()=>{
 const original=course({end:4}),key=occurrenceKey(original,settings,{schoolId:'gzist',week:1,period:2});
 for(const change of [{location:'B202',cancelled:false},{location:null,cancelled:true}]){
  const effective=effectiveCourses([original],settings,{version:1,entries:[{...key,...change,updatedAt:1}]},'gzist');
  const blocks=blocksFor(effective,1,1,settings.times);
  assert.deepEqual(blocks.map(c=>[c.start,c.end]),[[1,1],[2,2],[3,4]]);assert.equal(blocks[1].location,change.location??original.location);assert.equal(blocks[1].cancelled,change.cancelled);assert.equal(blocks[2].localOverride,undefined);
  assert.deepEqual(blocksFor(effective,3).map(c=>[c.start,c.end]),[[1,2],[3,4]]);
 }
});
test('有效数据被拆为逐节后，相同来源且相同调整状态可重新合并连堂',()=>{
 const original=course({end:4}),entries=[1,2].map(period=>({...occurrenceKey(original,settings,{schoolId:'gzist',week:1,period}),location:'B202',cancelled:false,updatedAt:period}));
 const effective=effectiveCourses([original],settings,{version:1,entries},'gzist'),before=JSON.stringify(effective),blocks=blocksFor(effective,1,1,settings.times);
 assert.deepEqual(blocks.map(c=>[c.start,c.end,c.location,!!c.localOverride]),[[1,2,'B202',true],[3,4,'A101',false]]);assert.equal(JSON.stringify(effective),before);
});
