package cn.coursecompass.app;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import java.lang.ref.WeakReference;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Owns the Android planner data and its one-shot queue, even without a WebView. */
final class PlannerReminders {
 static final String CHANNEL="personal_planner_v1";
 static final String ACTION_DUE="cn.coursecompass.app.PLANNER_DUE";
 static final String ACTION_OPEN="cn.coursecompass.app.OPEN_PLANNER";
 private static final String EMPTY="{\"version\":1,\"entries\":[]}";
 private static final String MODEL="planner-model", SCHEDULE="schedule";
 private static final String NOTIFICATION_KEYS="cn.coursecompass.app.planner-keys";
 static final String EXTRA_AT="planner-reminder-at";
 private static final int EXACT_ALARM=6411, OPEN=6412, NOTIFICATION=6413, FALLBACK_ALARM=6414, CLOCK_OPEN=6415, TEST_NOTIFICATION=6416, HANDOFF_ALARM=6417;
 private static final android.os.Handler main=new android.os.Handler(android.os.Looper.getMainLooper());
 private static volatile Context appContext;
 private static final Runnable retryInProcess=()->{Context context=appContext;if(context!=null)refreshFromWake(context,false);};
 private static WeakReference<MainActivity> foreground=new WeakReference<>(null);
 private static Set<String> recentPost=Collections.emptySet();
 private static long recentPostAt;
 private static long registeredAt,registeredBackupAt;
 private static String registeredMode="none";

 private static SharedPreferences prefs(Context c){return c.getSharedPreferences("personal-planner",Context.MODE_PRIVATE);}

 static synchronized void setForeground(MainActivity activity,boolean ready){
  if(ready)foreground=new WeakReference<>(activity);
  else if(foreground.get()==activity)foreground.clear();
 }

 static synchronized String status(Context c){
  try{
   NotificationManager manager=c.getSystemService(NotificationManager.class);
   NotificationChannel channel=manager.getNotificationChannel(CHANNEL);
   boolean allowed=notificationsAllowed(c,manager,channel);
   SharedPreferences saved=prefs(c);
   JSONObject status=new JSONObject().put("notifications",allowed).put("exact",CourseCompanion.exactAllowed(c))
     .put("headsUp",allowed&&(channel==null||channel.getImportance()>=NotificationManager.IMPORTANCE_HIGH))
     .put("nextAt",PlannerQueue.nextAt(read(c),System.currentTimeMillis()))
     .put("alarmAt",saved.getLong("alarm-at",0)).put("alarmMode",saved.getString("alarm-mode","none"))
     .put("retryAt",saved.getLong("retry-at",0))
     .put("lastWakeAt",saved.getLong("last-wake-at",0)).put("lastSystemAt",saved.getLong("last-system-at",0))
     .put("lastPopupAt",saved.getLong("last-popup-at",0))
     .put("backgroundRestricted",Build.VERSION.SDK_INT>=28&&c.getSystemService(ActivityManager.class).isBackgroundRestricted());
   for(PlannerQueue.Entry row:read(c))if(row.isTest()){
    status.put("testAt",row.at).put("testSent",row.delivered)
      .put("testSource",saved.getString("test-source",""));
    break;
   }
   return status.toString();
  }catch(Exception failure){return "null";}
 }

 private static boolean notificationsAllowed(Context c,NotificationManager manager,NotificationChannel channel){
  return manager.areNotificationsEnabled()
    &&(channel==null||channel.getImportance()!=NotificationManager.IMPORTANCE_NONE)
    &&(Build.VERSION.SDK_INT<33||c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED);
 }

 static void ensureChannel(Context c){
  NotificationChannel channel=new NotificationChannel(CHANNEL,"日程提醒",NotificationManager.IMPORTANCE_HIGH);
  channel.setDescription("在你设置的时间通知你，可在系统设置调整横幅和声音");
  channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
  c.getSystemService(NotificationManager.class).createNotificationChannel(channel);
 }

