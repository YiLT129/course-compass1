package cn.coursecompass.app;
import android.content.*;
public final class CourseRefreshReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){CourseCompanion.refresh(context);}
}
