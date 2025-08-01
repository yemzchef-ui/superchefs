// import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerWithRangeProps {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
}

export function DatePickerWithRange({
  date,
  setDate,
}: DatePickerWithRangeProps) {
  return (
    <div className="grid gap-2">
      <Popover>
      <PopoverTrigger asChild>
        <Button
        id="date"
        variant={"outline"}
        className={cn(
          "w-full md:w-[300px] justify-start text-left font-normal",
          !date && "text-muted-foreground"
        )}
        >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {date?.from ? (
          date.to ? (
          <>
            {format(date.from, "LLL dd, y")} -{" "}
            {format(date.to, "LLL dd, y")}
          </>
          ) : (
          format(date.from, "LLL dd, y")
          )
        ) : (
          <span>Pick a date range</span>
        )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
        // initialFocus
        mode="range"
        defaultMonth={date?.from}
        selected={date}
        onSelect={setDate}
        numberOfMonths={2}
        fixedWeeks
        modifiersClassNames={{
          selected: "bg-green-700 text-white", // Selected dates: gray background
          today: "bg-red-600 text-white",   // Today: green background
          // range_start: "rounded-l-md",
          // range_end: "rounded-r-md",
        }}
        modifiers={{
          today: (day) => {
          const today = new Date();
          return (
            day.getDate() === today.getDate() &&
            day.getMonth() === today.getMonth() &&
            day.getFullYear() === today.getFullYear()
          );
          },
        }}
        />
      </PopoverContent>
      </Popover>
    </div>
  );
}