 static synchronized boolean replace(Context c,String text,String savedId,long savedAt){
  try{
   Set<String> history=new HashSet<>();
   List<PlannerQueue.Entry> model=parse(text,false,history),incoming=new ArrayList<>(),previous;
   for(PlannerQueue.Entry row:model)if(!history.contains(row.id))incoming.add(row);
   try{previous=read(c);}catch(Exception corrupt){previous=new ArrayList<>();}
   List<PlannerQueue.Entry> updated=PlannerQueue.replace(previous,incoming,System.currentTimeMillis(),savedId,savedAt);
   JSONArray publicRows=encode(model,false);
   for(int i=0;i<model.size();i++)if(history.contains(model.get(i).id))publicRows.getJSONObject(i).put("historical",true);
   String value=new JSONObject().put("version",1).put("entries",publicRows).toString();
   // Commit both copies in one write. Stale WebView cache cannot undo a successful save.
   if(!prefs(c).edit().putString(MODEL,value).putString(SCHEDULE,queueJson(updated)).commit())return false;
   try{reconcileNotification(c,previous,updated);}catch(Exception unavailable){Log.w("CourseCompassPlanner","Could not update the visible notification");}
   // The system alarm must be registered before the WebView reports a saved plan.
   refresh(c);
   return true;
  }catch(Exception invalid){return false;}
 }

 static synchronized String model(Context c){return prefs(c).getString(MODEL,"null");}

 static synchronized String peekForeground(Activity activity){
  if(foreground.get()!=activity)return "[]";
  try{
   return encode(PlannerQueue.foregroundDue(read(activity),System.currentTimeMillis()),false).toString();
  }catch(Exception error){Log.w("CourseCompassPlanner","Could not read foreground reminders");}
  return "[]";
 }

 static synchronized boolean acknowledgeForeground(Activity activity,String text){
  if(foreground.get()!=activity||text==null||text.length()>12000)return false;
  try{
   JSONArray data=new JSONArray(text);
   if(data.length()<1||data.length()>PlannerQueue.MAX_ENTRIES)return false;
   Set<String> keys=new HashSet<>();
   for(int i=0;i<data.length();i++)keys.add(string(data.get(i)));
   List<PlannerQueue.Entry> rows=read(activity);
   long now=System.currentTimeMillis();
   if(PlannerQueue.selectByKey(PlannerQueue.foregroundDue(rows,now),keys).isEmpty())return false;
   if(!write(activity,PlannerQueue.acknowledge(rows,keys,now)))return false;
   prefs(activity).edit().putLong("last-popup-at",now).apply();
   refresh(activity);
   return true;
  }catch(Exception invalid){return false;}
 }

 static synchronized long startTest(Context c){
  try{
   ensureChannel(c);
   NotificationManager manager=c.getSystemService(NotificationManager.class);
   if(!notificationsAllowed(c,manager,manager.getNotificationChannel(CHANNEL)))return 0;
   long at=System.currentTimeMillis()+60000;
   if(!write(c,PlannerQueue.withTest(read(c),at)))return 0;
   prefs(c).edit().remove("test-source").apply();
   manager.cancel(TEST_NOTIFICATION);
   refresh(c);
   SharedPreferences saved=prefs(c);
   return saved.getLong("alarm-at",0)>0?at:0;
  }catch(Exception unavailable){return 0;}
 }

 static synchronized void onAlarm(Context c){
  prefs(c).edit().putLong("last-wake-at",System.currentTimeMillis()).apply();
  refreshFromWake(c,true);
 }

 private static synchronized void refreshFromWake(Context c,boolean systemWake){
  refresh(c,systemWake);
  MainActivity active=foreground.get();
  if(active!=null)active.runOnUiThread(active::plannerChanged);
 }

 static synchronized void refresh(Context c){
  refresh(c,false);
 }

