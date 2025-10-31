import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inspection } from "@/types/inspection";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addWeeks,
  subWeeks,
  isToday,
  parse,
} from "date-fns";

interface WeeklyCalendarProps {
  inspections: Inspection[];
  onDateClick?: (date: Date) => void;
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

// Convert time string (e.g., "14:30") to hour position
const getTimePosition = (timeString: string): number => {
  try {
    const [hours, minutes] = timeString.split(":").map(Number);
    return hours + minutes / 60;
  } catch {
    return 9; // Default to 9 AM if parsing fails
  }
};

export default function WeeklyCalendar({ inspections, onDateClick }: WeeklyCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const previousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const nextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const goToToday = () => setCurrentWeek(new Date());

  const getInspectionsForDay = (day: Date) => {
    return inspections.filter((inspection) => isSameDay(inspection.date, day));
  };

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
            <div key={hour} className="h-20 border-b flex items-start justify-end pr-2 pt-1">
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
                    className={`h-20 border-b ${
                      isDayToday ? "bg-accent/20" : ""
                    } hover:bg-accent/50 transition-colors cursor-pointer`}
                    onClick={() => onDateClick?.(day)}
                  />
                ))}

                {/* Positioned inspections */}
                {dayInspections.map((inspection) => {
                  const timePos = getTimePosition(inspection.time);
                  const topPosition = (timePos - 6) * 80; // 80px per hour slot

                  return (
                    <div
                      key={inspection.id}
                      className={`absolute left-1 right-1 ${getInspectionColor(
                        inspection.type
                      )} text-white rounded p-2 cursor-pointer hover:opacity-90 transition-opacity shadow-sm`}
                      style={{
                        top: `${topPosition}px`,
                        height: "60px",
                        zIndex: 10,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDateClick?.(day);
                      }}
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
