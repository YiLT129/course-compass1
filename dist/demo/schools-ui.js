import {currentSchool,validateSchool,GZIST,MANUAL,SCHOOL_KEY} from '../core/schools.js';
const $=s=>document.querySelector(s);
export function setupSchools({notify,openSheet}){
 let school=currentSchool();
 if(window.CourseCompass?.setSchool){if(!window.CourseCompass.setSchool(JSON.stringify(school)))notify('学校配置未能应用，请在学校设置重新保存');}
 function render(){const badge=school.verified?'本校读取流程已由用户验证':school.adapter==='zfsoft'?'正方同结构 · 尚未验证此学校':'通用导入';$('#school-current').textContent=school.name+'\n'+badge;$('#user-school-name').textContent=school.name;$('#user-login span').textContent=school.adapter==='manual'?'打开学校入口 / 使用通用导入':'登录教务系统';const f=$('#school-form').elements;f.name.value=school.id.startsWith('custom-')?school.name:'';f.adapter.value=school.id.startsWith('custom-')?school.adapter:'manual';f.loginUrl.value=school.id.startsWith('custom-')?school.loginUrl:'';f.timetableUrl.value=school.id.startsWith('custom-')?school.timetableUrl:'';f.hosts.value=school.id.startsWith('custom-')?school.hosts.join('\n'):'';}
 function choose(value){try{const next=validateSchool(value);if(window.CourseCompass?.setSchool&&!window.CourseCompass.setSchool(JSON.stringify(next)))throw Error('学校配置未通过客户端校验');localStorage.setItem(SCHOOL_KEY,JSON.stringify(next));location.reload();}catch(e){$('#school-error').textContent=e.message;}}
 $('#school-gzist').onclick=()=>choose(GZIST);$('#school-manual').onclick=()=>choose(MANUAL);
 $('#school-form').onsubmit=e=>{e.preventDefault();const f=e.target.elements;choose({name:f.name.value,adapter:f.adapter.value,loginUrl:f.loginUrl.value,timetableUrl:f.timetableUrl.value,hosts:f.hosts.value.split(/\s+/).filter(Boolean)});};
 document.addEventListener('click',e=>{if(e.target.closest('[data-action="schools"]')){render();$('#school-error').textContent='';openSheet('#schools-sheet');}});
 render();return {render};
}
