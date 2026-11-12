package cn.coursecompass.app;

import java.util.List;

public final class PlannerQueueCheck {
 static final long NOW=1893456000000L;
 static PlannerQueue.Entry row(String id,long at){return new PlannerQueue.Entry(id,"标题 "+id,"备注",at,false);}
 static void check(boolean valid,String detail){if(!valid)throw new AssertionError(detail);}
 public static void main(String[] args){
  var first=row("first",NOW+60000);
  var second=row("second",NOW+60000);
  var expired=row("restored",NOW-1000);
  var queue=PlannerQueue.replace(List.of(),List.of(second,expired,first),NOW);
  check(PlannerQueue.nextAt(queue,NOW)==first.at,"nearest future alarm must be kept");
  check(PlannerQueue.due(queue,NOW).isEmpty(),"restored history must not alert");
  var due=PlannerQueue.due(queue,first.at);
  check(due.size()==2&&due.get(0).id.equals("first"),"simultaneous reminders must both be included and stable");
  var handled=PlannerQueue.markDelivered(queue,due);
  check(PlannerQueue.due(handled,first.at+1000).isEmpty(),"foreground and system must share the delivered state");
  var afterReload=PlannerQueue.replace(handled,List.of(first,second),first.at+1000);
  check(PlannerQueue.due(afterReload,first.at+1000).isEmpty(),"replacing identical rows must not resurrect deliveries");
  var lateReplace=PlannerQueue.replace(queue,List.of(first,second),first.at+1000);
  check(PlannerQueue.due(lateReplace,first.at+1000).size()==2,"focus refresh must not suppress previously scheduled due entries");
  check(PlannerQueue.due(queue,first.at+PlannerQueue.GRACE_MS+1).isEmpty(),"old alerts must expire");
  var moved=row("first",NOW+3600000);
  var updated=PlannerQueue.replace(handled,List.of(moved),first.at+1000);
  check(updated.size()==1&&PlannerQueue.nextAt(updated,first.at+1000)==moved.at,"delete and move must replace the old alarm");
  check(PlannerQueue.due(updated,moved.at).size()==1,"moved reminder must alert at its new time");
  check(PlannerQueue.due(PlannerQueue.markDelivered(updated,due),moved.at).size()==1,"stale delivery cannot claim a moved reminder");
  var precise=PlannerQueue.alarmPlan(updated,first.at+1000,true);
  check(precise.exactAt==moved.at&&precise.fallbackAt>moved.at,"revocable exact alarm needs an independent inexact wake-up");
  var ordinary=PlannerQueue.alarmPlan(updated,first.at+1000,false);
  check(ordinary.exactAt==0&&ordinary.fallbackAt==moved.at,"future plans need a wake-up even if permissions are currently off");
  var none=PlannerQueue.alarmPlan(List.of(),first.at+1000,true);
  check(none.exactAt==0&&none.fallbackAt==0,"an empty queue must cancel both alarms");
  var justSaved=PlannerQueue.replace(List.of(),List.of(first),first.at+1,first.id,first.at-1);
  check(PlannerQueue.due(justSaved,first.at+1).size()==1,"a live save crossing the clock boundary still needs one reminder");
  var restoredLate=PlannerQueue.replace(List.of(),List.of(first),first.at+6000,first.id,first.at-1);
  check(PlannerQueue.due(restoredLate,first.at+6000).isEmpty(),"past restore must not be mistaken for a live save");
  var crowd=new java.util.ArrayList<PlannerQueue.Entry>();
  for(int n=0;n<100;n++)crowd.add(row("many-"+n,first.at));
  var batch=PlannerQueue.selectByKey(crowd,PlannerQueue.keys(PlannerQueue.due(crowd,first.at)));
  check(batch.size()==100,"one batch must retain all simultaneous reminders");
  var currentBatch=PlannerQueue.selectByKey(List.of(row("many-1",moved.at),crowd.get(2)),PlannerQueue.keys(batch));
  check(currentBatch.size()==1&&currentBatch.get(0).id.equals("many-2"),"a notification batch must discard edited and removed occurrences");
  System.out.println("PlannerQueue checks passed");
 }
}
