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
 private static Display display(Context c,long millis,JSONObject override)throws Exception{
  Display d=new Display();ZonedDateTime now=Instant.ofEpochMilli(millis).atZone(ScheduleEngine.ZONE);d.stamp=now.format(DateTimeFormatter.ofPattern("M月d日 HH:mm"))+" 更新";
  String text=prefs(c).getString("snapshot",null);if(text!=null){Snapshot s=parse(new JSONObject(text));
  ScheduleEngine.Result result=ScheduleEngine.evaluate(s.courses,s.start,s.weeks,s.times,Instant.ofEpochMilli(millis));d.refreshAt=result.refreshAt;
  long midnight=now.toLocalDate().plusDays(1).atStartOfDay(ScheduleEngine.ZONE).toInstant().toEpochMilli();if(d.refreshAt==0||d.refreshAt>midnight)d.refreshAt=midnight;
  List<ScheduleEngine.Entry> list=!result.current.isEmpty()?result.current:result.next;
  if(!list.isEmpty()){
   ScheduleEngine.Entry first=list.get(0);boolean current=!result.current.isEmpty();d.label=current?"正在上课":result.onBreak?"课间休息 · 下一节":first.start.toLocalDate().equals(now.toLocalDate())?"下一节课":"下一次上课";
   d.title=join(list,false);d.detail="第"+first.period+"节 · "+first.start.format(DateTimeFormatter.ofPattern("M月d日 HH:mm"))+"–"+first.end.format(DateTimeFormatter.ofPattern("HH:mm"))+" · "+join(list,true);
   if(current&&!result.next.isEmpty()){ScheduleEngine.Entry next=result.next.get(0);d.following="下一节 第"+next.period+"节 "+next.start.format(DateTimeFormatter.ofPattern("M月d日 HH:mm"))+" · "+join(result.next,false);}
   else if(list.size()>1)d.following="有 "+list.size()+" 条时间重叠的安排，请核对";
  }else if(!s.courses.isEmpty()){d.label="这几天没有课";d.title="留一点时间，给喜欢的事";d.detail="未来7天暂无安排 · 点击查看完整课表";}
  } JSONObject widget=override!=null?override:text==null?null:new JSONObject(text).optJSONObject("widget");if(widget!=null){String style=widget.optString("style","glass"),content=widget.optString("content","course");if(Arrays.asList("glass","pixel","record").contains(style))d.style=style;if(Arrays.asList("course","date","quote").contains(content))d.content=content;
   if(!"course".equals(d.content)){String quote=widget.optString("quote","留一点时间，给喜欢的事");if(quote.length()>60)quote=quote.substring(0,60);d.label="date".equals(d.content)?"今天":"我的一句话";d.title="date".equals(d.content)?now.format(DateTimeFormatter.ofPattern("M月d日 E",Locale.CHINA)):quote;d.detail="date".equals(d.content)?"留一点时间，给喜欢的事":now.format(DateTimeFormatter.ofPattern("M月d日 E",Locale.CHINA));d.following="";}
  }
  return d;
 }
 private static String join(List<ScheduleEngine.Entry> entries,boolean location){StringBuilder out=new StringBuilder();for(ScheduleEngine.Entry e:entries){if(out.length()>0)out.append(" / ");out.append(location?(e.course.location.isEmpty()?"地点待定":e.course.location):e.course.name);}return out.toString();}
 static WidgetStyle style(JSONObject raw){if(raw==null)raw=new JSONObject();return new WidgetStyle(raw.optString("style"),raw.optString("content"),raw.optString("quote"),raw.optString("accent"),raw.optInt("opacity",90));}
 static boolean owns(Context c,int id){android.appwidget.AppWidgetProviderInfo info=AppWidgetManager.getInstance(c).getAppWidgetInfo(id);return id>0&&info!=null&&new ComponentName(c,CourseWidget.class).equals(info.provider);}
 static JSONObject config(Context c,int id){try{String text=prefs(c).getString("widget."+id,null);if(text!=null)return new JSONObject(text);JSONObject snapshot=new JSONObject(prefs(c).getString("snapshot","{}"));JSONObject widget=snapshot.optJSONObject("widget");return widget==null?new JSONObject():widget;}catch(Exception e){return new JSONObject();}}
 static boolean saveConfig(Context c,int id,String text){try{if(!owns(c,id)||text==null||text.length()>10000)return false;WidgetStyle w=style(new JSONObject(text));JSONObject o=new JSONObject();o.put("style",w.style);o.put("content",w.content);o.put("quote",w.quote);o.put("accent",w.accent);o.put("opacity",w.opacity);boolean ok=prefs(c).edit().putString("widget."+id,o.toString()).commit();if(ok)refresh(c);return ok;}catch(Exception e){return false;}}
 static String configs(Context c){JSONArray rows=new JSONArray();for(int id:AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c,CourseWidget.class))){try{JSONObject o=config(c,id);o.put("id",id);rows.put(o);}catch(Exception ignored){}}return rows.toString();}
 static void removeConfigs(Context c,int[] ids){android.content.SharedPreferences.Editor edit=prefs(c).edit();for(int id:ids)edit.remove("widget."+id);edit.apply();}
 static PendingIntent edit(Context c,int id){Intent intent=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id);return PendingIntent.getActivity(c,10000+id,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 static PendingIntent open(Context c){return PendingIntent.getActivity(c,6207,new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 private static PendingIntent alarm(Context c){return PendingIntent.getBroadcast(c,6208,new Intent(c,CourseRefreshReceiver.class).setAction(ACTION_REFRESH),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 static void refresh(Context c){
  try{
   Display d=display(c,System.currentTimeMillis(),null);AppWidgetManager widgets=AppWidgetManager.getInstance(c);int[] ids=widgets.getAppWidgetIds(new ComponentName(c,CourseWidget.class));
   for(int id:ids){Display card=display(c,System.currentTimeMillis(),config(c,id));RemoteViews v=new RemoteViews(c.getPackageName(),"pixel".equals(card.style)?R.layout.course_widget_pixel:R.layout.course_widget);v.setTextViewText(R.id.widget_label,card.label);v.setTextViewText(R.id.widget_title,card.title);v.setTextViewText(R.id.widget_detail,card.detail);v.setTextViewText(R.id.widget_next,card.following.isEmpty()?card.stamp:card.following);v.setOnClickPendingIntent(R.id.widget_root,open(c));v.setOnClickPendingIntent(R.id.widget_refresh,alarm(c));
    WidgetStyle appearance=style(config(c,id));int ink=appearance.foreground();for(int view:new int[]{R.id.widget_label,R.id.widget_title,R.id.widget_detail,R.id.widget_next,R.id.widget_refresh,R.id.widget_clock})v.setTextColor(view,ink);
    android.graphics.Bitmap background=android.graphics.Bitmap.createBitmap(320,180,android.graphics.Bitmap.Config.ARGB_8888);android.graphics.Paint paint=new android.graphics.Paint(3);paint.setColor(appearance.background());new android.graphics.Canvas(background).drawRoundRect(0,0,320,180,"pixel".equals(card.style)?5:18,"pixel".equals(card.style)?5:18,paint);v.setImageViewBitmap(R.id.widget_background,background);v.setOnClickPendingIntent(R.id.widget_edit,edit(c,id));
    v.setViewVisibility(R.id.widget_record,"record".equals(card.style)?android.view.View.VISIBLE:android.view.View.GONE);v.setViewVisibility(R.id.widget_clock,"date".equals(card.content)?android.view.View.VISIBLE:android.view.View.GONE);widgets.updateAppWidget(id,v);
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
