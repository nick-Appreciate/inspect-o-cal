import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inspection } from "@/types/inspection";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";

interface InspectionCalendarProps {
  inspections: Inspection[];
  onDateClick?: (date: Date) => void;
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

export default function InspectionCalendar({ inspections, onDateClick, onInspectionClick }: InspectionCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDay = monthStart.getDay();
  const totalDays = [...Array(startDay).fill(null), ...daysInMonth];

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const getInspectionsForDay = (day: Date | null) => {
    if (!day) return [];
    return inspections.filter((inspection) => isSameDay(inspection.date, day));
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CalendarIcon className="h-6 w-6 text-primary" />
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-center font-semibold text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {totalDays.map((day, index) => {
          const dayInspections = getInspectionsForDay(day);
          const isToday = day && isSameDay(day, new Date());

          return (
            <div
              key={index}
              className={`min-h-[100px] p-2 border rounded-lg transition-colors ${
                day
                  ? "hover:bg-accent"
                  : "bg-muted/30"
              } ${isToday ? "ring-2 ring-primary" : ""}`}
            >
              {day && (
                <>
                  <div className={`text-sm font-medium mb-1 ${isToday ? "text-primary font-bold" : ""}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayInspections.slice(0, 2).map((inspection) => (
                      <Badge
                        key={inspection.id}
                        className={`${getInspectionColor(inspection.type)} text-white text-xs w-full justify-start truncate cursor-pointer hover:opacity-80 transition-opacity`}
                        onClick={() => onInspectionClick?.(inspection.id)}
                      >
                        {inspection.time} - {inspection.property.name}
                        {inspection.unitName && ` (${inspection.unitName})`}
                      </Badge>
                    ))}
                    {dayInspections.length > 2 && (
                      <div 
                        className="text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => day && onDateClick?.(day)}
                      >
                        +{dayInspections.length - 2} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
