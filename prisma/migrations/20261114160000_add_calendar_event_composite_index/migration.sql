-- CreateIndex
CREATE INDEX IF NOT EXISTS "CalendarEvent_calendarId_startDate_idx"
ON "CalendarEvent"("calendarId", "startDate");
