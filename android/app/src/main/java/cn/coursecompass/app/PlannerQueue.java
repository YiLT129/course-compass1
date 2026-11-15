package cn.coursecompass.app;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** A one-shot queue with receipts bound to both the id and the scheduled instant. */
final class PlannerQueue {
 static final int MAX_ENTRIES=100;
 static final long MAX_AT=4102531200000L, GRACE_MS=7200000L, HANDOFF_MS=8000L;
 private static final long TEST_GRACE_MS=300000L;
 static final String TEST_ID="!system-test";
 private static final long FALLBACK_DELAY_MS=60000L;

 static final class Entry {
  final String id,title,note;
  final long at;
  final boolean delivered;

  Entry(String id,String title,String note,long at,boolean delivered){
   this.id=id;this.title=title;this.note=note;this.at=at;this.delivered=delivered;
  }
  Entry withDelivery(boolean value){return new Entry(id,title,note,at,value);}
  String key(){return id+":"+at;}
  boolean isTest(){return TEST_ID.equals(id);}
 }

 static List<Entry> replace(List<Entry> previous,List<Entry> incoming,long now){
  return replace(previous,incoming,now,"",0);
 }

 static List<Entry> replace(List<Entry> previous,List<Entry> incoming,long now,String savedId,long savedAt){
  Map<String,Entry> old=byId(previous);
  List<Entry> updated=new ArrayList<>(incoming.size());
  for(Entry row:incoming){
   Entry match=old.get(row.id);
   boolean justSaved=row.id.equals(savedId)&&savedAt>0&&savedAt<=now&&now-savedAt<=5000&&row.at>savedAt;
   boolean delivered=match!=null&&match.at==row.at?match.delivered:row.at<=now&&!justSaved;
   updated.add(row.withDelivery(delivered));
  }
  Entry test=old.get(TEST_ID);
  if(test!=null)updated.add(test);
  updated.sort(Comparator.comparingLong((Entry row)->row.at).thenComparing(row->row.id));
  return updated;
 }

 static List<Entry> due(List<Entry> rows,long now){
  List<Entry> due=new ArrayList<>();
  for(Entry row:rows)if(!row.delivered&&row.at<=now&&now-row.at<=(row.isTest()?TEST_GRACE_MS:GRACE_MS))due.add(row);
  return due;
 }

 static List<Entry> foregroundDue(List<Entry> rows,long now){
  List<Entry> ready=due(rows,now);
  ready.removeIf(Entry::isTest);
  return ready;
 }

 static List<Entry> systemDue(List<Entry> rows,long now,boolean foreground,boolean notifications){
  if(!notifications)return new ArrayList<>();
  List<Entry> ready=due(rows,now);
  if(foreground)ready.removeIf(row->!row.isTest()&&now-row.at<HANDOFF_MS);
  return ready;
 }

 static List<Entry> acknowledge(List<Entry> rows,Set<String> shown,long now){
  return markDelivered(rows,selectByKey(foregroundDue(rows,now),shown));
 }

 static List<Entry> withTest(List<Entry> rows,long at){
  List<Entry> updated=new ArrayList<>(rows);
  updated.removeIf(Entry::isTest);
  updated.add(new Entry(TEST_ID,"课间 · 日程提醒测试","这是一条测试通知，你的日程没有改动。",at,false));
  updated.sort(Comparator.comparingLong((Entry row)->row.at).thenComparing(row->row.id));
  return updated;
 }

 static Set<String> keys(List<Entry> rows){
  Set<String> keys=new HashSet<>();
  for(Entry row:rows)keys.add(row.key());
  return keys;
 }

 static List<Entry> selectByKey(List<Entry> rows,Set<String> keys){
  List<Entry> selected=new ArrayList<>();
  for(Entry row:rows)if(keys.contains(row.key()))selected.add(row);
  return selected;
 }

 static long nextAt(List<Entry> rows,long now){
  long next=0;
  for(Entry row:rows)if(!row.delivered&&row.at>now&&(next==0||row.at<next))next=row.at;
  return next;
 }

 static final class AlarmPlan {
  final long exactAt,fallbackAt,retryAt;
  AlarmPlan(long exactAt,long fallbackAt,long retryAt){this.exactAt=exactAt;this.fallbackAt=fallbackAt;this.retryAt=retryAt;}
 }

 static AlarmPlan alarmPlan(List<Entry> rows,long now,boolean preferExact){
  return alarmPlan(rows,now,preferExact,false,true);
 }

 static AlarmPlan alarmPlan(List<Entry> rows,long now,boolean preferExact,boolean foreground,boolean notifications){
  long next=nextAt(rows,now),handoff=0;
  if(notifications)for(Entry row:due(rows,now)){
   long retry=foreground&&!row.isTest()&&now-row.at<HANDOFF_MS?row.at+HANDOFF_MS:now+FALLBACK_DELAY_MS;
   if(handoff==0||retry<handoff)handoff=retry;
  }
  if(next==0||!preferExact)return new AlarmPlan(0,next,handoff);
  return new AlarmPlan(next,next+FALLBACK_DELAY_MS,handoff);
 }

 static List<Entry> markDelivered(List<Entry> rows,List<Entry> claims){
  Map<String,Entry> byId=byId(claims);
  List<Entry> updated=new ArrayList<>(rows.size());
  for(Entry row:rows){
   Entry claim=byId.get(row.id);
   updated.add(claim!=null&&claim.at==row.at?row.withDelivery(true):row);
  }
  return updated;
 }

 private static Map<String,Entry> byId(List<Entry> rows){
  Map<String,Entry> entries=new HashMap<>();
  for(Entry row:rows)entries.put(row.id,row);
  return entries;
 }
}
