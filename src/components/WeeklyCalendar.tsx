import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, GripVertical, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inspection } from "@/types/inspection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
} from "date-fns";
import { formatInTimeZone } from 'date-fns-tz';

interface WeeklyCalendarProps {
  inspections: Inspection[];
  onDateClick?: (date: Date) => void;
  onInspectionUpdate?: () => void;
  onInspectionClick?: (inspectionId: string) => void;
}

const getInspectionColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    "S8 - RFT": "bg-inspection-s8-rft",
    "S8 - 1st Annual": "bg-inspection-s8-annual",
    "S8 - Reinspection": "bg-inspection-s8-reinspection",
    "S8 - Abatement Cure": "bg-inspection-s8-abatement",
    "Rental License": "bg-inspection-rental",
    "HUD": "bg-inspection-hud",
  };
  return colorMap[type] || "bg-primary";
};

// Generate hours from 6 AM to 8 PM
const HOURS = Array.from({ length: 15 }, (_, i) => i + 6);
const HOUR_HEIGHT = 80; // pixels per hour

// Convert time string (e.g., "14:30") to hour position
const getTimePosition = (timeString: string): number => {
  try {
    const [hours, minutes] = timeString.split(":").map(Number);
    return hours + minutes / 60;
  } catch {
    return 9; // Default to 9 AM if parsing fails
  }
};

