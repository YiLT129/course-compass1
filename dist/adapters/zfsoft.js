import {parseWeeks,validateCourse,validateEnvelope} from '../core/model.js';
import {registerAdapter} from './registry.js';
registerAdapter({id:'compass-v1',title:'课间备份',detect:raw=>raw?.version===1&&Array.isArray(raw.courses),parse:raw=>validateEnvelope(raw)});
registerAdapter({id:'zfsoft',title:'正方教务',detect:raw=>Array.isArray(raw?.kbList)||Array.isArray(raw?.data?.kbList),parse(raw){
 const root=Array.isArray(raw.kbList)?raw:raw.data; if(!root.kbList.length)throw Error('教务系统返回空课表，请确认学期和查询结果。');if(root.kbList.length>1000)throw Error('课程数量过多');
 const courses=[],errors=[];
 root.kbList.forEach((row,index)=>{try{const period=String(row.jcs??row.jc??'').replace(/^第/,'').replace(/节$/,'').trim().match(/^(\d+)(?:-(\d+))?$/);if(!period)throw Error('缺少有效节次');courses.push(validateCourse({name:row.kcmc,teacher:row.xm??row.jsxm,location:row.cdmc,day:row.xqj,start:Number(period[1]),end:Number(period[2]||period[1]),weeks:parseWeeks(row.zcd),note:row.bz||''},index));}catch(e){errors.push(`第 ${index+1} 条 ${String(row.kcmc||'未命名课程')}：${e.message}`);}});
 if(errors.length)throw Error(`有 ${errors.length} 条课程无法识别，未导入任何数据。\n${errors.slice(0,8).join('\n')}`);
 return {version:1,courses,demo:false,sourceScope:raw.sourceScope||root.sourceScope};
}});
