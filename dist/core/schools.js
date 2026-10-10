export const SCHOOL_KEY='course-compass.school.v1';
export const GZIST={id:'gzist-zfsoft',name:'广州理工学院',adapter:'zfsoft',loginUrl:'https://portal.gzist.edu.cn/',timetableUrl:'http://jw.gzist.edu.cn/jwglxt/kbcx/xskbcxMobile_cxTimeTableIndex.html?gnmkdm=Y253511&hasHeader=true',homeUrl:'https://jw.gzist.edu.cn/jwglxt/',hosts:['portal.gzist.edu.cn','ids.gzist.edu.cn','jw.gzist.edu.cn'],verified:true};
export const MANUAL={id:'manual',name:'通用课表 · 任意学校',adapter:'manual',loginUrl:'',timetableUrl:'',homeUrl:'',hosts:[],verified:false};
function url(text){const u=new URL(text);if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('自定义学校入口需为无账号密码的 HTTPS 网址');return u;}
export function validateSchool(raw){
 if(raw.id===GZIST.id)return {...GZIST,hosts:[...GZIST.hosts]};if(raw.id==='manual')return {...MANUAL,hosts:[]};
 const name=String(raw.name||'').trim();if(!name||name.length>60)throw Error('请填写学校名称（最多60字）');
 const login=url(String(raw.loginUrl||''));const adapter=raw.adapter==='zfsoft'?'zfsoft':'manual';const table=raw.timetableUrl?url(raw.timetableUrl):login;
 if(adapter==='zfsoft'&&!/^\/jwglxt\/kbcx\//.test(table.pathname))throw Error('正方试验接入需要学校实际的 /jwglxt/kbcx/ 课表入口');
 const extra=Array.isArray(raw.hosts)?raw.hosts:[];if(extra.length>10)throw Error('登录域名最多10个');
 const hosts=[...new Set([login.hostname,table.hostname,...extra.map(host=>{if(!/^[a-z0-9.-]+$/i.test(host)||host.includes('..')||!host.includes('.'))throw Error('登录域名格式错误');return host.toLowerCase();})])];
 return {id:'custom-'+table.hostname.replace(/[^a-z0-9.-]/gi,''),name,adapter,loginUrl:login.href,timetableUrl:table.href,homeUrl:table.origin+'/jwglxt/',hosts,verified:false};
}
export function currentSchool(){try{return validateSchool(JSON.parse(localStorage.getItem(SCHOOL_KEY)||'null')||GZIST);}catch{return {...GZIST};}}
export function schoolDataKey(key,school=currentSchool()){return school.id===GZIST.id?key:key+'.'+school.id;}
