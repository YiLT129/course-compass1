package cn.coursecompass.app;

import android.Manifest;
import android.app.*;
import android.appwidget.AppWidgetManager;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import android.widget.RemoteViews;
import android.util.Log;
import org.json.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Offline snapshot only. School cookies and account details never enter this store. */
final class CourseCompanion {
 static final String CHANNEL="course_status_v1",ACTION_REFRESH="cn.coursecompass.app.REFRESH_COURSES";
 static final int NOTIFICATION=6206;
 private static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("course-companion",Context.MODE_PRIVATE);}
 static boolean enabled(Context c){return prefs(c).getBoolean("enabled",false);}
 static boolean notificationsAllowed(Context c){NotificationManager manager=c.getSystemService(NotificationManager.class);NotificationChannel channel=manager.getNotificationChannel(CHANNEL);return manager.areNotificationsEnabled()&&(channel==null||channel.getImportance()!=NotificationManager.IMPORTANCE_NONE)&&(Build.VERSION.SDK_INT<33||c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED);}
 static boolean exactAllowed(Context c){return Build.VERSION.SDK_INT<31||c.getSystemService(AlarmManager.class).canScheduleExactAlarms();}
 static void enabled(Context c,boolean value){prefs(c).edit().putBoolean("enabled",value).apply();refresh(c);}
 static String status(Context c){try{JSONObject out=new JSONObject();out.put("enabled",enabled(c));out.put("notifications",notificationsAllowed(c));out.put("exact",exactAllowed(c));out.put("count",new JSONObject(prefs(c).getString("snapshot","{}")).optJSONArray("courses")==null?0:new JSONObject(prefs(c).getString("snapshot","{}")).getJSONArray("courses").length());return out.toString();}catch(Exception e){return "{}";}}
 static void update(Context c,String text)throws Exception{
  if(text==null||text.length()>1_500_000)throw new IllegalArgumentException("课程快照过大");
  JSONObject raw=new JSONObject(text);parse(raw); // Validate before replacing the last usable snapshot.
  if(!text.equals(prefs(c).getString("snapshot","")))prefs(c).edit().putString("snapshot",text).apply();
  refresh(c);
 }
 private static final class Snapshot {
  final List<ScheduleEngine.Course> courses=new ArrayList<>();final List<String> times=new ArrayList<>();LocalDate start;int weeks;
 }
 private static Snapshot parse(JSONObject raw)throws Exception{
  Snapshot s=new Snapshot();JSONObject settings=raw.getJSONObject("settings");s.start=LocalDate.parse(settings.getString("startDate"));s.weeks=settings.getInt("totalWeeks");
  if(s.start.getDayOfWeek()!=DayOfWeek.MONDAY||s.weeks<1||s.weeks>60)throw new IllegalArgumentException("学期无效");
  JSONArray times=settings.getJSONArray("times");if(times.length()!=12)throw new IllegalArgumentException("需要12节作息");LocalTime previous=null;
  for(int i=0;i<12;i++){String value=times.getString(i);if(!value.matches("[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}"))throw new IllegalArgumentException("作息无效");String[] pair=value.split("-");LocalTime a=LocalTime.parse(pair[0]),b=LocalTime.parse(pair[1]);if(!a.isBefore(b)||previous!=null&&a.isBefore(previous))throw new IllegalArgumentException("作息重叠");previous=b;s.times.add(value);}
  JSONArray courses=raw.getJSONArray("courses");if(courses.length()>1500)throw new IllegalArgumentException("课程过多");
  for(int i=0;i<courses.length();i++){JSONObject o=courses.getJSONObject(i);int day=o.getInt("day"),start=o.getInt("start"),end=o.getInt("end");String name=o.getString("name");if(name.isEmpty()||name.length()>100||day<1||day>7||start<1||end>12||end<start)throw new IllegalArgumentException("课程无效");Set<Integer> weeks=new HashSet<>();JSONArray w=o.getJSONArray("weeks");for(int k=0;k<w.length();k++){int n=w.getInt(k);if(n<1||n>60)throw new IllegalArgumentException("周次无效");weeks.add(n);}if(weeks.isEmpty())throw new IllegalArgumentException("周次为空");s.courses.add(new ScheduleEngine.Course(name,o.optString("location","地点待定"),day,start,end,weeks));}
  return s;
 }
 private static final class Display {String label="还没有课程",title="先导入你的课表",detail="在课间中导入课表后，卡片会自动更新",following="",stamp="";String style="glass",content="course";long refreshAt;}
 private static Display display(Context c,long millis)throws Exception{
  Display d=new Display();ZonedDateTime now=Instant.ofEpochMilli(millis).atZone(ScheduleEngine.ZONE);d.stamp=now.format(DateTimeFormatter.ofPattern("M月d日 HH:mm"))+" 更新";
  String text=prefs(c).getString("snapshot",null);if(text==null)return d;Snapshot s=parse(new JSONObject(text));
  ScheduleEngine.Result result=ScheduleEngine.evaluate(s.courses,s.start,s.weeks,s.times,Instant.ofEpochMilli(millis));d.refreshAt=result.refreshAt;
  long midnight=now.toLocalDate().plusDays(1).atStartOfDay(ScheduleEngine.ZONE).toInstant().toEpochMilli();if(d.refreshAt==0||d.refreshAt>midnight)d.refreshAt=midnight;
  List<ScheduleEngine.Entry> list=!result.current.isEmpty()?result.current:result.next;
  if(!list.isEmpty()){
   ScheduleEngine.Entry first=list.get(0);boolean current=!result.current.isEmpty();d.label=current?"正在上课":first.start.toLocalDate().equals(now.toLocalDate())?"下一节课":"下一次上课";
   d.title=join(list,false);d.detail=first.start.format(DateTimeFormatter.ofPattern("M月d日 HH:mm"))+"–"+first.end.format(DateTimeFormatter.ofPattern("HH:mm"))+" · "+join(list,true);
   if(current&&!result.next.isEmpty()){ScheduleEngine.Entry next=result.next.get(0);d.following="下一节 "+next.start.format(DateTimeFormatter.ofPattern("M月d日 HH:mm"))+" · "+join(result.next,false);}
   else if(list.size()>1)d.following="有 "+list.size()+" 条时间重叠的安排，请核对";
  }else if(!s.courses.isEmpty()){d.label="这几天没有课";d.title="留一点时间，给喜欢的事";d.detail="未来7天暂无安排 · 点击查看完整课表";}
  JSONObject widget=new JSONObject(text).optJSONObject("widget");if(widget!=null){String style=widget.optString("style","glass"),content=widget.optString("content","course");if(Arrays.asList("glass","pixel","record").contains(style))d.style=style;if(Arrays.asList("course","date","quote").contains(content))d.content=content;
   if(!"course".equals(d.content)){String quote=widget.optString("quote","留一点时间，给喜欢的事");if(quote.length()>60)quote=quote.substring(0,60);d.label="date".equals(d.content)?"今天":"我的一句话";d.title="date".equals(d.content)?now.format(DateTimeFormatter.ofPattern("M月d日 E",Locale.CHINA)):quote;d.detail="date".equals(d.content)?"留一点时间，给喜欢的事":now.format(DateTimeFormatter.ofPattern("M月d日 E",Locale.CHINA));d.following="";}
  }
  return d;
 }
 private static String join(List<ScheduleEngine.Entry> entries,boolean location){StringBuilder out=new StringBuilder();for(ScheduleEngine.Entry e:entries){if(out.length()>0)out.append(" / ");out.append(location?(e.course.location.isEmpty()?"地点待定":e.course.location):e.course.name);}return out.toString();}
 static PendingIntent open(Context c){return PendingIntent.getActivity(c,6207,new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 private static PendingIntent alarm(Context c){return PendingIntent.getBroadcast(c,6208,new Intent(c,CourseRefreshReceiver.class).setAction(ACTION_REFRESH),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 static void refresh(Context c){
  try{
   Display d=display(c,System.currentTimeMillis());AppWidgetManager widgets=AppWidgetManager.getInstance(c);int[] ids=widgets.getAppWidgetIds(new ComponentName(c,CourseWidget.class));
   for(int id:ids){RemoteViews v=new RemoteViews(c.getPackageName(),"pixel".equals(d.style)?R.layout.course_widget_pixel:R.layout.course_widget);v.setTextViewText(R.id.widget_label,d.label);v.setTextViewText(R.id.widget_title,d.title);v.setTextViewText(R.id.widget_detail,d.detail);v.setTextViewText(R.id.widget_next,d.following.isEmpty()?d.stamp:d.following);v.setOnClickPendingIntent(R.id.widget_root,open(c));v.setOnClickPendingIntent(R.id.widget_refresh,alarm(c));
    boolean dark=!"glass".equals(d.style);int ink=android.graphics.Color.parseColor("pixel".equals(d.style)?"#D3FCA3":dark?"#EDF8FF":"#183D52");for(int view:new int[]{R.id.widget_label,R.id.widget_title,R.id.widget_detail,R.id.widget_next,R.id.widget_refresh,R.id.widget_clock})v.setTextColor(view,ink);
    v.setInt(R.id.widget_root,"setBackgroundResource","record".equals(d.style)?R.drawable.widget_record:"pixel".equals(d.style)?R.drawable.widget_pixel:R.drawable.widget_background);
    v.setViewVisibility(R.id.widget_record,"record".equals(d.style)?android.view.View.VISIBLE:android.view.View.GONE);v.setViewVisibility(R.id.widget_clock,"date".equals(d.content)?android.view.View.VISIBLE:android.view.View.GONE);widgets.updateAppWidget(id,v);
   }
   NotificationManager nm=c.getSystemService(NotificationManager.class);NotificationChannel channel=new NotificationChannel(CHANNEL,"当前与下一节课",NotificationManager.IMPORTANCE_LOW);channel.setDescription("静默显示课程时间和教室，可在锁屏查看");channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);nm.createNotificationChannel(channel);
   if(enabled(c)&&notificationsAllowed(c)){
    Notification n=new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_course_status).setContentTitle(d.label+" · "+d.title).setContentText(d.detail).setStyle(new Notification.BigTextStyle().bigText(d.detail+(d.following.isEmpty()?"":"\n"+d.following))).setVisibility(Notification.VISIBILITY_PUBLIC).setCategory(Notification.CATEGORY_EVENT).setOngoing(true).setOnlyAlertOnce(true).setShowWhen(false).setContentIntent(open(c)).addAction(new Notification.Action.Builder(null,"刷新课表提示",alarm(c)).build()).build();nm.notify(NOTIFICATION,n);
   }else nm.cancel(NOTIFICATION);
   AlarmManager am=c.getSystemService(AlarmManager.class);PendingIntent pending=alarm(c);am.cancel(pending);
   if((enabled(c)||ids.length>0)&&d.refreshAt>System.currentTimeMillis()){
    try{if(exactAllowed(c))am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,d.refreshAt,pending);else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,d.refreshAt,pending);}catch(SecurityException revoked){am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,d.refreshAt,pending);}
   }
  }catch(Exception error){Log.e("CourseCompanion","课程提示更新失败",error);}
 }
}
