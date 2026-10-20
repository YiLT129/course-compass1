import test from 'node:test';import assert from 'node:assert/strict';
import {validateCourse,validateSettings,toICS} from '../dist/core/model.js';
import {effectiveCourses,occurrenceKey,upsertOverride} from '../dist/core/overrides.js';
test('单次改教室拆开排课后，日历事件身份唯一且保留未改的另一节及下周',()=>{
 const settings=validateSettings({startDate:'2026-08-31',totalWeeks:16}),course=validateCourse({id:'source',name:'课程',teacher:'老师',day:1,start:1,end:2,weeks:[1,2],location:'A101'}),before=JSON.stringify(course);
 const record={...occurrenceKey(course,settings,{schoolId:'manual',week:1,period:1}),location:'B202',cancelled:false,updatedAt:0},changed=effectiveCourses([course],settings,upsertOverride({version:1,entries:[]},record),'manual');
 const calendar=toICS(changed,settings),ids=calendar.match(/^UID:.+$/gm);
 assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);assert.match(calendar,/LOCATION:B202/);assert.equal((calendar.match(/LOCATION:A101/g)||[]).length,2);assert.equal(JSON.stringify(course),before);
});
