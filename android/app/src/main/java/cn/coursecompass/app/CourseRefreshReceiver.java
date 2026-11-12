package cn.coursecompass.app;
import android.content.*;
public final class CourseRefreshReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  String action=intent.getAction();
  if(PlannerReminders.ACTION_DUE.equals(action)){PlannerReminders.refresh(context);return;}
  CourseCompanion.refresh(context);
  if(!CourseCompanion.ACTION_REFRESH.equals(action))PlannerReminders.refresh(context);
 }
}
