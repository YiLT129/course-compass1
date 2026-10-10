import {validateCourse,validateEnvelope} from '../core/model.js';
import {registerAdapter} from './registry.js';
const fields=['name','day','start','end','weeks','location','teacher'];
export const TABLE_EXAMPLE='课程名称,星期,开始节次,结束节次,周次,教室,教师\n示例课程,1,1,2,1-16,A101,示例老师';
export function parseTable(text){
 const source=String(text).replace(/^\uFEFF/,'').trim();if(!source)throw Error('请粘贴表格或选择 CSV 文件');if(source.length>2_000_000)throw Error('表格超过2MB');
 const delimiter=source.split(/\r?\n/)[0].includes('\t')?'\t':',';const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<=source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else if(!cell||quoted)quoted=!quoted;else throw Error('CSV引号格式错误');}else if(!quoted&&(c===delimiter||c==='\n'||c===undefined)){row.push(cell.replace(/\r$/,''));cell='';if(c!==delimiter){if(row.some(v=>v.trim()))rows.push(row);row=[];}}else if(c!==undefined)cell+=c;}
 if(quoted)throw Error('CSV引号未闭合');if(rows.length<2||rows.length>1001)throw Error('表格需要表头及1–1000条排课');
 const aliases={课程名称:'name',星期:'day',开始节次:'start',结束节次:'end',周次:'weeks',教室:'location',教师:'teacher'};
 const columns=rows.shift().map(v=>aliases[v.trim()]||v.trim());for(const key of fields.slice(0,5))if(columns.filter(c=>c===key).length!==1)throw Error('表头需要：课程名称、星期、开始节次、结束节次、周次、教室、教师');
 const courses=rows.map((r,i)=>{try{if(r.length!==columns.length)throw Error('列数与表头不一致；有逗号的字段请用英文双引号包住');const value=Object.fromEntries(columns.map((key,k)=>[key,r[k].trim()]));return validateCourse(value,i);}catch(e){throw Error('第'+(i+2)+'行：'+e.message+'。未导入任何数据');}});
 return {version:1,courses,demo:false,adapter:'通用表格'};
}
registerAdapter({id:'universal-table',title:'通用表格',detect:raw=>typeof raw==='string',parse:parseTable});
registerAdapter({id:'universal-courses',title:'通用课程 JSON',detect:raw=>Array.isArray(raw)||raw?.format==='course-compass-table',parse:raw=>validateEnvelope({version:1,courses:(Array.isArray(raw)?raw:raw.courses).map((c,i)=>validateCourse(c,i)),demo:false})});
