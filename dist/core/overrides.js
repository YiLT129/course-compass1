import {addDays,dateKey,monday,parseDate,weekAt} from './model.js';

export const OVERRIDES_KEY='course-compass.overrides.v1';
const MAX_ENTRIES=2000;
const normalize=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,'').toLowerCase();

// Imported IDs and classroom assignments can change on every school refresh.
// Match the subject, teacher and weekday; scope each change to its exact date.
export function courseFingerprint(course){
 return JSON.stringify([normalize(course.name),normalize(course.teacher),Number(course.day),course.personal===true]);
}
function fingerprint(value){
 if(typeof value!=='string'||value.length>700)throw Error('单次调整的课程标识无效');
 let parts;try{parts=JSON.parse(value);}catch{throw Error('单次调整的课程标识无效');}
 if(!Array.isArray(parts)||parts.length!==4||typeof parts[0]!=='string'||!parts[0]||parts[0].length>100||typeof parts[1]!=='string'||parts[1].length>100||!Number.isInteger(parts[2])||parts[2]<1||parts[2]>7||typeof parts[3]!=='boolean')throw Error('单次调整的课程标识无效');
 return courseFingerprint({name:parts[0],teacher:parts[1],day:parts[2],personal:parts[3]});
}
function identity(entry){return JSON.stringify([entry.schoolId,entry.startDate,entry.date,entry.period,entry.fingerprint]);}
export function validateOverrides(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.entries)||raw.entries.length>MAX_ENTRIES)throw Error('单次课程调整记录格式无效');
 const seen=new Set();
 const entries=raw.entries.map(item=>{
  if(!item||typeof item!=='object')throw Error('单次课程调整记录格式无效');
  const schoolId=String(item.schoolId??'');if(!/^[a-z0-9._:-]{1,100}$/i.test(schoolId))throw Error('单次调整的学校标识无效');
  const startDate=String(item.startDate??''),date=String(item.date??'');parseDate(startDate);parseDate(date);
  if(dateKey(monday(startDate))!==startDate||weekAt(startDate,parseDate(date))<1||weekAt(startDate,parseDate(date))>60)throw Error('单次调整的日期不在学期范围内');
  const period=Number(item.period);if(!Number.isInteger(period)||period<1||period>12)throw Error('单次调整的节次无效');
  const fp=fingerprint(item.fingerprint),day=JSON.parse(fp)[2];if((parseDate(date).getDay()+6)%7+1!==day)throw Error('单次调整的日期与课程星期不一致');
  const cancelled=item.cancelled===true;
  if(item.location!==null&&typeof item.location!=='string')throw Error('调整后的教室格式无效');
  const location=item.location===null?null:item.location.trim();if(location!==null&&location.length>160)throw Error('教室最多填写160字');
  if(!cancelled&&location===null)throw Error('单次调整没有有效改动');
  const updatedAt=Number(item.updatedAt??0);if(!Number.isFinite(updatedAt)||updatedAt<0)throw Error('调整记录时间无效');
  const checked={schoolId,startDate,date,period,fingerprint:fp,cancelled,location,updatedAt};
  const key=identity(checked);if(seen.has(key))throw Error('同一节课有重复调整记录');seen.add(key);return checked;
 });
 return {version:1,entries};
}
export function readOverrides(storage=globalThis.localStorage){
 const text=storage?.getItem(OVERRIDES_KEY);if(!text)return {version:1,entries:[]};
 try{return validateOverrides(JSON.parse(text));}catch(error){throw Error('本机单次课程调整无法读取：'+error.message);}
}
export function saveOverrides(raw,storage=globalThis.localStorage){
 const checked=validateOverrides(raw);storage.setItem(OVERRIDES_KEY,JSON.stringify(checked));return checked;
}
function entriesOf(records){return Array.isArray(records)?records:records?.entries||[];}
export function occurrenceKey(course,settings,{schoolId,week,period}){
 if(!Number.isInteger(week)||week<1||week>settings.totalWeeks||!course.weeks.includes(week)||!Number.isInteger(period)||period<course.start||period>course.end)throw Error('请从某一周的具体课块选择要调整的一节');
 return {schoolId,startDate:settings.startDate,date:dateKey(addDays(settings.startDate,(week-1)*7+course.day-1)),period,fingerprint:courseFingerprint(course)};
}
export function overrideFor(records,course,settings,context){
 const key=identity(occurrenceKey(course,settings,context));return entriesOf(records).find(item=>identity(item)===key)||null;
}
export function upsertOverride(records,record){
 const key=identity(record);return validateOverrides({version:1,entries:[...entriesOf(records).filter(item=>identity(item)!==key),record]});
}
export function resetOverride(records,record){
 const key=identity(record);return validateOverrides({version:1,entries:entriesOf(records).filter(item=>identity(item)!==key)});
}

// Keep the raw school envelope untouched. Only weeks with a local change are
// split, so long semesters do not expand into hundreds of daily records.
export function effectiveCourses(courses,settings,records,schoolId){
 const scoped=entriesOf(records).filter(item=>item.schoolId===schoolId&&item.startDate===settings.startDate);
 if(!scoped.length)return courses;
 const byCourse=new Map();for(const entry of scoped){if(!byCourse.has(entry.fingerprint))byCourse.set(entry.fingerprint,[]);byCourse.get(entry.fingerprint).push(entry);}
 return courses.flatMap(course=>{
  const relevant=(byCourse.get(courseFingerprint(course))||[]).filter(entry=>{const week=weekAt(settings.startDate,parseDate(entry.date));return week<=settings.totalWeeks&&course.weeks.includes(week)&&entry.period>=course.start&&entry.period<=course.end;});
  if(!relevant.length)return [course];
  const byWeek=new Map();for(const entry of relevant){const week=weekAt(settings.startDate,parseDate(entry.date));if(!byWeek.has(week))byWeek.set(week,new Map());byWeek.get(week).set(entry.period,entry);}
  const result=[],untouched=course.weeks.filter(week=>!byWeek.has(week));
  if(untouched.length)result.push({...course,weeks:untouched});
  for(const [week,changes] of byWeek){
   let start=course.start,previous=changes.get(start)||null;
   const push=end=>{const change=previous;result.push({...course,start,end,weeks:[week],sourceStart:course.sourceStart??course.start,sourceEnd:course.sourceEnd??course.end,sourceWeeks:course.sourceWeeks??course.weeks,...(change?{cancelled:change.cancelled,location:change.location??course.location,originalLocation:course.location,occurrenceDate:change.date,localOverride:{...change}}:{})});};
   for(let period=course.start+1;period<=course.end;period++){const current=changes.get(period)||null;if(current!==previous){push(period-1);start=period;previous=current;}}
   push(course.end);
  }
  return result;
 });
}
