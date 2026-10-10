package cn.coursecompass.app;
import android.appwidget.*;import android.content.*;import android.os.Bundle;
public final class CourseWidget extends AppWidgetProvider {
 @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){CourseCompanion.refresh(c);}
 @Override public void onEnabled(Context c){CourseCompanion.refresh(c);}
 @Override public void onDisabled(Context c){CourseCompanion.refresh(c);}
 @Override public void onDeleted(Context c,int[] ids){CourseCompanion.refresh(c);}
 @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle options){CourseCompanion.refresh(c);}
}
