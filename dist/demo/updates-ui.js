import {APP_VERSION,REPOSITORY,RELEASES_URL,compareVersions,selectRelease} from '../core/updates.js';
import {createUpgradeRecovery} from './packages-ui.js';
const $=s=>document.querySelector(s);
export function setupUpdates({notify,openSheet}){
 $('#installed-version').textContent='课间 '+APP_VERSION;$('#release-page').href=RELEASES_URL;let running=false;
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 let waiting=null,activating=false;
 if('serviceWorker' in navigator&&!window.CourseCompass){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(activating)location.reload();});
  navigator.serviceWorker.ready.then(reg=>{
   const show=()=>{waiting=reg.waiting;$('#web-update').hidden=!waiting;};show();
   reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',show);});
   $('#web-update').onclick=async()=>{if(!waiting)return;$('#web-update').disabled=true;try{await createUpgradeRecovery(APP_VERSION);activating=true;waiting.postMessage({type:'ACTIVATE_UPDATE'});}catch(e){$('#web-update').disabled=false;notify('网页更新前恢复点未保存：'+e.message);}};
  }).catch(()=>{});
 }
 $('#update-platform').textContent=ios?'iPhone / iPad 使用主屏幕网页。网页有新版本时，可点「更新网页并重新打开」。安卓安装包仅供 Android 使用。':'安卓下载后直接覆盖安装，不要先卸载。仅从本项目 GitHub Releases 打开下载，不自动安装。';
 const download=$('#update-download');download.dataset.managedDownload='true';let downloading=false;
 download.onclick=async event=>{event.preventDefault();event.stopPropagation();if(downloading||download.hidden)return;downloading=true;download.setAttribute('aria-disabled','true');try{const target=download.dataset.version,url=download.href;await createUpgradeRecovery(target);notify('升级前恢复点已保存，正在打开安装包');if(window.CourseCompass?.openLink)window.CourseCompass.openLink(url);else location.assign(url);}catch(e){notify('恢复点未保存：'+e.message+'。可先导出完整备份，或打开 GitHub 版本页下载。');}finally{downloading=false;download.removeAttribute('aria-disabled');}};
 async function check(){if(running)return;running=true;$('#update-check').disabled=true;$('#update-status').textContent='正在查询 GitHub 版本…';$('#update-download').hidden=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch('https://api.github.com/repos/'+REPOSITORY+'/releases?per_page=30',{signal:controller.signal,credentials:'omit',headers:{Accept:'application/vnd.github+json'}});if(!response.ok)throw Error(response.status===403||response.status===429?'GitHub 暂时限制查询，请稍后重试':'版本查询失败：HTTP '+response.status);const release=selectRelease(await response.json(),$('#update-preview').checked);if(!release){$('#update-status').textContent='当前渠道没有可下载的版本，可打开版本页查看。';$('#update-notes').textContent='';return;}
   const newer=compareVersions(release.version,APP_VERSION)>0;$('#update-status').textContent=(newer?'发现新版本：':'当前已是此渠道最新版本。GitHub 版本：')+release.version+(release.preview?' · 预览版':'')+' · '+(release.size/1024/1024).toFixed(1)+' MB';$('#update-notes').textContent=release.body;$('#update-sha').textContent=release.sha256?'SHA-256：'+release.sha256:'该版本未返回校验值，请在 GitHub 版本页核对。';const link=$('#update-download');link.href=release.download;link.dataset.version=release.version;link.hidden=!newer||ios;link.textContent='下载 '+release.version+' 安装包';
  }catch(e){$('#update-status').textContent=e.name==='AbortError'?'网络连接超时，稍后可重试；本机课表不受影响。':e.message;$('#update-notes').textContent='';}finally{clearTimeout(timer);running=false;$('#update-check').disabled=false;}
 }
 $('#update-check').onclick=check;$('#update-preview').onchange=check;
 document.addEventListener('click',e=>{if(e.target.closest('[data-action="updates"]')){openSheet('#updates-sheet');check();}});
}
