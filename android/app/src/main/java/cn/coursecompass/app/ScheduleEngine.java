package cn.coursecompass.app;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Pure clock and week calculation shared by the widget and lock-screen notification. */
final class ScheduleEngine {
 static final ZoneId ZONE=ZoneId.of("Asia/Shanghai");
 static final class Course {
  final String name,location;final int day,start,end;final Set<Integer> weeks;
  Course(String name,String location,int day,int start,int end,Set<Integer> weeks){this.name=name;this.location=location;this.day=day;this.start=start;this.end=end;this.weeks=weeks;}
 }
 static final class Entry {
  final Course course;final ZonedDateTime start,end;
  Entry(Course c,ZonedDateTime s,ZonedDateTime e){course=c;start=s;end=e;}
 }
 static final class Result {
  final List<Entry> current=new ArrayList<>(),next=new ArrayList<>();long refreshAt;
 }
 static Result evaluate(List<Course> courses,LocalDate firstMonday,int totalWeeks,List<String> times,Instant instant){
  ZonedDateTime now=instant.atZone(ZONE);LocalDate today=now.toLocalDate();Result result=new Result();
  result.refreshAt=today.plusDays(1).atStartOfDay(ZONE).toInstant().toEpochMilli();
  List<Entry> future=new ArrayList<>();
  for(int offset=0;offset<=7;offset++){
   LocalDate date=today.plusDays(offset);long days=ChronoUnit.DAYS.between(firstMonday,date);int week=(int)Math.floorDiv(days,7)+1;
   if(week<1||week>totalWeeks)continue;
   for(Course course:courses){
    if(course.day!=date.getDayOfWeek().getValue()||!course.weeks.contains(week))continue;
    ZonedDateTime start=ZonedDateTime.of(date,LocalTime.parse(times.get(course.start-1).split("-")[0]),ZONE),end=ZonedDateTime.of(date,LocalTime.parse(times.get(course.end-1).split("-")[1]),ZONE);
    Entry entry=new Entry(course,start,end);
    if(!now.isBefore(start)&&now.isBefore(end))result.current.add(entry);
    else if(now.isBefore(start))future.add(entry);
    for(ZonedDateTime change:Arrays.asList(start.minusMinutes(15),start,end))if(change.isAfter(now))result.refreshAt=Math.min(result.refreshAt,change.toInstant().toEpochMilli());
   }
  }
  result.current.sort(Comparator.comparing(e->e.start));future.sort(Comparator.comparing(e->e.start));
  if(!future.isEmpty()){ZonedDateTime nextStart=future.get(0).start;for(Entry e:future)if(e.start.equals(nextStart))result.next.add(e);}
  return result;
 }
}
