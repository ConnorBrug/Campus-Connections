
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, useDayPicker, useNavigation } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const [view, setView] = React.useState<'days' | 'months' | 'years'>('days');
  const [currentDate, setCurrentDate] = React.useState(props.defaultMonth || props.month || new Date());

  const fromYear = props.fromYear || new Date().getFullYear() - 100;
  const toYear = props.toYear || new Date().getFullYear();
  
  const yearRangeStart = React.useMemo(() => {
    const selectedYear = currentDate.getFullYear();
    const start = Math.floor((selectedYear - fromYear) / 12) * 12 + fromYear;
    return start;
  }, [currentDate, fromYear]);


  const handleMonthSelect = (month: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), month, 1));
    setView('days');
  };

  const handleYearSelect = (year: number) => {
    setCurrentDate(new Date(year, currentDate.getMonth(), 1));
    setView('days');
  };
  
  const handleYearRangeChange = (increment: number) => {
    setCurrentDate(new Date(currentDate.getFullYear() + increment * 12, 0, 1));
  };


  const renderMonthView = () => {
    const months = Array.from({ length: 12 }).map((_, i) => new Date(0, i).toLocaleString('default', { month: 'long' }));
    
    return (
        <div className="p-3">
             <div className="flex justify-center items-center pt-1 relative">
                <h2 className="text-sm font-semibold">Select Month</h2>
            </div>
            <div className="grid grid-cols-2 grid-rows-6 grid-flow-col gap-2 mt-4">
                {months.map((month) => (
                    <button
                        key={month}
                        onClick={() => handleMonthSelect(months.indexOf(month))}
                        className={cn(buttonVariants({ variant: 'ghost' }), 'w-full')}
                    >
                        {month}
                    </button>
                ))}
            </div>
        </div>
    );
  }

  const renderYearView = () => {
      const yearsInGrid = Array.from({ length: 12 }, (_, i) => yearRangeStart + i);
      
      const latestYearInGrid = yearRangeStart + 11;
      const canGoForward = latestYearInGrid < toYear;
      
      return (
          <div className="p-3">
              <div className="flex justify-between items-center pt-1 relative">
                  <button onClick={() => handleYearRangeChange(-1)} className={cn(buttonVariants({ variant: 'ghost' }), "h-7 w-7 p-0")}>
                      <ChevronLeft className="h-4 w-4" />
                  </button>
                  <h2 className="text-sm font-semibold">{`${yearRangeStart} - ${latestYearInGrid}`}</h2>
                  <button onClick={() => handleYearRangeChange(1)} disabled={!canGoForward} className={cn(buttonVariants({ variant: 'ghost' }), "h-7 w-7 p-0", !canGoForward && "opacity-50 cursor-not-allowed")}>
                      <ChevronRight className="h-4 w-4" />
                  </button>
              </div>
              <div className="grid grid-cols-2 grid-rows-6 grid-flow-col gap-2 mt-4">
                  {yearsInGrid.map((year) => {
                      const isDisabled = year > toYear || year < fromYear;
                      return (
                          <button
                              key={year}
                              onClick={() => handleYearSelect(year)}
                              disabled={isDisabled}
                              className={cn(
                                  buttonVariants({ variant: 'ghost' }), 
                                  'w-full',
                                  isDisabled && "text-muted-foreground opacity-50 cursor-not-allowed"
                              )}
                          >
                              {year}
                          </button>
                      );
                  })}
              </div>
          </div>
      );
  }

  return (
    <>
      {view === 'days' && (
        <DayPicker
          showOutsideDays={showOutsideDays}
          className={cn("p-3", className)}
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium",
            nav: "space-x-1 flex items-center",
            nav_button: cn(
              buttonVariants({ variant: "outline" }),
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell:
              "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: cn(
              buttonVariants({ variant: "ghost" }),
              "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
            ),
            day_range_end: "day-range-end",
            day_selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside:
              "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
            day_disabled: "text-muted-foreground opacity-50",
            day_range_middle:
              "aria-selected:bg-accent aria-selected:text-accent-foreground",
            day_hidden: "invisible",
            ...classNames,
          }}
          components={{
            IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" {...props} />,
            IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" {...props} />,
            Caption: ({ displayMonth }) => {
                return (
                  <div className="flex justify-center items-center gap-2">
                    <button
                      onClick={() => setView('months')}
                      className={cn(buttonVariants({ variant: 'ghost' }), "px-2 py-1 h-auto text-sm font-semibold rounded-md bg-accent text-accent-foreground hover:bg-accent/80")}
                    >
                      {new Date(displayMonth).toLocaleString('default', { month: 'long' })}
                    </button>
                    <button
                      onClick={() => setView('years')}
                      className={cn(buttonVariants({ variant: 'ghost' }), "px-2 py-1 h-auto text-sm font-semibold rounded-md bg-accent text-accent-foreground hover:bg-accent/80")}
                    >
                      {displayMonth.getFullYear()}
                    </button>
                  </div>
                );
            }
          }}
          month={currentDate}
          onMonthChange={setCurrentDate}
          {...props}
        />
      )}
      {view === 'months' && renderMonthView()}
      {view === 'years' && renderYearView()}
    </>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
