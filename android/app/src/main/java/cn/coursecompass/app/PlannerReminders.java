package cn.coursecompass.app;

import android.Manifest;
import android.app.Activity;
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

/** Persists a local mirror of the planner so alarms can run without a WebView. */
final class PlannerReminders {
 static final String CHANNEL="personal_planner_v1";
 static final String ACTION_DUE="cn.coursecompass.app.PLANNER_DUE";
 static final String ACTION_OPEN="cn.coursecompass.app.OPEN_PLANNER";
 private static final String EMPTY="{\"version\":1,\"entries\":[]}";
 private static final String NOTIFICATION_KEYS="cn.coursecompass.app.planner-keys";
 private static final int EXACT_ALARM=6411, OPEN=6412, NOTIFICATION=6413, FALLBACK_ALARM=6414;
 private static WeakReference<Activity> foreground=new WeakReference<>(null);

 private static SharedPreferences prefs(Context c){return c.getSharedPreferences("personal-planner",Context.MODE_PRIVATE);}

 static synchronized void setForeground(Activity activity,boolean ready){
  if(ready)foreground=new WeakReference<>(activity);
  else if(foreground.get()==activity)foreground.clear();
 }

 static String status(Context c){
  try{
   NotificationManager manager=c.getSystemService(NotificationManager.class);
   NotificationChannel channel=manager.getNotificationChannel(CHANNEL);
   boolean allowed=notificationsAllowed(c,manager,channel);
   return new JSONObject().put("notifications",allowed).put("exact",CourseCompanion.exactAllowed(c))
     .put("headsUp",allowed&&(channel==null||channel.getImportance()>=NotificationManager.IMPORTANCE_HIGH)).toString();
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
   List<PlannerQueue.Entry> incoming=parse(text,false),previous;
   try{previous=read(c);}catch(Exception corrupt){previous=new ArrayList<>();}
   List<PlannerQueue.Entry> updated=PlannerQueue.replace(previous,incoming,System.currentTimeMillis(),savedId,savedAt);
   if(!write(c,updated))return false;
   try{reconcileNotification(c,previous,updated);}catch(Exception unavailable){Log.w("CourseCompassPlanner","Could not update the visible notification");}
   return true;
  }catch(Exception invalid){return false;}
 }

 static synchronized String takeForeground(Activity activity){
  if(foreground.get()!=activity)return "[]";
  try{
   List<PlannerQueue.Entry> rows=read(activity);
   List<PlannerQueue.Entry> due=PlannerQueue.due(rows,System.currentTimeMillis());
   if(!due.isEmpty()){
    JSONArray result=encode(due,false);
    if(write(activity,PlannerQueue.markDelivered(rows,due)))return result.toString();
   }
  }catch(Exception error){Log.w("CourseCompassPlanner","Could not claim foreground reminders");}
  return "[]";
 }

 static synchronized void refresh(Context c){
  try{
   List<PlannerQueue.Entry> rows=read(c);
   long now=System.currentTimeMillis();
   ensureChannel(c);
   NotificationManager manager=c.getSystemService(NotificationManager.class);
   boolean allowed=notificationsAllowed(c,manager,manager.getNotificationChannel(CHANNEL));
   if(allowed&&foreground.get()==null){
    List<PlannerQueue.Entry> due=PlannerQueue.due(rows,now);
    if(!due.isEmpty()){
     Set<String> active=activeKeys(manager);
     boolean buzz=active.addAll(PlannerQueue.keys(due));
     try{
      manager.notify(NOTIFICATION,notification(c,PlannerQueue.selectByKey(rows,active),buzz));
      rows=PlannerQueue.markDelivered(rows,due);
      write(c,rows);
     }catch(SecurityException revoked){/* Keep the receipt pending if permission changed. */}
    }
   }
   schedule(c,PlannerQueue.alarmPlan(rows,now,allowed&&CourseCompanion.exactAllowed(c)));
  }catch(Exception error){Log.w("CourseCompassPlanner","Could not refresh reminder schedule");}
 }