 private static void refresh(Context c,boolean systemWake){
  try{
   List<PlannerQueue.Entry> rows=read(c);
   long now=System.currentTimeMillis();
   ensureChannel(c);
   NotificationManager manager=c.getSystemService(NotificationManager.class);
   boolean allowed=notificationsAllowed(c,manager,manager.getNotificationChannel(CHANNEL));
   boolean inApp=foreground.get()!=null;
   List<PlannerQueue.Entry> due=PlannerQueue.systemDue(rows,now,inApp,allowed);
   List<PlannerQueue.Entry> sent=new ArrayList<>(),normal=new ArrayList<>();
   for(PlannerQueue.Entry row:due)if(!row.isTest())normal.add(row);else try{
    manager.notify(TEST_NOTIFICATION,notification(c,Collections.singletonList(row),true));
    sent.add(row);
   }catch(SecurityException revoked){/* Keep pending. */}
   if(!normal.isEmpty())try{
    Set<String> active=activeKeys(manager);
    boolean buzz=active.addAll(PlannerQueue.keys(normal));
    postNormal(c,manager,PlannerQueue.selectByKey(rows,active),buzz);
    sent.addAll(normal);
   }catch(SecurityException revoked){/* Keep pending. */}
   if(!sent.isEmpty()&&write(c,PlannerQueue.markDelivered(rows,sent))){
    rows=PlannerQueue.markDelivered(rows,sent);
    SharedPreferences.Editor log=prefs(c).edit().putLong("last-system-at",now);
    for(PlannerQueue.Entry row:sent)if(row.isTest()){
     log.putString("test-source",systemWake?(inApp?"alarm-visible":"alarm-background"):"refresh");
     break;
    }
    log.apply();
   }
   boolean exact=CourseCompanion.exactAllowed(c);
   PlannerQueue.AlarmPlan plan=PlannerQueue.alarmPlan(rows,now,allowed&&exact,inApp,allowed);
   scheduleNext(c,plan);
   scheduleRetry(c,plan.retryAt,exact);
  }catch(Exception error){
   logAlarm(c,0,"error");
   Log.w("CourseCompassPlanner","Could not refresh reminder schedule: "+error.getClass().getSimpleName());
  }
 }

