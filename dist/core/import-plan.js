import {parseWeeks} from './model.js';
/** A weekly response replaces only the affected weeks, never the rest of the semester. */
export function prepareImport(existing,imported){
 const scope=imported.sourceScope;
 if(scope?.type==='unknown')throw Error('已捕获课程，但尚未确认是单周还是整学期。请在学校页面选择学期课表后重新读取。');
 if(scope?.type!=='week')return {value:imported,records:imported.courses,message:'确认后替换学校课程，保留个人安排。'};
 const weeks=parseWeeks(scope.weeks),affected=new Set(weeks);
 const records=imported.courses.map(course=>({...course,weeks:course.weeks.filter(week=>affected.has(week))})).filter(course=>course.weeks.length);
 if(!records.length)throw Error('本次查询周次与课程周次不匹配，未更新课表。');
 const remaining=existing.map(course=>({...course,weeks:course.weeks.filter(week=>!affected.has(week))})).filter(course=>course.weeks.length);
 const groups=new Map();
 for(const course of [...remaining,...records]){
  const key=JSON.stringify([course.name,course.day,course.start,course.end,course.location,course.teacher,course.note]);
  if(groups.has(key))groups.get(key).weeks=parseWeeks([...groups.get(key).weeks,...course.weeks]);
  else groups.set(key,{...course,weeks:[...course.weeks]});
 }
 return {value:{...imported,courses:[...groups.values()]},records,message:`本次只更新第 ${weeks.join('、')} 周，保留其他周的已有课程和个人安排。`};
}