 private static void schedule(Context c,PlannerQueue.AlarmPlan plan){
  AlarmManager alarms=c.getSystemService(AlarmManager.class);
  // Android revokes exact alarms when special access is removed. A separate inexact
  // wake-up survives that change, and also works if notifications are enabled later.
  long fallback=plan.fallbackAt;
  if(fallback>0)alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,fallback,alarm(c,FALLBACK_ALARM,true));
  else cancel(c,alarms,FALLBACK_ALARM);
  if(plan.exactAt>0){
   try{alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,plan.exactAt,alarm(c,EXACT_ALARM,true));return;}
   catch(SecurityException revoked){alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,plan.exactAt,alarm(c,FALLBACK_ALARM,true));}
  }
  cancel(c,alarms,EXACT_ALARM);
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
  return keys;
 }

 private static void reconcileNotification(Context c,List<PlannerQueue.Entry> previous,List<PlannerQueue.Entry> current)throws Exception{
  NotificationManager manager=c.getSystemService(NotificationManager.class);
  Set<String> keys=activeKeys(manager);
  if(keys.isEmpty())return;
  List<PlannerQueue.Entry> stillActive=PlannerQueue.selectByKey(current,keys);
  if(stillActive.isEmpty())manager.cancel(NOTIFICATION);
  else if(!encode(stillActive,false).toString().equals(encode(PlannerQueue.selectByKey(previous,keys),false).toString()))
   manager.notify(NOTIFICATION,notification(c,stillActive,false));
 }

 private static Notification notification(Context c,List<PlannerQueue.Entry> rows,boolean buzz){
  Intent intent=new Intent(c,MainActivity.class).setAction(ACTION_OPEN)
    .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
  PendingIntent open=PendingIntent.getActivity(c,OPEN,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  DateTimeFormatter clock=DateTimeFormatter.ofPattern("M月d日 HH:mm",Locale.CHINA).withZone(ZoneId.systemDefault());
  PlannerQueue.Entry latest=rows.get(rows.size()-1);
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
  return parse(prefs(c).getString("schedule",EMPTY),true);
 }

 private static boolean write(Context c,List<PlannerQueue.Entry> rows)throws Exception{
  String value=new JSONObject().put("version",1).put("entries",encode(rows,true)).toString();
  SharedPreferences pref=prefs(c);
  return value.equals(pref.getString("schedule",EMPTY))||pref.edit().putString("schedule",value).commit();
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

 private static List<PlannerQueue.Entry> parse(String text,boolean withReceipts)throws Exception{
  if(text==null||text.length()>350_000)throw new IllegalArgumentException("Planner snapshot size");
  JSONObject root=new JSONObject(text);
  Object version=root.get("version");
  if(!(version instanceof Number)||((Number)version).doubleValue()!=1)throw new IllegalArgumentException("Planner version");
  JSONArray data=root.getJSONArray("entries");
  if(data.length()>PlannerQueue.MAX_ENTRIES)throw new IllegalArgumentException("Planner entry limit");
  List<PlannerQueue.Entry> rows=new ArrayList<>();
  Set<String> ids=new HashSet<>();
  for(int i=0;i<data.length();i++){
   JSONObject item=data.getJSONObject(i);
   String id=string(item.get("id")),title=string(item.get("title")),note=string(item.get("note"));
   Object number=item.get("at");
   if(!(number instanceof Number))throw new IllegalArgumentException("Planner time");
   long at=((Number)number).longValue();
   if(((Number)number).doubleValue()!=at||at<=0||at>=PlannerQueue.MAX_AT||!id.matches("[a-z0-9-]{1,64}")||!ids.add(id)
     ||title.trim().isEmpty()||title.length()>80||title.chars().anyMatch(ch->ch<32||ch==127)||note.length()>400)throw new IllegalArgumentException("Planner entry");
   rows.add(new PlannerQueue.Entry(id,title,note,at,withReceipts&&item.optBoolean("delivered")));
  }
  return rows;
 }

 private static String string(Object value){
  if(!(value instanceof String))throw new IllegalArgumentException("Planner field type");
  return (String)value;
 }
}
