import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inspection } from "@/types/inspection";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { formatInTimeZone } from 'date-fns-tz';

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
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Month view calculations
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDay = monthStart.getDay();
  const totalDays = [...Array(startDay).fill(null), ...daysInMonth];

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  // Week view calculations
  const weekStart = startOfWeek(currentWeek);
  const weekEnd = endOfWeek(currentWeek);
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const previousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const nextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));

  const getInspectionsForDay = (day: Date | null) => {
    if (!day) return [];
    const dayKey = formatInTimeZone(day, 'America/Chicago', 'yyyy-MM-dd');
    return inspections.filter((inspection) => formatInTimeZone(inspection.date, 'America/Chicago', 'yyyy-MM-dd') === dayKey);
  };

  return (
    <>
      {/* Mobile Weekly View */}
      <Card className="p-4 md:hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            {formatInTimeZone(weekStart, 'America/Chicago', 'MMM d')} - {formatInTimeZone(weekEnd, 'America/Chicago', 'MMM d, yyyy')}
          </h2>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={previousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={nextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {daysInWeek.map((day) => {
            const dayInspections = getInspectionsForDay(day);
            const isToday = formatInTimeZone(day, 'America/Chicago', 'yyyy-MM-dd') === formatInTimeZone(new Date(), 'America/Chicago', 'yyyy-MM-dd');

            return (
              <div
                key={day.toISOString()}
                className={`border rounded-lg p-4 ${isToday ? 'ring-2 ring-primary bg-primary/5' : 'bg-card'}`}
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b">
                  <div>
                    <div className={`text-xs font-medium text-muted-foreground ${isToday ? 'text-primary' : ''}`}>
                      {formatInTimeZone(day, 'America/Chicago', 'EEEE')}
                    </div>
                    <div className={`text-2xl font-bold ${isToday ? 'text-primary' : ''}`}>
                      {formatInTimeZone(day, 'America/Chicago', 'd')}
                    </div>
                  </div>
                  {isToday && (
                    <Badge variant="default" className="bg-primary">Today</Badge>
                  )}
                </div>

                {dayInspections.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No inspections scheduled
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayInspections.map((inspection) => (
                      <div
                        key={inspection.id}
                        className={`${getInspectionColor(inspection.type)} p-3 rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}
                        onClick={() => onInspectionClick?.(inspection.id)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                            {inspection.time}
                          </Badge>
                          <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                            {inspection.type}
                          </Badge>
                        </div>
                        <div className="text-white font-medium mb-1">
                          {inspection.property.name}
                        </div>
                        {inspection.unitName && (
                          <div className="text-white/90 text-sm">
                            Unit: {inspection.unitName}
                          </div>
                        )}
                        <div className="text-white/80 text-xs mt-1">
                          {inspection.property.address}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Desktop Monthly View */}
      <Card className="p-6 hidden md:block">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-primary" />
            {formatInTimeZone(currentMonth, 'America/Chicago', 'MMMM yyyy')}
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
            const isToday = day && formatInTimeZone(day, 'America/Chicago', 'yyyy-MM-dd') === formatInTimeZone(new Date(), 'America/Chicago', 'yyyy-MM-dd');

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
                      {formatInTimeZone(day, 'America/Chicago', 'd')}
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
    </>
  );
}