 private static void scheduleNext(Context c,PlannerQueue.AlarmPlan plan){
  AlarmManager alarms=c.getSystemService(AlarmManager.class);
  // Android revokes exact alarms when special access is removed. A separate inexact
  // wake-up survives that change, and also works if notifications are enabled later.
  if(plan.exactAt>0){
   long at=plan.exactAt;
   if(registeredAt==at&&registeredBackupAt==plan.fallbackAt&&"clock".equals(registeredMode)){
    logAlarm(c,at,"clock");
    return;
   }
   try{
    PendingIntent operation=alarm(c,EXACT_ALARM,true);
    alarms.setAlarmClock(new AlarmManager.AlarmClockInfo(at,open(c,CLOCK_OPEN,at)),operation);
    long backup=0;
    try{alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,plan.fallbackAt,alarm(c,FALLBACK_ALARM,true));backup=plan.fallbackAt;}
    catch(RuntimeException unavailable){Log.w("CourseCompassPlanner","Ordinary backup could not be registered");}
    rememberAlarm(c,at,backup,"clock");
    return;
   }catch(RuntimeException revoked){
    cancel(c,alarms,EXACT_ALARM);
    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,alarm(c,FALLBACK_ALARM,true));
    rememberAlarm(c,at,at,"ordinary");
    return;
   }
  }
  cancel(c,alarms,EXACT_ALARM);
  if(plan.fallbackAt>0){
   if(registeredAt!=plan.fallbackAt||!"ordinary".equals(registeredMode))
    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,plan.fallbackAt,alarm(c,FALLBACK_ALARM,true));
   rememberAlarm(c,plan.fallbackAt,plan.fallbackAt,"ordinary");
  }else{cancel(c,alarms,FALLBACK_ALARM);rememberAlarm(c,0,0,"none");}
 }

 private static void rememberAlarm(Context c,long at,long backup,String mode){
  registeredAt=at;registeredBackupAt=backup;registeredMode=mode;
  logAlarm(c,at,mode);
 }

 private static void scheduleRetry(Context c,long retryAt,boolean exact){
  AlarmManager alarms=c.getSystemService(AlarmManager.class);
  main.removeCallbacks(retryInProcess);
  if(retryAt<=0)cancel(c,alarms,HANDOFF_ALARM);
  else{
   appContext=c.getApplicationContext();
   PendingIntent pending=alarm(c,HANDOFF_ALARM,true);
   // Also retain a real OS wake-up if this process disappears during the hand-off.
   try{
    if(exact)alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,retryAt,pending);
    else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,retryAt,pending);
   }catch(SecurityException revoked){alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,retryAt,pending);}
   if(foreground.get()!=null)main.postDelayed(retryInProcess,Math.max(0,retryAt-System.currentTimeMillis()));
  }
  SharedPreferences saved=prefs(c);
  if(retryAt!=saved.getLong("retry-at",0))saved.edit().putLong("retry-at",retryAt).apply();
 }

 private static void logAlarm(Context c,long at,String mode){
  SharedPreferences saved=prefs(c);
  if(at!=saved.getLong("alarm-at",0)||!mode.equals(saved.getString("alarm-mode","none")))
   saved.edit().putLong("alarm-at",at).putString("alarm-mode",mode).apply();
 }

 private static PendingIntent alarm(Context c,int id,boolean create){
  Intent intent=new Intent(c,CourseRefreshReceiver.class).setAction(ACTION_DUE);
  return PendingIntent.getBroadcast(c,id,intent,PendingIntent.FLAG_IMMUTABLE|(create?PendingIntent.FLAG_UPDATE_CURRENT:PendingIntent.FLAG_NO_CREATE));
 }

 private static void cancel(Context c,AlarmManager alarms,int id){
  PendingIntent existing=alarm(c,id,false);
  if(existing!=null)alarms.cancel(existing);
 }

 private static Set<String> activeKeys(NotificationManager manager){
  Set<String> keys=new HashSet<>();
  for(StatusBarNotification item:manager.getActiveNotifications()){
   if(item.getId()==NOTIFICATION){
    String[] saved=item.getNotification().extras.getStringArray(NOTIFICATION_KEYS);
    if(saved!=null)Collections.addAll(keys,saved);
   }
  }
  if(android.os.SystemClock.elapsedRealtime()-recentPostAt<1500)keys.addAll(recentPost);
  return keys;
 }

 private static void postNormal(Context c,NotificationManager manager,List<PlannerQueue.Entry> rows,boolean buzz){
  manager.notify(NOTIFICATION,notification(c,rows,buzz));
  recentPost=PlannerQueue.keys(rows);
  recentPostAt=android.os.SystemClock.elapsedRealtime();
 }

 private static void reconcileNotification(Context c,List<PlannerQueue.Entry> previous,List<PlannerQueue.Entry> current)throws Exception{
  NotificationManager manager=c.getSystemService(NotificationManager.class);
  Set<String> keys=activeKeys(manager);
  if(keys.isEmpty())return;
  List<PlannerQueue.Entry> stillActive=PlannerQueue.selectByKey(current,keys);
  if(stillActive.isEmpty()){manager.cancel(NOTIFICATION);recentPost=Collections.emptySet();}
  else if(!encode(stillActive,false).toString().equals(encode(PlannerQueue.selectByKey(previous,keys),false).toString()))
   postNormal(c,manager,stillActive,false);
 }

 private static PendingIntent open(Context c,int code,long at){
  Intent intent=new Intent(c,MainActivity.class).setAction(ACTION_OPEN)
    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra(EXTRA_AT,at);
  return PendingIntent.getActivity(c,code,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
 }

 private static Notification notification(Context c,List<PlannerQueue.Entry> rows,boolean buzz){
  DateTimeFormatter clock=DateTimeFormatter.ofPattern("M月d日 HH:mm",Locale.CHINA).withZone(ZoneId.systemDefault());
  PlannerQueue.Entry latest=rows.get(rows.size()-1);
  PendingIntent open=open(c,latest.isTest()?TEST_NOTIFICATION:OPEN,latest.isTest()?0:latest.at);
  Notification publicView=new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_course_status)
    .setContentTitle("课间 · 日程提醒").setContentText("解锁后查看详情").setContentIntent(open).build();
  Bundle extras=new Bundle();
  extras.putStringArray(NOTIFICATION_KEYS,PlannerQueue.keys(rows).toArray(new String[0]));
  Notification.Builder builder=new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_course_status)
    .setWhen(latest.at).setCategory(Notification.CATEGORY_REMINDER).setContentIntent(open)
    .setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(publicView)
    .setAutoCancel(true).setOnlyAlertOnce(!buzz).addExtras(extras);
  if(rows.size()==1){
   String time=clock.format(Instant.ofEpochMilli(latest.at));
   builder.setContentTitle(latest.title).setContentText(latest.note.isEmpty()?time:latest.note)
     .setStyle(new Notification.BigTextStyle().bigText(latest.note.isEmpty()?time:time+"\n"+latest.note));
  }else{
   Notification.InboxStyle inbox=new Notification.InboxStyle().setSummaryText("点按打开日程规划");
   for(int i=rows.size()-1;i>=Math.max(0,rows.size()-6);i--){
    PlannerQueue.Entry row=rows.get(i);
    inbox.addLine(clock.format(Instant.ofEpochMilli(row.at))+" · "+row.title);
   }
   builder.setContentTitle(rows.size()+" 条日程提醒").setContentText("最新："+latest.title).setStyle(inbox);
  }
  return builder.build();
 }

 private static List<PlannerQueue.Entry> read(Context c)throws Exception{
  return parse(prefs(c).getString(SCHEDULE,EMPTY),true,null);
 }

 private static String queueJson(List<PlannerQueue.Entry> rows)throws Exception{
  return new JSONObject().put("version",1).put("entries",encode(rows,true)).toString();
 }

 private static boolean write(Context c,List<PlannerQueue.Entry> rows)throws Exception{
  String value=queueJson(rows);
  SharedPreferences pref=prefs(c);
  return value.equals(pref.getString(SCHEDULE,EMPTY))||pref.edit().putString(SCHEDULE,value).commit();
 }

 private static JSONArray encode(List<PlannerQueue.Entry> rows,boolean withReceipts)throws Exception{
  JSONArray data=new JSONArray();
  for(PlannerQueue.Entry row:rows){
   JSONObject item=new JSONObject().put("id",row.id).put("title",row.title).put("note",row.note).put("at",row.at);
   if(withReceipts)item.put("delivered",row.delivered);
   data.put(item);
  }
  return data;
 }

 private static List<PlannerQueue.Entry> parse(String text,boolean withReceipts,Set<String> history)throws Exception{
  if(text==null||text.length()>350_000)throw new IllegalArgumentException("Planner snapshot size");
  JSONObject root=new JSONObject(text);
  Object version=root.get("version");
  if(!(version instanceof Number)||((Number)version).doubleValue()!=1)throw new IllegalArgumentException("Planner version");
  JSONArray data=root.getJSONArray("entries");
  if(data.length()>PlannerQueue.MAX_ENTRIES+(withReceipts?1:0))throw new IllegalArgumentException("Planner entry limit");
  List<PlannerQueue.Entry> rows=new ArrayList<>();
  Set<String> ids=new HashSet<>();
  for(int i=0;i<data.length();i++){
   JSONObject item=data.getJSONObject(i);
   String id=string(item.get("id")),title=string(item.get("title")),note=string(item.get("note"));
   Object number=item.get("at");
   if(!(number instanceof Number))throw new IllegalArgumentException("Planner time");
   long at=((Number)number).longValue();
   if(((Number)number).doubleValue()!=at||at<=0||at>=PlannerQueue.MAX_AT||(!id.matches("[a-z0-9-]{1,64}")&&!(withReceipts&&PlannerQueue.TEST_ID.equals(id)))||!ids.add(id)
     ||title.trim().isEmpty()||title.length()>80||title.chars().anyMatch(ch->ch<32||ch==127)||note.length()>400)throw new IllegalArgumentException("Planner entry");
   if(history!=null&&item.has("historical")){
    Object historical=item.get("historical");
    if(!(historical instanceof Boolean))throw new IllegalArgumentException("Planner history type");
    if(Boolean.TRUE.equals(historical))history.add(id);
   }
   rows.add(new PlannerQueue.Entry(id,title,note,at,withReceipts&&item.optBoolean("delivered")));
  }
  return rows;
 }

 private static String string(Object value){
  if(!(value instanceof String))throw new IllegalArgumentException("Planner field type");
  return (String)value;
 }
}