export default function WeeklyCalendar({
  inspections,
  onDateClick,
  onInspectionUpdate,
  onInspectionClick,
}: WeeklyCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [resizingInspection, setResizingInspection] = useState<string | null>(null);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [resizeStartDuration, setResizeStartDuration] = useState(0);
  const [draggingInspection, setDraggingInspection] = useState<string | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState("");
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const previousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const nextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const goToToday = () => setCurrentWeek(new Date());

  const getInspectionsForDay = (day: Date) => {
    const key = formatInTimeZone(day, 'America/Chicago', 'yyyy-MM-dd');
    return inspections.filter((inspection) => formatInTimeZone(inspection.date, 'America/Chicago', 'yyyy-MM-dd') === key);
  };

  const handleDragStart = (
    e: React.MouseEvent,
    inspectionId: string,
    currentTime: string,
    currentDate: Date
  ) => {
    setDraggingInspection(inspectionId);
    setDragStartY(e.clientY);
    setDragStartX(e.clientX);
    setDragStartTime(currentTime);
    setDragStartDate(currentDate);
  };

  const handleResizeStart = (
    e: React.MouseEvent,
    inspectionId: string,
    currentDuration: number
  ) => {
    e.stopPropagation();
    setResizingInspection(inspectionId);
    setResizeStartY(e.clientY);
    setResizeStartDuration(currentDuration);
  };

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!draggingInspection) return;

    const deltaY = e.clientY - dragStartY;
    const deltaMinutes = Math.round((deltaY / HOUR_HEIGHT) * 60);
    const [hours, minutes] = dragStartTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + deltaMinutes;
    
    // Snap to 15-minute increments
    const snappedMinutes = Math.round(totalMinutes / 15) * 15;
    
    // Clamp to valid time range (6 AM to 8 PM)
    const clampedMinutes = Math.max(6 * 60, Math.min(20 * 60, snappedMinutes));

    // Update the visual immediately
    const element = document.getElementById(`inspection-${draggingInspection}`);
    if (element) {
      const timePos = clampedMinutes / 60;
      const topPosition = (timePos - 6) * HOUR_HEIGHT;
      element.style.top = `${topPosition}px`;
    }
  }, [draggingInspection, dragStartY, dragStartTime]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingInspection) return;

    const deltaY = e.clientY - resizeStartY;
    const deltaMinutes = Math.round((deltaY / HOUR_HEIGHT) * 60);
    const rawDuration = resizeStartDuration + deltaMinutes;
    
    // Snap to 15-minute increments with minimum of 15 minutes
    const newDuration = Math.max(15, Math.round(rawDuration / 15) * 15);

    // Update the visual immediately by finding the element
    const element = document.getElementById(`inspection-${resizingInspection}`);
    if (element) {
      element.style.height = `${(newDuration / 60) * HOUR_HEIGHT - 4}px`;
    }
  }, [resizingInspection, resizeStartY, resizeStartDuration]);

  const handleDragEnd = useCallback(async () => {
    if (!draggingInspection || !dragStartDate) return;

    const element = document.getElementById(`inspection-${draggingInspection}`);
    if (!element) {
      setDraggingInspection(null);
      return;
    }

    const topPx = parseFloat(element.style.top);
    const timePos = topPx / HOUR_HEIGHT + 6;
    const totalMinutes = Math.round(timePos * 60);
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    const newTime = `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`;

    // Clear dragging state immediately to stop visual following
    setDraggingInspection(null);

    // Update database in background
    const { error } = await supabase
      .from("inspections")
      .update({ time: newTime })
      .eq("id", draggingInspection);

    if (error) {
      toast.error("Failed to update inspection time");
      // Revert visual change
      const [hours, minutes] = dragStartTime.split(":").map(Number);
      const timePos = hours + minutes / 60;
      const topPosition = (timePos - 6) * HOUR_HEIGHT;
      element.style.top = `${topPosition}px`;
    } else {
      toast.success("Time updated");
      onInspectionUpdate?.();
    }
  }, [draggingInspection, dragStartTime, dragStartDate, onInspectionUpdate]);

  const handleResizeEnd = useCallback(async () => {
    if (!resizingInspection) return;

    const element = document.getElementById(`inspection-${resizingInspection}`);
    if (!element) {
      setResizingInspection(null);
      return;
    }

    const heightPx = parseFloat(element.style.height);
    const newDuration = Math.round(((heightPx + 4) / HOUR_HEIGHT) * 60);

    // Clear resizing state immediately
    setResizingInspection(null);

    // Update database in background
    const { error } = await supabase
      .from("inspections")
      .update({ duration: newDuration })
      .eq("id", resizingInspection);

    if (error) {
      toast.error("Failed to update inspection duration");
      // Revert visual change
      element.style.height = `${(resizeStartDuration / 60) * HOUR_HEIGHT - 4}px`;
    } else {
      toast.success("Duration updated");
      onInspectionUpdate?.();
    }
  }, [resizingInspection, resizeStartDuration, onInspectionUpdate]);

  // Add event listeners for drag
  useEffect(() => {
    if (draggingInspection) {
      document.addEventListener("mousemove", handleDragMove);
      document.addEventListener("mouseup", handleDragEnd);

      return () => {
        document.removeEventListener("mousemove", handleDragMove);
        document.removeEventListener("mouseup", handleDragEnd);
      };
    }
  }, [draggingInspection, handleDragMove, handleDragEnd]);

  // Add event listeners for resize
  useEffect(() => {
    if (resizingInspection) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);

      return () => {
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [resizingInspection, handleResizeMove, handleResizeEnd]);

  return (
    <Card className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <h2 className="text-lg sm:text-2xl font-bold">
          {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
        </h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={goToToday} size="sm" className="flex-1 sm:flex-none">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={previousWeek} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextWeek} className="h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile: Show message about desktop-only feature */}
      <div className="block lg:hidden">
        <div className="border rounded-lg p-6 text-center bg-muted/30">
          <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-semibold mb-2">Weekly Calendar View</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The interactive weekly calendar with drag & drop is optimized for desktop screens.
          </p>
          <Button onClick={() => window.location.href = "/"} variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            View Month Calendar
          </Button>
        </div>
      </div>

      {/* Desktop: Show full weekly calendar */}
      <div className="hidden lg:flex overflow-x-auto">
        {/* Time column */}
        <div className="flex-shrink-0 w-16 border-r">
          <div className="h-16 border-b" /> {/* Header spacer */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="border-b flex items-start justify-end pr-2 pt-1"
              style={{ height: `${HOUR_HEIGHT}px` }}
            >
              <span className="text-xs text-muted-foreground">
                {format(new Date().setHours(hour, 0), "h a")}
              </span>
            </div>
          ))}
        </div>

        {/* Days columns */}
        {daysInWeek.map((day) => {
          const dayInspections = getInspectionsForDay(day);
          const isDayToday = formatInTimeZone(day, 'America/Chicago', 'yyyy-MM-dd') === formatInTimeZone(new Date(), 'America/Chicago', 'yyyy-MM-dd');

          return (
            <div
              key={day.toString()}
              className="flex-1 min-w-[140px] border-r last:border-r-0"
            >
              {/* Day header */}
              <div
                className={`h-16 border-b p-2 text-center ${
                  isDayToday ? "bg-primary/10" : ""
                }`}
              >
                <div className="text-xs font-semibold text-muted-foreground uppercase">
                  {formatInTimeZone(day, 'America/Chicago', 'EEE')}
                </div>
                <div
                  className={`text-2xl font-bold ${
                    isDayToday ? "text-primary" : ""
                  }`}
                >
                  {formatInTimeZone(day, 'America/Chicago', 'd')}
                </div>
              </div>

              {/* Time slots */}
              <div className="relative">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className={`border-b ${
                      isDayToday ? "bg-accent/20" : ""
                    } hover:bg-accent/50 transition-colors cursor-pointer`}
                    style={{ height: `${HOUR_HEIGHT}px` }}
                    onClick={() => onDateClick?.(day)}
                  />
                ))}

                {/* Positioned inspections */}
                {dayInspections.map((inspection) => {
                  const timePos = getTimePosition(inspection.time);
                  const topPosition = (timePos - 6) * HOUR_HEIGHT;
                  const duration = inspection.duration || 60;
                  const height = (duration / 60) * HOUR_HEIGHT - 4; // -4 for padding

                  return (
                    <div
                      key={inspection.id}
                      id={`inspection-${inspection.id}`}
                      className={`absolute left-1 right-1 ${getInspectionColor(
                        inspection.type
                      )} text-white rounded p-2 cursor-move hover:opacity-90 transition-opacity shadow-sm group ${
                        draggingInspection === inspection.id ? "opacity-75 shadow-lg scale-[1.02]" : ""
                      }`}
                      style={{
                        top: `${topPosition}px`,
                        height: `${height}px`,
                        zIndex: draggingInspection === inspection.id ? 20 : 10,
                      }}
                      onMouseDown={(e) =>
                        handleDragStart(e, inspection.id, inspection.time, day)
                      }
                      onClick={(e) => {
                        // Only trigger if not dragging
                        if (e.currentTarget.style.top === `${topPosition}px`) {
                          onInspectionClick?.(inspection.id);
                        }
                      }}
                    >
                      <div className="text-xs font-semibold truncate">
                        {inspection.time}
                      </div>
                      <div className="text-xs truncate mt-1">
                        {inspection.property.name}
                        {inspection.unitName && (
                          <div className="text-[10px] opacity-80">
                            {inspection.unitName}
                          </div>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 mt-1"
                      >
                        {inspection.type.split(" - ")[0]}
                      </Badge>

                      {/* Resize handle */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) =>
                          handleResizeStart(e, inspection.id, duration)
                        }
                      >
                        <GripVertical className="h-3 w-3" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
