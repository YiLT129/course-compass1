const $=s=>document.querySelector(s);
export function setupCompanion({notify,openSheet}){
 function refresh(){const native=window.CourseCompass,available=!!native?.getCompanionStatus;let status={};try{if(available)status=JSON.parse(native.getCompanionStatus());}catch{}
 $('#companion-status').textContent=available?`${status.enabled?'锁屏提示已开启':'锁屏提示未开启'} · ${status.notifications?'通知已允许':'通知未允许'}\n${status.exact?'按课程时间更新已允许':'尚未允许准时更新，后台更新可能延迟'} · 已同步 ${status.count||0} 条安排`:'可先保存样式并开启「也显示在课表上方」。安卓支持桌面组件和可选锁屏通知；iPhone 网页版暂不支持系统锁屏组件。';
 $('#companion-toggle').textContent=status.enabled?'关闭锁屏课程通知':'开启锁屏课程通知';
 for(const id of ['toggle','pin','exact','settings'])$('#companion-'+id).disabled=!available;
 return status;}
 document.addEventListener('click',e=>{if(e.target.closest('[data-action="companion"]')){refresh();openSheet('#companion-sheet');}});
 $('#companion-toggle').onclick=()=>{window.CourseCompass.setCompanionEnabled(!refresh().enabled);setTimeout(refresh,200);};
 $('#companion-pin').onclick=()=>window.CourseCompass.pinCourseWidget();
 $('#companion-exact').onclick=()=>window.CourseCompass.openReminderSettings();
 $('#companion-settings').onclick=()=>window.CourseCompass.openNotificationSettings();
 window.onNativeCompanionChanged=message=>{refresh();if(message)notify(message);};
}
