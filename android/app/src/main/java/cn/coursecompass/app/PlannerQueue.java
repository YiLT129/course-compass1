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
 static final long MAX_AT=4102531200000L, GRACE_MS=3600000L;
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
  updated.sort(Comparator.comparingLong((Entry row)->row.at).thenComparing(row->row.id));
  return updated;
 }

 static List<Entry> due(List<Entry> rows,long now){
  List<Entry> due=new ArrayList<>();
  for(Entry row:rows)if(!row.delivered&&row.at<=now&&now-row.at<=GRACE_MS)due.add(row);
  return due;
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
  final long exactAt,fallbackAt;
  AlarmPlan(long exactAt,long fallbackAt){this.exactAt=exactAt;this.fallbackAt=fallbackAt;}
 }

 static AlarmPlan alarmPlan(List<Entry> rows,long now,boolean preferExact){
  long next=nextAt(rows,now);
  return preferExact&&next>0?new AlarmPlan(next,next+FALLBACK_DELAY_MS):new AlarmPlan(0,next);
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
