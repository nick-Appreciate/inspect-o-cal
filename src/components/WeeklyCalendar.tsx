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

      <div className="grid grid-cols-7 gap-4">
        {daysInWeek.map((day) => {
          const dayInspections = getInspectionsForDay(day);
          const isDayToday = isToday(day);

          return (
            <div
              key={day.toString()}
              className={`min-h-[200px] p-3 border rounded-lg transition-colors ${
                isDayToday ? "ring-2 ring-primary bg-accent/30" : "hover:bg-accent/50"
              } cursor-pointer`}
              onClick={() => onDateClick?.(day)}
            >
              <div className="text-center mb-3">
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

              <div className="space-y-2">
                {dayInspections.map((inspection) => (
                  <div
                    key={inspection.id}
                    className={`${getInspectionColor(
                      inspection.type
                    )} text-white p-2 rounded text-xs space-y-1`}
                  >
                    <div className="font-semibold">{inspection.time}</div>
                    <div className="truncate">{inspection.property.name}</div>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {inspection.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
