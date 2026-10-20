package cn.coursecompass.app;
import java.time.*;import java.util.*;
public class ScheduleEngineCheck {
 static List<String> times=List.of("08:20-09:05","09:15-10:00","10:20-11:05","11:15-12:00","14:00-14:45","14:55-15:40","16:00-16:45","16:55-17:40","18:40-19:25","19:35-20:00","20:20-21:00","21:00-21:40");
 static ScheduleEngine.Course c(String n,int day,int a,int b,Integer... weeks){return new ScheduleEngine.Course(n,"A101",day,a,b,new HashSet<>(Arrays.asList(weeks)));}
 static ScheduleEngine.Result run(List<ScheduleEngine.Course> courses,String clock){return ScheduleEngine.evaluate(courses,LocalDate.parse("2026-08-31"),16,times,LocalDateTime.parse(clock).atZone(ScheduleEngine.ZONE).toInstant());}
 static void check(boolean value,String name){if(!value)throw new AssertionError(name);}
 public static void main(String[] args){
  List<ScheduleEngine.Course> courses=List.of(c("早课",1,1,2,1),c("第二门",1,3,4,1),c("晚一",1,11,11,1),c("晚二",1,12,12,1));
  var before=run(courses,"2026-08-31T08:00");check(before.current.isEmpty()&&before.next.get(0).course.name.equals("早课"),"before class");check(before.refreshAt==LocalDateTime.parse("2026-08-31T08:05").atZone(ScheduleEngine.ZONE).toInstant().toEpochMilli(),"15min refresh");
  check(run(courses,"2026-08-31T08:20").current.get(0).course.name.equals("早课"),"start inclusive");
  check(run(courses,"2026-08-31T10:00").current.isEmpty()&&run(courses,"2026-08-31T10:00").next.get(0).course.name.equals("第二门"),"end exclusive");
  check(run(courses,"2026-08-31T21:00").current.get(0).course.name.equals("晚二"),"adjacent evening periods");
  check(run(courses,"2026-08-31T21:40").current.isEmpty(),"evening end");
  check(run(List.of(c("下周",1,1,2,2)),"2026-09-06T23:59").next.get(0).start.toLocalDate().equals(LocalDate.parse("2026-09-07")),"Sunday to Monday");
  check(run(List.of(c("单周",1,1,2,1,3)),"2026-09-07T08:20").current.isEmpty(),"odd weeks");
  check(run(List.of(c("重叠1",1,1,2,1),c("重叠2",1,1,2,1)),"2026-08-31T08:20").current.size()==2,"conflict preserved");
  check(run(courses,"2026-08-30T08:20").current.isEmpty(),"before semester");
  check(run(List.of(c("过期",1,1,2,17)),"2026-12-21T08:20").current.isEmpty(),"after semester");
  check(run(List.of(c("周末",6,5,6,1)),"2026-09-05T14:00").current.size()==1,"weekend");
  check(run(List.of(),"2026-09-05T14:00").next.isEmpty(),"empty");
  var gap=run(courses,"2026-08-31T09:05");check(gap.current.isEmpty()&&gap.onBreak&&gap.next.get(0).period==2,"break between split periods");
  check(run(courses,"2026-08-31T09:15").current.get(0).period==2,"second period transition");
  check(run(courses,"2026-08-31T09:04").current.get(0).end.toLocalTime().equals(LocalTime.parse("09:05")),"period end excludes break");
  System.out.println("PASS: 15 native clock/week cases including split periods, break boundaries and next period");
 }
}
