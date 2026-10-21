import {allowedKey,STATE_KEYS,MAX_PACKAGE,validatePackage,validateTheme,themeFromBackup,mergeTheme} from '../core/packages.js';
import {readAssets,commitRestore,saveTheme,deleteTheme,recoveryRecord,commitUpgradeSnapshot,writeRecoveryRecord} from './assets.js';
import {validateAppearance} from '../core/appearance.js';
import {IMPORT_HISTORY_KEY} from '../core/import-history.js';
const $=s=>document.querySelector(s),E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function downloadText(name,text){if(window.CourseCompass?.saveFile){window.CourseCompass.saveFile(name,'application/json',text);return;}const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function resource(blob){if(!blob)return null;const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});return {type:blob.type,data};}
function blob(r){if(!r)return null;const text=atob(r.data),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);return new Blob([bytes],{type:r.type});}
async function decodeAssets(value){async function check(imageBlob){if(!imageBlob)return;const url=URL.createObjectURL(imageBlob);try{const image=new Image();image.src=url;await image.decode();if(image.naturalWidth*image.naturalHeight>60000000)throw Error('备份图片尺寸过大');}finally{URL.revokeObjectURL(url);}}const images={};for(const k of ['wallpaper','original']){images[k]=blob(value.assets[k]);await check(images[k]);}for(const theme of value.themes)await check(blob(theme.wallpaper));return {images,themes:value.themes,history:value.state[IMPORT_HISTORY_KEY]?JSON.parse(value.state[IMPORT_HISTORY_KEY]):null};}
export async function captureBackup(appVersion='0.5.1'){
 const state={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(allowedKey(k))state[k]=localStorage.getItem(k);}
 if(window.CourseCompass?.getWidgetConfigs){const widgets=JSON.parse(window.CourseCompass.getWidgetConfigs());if(widgets.length)state['course-compass.widget-presets.v1']=JSON.stringify(widgets);}
 const {images,themes,history}=await readAssets();if(history)state[IMPORT_HISTORY_KEY]=JSON.stringify(history);return validatePackage({format:'course-compass.backup',version:1,appVersion,createdAt:new Date().toISOString(),state,assets:{wallpaper:await resource(images.wallpaper),original:await resource(images.original)},themes});
}
export async function maybeCreateUpgradeBackup(version){
 if(!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(version))throw Error('应用版本无效');
 const previous=await recoveryRecord('app-version');if(previous===version)return false;
 const backup=await captureBackup(typeof previous==='string'?previous:'升级前本机数据'),hasData=Object.keys(backup.state).length>0||backup.assets.wallpaper||backup.assets.original||backup.themes.length;
 const snapshot=hasData?{version:1,fromVersion:typeof previous==='string'?previous:null,toVersion:version,createdAt:new Date().toISOString(),backup}:null;
 await commitUpgradeSnapshot(version,snapshot);return !!snapshot;
}
export async function createUpgradeRecovery(targetVersion){
 if(!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(targetVersion))throw Error('目标版本无效');
 const previous=await recoveryRecord('app-version'),backup=await captureBackup(typeof previous==='string'?previous:'0.5.1');
 const snapshot={version:1,fromVersion:typeof previous==='string'?previous:null,toVersion:targetVersion,createdAt:new Date().toISOString(),backup};
 await writeRecoveryRecord('upgrade-backup',snapshot);return snapshot;
}
export function setupPackages({notify,openSheet,refreshAppearance}){
 let pending=null,pendingURL=null,busy=false;
 function error(e){$('#package-error').textContent=e.message;notify(e.message);}
 async function apply(value,full=false){
  if(busy)return;busy=true;$('#package-apply').disabled=true;
  const oldSchool=localStorage.getItem('course-compass.school.v1')||'{"id":"gzist-zfsoft"}';let switched=false;
  try{const assets=await decodeAssets(value),keys=[...new Set([...STATE_KEYS,...Object.keys(value.state),...Object.keys(localStorage).filter(allowedKey)])];
   const config=value.state['course-compass.school.v1']||'{"id":"gzist-zfsoft"}';if(full&&window.CourseCompass?.setSchool){if(!window.CourseCompass.setSchool(config))throw Error('学校配置无法恢复，未替换本机数据');switched=true;}
   await commitRestore(value.state,assets,keys);switched=false;
   if(full&&window.CourseCompass?.getWidgetConfigs&&window.CourseCompass?.setWidgetConfig){const ids=new Set(JSON.parse(window.CourseCompass.getWidgetConfigs()).map(x=>x.id)),presets=JSON.parse(value.state['course-compass.widget-presets.v1']||'[]');for(const w of presets)if(ids.has(w.id))window.CourseCompass.setWidgetConfig(w.id,JSON.stringify(w));}
   if(full){notify('完整备份已恢复，正在重新打开课间');location.reload();}
   else {await refreshAppearance();$('#package-preview').hidden=true;pending=null;notify('主题已应用，课表和个人记录已保留');}
  }catch(e){if(switched)window.CourseCompass.setSchool(oldSchool);error(e);}finally{busy=false;$('#package-apply').disabled=false;}
 }
 async function preview(raw){
  const value=validatePackage(raw);pending=value;$('#package-error').textContent='';$('#package-preview').hidden=false;
  const full=value.format==='course-compass.backup',state=full?value.state:{},schedule=state['course-compass.v1']?JSON.parse(state['course-compass.v1']):null;
  $('#package-summary').textContent=full?`完整备份 · ${schedule?.courses.length||0} 条课程 · ${value.themes.length} 套主题 · ${value.assets.wallpaper?'含壁纸':'默认壁纸'}。确认恢复会替换本机课表、个人记录与外观。学校登录会话和系统权限不包含在备份中。`:`主题「${value.name}」 · ${value.stickers.length} 个贴纸。只更新外观和贴纸，保留你的课表、留言、倒数日、快捷入口及个人记录。`;
  if(pendingURL)URL.revokeObjectURL(pendingURL);pendingURL=null;const wallpaper=full?value.assets.wallpaper:value.wallpaper;
  $('#package-picture').hidden=!wallpaper;if(wallpaper){pendingURL=URL.createObjectURL(blob(wallpaper));$('#package-picture').src=pendingURL;await $('#package-picture').decode();}
  $('#package-apply').textContent=full?'确认恢复完整备份':'应用这个主题';openSheet('#backup-sheet');
 }
 $('#package-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>MAX_PACKAGE)throw Error('文件超过64MB');await preview(JSON.parse(await file.text()));}catch(err){pending=null;$('#package-preview').hidden=true;error(err);}};
 $('#package-apply').onclick=async()=>{if(!pending)return;try{const value=pending.format==='course-compass.theme'?mergeTheme(await captureBackup(),pending):pending;await apply(value,pending.format==='course-compass.backup');}catch(e){error(e);}};
 $('#package-cancel').onclick=()=>{pending=null;$('#package-preview').hidden=true;if(pendingURL)URL.revokeObjectURL(pendingURL);pendingURL=null;};
 $('#package-import').onclick=()=>$('#package-file').click();
 $('#package-export').onclick=async()=>{try{notify('正在打包课表、原图和设置…');downloadText('课间-完整备份-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(await captureBackup()));}catch(e){error(e);}};
 const recovery=document.createElement('section');recovery.className='import-summary';recovery.id='upgrade-recovery';recovery.innerHTML='<h3>升级前恢复点</h3><p id="upgrade-recovery-description" class="sheet-tip">正在查看本机恢复点…</p><div class="package-actions"><button id="upgrade-recovery-download" disabled>导出恢复点</button><button id="upgrade-recovery-restore" disabled>查看并恢复</button></div>';$('#backup-sheet').append(recovery);
 async function refreshRecovery(){try{const record=await recoveryRecord('upgrade-backup'),has=!!record?.backup;$('#upgrade-recovery-description').textContent=has?`${record.fromVersion?'版本 '+record.fromVersion+' 升级前':'升级前本机数据'} · ${new Date(record.createdAt).toLocaleString()}。本机只保留最近一次升级恢复点，恢复前可先导出当前完整备份。`:'首次安装还没有升级恢复点。有本机数据时，下次版本升级会自动保留一份。';for(const id of ['#upgrade-recovery-download','#upgrade-recovery-restore'])$(id).disabled=!has;return record;}catch(e){$('#upgrade-recovery-description').textContent='恢复点暂时无法读取：'+e.message;return null;}}
 $('#upgrade-recovery-download').onclick=async()=>{try{const record=await refreshRecovery();if(record?.backup)downloadText('课间-升级前恢复点-'+record.createdAt.slice(0,10)+'.json',JSON.stringify(validatePackage(record.backup)));}catch(e){error(e);}};
 $('#upgrade-recovery-restore').onclick=async()=>{try{const record=await refreshRecovery();if(record?.backup)await preview(record.backup);}catch(e){error(e);}};
 refreshRecovery();
 const builtins=[['晴空玻璃',{wallpaper:'sky',accent:'#368bc1',opacity:88,font:'system'},'glass'],['薄荷森林',{wallpaper:'mint',accent:'#579b8e',opacity:88,font:'rounded'},'glass'],['夜航像素',{wallpaper:'night',accent:'#81c7ba',dark:true,opacity:94,font:'mono'},'pixel']].map(([name,appearance,style])=>validateTheme({format:'course-compass.theme',version:1,name,appearance:validateAppearance(appearance),stickers:[],widgetStyle:{style}}));
 async function renderThemes(){const {themes}=await readAssets();$('#theme-list').innerHTML=[...builtins,...themes].map((t,i)=>`<div class="theme-tile"><span class="theme-dot" style="background:${t.appearance.accent}"></span><div><b>${E(t.name)}</b><small>${i<3?'课间预设':t.stickers.length+'个贴纸 · 我的主题'}</small></div><button type="button" data-theme-use="${i}">应用</button>${i>=3?`<button type="button" data-theme-delete="${E(t.name)}" aria-label="删除${E(t.name)}">删除</button>`:''}</div>`).join('');return [...builtins,...themes];}
 async function currentTheme(){return themeFromBackup(await captureBackup(),$('#theme-name').value.trim()||'我的主题');}
 $('#theme-save').onclick=async()=>{try{await saveTheme(await currentTheme());await renderThemes();notify('已保存到本机主题库');}catch(e){notify(e.message);}};
 $('#theme-export').onclick=async()=>{try{const theme=await currentTheme();downloadText('课间-主题-'+theme.name.replace(/[\\/]/g,'_')+'.json',JSON.stringify(theme));}catch(e){notify(e.message);}};
 $('#theme-import').onclick=()=>$('#package-file').click();
 $('#theme-list').onclick=async e=>{try{const use=e.target.closest('[data-theme-use]'),del=e.target.closest('[data-theme-delete]');if(del){await deleteTheme(del.dataset.themeDelete);await renderThemes();notify('已从主题库移除');}if(use){const themes=await renderThemes(),value=mergeTheme(await captureBackup(),themes[Number(use.dataset.themeUse)]);await apply(value);}}catch(err){notify(err.message);}};
 document.addEventListener('click',async e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='packages'){refreshRecovery();openSheet('#backup-sheet');}if(action==='themes'){try{await renderThemes();openSheet('#themes-sheet');}catch(err){notify(err.message);}}});
 return {preview,refreshRecovery};
}
