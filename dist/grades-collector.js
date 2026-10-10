/* Observe the school's own read-only grade query; never guess menu permissions. */
(function(){
 if(window.__courseCompassGrades?.version===4)return;
 const post=value=>{if(value.type==='gradesError')window.__compassGradeError={error:value.reason,requestId:value.requestId};try{window.CourseCompassCapture?.postMessage(JSON.stringify(value));}catch{}};
 const fields=['kcmc','kch','kch_id','jxb_id','xf','jd','cj','ksxz','ksxzmc','xnm','xqm','xm','xh'];
 const nativeFetch=window.fetch?.bind(window),KEY='course-compass.grade-query.v2';
 const clean=row=>Object.fromEntries(fields.filter(key=>row[key]!=null).map(key=>[key,row[key]]));
 const normalTerm=v=>({'1':'3','2':'12'}[String(v)]||String(v));
 function safeURL(value){try{const u=new URL(value,window.location.href);return u.hostname===(window.__courseCompassSchoolHost||'jw.gzist.edu.cn')&&['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u:null;}catch{return null;}}
 function queryRecipe(url,method,body){
  const u=safeURL(url);if(!u||!/^\/jwglxt\/cjcx\/[^/]*_cx[^/]*\.html$/i.test(u.pathname)||/Index\.html$/i.test(u.pathname))return null;
  method=String(method||'GET').toUpperCase();if(!['GET','POST'].includes(method))return null;
  const all=new URLSearchParams(u.search);try{new URLSearchParams(typeof body==='string'||body instanceof URLSearchParams?body:'').forEach((v,k)=>all.set(k,v));}catch{}
  if(all.getAll('doType').some(v=>v!=='query'))return null;
  const values={};all.forEach((v,k)=>{if(/^(xnm|xqm|gnmkdm|doType|_search|nd|time|queryModel\.(showCount|currentPage|sortName|sortOrder))$/.test(k)&&v.length<=100)values[k]=v;});
  if(!/^20\d{2}$/.test(values.xnm||'')||!['3','12','16'].includes(normalTerm(values.xqm)))return null;
  return {path:u.pathname,method,values};
 }

 // The confirmed mobile route renders cards in HTML, sometimes without an XHR.
 const mobilePath='/jwglxt/cjcx/cjcxMobile_cxDgXscj.html';
 const bodyText=()=>String(window.document?.body?.innerText||'').replace(/\u00a0/g,' ');
 // Only rendered controls and selected option labels are authoritative. Hidden xnm can be a stale default/end year.
 function rendered(e){if(!e||e.type==='hidden'||e.hidden)return false;if(typeof e.getClientRects==='function'&&!e.getClientRects().length)return false;return true;}
 function visibleControl(key){const d=window.document;return [d?.querySelector('select[name="'+key+'"],select#'+key),d?.querySelector('input[name="'+key+'"],input#'+key)].find(rendered)||null;}
 function pageScope(){
  const text=bodyText(),yc=visibleControl('xnm'),tc=visibleControl('xqm'),yl=String(yc?.selectedOptions?.[0]?.textContent||''),tl=String(tc?.selectedOptions?.[0]?.textContent||'');
  const range=v=>{const m=String(v).match(/(20\d{2})\s*[-–—~～/]\s*(20\d{2})/);if(!m)return null;if(Number(m[2])!==Number(m[1])+1)throw Error('学校显示的学年范围无法确认，未保存成绩。');return m[1];};
  const yearLabel=text.match(/学年\s*[:：]?\s*(20\d{2}\s*[-–—~～/]\s*20\d{2}|20\d{2})(?!\d)/)?.[1]||'';
  const year=range(yl)||range(yearLabel)||(/^20\d{2}$/.test(String(yc?.value))?String(yc.value):null)||yearLabel.match(/^20\d{2}$/)?.[0];
  const termOf=v=>{const m=String(v).trim().match(/^(?:第)?\s*([123一二三])\s*(?:学期)?$/);return m?normalTerm({'一':'1','二':'2','三':'3'}[m[1]]||m[1]):['3','12','16'].includes(String(v).trim())?String(v).trim():null;};
  const termLabel=text.match(/学期\s*[:：]?\s*((?:第)?\s*[123一二三](?:\s*学期)?)(?!\d)/)?.[1]||'';
  const term=termOf(tl)||termOf(termLabel)||termOf(tc?.value);
  if(!/^20\d{2}$/.test(year||'')||!['3','12','16'].includes(term))return null;
  return {year,term,scopeEvidence:range(yl)?'selected-label':range(yearLabel)?'visible-text':'visible-control'};
 }
 function mobileSnapshot(){
  if(safeURL(window.location.href)?.pathname!==mobilePath)return null;
  const text=bodyText(),scope=pageScope();
  if(!scope)throw Error('已打开手机成绩页，但无法确认页面显示的学年/学期。请在学校页面选择学年与学期后重试。');
  const {year,term}=scope;
  const records=[],parts=text.split(/成绩\s*[:：]/),labelCount=parts.length-1;
  for(let i=0;i<labelCount;i++){
   const before=parts[i],after=parts[i+1],heading=[...before.matchAll(/(?:^|\n)\s*([A-Za-z0-9]{4,40})\s*[-－—]\s*([^\n]+(?:\n(?!\s*(?:学分|绩点)\s*[:：])[^\n]+)*)/g)].at(-1);
   const field=label=>{const m=after.match(new RegExp(label+'[ \\t]*[:：][ \\t]*([^\\n]*?)(?=(?:学分|绩点)[ \\t]*[:：]|\\n|$)'));if(!m)return null;let v=m[1].trim();if(!v){const next=after.slice(m.index+m[0].length).match(/^\s*\n[ \t]*([^\n]*)/);if(next&&/^(?:\d+(?:\.\d+)?|--?|—|未发布|暂无)$/.test(next[1].trim()))v=next[1].trim();}return [m[0],v];};
   const credit=field('学分'),point=field('绩点'),score=after.split(/学分\s*[:：]/)[0].trim();
   if(!heading||!credit||!point||!score||score.length>40)throw Error('第 '+(i+1)+' 条手机成绩的课程、成绩、学分或绩点不完整，未保存任何记录。');
   const val=v=>{v=v.trim();if(/^(?:--?|—|未发布|暂无)?$/.test(v))return '';if(!/^\d+(?:\.\d+)?$/.test(v))throw Error('手机成绩页面出现无法识别的学分/绩点，原成绩已保留。');return v;};
   records.push({kch:heading[1],kcmc:heading[2].replace(/\s*\n\s*/g,'').trim(),cj:score,xf:val(credit[1]),jd:val(point[1]),xnm:year,xqm:term});
  }
  if(!records.length)return null;
  if(records.length>2000)throw Error('手机成绩记录超出可读取范围。');
  return {...scope,year,term,items:records,complete:false,verified:true,source:'school-page',coverage:'loaded-page',scopeVerified:true};
 }
 let mobileDirty=false,lastMobileFingerprint='',lastMobileScope='',lastMobileItems='',mobileNotice='';
 function readMobile(){const data=mobileSnapshot();if(!data)return null;const fingerprint=JSON.stringify(data),scope=data.year+'-'+data.term,items=JSON.stringify(data.items.map(({xnm,xqm,...row})=>row));if(lastMobileScope&&lastMobileScope!==scope&&lastMobileItems===items){mobileDirty=true;lastMobileFingerprint=fingerprint;}if(mobileDirty&&fingerprint===lastMobileFingerprint)throw Error('学校学期刚刚变更，成绩尚未重新加载。请等待查询完成或重新进入成绩页面，再读取。');mobileDirty=false;lastMobileFingerprint=fingerprint;lastMobileScope=scope;lastMobileItems=items;return data;}
 function announceMobile(){try{const data=readMobile();if(!data)return;const key=JSON.stringify(data);if(key!==mobileNotice){mobileNotice=key;post({type:'gradesReady',entry:mobilePath,source:'school-page',year:data.year,term:data.term,scopeEvidence:data.scopeEvidence,count:data.items.length,reason:'已自动跟随 '+data.year+'–'+(Number(data.year)+1)+' 学年 · '+(data.term==='3'?'第一学期':data.term==='12'?'第二学期':'第三学期')+'，识别 '+data.items.length+' 门课程。点「读取成绩」预览保存。'});}}catch{}}

 function pageState(){
  const d=window.document,text=String(d?.body?.innerText||'').slice(0,12000),url=safeURL(window.location.href);
  if(!url)return {kind:'login',reason:'请点「登录」在学校官方门户完成登录，再进入成绩查询。'};
  if(d?.querySelector('input[type="password"]')||/\/login[_/]|slogin|\/cas\//i.test(url.pathname))return {kind:'login',reason:'学校登录会话尚未建立或已失效，请点「登录」后重新进入成绩查询。'};
  if((d?.querySelector('.error_title,.error-title')&&text.trim())||(/^\s*警告[！!]?|无功能权限|无访问权限|非法请求|请求的.{0,20}(不存在|不合法)|系统异常/.test(text)&&text.length<3500))return {kind:'blocked',reason:'学校返回警告或权限页面，未读取任何成绩。请点「教务首页」，从学校菜单进入「成绩查询」，不要继续使用失效入口。'};
  return {kind:'waiting',reason:'登录后进入学校「成绩查询」，选择学年、学期，等成绩显示后点上方「读取成绩」。若学校页面有「查询」按钮，请先查询。'};
 }

 let lastProfile='';
 function captureProfile(raw){
  if(!safeURL(window.location.href)||pageState().kind!=='waiting')return null;
  const value=raw?.xsxx||raw?.profile||raw||{},name=String(value.xm||value.name||'').trim(),studentId=String(value.xh||value.studentId||'').trim();
  if(!/^[A-Za-z0-9]{6,24}$/.test(studentId)||!name||name.length>60||/[<>\n\r]/.test(name))return null;
  const profile={name,studentId},key=JSON.stringify(profile);window.__compassProfileResult=profile;
  if(key!==lastProfile){lastProfile=key;post({type:'schoolProfile',profile});}return profile;
 }
 function readProfile(){
  if(pageState().kind!=='waiting')return null;
  const field=key=>{const e=window.document?.querySelector('#'+key+',#lbl_'+key+',[data-field="'+key+'"]');return e?String(e.value??e.textContent??'').trim():'';},text=bodyText();
  const xm=field('xm')||text.match(/(?:^|\n)\s*姓名(?:[ \t]*[:：]\s*|[ \t]*\n[ \t]*)([^\n]{1,60})/)?.[1],xh=field('xh')||text.match(/(?:^|\n)\s*学号(?:[ \t]*[:：]\s*|[ \t]*\n[ \t]*)([A-Za-z0-9]{6,24})(?=\s|$)/)?.[1];
  return captureProfile({xm,xh})||window.__compassProfileResult||null;
 }
 function checkRaw(raw){if(!raw||typeof raw!=='object'||!Array.isArray(raw.items)||raw.items.length>2000||raw.success===false||raw.error||raw.errors||raw.flag==='false')throw Error('学校未返回有效成绩列表，可能需要登录或当前无查询权限。');if(raw.items.some(r=>!r||!String(r.kcmc||'').trim()))throw Error('学校返回的数据不是可识别的成绩列表。');return raw;}
 const collector={version:4,profile:readProfile,querying:false,recipe:null,captured:null,
  inspect(){readProfile();announceMobile();const state=pageState();let page=null;try{page=readMobile();}catch{}if(page){Object.assign(state,{year:page.year,term:page.term,scopeEvidence:page.scopeEvidence});state.reason='已自动跟随 '+page.year+'–'+(Number(page.year)+1)+' 学年 · '+(page.term==='3'?'第一学期':page.term==='12'?'第二学期':'第三学期')+'，共 '+page.items.length+' 门已加载课程。点「读取成绩」预览保存。';}if(!page&&state.kind==='waiting'&&this.recipe)state.reason='已识别学校成绩查询。点「读取成绩」自动跟随学校当前学期，并读取全部分页。';state.ready=state.kind==='waiting'&&!!(this.recipe||page);if(state.ready)state.kind='ready';post({type:'gradesState',...state});return state;},
  capture(url,method,body,raw){
   const recipe=queryRecipe(url,method,body);if(!recipe)return;
   try{checkRaw(raw);captureProfile(raw.items.find(r=>r.xm&&r.xh));if(!raw.items.length&&(raw.totalResult==null||Number(raw.totalResult)!==0))throw Error('学校返回空列表，但缺少总数，不能确认暂无成绩。');this.recipe=recipe;this.captured=raw;try{window.localStorage?.setItem(KEY,JSON.stringify(recipe));}catch{}
    const current=safeURL(window.location.href),entry=current&&/\/cjcx\//.test(current.pathname)?current.pathname+'?'+new URLSearchParams([...current.searchParams].filter(([k])=>['gnmkdm','hasHeader','layout'].includes(k))).toString():null;
    post({type:'gradesReady',entry,year:recipe.values.xnm,term:normalTerm(recipe.values.xqm),scopeEvidence:'school-query',reason:'已识别学校成绩查询。点「读取成绩」自动跟随学校当前学期，包含全部分页。'});
   }catch(error){post({type:'gradesCaptureError',reason:String(error.message||'学校成绩数据格式暂无法识别，未覆盖原有成绩。')});}
  },
  async obtain(year,term,requestId=null,followPage=false){
   const report=value=>post({...value,requestId});
   if(this.querying)return null;year=String(year);term=String(term);
   const state=pageState();if(state.kind!=='waiting'){report({type:'gradesError',reason:state.reason});return null;}
   // A mobile snapshot always follows the verified visible school scope, regardless of the app cache selection.
   if(safeURL(window.location.href)?.pathname===mobilePath){
    try{const data=readMobile();if(data){data.requestId=requestId;report({type:'grades',data});return data;}
     throw Error('手机成绩页面尚未显示可读取的课程。请先在学校页面选择学期并等待成绩显示；不会将空页面保存为无成绩。');
    }catch(error){report({type:'gradesError',reason:String(error.message)});return null;}
   }
   if(!this.recipe){report({type:'gradesError',reason:'尚未识别学校实际成绩请求。请先在下方学校页面进入「成绩查询」，选择学期并点学校的「查询」，再点「读取成绩」。'});return null;}
   if(followPage){const scope=pageScope()||(this.captured?{year:String(this.recipe.values.xnm),term:normalTerm(this.recipe.values.xqm)}:null);if(!scope){report({type:'gradesError',reason:'请先在学校页面选择学期并查询成绩，识别后会自动跟随该学期读取。'});return null;}year=scope.year;term=scope.term;}
   if(!/^20\d{2}$/.test(year)||!['3','12','16'].includes(term)){report({type:'gradesError',reason:'无法确认成绩学期，请在学校页面选择后重试。'});return null;}
   this.querying=true;report({type:'status',reason:'正在按 '+year+' 学年所选学期查询全部成绩…'});
   try{
    const recipe=this.recipe,items=[],seen=new Set();let complete=false;
    for(let page=1;page<=20;page++){
     const encodedTerm=['1','2'].includes(String(recipe.values.xqm))?({'3':'1','12':'2','16':'3'}[term]):term;
     const values={...recipe.values,xnm:year,xqm:encodedTerm,'queryModel.showCount':'100','queryModel.currentPage':String(page),nd:String(Date.now())},params=new URLSearchParams(values),url=new URL(recipe.path,window.location.href);
     const controller=typeof AbortController==='function'?new AbortController():null,timer=controller?setTimeout(()=>controller.abort(),10000):null;
     let raw;try{if(recipe.method==='GET')url.search=params.toString();const response=await nativeFetch(url.href,{method:recipe.method,body:recipe.method==='POST'?params.toString():undefined,credentials:'same-origin',signal:controller?.signal,headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','X-Requested-With':'XMLHttpRequest'}});
      if(!response.ok)throw Error('学校查询返回 HTTP '+response.status+'，请回教务首页重新查询。');
      const returned=response.url&&safeURL(response.url);if(response.redirected&&(!returned||/login|slogin/i.test(returned.pathname)))throw Error('学校会话失效，请点「登录」重新登录。');
      try{raw=checkRaw(await response.json());}catch(e){throw Error('学校返回登录、警告页或无效成绩数据，请在学校页面确认能看到成绩后再读取。');}
     }finally{if(timer!=null)clearTimeout(timer);}
     if(raw.currentPage!=null&&Number(raw.currentPage)!==page)throw Error('学校成绩分页不一致，原有成绩已保留。');
     if(raw.items.length){const fingerprint=JSON.stringify(raw.items);if(seen.has(fingerprint))throw Error('学校重复返回同一页成绩，原有成绩已保留。');seen.add(fingerprint);}
     items.push(...raw.items);if(items.length>2000)throw Error('成绩数量超出范围。');
     const total=raw.totalResult==null?null:Number(raw.totalResult),pages=raw.totalPage==null?null:Number(raw.totalPage);
     if(total!=null&&Number.isInteger(total)&&total>=0){if(items.length>total)throw Error('成绩总数与分页不一致。');if(items.length===total){complete=true;break;}}
     else if(pages!=null&&Number.isInteger(pages)&&pages>0&&page>=pages){complete=true;break;}
     else if(page>1&&!raw.items.length&&items.length){complete=true;break;}
     if(!raw.items.length)throw Error('学校返回空数据但没有可核实的总数，不能确认暂无成绩。');
    }
    if(!complete)throw Error('成绩分页读取不完整，原有成绩已保留。');
    const data={year,term,complete:true,verified:true,source:'school-query',requestId,items:items.map(clean)};report({type:'grades',data});return data;
   }catch(error){report({type:'gradesError',reason:error.name==='AbortError'?'学校成绩查询超时，请重试；原有成绩已保留。':String(error.message||'成绩读取失败，原有成绩已保留。')});return null;}finally{this.querying=false;}
  }
 };
 window.__courseCompassGrades=collector;
 try{const saved=JSON.parse(window.localStorage?.getItem(KEY)||'null');if(saved){const reconstructed=queryRecipe(saved.path,saved.method,new URLSearchParams(saved.values));if(reconstructed)collector.recipe=reconstructed;}}catch{}
 if(nativeFetch)window.fetch=async function(input,options){const response=await nativeFetch(input,options);try{if(safeURL(typeof input==='string'||input instanceof URL?String(input):input.url))response.clone().json().then(captureProfile).catch(()=>{});const url=typeof input==='string'||input instanceof URL?String(input):input.url,method=options?.method||input?.method||'GET';if(queryRecipe(url,method,options?.body))response.clone().json().then(raw=>collector.capture(url,method,options?.body,raw)).catch(()=>post({type:'gradesCaptureError',reason:'学校成绩查询返回登录页、警告页或非 JSON 内容，请在学校页面确认登录和查询权限。'}));}catch{}return response;};
 const xhr=window.XMLHttpRequest?.prototype;if(xhr){const open=xhr.open,send=xhr.send;xhr.open=function(method,url,...args){this.__ccGradeRequest={method,url};return open.call(this,method,url,...args);};xhr.send=function(body){const info=this.__ccGradeRequest;if(info&&safeURL(info.url))this.addEventListener('load',()=>{try{captureProfile(this.responseType==='json'?this.response:JSON.parse(this.responseText));}catch{}});if(info&&queryRecipe(info.url,info.method,body))this.addEventListener('load',()=>{try{if(this.status>=200&&this.status<300)collector.capture(info.url,info.method,body,this.responseType==='json'?this.response:JSON.parse(this.responseText));else post({type:'gradesCaptureError',reason:'学校成绩查询返回 HTTP '+this.status+'，未覆盖原有成绩。'});}catch{post({type:'gradesCaptureError',reason:'学校成绩查询返回登录页、警告页或无法识别的数据，未覆盖原有成绩。'});}});return send.call(this,body);};}
 if(window.CourseCompassCapture){const previous=window.CourseCompassCapture.onmessage;window.CourseCompassCapture.onmessage=event=>{try{const v=JSON.parse(event.data);if(v.type==='readProfile'){readProfile();return;}if(v.type==='readGrades'){collector.obtain(v.year,v.term,v.requestId,v.followPage===true);return;}}catch{}if(previous)previous(event);};}
 window.document?.addEventListener('change',e=>{if(rendered(e.target)&&e.target?.matches?.('#xnm,#xqm,[name="xnm"],[name="xqm"]')){try{lastMobileFingerprint=JSON.stringify(mobileSnapshot());}catch{}mobileDirty=true;}},true);
 window.document?.addEventListener('DOMContentLoaded',()=>collector.inspect());
 if(typeof MutationObserver==='function'&&window.document?.documentElement){let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{readProfile();announceMobile();},200);}).observe(window.document.documentElement,{childList:true,subtree:true,characterData:true});}
 collector.inspect();
})();
