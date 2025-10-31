import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
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
  isSameDay,
  addWeeks,
  subWeeks,
  isToday,
} from "date-fns";

interface WeeklyCalendarProps {
  inspections: Inspection[];
  onDateClick?: (date: Date) => void;
  onInspectionUpdate?: () => void;
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
    return inspections.filter((inspection) => isSameDay(inspection.date, day));
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
    
    // Clamp to valid time range (6 AM to 8 PM)
    const clampedMinutes = Math.max(6 * 60, Math.min(20 * 60, totalMinutes));

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
    const newDuration = Math.max(15, resizeStartDuration + deltaMinutes); // Minimum 15 minutes

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

    // Update database
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

    setDraggingInspection(null);
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

    // Update database
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

    setResizingInspection(null);
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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">
          {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={previousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex overflow-x-auto">
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
          const isDayToday = isToday(day);

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
                  {format(day, "EEE")}
                </div>
                <div
                  className={`text-2xl font-bold ${
                    isDayToday ? "text-primary" : ""
                  }`}
                >
                  {format(day, "d")}
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
                      )} text-white rounded p-2 cursor-move hover:opacity-90 transition-opacity shadow-sm group`}
                      style={{
                        top: `${topPosition}px`,
                        height: `${height}px`,
                        zIndex: 10,
                      }}
                      onMouseDown={(e) =>
                        handleDragStart(e, inspection.id, inspection.time, day)
                      }
                    >
                      <div className="text-xs font-semibold truncate">
                        {inspection.time}
                      </div>
                      <div className="text-xs truncate mt-1">
                        {inspection.property.name}
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
